const express = require('express');
const cors = require('cors');
const InvaluableScraper = require('./scrapers/invaluable');
const ChristiesScraper = require('./scrapers/christies');
const { WorthpointScraper } = require('./scrapers/worthpoint');
const { WorthpointApiScraper } = require('./scrapers/worthpoint/api');
const { getCredentials } = require('./utils/secrets');
const storage = require('./utils/storage');

// Configure port from environment variable with fallback
const port = process.env.PORT || 3000;
console.log(`Starting server with port: ${port}`);

const app = express();

// Scraper instances
const scrapers = {
  browser: null,
  api: null,
  christies: null,
  invaluable: null
};

// Initialization flags
const initFlags = {
  browser: false,
  api: false
};

// Graceful shutdown handler
async function shutdown() {
  console.log('Shutting down gracefully...');
  
  // Close all scraper instances
  for (const scraper of Object.values(scrapers)) {
    if (scraper) {
      try {
        await scraper.close();
      } catch (error) {
        console.error('Error closing scraper:', error);
      }
    }
  }
  
  process.exit(0);
}

// Handle shutdown signals
process.on('SIGTERM', shutdown);
process.on('SIGINT', shutdown);

app.use(cors());
app.use(express.json());

// Initialize scrapers
async function initializeScraper(type) {
  if (initFlags[type]) {
    while (initFlags[type]) {
      await new Promise(resolve => setTimeout(resolve, 100));
    }
    return;
  }

  initFlags[type] = true;
  console.log(`Starting ${type} scraper initialization...`);

  try {
    const credentials = await getCredentials();

    switch (type) {
      case 'browser':
        scrapers.browser = new WorthpointScraper();
        await scrapers.browser.initialize();
        await scrapers.browser.login(credentials.username, credentials.password);
        break;

      case 'api':
        scrapers.api = new WorthpointApiScraper();
        await scrapers.api.login(credentials.username, credentials.password);
        break;

      case 'christies':
        scrapers.christies = new ChristiesScraper();
        await scrapers.christies.initialize();
        break;

      case 'invaluable':
        scrapers.invaluable = new InvaluableScraper();
        await scrapers.invaluable.initialize();
        break;
    }

    console.log(`${type} scraper initialized successfully`);
  } catch (error) {
    console.error(`Error initializing ${type} scraper:`, error);
    throw error;
  } finally {
    initFlags[type] = false;
  }
}

// API Routes

// Worthpoint Browser Scraping
app.get('/api/art/browser', async (req, res) => {
  try {
    if (!scrapers.browser) {
      await initializeScraper('browser');
    }

    console.log('Fetching art data using browser scraping...');
    const searchUrl = 'https://www.worthpoint.com/inventory/search?searchForm=search&ignoreSavedPreferences=true&max=100&sort=SaleDate&_img=false&img=true&_noGreyList=false&noGreyList=true&categories=fine-art&rMin=200&saleDate=ALL_TIME';
    const searchResults = await scrapers.browser.scrapeSearchResults(searchUrl);
    
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

// Worthpoint API
app.get('/api/art/api', async (req, res) => {
  try {
    if (!scrapers.api) {
      await initializeScraper('api');
    }

    console.log('Fetching art data using API...');
    const searchResults = await scrapers.api.searchItems();
    
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

// Christie's Auctions
app.get('/api/christies', async (req, res) => {
  try {
    if (!scrapers.christies) {
      await initializeScraper('christies');
    }

    const { month, year, page, pageSize } = req.query;
    console.log('Fetching Christie\'s auction data...');
    
    const searchResults = await scrapers.christies.searchAuctions({
      month: parseInt(month) || undefined,
      year: parseInt(year) || undefined,
      page: parseInt(page) || 1,
      pageSize: parseInt(pageSize) || 60
    });
    
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

// Christie's Lot Details
app.get('/api/christies/lot/:lotId', async (req, res) => {
  try {
    if (!scrapers.christies) {
      await initializeScraper('christies');
    }

    const { lotId } = req.params;
    console.log(`Fetching Christie's lot details for ID: ${lotId}`);
    
    const lotDetails = await scrapers.christies.getLotDetails(lotId);
    res.json(lotDetails);
  } catch (error) {
    console.error('Christie\'s lot details error:', error);
    res.status(500).json({ error: 'Failed to fetch Christie\'s lot details' });
  }
});

// Invaluable Search
app.get('/api/invaluable', async (req, res) => {
  try {
    if (!scrapers.invaluable) {
      await initializeScraper('invaluable');
    }

    const { currency, minPrice, upcoming, query, keyword } = req.query;
    console.log('Fetching Invaluable auction data...');
    
    const searchResults = await scrapers.invaluable.searchItems({
      currency,
      minPrice,
      upcoming: upcoming === 'true',
      query,
      keyword
    });
    
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

// Invaluable Search with Cookies
app.get('/api/invaluable/search-picasso', async (req, res) => {
  try {
    if (!scrapers.invaluable) {
      await initializeScraper('invaluable');
    }

    console.log('Injecting cookies and fetching Picasso search results...');
    
    // Essential auth cookies
    const cookies = [
      {
        name: 'AZTOKEN-PROD',
        value: '4F562873-F229-4346-A846-37E9A451FA9E',
        domain: '.invaluable.com'
      },
      {
        name: 'oas-node-sid',
        value: 's%3A5bWesidbuezM2pxrG0NCTb8RxAkufVPn.2ej%2FP3yUMcct%2FCvjVg%2B8wO2qglFnlyBP5pNhauF1tJI',
        domain: 'www.invaluable.com'
      },
      {
        name: 'cf_clearance',
        value: 'Yq4QHU.y14z93vU3CmLCK80CU7Pq6pgupmW0eM8k548-1738320515-1.2.1.1-ZFXBFgIPHghfvwwfhRbZx27.6zPihqfQ4vGP0VY1v66mKc.wwAOVRiRJhK6ouVt_.wMB30bkeY0r9NK.KUTU4gu7GzZxbyh0EH_gE36kcnHDvGATrI_vFs9y1XHq3PgtlHmBUflqgjcS6x9MC5YpXoeELPYiT0k59IPMn..1cHED7zV6T78hILKinjM6hZ.ZeQwetIN6SPmuvXb7V2z2ddJa64Vg_zUi.euce0SjjJr5ti7tHWoFsTV1DO1MkFwDfUpy1yTCdESho.EwyRgfdfRAlx6njkTmlWNkp1aXcXU',
        domain: '.invaluable.com'
      },
      {
        name: 'AWSALB',
        value: 'xkqLPvsd3G6EmNbyhfowJyRrVvHz9ibRJuaJXnMGBgt5XW9JNg/5gxH94w/TIMDySIidhjVPgsZmHeZjLwAOJzoZdJ9EhRkrccyJRbkWByT5kcXShAI0s6YhJk5qA39buwUX05awBerUkQgAM35IMxL3vERiGeb3uK7wwxEt/BEq8bz2mWQLs0KV1Jn9HhQtO+2TfEXQ/xggAFG+sGsB0veobtUMvzJVt+iWWE2y9F/pt8fXsW2NK6pdvewQtdA=',
        domain: 'www.invaluable.com'
      }
    ];

    const html = await scrapers.invaluable.searchWithCookies(
      'https://www.invaluable.com/search?upcoming=false&query=picasso&keyword=picasso',
      cookies
    );

    // Save HTML to Cloud Storage
    const url = await storage.saveHtml(html, 'invaluable-picasso-search');
    
    res.json({
      success: true,
      message: 'Search results saved successfully',
      url: url
    });
  } catch (error) {
    console.error('Invaluable Picasso search error:', error);
    res.status(500).json({ error: 'Failed to fetch Picasso search results' });
  }
});

// Start the server
app.listen(port, () => {
  console.log(`Server is now listening on port ${port}`);
  console.log('Environment:', process.env.NODE_ENV);
  console.log('Google Cloud Project:', process.env.GOOGLE_CLOUD_PROJECT);
});