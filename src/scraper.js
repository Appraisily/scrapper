const puppeteer = require('puppeteer-extra');
const StealthPlugin = require('puppeteer-extra-plugin-stealth');
const { saveHtmlToFile } = require('./utils/drive-logger');
// Configure plugins
puppeteer.use(StealthPlugin());

class WorthpointScraper {
  constructor() {
    this.browser = null;
    this.page = null;
  }

  async initialize() {
    console.log('Initializing browser...');
    // Add flags to block unnecessary resources
    const flags = [
      '--enable-font-antialiasing',
      '--font-render-hinting=medium',
      '--window-size=1920,1080',
      // Disable automation flags
      '--disable-blink-features=AutomationControlled',
      '--disable-blink-features=AutomationControlledInHeadless',
      // Memory optimization
      '--no-sandbox',
      '--disable-setuid-sandbox',
      '--disable-dev-shm-usage',
      // Performance flags
      '--no-first-run',
      '--no-zygote',
      '--single-process',
      '--disable-features=IsolateOrigins,site-per-process',
      '--enable-features=NetworkService,NetworkServiceInProcess',
      '--force-color-profile=srgb',
      '--metrics-recording-only',
      '--password-store=basic',
      // Block unnecessary resource types
      '--disable-javascript-harmony-shipping',
      '--disable-site-isolation-trials',
      // Resource optimization
      '--disable-features=IsolateOrigins,site-per-process,site-per-process-strict,CrossSiteDocumentBlockingIfIsolating',
      '--disable-web-security',
      '--disable-features=ScriptStreaming',
      // Block unnecessary resources
      '--block-new-web-contents',
      '--disable-popup-blocking'
    ];

    this.browser = await puppeteer.launch({
      headless: 'new',
      ignoreHTTPSErrors: true,
      args: flags
    });
    console.log('Browser launched successfully');
    this.page = await this.browser.newPage();
    
    await this.page.setViewport({
      width: 1920,
      height: 1080,
      deviceScaleFactor: 1
    });
    
    // Block unnecessary resource types
    await this.page.setRequestInterception(true);
    this.page.on('request', (request) => {
      const resourceType = request.resourceType();
      const url = request.url();
      
      // Block known analytics and protection scripts
      if (url.includes('google-analytics') || 
          url.includes('doubleclick') ||
          url.includes('facebook') ||
          url.includes('perimeterx') ||
          url.includes('cookieyes') ||
          url.includes('profitwell')) {
        request.abort();
        return;
      }
      
      // Only allow essential resources
      if (['document', 'xhr', 'fetch', 'script'].includes(resourceType)) {
        request.continue();
      } else {
        request.abort();
      }
    });

    await this.page.evaluateOnNewDocument(() => {
      // Override navigator.webdriver
      Object.defineProperty(navigator, 'webdriver', {
        get: () => false,
        configurable: true
      });
      
      // Add more browser features
      Object.defineProperty(navigator, 'languages', {
        get: () => ['en-US', 'en']
      });
      
      // Add plugins
      Object.defineProperty(navigator, 'plugins', {
        get: () => [
          {
            0: { type: 'application/x-google-chrome-pdf' },
            description: 'Portable Document Format',
            filename: 'internal-pdf-viewer',
            length: 1,
            name: 'Chrome PDF Plugin'
          }
        ]
      });
      
      // Hide automation
      const originalQuery = window.navigator.permissions.query;
      window.navigator.permissions.query = (parameters) => (
        parameters.name === 'notifications' ?
          Promise.resolve({ state: Notification.permission }) :
          originalQuery(parameters)
      );
      
      // Add hardware concurrency and memory info
      Object.defineProperty(navigator, 'hardwareConcurrency', {
        get: () => 8
      });
      Object.defineProperty(navigator, 'deviceMemory', {
        get: () => 8
      });
      
      // Add canvas fingerprint
      const getContext = HTMLCanvasElement.prototype.getContext;
      HTMLCanvasElement.prototype.getContext = function(contextType) {
        const context = getContext.apply(this, arguments);
        if (contextType === '2d') {
          const oldGetImageData = context.getImageData;
          context.getImageData = function() {
            const imageData = oldGetImageData.apply(this, arguments);
            return imageData;
          };
        }
        return context;
      };

      // Add audio context
      const audioContext = window.AudioContext || window.webkitAudioContext;
      if (audioContext) {
        const origCreateOscillator = audioContext.prototype.createOscillator;
        audioContext.prototype.createOscillator = function() {
          const oscillator = origCreateOscillator.apply(this, arguments);
          oscillator.frequency.value = 440; // Standard A note
          return oscillator;
        };
      }
    });

    await this.page.setViewport({ width: 1920, height: 1080 });
    
    // Rotate between different user agents
    const userAgents = [
      'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
      'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
      'Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:109.0) Gecko/20100101 Firefox/121.0'
    ];
    await this.page.setUserAgent(userAgents[Math.floor(Math.random() * userAgents.length)]);
    
    // Enhanced headers to look more like a real browser
    await this.page.setExtraHTTPHeaders({
      'Accept-Language': 'en-US,en;q=0.9',
      'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8',
      'Cache-Control': 'max-age=0',
      'Connection': 'keep-alive',
      'DNT': '1',
      'sec-ch-ua': '"Not_A_Brand";v="8", "Chromium";v="120", "Google Chrome";v="120"',
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
      console.log('[Login] Navigating to login page...');
      await this.page.goto('https://www.worthpoint.com/app/login/auth', {
        waitUntil: 'networkidle0',
        timeout: 30000
      });

      // Check for protection page
      const html = await this.page.content();
      if (html.includes('Access to this page has been denied')) {
        console.log('[Login] Protection page detected, handling...');
        await this.handleProtection();
        await this.page.goto('https://www.worthpoint.com/app/login/auth', {
          waitUntil: 'networkidle0'
        });
      }

      // Wait for login form
      await this.page.waitForSelector('input[name="j_username"]');
      await this.page.waitForSelector('input[name="j_password"]');

      // Fill in credentials
      await this.page.type('input[name="j_username"]', username, { delay: 100 });
      await this.page.type('input[name="j_password"]', password, { delay: 100 });

      // Submit form
      await Promise.all([
        this.page.waitForNavigation({ waitUntil: 'networkidle0' }),
        this.page.click('button[type="submit"]')
      ]);

      // Verify login success
      const currentUrl = await this.page.url();
      if (currentUrl.includes('/login')) {
        throw new Error('Login failed - still on login page');
      }

      console.log('[Login] Successfully logged in');
      return true;
    } catch (error) {
      console.error('[Login] Error:', error);
      throw error;
    }
  }

  async scrapeSearchResults(searchUrl) {
    try {
      console.log('[Search] Navigating to search URL...');
      await this.page.goto(searchUrl, { waitUntil: 'networkidle0' });

      // Wait for results to load
      await this.page.waitForSelector('.search-results-item');

      // Extract data
      const results = await this.page.evaluate(() => {
        const items = Array.from(document.querySelectorAll('.search-results-item'));
        return items.map(item => ({
          title: item.querySelector('.item-title')?.textContent?.trim() || '',
          price: item.querySelector('.price')?.textContent?.trim() || '',
          date: item.querySelector('.sale-date')?.textContent?.trim() || '',
          source: item.querySelector('.source')?.textContent?.trim() || '',
          image: item.querySelector('img')?.src || ''
        }));
      });

      console.log(`[Search] Found ${results.length} results`);
      return results;
    } catch (error) {
      console.error('[Search] Error:', error);
      throw error;
    }
  }

  async handleProtection() {
    try {
      console.log('[Protection] Handling protection page...');
      
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
        return !document.querySelector('#px-captcha') && 
               !document.querySelector('.px-block');
      }, { timeout: 30000 });
      
      console.log('[Protection] Protection cleared');
      return true;
    } catch (error) {
      console.error('[Protection] Error:', error);
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

module.exports = WorthpointScraper;