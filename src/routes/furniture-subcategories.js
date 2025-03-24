/**
 * Furniture Subcategories Route
 * 
 * Exposes endpoints to handle furniture subcategory scraping
 */
const express = require('express');
const router = express.Router();
const { encodeFurnitureSubcategory } = require('../scrapers/invaluable/url-builder');
const SearchStorageService = require('../utils/search-storage');

// Initialize the storage service
const searchStorage = new SearchStorageService();

// Known furniture subcategories with their item counts
const FURNITURE_SUBCATEGORIES = [
  { name: "Tables, Stands & Consoles", count: 34851 },
  { name: "Chairs", count: 23196 },
  { name: "Cabinets & Storage", count: 19307 },
  { name: "Desks, Secretaries & Bureaus", count: 17240 },
  { name: "Sofas & Settees", count: 7644 },
  { name: "Stools & Benches", count: 7398 },
  { name: "Candelabra, Incense Burners & Lamps", count: 5887 },
  { name: "Mirrors & Looking Glasses", count: 5859 },
  { name: "Beds & Bedroom Sets", count: 5421 },
  { name: "Carts, Bar & Tea trolleys", count: 3851 },
  { name: "Bookcases & Display Cases", count: 3680 },
  { name: "Buffets & Sideboards", count: 2726 },
  { name: "Dry Bars & Wine Storage", count: 1924 },
  { name: "Vanities & Accessories", count: 1752 },
  { name: "Coat & Umbrella Stands", count: 1023 },
  { name: "Other Furniture", count: 1020 },
  { name: "Unknown", count: 928 },
  { name: "Credenzas", count: 818 },
  { name: "Entertainment Centers", count: 806 },
  { name: "Fireplace Tools & Screens", count: 634 },
  { name: "Garment Racks & Clothes Valets", count: 618 },
  { name: "Beds", count: 470 },
  { name: "Wardrobes", count: 413 }
];

/**
 * Maps a subcategory name to its encoded value for use in URLs
 * @param {string} subcategoryName - Name of the subcategory
 * @returns {string} - Encoded subcategory value for URL
 */
function getEncodedSubcategory(subcategoryName) {
  if (!subcategoryName) return null;
  return encodeFurnitureSubcategory(subcategoryName);
}

/**
 * Build parameters for a furniture subcategory search
 * @param {string} subcategoryName - Name of the subcategory
 * @param {number} page - Page number to fetch
 * @param {object} additionalParams - Additional search parameters
 * @returns {object} - Search parameters
 */
function buildSubcategoryParams(subcategoryName, page = 1, additionalParams = {}) {
  const params = {
    query: 'furniture',
    keyword: 'furniture',
    priceResult: { min: 250 },
    upcoming: 'false',
    furnitureSubcategory: getEncodedSubcategory(subcategoryName),
    ...additionalParams
  };
  
  if (page > 1) {
    params.page = page;
  }
  
  return params;
}

/**
 * Get subcategory info by name
 * @param {string} subcategoryName - Name of the subcategory
 * @returns {object|null} - Subcategory info or null if not found
 */
function getSubcategoryInfo(subcategoryName) {
  if (!subcategoryName) return null;
  
  // Case-insensitive search
  const normalized = subcategoryName.toLowerCase().trim();
  return FURNITURE_SUBCATEGORIES.find(
    cat => cat.name.toLowerCase() === normalized
  );
}

// Endpoint to list all furniture subcategories
router.get('/list', (req, res) => {
  res.json({
    success: true,
    subcategories: FURNITURE_SUBCATEGORIES
  });
});

// Endpoint to get info about a specific subcategory 
router.get('/info/:subcategory', async (req, res) => {
  const subcategoryName = req.params.subcategory;
  const subcategoryInfo = getSubcategoryInfo(subcategoryName);
  
  if (!subcategoryInfo) {
    return res.status(404).json({
      success: false,
      error: 'Subcategory not found',
      message: `Subcategory "${subcategoryName}" is not in the list of known furniture subcategories`
    });
  }
  
  try {
    // Get existing pages for this subcategory
    const existingPages = await searchStorage.listExistingPages('furniture', subcategoryName);
    
    res.json({
      success: true,
      subcategory: subcategoryInfo,
      existingPages: {
        count: existingPages.length,
        pages: existingPages
      },
      encodedValue: getEncodedSubcategory(subcategoryName)
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: 'Failed to get subcategory info',
      message: error.message
    });
  }
});

// Endpoint to scrape a specific subcategory
router.get('/scrape/:subcategory', async (req, res) => {
  try {
    const { invaluableScraper } = req.app.locals;
    if (!invaluableScraper) {
      throw new Error('Scraper not initialized');
    }
    
    const subcategoryName = req.params.subcategory;
    const subcategoryInfo = getSubcategoryInfo(subcategoryName);
    
    if (!subcategoryInfo) {
      return res.status(404).json({
        success: false,
        error: 'Subcategory not found',
        message: `Subcategory "${subcategoryName}" is not in the list of known furniture subcategories`
      });
    }
    
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
    
    // Build search parameters for the subcategory
    const searchParams = buildSubcategoryParams(subcategoryName, startPage);
    
    console.log(`Starting scrape for furniture subcategory: ${subcategoryName}`);
    
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
      
      console.log(`API reports ${totalHits} total items across ${maxPages} pages for subcategory "${subcategoryName}"`);
      
      // If we already retrieved page 1, we can use it as the first page result
      if (startPage === 1) {
        // Save the first page results - the scraper will skip it if it exists
        try {
          await searchStorage.savePageResults('furniture', 1, initialResult, subcategoryName);
          console.log(`Saved initial page results for subcategory "${subcategoryName}"`);
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
      message: `Subcategory "${subcategoryName}" scraping completed`,
      resultSummary: {
        totalHits: result.results?.[0]?.meta?.totalHits || 0,
        totalPages: maxPages,
        resultsCount: result.results?.[0]?.hits?.length || 0,
        pagesProcessed: result.pagesRetrieved || 1,
        skippedPages: result.skippedExistingPages || 0
      }
    });
  } catch (error) {
    console.error('Error scraping subcategory:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to scrape subcategory',
      message: error.message
    });
  }
});

module.exports = router; 