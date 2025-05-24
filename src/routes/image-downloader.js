const express = require('express');
const router = express.Router();

const SearchStorageService = require('../utils/search-storage');
const { InvaluableScraper } = require('../scrapers/invaluable');
const { formatCookies } = require('../scrapers/invaluable/utils');

/**
 * POST /download
 * Body params:
 * {
 *   imageUrls: ["https://image.invaluable.com/..."], // required
 *   bucket: "artist-profile-images",               // optional custom bucket
 *   category: "artists",                           // optional category folder inside the bucket
 *   subcategory: "",                               // optional sub category folder
 *   cookies: [...],                                 // optional cookies array (or stringified)
 *   aztoken: "...",                                // optional single cookie value
 *   cf_clearance: "...",                           // optional single cookie value
 *   maxConcurrency: 4                               // optional number of parallel downloads
 * }
 */
router.post('/download', async (req, res) => {
  try {
    const {
      imageUrls,
      bucket,
      category = 'artists',
      subcategory = null,
      cookies: rawCookies = [],
      aztoken,
      cf_clearance,
      maxConcurrency = 4
    } = req.body || {};

    if (!Array.isArray(imageUrls) || imageUrls.length === 0) {
      return res.status(400).json({
        success: false,
        error: 'imageUrls must be a non-empty array'
      });
    }

    // Prepare cookies for invaluable domain (optional)
    const cookies = formatCookies(rawCookies, { aztoken, cf_clearance });

    // Obtain a browser instance – reuse the one from the global scraper if available
    let browserManager;
    let scraperCreatedLocally = false;
    const globalScraper = req.app.locals.invaluableScraper;

    if (globalScraper && globalScraper.browser) {
      browserManager = globalScraper.browser;
    } else {
      const tempScraper = new InvaluableScraper({ keyword: category });
      await tempScraper.initialize();
      browserManager = tempScraper.browser;
      scraperCreatedLocally = true;
    }

    // If the caller provided cookies, set them once in a fresh page so they are stored in the profile
    if (cookies && cookies.length > 0) {
      try {
        const page = await browserManager.createTab('cookie-setter');
        await page.setCookie(...cookies);
        // Navigate quickly to invaluable to ensure cookies are registered
        await page.goto('https://www.invaluable.com', { waitUntil: 'domcontentloaded' });
        await page.close();
        // Remove reference from manager pages map if present
        if (typeof browserManager.pages !== 'undefined') {
          browserManager.pages.delete('cookie-setter');
        }
      } catch (cookieErr) {
        console.warn('Warning: could not set cookies in browser:', cookieErr.message);
      }
    }

    // Build SearchStorageService instance
    const storageOptions = { keyword: category };
    if (bucket) storageOptions.bucketName = bucket;
    const storage = SearchStorageService.getInstance(storageOptions);

    // Get underlying puppeteer browser instance once
    const puppBrowser = browserManager.getBrowser ? await browserManager.getBrowser() : null;

    // Worker queue for controlled concurrency
    const tasks = imageUrls.map((url, idx) => ({ url, idx }));
    const results = new Array(imageUrls.length).fill(null);
    let successCount = 0;
    let failureCount = 0;

    async function worker() {
      while (tasks.length > 0) {
        const task = tasks.shift();
        if (!task) break;
        const lotNumber = `item_${task.idx + 1}`;
        try {
          const gcsPath = await storage.saveImage(
            task.url,
            category,
            lotNumber,
            subcategory,
            puppBrowser
          );
          results[task.idx] = { url: task.url, gcsPath };
          if (gcsPath && !gcsPath.startsWith('skipped:') && gcsPath !== null) {
            successCount++;
          } else if (gcsPath === null) {
            failureCount++;
          }
        } catch (err) {
          results[task.idx] = { url: task.url, error: err.message };
          failureCount++;
        }
      }
    }

    const workers = [];
    const concurrency = Math.max(1, Math.min(maxConcurrency, 16));
    for (let i = 0; i < concurrency; i++) {
      workers.push(worker());
    }

    await Promise.all(workers);

    // Close resources if we created them locally
    try {
      await storage.closeBrowser();
    } catch (e) { /* ignore */ }

    if (scraperCreatedLocally && browserManager) {
      try { await browserManager.close(); } catch (e) { /* ignore */ }
    }

    return res.json({
      success: true,
      totalRequested: imageUrls.length,
      successCount,
      failureCount,
      bucket: bucket || process.env.STORAGE_BUCKET || 'invaluable-html-archive-images',
      results
    });
  } catch (error) {
    console.error('Error in /api/images/download:', error);
    res.status(500).json({ success: false, error: 'Internal server error', message: error.message });
  }
});

module.exports = router;