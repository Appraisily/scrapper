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
      console.log('Browser initialized successfully');

      // Construct the URL with parameters
      const searchUrl = new URL('https://www.christies.com/en/results');
      if (params.month) searchUrl.searchParams.set('month', params.month);
      if (params.year) searchUrl.searchParams.set('year', params.year);
      
      console.log('Navigating to:', searchUrl.toString());
      await this.page.goto(searchUrl.toString(), { 
        waitUntil: 'networkidle0',
        timeout: 60000 // Increase timeout to 60 seconds
      });

      // Wait for auction tiles to be rendered
      console.log('Waiting for auction results to load...');
      await this.page.waitForSelector('.chr-event-tile, .chr-lot-tile', { 
        timeout: 60000,
        visible: true 
      });
      console.log('Auction results loaded');

      // Extract auction data
      const auctions = await this.page.evaluate(() => {
        const tiles = Array.from(document.querySelectorAll('.chr-event-tile, .chr-lot-tile'));
        console.log(`Found ${tiles.length} auction tiles`);
        
        return tiles.map(tile => {
          const titleEl = tile.querySelector('.chr-event-tile__title, .chr-lot-tile__title');
          const dateEl = tile.querySelector('[aria-label*="date"], .chr-lot-tile__date');
          const locationEl = tile.querySelector('.chr-label-s, .chr-lot-tile__location');
          const saleTotalEl = tile.querySelector('.chr-body-s, .chr-lot-tile__price');
          const imageEl = tile.querySelector('img');
          const typeEl = tile.querySelector('.chr-event-tile__subtitle, .chr-lot-tile__subtitle');
          const idMatch = tile.innerHTML.match(/SaleID=(\d+)/);

          const imageUrl = imageEl ? (
            imageEl.getAttribute('data-srcset') || 
            imageEl.getAttribute('srcset') || 
            imageEl.getAttribute('src')
          )?.split(' ')[0] : '';

          return {
            id: idMatch ? idMatch[1] : '',
            title: titleEl ? titleEl.textContent.trim() : '',
            date: dateEl ? (dateEl.getAttribute('aria-label') || dateEl.textContent.trim()) : '',
            location: locationEl ? locationEl.textContent.trim() : '',
            saleTotal: saleTotalEl ? saleTotalEl.textContent.trim() : '',
            imageUrl: imageUrl || '',
            type: typeEl ? typeEl.textContent.split('|')[0].trim() : '',
            status: typeEl ? typeEl.textContent.split('|')[1].trim() : '',
            source: 'christies'
          };
        });
      });

      console.log(`Successfully extracted ${auctions.length} auctions`);
      return auctions;

    } catch (error) {
      console.error('Christie\'s search error:', error.message);
      if (error.message.includes('timeout')) {
        console.error('Page load timed out - the site might be slow or blocking requests');
      }
      if (error.message.includes('net::ERR_')) {
        console.error('Network error occurred - check connectivity or if the site is blocking requests');
      }
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