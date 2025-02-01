const { constants } = require('../utils');

class PaginationHandler {
  constructor(page) {
    this.page = page;
  }

  async getInitialCount() {
    return this.page.evaluate(() => {
      return document.querySelectorAll('.lot-search-result').length;
    });
  }

  async getTotalAvailable() {
    return this.page.evaluate(() => {
      const text = document.querySelector('.search-results-count')?.textContent || '';
      const match = text.match(/of\s*([\d,]+)/);
      return match ? parseInt(match[1].replace(/,/g, ''), 10) : 0;
    });
  }

  async waitForLoadMoreButton() {
    try {
      return await this.page.waitForSelector('button.load-more-btn:not([disabled])', { 
        timeout: 10000,
        visible: true 
      });
    } catch (error) {
      console.log('No load more button found');
      return null;
    }
  }

  async loadNextBatch(initialCount) {
    console.log('Clicking load more button...');
    await Promise.all([
      this.page.click('button.load-more-btn'),
      this.page.waitForResponse(
        response => response.url().includes('/api/search') || response.url().includes('/api/lots'),
        { timeout: 30000 }
      )
    ]);
    
    // Wait for new items to load
    await this.page.waitForFunction(
      count => document.querySelectorAll('.lot-search-result').length > count,
      { timeout: constants.defaultTimeout },
      initialCount
    );
    
    // Wait for animations
    await this.page.evaluate(() => new Promise(r => setTimeout(r, 2000)));
    
    const newCount = await this.getInitialCount();
    console.log(`New items loaded: ${newCount} (added ${newCount - initialCount})`);
    
    return newCount;
  }
}

module.exports = PaginationHandler;