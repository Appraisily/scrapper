const { constants } = require('../utils');

class ApiMonitor {
  constructor() {
    this.responses = [];
  }

  setupRequestInterception(page) {
    console.log('Setting up request interception');
    
    page.on('request', request => {
      try {
        const reqUrl = request.url();
        const headers = request.headers();
        
        // Block unnecessary resources
        if (request.resourceType() === 'image' || 
            request.resourceType() === 'stylesheet' || 
            request.resourceType() === 'font') {
          request.abort();
          return;
        }

        if (reqUrl.includes('catResults')) {
          console.log('  • Intercepting API request:', reqUrl);
          
          // Add required headers for API request
          headers['Accept'] = 'application/json';
          headers['Content-Type'] = 'application/json';
          headers['Connection'] = 'keep-alive';
          headers['sec-ch-ua'] = '"Not A(Brand";v="8", "Chromium";v="132", "Google Chrome";v="132"';
          headers['sec-ch-ua-mobile'] = '?0';
          headers['sec-ch-ua-platform'] = '"Windows"';
          headers['sec-fetch-dest'] = 'empty';
          headers['sec-fetch-mode'] = 'cors';
          headers['sec-fetch-site'] = 'same-origin';
          
          request.continue({
            headers,
            method: 'POST'
          };
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
        if (url.includes('catResults') && response.status() === 200) {
          console.log('  • Received API response:', url);
          
          try {
            const responseData = await response.text();
            console.log('    - Response size:', responseData.length, 'bytes');

            // Parse and validate the response
            const parsedResponse = JSON.parse(responseData);
            if (parsedResponse && parsedResponse.results) {
              this.responses = [responseData]; // Only keep latest response
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
  
  hasResponse() {
    return this.responses.length > 0;
  }

  getData() {
    return {
      responses: this.responses
    };
  }
}

module.exports = ApiMonitor;