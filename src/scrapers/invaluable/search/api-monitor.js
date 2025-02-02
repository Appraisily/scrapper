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
      request.continue();
    });

    page.on('response', async (response) => {
      if (response.url().includes('catResults')) {
        try {
          this.catResults.response = await response.json();
          console.log('Captured catResults API response');
        } catch (error) {
          console.error('Error parsing catResults response:', error);
        }
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

module.exports = ApiMonitor;