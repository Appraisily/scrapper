const { constants } = require('../utils');
const ApiMonitor = require('./api-monitor');
const ResponseAnalyzer = require('./response-analyzer');
const PaginationHandler = require('./pagination-handler');

class SearchManager {
  constructor(browserManager) {
    this.browserManager = browserManager;
  }

  async searchItems(params = {}) {
    try {
      const page = this.browserManager.getPage();
      const searchUrl = this.buildSearchUrl(params);
      
      console.log('Navigating to:', searchUrl.toString());
      await page.goto(searchUrl.toString(), { waitUntil: 'networkidle0' });
      
      await page.waitForSelector('.lot-search-result', { timeout: constants.defaultTimeout });
      await this.autoScroll(page);
      
      return this.extractItems(page);
    } catch (error) {
      console.error('Invaluable search error:', error);
      throw error;
    }
  }

  async searchWithCookies(url, cookies) {
    try {
      const page = this.browserManager.getPage();
      await page.setRequestInterception(true);

      // Set up API monitoring
      const apiMonitor = new ApiMonitor();
      apiMonitor.setupRequestInterception(page);
      
      // Set cookies and navigate
      await page.setCookie(...cookies);
      console.log('Navigating to search URL with cookies...');
      await page.goto(url, {
        waitUntil: 'networkidle0',
        timeout: constants.navigationTimeout
      });
      
      // Wait for API responses
      await page.evaluate(() => new Promise(r => setTimeout(r, 5000)));
      
      // Check for API data
      const apiData = apiMonitor.getData();
      if (apiData.apiResponse) {
        console.log('Using API response instead of HTML');
        return JSON.stringify({
          ...apiData,
          timestamp: new Date().toISOString()
        });
      }

      // Handle protection if needed
      await this.handleProtectionIfNeeded(page);

      // Set up pagination
      const paginationHandler = new PaginationHandler(page);
      
      // Get initial batch
      console.log('Saving initial batch of results...');
      const initialHtml = await page.content();
      const initialCount = await paginationHandler.getInitialCount();
      console.log(`Initial items loaded: ${initialCount}`);
      
      // Check for load more
      const loadMoreButton = await paginationHandler.waitForLoadMoreButton();
      if (!loadMoreButton) {
        return initialHtml;
      }
      
      // Get total count
      const totalCount = await paginationHandler.getTotalAvailable();
      console.log(`Total available items: ${totalCount}`);
      
      // Load next batch
      const newCount = await paginationHandler.loadNextBatch(initialCount);
      
      // Get final HTML
      console.log('Saving second batch of results...');
      const updatedHtml = await page.content();
      
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

  buildSearchUrl(params) {
    const searchUrl = new URL('https://www.invaluable.com/search');
    searchUrl.searchParams.set('currencyCode', params.currency || 'USD');
    searchUrl.searchParams.set('priceResult[min]', params.minPrice || '250');
    searchUrl.searchParams.set('upcoming', params.upcoming || 'false');
    searchUrl.searchParams.set('query', params.query || 'fine art');
    searchUrl.searchParams.set('keyword', params.keyword || 'fine art');
    return searchUrl;
  }

  async handleProtectionIfNeeded(page) {
    const html = await page.content();
    if (html.includes('checking your browser') || 
        html.includes('Access to this page has been denied')) {
      console.log('Protection page detected, handling...');
      await this.browserManager.handleProtection();
      
      await page.goto(url, {
        waitUntil: 'networkidle0',
        timeout: constants.navigationTimeout
      });
    }
  }

  async extractItems(page) {
    const items = await page.evaluate(() => {
      const results = Array.from(document.querySelectorAll('.lot-search-result'));
      return results.map(item => ({
        title: item.querySelector('.lot-title-text')?.textContent?.trim() || '',
        price: item.querySelector('.lot-price')?.textContent?.trim() || '',
        date: item.querySelector('.lot-time-remaining')?.textContent?.trim() || '',
        imageUrl: item.querySelector('.lot-image img')?.getAttribute('src') || '',
        auctionHouse: item.querySelector('.auction-house-name')?.textContent?.trim() || '',
        lotNumber: item.querySelector('.lot-number-text')?.textContent?.trim() || '',
        estimate: item.querySelector('.lot-estimate')?.textContent?.trim() || '',
        location: item.querySelector('.auction-house-location')?.textContent?.trim() || '',
        source: 'invaluable'
      }));
    });
    
    console.log(`Found ${items.length} items`);
    return items;
  }

  async autoScroll(page) {
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
    
    await page.evaluate(() => new Promise(r => setTimeout(r, 2000)));
  }
}

module.exports = SearchManager;