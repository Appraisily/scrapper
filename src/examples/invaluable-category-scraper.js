/**
 * Example Invaluable Category Scraper using the enhanced PaginationManager
 * 
 * This example demonstrates how to use the PaginationManager to scrape an entire category
 * with resumable pagination, progress tracking, rate limiting, and GCS storage.
 */
const path = require('path');
const BrowserManager = require('../scrapers/invaluable/browser');
const { buildSearchParams } = require('../scrapers/invaluable/utils');
const { handleFirstPage } = require('../scrapers/invaluable/pagination');
const PaginationManager = require('../scrapers/invaluable/pagination/pagination-manager');

// Configuration
const CONFIG = {
  // Scraping settings
  category: 'furniture',      // Category to scrape
  maxPages: 4000,             // Maximum pages to scrape
  startPage: 1,               // Page to start from (useful for resuming)
  
  // Browser settings
  userDataDir: path.join(__dirname, '../../temp/chrome-data'),
  headless: false,            // Set to true for production
  
  // Storage settings
  gcsEnabled: true,           // Enable Google Cloud Storage
  gcsBucket: 'invaluable-data',
  batchSize: 100,             // Number of pages per batch file
  // If using explicit credentials file or object (optional)
  // gcsCredentials: require('../path/to/credentials.json'), 
  
  // Rate limiting settings
  baseDelay: 2000,            // Base delay between requests in ms
  maxDelay: 30000,            // Maximum delay in ms
  minDelay: 1000,             // Minimum delay in ms
  maxRetries: 3,              // Maximum retries per page
  
  // Checkpoint settings
  checkpointInterval: 5,      // Save checkpoint every N pages
  checkpointDir: path.join(__dirname, '../../temp/checkpoints'),
};

/**
 * Main scraper function
 */
async function scrapeCategory() {
  console.log(`Starting Invaluable category scraper for: ${CONFIG.category}`);
  console.log(`Will scrape up to ${CONFIG.maxPages} pages with batch size of ${CONFIG.batchSize}`);
  
  // Initialize browser
  const browser = new BrowserManager({
    userDataDir: CONFIG.userDataDir,
    headless: CONFIG.headless,
  });
  
  try {
    await browser.init();
    console.log('Browser initialized');
    
    // Build search parameters for the category
    const searchParams = buildSearchParams({ 
      category: CONFIG.category,
      sortBy: 'item_title_asc',  // Consistent ordering helps with pagination
    });
    
    // Get the first page of results
    console.log(`Getting first page of results for ${CONFIG.category}...`);
    const { results: firstPageResults, initialCookies } = await handleFirstPage(browser, searchParams);
    
    if (!firstPageResults || !firstPageResults.results || !firstPageResults.results[0]?.hits) {
      throw new Error('Failed to get first page results');
    }
    
    const totalHits = firstPageResults.results[0].meta?.totalHits || 0;
    console.log(`Found ${totalHits} total items in ${CONFIG.category}`);
    
    // Initialize the pagination manager
    const paginationManager = new PaginationManager({
      category: CONFIG.category,
      query: searchParams.keyword || CONFIG.category,
      maxPages: CONFIG.maxPages,
      startPage: CONFIG.startPage,
      checkpointInterval: CONFIG.checkpointInterval,
      checkpointDir: CONFIG.checkpointDir,
      gcsEnabled: CONFIG.gcsEnabled,
      gcsBucket: CONFIG.gcsBucket,
      gcsCredentials: CONFIG.gcsCredentials,
      batchSize: CONFIG.batchSize,
      baseDelay: CONFIG.baseDelay,
      maxDelay: CONFIG.maxDelay,
      minDelay: CONFIG.minDelay,
      maxRetries: CONFIG.maxRetries,
    });
    
    // Process pagination
    console.log('Starting pagination process...');
    const allResults = await paginationManager.processPagination(
      browser,
      searchParams,
      firstPageResults,
      initialCookies
    );
    
    // Print summary statistics
    const stats = paginationManager.getStats();
    console.log('\n===== SCRAPING COMPLETE =====');
    console.log(`Category: ${CONFIG.category}`);
    console.log(`Total items collected: ${stats.totalItems}`);
    console.log(`Pages processed: ${stats.completedPages} of ${Math.min(Math.ceil(totalHits / 96), CONFIG.maxPages)}`);
    console.log(`Failed pages: ${stats.failedPages}`);
    console.log(`Success rate: ${stats.successRate}`);
    console.log(`Total time: ${stats.runningTimeMin.toFixed(2)} minutes`);
    console.log(`Items per minute: ${stats.itemsPerMinute}`);
    
    if (CONFIG.gcsEnabled) {
      console.log(`Batches saved to GCS: ${stats.batchesSaved}`);
      console.log(`GCS Bucket: gs://${CONFIG.gcsBucket}/raw/${CONFIG.category}/`);
    }
    
    return stats;
  } catch (error) {
    console.error('Error during scraping:', error);
    throw error;
  } finally {
    // Always close the browser
    await browser.close();
    console.log('Browser closed');
  }
}

/**
 * Run the scraper if this file is called directly
 */
if (require.main === module) {
  scrapeCategory()
    .then(() => {
      console.log('Scraping completed successfully');
      process.exit(0);
    })
    .catch(error => {
      console.error('Scraping failed:', error);
      process.exit(1);
    });
}

module.exports = {
  scrapeCategory,
  CONFIG
}; 