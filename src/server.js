const express = require('express');
const cors = require('cors');
const WorthpointScraper = require('./scraper');
const { getCredentials } = require('./secrets');

const app = express();
const port = 3000;

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

// Initialize scraper instance
let scraper = null;

// Initialize scraper on server start
async function initializeScraper() {
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
      try {
        await initializeScraper();
      } catch (error) {
        console.error('Failed to initialize scraper:', error);
        return res.status(500).json({ error: 'Failed to initialize scraper' });
      }
    }

    const searchUrl = 'https://www.worthpoint.com/inventory/search?searchForm=search&ignoreSavedPreferences=true&max=100&sort=SaleDate&_img=false&img=true&_noGreyList=false&noGreyList=true&categories=fine-art&rMin=200&saleDate=ALL_TIME';
    const searchResults = await scraper.scrapeSearchResults(searchUrl);
    
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
app.listen(port, async () => {
  try {
    await initializeScraper();
    console.log(`Server running on port ${port}`);
  } catch (error) {
    console.error('Failed to initialize scraper:', error);
  }
});