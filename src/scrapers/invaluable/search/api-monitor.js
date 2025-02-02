const { constants } = require('../utils');

class ApiMonitor {
  constructor() {
    this.apiEndpoint = null;
    this.pages = new Map(); // Store multiple pages
    this.catResults = {
      request: null,
      response: null
    };
  }

  setupRequestInterception(page) {
    page.on('request', async (request) => {
      try {
        if (request.url().includes('catResults')) {
          // Store the request data
          const requestData = {
            url: request.url(),
            method: request.method(),
            headers: request.headers(),
            postData: request.postData()
          };
          this.catResults.request = requestData;
          
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
          // Store the raw response text
          this.catResults.response = await response.text();
          
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