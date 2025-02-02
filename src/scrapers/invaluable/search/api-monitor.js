const { constants } = require('../utils');

class ApiMonitor {
  constructor() {
    this.apiEndpoint = null;
    this.catResults = {
      response: null
    };
  }

  setupRequestInterception(page) {
    page.on('request', request => {
      request.continue();
    });

    page.on('response', async (response) => {
      try {
        if (response.url().includes('catResults')) {
          const responseText = await response.text();
          this.catResults.response = responseText;
          console.log('Captured catResults API response');
        }
      } catch (error) {
        console.error('Error handling response:', error);
      }
    });
  }
  
  getData() {
    return this.catResults;
  }
}

module.exports = ApiMonitor;