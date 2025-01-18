const express = require('express');
const cors = require('cors');
const WorthpointScraper = require('./scraper');
const { getCredentials } = require('./secrets');

// Configure port from environment variable with fallback
const port = process.env.PORT || 3000;
console.log(`Starting server with port: ${port}`);

const app = express();

let scraper = null;
let initializationInProgress = false;

// Graceful shutdown handler
async function shutdown() {
  if (scraper) {
    console.log('Closing browser...');
    await scraper.close();
  }
  process.exit(0);
}

// Handle shutdown signals
process.on('SIGTERM', shutdown);
process.on('SIGINT', shutdown);

app.use(cors());
app.use(express.json());

async function initializeScraper() {
  if (initializationInProgress) {
    console.log('Initialization already in progress, waiting...');
    // Wait for existing initialization to complete
    while (initializationInProgress) {
      await new Promise(resolve => setTimeout(resolve, 100));
    }
    return;
  }

  initializationInProgress = true;
  console.log('Starting scraper initialization...');
  scraper = new WorthpointScraper();
  await scraper.initialize();
  const credentials = await getCredentials();
  await scraper.login(credentials.username, credentials.password);
  console.log('Scraper initialized and logged in');
}

// API endpoint to get art data
app.get('/api/art', async (req, res) => {
  try {
    if (!scraper) {
      console.log('Scraper not initialized, initializing now...');
      await initializeScraper();
    }

    console.log('Fetching art data...');
    const searchUrl = 'https://www.worthpoint.com/inventory/search?searchForm=search&ignoreSavedPreferences=true&max=100&sort=SaleDate&_img=false&img=true&_noGreyList=false&noGreyList=true&categories=fine-art&rMin=200&saleDate=ALL_TIME';
    const searchResults = await scraper.scrapeSearchResults(searchUrl);
    
    console.log(`Successfully fetched ${searchResults.length} results`);
    res.json({
      total: searchResults.length,
      data: searchResults
    });
  } catch (error) {
    console.error('Error:', error);
    res.status(500).json({ error: 'Failed to fetch art data' });
  }
});

// Start the server
app.listen(port, () => {
  console.log(`Server is now listening on port ${port}`);
  console.log('Environment:', process.env.NODE_ENV);
  console.log('Google Cloud Project:', process.env.GOOGLE_CLOUD_PROJECT);
});