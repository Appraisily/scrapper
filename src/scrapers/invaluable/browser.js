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
      this.browser = await puppeteer.launch({
        headless: 'new',
        args: browserConfig.args
      });
      this.page = await this.browser.newPage();
      await this.page.setViewport(browserConfig.defaultViewport);
      await this.page.setUserAgent(browserConfig.userAgent);
      await this.page.setExtraHTTPHeaders(browserConfig.headers);
      
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

  getPage() {
    return this.page;
  }
}

module.exports = BrowserManager;