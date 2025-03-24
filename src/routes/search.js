const express = require('express');
const router = express.Router();
const SearchStorageService = require('../utils/search-storage');

// Initialize SearchStorageService
const searchStorage = new SearchStorageService();

function formatPrice(hit) {
  return {
    amount: hit.priceResult,
    currency: hit.currencyCode,
    symbol: hit.currencySymbol
  };
}

function formatSearchResults(catResults) {
  if (!catResults) {
    return { lots: [], totalResults: 0, pagination: { totalItems: 0, totalPages: 0 } };
  }

  // Direct root level properties check first - this seems to be the most common format
  if ('nbPages' in catResults && Array.isArray(catResults.hits)) {
    console.log('Formatting search results from root level properties');
    const lots = catResults.hits.map(hit => ({
      title: hit.lotTitle,
      date: hit.dateTimeLocal,
      auctionHouse: hit.houseName,
      price: formatPrice(hit),
      image: hit.photoPath,
      lotNumber: hit.lotNumber,
      saleType: hit.saleType
    }));
    
    // Extract metadata
    let totalItems = catResults.nbHits || 0;
    let totalPages = catResults.nbPages || 0;
    let itemsPerPage = catResults.hitsPerPage || 96;
    
    return {
      lots,
      totalResults: lots.length,
      pagination: {
        totalItems,
        totalPages,
        itemsPerPage,
        currentPage: catResults.page || 0
      }
    };
  }
  
  // Standard nested format
  if (catResults?.results?.[0]?.hits) {
    console.log('Formatting search results from standard nested format');
    const hits = catResults.results[0].hits;
    const lots = hits.map(hit => ({
      title: hit.lotTitle,
      date: hit.dateTimeLocal,
      auctionHouse: hit.houseName,
      price: formatPrice(hit),
      image: hit.photoPath,
      lotNumber: hit.lotNumber,
      saleType: hit.saleType
    }));

    // Extract pagination metadata
    let totalItems = 0;
    let totalPages = 0;
    let itemsPerPage = 96; // Default value used by Invaluable

    // Check for metadata in different possible locations
    if (catResults.results?.[0]?.meta?.totalHits) {
      // Standard metadata location
      totalItems = catResults.results[0].meta.totalHits;
      itemsPerPage = catResults.results[0].meta.hitsPerPage || itemsPerPage;
    } else if (catResults.nbHits) {
      // Algolia direct response format
      totalItems = catResults.nbHits;
      itemsPerPage = catResults.hitsPerPage || itemsPerPage;
      // If nbPages is available, use it directly
      if (catResults.nbPages) {
        totalPages = catResults.nbPages;
      }
    } else if (catResults.results?.[0]?.nbHits) {
      // Alternative Algolia format
      totalItems = catResults.results[0].nbHits;
      itemsPerPage = catResults.results[0].hitsPerPage || itemsPerPage;
      // If nbPages is available, use it directly
      if (catResults.results[0].nbPages) {
        totalPages = catResults.results[0].nbPages;
      }
    }

    // Calculate total pages if not directly available
    if (totalPages === 0 && totalItems > 0) {
      totalPages = Math.ceil(totalItems / itemsPerPage);
    }

    return {
      lots,
      totalResults: lots.length,
      pagination: {
        totalItems,
        totalPages,
        itemsPerPage,
        currentPage: catResults.results?.[0]?.meta?.page || catResults.results?.[0]?.page || catResults.page || 0
      }
    };
  }
  
  // Try other Algolia format where hits may be at the root level
  if (Array.isArray(catResults.hits)) {
    console.log('Formatting search results from alternate root hits format');
    const lots = catResults.hits.map(hit => ({
      title: hit.lotTitle,
      date: hit.dateTimeLocal,
      auctionHouse: hit.houseName,
      price: formatPrice(hit),
      image: hit.photoPath,
      lotNumber: hit.lotNumber,
      saleType: hit.saleType
    }));
    
    // Extract metadata
    let totalItems = catResults.nbHits || 0;
    let totalPages = catResults.nbPages || 0;
    let itemsPerPage = catResults.hitsPerPage || 96;
    
    return {
      lots,
      totalResults: lots.length,
      pagination: {
        totalItems,
        totalPages,
        itemsPerPage,
        currentPage: catResults.page || 0
      }
    };
  }
  
  console.warn('No recognized format found in search results. Available keys:', Object.keys(catResults).join(', '));
  // No recognized format
  return { lots: [], totalResults: 0, pagination: { totalItems: 0, totalPages: 0 } };
}

function standardizeResponse(data, parameters = {}) {
  return {
    success: true,
    timestamp: new Date().toISOString(),
    parameters: {
      ...parameters,
      // Convert price parameters to nested object if they exist
      ...(parameters['priceResult[min]'] || parameters['priceResult[max]']) && {
        priceResult: {
          min: parameters['priceResult[min]'],
          max: parameters['priceResult[max]']
        }
      }
    },
    // Include pagination metadata in the response
    pagination: data.pagination || {
      totalItems: 0,
      totalPages: 0,
      itemsPerPage: 0,
      currentPage: 1
    },
    data: {
      lots: data.lots || [],
      totalResults: data.totalResults || 0
    }
  };
}

// Search endpoint
router.get('/', async (req, res) => {
  try {
    const { invaluableScraper } = req.app.locals;
    if (!invaluableScraper) {
      throw new Error('Scraper not initialized');
    }

    // Check for direct API data in request
    if (req.query.directApiData) {
      try {
        console.log('Using direct API data provided in request');
        const apiData = JSON.parse(req.query.directApiData);
        const formattedResults = formatSearchResults(apiData);
        return res.json(standardizeResponse(formattedResults, req.query));
      } catch (error) {
        console.error('Error parsing direct API data:', error);
        // Continue with normal scraping if direct data parsing fails
      }
    }

    // Use cookies from request if provided
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

    // Create clean query params object by removing our special parameters
    const searchParams = {...req.query};
    delete searchParams.directApiData;
    delete searchParams.cookies;
    delete searchParams.aztoken;
    delete searchParams.cf_clearance;
    
    // Check if we should fetch all pages
    const fetchAllPages = req.query.fetchAllPages === 'true';
    delete searchParams.fetchAllPages;
    
    // Get max pages to fetch if specified
    const maxPages = parseInt(req.query.maxPages) || 0; // Default to 0, will be determined from API response
    delete searchParams.maxPages;
    
    // Check if we should save to GCS
    const saveToGcs = req.query.saveToGcs === 'true';
    delete searchParams.saveToGcs;
    
    // Get category/search term for storage
    const category = searchParams.query || 'uncategorized';

    console.log('Starting search with parameters:', searchParams);
    
    let result;
    let finalMaxPages = maxPages;
    
    if (fetchAllPages) {
        if (maxPages <= 0) {
            // If no maxPages specified, first make a single page request to get the total pages
            console.log('No maxPages specified. Making initial request to determine total pages...');
            
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
                else if (initialResult?.results?.[0]?.meta?.totalHits) {
                    // Standard format
                    console.log('Found metadata in standard format: results[0].meta');
                    totalHits = initialResult.results[0].meta.totalHits;
                    const hitsPerPage = initialResult.results[0].meta.hitsPerPage || 96;
                    totalPages = Math.ceil(totalHits / hitsPerPage);
                    foundMetadata = true;
                } else if (initialResult?.results?.[0]?.nbHits) {
                    // Another alternate format
                    console.log('Found metadata in alternate format: results[0] direct properties');
                    totalHits = initialResult.results[0].nbHits;
                    totalPages = initialResult.results[0].nbPages || Math.ceil(totalHits / 96);
                    foundMetadata = true;
                }
            }
            
            if (foundMetadata) {
                finalMaxPages = totalPages;
                console.log(`API reports ${totalHits} total items across ${finalMaxPages} pages`);
                
                // If we don't need to paginate further, use the initial result
                if (finalMaxPages <= 1) {
                    result = initialResult;
                    console.log('Only one page of results available, no need for pagination');
                } else {
                    // Save the first page results if saveToGcs is enabled
                    if (saveToGcs) {
                        try {
                            const formattedResults = formatSearchResults(initialResult);
                            const standardizedResponse = standardizeResponse(formattedResults, {
                                ...searchParams,
                                fetchAllPages: 'true',
                                maxPages: finalMaxPages,
                                saveToGcs: 'true'
                            });
                            
                            await searchStorage.savePageResults(category, 1, standardizedResponse);
                            console.log(`Saved initial page results to GCS for category "${category}"`);
                        } catch (error) {
                            console.warn(`Warning: Could not save initial page results: ${error.message}`);
                        }
                    }
                    
                    // Proceed with fetching all pages
                    console.log(`Fetching all pages (up to ${finalMaxPages})`);
                    result = await invaluableScraper.searchAllPages(searchParams, cookies, finalMaxPages);
                }
            } else {
                console.warn('Could not determine total pages from API response, using default');
                finalMaxPages = 10; // Default if metadata not available
                console.log(`Fetching all pages (up to ${finalMaxPages})`);
                result = await invaluableScraper.searchAllPages(searchParams, cookies, finalMaxPages);
                
                console.error('Failed to find pagination metadata. Response keys available:', 
                    Object.keys(initialResult || {}).join(', '));
                console.debug('API response structure: ' + 
                    JSON.stringify(initialResult, null, 2).substring(0, 500) + '...');
            }
        } else {
            // Use user-specified maxPages
            finalMaxPages = maxPages;
            console.log(`Fetching all pages (up to ${finalMaxPages})`);
            result = await invaluableScraper.searchAllPages(searchParams, cookies, finalMaxPages);
        }
    } else {
        // Just fetch a single page
        result = await invaluableScraper.search(searchParams, cookies);
    }
    
    if (!result) {
        return res.status(404).json({
            success: false,
            error: 'No search results found',
            message: 'The search did not return any results. Try different parameters or check that the cookies are valid.'
        });
    }
    
    const formattedResults = formatSearchResults(result);
    
    // Log pagination information
    if (formattedResults.pagination) {
      console.log(`Search found ${formattedResults.pagination.totalItems} total items across ${formattedResults.pagination.totalPages} pages`);
    }
    
    // Create the standardized response
    const standardizedResponse = standardizeResponse(formattedResults, {
      ...searchParams,
      fetchAllPages: fetchAllPages ? 'true' : 'false',
      maxPages: finalMaxPages,
      saveToGcs: saveToGcs ? 'true' : 'false'
    });
    
    // Add additional information about scraping process if available
    if (result.pagesRetrieved || result.skippedExistingPages) {
      standardizedResponse.scrapingSummary = {
        pagesProcessed: result.pagesRetrieved || 1,
        skippedExistingPages: result.skippedExistingPages || 0,
        totalPagesFound: finalMaxPages,
        automaticPagination: maxPages <= 0 && fetchAllPages
      };
    }
    
    // Save to GCS if enabled
    if (saveToGcs) {
      try {
        const currentPage = formattedResults.pagination?.currentPage || 1;
        console.log(`Saving search results to GCS for category: ${category}, page: ${currentPage}`);
        
        // Store the standardized response in GCS instead of raw results
        const gcsPath = await searchStorage.savePageResults(category, currentPage, standardizedResponse);
        console.log(`Saved search results to GCS at: ${gcsPath}`);
      } catch (error) {
        console.error('Error saving search results to GCS:', error);
        // Continue with response even if storage fails
      }
    }
    
    res.json(standardizedResponse);
    
  } catch (error) {
    console.error('Error in search route:', error);
    res.status(500).json({ 
      success: false,
      error: 'Failed to fetch search results',
      message: error.message 
    });
  }
});

// New endpoint to accept direct API data from client-side interception
router.post('/direct', express.json({ limit: '10mb' }), async (req, res) => {
  try {
    // Validate request
    if (!req.body || !req.body.apiData) {
      return res.status(400).json({
        success: false,
        error: 'Invalid request',
        message: 'Request must include apiData field'
      });
    }
    
    console.log('Received direct API data submission');
    const apiData = req.body.apiData;
    const searchParams = req.body.searchParams || {};
    
    // Check if we should save to GCS
    const saveToGcs = req.body.saveToGcs === true;
    
    // Get category/search term for storage
    const category = searchParams.query || 'uncategorized';
    
    const formattedResults = formatSearchResults(apiData);
    
    // Create standardized response
    const standardizedResponse = standardizeResponse(formattedResults, {
      ...searchParams,
      saveToGcs: saveToGcs ? 'true' : 'false'
    });
    
    // Save to GCS if enabled
    if (saveToGcs) {
      try {
        const currentPage = formattedResults.pagination?.currentPage || 1;
        console.log(`Saving direct API data to GCS for category: ${category}, page: ${currentPage}`);
        
        // Store the standardized response in GCS instead of raw data
        const gcsPath = await searchStorage.savePageResults(category, currentPage, standardizedResponse);
        console.log(`Saved direct API data to GCS at: ${gcsPath}`);
      } catch (error) {
        console.error('Error saving direct API data to GCS:', error);
        // Continue with response even if storage fails
      }
    }
    
    res.json(standardizedResponse);
    
  } catch (error) {
    console.error('Error handling direct API data:', error);
    res.status(500).json({ 
      success: false,
      error: 'Failed to process API data',
      message: error.message 
    });
  }
});

// New endpoint to combine multiple pages of API data
router.post('/combine-pages', express.json({ limit: '10mb' }), async (req, res) => {
  try {
    // Validate request
    if (!req.body || !Array.isArray(req.body.pages) || req.body.pages.length === 0) {
      return res.status(400).json({
        success: false,
        error: 'Invalid request',
        message: 'Request must include a non-empty array of pages'
      });
    }
    
    console.log(`Combining ${req.body.pages.length} pages of API data`);
    const pages = req.body.pages;
    const searchParams = req.body.searchParams || {};
    
    // Check if we should save to GCS
    const saveToGcs = req.body.saveToGcs === true;
    
    // Get category/search term for storage
    const category = searchParams.query || 'uncategorized';
    
    // Use the first page as the base
    let combinedData = JSON.parse(JSON.stringify(pages[0]));
    
    // Add hits from other pages
    for (let i = 1; i < pages.length; i++) {
      const page = pages[i];
      if (page && page.results && page.results[0] && page.results[0].hits) {
        combinedData.results[0].hits = [
          ...combinedData.results[0].hits,
          ...page.results[0].hits
        ];
      }
    }
    
    // Update metadata
    if (combinedData.results && combinedData.results[0]) {
      const totalItems = combinedData.results[0].hits.length;
      if (combinedData.results[0].meta) {
        combinedData.results[0].meta.totalHits = totalItems;
      }
    }
    
    const formattedResults = formatSearchResults(combinedData);
    
    // Create standardized response for combined pages
    const standardizedResponse = standardizeResponse(formattedResults, {
      ...searchParams,
      saveToGcs: saveToGcs ? 'true' : 'false',
      combinedPages: pages.length
    });
    
    // Save individual pages to GCS if enabled
    if (saveToGcs) {
      try {
        console.log(`Saving ${pages.length} individual page results to GCS for category: ${category}`);
        
        // Save each page individually
        for (let i = 0; i < pages.length; i++) {
          const page = pages[i];
          const pageNumber = (page.results?.[0]?.meta?.page) || (i + 1);
          
          // Format the individual page
          const pageFormattedResults = formatSearchResults(page);
          const pageStandardizedResponse = standardizeResponse(pageFormattedResults, {
            ...searchParams,
            saveToGcs: 'true',
            page: pageNumber
          });
          
          // Store the formatted page results in GCS
          const gcsPath = await searchStorage.savePageResults(category, pageNumber, pageStandardizedResponse);
          console.log(`Saved page ${pageNumber} results to GCS at: ${gcsPath}`);
        }
      } catch (error) {
        console.error('Error saving combined pages to GCS:', error);
        // Continue with response even if storage fails
      }
    }
    
    res.json(standardizedResponse);
    
  } catch (error) {
    console.error('Error combining API data pages:', error);
    res.status(500).json({ 
      success: false,
      error: 'Failed to combine API data pages',
      message: error.message 
    });
  }
});

module.exports = router;
