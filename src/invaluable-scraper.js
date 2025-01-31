const puppeteer = require('puppeteer-extra');
const StealthPlugin = require('puppeteer-extra-plugin-stealth');
const storage = require('./utils/storage');
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
          '--window-size=1920,1080',
          '--disable-infobars',
          '--disable-notifications',
          '--disable-extensions',
          '--ignore-certificate-errors',
          '--no-first-run',
          '--disable-blink-features=AutomationControlled'
        ]
      });
      this.page = await this.browser.newPage();
      
      // Set a more realistic viewport
      await this.page.setViewport({ 
        width: 1920, 
        height: 1080,
        deviceScaleFactor: 1,
        hasTouch: false,
        isLandscape: true,
        isMobile: false
      });

      // Set more realistic user agent
      await this.page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36');

      // Add browser-like features
      await this.page.evaluateOnNewDocument(() => {
        // Override navigator properties
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
          // Add hardware concurrency
          hardwareConcurrency: { get: () => 8 },
          // Add device memory
          deviceMemory: { get: () => 8 },
          // Add connection info
          connection: { get: () => ({
            effectiveType: '4g',
            rtt: 50,
            downlink: 10,
            saveData: false
          })}
        });

        // Add WebGL support
        const getParameter = WebGLRenderingContext.prototype.getParameter;
        WebGLRenderingContext.prototype.getParameter = function(parameter) {
          // Spoof renderer info
          if (parameter === 37445) {
            return 'Intel Inc.';
          }
          if (parameter === 37446) {
            return 'Intel(R) Iris(TM) Graphics 6100';
          }
          return getParameter.apply(this, arguments);
        };

        // Add chrome object
        window.chrome = {
          runtime: {},
          loadTimes: () => {},
          csi: () => {},
          app: {
            isInstalled: false,
            getDetails: () => {},
            getIsInstalled: () => false,
            runningState: () => 'normal'
          }
        };

        // Add permissions API
        const originalQuery = window.navigator.permissions.query;
        window.navigator.permissions.query = (parameters) => (
          parameters.name === 'notifications' ?
            Promise.resolve({ state: Notification.permission }) :
            originalQuery(parameters)
        );
      });

      // Set extra headers
      await this.page.setExtraHTTPHeaders({
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8',
        'Accept-Language': 'en-US,en;q=0.9',
        'Accept-Encoding': 'gzip, deflate, br',
        'Connection': 'keep-alive',
        'Upgrade-Insecure-Requests': '1',
        'Sec-Fetch-Dest': 'document',
        'Sec-Fetch-Mode': 'navigate',
        'Sec-Fetch-Site': 'none',
        'Sec-Fetch-User': '?1',
        'sec-ch-ua': '"Not_A Brand";v="8", "Chromium";v="120", "Google Chrome";v="120"',
        'sec-ch-ua-mobile': '?0',
        'sec-ch-ua-platform': '"Windows"'
      });
    }
  }

  async login(email, password) {
    try {
      if (this.isLoggedIn) {
        console.log('[Login] Already logged in, skipping login process');
        return true;
      }

      console.log('[Login] Step 1: Navigating to login page');
      await this.page.goto('https://www.invaluable.com/login', { 
        waitUntil: ['networkidle0', 'domcontentloaded'],
        timeout: 60000
      });
      
      console.log('[Login] Step 2: Waiting for initial page load');
      // Wait for scripts to load
      await this.page.waitForTimeout(2000);

      // Save initial page HTML
      const initialHtml = await this.page.content();
      await saveHtmlToFile(initialHtml, 'invaluable-login');
      
      console.log('[Login] Step 3: Checking for cookie consent dialog');
      // Handle cookie consent if present
      try {
        const cookieConsentFrame = await this.page.$('iframe[id^="CybotCookiebotDialog"]');
        if (cookieConsentFrame) {
          console.log('[Login] Step 3a: Cookie consent dialog found, accepting');
          const frame = await cookieConsentFrame.contentFrame();
          await frame.click('#CybotCookiebotDialogBodyButtonAccept');
          console.log('[Login] Step 3b: Cookie consent accepted');
        }
      } catch (error) {
        console.log('[Login] Step 3c: No cookie consent dialog found or already accepted');
      }

      // Add random mouse movements
      await this.page.mouse.move(
        200 + Math.random() * 100,
        150 + Math.random() * 100,
        { steps: 10 }
      );

      // Wait for the page to stabilize after cookie consent
      await this.page.waitForTimeout(1000);

      // Ensure we're on the login page
      const currentUrl = await this.page.url();
      if (!currentUrl.includes('/login')) {
        console.log('[Login] Step 4a: Not on login page, redirecting');
        await this.page.goto('https://www.invaluable.com/login', {
          waitUntil: 'networkidle0'
        });
      }

      console.log('[Login] Step 5: Waiting for login form elements');
      // Wait for the login form elements to be truly ready
      await this.page.waitForFunction(() => {
        const form = document.querySelector('#login-form');
        if (!form || window.getComputedStyle(form).display === 'none') return false;
        
        // Ensure we're using the login form fields, not the new account form
        const emailInput = form.querySelector('input[name="emailLogin"]');
        const passwordInput = form.querySelector('input[name="password"]');
        const submitButton = form.querySelector('#signInBtn');
        
        return emailInput && passwordInput && submitButton &&
               window.getComputedStyle(emailInput).display !== 'none' &&
               window.getComputedStyle(submitButton).display !== 'none';
      }, { timeout: 30000 }).then(() => {
        console.log('[Login] Step 5a: Login form elements found and visible');
      });

      console.log('[Login] Step 6: Clearing existing form values');
      // Clear any existing values
      await this.page.evaluate(() => {
        const form = document.querySelector('#login-form');
        const emailInput = form.querySelector('input[name="emailLogin"]');
        const passwordInput = form.querySelector('input[name="password"]');
        if (emailInput) emailInput.value = '';
        if (passwordInput) passwordInput.value = '';
      });

      // Add some natural scrolling
      await this.page.evaluate(() => {
        window.scrollBy({
          top: 100,
          behavior: 'smooth'
        });
      });
      await this.page.waitForTimeout(500);

      console.log('[Login] Step 7: Entering credentials');
      // Type credentials with human-like delays
      await this.page.type('input[name="emailLogin"]', email, { delay: 150 });
      console.log('[Login] Step 7a: Email entered');
      await this.page.waitForTimeout(500);
      await this.page.type('input[name="password"]', password, { delay: 150 });
      console.log('[Login] Step 7b: Password entered');
      await this.page.waitForTimeout(1000);

      // Move mouse to submit button area
      await this.page.mouse.move(
        300 + Math.random() * 50,
        400 + Math.random() * 50,
        { steps: 10 }
      );

      console.log('[Login] Step 8: Locating submit button');
      // Get the form and button
      const form = await this.page.$('#login-form');
      const submitButton = await form.$('#signInBtn');
      
      if (!submitButton) {
        throw new Error('Login submit button not found');
      }
      console.log('[Login] Step 8a: Submit button found');

      console.log('[Login] Step 9: Submitting form and waiting for navigation');
      
      try {
        // Submit the form directly instead of clicking the button
        await Promise.all([
          this.page.waitForNavigation({
            waitUntil: ['domcontentloaded', 'networkidle0'],
            timeout: 30000
          }),
          form.evaluate(form => form.submit())
        ]);
      } catch (error) {
        console.log('[Login] Navigation error:', error.message);
        
        // Check if we're still on the login page
        const currentUrl = await this.page.url();
        if (currentUrl.includes('/login')) {
          // Try clicking the button as fallback
          await submitButton.click();
          await this.page.waitForNavigation({
            waitUntil: ['domcontentloaded', 'networkidle0'],
            timeout: 30000
          });
        }
      }

      console.log('[Login] Step 10: Verifying login success');
      // Verify login success by checking for account-specific elements
      const isLoggedIn = await this.page.evaluate(() => {
        return !document.querySelector('.error-message') && 
               !document.querySelector('#loginError') &&
               (document.querySelector('.account-menu') !== null ||
                document.querySelector('.user-profile') !== null ||
                document.querySelector('.logout-link') !== null);
      });

      if (!isLoggedIn) {
        console.log('[Login] Step 10a: Login verification failed, checking for error messages');
        // Get any error message
        const errorMessage = await this.page.evaluate(() => {
          const errorEl = document.querySelector('.error-message, #loginError, .alert-danger');
          return errorEl ? errorEl.textContent.trim() : 'Login verification failed';
        });

        // Take screenshot and save to Cloud Storage
        const screenshot = await this.page.screenshot();
        const url = await storage.saveScreenshot(screenshot, 'invaluable-login-error');
        if (url) {
          console.log('[Login] Error screenshot saved:', url);
        }

        // Save the error page HTML
        const errorHtml = await this.page.content();
        await saveHtmlToFile(errorHtml, 'invaluable-login-error');
        
        throw new Error(errorMessage);
      }
      
      console.log('[Login] Step 10b: Login successful');
      this.isLoggedIn = true;
      return true;

    } catch (error) {
      console.error('[Login] Error during login process:', error.message);
      console.error('Current URL:', await this.page.url());
      
      // Take screenshot and save to Cloud Storage
      try {
        const screenshot = await this.page.screenshot();
        const url = await storage.saveScreenshot(screenshot, 'invaluable-login-error');
        if (url) {
          console.log('[Login] Error screenshot saved:', url);
        }
        
        // Log the current page content
        const content = await this.page.content();
        console.log('[Login] Page content at error:', content.substring(0, 1000));
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
        await this.login('ratonxi@gmail.com', 'Worthpoint8');
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