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
    const { section, initialHtml, finalHtml } = result;
    
    // Save to storage
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const jsonFilename = `artists/${section}.json`;
    const initialHtmlFilename = `artists/${section}-${timestamp}-initial.html`;
    const finalHtmlFilename = `artists/${section}-${timestamp}-final.html`;
    
    // Save JSON and both HTML states
    const jsonUrl = await req.app.locals.storage.saveJsonFile(jsonFilename, result);
    const initialHtmlUrl = await req.app.locals.storage.saveJsonFile(initialHtmlFilename, initialHtml);
    const finalHtmlUrl = await req.app.locals.storage.saveJsonFile(finalHtmlFilename, finalHtml);
    
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
          initial: {
            path: initialHtmlFilename,
            url: initialHtmlUrl
          },
          final: {
            path: finalHtmlFilename,
            url: finalHtmlUrl
          }
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