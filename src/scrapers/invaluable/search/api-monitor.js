const { constants } = require('../utils');

class ApiMonitor {
  constructor() {
    this.responses = [];
    this.cookies = null;
    this.requestCount = 0;
    this.responseCount = 0;
  }

  setupRequestInterception(page, cookies) {
    console.log('🔄 Initializing API monitor');
    console.log(`🍪 Received ${cookies.length} cookies for interception`);
    this.cookies = cookies;
    
    page.on('request', request => {
      try {
        const reqUrl = request.url();
        const resourceType = request.resourceType();
        this.requestCount++;
        
        console.log(`📤 [Request ${this.requestCount}] Type: ${resourceType}, URL: ${reqUrl.substring(0, 100)}...`);
        
        const headers = request.headers();
        
        // Add cookies to all requests
        headers['Cookie'] = this.cookies.map(c => `${c.name}=${c.value}`).join('; ');
        
        // Block unnecessary resources
        if (resourceType === 'image' || resourceType === 'stylesheet' || resourceType === 'font') {
          console.log(`   ⛔ Blocking ${resourceType} request`);
          request.abort();
          return;
        }

        if (reqUrl.includes('catResults')) {
          console.log('   🎯 Intercepting catResults API request');
          console.log('   📋 Request headers:', JSON.stringify(headers, null, 2));
          
          // Only add essential headers
          headers['Accept'] = 'application/json';
          headers['Content-Type'] = 'application/json';
          
          console.log('   ✨ Added API-specific headers');
          request.continue({ headers });
        } else {
          console.log('   ➡️ Continuing regular request');
          request.continue();
        }
      } catch (error) {
        if (!error.message.includes('Request is already handled')) {
          console.error('❌ Request interception error:', error.message);
          console.error('   Stack:', error.stack);
        }
        request.continue();
      }
    });

    page.on('response', async (response) => {
      try {
        const url = response.url();
        this.responseCount++;
        console.log(`📥 [Response ${this.responseCount}] Status: ${response.status()}, URL: ${url.substring(0, 100)}...`);
        
        if (url.includes('catResults') && response.status() === 200) {
          console.log('   🎯 Received catResults API response');
          
          try { 
            const responseData = await response.text();
            console.log(`   📊 Response size: ${(responseData.length / 1024).toFixed(2)} KB`);

            // Parse and validate the response
            const parsedResponse = JSON.parse(responseData);
            console.log('   🔍 Validating response structure...');
            
            if (parsedResponse && parsedResponse.results) {
              this.responses = [responseData]; // Only keep latest response
              console.log('   ✅ Valid response captured and stored');
              console.log(`   📈 Results count: ${parsedResponse.results.length}`);
            } else {
              console.log('   ❌ Invalid response format - missing results');
              console.log('   🔍 Response keys:', Object.keys(parsedResponse));
            }
          } catch (error) {
            console.error('   ❌ Response handling error:', error.message);
            console.error('   Stack:', error.stack);
          }
        }
      } catch (error) {
        if (!error.message.includes('Target closed')) {
          console.error('❌ Response error:', error.message);
          console.error('   Stack:', error.stack);
        }
      }
    });
  }
  
  hasValidResponse() {
    const hasResponse = this.responses.length > 0;
    console.log(`📊 Response status check: ${hasResponse ? 'Valid response present' : 'No valid response yet'}`);
    console.log(`   Total requests: ${this.requestCount}, Total responses: ${this.responseCount}`);
    return hasResponse;
  }

  getData() {
    console.log(`📦 Returning ${this.responses.length} captured responses`);
    return {
      responses: this.responses
    };
  }
}

module.exports = ApiMonitor;