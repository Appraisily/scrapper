const puppeteer = require('puppeteer-extra');
const StealthPlugin = require('puppeteer-extra-plugin-stealth');
puppeteer.use(StealthPlugin());

class WorthpointScraper {
  constructor() {
    this.browser = null;
    this.page = null;
  }

  async initialize() {
    console.log('Initializing browser...');
    // Configure Chrome flags for better stealth
    const flags = [
      '--enable-font-antialiasing',
      '--font-render-hinting=medium',
      '--window-size=1920,1080',
      '--no-sandbox',
      '--disable-setuid-sandbox',
      '--disable-dev-shm-usage',
      '--disable-gpu',
      '--disable-infobars',
      '--disable-notifications',
      '--disable-blink-features=AutomationControlled',
      '--disable-web-security',
      '--ignore-certificate-errors'
    ];

    this.browser = await puppeteer.launch({
      headless: 'new',
      args: flags
    });
    console.log('Browser launched successfully');
    this.page = await this.browser.newPage();
    
    // Override navigator.webdriver
    await this.page.evaluateOnNewDocument(() => {
      delete Object.getPrototypeOf(navigator).webdriver;
      
      // Add more sophisticated browser APIs
      window.Notification = class Notification {
        static permission = 'default';
        static requestPermission() {
          return Promise.resolve('default');
        }
      };

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

      // Add Font loading API
      window.FontFace = class FontFace {
        constructor(family, source, descriptors) {
          this.family = family;
          this.source = source;
          this.descriptors = descriptors;
          this.status = 'loaded';
        }
        load() {
          return Promise.resolve(this);
        }
      };
      
      // Overwrite the languages with only English
      Object.defineProperty(navigator, 'languages', {
        get: () => ['en-US', 'en']
      });
      
      // Add common browser functions
      window.chrome = {
        runtime: {},
        loadTimes: () => {},
        csi: () => ({
          startE: Date.now(),
          onloadT: Date.now() + 100,
          pageT: Date.now() + 200,
          tran: 15
        }),
        app: {
          isInstalled: false,
          getDetails: () => {},
          getIsInstalled: () => false,
          runningState: () => 'normal'
        },
        webstore: {
          onInstallStageChanged: {},
          onDownloadProgress: {}
        }
      };
      
      // Add plugins
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
      
      // Add media devices
      if (navigator.mediaDevices) {
        const enumerateDevices = navigator.mediaDevices.enumerateDevices;
        navigator.mediaDevices.enumerateDevices = function() {
          return enumerateDevices.apply(this, arguments)
            .then(devices => {
              return devices.length ? devices : [
                {deviceId: 'default', kind: 'audioinput', label: '', groupId: 'default'},
                {deviceId: 'default', kind: 'audiooutput', label: '', groupId: 'default'},
                {deviceId: 'default', kind: 'videoinput', label: '', groupId: 'default'}
              ];
            });
        };
      }
    });

    await this.page.setViewport({ width: 1920, height: 1080 });
    await this.page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36');
    
    // Enhanced headers to look more like a real browser
    await this.page.setExtraHTTPHeaders({
      'Accept-Language': 'en-US,en;q=0.9',
      'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8,application/signed-exchange;v=b3;q=0.7',
      'sec-ch-ua': '"Not_A Brand";v="8", "Chromium";v="120", "Google Chrome";v="120"',
      'sec-ch-ua-mobile': '?0',
      'sec-ch-ua-platform': '"Windows"',
      'sec-fetch-dest': 'document',
      'sec-fetch-mode': 'navigate',
      'sec-fetch-site': 'none',
      'sec-fetch-user': '?1',
      'upgrade-insecure-requests': '1'
    });

    // Enable JavaScript and cookies
    await this.page.setJavaScriptEnabled(true);
    
    console.log('Browser configuration completed');
  }

  async login(username, password) {
    try {
      // Add random delay before navigation
      await this.randomDelay();
      
      await this.page.goto('https://www.worthpoint.com/login', {
        waitUntil: 'networkidle0',
        timeout: 30000
      });
      
      // Wait for any potential CAPTCHA or protection challenges
      await this.handleProtection();
      
      // Log the current URL and HTML content
      const currentUrl = await this.page.url();
      console.log('Current URL:', currentUrl);
      
      const pageContent = await this.page.content();
      console.log('Page HTML:', pageContent);
      
      console.log('Waiting for login form...');
      
      // Wait for login form and fill credentials
      await this.page.waitForSelector('input[name="email"]');
      await this.page.type('input[name="email"]', username);
      await this.page.waitForSelector('input[name="password"]');
      await this.page.type('input[name="password"]', password);
      
      // Click login button
      const submitButton = await this.page.waitForSelector('button[type="submit"]');
      await Promise.all([
        this.page.waitForNavigation(),
        submitButton.click()
      ]);

      // Verify login success
      const isLoggedIn = await this.verifyLogin();
      if (!isLoggedIn) {
        throw new Error('Login failed - unable to verify login status');
      }
      
      console.log('Successfully logged in');
      return true;
    } catch (error) {
      console.error('Login failed:', error);
      throw error;
    }
  }

  async handleProtection() {
    try {
      // Check for PerimeterX challenge
      const isPxChallenge = await this.page.evaluate(async () => {
        const pxCaptcha = document.querySelector('#px-captcha');
        const pxBlock = document.querySelector('.px-block');
        
        // Simulate natural scrolling
        const scrollAmount = Math.floor(Math.random() * 100) + 50;
        window.scrollBy({ 
          top: scrollAmount, 
          behavior: 'smooth' 
        });
        await new Promise(r => setTimeout(r, 500));
        window.scrollBy({ 
          top: -scrollAmount, 
          behavior: 'smooth' 
        });
        
        return pxCaptcha !== null || pxBlock !== null;
      });

      if (isPxChallenge) {
        console.log('PerimeterX challenge detected, waiting for resolution...');
        
        // Multiple interactions with random delays
        for (let i = 0; i < 3; i++) {
          await this.randomDelay(1500, 3000);
          
          await this.page.evaluate(() => {
            // Simulate more complex mouse behavior
            const events = ['mousemove', 'mousedown', 'mouseup'];
            events.forEach(eventType => {
              const event = new MouseEvent(eventType, {
                bubbles: true,
                cancelable: true,
                clientX: Math.floor(Math.random() * window.innerWidth),
                clientY: Math.floor(Math.random() * window.innerHeight),
                buttons: eventType === 'mousedown' ? 1 : 0
              });
              document.dispatchEvent(event);
            });
            
            // Simulate keyboard events
            if (Math.random() > 0.7) {
              const keyEvent = new KeyboardEvent('keydown', {
                key: 'Tab',
                code: 'Tab',
                keyCode: 9,
                which: 9,
                bubbles: true
              });
              document.dispatchEvent(keyEvent);
            }
          });
        }
        
        await this.page.evaluate(() => {
          // Try to trigger any pending callbacks
          if (window._pxAppId) {
            document.cookie = `_px${window._pxAppId}=; path=/;`;
            // Add common PerimeterX cookies
            document.cookie = `_pxvid=${Math.random().toString(36).substring(2)}; path=/`;
            document.cookie = `_px3=${Math.random().toString(36).substring(2)}; path=/`;
          }
        });
        
        // Wait for challenge to clear
        await this.page.waitForFunction(
          () => !document.querySelector('#px-captcha') && !document.querySelector('.px-block'),
          { timeout: 30000 }
        );
      }
    } catch (error) {
      console.log('Protection handling error:', error.message);
    }
  }

  async randomDelay(min = 1000, max = 3000) {
    const delay = Math.floor(Math.random() * (max - min + 1) + min);
    await new Promise(resolve => setTimeout(resolve, delay));

    await this.page.evaluate(() => {
      // More natural mouse movement patterns
      const moves = Math.floor(Math.random() * 5) + 3;
      let lastX = 0, lastY = 0;
      
      for (let i = 0; i < moves; i++) {
        // Create smoother mouse movements
        const targetX = Math.floor(Math.random() * window.innerWidth);
        const targetY = Math.floor(Math.random() * window.innerHeight);
        
        // Interpolate between points
        const steps = Math.floor(Math.random() * 5) + 3;
        for (let j = 0; j < steps; j++) {
          const ratio = j / steps;
          const x = Math.floor(lastX + (targetX - lastX) * ratio);
          const y = Math.floor(lastY + (targetY - lastY) * ratio);
          
          const event = new MouseEvent('mousemove', {
            bubbles: true,
            cancelable: true,
            clientX: x,
            clientY: y,
            movementX: x - lastX,
            movementY: y - lastY
          });
          document.dispatchEvent(event);
        }
        
        lastX = targetX;
        lastY = targetY;
      }
    });
  }

  async verifyLogin() {
    try {
      // Wait for an element that only appears when logged in
      const currentUrl = await this.page.url();
      console.log('Verification URL:', currentUrl);
      
      const pageContent = await this.page.content();
      console.log('Verification Page HTML:', pageContent);
      
      await this.page.waitForSelector('.user-menu', { timeout: 5000 });
      
      // Also verify we're not still on the login page
      if (currentUrl.includes('/login')) {
        return false;
      }
      
      return true;
    } catch (error) {
      console.log('Login verification failed:', error.message);
      return false;
    }
  }

  async scrapeSearchResults(url) {
    try {
      console.log('Navigating to search results...');
      await this.page.goto(url);
      
      // Wait for search results container to load
      await this.page.waitForSelector('.thumbnails.search-results', { timeout: 10000 });

      // Extract data from all items on the page
      const items = await this.page.evaluate(() => {
        const results = [];
        const itemElements = document.querySelectorAll('.thumbnails.search-results .search-result.grid');
        
        itemElements.forEach(item => {
          // Get the title from the product-title span
          const titleElement = item.querySelector('.product-title');
          const title = titleElement ? titleElement.textContent.trim() : '';

          // Get the price from the price div
          const priceElement = item.querySelector('.price .result');
          const price = priceElement ? priceElement.textContent.trim() : '';

          // Get the date from the sold-date div
          const dateElement = item.querySelector('.sold-date .result');
          const date = dateElement ? dateElement.textContent.trim() : '';

          // Get the source from the source div
          const sourceElement = item.querySelector('.source .result');
          const source = sourceElement ? sourceElement.textContent.trim() : '';

          // Get the image URL from the img tag
          const imageElement = item.querySelector('.image-container');
          const image = imageElement ? imageElement.getAttribute('src') : '';

          results.push({
            title,
            price,
            date,
            source,
            image
          });
        });

        return results;
      });

      return items;
    } catch (error) {
      console.error('Failed to scrape search results:', error);
      throw error;
    }
  }

  async scrapeItem(url) {
    try {
      await this.page.goto(url);
      
      // Wait for the main content to load
      await this.page.waitForSelector('.item-details');

      // Extract data (adjust selectors as needed)
      const data = await this.page.evaluate(() => {
        return {
          title: document.querySelector('.item-title')?.textContent?.trim(),
          price: document.querySelector('.price-value')?.textContent?.trim(),
          description: document.querySelector('.item-description')?.textContent?.trim(),
          // Add more fields as needed
        };
      });

      return data;
    } catch (error) {
      console.error('Failed to scrape item:', error);
      throw error;
    }
  }

  async close() {
    if (this.browser) {
      await this.browser.close();
    }
  }
}

module.exports = WorthpointScraper;