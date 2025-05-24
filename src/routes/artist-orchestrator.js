const express = require('express');
const router = express.Router();

const ArtistScraperOrchestrator = require('../orchestrators/artist-scraper-orchestrator');

/**
 * POST /api/orchestrator/run
 * Body (JSON) optional parameters:
 *   {
 *     startIndex: 0,
 *     maxArtists: 0,
 *     maxConcurrent: 1,
 *     delayBetweenArtists: 5000,
 *     maxRetries: 3,
 *     saveImages: true
 *   }
 */
router.post('/run', async (req, res) => {
  try {
    const options = req.body || {};

    const orchestrator = new ArtistScraperOrchestrator(options);

    const results = await orchestrator.run();

    return res.json({ success: true, results });
  } catch (error) {
    console.error('Error in artist orchestrator run:', error);
    return res.status(500).json({ success: false, error: error.message });
  }
});

module.exports = router;