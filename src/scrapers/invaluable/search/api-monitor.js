const { constants } = require('../utils');

class ApiMonitor {
  constructor() {
    this.apiEndpoint = null;
    this.pages = new Map(); // Store multiple pages
    this.totalItemsLoaded = 0;
    this.currentPage = 0;
  }

  setupRequestInterception(page) {
    page.on('request', async (request) => {
      try {
        if (request.url().includes('catResults')) {
          const requestData = {
            url: request.url(),
            method: request.method(),
            headers: request.headers(),
            postData: request.postData()
          };
          
          // Parse the page number from the request
          const postData = JSON.parse(request.postData());
          const pageNum = postData.requests[0].params.page || 0;
          
          if (!this.pages.has(pageNum)) {
            this.pages.set(pageNum, {
              request: requestData,
              response: null,
              timestamp: new Date().toISOString()
            });
          }
          
          console.log('Intercepted catResults API request:', {
            url: request.url(),
            method: request.method(),
            page: pageNum
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
          // Get raw response text instead of parsing JSON
          const responseText = await response.text();
          
          // Try to get page number from request since response might not be JSON
          const request = response.request();
          let pageNum = 0;
          
          try {
            const postData = JSON.parse(request.postData());
            pageNum = postData.requests[0].params.page || 0;
          } catch (e) {
            console.log('Could not parse request data for page number');
          }
          
          // Store raw response
          this.pages.set(pageNum, {
            request: {
              url: request.url(),
              method: request.method(),
              headers: request.headers(),
              postData: request.postData()
            },
            response: responseText,
            timestamp: new Date().toISOString()
          });
          
          console.log('Captured catResults API response:', {
            page: pageNum,
            size: responseText.length
          });
        }
      } catch (error) {
        console.error('Error handling response:', error);
      }
    });
  }

  async waitForPage(pageNum, timeout = 30000) {
    const start = Date.now();
    while (Date.now() - start < timeout) {
      const pageData = this.pages.get(pageNum);
      if (pageData?.response) {
        return pageData;
      }
      await new Promise(r => setTimeout(r, 100));
    }
    throw new Error(`Timeout waiting for page ${pageNum}`);
  }

  getStats() {
    // Basic stats without parsing JSON
    return {
      hasApiData: this.pages.size > 0,
      pagesCollected: this.pages.size
    };
  }

  getData() {
    return {
      pages: Object.fromEntries(this.pages),
      stats: this.getStats(),
    };
  }
}

module.exports = ApiMonitor;