/**
 * Refresh Service - Handles automated refresh of all keywords
 */
const fs = require('fs').promises;
const path = require('path');
const { InvaluableScraper } = require('../scrapers/invaluable');
const SearchStorageService = require('./search-storage');

/**
 * Builds search parameters for a search
 * @param {string} keyword - Keyword for search (serves as folder name)
 * @param {string} query - Query for search (serves as subfolder name)
 * @param {number} page - Page number to fetch
 * @param {object} additionalParams - Additional search parameters
 * @returns {object} - Search parameters
 */
function buildSearchParams(keyword, query, page = 1, additionalParams = {}) {
  const params = {
    query: query || keyword,
    keyword: keyword,
    priceResult: { min: 250 },
    upcoming: 'false',
    ...additionalParams
  };
  
  if (page > 1) {
    params.page = page;
  }
  
  return params;
}

/**
 * Read and parse the keywords file
 * @returns {Promise<Array<string>>} Array of keywords
 */
async function readKeywordsFile() {
  try {
    const keywordsFilePath = path.join(process.cwd(), 'KWs.txt');
    const keywordsFileContent = await fs.readFile(keywordsFilePath, 'utf8');
    
    const keywords = JSON.parse(keywordsFileContent);
    
    if (!Array.isArray(keywords)) {
      throw new Error('Keywords file does not contain a valid array');
    }
    
    return keywords;
  } catch (error) {
    console.error('Error reading keywords file:', error);
    throw error;
  }
}

/**
 * Process all keywords from the list sequentially
 * @param {Array<string>} keywords - Array of keywords to process
 * @returns {Promise<object>} Processing statistics
 */
async function processKeywords(keywords) {
  // Statistics object
  const stats = {
    totalKeywords: keywords.length,
    processed: 0,
    succeeded: 0,
    failed: 0,
    skipped: 0,
    startTime: new Date(),
    endTime: null,
    details: []
  };
  
  // Create a scraper instance
  const scraper = new InvaluableScraper();
  await scraper.initialize();
  
  try {
    // Process each keyword sequentially
    for (let i = 0; i < keywords.length; i++) {
      const keyword = keywords[i];
      const keywordStats = {
        keyword,
        status: 'pending',
        totalItems: 0,
        totalPages: 0,
        error: null,
        startTime: new Date(),
        endTime: null
      };
      
      console.log(`[${i+1}/${keywords.length}] Processing keyword: ${keyword}`);
      
      try {
        // Build basic search parameters
        const searchParams = buildSearchParams(keyword, keyword);
        
        // Default cookies for API access
        const cookies = [
          {
            name: 'AZTOKEN-PROD',
            value: '1CA056EF-FA81-41E5-A17D-9BAF5700CB29',
            domain: '.invaluable.com'
          },
          {
            name: 'cf_clearance',
            value: 'Yq4QHU.y14z93vU3CmLCK80CU7Pq6pgupmW0eM8k548-1738320515-1.2.1.1-ZFXBFgIPHghfvwwfhRbZx27.6zPihqfQ4vGP0VY1v66mKc.wwAOVRiRJhK6ouVt_.wMB30bkeY0r9NK.KUTU4gu7GzZxbyh0EH_gE36kcnHDvGATrI_vFs9y1XHq3PgtlHmBUflqgjcS6x9MC5YpXoeELPYiT0k59IPMn..1cHED7zV6T78hILKinjM6hZ.ZeQwetIN6SPmuvXb7V2z2ddJa64Vg_zUi.euce0SjjJr5ti7tHWoFsTV1DO1MkFwDfUpy1yTCdESho.EwyRgfdfRAlx6njkTmlWNkp1aXcXU',
            domain: '.invaluable.com'
          }
        ];
        
        // Check if folder exists for this keyword (optional - can be removed to always refresh)
        const searchStorage = SearchStorageService.getInstance({ keyword });
        const folderExists = await searchStorage.folderExists(keyword, keyword);
        
        if (folderExists) {
          console.log(`Data already exists for keyword="${keyword}". Refreshing...`);
        }
        
        // Make a single page request to get metadata
        const initialResult = await scraper.search(searchParams, cookies);
        
        // Extract total pages from the metadata
        let totalHits = 0;
        let totalPages = 0;
        
        if (initialResult && typeof initialResult === 'object') {
          if ('nbPages' in initialResult) {
            totalPages = initialResult.nbPages;
            totalHits = initialResult.nbHits || 0;
          } else if (initialResult.results?.[0]?.meta?.totalHits) {
            totalHits = initialResult.results[0].meta.totalHits;
            const hitsPerPage = initialResult.results[0].meta.hitsPerPage || 96;
            totalPages = Math.ceil(totalHits / hitsPerPage);
          } else if (initialResult.results?.[0]?.nbHits) {
            totalHits = initialResult.results[0].nbHits;
            totalPages = initialResult.results[0].nbPages || Math.ceil(totalHits / 96);
          } else {
            console.log(`Metadata not found for keyword ${keyword}. Skipping.`);
            keywordStats.status = 'skipped';
            keywordStats.error = 'Metadata not found in response';
            keywordStats.endTime = new Date();
            stats.skipped++;
            stats.details.push(keywordStats);
            continue;
          }
        } else {
          console.log(`Invalid response for keyword ${keyword}. Skipping.`);
          keywordStats.status = 'skipped';
          keywordStats.error = 'Invalid response';
          keywordStats.endTime = new Date();
          stats.skipped++;
          stats.details.push(keywordStats);
          continue;
        }
        
        // Update stats
        keywordStats.totalItems = totalHits;
        keywordStats.totalPages = totalPages;
        
        console.log(`Found ${totalHits} items across ${totalPages} pages for keyword "${keyword}"`);
        
        // Save the first page results
        await searchStorage.savePageResults(keyword, 1, initialResult, keyword);
        
        // Scrape all pages if more than one
        if (totalPages > 1) {
          console.log(`Starting full search of all ${totalPages} pages for keyword "${keyword}"`);
          await scraper.searchAllPages(searchParams, cookies, totalPages);
        }
        
        // Update stats for success
        keywordStats.status = 'success';
        keywordStats.endTime = new Date();
        stats.succeeded++;
        
        console.log(`Successfully processed keyword: ${keyword}`);
        
      } catch (error) {
        console.error(`Error processing keyword "${keyword}":`, error);
        
        // Update stats for failure
        keywordStats.status = 'failed';
        keywordStats.error = error.message;
        keywordStats.endTime = new Date();
        stats.failed++;
      }
      
      // Record details of this keyword
      stats.processed++;
      stats.details.push(keywordStats);
      
      // Add a small delay between keywords to avoid rate limiting
      console.log('Waiting 5 seconds before next keyword...');
      await new Promise(resolve => setTimeout(resolve, 5000));
    }
    
    console.log('All keywords processed successfully.');
    
  } catch (error) {
    console.error('Error in keyword processing:', error);
  } finally {
    // Close the browser
    try {
      await scraper.close();
    } catch (error) {
      console.error('Error closing scraper:', error);
    }
    
    // Complete the stats
    stats.endTime = new Date();
    
    return stats;
  }
}

/**
 * Start the refresh process
 * @returns {Promise<object>} Processing status
 */
async function startRefresh() {
  try {
    const keywords = await readKeywordsFile();
    console.log(`Starting refresh of ${keywords.length} keywords`);
    
    if (keywords.length === 0) {
      return {
        success: false,
        error: 'No keywords found',
        message: 'The keywords file is empty or contains no valid keywords'
      };
    }
    
    // Start processing keywords (non-blocking)
    const processPromise = processKeywords(keywords);
    
    // Return initial status
    return {
      success: true,
      message: 'Automated refresh of all keywords started',
      details: {
        totalKeywords: keywords.length,
        keywords: keywords.slice(0, 10) // Show first 10 keywords
      }
    };
  } catch (error) {
    console.error('Error starting refresh:', error);
    return {
      success: false,
      error: 'Failed to start refresh',
      message: error.message
    };
  }
}

module.exports = {
  startRefresh,
  readKeywordsFile,
  processKeywords
}; 