const { constants } = require('../utils');

class ApiMonitor {
  constructor() {
    this.responses = [];
    this.firstResponseCaptured = false;
    this.secondResponseCaptured = false;
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
          // Only capture first two unique responses
          if (!this.firstResponseCaptured) {
            const responseData = await response.text();
            this.responses.push(responseData);
            console.log('Captured first API response');
            this.firstResponseCaptured = true;
          } else if (!this.secondResponseCaptured && this.firstResponseCaptured) {
            const responseData = await response.text();
            if (responseData !== this.responses[0]) {
              this.responses.push(responseData);
              console.log('Captured second API response');
              this.secondResponseCaptured = true;
            }
          }
        }
      } catch (error) {
        console.error('Error handling response:', error);
      }
    });
  }

  hasFirstResponse() {
    return this.firstResponseCaptured;
  }

  hasSecondResponse() {
    return this.secondResponseCaptured;
  }
  
  getData() {
    return {
      responses: this.responses
    };
  }
}

module.exports = ApiMonitor;