const BrowserManager = require('./browser');
const AuthManager = require('./auth');
const FurnitureSearchManager = require('./search');

class InvaluableScraper {
  constructor() {
    this.browser = new BrowserManager();
    this.auth = null;
    this.furnitureSearch = null;
  }

  async initialize() {
    await this.browser.initialize();
    this.auth = new AuthManager(this.browser);
    this.furnitureSearch = new FurnitureSearchManager(this.browser);
  }

  async close() {
    await this.browser.close();
  }

  async searchFurniture(cookies) {
    return this.furnitureSearch.searchFurniture(cookies);
  }
}

module.exports = InvaluableScraper;