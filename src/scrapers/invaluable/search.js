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
      
      // Set cookies before navigation
      await page.setCookie(...cookies);
      
      console.log('Navigating to search URL with cookies...');
      const response = await page.goto(url, {
        waitUntil: 'networkidle0',
        timeout: constants.navigationTimeout
      });
      
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

      // Get the final HTML
      const finalHtml = await page.content();
      return finalHtml;
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