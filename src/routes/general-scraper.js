/**
 * General Scraper Route
 * 
 * Generic endpoint for scraping any category and query combination from Invaluable
 */
const express = require('express');
const router = express.Router();
const { constructSearchUrl } = require('../scrapers/invaluable/url-builder');
const SearchStorageService = require('../utils/search-storage');

// Initialize the storage service
const searchStorage = new SearchStorageService();

/**
 * Build parameters for a search
 * @param {string} keyword - Keyword for search (serves as folder name)
 * @param {string} query - Query for search (serves as subfolder name)
 * @param {number} page - Page number to fetch
 * @param {object} additionalParams - Additional search parameters
 * @returns {object} - Search parameters
 */
function buildSearchParams(keyword, query, page = 1, additionalParams = {}) {
  const params = {
    query: query || keyword,
    keyword: keyword,
    priceResult: { min: 250 },
    upcoming: 'false',
    ...additionalParams
  };
  
  if (page > 1) {
    params.page = page;
  }
  
  return params;
}

// Endpoint to scrape with dynamic query and keyword 
router.get('/scrape', async (req, res) => {
  try {
    const { invaluableScraper } = req.app.locals;
    if (!invaluableScraper) {
      throw new Error('Scraper not initialized');
    }
    
    // Get parameters from request
    const keyword = req.query.keyword || 'collectible';  // Default keyword
    const query = req.query.query || keyword;  // Default to keyword if not provided
    
    console.log(`Starting scrape with keyword: ${keyword}, query: ${query}`);
    
    // Check if folder already exists in GCS
    const folderExists = await searchStorage.folderExists(keyword, query);
    if (folderExists) {
      console.log(`Folder already exists for keyword="${keyword}", query="${query}". Skipping scrape.`);
      return res.json({
        success: true,
        message: `Scrape skipped for "${query}" - data already exists`,
        resultSummary: {
          folderExists: true,
          skipped: true
        }
      });
    }
    
    console.log(`Folder doesn't exist for keyword="${keyword}", query="${query}". Starting scrape...`);
    
    // Parse request parameters
    const startPage = parseInt(req.query.startPage) || 1;
    let maxPages = parseInt(req.query.maxPages) || 0; // Default to 0, will be determined from API response
    const fetchAllPages = req.query.fetchAllPages !== 'false'; // Default to true
    
    // Get cookies from request if provided
    const cookies = req.query.cookies ? 
      JSON.parse(req.query.cookies) : 
      [
        {
          name: 'AZTOKEN-PROD',
          value: req.query.aztoken || '60E0351A-C64E-4D9F-AA6C-5967BBBF859B',
          domain: '.invaluable.com'
        },
        {
          name: 'cf_clearance',
          value: req.query.cf_clearance || 'Yq4QHU.y14z93vU3CmLCK80CU7Pq6pgupmW0eM8k548-1738320515-1.2.1.1-ZFXBFgIPHghfvwwfhRbZx27.6zPihqfQ4vGP0VY1v66mKc.wwAOVRiRJhK6ouVt_.wMB30bkeY0r9NK.KUTU4gu7GzZxbyh0EH_gE36kcnHDvGATrI_vFs9y1XHq3PgtlHmBUflqgjcS6x9MC5YpXoeELPYiT0k59IPMn..1cHED7zV6T78hILKinjM6hZ.ZeQwetIN6SPmuvXb7V2z2ddJa64Vg_zUi.euce0SjjJr5ti7tHWoFsTV1DO1MkFwDfUpy1yTCdESho.EwyRgfdfRAlx6njkTmlWNkp1aXcXU',
          domain: '.invaluable.com'
        }
      ];
    
    // Build search parameters
    const searchParams = buildSearchParams(keyword, query, startPage);
    
    // If maxPages is not specified, first make a single page request to get the total pages
    if (maxPages <= 0 && fetchAllPages) {
      console.log(`No maxPages specified. Making initial request to determine total pages...`);
      
      // Make a single page request to get metadata
      const initialResult = await invaluableScraper.search(searchParams, cookies);
      
      // Extract total pages from the metadata
      let totalHits = 0;
      let totalPages = 0;
      let foundMetadata = false;

      console.log('Checking for pagination metadata in API response');
      
      // First check if nbPages exists directly at the root level
      if (initialResult && typeof initialResult === 'object') {
        // Direct root level properties
        if ('nbPages' in initialResult) {
          console.log('Found nbPages directly at root level');
          totalPages = initialResult.nbPages;
          totalHits = initialResult.nbHits || 0;
          foundMetadata = true;
        }
        // Check for metadata in different possible locations if not found at root
        else if (initialResult.results?.[0]?.meta?.totalHits) {
          // Standard format
          console.log('Found metadata in standard format: results[0].meta');
          totalHits = initialResult.results[0].meta.totalHits;
          const hitsPerPage = initialResult.results[0].meta.hitsPerPage || 96;
          totalPages = Math.ceil(totalHits / hitsPerPage);
          foundMetadata = true;
        } else if (initialResult.results?.[0]?.nbHits) {
          // Another alternate format
          console.log('Found metadata in alternate format: results[0] direct properties');
          totalHits = initialResult.results[0].nbHits;
          totalPages = initialResult.results[0].nbPages || Math.ceil(totalHits / 96);
          foundMetadata = true;
        }
      }
      
      if (!foundMetadata) {
        // Log the entire structure for debugging
        console.error('Failed to find pagination metadata. Response structure:', 
          JSON.stringify(initialResult, null, 2).substring(0, 1000));
        
        return res.status(404).json({
          success: false,
          error: 'Failed to get pagination metadata',
          message: 'Could not determine total pages from API response. Response keys available: ' + 
            Object.keys(initialResult || {}).join(', ')
        });
      }
      
      if (totalPages <= 0) {
        return res.status(404).json({
          success: false,
          error: 'Failed to get pagination metadata',
          message: 'Could not determine total pages from API response. Response structure: ' + 
            JSON.stringify(initialResult, null, 2).substring(0, 500) + '...'
        });
      }
      
      maxPages = totalPages;
      
      console.log(`API reports ${totalHits} total items across ${maxPages} pages for query "${query}"`);
      
      // If we already retrieved page 1, we can use it as the first page result
      if (startPage === 1) {
        // Save the first page results - the scraper will skip it if it exists
        try {
          // Use the new folder structure: keyword/query/
          await searchStorage.savePageResults(keyword, 1, initialResult, query);
          console.log(`Saved initial page results for keyword="${keyword}", query="${query}"`);
        } catch (error) {
          console.warn(`Warning: Could not save initial page results: ${error.message}`);
        }
      }
    } else if (maxPages <= 0) {
      // If fetchAllPages is false but no maxPages specified, default to 1
      maxPages = 1;
    }
    
    console.log(`Parameters: startPage=${startPage}, maxPages=${maxPages}, fetchAllPages=${fetchAllPages}`);
    
    // Start the search
    const result = fetchAllPages
      ? await invaluableScraper.searchAllPages(searchParams, cookies, maxPages)
      : await invaluableScraper.search(searchParams, cookies);
    
    if (!result) {
      return res.status(404).json({
        success: false,
        error: 'No search results found',
        message: 'The search did not return any results. Try different parameters or check that the cookies are valid.'
      });
    }
    
    res.json({
      success: true,
      message: `Search for "${query}" with keyword "${keyword}" completed`,
      resultSummary: {
        totalHits: result.results?.[0]?.meta?.totalHits || 0,
        totalPages: maxPages,
        resultsCount: result.results?.[0]?.hits?.length || 0,
        pagesProcessed: result.pagesRetrieved || 1,
        skippedPages: result.skippedExistingPages || 0
      }
    });
  } catch (error) {
    console.error('Error in general scraper:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to scrape',
      message: error.message
    });
  }
});

module.exports = router; 