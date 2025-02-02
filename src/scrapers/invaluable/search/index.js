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
      let initialHtml = '';

      // Set cookies before enabling interception
      await page.setCookie(...cookies);

      // Enable request interception to capture API calls
      await page.setRequestInterception(true);
      const apiMonitor = new ApiMonitor();
      apiMonitor.setupRequestInterception(page);

      console.log('Navigating to search URL with cookies...');

      try {
        // Initial page load
        await page.goto(url, {
          waitUntil: 'networkidle0',
          timeout: constants.navigationTimeout
        });
        
        // Handle cookie consent if present
        const cookieFrame = await page.$('iframe[id^="CybotCookiebotDialog"]');
        if (cookieFrame) {
          console.log('Handling cookie consent...');
          const frame = await cookieFrame.contentFrame();
          await frame.click('#CybotCookiebotDialogBodyButtonAccept');
          await page.waitForTimeout(2000);
        }

        // Capture HTML after cookie consent
        initialHtml = await page.content() || '';
        if (initialHtml.includes('checking your browser') || 
            initialHtml.includes('Access to this page has been denied')) {
          console.log('Protection page detected, handling...');
          await this.browserManager.handleProtection();
          initialHtml = await page.content() || '';
        }

        console.log('Initial page loaded, waiting for API response...');
        
        // Wait for first API response
        await page.waitForResponse(
          response => response.url().includes('catResults'),
          { timeout: constants.defaultTimeout }
        );

        // Wait a bit before clicking load more
        await page.waitForTimeout(2000);

        // Find and click load more button
        const loadMoreButton = await page.$('button.load-more-btn');
        if (loadMoreButton) {
          console.log('Found load more button, clicking...');
          await loadMoreButton.click();

          // Wait for second API response
          await page.waitForResponse(
            response => response.url().includes('catResults'),
            { timeout: constants.defaultTimeout }
          );
          console.log('Second API response captured');
        } else {
          console.log('No load more button found');
        }

      } catch (error) {
        console.log('Error during navigation or API capture:', error.message);
      }

      const apiData = apiMonitor.getData();
      console.log(`Total API responses captured: ${apiData.responses.length}`);

      const result = {
        html: initialHtml, // Only store initial HTML for verification
        apiData,
        timestamp: new Date().toISOString()
      };

      return result;
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
  
  async simulateNaturalScrolling(page) {
    await page.evaluate(async () => {
      const sleep = ms => new Promise(r => setTimeout(r, ms));
      
      // Get total height
      const totalHeight = document.documentElement.scrollHeight;
      let currentPosition = 0;
      
      while (currentPosition < totalHeight) {
        // Random scroll amount between 100-300 pixels
        const scrollAmount = 100 + Math.floor(Math.random() * 200);
        currentPosition += scrollAmount;
        
        // Smooth scroll
        window.scrollTo({
          top: currentPosition,
          behavior: 'smooth'
        });
        
        // Random pause between 500ms and 1.5s
        await sleep(500 + Math.random() * 1000);
      }
    });
    
    // Final pause after scrolling
    await page.waitForTimeout(1000);
  }
}

module.exports = SearchManager;