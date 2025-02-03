const BrowserManager = require('./browser');
const AuthManager = require('./auth');
const ArtistListScraper = require('./artist-list');
const SearchScraper = require('./search');

class InvaluableScraper {
  constructor(storage) {
    if (!storage) {
      throw new Error('Storage instance is required');
    }
    this.storage = storage;
    this.artistListScraper = null;
    this.searchScraper = null;
  }

  async initialize() {
    // Each scraper gets its own browser instance
    const artistListBrowser = new BrowserManager();
    const searchBrowser = new BrowserManager();
    
    await Promise.all([
      artistListBrowser.initialize(),
      searchBrowser.initialize()
    ]);

    this.artistListScraper = new ArtistListScraper(artistListBrowser, this.storage);
    this.searchScraper = new SearchScraper(searchBrowser, this.storage);
  }

  async close() {
    await Promise.all([
      this.artistListScraper?.close(),
      this.searchScraper?.close()
    ]);
  }

  async getArtistList() {
    if (!this.artistListScraper) {
      throw new Error('Artist list scraper not initialized');
    }
    return this.artistListScraper.extractArtistList();
  }

  async searchWithCookies(cookies) {
    if (!this.searchScraper) {
      throw new Error('Search scraper not initialized');
    }
    return this.searchScraper.searchWithCookies(cookies);
  }
}

module.exports = InvaluableScraper;