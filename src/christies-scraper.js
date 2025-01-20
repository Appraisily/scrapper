const puppeteer = require('puppeteer-extra');
const StealthPlugin = require('puppeteer-extra-plugin-stealth');
const { saveHtmlToFile } = require('./utils/drive-logger');
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
      
      // Add more realistic browser headers
      await this.page.setExtraHTTPHeaders({
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8',
        'Accept-Language': 'en-US,en;q=0.9',
        'Cache-Control': 'no-cache',
        'Connection': 'keep-alive',
        'DNT': '1',
        'Pragma': 'no-cache',
        'Sec-Ch-Ua': '"Not_A_Brand";v="8", "Chromium";v="120", "Google Chrome";v="120"',
        'Sec-Ch-Ua-Mobile': '?0',
        'Sec-Ch-Ua-Platform': '"Windows"',
        'Sec-Fetch-Dest': 'document',
        'Sec-Fetch-Mode': 'navigate',
        'Sec-Fetch-Site': 'none',
        'Sec-Fetch-User': '?1',
        'Upgrade-Insecure-Requests': '1'
      });

      // Add more realistic browser properties
      await this.page.evaluateOnNewDocument(() => {
        Object.defineProperties(navigator, {
          webdriver: { get: () => undefined },
          languages: { get: () => ['en-US', 'en'] },
          plugins: { get: () => [
            {
              0: { type: 'application/x-google-chrome-pdf' },
              description: 'Portable Document Format',
              filename: 'internal-pdf-viewer',
              length: 1,
              name: 'Chrome PDF Plugin'
            }
          ]},
          hardwareConcurrency: { get: () => 8 },
          deviceMemory: { get: () => 8 },
          connection: { get: () => ({
            effectiveType: '4g',
            rtt: 50,
            downlink: 10,
            saveData: false
          })}
        });
      });

      // Construct the URL with parameters
      const searchUrl = new URL('https://www.christies.com/en/results');
      if (params.month) searchUrl.searchParams.set('month', params.month);
      if (params.year) searchUrl.searchParams.set('year', params.year);
      
      console.log('Navigating to:', searchUrl.toString());
      const response = await this.page.goto(searchUrl.toString(), { 
        waitUntil: 'networkidle0',
        timeout: 60000 // Increase timeout to 60 seconds
      });
      
      // Check if we hit a protection page
      const html = await this.page.content();
      if (html.includes('Access to this page has been denied')) {
        console.log('Protection page detected, handling...');
        await this.handleProtection();
        
        // Retry the navigation after handling protection
        await this.page.goto(searchUrl.toString(), { 
          waitUntil: 'networkidle0',
          timeout: 60000
        });
      }

      // Wait for either results or no results message
      await Promise.race([
        this.page.waitForSelector('.chr-event-tile, .chr-lot-tile', { timeout: 60000 }),
        this.page.waitForSelector('.chr-calendar-no-results', { timeout: 60000 })
      ]);

      // Check if we have a "no results" message
      const noResults = await this.page.$('.chr-calendar-no-results');
      if (noResults) {
        console.log('No auction results found');
        return [];
      }

      // Log the complete HTML and page state
      const fullHtml = await this.page.evaluate(() => {
        return {
          html: document.documentElement.outerHTML,
          bodyClasses: document.body.className,
          visibleElements: Array.from(document.querySelectorAll('*'))
            .filter(el => {
              const style = window.getComputedStyle(el);
              return style.display !== 'none' && style.visibility !== 'hidden';
            })
            .map(el => ({
              tag: el.tagName.toLowerCase(),
              id: el.id,
              classes: Array.from(el.classList),
              text: el.textContent.trim().substring(0, 100)
            }))
        };
      });
      
      // Save HTML content
      saveHtmlToFile(fullHtml.html, 'christies-search');
      
      // Wait for any dynamic content to load
      await this.page.waitForFunction(() => {
        return document.readyState === 'complete' && 
               !document.querySelector('.loading-indicator') &&
               !document.querySelector('[aria-busy="true"]');
      }, { timeout: 30000 });

      // Wait for auction tiles to be rendered
      console.log('Waiting for content to load...');

      // Wait for the loading indicator to disappear
      await this.page.waitForFunction(() => {
        const loader = document.querySelector('.chr-loading');
        return !loader || loader.style.display === 'none';
      });
      
      console.log('Auction results loaded');

      // Extract auction data
      const auctions = await this.page.evaluate(() => {
        const tiles = Array.from(document.querySelectorAll('.chr-event-tile, .chr-lot-tile'));
        if (!tiles.length) return [];
        
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

      console.log(`Successfully extracted ${auctions?.length || 0} auctions`);
      
      // If no auctions found, log more details about the page
      if (auctions.length === 0) {
        console.log('No auctions found. Page details:', await this.page.evaluate(() => {
          return {
            url: window.location.href,
            html: document.documentElement.outerHTML,
            visibleElements: Array.from(document.querySelectorAll('*'))
              .filter(el => window.getComputedStyle(el).display !== 'none'),
            links: Array.from(document.links).map(l => l.href).slice(0, 10)
          };
        }));
      }
      
      return auctions;

    } catch (error) {
      console.error('Christie\'s search error:', error);
      if (error.message.includes('timeout')) {
        console.error('Page load timed out - the site might be slow or blocking requests');
        // Take a screenshot for debugging
        await this.page.screenshot({ path: '/tmp/christies-timeout.png' });
        console.log('Timeout screenshot saved to /tmp/christies-timeout.png');
      }
      if (error.message?.includes('net::ERR_')) {
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

  async handleProtection() {
    try {
      console.log('Handling protection page...');
      
      // Add random mouse movements
      await this.page.mouse.move(
        100 + Math.random() * 100,
        100 + Math.random() * 100,
        { steps: 10 }
      );
      
      // Wait a bit and add some scrolling
      await this.page.evaluate(() => {
        window.scrollTo({
          top: 100,
          behavior: 'smooth'
        });
        return new Promise(r => setTimeout(r, 1000));
      });
      
      // Wait for protection to clear
      await this.page.waitForFunction(() => {
        return !document.querySelector('[id^="px-captcha"]') && 
               !document.querySelector('.px-block');
      }, { timeout: 30000 });
      
      console.log('Protection cleared');
      return true;
    } catch (error) {
      console.error('Error handling protection:', error);
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