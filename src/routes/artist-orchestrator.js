const express = require('express');
const router  = express.Router();
const fs      = require('fs').promises;
const path    = require('path');

const ArtistScraperOrchestrator = require('../orchestrators/artist-scraper-orchestrator');

/* --------------------------------------------------------------------------- */
/* Helpers                                                                     */
/* --------------------------------------------------------------------------- */

// Ensure a smaller “subset” JSON exists (handy for testing in Cloud Run)
async function ensureSubsetFile(sourcePath, subsetPath, subsetSize = 10) {
  try {
    await fs.access(subsetPath);           // already there – reuse it
    return subsetPath;
  } catch {
    const fileContent   = await fs.readFile(sourcePath, 'utf8');
    const allArtists    = JSON.parse(fileContent);
    const subsetArtists = allArtists.slice(0, subsetSize);

    await fs.writeFile(subsetPath, JSON.stringify(subsetArtists, null, 2));
    return subsetPath;
  }
}

/* --------------------------------------------------------------------------- */
/* Endpoints                                                                   */
/* --------------------------------------------------------------------------- */

/**
 * GET /api/orchestrator/artists
 *
 * Query params:
 *   startIndex   – first artist index to process   (default 0)
 *   maxArtists   – max number of artists to scrape (default 10)
 *   useSubset    – true/false, use subset file?    (default true)
 *   subsetSize   – how many artists in the subset  (default 10)
 *
 * Fires the orchestrator in the background and replies 202 immediately, so
 * Cloud Scheduler (or the caller) doesn’t time-out.
 */
router.get('/artists', async (req, res) => {
  try {
    const startIndex = parseInt(req.query.startIndex) || 0;
    const maxArtists = parseInt(req.query.maxArtists) || 10;
    const useSubset  = req.query.useSubset !== 'false';      // “true” by default
    const subsetSize = parseInt(req.query.subsetSize) || 10;

    const artistsFilePath = useSubset
      ? await ensureSubsetFile(
          path.resolve('artists.json'),
          path.resolve('artists_subset.json'),
          subsetSize
        )
      : path.resolve('artists.json');

    const orchestratorOptions = { startIndex, maxArtists, artistsFilePath };
    const orchestrator        = new ArtistScraperOrchestrator(orchestratorOptions);

    // Run in background
    orchestrator
      .run()
      .then(r => console.log('Artist Orchestrator finished', r))
      .catch(e => console.error('Artist Orchestrator failed', e));

    res.status(202).json({
      success: true,
      message: 'Artist orchestrator job started',
      options: orchestratorOptions,
    });
  } catch (error) {
    console.error('Error starting artist orchestrator:', error);
    res.status(500).json({
      success: false,
      error : 'Failed to start artist orchestrator',
      message: error.message,
    });
  }
});

/**
 * POST /api/orchestrator/run
 *
 * Body (JSON) – any options accepted by ArtistScraperOrchestrator, e.g.:
 * {
 *   "startIndex": 0,
 *   "maxArtists": 0,
 *   "maxConcurrent": 1,
 *   "delayBetweenArtists": 5000,
 *   "maxRetries": 3,
 *   "saveImages": true
 * }
 *
 * Runs synchronously and returns the final results.
 */
router.post('/run', async (req, res) => {
  try {
    const options       = req.body || {};
    const orchestrator  = new ArtistScraperOrchestrator(options);
    const results       = await orchestrator.run();

    res.json({ success: true, results });
  } catch (error) {
    console.error('Error in artist orchestrator run:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

module.exports = router;