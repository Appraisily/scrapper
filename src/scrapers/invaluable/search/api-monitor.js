const { constants } = require('../utils');

class ApiMonitor {
  constructor() {
    this.responses = [];
  }

  setupRequestInterception(page) {
    page.on('request', async (request) => {
      // Add required headers for API requests
      if (request.url().includes('catResults')) {
        const headers = {
          ...request.headers(),
          'Accept': 'application/json',
          'Content-Type': 'application/json'
        };
        request.continue({ headers });
      } else {
        request.continue();
      }
    });
    page.on('response', async response => {
      try {
        if (response.url().includes('catResults')) {
          const responseData = await response.text();
          this.responses.push(responseData);
          console.log(`Captured catResults API response #${this.responses.length}`);
        }
      } catch (error) {
        console.error('Error handling response:', error);
      }
    });
  }
  
  getData() {
    return {
      responses: this.responses
    };
  }
}

module.exports = ApiMonitor;