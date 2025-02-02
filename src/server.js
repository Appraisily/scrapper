const express = require('express');
const cors = require('cors');
const InvaluableScraper = require('./scrapers/invaluable');
const storage = require('./utils/storage');

const port = process.env.PORT || 8080;

const requiredEnvVars = ['GOOGLE_CLOUD_PROJECT'];

const missingEnvVars = requiredEnvVars.filter(varName => !process.env[varName]);
if (missingEnvVars.length > 0) {
  console.error('Missing required environment variables:', missingEnvVars.join(', '));
  process.exit(1);
}

const app = express();

// Scraper instance
let invaluableScraper = null;
let initializingInvaluable = false;

// Graceful shutdown handler
async function shutdown() {
  console.log('Shutting down gracefully...');
  if (invaluableScraper) {
    try {
      await invaluableScraper.close();
    } catch (error) {
      console.error('Error closing scraper:', error);
    }
  }
  process.exit(0);
}

// Handle shutdown signals
process.on('SIGTERM', shutdown);
process.on('SIGINT', shutdown);

// Add health check endpoint
app.get('/', (req, res) => {
  res.json({ status: 'ok', message: 'Invaluable Scraper API is running' });
});

// Artist List Endpoint
app.get('/api/invaluable/artists', async (req, res) => {
  try {
    if (!invaluableScraper) {
      await initializeScraper();
    }

    console.log('Fetching Invaluable artist list...');
    
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

    const result = await invaluableScraper.getArtistList(cookies);
    
    // Save to storage
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const filename = `artists/invaluable-artists-aa-${timestamp}.json`;
    
    const url = await storage.saveJsonFile(filename, result);
    
    res.json({
      success: true,
      message: 'Artist list retrieved successfully',
      data: result,
      file: {
        path: filename,
        url
      }
    });
    
  } catch (error) {
    console.error('Error fetching artist list:', error);
    res.status(500).json({ error: 'Failed to fetch artist list' });
  }
});
app.use(cors());
app.use(express.json());

// Initialize scraper
async function initializeScraper() {
  if (initializingInvaluable) {
    while (initializingInvaluable) {
      await new Promise(resolve => setTimeout(resolve, 100));
    }
    return;
  }

  initializingInvaluable = true;
  console.log('Starting Invaluable scraper initialization...');

  try {
    invaluableScraper = new InvaluableScraper();
    await invaluableScraper.initialize();
    console.log('Invaluable scraper initialized successfully');
  } catch (error) {
    console.error('Error initializing Invaluable scraper:', error);
    throw error;
  } finally {
    initializingInvaluable = false;
  }
}

// Invaluable Search
app.get('/api/invaluable', async (req, res) => {
  try {
    if (!invaluableScraper) {
      await initializeScraper();
    }

    const { query = 'fine art', keyword = 'fine art' } = req.query;
    console.log('Fetching Invaluable Fine Art data...');
    
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

    const searchUrl = 'https://www.invaluable.com/search?priceResult[min]=250&dateTimeUTCUnix[min]=1577833200&dateType=Custom&upcoming=false&sort=auctionDateAsc&query=fine%20art&keyword=fine%20art';
    const result = await invaluableScraper.searchWithCookies(cookies);

    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    
    const metadata = {
      source: 'invaluable',
      artists: invaluableScraper.artists,
      timestamp,
      searchParams: {
        priceResult: { min: 250 },
        sort: 'auctionDateAsc'
      },
      cookies: cookies.map(({ name, domain }) => ({ name, domain })), // Exclude cookie values for security
      status: 'pending_processing'
    };

    const savedData = await storage.saveSearchData(result, metadata);
    
    res.json({
      success: true,
      message: 'Search results saved successfully',
      searchId: savedData.searchId,
      files: {
        html: savedData.htmlPath,
        metadata: savedData.metadataPath
      },
      urls: {
        html: savedData.htmlUrl,
        metadata: savedData.metadataUrl
      },
      metadata
    });
  } catch (error) {
    console.error('Invaluable search error:', error);
    res.status(500).json({ error: 'Failed to fetch search results' });
  }
});

// Start the server
const server = app.listen(port, '0.0.0.0', () => {
  console.log(`Server is now listening on port ${port}`);
  console.log('Google Cloud Project:', process.env.GOOGLE_CLOUD_PROJECT);
});

// Add error handler
server.on('error', (error) => {
  console.error('Server error:', error);
  process.exit(1);
});