const { constants } = require('../utils');

class ApiMonitor {
  constructor() {
    this.responses = [];
    this.seenResponses = new Set();
    this.firstResponseCaptured = false;
  }

  setupRequestInterception(page) {
    console.log('Setting up request interception');
    
    page.on('request', async (request) => {
      const url = request.url();
      if (url.includes('catResults')) {
        console.log('  • Intercepted API request:', url);
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
        const url = response.url();
        if (url.includes('catResults') && response.status() === 200) {
          console.log('  • Received API response:', url);
          const responseData = await response.text();
          
          if (responseData.length < 1000) {
            console.log('    - Skipping small response:', responseData.length, 'bytes');
            return;
          }
          
          const responseHash = this.hashResponse(responseData);

          if (this.seenResponses.has(responseHash)) {
            console.log('    - Duplicate response detected');
            return;
          }

          this.seenResponses.add(responseHash);
          console.log('    - New unique response:', (responseData.length / 1024).toFixed(2), 'KB');

          if (!this.firstResponseCaptured && responseData.length > 1000) {
            this.responses.push(responseData);
            console.log('    - Saved as first response');
            this.firstResponseCaptured = true;
          }
        }
      } catch (error) {
        console.error('    - Error handling response:', error.message);
      }
    });
  }

  hasFirstResponse() {
    return this.firstResponseCaptured;
  }

  getFirstResponseSize() {
    return this.responses[0]?.length || 0;
  }
  
  getData() {
    return {
      responses: this.responses
    };
  }

  hashResponse(responseData) {
    // Simple hash function for response content
    let hash = 0;
    for (let i = 0; i < responseData.length; i++) {
      const char = responseData.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash; // Convert to 32-bit integer
    }
    return hash;
  }
}

module.exports = ApiMonitor;