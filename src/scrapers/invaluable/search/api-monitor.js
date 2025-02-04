const { constants } = require('../utils');

class ApiMonitor {
  constructor() {
    this.responses = [];
    this.seenResponses = new Set();
    this.firstResponseCaptured = false;
  }

  setupRequestInterception(page) {
    console.log('Setting up request interception');
    
    // Track if we've captured the main API response
    let apiResponseCaptured = false;

    page.on('request', request => {
      try {
        const url = request.url();
        if (url.includes('catResults')) {
          console.log('  • Intercepting API request:', url);
          
          // Keep original headers but ensure content-type is set
          const headers = {
            ...request.headers(),
            'content-type': 'application/json'
          };

          request.continue({ headers });
        } else {
          request.continue();
        }
      } catch (error) {
        if (!error.message.includes('Request is already handled')) {
          console.error('Error intercepting request:', error);
        }
        request.continue();
      }
    });

    page.on('response', async (response) => {
      try {
        const url = response.url();
        if (url.includes('catResults') && response.status() === 200 && !apiResponseCaptured) {
          console.log('  • Received API response:', url);
          
          try {
            const responseData = await response.text();
            console.log('    - Response size:', responseData.length, 'bytes');

            // Parse and validate the response
            const parsedResponse = JSON.parse(responseData);
            if (parsedResponse && parsedResponse.results) {
              this.responses.push(responseData);
              apiResponseCaptured = true;
              console.log('    - Response validated and saved');
            } else {
              console.log('    - Invalid response format');
            }
          } catch (error) {
            console.error('    - Error handling response:', error.message);
          }
        }
      } catch (error) {
        if (!error.message.includes('Target closed')) {
          console.error('    - Error handling response:', error.message);
        }
      }
    });
  }
  
  hasFirstResponse() {
    return this.responses.length > 0;
  }

  getData() {
    return {
      responses: this.responses
    };
  }
}

module.exports = ApiMonitor;