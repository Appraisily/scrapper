const BrowserManager = require('./browser');
const AuthManager = require('./auth');
const SearchManager = require('./search');

class InvaluableScraper {
  constructor() {
    this.browser = new BrowserManager();
    this.auth = null;
    this.search = null;
  }

  async initialize() {
    await this.browser.initialize();
    this.auth = new AuthManager(this.browser);
    this.search = new SearchManager(this.browser);
  }

  async close() {
    await this.browser.close();
  }

  async login(email, password) {
    return this.auth.login(email, password);
  }

  async searchItems(params) {
    return this.search.searchItems(params);
  }

  async searchWithCookies(url, cookies) {
    return this.search.searchWithCookies(url, cookies);
  }

  async getArtistList() {
    return this.search.getArtistList();
  }
}

module.exports = InvaluableScraper;