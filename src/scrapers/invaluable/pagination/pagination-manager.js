/**
 * Enhanced Pagination Manager for Invaluable Scraper
 * Provides resumable pagination, progress tracking, and adaptive rate limiting
 */
const fs = require('fs');
const path = require('path');
const { handlePagination, requestPageResults } = require('./index');
const { extractNavigationParams } = require('./navigation-params');
const { buildResultsPayload } = require('./request-interceptor');
const StorageManager = require('../../../utils/storage-manager');

class PaginationManager {
  constructor(options = {}) {
    // Configuration
    this.maxPages = options.maxPages || 100;
    this.startPage = options.startPage || 1;
    this.checkpointInterval = options.checkpointInterval || 5;
    this.checkpointDir = options.checkpointDir || 'checkpoints';
    this.category = options.category || 'default';
    this.query = options.query || '';
    this.batchSize = options.batchSize || 100; // Pages per batch file
    
    // Storage options
    this.gcsEnabled = options.gcsEnabled !== false;
    this.gcsBucket = options.gcsBucket || 'invaluable-data';
    this.gcsCredentials = options.gcsCredentials || null;
    
    // Rate limiting
    this.baseDelay = options.baseDelay || 500;       // Base delay in ms (REDUCED from 2000)
    this.maxDelay = options.maxDelay || 30000;        // Max delay in ms
    this.minDelay = options.minDelay || 300;         // Min delay in ms (REDUCED from 1000)
    this.adaptiveDelay = this.baseDelay;              // Current delay (will adjust)
    this.successStreak = 0;                           // Count of consecutive successes
    this.failureStreak = 0;                           // Count of consecutive failures
    this.rateLimitDetected = false;                   // Flag for rate limiting
    
    // Empty page handling
    this.emptyPagesStreak = 0;                        // Count of consecutive empty pages
    this.maxEmptyPagesStreak = options.maxEmptyPagesStreak || 10; // Max consecutive empty pages before stopping
    
    // Retry settings
    this.maxRetries = options.maxRetries || 3;        // Max retries per page
    
    // State tracking
    this.completedPages = new Set();
    this.failedPages = new Set();
    this.currentPage = this.startPage;
    this.navState = {};
    this.checkpointData = null;
    this.isRunning = false;
    this.currentBatch = null;
    this.batchData = null;
    
    // Statistics
    this.stats = {
      startTime: null,
      endTime: null,
      totalRequests: 0,
      successfulRequests: 0,
      failedRequests: 0,
      retries: 0,
      rateLimitEvents: 0,
      totalDelay: 0,
      avgResponseTime: 0,
      itemsPerPage: 0,
      totalItems: 0,
      batchesSaved: 0,
      emptyPages: 0
    };
    
    // Initialize storage manager if GCS is enabled
    if (this.gcsEnabled) {
      this.storage = new StorageManager({
        bucketName: this.gcsBucket,
        batchSize: this.batchSize,
        credentials: this.gcsCredentials
      });
      console.log(`GCS storage enabled with bucket: ${this.gcsBucket}`);
    }
  }

  /**
   * Initialize pagination manager and load checkpoint if available
   */
  async initialize() {
    try {
      // Try to load existing checkpoint from GCS if enabled
      if (this.gcsEnabled) {
        const checkpoint = await this.storage.getCheckpoint(this.category);
        if (checkpoint) {
          // Restore state from checkpoint
          this.completedPages = new Set(checkpoint.completedPages || []);
          this.failedPages = new Set(checkpoint.failedPages || []);
          this.currentPage = checkpoint.currentPage || this.startPage;
          this.stats = { ...this.stats, ...checkpoint.stats };
          this.navState = checkpoint.navState || {};
          
          console.log(`Loaded checkpoint from GCS for "${this.category}" with query "${this.query}"`);
          console.log(`Resuming from page ${this.currentPage} with ${this.completedPages.size} pages already completed`);
          
          this.checkpointData = checkpoint;
          return true;
        }
      }
      
      // Fallback to local checkpoint if GCS is disabled or no checkpoint found
      if (!this.gcsEnabled) {
        // Create checkpoint directory if it doesn't exist
        if (!fs.existsSync(this.checkpointDir)) {
          fs.mkdirSync(this.checkpointDir, { recursive: true });
          console.log(`Created checkpoint directory: ${this.checkpointDir}`);
        }
        
        // Try to load existing checkpoint
        const checkpointFile = path.join(
          this.checkpointDir, 
          `${this.category}_${this.query.replace(/[^a-z0-9]/gi, '_')}.json`
        );
        
        if (fs.existsSync(checkpointFile)) {
          const checkpoint = JSON.parse(fs.readFileSync(checkpointFile, 'utf8'));
          
          // Restore state from checkpoint
          this.completedPages = new Set(checkpoint.completedPages || []);
          this.failedPages = new Set(checkpoint.failedPages || []);
          this.currentPage = checkpoint.currentPage || this.startPage;
          this.stats = { ...this.stats, ...checkpoint.stats };
          this.navState = checkpoint.navState || {};
          
          console.log(`Loaded local checkpoint for "${this.category}" with query "${this.query}"`);
          console.log(`Resuming from page ${this.currentPage} with ${this.completedPages.size} pages already completed`);
          
          this.checkpointData = checkpoint;
        }
      }
      
      return true;
    } catch (error) {
      console.error(`Error initializing pagination manager: ${error.message}`);
      return false;
    }
  }

  /**
   * Save current checkpoint
   */
  async saveCheckpoint() {
    try {
      const checkpointData = {
        category: this.category,
        query: this.query,
        currentPage: this.currentPage,
        completedPages: Array.from(this.completedPages),
        failedPages: Array.from(this.failedPages),
        lastUpdated: new Date().toISOString(),
        stats: this.stats,
        navState: this.navState
      };
      
      // Save to GCS if enabled
      if (this.gcsEnabled) {
        await this.storage.saveCheckpoint(this.category, checkpointData);
      }
      
      // Also save locally if not using GCS
      if (!this.gcsEnabled) {
        const checkpointFile = path.join(
          this.checkpointDir, 
          `${this.category}_${this.query.replace(/[^a-z0-9]/gi, '_')}.json`
        );
        
        fs.writeFileSync(checkpointFile, JSON.stringify(checkpointData, null, 2));
        console.log(`Local checkpoint saved: ${checkpointFile}`);
      }
      
      this.checkpointData = checkpointData;
      return true;
    } catch (error) {
      console.error(`Error saving checkpoint: ${error.message}`);
      return false;
    }
  }

  /**
   * Initialize a new batch for storing results
   */
  initializeBatch(baseResults) {
    // Clone the structure but without the hits
    this.batchData = {
      results: [{
        meta: { ...baseResults.results[0].meta },
        hits: []
      }]
    };
    
    console.log(`Initialized new batch data structure`);
  }

  /**
   * Add page results to current batch
   */
  addToBatch(pageResults, pageNum) {
    if (!this.batchData || !pageResults || !pageResults.results || !pageResults.results[0]?.hits) {
      return;
    }
    
    // Add the hits to our batch
    this.batchData.results[0].hits.push(...pageResults.results[0].hits);
    
    console.log(`Added page ${pageNum} data to current batch, total items: ${this.batchData.results[0].hits.length}`);
  }

  /**
   * Save current batch to GCS
   */
  async saveBatch() {
    if (!this.gcsEnabled || !this.batchData) return true;
    
    try {
      const batchStartPage = Math.floor((this.currentBatch - 1) * this.batchSize) + 1;
      const batchEndPage = Math.min(batchStartPage + this.batchSize - 1, this.maxPages);
      
      await this.storage.saveBatch(
        this.category, 
        batchStartPage, 
        batchEndPage, 
        this.batchData
      );
      
      this.stats.batchesSaved++;
      this.batchData = null; // Clear batch data after saving
      
      // Save metadata after each batch
      await this.saveMetadata();
      
      return true;
    } catch (error) {
      console.error(`Error saving batch: ${error.message}`);
      return false;
    }
  }

  /**
   * Save metadata about the collection
   */
  async saveMetadata() {
    if (!this.gcsEnabled) return true;
    
    try {
      const metadata = {
        category: this.category,
        query: this.query,
        lastUpdated: new Date().toISOString(),
        stats: this.getStats(),
      };
      
      await this.storage.saveMetadata(this.category, metadata);
      return true;
    } catch (error) {
      console.error(`Error saving metadata: ${error.message}`);
      return false;
    }
  }

  /**
   * Calculate adaptive delay based on recent performance
   * Includes jitter to avoid detection patterns
   */
  calculateDelay() {
    // Start with base delay
    let delay = this.adaptiveDelay;
    
    // If rate limiting was detected, increase delay significantly
    if (this.rateLimitDetected) {
      delay = Math.min(delay * 2, this.maxDelay);
      this.rateLimitDetected = false;
      this.stats.rateLimitEvents++;
      console.log(`⚠️ Rate limit detected, increasing delay to ${delay}ms`);
    } 
    // If we have consecutive failures, increase delay (exponential backoff)
    else if (this.failureStreak > 0) {
      delay = Math.min(this.baseDelay * Math.pow(1.5, this.failureStreak), this.maxDelay);
      console.log(`⚠️ ${this.failureStreak} consecutive failures, increasing delay to ${delay}ms`);
    } 
    // If we have many consecutive successes, gradually decrease delay
    else if (this.successStreak > 5) {
      delay = Math.max(delay * 0.9, this.minDelay);
      console.log(`✅ Good performance, reducing delay to ${delay}ms`);
    }
    
    // Add jitter to avoid detection patterns (+/- 15%)
    const jitterFactor = 0.85 + (Math.random() * 0.3);
    const jitteredDelay = Math.round(delay * jitterFactor);
    
    // Update the adaptive delay for next time
    this.adaptiveDelay = delay;
    
    // Track total delay for statistics
    this.stats.totalDelay += jitteredDelay;
    
    return jitteredDelay;
  }

  /**
   * Apply rate limiting between requests
   */
  async applyRateLimit() {
    const delay = this.calculateDelay();
    console.log(`Waiting ${delay}ms before next request...`);
    
    return new Promise(resolve => setTimeout(resolve, delay));
  }

  /**
   * Update success/failure streaks based on request outcome
   */
  updateRateLimitTracking(success, rateLimited = false) {
    if (rateLimited) {
      this.rateLimitDetected = true;
      this.failureStreak++;
      this.successStreak = 0;
    } else if (success) {
      this.successStreak++;
      this.failureStreak = 0;
    } else {
      this.failureStreak++;
      this.successStreak = 0;
    }
  }

  /**
   * Get current statistics
   */
  getStats() {
    // Calculate derived statistics
    const now = new Date();
    const runningTimeMs = this.stats.startTime ? 
      (now - new Date(this.stats.startTime)) : 0;
    const runningTimeMin = runningTimeMs / (1000 * 60);
    
    const itemsPerMinute = runningTimeMin > 0 ? 
      Math.round(this.stats.totalItems / runningTimeMin) : 0;
    
    const successRate = this.stats.totalRequests > 0 ? 
      Math.round((this.stats.successfulRequests / this.stats.totalRequests) * 100) : 0;
    
    return {
      ...this.stats,
      currentPage: this.currentPage,
      completedPages: this.completedPages.size,
      failedPages: this.failedPages.size,
      runningTimeMs,
      runningTimeMin: Math.round(runningTimeMin * 100) / 100,
      itemsPerMinute,
      successRate: `${successRate}%`,
      batchesSaved: this.stats.batchesSaved
    };
  }

  /**
   * Process page results
   */
  processPageResults(allResults, pageResults, pageNum) {
    try {
      if (!pageResults || !pageResults.results || !pageResults.results[0]?.hits) {
        console.log(`⚠️ No valid hits found in page ${pageNum} results`);
        this.emptyPagesStreak++;
        this.stats.emptyPages++;
        console.log(`Empty pages streak: ${this.emptyPagesStreak}/${this.maxEmptyPagesStreak}`);
        return 0;
      }
      
      const pageHits = pageResults.results[0].hits;
      let newResults = 0;
      let duplicates = 0;
      
      // Keep track of processed item IDs
      const processedIds = new Set();
      
      // Add hits from first page (if not in our processedIds yet)
      if (pageNum === 1 && allResults && allResults.results && allResults.results[0]?.hits) {
        allResults.results[0].hits.forEach(item => {
          const itemId = item.lotId || item.id || JSON.stringify(item);
          processedIds.add(itemId);
        });
      }
      
      // Process each hit
      pageHits.forEach(item => {
        const itemId = item.lotId || item.id || JSON.stringify(item);
        
        if (!processedIds.has(itemId)) {
          // If we're not on page 1, add to results
          if (pageNum > 1) {
            allResults.results[0].hits.push(item);
          }
          
          processedIds.add(itemId);
          newResults++;
        } else {
          duplicates++;
        }
      });
      
      // If we found any new results, reset the empty pages streak
      if (newResults > 0) {
        this.emptyPagesStreak = 0;
      } else {
        // Otherwise increment it
        this.emptyPagesStreak++;
        this.stats.emptyPages++;
        console.log(`Empty pages streak: ${this.emptyPagesStreak}/${this.maxEmptyPagesStreak} (no new items)`);
      }
      
      console.log(`Page ${pageNum}: ${newResults} new items, ${duplicates} duplicates`);
      this.stats.totalItems += newResults;
      
      // Update items per page stat
      this.stats.itemsPerPage = 
        ((this.stats.itemsPerPage * (this.completedPages.size || 1)) + newResults) / 
        (this.completedPages.size + (this.completedPages.has(pageNum) ? 0 : 1));
      
      return newResults;
    } catch (error) {
      console.error(`Error processing page results: ${error.message}`);
      return 0;
    }
  }

  /**
   * Detect if response indicates rate limiting
   */
  isRateLimited(response) {
    if (!response) return false;
    
    // Check for common rate limit HTTP status codes
    if (response.error === 429 || response.error === 503) {
      return true;
    }
    
    // Check for Cloudflare specific messages
    if (response.message && 
        (response.message.includes('cloudflare') || 
         response.message.includes('rate limit') ||
         response.message.includes('too many requests'))) {
      return true;
    }
    
    return false;
  }

  /**
   * Process all pagination
   */
  async processPagination(browser, params, firstPageResults, initialCookies) {
    // Initialize
    if (!this.isRunning) {
      await this.initialize();
      this.stats.startTime = this.stats.startTime || new Date().toISOString();
      this.isRunning = true;
    }
    
    // Extract navigation parameters from first page
    if (!this.navState.refId) {
      const navParams = extractNavigationParams(firstPageResults);
      this.navState = { 
        ...navParams, 
        cookies: initialCookies 
      };
    }
    
    // Create results container
    const allResults = JSON.parse(JSON.stringify(firstPageResults));
    
    // Mark first page as completed
    this.completedPages.add(1);
    
    // Process first page to get item count and add to stats
    this.processPageResults(allResults, firstPageResults, 1);
    
    // Initialize first batch with first page data
    if (this.gcsEnabled) {
      this.currentBatch = 1;
      this.initializeBatch(firstPageResults);
      this.addToBatch(firstPageResults, 1);
    }
    
    // Extract total pages
    const totalHits = firstPageResults.results?.[0]?.meta?.totalHits || 0;
    const hitsPerPage = firstPageResults.results?.[0]?.meta?.hitsPerPage || 96;
    const estimatedTotalPages = Math.ceil(totalHits / hitsPerPage);
    const pagesToProcess = Math.min(estimatedTotalPages, this.maxPages);
    
    console.log(`Starting pagination for "${this.category}" with query "${this.query}"`);
    console.log(`Estimated total pages: ${estimatedTotalPages}, processing up to ${pagesToProcess}`);
    
    // Reset empty pages streak counter
    this.emptyPagesStreak = 0;
    
    // Main pagination loop
    for (let pageNum = 2; pageNum <= pagesToProcess; pageNum++) {
      // Skip if already completed
      if (this.completedPages.has(pageNum)) {
        console.log(`Page ${pageNum} already processed, skipping`);
        continue;
      }
      
      // Check if we should stop due to too many consecutive empty pages
      if (this.emptyPagesStreak >= this.maxEmptyPagesStreak) {
        console.log(`⚠️ Stopping pagination after ${this.emptyPagesStreak} consecutive empty pages`);
        console.log(`This likely indicates we've reached the end of available results.`);
        break;
      }
      
      this.currentPage = pageNum;
      console.log(`\n----- Processing page ${pageNum} of ${pagesToProcess} -----`);
      
      // Calculate which batch this page belongs to if using GCS
      if (this.gcsEnabled) {
        const pageBatch = Math.floor((pageNum - 1) / this.batchSize) + 1;
        if (pageBatch !== this.currentBatch) {
          // Save previous batch before moving to next
          if (this.batchData) {
            await this.saveBatch();
          }
          // Start new batch
          this.currentBatch = pageBatch;
          this.initializeBatch(firstPageResults);
        }
      }
      
      // Apply rate limiting before request
      await this.applyRateLimit();
      
      // Process this page (with retries)
      let success = false;
      let retries = 0;
      
      while (!success && retries <= this.maxRetries) {
        try {
          this.stats.totalRequests++;
          const startTime = Date.now();
          
          let pageResults;
          if (retries > 0) {
            console.log(`Retry ${retries}/${this.maxRetries} for page ${pageNum}`);
            this.stats.retries++;
            
            // Apply additional delay for retries
            await new Promise(r => setTimeout(r, this.baseDelay * Math.pow(2, retries)));
          }
          
          // Use the existing browser instance to request the page
          const page = browser.getPage();
          
          // Build payload with the current page number
          const payload = buildResultsPayload(params, pageNum, this.navState);
          
          // Request the page
          pageResults = await requestPageResults(page, pageNum, params, this.navState);
          
          // Calculate response time
          const responseTime = Date.now() - startTime;
          this.stats.avgResponseTime = 
            ((this.stats.avgResponseTime * (this.stats.successfulRequests || 1)) + responseTime) / 
            (this.stats.successfulRequests + 1);
          
          // Check if we got valid results
          if (pageResults && pageResults.results && pageResults.results[0]?.hits) {
            // Success! Process results
            this.stats.successfulRequests++;
            this.updateRateLimitTracking(true);
            
            // Process the page results
            const newItems = this.processPageResults(allResults, pageResults, pageNum);
            
            // Add to current batch if GCS is enabled
            if (this.gcsEnabled) {
              this.addToBatch(pageResults, pageNum);
            }
            
            // Mark page as completed
            this.completedPages.add(pageNum);
            this.failedPages.delete(pageNum);
            
            console.log(`✅ Added ${newItems} items from page ${pageNum}, total: ${this.stats.totalItems}`);
            success = true;
            
            // Extract updated nav state if available
            const updatedNavParams = extractNavigationParams(pageResults);
            if (updatedNavParams.refId) {
              this.navState = {
                ...this.navState,
                ...updatedNavParams
              };
            }
            
            // Save checkpoint periodically
            if (pageNum % this.checkpointInterval === 0) {
              await this.saveCheckpoint();
            }
          } else {
            // Failed to get valid results
            this.stats.failedRequests++;
            this.failedPages.add(pageNum);
            this.updateRateLimitTracking(false);
            
            console.log(`❌ Failed to get results for page ${pageNum}`);
            
            // Check for rate limiting
            if (this.isRateLimited(pageResults)) {
              this.updateRateLimitTracking(false, true);
              console.log(`⚠️ Rate limiting detected for page ${pageNum}`);
            }
            
            retries++;
          }
        } catch (error) {
          console.error(`Error processing page ${pageNum}: ${error.message}`);
          this.stats.failedRequests++;
          this.failedPages.add(pageNum);
          this.updateRateLimitTracking(false);
          retries++;
        }
      }
      
      // If failed after all retries
      if (!success) {
        console.error(`❌ Failed to process page ${pageNum} after ${this.maxRetries} retries`);
      }
    }
    
    // Save final batch if we have data and using GCS
    if (this.gcsEnabled && this.batchData) {
      await this.saveBatch();
    }
    
    // Finalize statistics
    this.stats.endTime = new Date().toISOString();
    console.log(`\nPagination complete for "${this.category}" with query "${this.query}"`);
    console.log(`Stats: ${JSON.stringify(this.getStats(), null, 2)}`);
    
    // Save final checkpoint
    await this.saveCheckpoint();
    
    // Update allResults with pagination metadata
    allResults.paginationStats = this.getStats();
    allResults.pagesRetrieved = Array.from(this.completedPages);
    allResults.failedPages = Array.from(this.failedPages);
    
    return allResults;
  }
}

module.exports = PaginationManager; 