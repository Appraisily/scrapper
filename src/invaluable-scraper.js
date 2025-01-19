const puppeteer = require('puppeteer-extra');
const StealthPlugin = require('puppeteer-extra-plugin-stealth');
puppeteer.use(StealthPlugin());

class InvaluableScraper {
  constructor() {
    this.browser = null;
    this.page = null;
    this.isLoggedIn = false;
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

  async login(email, password) {
    try {
      if (this.isLoggedIn) {
        console.log('Already logged in, skipping login');
        return true;
      }

      console.log('Navigating to Invaluable login page...');
      await this.page.goto('https://www.invaluable.com/login', { 
        waitUntil: 'networkidle0',
        timeout: 60000 
      });
      
      // Wait for login form with increased timeout
      console.log('Waiting for login form...');
      await this.page.waitForSelector('input[type="email"], #emailLoginPage, input[name="email"]', { 
        timeout: 30000,
        visible: true 
      });
      console.log('Login form found');
      
      // Type credentials
      const emailSelector = await this.page.evaluate(() => {
        const selectors = ['#emailLoginPage', 'input[type="email"]', 'input[name="email"]'];
        for (const selector of selectors) {
          if (document.querySelector(selector)) {
            return selector;
          }
        }
        return null;
      });

      const passwordSelector = await this.page.evaluate(() => {
        const selectors = ['#passwordLogin', 'input[type="password"]', 'input[name="password"]'];
        for (const selector of selectors) {
          if (document.querySelector(selector)) {
            return selector;
          }
        }
        return null;
      });

      if (!emailSelector || !passwordSelector) {
        throw new Error('Login form elements not found');
      }

      console.log('Entering credentials...');
      await this.page.type(emailSelector, email);
      await this.page.type(passwordSelector, password);
      
      // Look for submit button with multiple possible selectors
      const submitButton = await this.page.evaluate(() => {
        const selectors = [
          'button[type="submit"]',
          'input[type="submit"]',
          'button.login-button',
          'button:contains("Sign In")',
          'button:contains("Log In")',
          'input[value="Sign In"]',
          'input[value="Log In"]'
        ];
        
        for (const selector of selectors) {
          const button = document.querySelector(selector);
          if (button) {
            return selector;
          }
        }
        return null;
      });

      if (!submitButton) {
        console.error('Available elements on page:', await this.page.evaluate(() => {
          return {
            buttons: Array.from(document.querySelectorAll('button')).map(b => ({
              type: b.type,
              text: b.textContent.trim(),
              class: b.className
            })),
            forms: Array.from(document.querySelectorAll('form')).length
          };
        }));
        throw new Error('Login submit button not found');
      }
      
      console.log('Submitting login form...');
      await Promise.all([
        this.page.waitForNavigation({ waitUntil: 'networkidle0' }),
        this.page.click(submitButton)
      ]);
      
      // Verify login success
      const loginError = await this.page.$('.error-message, #loginError:not([hidden]), .alert-danger');
      if (loginError) {
        const errorText = await this.page.evaluate(el => el.textContent, loginError);
        throw new Error(`Login failed: ${errorText}`);
      }
      
      this.isLoggedIn = true;
      console.log('Successfully logged in to Invaluable');
      return true;

    } catch (error) {
      console.error('Invaluable login error:', error.message);
      console.error('Current URL:', await this.page.url());
      
      // Take screenshot for debugging
      try {
        await this.page.screenshot({ path: '/tmp/invaluable-login-error.png' });
        console.log('Error screenshot saved to /tmp/invaluable-login-error.png');
      } catch (screenshotError) {
        console.error('Failed to save error screenshot:', screenshotError.message);
      }
      
      throw error;
    }
  }

  async searchItems(params = {}) {
    try {
      await this.initialize();
      
      // Login before searching
      if (!this.isLoggedIn) {
        await this.login('info@appraisily.com', 'Invaluable8!');
      }
      
      // Construct the URL with parameters
      const searchUrl = new URL('https://www.invaluable.com/search');
      searchUrl.searchParams.set('currencyCode', params.currency || 'USD');
      searchUrl.searchParams.set('priceResult[min]', params.minPrice || '250');
      searchUrl.searchParams.set('upcoming', params.upcoming || 'false');
      searchUrl.searchParams.set('query', params.query || 'fine art');
      searchUrl.searchParams.set('keyword', params.keyword || 'fine art');
      
      console.log('Navigating to:', searchUrl.toString());
      await this.page.goto(searchUrl.toString(), { waitUntil: 'networkidle0' });
      
      // Wait for search results to load
      await this.page.waitForSelector('.lot-search-result', { timeout: 30000 });
      
      // Scroll to load more items
      await this.autoScroll();
      
      // Extract item data
      const items = await this.page.evaluate(() => {
        const results = Array.from(document.querySelectorAll('.lot-search-result'));
        return results.map(item => {
          const titleEl = item.querySelector('.lot-title-text');
          const priceEl = item.querySelector('.lot-price');
          const dateEl = item.querySelector('.lot-time-remaining');
          const imageEl = item.querySelector('.lot-image img');
          const auctionHouseEl = item.querySelector('.auction-house-name');
          const lotNumberEl = item.querySelector('.lot-number-text');
          const estimateEl = item.querySelector('.lot-estimate');
          const locationEl = item.querySelector('.auction-house-location');
          
          return {
            title: titleEl ? titleEl.textContent.trim() : '',
            price: priceEl ? priceEl.textContent.trim() : '',
            date: dateEl ? dateEl.textContent.trim() : '',
            imageUrl: imageEl ? imageEl.getAttribute('src') : '',
            auctionHouse: auctionHouseEl ? auctionHouseEl.textContent.trim() : '',
            lotNumber: lotNumberEl ? lotNumberEl.textContent.trim() : '',
            estimate: estimateEl ? estimateEl.textContent.trim() : '',
            location: locationEl ? locationEl.textContent.trim() : '',
            source: 'invaluable'
          };
        });
      });
      
      console.log(`Found ${items.length} items`);
      return items;
      
    } catch (error) {
      console.error('Invaluable search error:', error);
      throw error;
    }
  }
  
  async autoScroll() {
    await this.page.evaluate(async () => {
      await new Promise((resolve) => {
        let totalHeight = 0;
        const distance = 100;
        const timer = setInterval(() => {
          const scrollHeight = document.documentElement.scrollHeight;
          window.scrollBy(0, distance);
          totalHeight += distance;
          
          if (totalHeight >= scrollHeight) {
            clearInterval(timer);
            resolve();
          }
        }, 100);
      });
    });
    
    // Wait a bit for any lazy-loaded content
    await this.page.waitForTimeout(2000);
  }

  async close() {
    if (this.browser) {
      await this.browser.close();
      this.browser = null;
      this.page = null;
    }
  }
}

module.exports = InvaluableScraper;