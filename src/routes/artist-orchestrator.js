const express = require('express');
const router = express.Router();
const fs = require('fs').promises;
const path = require('path');
const ArtistScraperOrchestrator = require('../orchestrators/artist-scraper-orchestrator');

// Utility to ensure a subset file exists with the desired number of artists
async function ensureSubsetFile(sourcePath, subsetPath, subsetSize = 10) {
  try {
    // Check if subset file already exists. If it does, skip creation.
    await fs.access(subsetPath);
    return subsetPath; // File exists
  } catch {
    // If subset file does not exist, create it from the main artists file
    const fileContent = await fs.readFile(sourcePath, 'utf8');
    const allArtists = JSON.parse(fileContent);
    const subsetArtists = allArtists.slice(0, subsetSize);
    await fs.writeFile(subsetPath, JSON.stringify(subsetArtists, null, 2));
    return subsetPath;
  }
}

/**
 * GET /api/orchestrator/artists
 *
 * Query parameters:
 *  - startIndex (number)  : Starting index to process (default 0)
 *  - maxArtists (number)  : Maximum number of artists to process (default 10)
 *  - useSubset  (boolean) : Whether to use the subset file (default true)
 *  - subsetSize (number)  : How many artists to include in the subset file (default 10)
 *
 * This endpoint triggers the Artist Scraper Orchestrator. It immediately returns
 * a 202 response indicating that the job has started, while the orchestrator
 * continues to run in the background. All progress and errors are logged to
 * stdout/stderr so they are visible in the Cloud Run logs.
 */
router.get('/artists', async (req, res) => {
  try {
    // Parse query params
    const startIndex = parseInt(req.query.startIndex) || 0;
    const maxArtists = parseInt(req.query.maxArtists) || 10;
    const useSubset = req.query.useSubset !== 'false'; // default true
    const subsetSize = parseInt(req.query.subsetSize) || 10;

    // Determine which artists file to use
    const artistsFilePath = useSubset
      ? await ensureSubsetFile(path.resolve('artists.json'), path.resolve('artists_subset.json'), subsetSize)
      : path.resolve('artists.json');

    const orchestratorOptions = {
      startIndex,
      maxArtists,
      artistsFilePath,
    };

    // Instantiate orchestrator
    const orchestrator = new ArtistScraperOrchestrator(orchestratorOptions);

    // Kick off the job asynchronously so we can respond immediately
    orchestrator
      .run()
      .then((results) => {
        console.log('Artist Orchestrator finished', results);
      })
      .catch((error) => {
        console.error('Artist Orchestrator failed', error);
      });

    // Respond immediately so Cloud Scheduler does not time-out on long jobs
    res.status(202).json({
      success: true,
      message: 'Artist orchestrator job started',
      options: orchestratorOptions,
    });
  } catch (error) {
    console.error('Error starting artist orchestrator:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to start artist orchestrator',
      message: error.message,
    });
  }
});

module.exports = router;