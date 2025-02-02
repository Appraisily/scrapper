const { constants } = require('../utils');

class ApiMonitor {
  constructor() {
    this.apiEndpoint = null;
    this.catResults = {
      request: null,
      response: null
    };
    this.totalItemsLoaded = 0;
  }

  setupRequestInterception(page) {
    page.on('request', async (request) => {
      try {
        if (request.url().includes('catResults')) {
          this.catResults.request = {
            url: request.url(),
            method: request.method(),
            headers: request.headers(),
            postData: request.postData()
          };
          console.log('Intercepted catResults API request:', {
            url: request.url(),
            method: request.method()
          });
        }
        await request.continue();
      } catch (error) {
        console.error('Error handling request:', error);
        await request.continue();
      }
    });

    page.on('response', async (response) => {
      try {
        if (response.url().includes('catResults')) {
          const responseData = await response.json();
          this.catResults.response = responseData;
          console.log('Captured catResults API response:', {
            hits: responseData.results?.[0]?.nbHits,
            pages: responseData.results?.[0]?.nbPages
          });
        }
      } catch (error) {
        console.error('Error handling response:', error);
      }
    });
  }

  getStats() {
    return {
      hasApiData: this.catResults.response !== null,
      totalHits: this.catResults.response?.results?.[0]?.nbHits || 0,
      totalPages: this.catResults.response?.results?.[0]?.nbPages || 0
    };
  }

  getData() {
    return {
      catResults: this.catResults,
      stats: this.getStats()
    };
  }
}

module.exports = ApiMonitor;