const { constants } = require('./utils');

class SearchManager {
  constructor(browserManager) {
    this.browserManager = browserManager;
  }

  async searchItems(params = {}) {
    try {
      const page = this.browserManager.getPage();
      
      // Construct the URL with parameters
      const searchUrl = new URL('https://www.invaluable.com/search');
      searchUrl.searchParams.set('currencyCode', params.currency || 'USD');
      searchUrl.searchParams.set('priceResult[min]', params.minPrice || '250');
      searchUrl.searchParams.set('upcoming', params.upcoming || 'false');
      searchUrl.searchParams.set('query', params.query || 'fine art');
      searchUrl.searchParams.set('keyword', params.keyword || 'fine art');
      
      console.log('Navigating to:', searchUrl.toString());
      await page.goto(searchUrl.toString(), { waitUntil: 'networkidle0' });
      
      // Wait for search results to load
      await page.waitForSelector('.lot-search-result', { timeout: constants.defaultTimeout });
      
      // Scroll to load more items
      await this.autoScroll();
      
      // Extract item data
      const items = await page.evaluate(() => {
        const results = Array.from(document.querySelectorAll('.lot-search-result'));
        return results.map(item => {
          const titleEl = item.querySelector('.lot-title-text');
          const priceEl = item.querySelector('.lot-price');
          const dateEl = item.querySelector('.lot-time-remaining');
          const imageEl = item.querySelector('.lot-image img');
          const auctionHouseEl = item.querySelector('.auction-house-name');
          const lotNumberEl = item.querySelector('.lot-number-text');
          const estimateEl = item.querySelector('.lot-estimate');
          const locationEl = item.querySelector('.auction-house-location');
          
          return {
            title: titleEl ? titleEl.textContent.trim() : '',
            price: priceEl ? priceEl.textContent.trim() : '',
            date: dateEl ? dateEl.textContent.trim() : '',
            imageUrl: imageEl ? imageEl.getAttribute('src') : '',
            auctionHouse: auctionHouseEl ? auctionHouseEl.textContent.trim() : '',
            lotNumber: lotNumberEl ? lotNumberEl.textContent.trim() : '',
            estimate: estimateEl ? estimateEl.textContent.trim() : '',
            location: locationEl ? locationEl.textContent.trim() : '',
            source: 'invaluable'
          };
        });
      });
      
      console.log(`Found ${items.length} items`);
      return items;
      
    } catch (error) {
      console.error('Invaluable search error:', error);
      throw error;
    }
  }

  async searchWithCookies(url, cookies) {
    try {
      const page = this.browserManager.getPage();
      let batchNumber = 1;
      let apiEndpoint = null;
      let apiResponse = null;
      let apiRequests = [];
      
      await page.setRequestInterception(true);
      page.on('request', async request => {
        // Track all API requests
        if (request.url().includes('/api/search') || 
            request.url().includes('/api/lots') ||
            request.url().includes('/api/load-more')) {
          const requestData = {
            url: request.url(),
            method: request.method(),
            headers: request.headers(),
            timestamp: new Date().toISOString()
          };
          
          try {
            if (request.postData()) {
              requestData.postData = JSON.parse(request.postData());
            }
          } catch (e) {
            console.error('Error parsing request post data:', e);
          }
          
          console.log('API Request:', JSON.stringify(requestData, null, 2));
          apiRequests.push(requestData);
          apiEndpoint = request.url();
        }
        request.continue();
      });
      
      // Enhanced response monitoring
      page.on('response', async (response) => {
        if (response.url().includes('/api/search') || 
            response.url().includes('/api/lots') ||
            response.url().includes('/api/load-more')) {
          try {
            const responseData = {
              url: response.url(),
              status: response.status(),
              headers: response.headers(),
              timestamp: new Date().toISOString()
            };
            
            const json = await response.json();
            responseData.body = json;
            apiResponse = json;
            
            console.log('API Response:', JSON.stringify(responseData, null, 2));
            
            // Look for pagination info
            if (json.pagination) {
              console.log('Pagination Info:', JSON.stringify(json.pagination, null, 2));
            }
          } catch (e) {
            console.error('Error parsing API response:', e);
          }
        }
      });
      
      // Monitor network errors
      page.on('requestfailed', request => {
        if (request.url().includes('/api/')) {
          console.error('API Request Failed:', {
            url: request.url(),
            errorText: request.failure().errorText,
            timestamp: new Date().toISOString()
          });
        }
      });
      
      // Set cookies before navigation
      await page.setCookie(...cookies);
      
      console.log('Navigating to search URL with cookies...');
      const response = await page.goto(url, {
        waitUntil: 'networkidle0',
        timeout: constants.navigationTimeout
      });
      
      // Wait a bit longer to catch API responses
      await page.evaluate(() => new Promise(r => setTimeout(r, 5000)));
      
      // If we found an API endpoint and response, use that
      if (apiResponse) {
        console.log('Using API response instead of HTML');
        const combinedData = {
          html: await page.content(),
          apiEndpoint,
          apiResponse,
          apiRequests,
          timestamp: new Date().toISOString()
        };
        
        // Log the complete data for analysis
        console.log('Complete Request/Response Data:', 
          JSON.stringify(combinedData, null, 2));
        
        return JSON.stringify({
          html: await page.content(),
          apiEndpoint,
          apiResponse,
          apiRequests
        });
      }

      // Check if we hit Cloudflare or other protection
      const html = await page.content();
      if (html.includes('checking your browser') || 
          html.includes('Access to this page has been denied')) {
        console.log('Protection page detected, handling...');
        await this.browserManager.handleProtection();
        
        // Retry the navigation
        await page.goto(url, {
          waitUntil: 'networkidle0',
          timeout: constants.navigationTimeout
        });
      }

      // Wait for search results to load
      await page.waitForFunction(() => {
        return document.readyState === 'complete' && 
               !document.querySelector('.loading-indicator') &&
               !document.querySelector('[aria-busy="true"]');
      }, { timeout: constants.defaultTimeout });

      // Get initial batch HTML
      console.log('Saving initial batch of results...');
      const initialHtml = await page.content();
      
      // Wait for load more button
      const loadMoreButton = await page.waitForSelector('.load-more-btn', { timeout: 10000 });
      if (!loadMoreButton) {
        console.log('No load more button found, returning initial batch only');
        return initialHtml;
      }
      
      // Get total count
      const totalCount = await page.evaluate(() => {
        const countEl = document.querySelector('.total-count');
        return countEl ? parseInt(countEl.textContent.replace(/,/g, ''), 10) : 0;
      });
      console.log(`Total available items: ${totalCount}`);
      
      // Click load more and wait for new content
      console.log('Clicking load more button...');
      await loadMoreButton.click();
      
      // Wait for new items to load
      await page.waitForFunction(() => {
        const loadingIndicator = document.querySelector('.loading-indicator');
        const busyElements = document.querySelectorAll('[aria-busy="true"]');
        return !loadingIndicator && busyElements.length === 0;
      }, { timeout: constants.defaultTimeout });
      
      // Wait a bit for any animations to complete
      await page.evaluate(() => new Promise(r => setTimeout(r, 2000)));
      
      // Get updated HTML with second batch
      console.log('Saving second batch of results...');
      const updatedHtml = await page.content();
      
      // Return both batches
      return JSON.stringify({
        initialBatch: initialHtml,
        secondBatch: updatedHtml,
        totalAvailable: totalCount
      });

    } catch (error) {
      console.error('Search with cookies error:', error);
      throw error;
    }
  }

  async autoScroll() {
    const page = this.browserManager.getPage();
    await page.evaluate(async () => {
      await new Promise((resolve) => {
        let totalHeight = 0;
        const distance = 100;
        const timer = setInterval(() => {
          const scrollHeight = document.documentElement.scrollHeight;
          window.scrollBy(0, distance);
          totalHeight += distance;
          
          if (totalHeight >= scrollHeight) {
            clearInterval(timer);
            resolve();
          }
        }, 100);
      });
    });
    
    // Wait a bit for any lazy-loaded content
    await page.evaluate(() => new Promise(r => setTimeout(r, 2000)));
  }
}

module.exports = SearchManager;