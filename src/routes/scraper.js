/**
 * Scraper routes - Endpoints to manage data scraping operations
 */
const express = require('express');
const router = express.Router();
const BrowserManager = require('../scrapers/invaluable/browser');
const { buildSearchParams } = require('../scrapers/invaluable/utils');
const { handleFirstPage } = require('../scrapers/invaluable/pagination');
const PaginationManager = require('../scrapers/invaluable/pagination/pagination-manager');

// Endpoint to start a scraping job
router.post('/start', express.json(), async (req, res) => {
  try {
    // Get parameters from request body with defaults
    const {
      category = 'furniture',
      query = '',
      maxPages = 10,
      startPage = 1,
      batchSize = 100,
      gcsBucket = 'invaluable-data',
      baseDelay = 2000,
      maxDelay = 30000,
      minDelay = 1000,
      saveToGcs = true
    } = req.body;
    
    // Validate required parameters
    if (!category) {
      return res.status(400).json({
        success: false,
        error: 'Missing required parameter',
        message: 'Category is required'
      });
    }
    
    // Return immediate response to client
    res.json({
      success: true,
      message: 'Scraping job started',
      jobDetails: {
        category,
        query,
        maxPages,
        startPage,
        saveToGcs,
        gcsBucket: saveToGcs ? gcsBucket : null,
        estimatedTimeMinutes: Math.ceil(maxPages * baseDelay / 60000)
      }
    });
    
    // Continue processing in the background after response is sent
    startScrapingJob({
      category,
      query,
      maxPages,
      startPage,
      batchSize,
      gcsBucket,
      baseDelay,
      maxDelay,
      minDelay,
      saveToGcs
    });
    
  } catch (error) {
    console.error('Error starting scraper job:', error);
    if (!res.headersSent) {
      res.status(500).json({
        success: false,
        error: 'Failed to start scraping job',
        message: error.message
      });
    }
  }
});

// Endpoint to get scraping job status (for future implementation)
router.get('/status/:jobId', async (req, res) => {
  // This would be implemented with a job tracking system
  res.json({
    success: true,
    message: 'Job status API not yet implemented',
    jobId: req.params.jobId
  });
});

/**
 * Start a scraping job in the background
 */
async function startScrapingJob(config) {
  console.log(`Starting scraping job for category: ${config.category}`);
  console.log(`Will scrape up to ${config.maxPages} pages`);
  
  // Initialize browser
  const browser = new BrowserManager();
  
  try {
    await browser.initialize();
    console.log('Browser initialized for scraping job');
    
    // Build search parameters
    const searchParams = buildSearchParams({
      category: config.category,
      keyword: config.query,
      sortBy: 'item_title_asc'  // Consistent ordering helps with pagination
    });
    
    // Get first page of results
    console.log(`Getting first page of results for ${config.category}...`);
    const { results: firstPageResults, initialCookies } = await handleFirstPage(browser, searchParams);
    
    if (!firstPageResults || !firstPageResults.results || !firstPageResults.results[0]?.hits) {
      throw new Error('Failed to get first page results');
    }
    
    const totalHits = firstPageResults.results[0].meta?.totalHits || 0;
    console.log(`Found ${totalHits} total items in ${config.category}`);
    
    // Initialize pagination manager
    const paginationManager = new PaginationManager({
      category: config.category,
      query: config.query || config.category,
      maxPages: config.maxPages,
      startPage: config.startPage,
      checkpointInterval: 5,
      gcsEnabled: config.saveToGcs,
      gcsBucket: config.gcsBucket,
      batchSize: config.batchSize,
      baseDelay: config.baseDelay,
      maxDelay: config.maxDelay,
      minDelay: config.minDelay
    });
    
    // Process pagination
    console.log('Starting pagination process...');
    const results = await paginationManager.processPagination(
      browser,
      searchParams,
      firstPageResults,
      initialCookies
    );
    
    // Print summary statistics
    const stats = paginationManager.getStats();
    console.log('\n===== SCRAPING JOB COMPLETE =====');
    console.log(`Category: ${config.category}`);
    console.log(`Total items collected: ${stats.totalItems}`);
    console.log(`Pages processed: ${stats.completedPages} of ${Math.min(Math.ceil(totalHits / 96), config.maxPages)}`);
    console.log(`Failed pages: ${stats.failedPages}`);
    console.log(`Success rate: ${stats.successRate}`);
    console.log(`Total time: ${stats.runningTimeMin.toFixed(2)} minutes`);
    
    if (config.saveToGcs) {
      console.log(`GCS data path: gs://${config.gcsBucket}/raw/${config.category}/`);
      console.log(`Batches saved: ${stats.batchesSaved}`);
    }
    
    return stats;
  } catch (error) {
    console.error('Error during scraping job:', error);
    throw error;
  } finally {
    // Always close the browser
    await browser.close();
    console.log('Scraping job browser closed');
  }
}

module.exports = router; 