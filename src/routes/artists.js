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
    
    // Save to storage
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const filename = `artists/invaluable-artists-aa-${timestamp}.json`;
    
    const url = await req.app.locals.storage.saveJsonFile(filename, result);
    
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

module.exports = router;