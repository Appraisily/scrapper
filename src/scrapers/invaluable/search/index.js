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
      
      // Enable request interception to capture API calls
      await page.setRequestInterception(true);
      const apiMonitor = new ApiMonitor();
      apiMonitor.setupRequestInterception(page);
      
      await page.setCookie(...cookies);
      console.log('Navigating to search URL with cookies...');
      try {
        await page.goto(url, {
          waitUntil: 'networkidle0',
          timeout: constants.navigationTimeout
        });
      } catch (error) {
        console.log('Navigation timeout or error, capturing data anyway');
      }
      
      // Capture the raw HTML regardless of load status
      const rawHtml = await page.content();
      const apiData = apiMonitor.getData();

      return JSON.stringify({
        html: rawHtml,
        apiData,
        timestamp: new Date().toISOString()
      });

    } catch (error) {
      console.error('Search with cookies error:', error);
      throw error;
    }
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