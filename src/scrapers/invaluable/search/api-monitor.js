const { constants } = require('../utils');

class ApiMonitor {
  constructor() {
    this.responses = [];
    this.seenResponses = new Set();
    this.firstResponseCaptured = false;
    this.secondResponseCaptured = false;
  }

  setupRequestInterception(page) {
    page.on('request', async (request) => {
      // Add required headers for API requests
      console.log('🔍 Analyzing request...');
      const url = request.url();
      if (url.includes('catResults')) {
        console.log(`  • 📡 Intercepting API request: ${url}`);
        const headers = {
          ...request.headers(),
          'Accept': 'application/json',
          'Content-Type': 'application/json'
        };
        console.log('  • 📝 Added API headers');
        request.continue({ headers });
      } else {
        request.continue();
      }
    });
    
    console.log('🎯 Setting up response monitoring...');
    page.on('response', async response => {
      try {
        const url = response.url();
        if (url.includes('catResults')) {
          console.log('📥 Processing API response...');
          const responseData = await response.text();
          const responseHash = this.hashResponse(responseData);
          console.log(`  • Response size: ${(responseData.length / 1024).toFixed(2)} KB`);

          // Skip if we've seen this exact response before
          if (this.seenResponses.has(responseHash)) {
            console.log('  • 🔄 Skipping duplicate response');
            return;
          }

          // Add to seen responses
          console.log('  • 🆕 New unique response detected');
          this.seenResponses.add(responseHash);

          if (!this.firstResponseCaptured && responseData.length > 1000) {
            this.responses.push(responseData);
            console.log('  • ✅ Captured first API response');
            console.log(`    URL: ${url}`);
            this.firstResponseCaptured = true;
          } else if (!this.secondResponseCaptured && this.firstResponseCaptured && 
                     responseData.length > 1000 && responseHash !== this.hashResponse(this.responses[0])) {
            this.responses.push(responseData);
            console.log('  • ✅ Captured second API response');
            console.log(`    URL: ${url}`);
            this.secondResponseCaptured = true;
          }
          console.log(`  • 📊 Total responses captured: ${this.responses.length}`);
        }
      } catch (error) {
        console.error('❌ Error handling response:', error.message);
        console.error('  Stack:', error.stack);
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
    }
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