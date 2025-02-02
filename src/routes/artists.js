const express = require('express');
const router = express.Router();

router.get('/', async (req, res) => {
  try {
    const { invaluableScraper } = req.app.locals;
    if (!invaluableScraper) {
      throw new Error('Scraper not initialized');
    }

    console.log('Fetching Invaluable artist list...');

    const result = await invaluableScraper.getArtistList();
    const { section, html } = result;
    
    // Save to storage
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const jsonFilename = `artists/${section}.json`;
    const htmlFilename = `artists/${section}-${timestamp}.html`;
    
    // Save both JSON and HTML
    const jsonUrl = await req.app.locals.storage.saveJsonFile(jsonFilename, result);
    const htmlUrl = await req.app.locals.storage.saveJsonFile(htmlFilename, html);
    
    res.json({
      success: true,
      message: `Artist list for section ${section} retrieved successfully`,
      data: result,
      files: {
        json: {
          path: jsonFilename,
          url: jsonUrl
        },
        html: {
          path: htmlFilename,
          url: htmlUrl
        }
      },
      section
    });
    
  } catch (error) {
    console.error('Error fetching artist list:', error);
    res.status(500).json({ error: 'Failed to fetch artist list' });
  }
});

module.exports = router;