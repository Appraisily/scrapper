const puppeteer = require('puppeteer-extra');
const StealthPlugin = require('puppeteer-extra-plugin-stealth');
const { browserConfig } = require('./utils');

puppeteer.use(StealthPlugin());

class BrowserManager {
  constructor() {
    this.browser = null;
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

      // Create initial page
      const page = await this.browser.newPage();
      
      // Set consistent viewport
      await page.setViewport({ width, height });
      
      // Override navigator.webdriver
      await page.evaluateOnNewDocument(() => {
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
      
      await page.setExtraHTTPHeaders(browserConfig.headers);
      await page.setUserAgent(browserConfig.userAgent);
      
      // Add random mouse movements and scrolling
      await this.addHumanBehavior(page);
      
      return page;
    }
  }

  async close() {
    if (this.browser) {
      await this.browser.close();
      this.browser = null;
    }
  }

  async handleProtection() {
    try {
      console.log('Handling protection page...');
      
      // Wait for Cloudflare challenge iframe or protection element
      await this.page.waitForFunction(() => {
        return document.querySelector('#challenge-running') !== null ||
               document.querySelector('#challenge-stage') !== null ||
               document.querySelector('[id^="px-captcha"]') !== null;
      }, { timeout: 10000 });

      console.log('Protection elements detected, waiting for verification...');
      
      // Wait for Cloudflare verification to complete
      await this.page.waitForFunction(() => {
        // Check if challenge is complete
        const challengeRunning = document.querySelector('#challenge-running');
        const challengeStage = document.querySelector('#challenge-stage');
        const pxCaptcha = document.querySelector('[id^="px-captcha"]');
        
        // Challenge is complete when these elements are gone
        return !challengeRunning && !challengeStage && !pxCaptcha;
      }, { timeout: 30000 });
      
      console.log('Verification complete, waiting for redirect...');
      
      // Wait for navigation after verification
      await this.page.waitForNavigation({
        waitUntil: 'networkidle0',
        timeout: 30000
      });
      
      console.log('Protection cleared');
      return true;
    } catch (error) {
      console.error('Error handling protection:', error.message);
      if (error.message.includes('timeout')) {
        console.log('Protection timeout - taking screenshot for debugging');
        try {
          const html = await this.page.content();
          console.log('Current page HTML:', html.substring(0, 500) + '...');
        } catch (e) {
          console.error('Failed to capture debug info:', e.message);
        }
      }
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
    return this.browser.pages().then(pages => pages[0]);
  }
}

module.exports = BrowserManager;