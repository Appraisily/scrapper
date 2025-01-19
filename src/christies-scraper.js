const puppeteer = require('puppeteer-extra');
const StealthPlugin = require('puppeteer-extra-plugin-stealth');
puppeteer.use(StealthPlugin());

class ChristiesScraper {
  constructor() {
    this.browser = null;
    this.page = null;
  }

  async initialize() {
    if (!this.browser) {
      console.log('Initializing browser...');
      this.browser = await puppeteer.launch({
        headless: 'new',
        args: [
          '--no-sandbox',
          '--disable-setuid-sandbox',
          '--disable-dev-shm-usage',
          '--disable-accelerated-2d-canvas',
          '--disable-gpu',
          '--window-size=1920,1080'
        ]
      });
      this.page = await this.browser.newPage();
      await this.page.setViewport({ width: 1920, height: 1080 });
      await this.page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36');
      
      // Add stealth settings
      await this.page.evaluateOnNewDocument(() => {
        delete Object.getPrototypeOf(navigator).webdriver;
        window.chrome = {
          runtime: {},
          loadTimes: () => {},
        };
      });
    }
  }

  async searchAuctions(params = {}) {
    try {
      await this.initialize();

      // Construct the URL with parameters
      const searchUrl = new URL('https://www.christies.com/en/results');
      if (params.month) searchUrl.searchParams.set('month', params.month);
      if (params.year) searchUrl.searchParams.set('year', params.year);
      
      console.log('Navigating to:', searchUrl.toString());
      await this.page.goto(searchUrl.toString(), { waitUntil: 'networkidle0' });

      // Wait for auction tiles to be rendered
      await this.page.waitForSelector('chr-event-tile', { timeout: 30000 });

      // Extract auction data
      const auctions = await this.page.evaluate(() => {
        const tiles = Array.from(document.querySelectorAll('chr-event-tile'));
        return tiles.map(tile => {
          const titleEl = tile.querySelector('.chr-event-tile__title');
          const dateEl = tile.querySelector('span[aria-label]');
          const locationEl = tile.querySelector('.chr-label-s');
          const saleTotalEl = tile.querySelector('.chr-body-s');
          const imageEl = tile.querySelector('img.chr-img');
          const typeEl = tile.querySelector('.chr-event-tile__subtitle');
          const idMatch = tile.innerHTML.match(/SaleID=(\d+)/);

          return {
            id: idMatch ? idMatch[1] : '',
            title: titleEl ? titleEl.textContent.trim() : '',
            date: dateEl ? dateEl.getAttribute('aria-label') : '',
            location: locationEl ? locationEl.textContent.trim() : '',
            saleTotal: saleTotalEl ? saleTotalEl.textContent.trim() : '',
            imageUrl: imageEl ? imageEl.getAttribute('data-srcset').split(' ')[0] : '',
            type: typeEl ? typeEl.textContent.split('|')[0].trim() : '',
            status: typeEl ? typeEl.textContent.split('|')[1].trim() : '',
            source: 'christies'
          };
        });
      });

      return auctions;
    } catch (error) {
      console.error('Christie\'s search error:', error);
      throw error;
    }
  }

  async getLotDetails(lotId) {
    try {
      await this.initialize();
      
      const lotUrl = `https://www.christies.com/en/lot/${lotId}`;
      await this.page.goto(lotUrl, { waitUntil: 'networkidle0' });
      
      // Wait for lot details to load
      await this.page.waitForSelector('.lot-details', { timeout: 30000 });

      // Extract lot details
      const details = await this.page.evaluate(() => {
        return {
          // Add lot detail extraction logic here based on actual HTML structure
        };
      });

      return details;
    } catch (error) {
      console.error('Lot details error:', error);
      throw error;
    }
  }

  async close() {
    if (this.browser) {
      await this.browser.close();
      this.browser = null;
      this.page = null;
    }
  }
}

module.exports = ChristiesScraper;