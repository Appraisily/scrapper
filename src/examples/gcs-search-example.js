/**
 * Example of using the search endpoint with GCS storage
 * This demonstrates how to save search results to Google Cloud Storage
 */
const axios = require('axios');

// Configuration
const config = {
  apiUrl: 'http://localhost:8080/api/search',
  searchParams: {
    query: 'furniture',          // Search term/category
    'priceResult[min]': '250',   // Min price
    'priceResult[max]': '5000',  // Max price
    saveToGcs: 'true',           // Enable GCS storage
    fetchAllPages: 'false',      // Just fetch one page for this example
  }
};

/**
 * Make a search request that saves results to GCS
 */
async function searchWithGcsStorage() {
  try {
    console.log('Starting search with GCS storage...');
    console.log('Search parameters:', config.searchParams);
    
    // Make the API request
    const response = await axios.get(config.apiUrl, {
      params: config.searchParams
    });
    
    // Check if successful
    if (response.data && response.data.success) {
      console.log('Search completed successfully!');
      console.log(`Found ${response.data.data.totalResults} items on this page`);
      
      if (response.data.pagination) {
        console.log(`Total items: ${response.data.pagination.totalItems}`);
        console.log(`Total pages: ${response.data.pagination.totalPages}`);
      }
      
      console.log('Results were saved to GCS bucket structure:');
      console.log(`gs://bucket-name/invaluable-data/${config.searchParams.query}/pages_001.json`);
    } else {
      console.error('Search failed:', response.data?.error || 'Unknown error');
    }
  } catch (error) {
    console.error('Error performing search with GCS storage:', error.message);
    if (error.response) {
      console.error('Server response:', error.response.data);
    }
  }
}

/**
 * Example of using direct API data submission with GCS storage
 * This is useful when you've already intercepted the API response
 */
async function directApiWithGcsStorage(apiData) {
  if (!apiData) {
    console.error('No API data provided for direct submission');
    return;
  }
  
  try {
    console.log('Submitting direct API data with GCS storage...');
    
    const response = await axios.post(`${config.apiUrl}/direct`, {
      apiData: apiData,
      searchParams: {
        query: config.searchParams.query
      },
      saveToGcs: true
    });
    
    if (response.data && response.data.success) {
      console.log('Direct API data submission successful!');
      console.log(`Data saved to GCS for category: ${config.searchParams.query}`);
    } else {
      console.error('Direct API submission failed:', response.data?.error || 'Unknown error');
    }
  } catch (error) {
    console.error('Error submitting direct API data:', error.message);
    if (error.response) {
      console.error('Server response:', error.response.data);
    }
  }
}

// Run the example
searchWithGcsStorage().catch(err => {
  console.error('Error in search example:', err);
  process.exit(1);
});

// To run the direct API submission example, uncomment these lines and provide API data:
/*
const sampleApiData = {}; // Put your intercepted API data here
directApiWithGcsStorage(sampleApiData).catch(err => {
  console.error('Error in direct API example:', err);
});
*/ 