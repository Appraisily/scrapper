const express = require('express');
const cors = require('cors');
const WorthpointScraper = require('./scraper');
const WorthpointApiScraper = require('./api-scraper');
const ChristiesScraper = require('./christies-scraper');
const InvaluableScraper = require('./invaluable-scraper');
const { getCredentials } = require('./secrets');

// Configure port from environment variable with fallback
const port = process.env.PORT || 3000;
console.log(`Starting server with port: ${port}`);

const app = express();

let browserScraper = null;
let apiScraper = null;
let christiesScraper = null;
let invaluableScraper = null;
let browserInitInProgress = false;
let apiInitInProgress = false;

// Graceful shutdown handler
async function shutdown() {
  if (browserScraper) {
    console.log('Closing browser...');
    await browserScraper.close();
  }
  process.exit(0);
}

// Handle shutdown signals
process.on('SIGTERM', shutdown);
process.on('SIGINT', shutdown);

app.use(cors());
app.use(express.json());

async function initializeBrowserScraper() {
  if (browserInitInProgress) {
    while (browserInitInProgress) {
      await new Promise(resolve => setTimeout(resolve, 100));
    }
    return;
  }

  browserInitInProgress = true;
  console.log('Starting browser scraper initialization...');
  browserScraper = new WorthpointScraper();
  await browserScraper.initialize();
  const credentials = await getCredentials();
  await browserScraper.login(credentials.username, credentials.password);
  console.log('Browser scraper initialized and logged in');
  browserInitInProgress = false;
}

async function initializeApiScraper() {
  if (apiInitInProgress) {
    while (apiInitInProgress) {
      await new Promise(resolve => setTimeout(resolve, 100));
    }
    return;
  }

  apiInitInProgress = true;
  console.log('Initializing API scraper...');
  apiScraper = new WorthpointApiScraper();
  const credentials = await getCredentials();
  await apiScraper.login(credentials.username, credentials.password);
  console.log('API scraper initialized and logged in');
  apiInitInProgress = false;
}

// API endpoint using browser scraping
app.get('/api/art/browser', async (req, res) => {
  try {
    if (!browserScraper) {
      console.log('Browser scraper not initialized, initializing now...');
      await initializeBrowserScraper();
    }

    console.log('Fetching art data using browser scraping...');
    const searchUrl = 'https://www.worthpoint.com/inventory/search?searchForm=search&ignoreSavedPreferences=true&max=100&sort=SaleDate&_img=false&img=true&_noGreyList=false&noGreyList=true&categories=fine-art&rMin=200&saleDate=ALL_TIME';
    const searchResults = await browserScraper.scrapeSearchResults(searchUrl);
    
    console.log(`Successfully fetched ${searchResults.length} results using browser scraping`);
    res.json({
      total: searchResults.length,
      data: searchResults,
      method: 'browser'
    });
  } catch (error) {
    console.error('Browser scraping error:', error);
    res.status(500).json({ error: 'Failed to fetch art data using browser scraping' });
  }
});

// API endpoint using direct API calls
app.get('/api/art/api', async (req, res) => {
  try {
    if (!apiScraper) {
      console.log('API scraper not initialized, initializing now...');
      await initializeApiScraper();
    }

    console.log('Fetching art data using API...');
    const searchResults = await apiScraper.searchItems();
    
    console.log(`Successfully fetched ${searchResults.length} results using API`);
    res.json({
      total: searchResults.length,
      data: searchResults,
      method: 'api'
    });
  } catch (error) {
    console.error('API scraping error:', error);
    res.status(500).json({ error: 'Failed to fetch art data using API' });
  }
});

// Christie's API endpoint
app.get('/api/christies', async (req, res) => {
  try {
    if (!christiesScraper) {
      console.log('Initializing Christie\'s scraper...');
      christiesScraper = new ChristiesScraper();
    }

    const { month, year, page, pageSize } = req.query;
    console.log('Fetching Christie\'s auction data...');
    
    const searchResults = await christiesScraper.searchAuctions({
      month: parseInt(month) || undefined,
      year: parseInt(year) || undefined,
      page: parseInt(page) || 1,
      pageSize: parseInt(pageSize) || 60
    });
    
    console.log(`Successfully fetched ${searchResults.length} results from Christie's`);
    res.json({
      total: searchResults.length,
      data: searchResults,
      source: 'christies'
    });
  } catch (error) {
    console.error('Christie\'s scraping error:', error);
    res.status(500).json({ error: 'Failed to fetch Christie\'s auction data' });
  }
});

// Christie's lot details endpoint
app.get('/api/christies/lot/:lotId', async (req, res) => {
  try {
    if (!christiesScraper) {
      console.log('Initializing Christie\'s scraper...');
      christiesScraper = new ChristiesScraper();
    }

    const { lotId } = req.params;
    console.log(`Fetching Christie's lot details for ID: ${lotId}`);
    
    const lotDetails = await christiesScraper.getLotDetails(lotId);
    res.json(lotDetails);
  } catch (error) {
    console.error('Christie\'s lot details error:', error);
    res.status(500).json({ error: 'Failed to fetch Christie\'s lot details' });
  }
});

// Invaluable API endpoint
app.get('/api/invaluable', async (req, res) => {
  try {
    if (!invaluableScraper) {
      console.log('Initializing Invaluable scraper...');
      invaluableScraper = new InvaluableScraper();
    }

    const { currency, minPrice, upcoming, query, keyword } = req.query;
    console.log('Fetching Invaluable auction data...');
    
    const searchResults = await invaluableScraper.searchItems({
      currency,
      minPrice,
      upcoming: upcoming === 'true',
      query,
      keyword
    });
    
    console.log(`Successfully fetched ${searchResults.length} results from Invaluable`);
    res.json({
      total: searchResults.length,
      data: searchResults,
      source: 'invaluable'
    });
  } catch (error) {
    console.error('Invaluable scraping error:', error);
    res.status(500).json({ error: 'Failed to fetch Invaluable auction data' });
  }
});

// Start the server
app.listen(port, () => {
  console.log(`Server is now listening on port ${port}`);
  console.log('Environment:', process.env.NODE_ENV);
  console.log('Google Cloud Project:', process.env.GOOGLE_CLOUD_PROJECT);
});