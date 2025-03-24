/**
 * Test script for Invaluable scraper with GCS integration
 * Limited to 3 pages to verify GCS storage functionality
 */
const path = require('path');
const BrowserManager = require('../scrapers/invaluable/browser');
const { buildSearchParams } = require('../scrapers/invaluable/utils');
const { handleFirstPage } = require('../scrapers/invaluable/pagination');
const PaginationManager = require('../scrapers/invaluable/pagination/pagination-manager');

// Test configuration - LIMITED TO 3 PAGES
const CONFIG = {
  // Scraping settings
  category: 'furniture',    // Test category
  maxPages: 3,              // *** LIMIT TO 3 PAGES FOR TESTING ***
  startPage: 1,
  
  // Browser settings
  userDataDir: path.join(__dirname, '../../temp/chrome-data'),
  headless: true,           // Run headless for testing
  
  // Storage settings
  gcsEnabled: true,
  gcsBucket: 'invaluable-data',
  batchSize: 3,             // Small batch size for testing
  
  // Rate limiting - faster for testing
  baseDelay: 1500,
  maxDelay: 5000,
  minDelay: 1000,
  maxRetries: 2,
  
  // Checkpoint settings
  checkpointInterval: 1,    // Save checkpoint after each page
  checkpointDir: path.join(__dirname, '../../temp/checkpoints'),
};

/**
 * Run test scraper function
 */
async function testGcsScraper() {
  console.log('=== STARTING GCS INTEGRATION TEST ===');
  console.log(`Category: ${CONFIG.category}`);
  console.log(`Pages to fetch: ${CONFIG.maxPages}`);
  console.log(`GCS Bucket: ${CONFIG.gcsBucket}`);
  
  // Initialize browser
  const browser = new BrowserManager({
    userDataDir: CONFIG.userDataDir,
    headless: CONFIG.headless,
  });
  
  try {
    await browser.initialize();
    console.log('Browser initialized');
    
    // Build search parameters
    const searchParams = buildSearchParams({ 
      category: CONFIG.category,
      sortBy: 'item_title_asc',
    });
    
    // Get first page
    console.log('Fetching first page...');
    const { results: firstPageResults, initialCookies } = await handleFirstPage(browser, searchParams);
    
    if (!firstPageResults || !firstPageResults.results || !firstPageResults.results[0]?.hits) {
      throw new Error('Failed to get first page results');
    }
    
    const totalHits = firstPageResults.results[0].meta?.totalHits || 0;
    console.log(`Found ${totalHits} total items in category`);
    
    // Initialize pagination manager
    const paginationManager = new PaginationManager({
      category: CONFIG.category,
      query: searchParams.keyword || CONFIG.category,
      maxPages: CONFIG.maxPages,
      startPage: CONFIG.startPage,
      checkpointInterval: CONFIG.checkpointInterval,
      checkpointDir: CONFIG.checkpointDir,
      gcsEnabled: CONFIG.gcsEnabled,
      gcsBucket: CONFIG.gcsBucket,
      // gcsCredentials is not specified - will use Application Default Credentials
      batchSize: CONFIG.batchSize,
      baseDelay: CONFIG.baseDelay,
      maxDelay: CONFIG.maxDelay,
      minDelay: CONFIG.minDelay,
      maxRetries: CONFIG.maxRetries,
    });
    
    // Process pagination
    console.log('Starting pagination process (limited to 3 pages)...');
    await paginationManager.processPagination(
      browser,
      searchParams,
      firstPageResults,
      initialCookies
    );
    
    // Print summary statistics
    const stats = paginationManager.getStats();
    console.log('\n===== TEST COMPLETE =====');
    console.log(`Category: ${CONFIG.category}`);
    console.log(`Total items collected: ${stats.totalItems}`);
    console.log(`Pages processed: ${stats.completedPages}`);
    console.log(`GCS data saved to: gs://${CONFIG.gcsBucket}/raw/${CONFIG.category}/`);
    console.log(`Batches saved: ${stats.batchesSaved}`);
    console.log('=====================');
    
    return stats;
  } catch (error) {
    console.error('Error during test:', error);
    throw error;
  } finally {
    // Always close the browser
    await browser.close();
    console.log('Browser closed');
  }
}

// Run the test if this file is executed directly
if (require.main === module) {
  testGcsScraper()
    .then(() => {
      console.log('GCS integration test completed successfully');
      process.exit(0);
    })
    .catch(error => {
      console.error('Test failed:', error);
      process.exit(1);
    });
}

module.exports = testGcsScraper; 