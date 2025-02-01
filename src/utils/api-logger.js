const storage = require('./storage');

async function saveApiData(apiData, searchId) {
  try {
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const filename = `Fine Art/api/${searchId}-api-data.json`;
    
    // Format API data for storage
    const formattedData = {
      timestamp,
      searchId,
      requests: apiData.apiRequests.map(req => ({
        url: req.url,
        method: req.method,
        headers: req.headers,
        timestamp: req.timestamp,
        postData: req.postData
      })),
      endpoint: apiData.apiEndpoint,
      response: apiData.apiResponse,
      analysis: {
        totalRequests: apiData.apiRequests.length,
        endpoints: [...new Set(apiData.apiRequests.map(req => req.url))],
        requestMethods: [...new Set(apiData.apiRequests.map(req => req.method))],
        hasLoadMore: apiData.apiRequests.some(req => req.url.includes('load-more')),
        paginationInfo: apiData.apiResponse?.pagination || null
      }
    };

    const url = await storage.saveJsonFile(filename, formattedData);
    console.log(`[API Logger] Data saved to: ${url}`);
    return url;
  } catch (error) {
    console.error('[API Logger] Error saving API data:', error);
    throw error;
  }
}