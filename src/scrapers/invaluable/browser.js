const puppeteer = require('puppeteer-extra');
const StealthPlugin = require('puppeteer-extra-plugin-stealth');
const { browserConfig } = require('./utils');

puppeteer.use(StealthPlugin());

class BrowserManager {
  constructor() {
    this.browser = null;
    this.page = null;
  }

  async initialize() {
    if (!this.browser) {
      console.log('Initializing browser...');
      const width = 1920;
      const height = 1080;

      this.browser = await puppeteer.launch({
        headless: 'new',
        args: [
          ...browserConfig.args,
          `--window-size=${width},${height}`,
          '--disable-blink-features=AutomationControlled',
          '--disable-features=IsolateOrigins,site-per-process'
        ]
      });

      this.page = await this.browser.newPage();
      
      // Set consistent viewport
      await this.page.setViewport({ width, height });
      
      // Override navigator.webdriver
      await this.page.evaluateOnNewDocument(() => {
        Object.defineProperty(navigator, 'webdriver', {
          get: () => undefined
        });
        
        // Add modern browser features
        window.chrome = {
          runtime: {},
          loadTimes: function() {},
          csi: function() {},
          app: {}
        };
        
        // Add language preferences
        Object.defineProperty(navigator, 'languages', {
          get: () => ['en-US', 'en']
        });
        
        // Add proper plugins
        Object.defineProperty(navigator, 'plugins', {
          get: () => [
            {
              0: {type: 'application/x-google-chrome-pdf'},
              description: 'Portable Document Format',
              filename: 'internal-pdf-viewer',
              length: 1,
              name: 'Chrome PDF Plugin'
            }
          ]
        });
      });
      
      await this.page.setExtraHTTPHeaders(browserConfig.headers);
      await this.page.setUserAgent(browserConfig.userAgent);
      
      // Add random mouse movements and scrolling
      await this.addHumanBehavior(this.page);
    }
  }

  async close() {
    if (this.browser) {
      await this.browser.close();
      this.browser = null;
      this.page = null;
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

  async addHumanBehavior(page) {
    page.on('load', async () => {
      try {
        // Random mouse movements
        const moves = Math.floor(Math.random() * 3) + 2;
        for (let i = 0; i < moves; i++) {
          await page.mouse.move(
            Math.random() * 1920,
            Math.random() * 1080,
            { steps: 10 }
        );
        await page.evaluate(ms => new Promise(r => setTimeout(r, ms)), Math.random() * 200 + 100);
        }

        // Random scrolling
        await page.evaluate(() => {
          const scroll = () => {
            window.scrollBy(0, (Math.random() * 100) - 50);
          };
          for (let i = 0; i < 3; i++) {
            setTimeout(scroll, Math.random() * 1000);
          }
        });
      } catch (error) {
        console.log('Error in human behavior simulation:', error);
      }
    });
  }

  getPage() {
    return this.page;
  }
}

module.exports = BrowserManager;