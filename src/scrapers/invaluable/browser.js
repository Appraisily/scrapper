const puppeteer = require('puppeteer-extra');
const StealthPlugin = require('puppeteer-extra-plugin-stealth');
const browserConfig = {
  args: [
    '--no-sandbox',
    '--disable-dev-shm-usage',
    '--disable-setuid-sandbox',
    '--disable-infobars',
    '--window-position=0,0',
    '--ignore-certifcate-errors',
    '--ignore-certifcate-errors-spki-list',
    '--font-render-hinting=medium',
    '--enable-features=NetworkService',
    '--disable-web-security',
    '--disable-features=IsolateOrigins,site-per-process',
    '--allow-running-insecure-content',
    '--disable-notifications',
    '--disable-popup-blocking',
    '--disable-blink-features=AutomationControlled',
    '--disable-browser-side-navigation'
  ],
  userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/121.0.0.0 Safari/537.36',
  headers: {
    'Accept-Language': 'en-US,en;q=0.9',
    'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,image/apng,*/*;q=0.8,application/signed-exchange;v=b3;q=0.7',
    'Cache-Control': 'no-cache',
    'Connection': 'keep-alive',
    'DNT': '1',
    'Pragma': 'no-cache',
    'Sec-Ch-Ua': '"Not A(Brand";v="99", "Google Chrome";v="121", "Chromium";v="121"',
    'Sec-Ch-Ua-Mobile': '?0',
    'Sec-Ch-Ua-Platform': '"Windows"',
    'Sec-Fetch-Dest': 'document',
    'Sec-Fetch-Mode': 'navigate',
    'Sec-Fetch-Site': 'none',
    'Sec-Fetch-User': '?1',
    'Upgrade-Insecure-Requests': '1'
  }
};

puppeteer.use(StealthPlugin());

class BrowserManager {
  constructor() {
    this.browser = null;
    this.pages = new Map();
  }

  // Add init method as an alias to initialize for compatibility with the category scraper
  async init() {
    return this.initialize();
  }

  async initialize() {
    if (!this.browser) {
      console.log('Initializing browser...');
      const width = 1920 + Math.floor(Math.random() * 100);
      const height = 1080 + Math.floor(Math.random() * 100);

      this.browser = await puppeteer.launch({
        headless: 'new',
        args: [
          ...browserConfig.args,
          `--window-size=${width},${height}`,
          '--enable-javascript',
          '--enable-features=NetworkService,NetworkServiceInProcess',
          '--disable-blink-features=AutomationControlled'
        ],
        ignoreHTTPSErrors: true,
        defaultViewport: {
          width,
          height,
          deviceScaleFactor: 1,
          hasTouch: false,
          isLandscape: true,
          isMobile: false
        }
      });

      this.page = await this.browser.newPage();
      
      // Set viewport with device scale factor for better rendering
      await this.page.setViewport({ 
        width,
        height,
        deviceScaleFactor: 1,
        hasTouch: false,
        isLandscape: true,
        isMobile: false
      });

      // Override navigator.webdriver
      await this.page.evaluateOnNewDocument(() => {
        Object.defineProperty(navigator, 'webdriver', {
          get: () => undefined
        });

        // Enable JavaScript features
        window.addEventListener = ((original) => {
          return function(type, listener, options) {
            if (type === 'load') {
              setTimeout(() => {
                listener.call(this);
              }, 500);
              return;
            }
            return original.call(this, type, listener, options);
          };
        })(window.addEventListener);
        
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
              0: { type: 'application/x-google-chrome-pdf' },
              description: 'Portable Document Format',
              filename: 'internal-pdf-viewer',
              length: 1,
              name: 'Chrome PDF Plugin'
            },
            {
              0: { type: 'application/pdf' },
              description: 'Portable Document Format',
              filename: 'internal-pdf-viewer',
              length: 1,
              name: 'Chrome PDF Viewer'
            },
            {
              0: { type: 'application/x-nacl' },
              description: 'Native Client',
              filename: 'internal-nacl-plugin',
              length: 1,
              name: 'Native Client'
            }
          ]
        });
        
        // Add WebGL support
        HTMLCanvasElement.prototype.getContext = ((original) => {
          return function(type, attributes) {
            if (type === 'webgl' || type === 'experimental-webgl') {
              attributes = Object.assign({}, attributes, {
                preserveDrawingBuffer: true
              });
            }
            return original.call(this, type, attributes);
          };
        })(HTMLCanvasElement.prototype.getContext);
      });
      
      await this.page.setExtraHTTPHeaders(browserConfig.headers);
      await this.page.setUserAgent(browserConfig.userAgent);
      
      // Store initial page
      this.pages.set('main', this.page);

      // Add additional browser features
      await this.page.evaluateOnNewDocument(() => {
        // Add WebRTC support
        window.RTCPeerConnection = class RTCPeerConnection {
          constructor() { }
          createDataChannel() { return {}; }
          createOffer() { return Promise.resolve({}); }
          setLocalDescription() { return Promise.resolve(); }
        };

        // Add media devices
        navigator.mediaDevices = {
          enumerateDevices: async () => []
        };

        // Add battery API
        navigator.getBattery = async () => ({
          charging: true,
          chargingTime: 0,
          dischargingTime: Infinity,
          level: 0.95
        });
      });
      
      // Add random mouse movements and scrolling
      await this.addHumanBehavior(this.page);

      // Add enhanced cloudflare evasion
      await this.page.evaluateOnNewDocument(() => {
        // Overwrite navigator properties to appear more human
        Object.defineProperty(navigator, 'webdriver', { get: () => undefined });
        Object.defineProperty(navigator, 'languages', { get: () => ['en-US', 'en'] });
        
        // Add fake timezone to match US
        Object.defineProperty(Intl, 'DateTimeFormat', {
          get: () => function(...args) {
            return {
              resolvedOptions: () => ({
                locale: 'en-US',
                timeZone: 'America/New_York'
              })
            };
          }
        });
        
        // Make fingerprinting more consistent
        const originalGetParameter = WebGLRenderingContext.prototype.getParameter;
        WebGLRenderingContext.prototype.getParameter = function(parameter) {
          // UNMASKED_VENDOR_WEBGL
          if (parameter === 37445) {
            return 'Google Inc. (Intel)';
          }
          // UNMASKED_RENDERER_WEBGL
          if (parameter === 37446) {
            return 'ANGLE (Intel, Intel(R) UHD Graphics Direct3D11 vs_5_0 ps_5_0, D3D11)';
          }
          return originalGetParameter.call(this, parameter);
        };
        
        // Override permissions
        const originalQuery = Permissions.prototype.query;
        Permissions.prototype.query = function(parameters) {
          return Promise.resolve({
            state: 'granted',
            onchange: null
          });
        };
      });
    }
  }

  async createTab(name) {
    if (this.pages.has(name)) {
      return this.pages.get(name);
    }

    const page = await this.browser.newPage();
    
    // Configure the new tab
    await page.setViewport({ 
      width: 1920 + Math.floor(Math.random() * 100),
      height: 1080 + Math.floor(Math.random() * 100),
      deviceScaleFactor: 1,
      hasTouch: false,
      isLandscape: true,
      isMobile: false
    });

    await page.setUserAgent(browserConfig.userAgent);
    await page.setExtraHTTPHeaders(browserConfig.headers);

    // Store the new tab
    this.pages.set(name, page);
    return page;
  }

  async closeTab(name) {
    const page = this.pages.get(name);
    if (page && name !== 'main') {
      await page.close();
      this.pages.delete(name);
    }
  }

  async close() {
    if (this.browser) {
      // Close all pages
      for (const [name, page] of this.pages) {
        await page.close();
      }
      this.pages.clear();
      
      await this.browser.close();
      this.browser = null;
    }
  }

  async handleProtection() {
    try {
      console.log('Handling protection page...');
      
      // Mejorado el manejo de Cloudflare
      const page = this.getPage();
      
      // Detectar si estamos en una página de protección de Cloudflare
      const cloudflareDetected = await page.evaluate(() => {
        return document.querySelector('#cf-error-details') !== null ||
               document.querySelector('.cf-error-code') !== null ||
               document.querySelector('#challenge-running') !== null ||
               document.querySelector('#challenge-form') !== null ||
               document.querySelector('title')?.innerText.includes('Attention Required') ||
               document.querySelector('title')?.innerText.includes('Cloudflare') ||
               document.body?.innerText.includes('checking your browser') ||
               document.body?.innerText.includes('Please turn JavaScript on');
      });
      
      if (!cloudflareDetected) {
        console.log('No se detectó página de protección de Cloudflare, continuando normalmente.');
        return true;
      }
      
      console.log('Detectada protección de Cloudflare, intentando bypass...');
      
      // Comportamiento más humano
      // Añadir movimientos aleatorios del ratón
      for (let i = 0; i < 5; i++) {
        await page.mouse.move(
          100 + Math.random() * 500,
          100 + Math.random() * 300,
          { steps: 25 }
        );
        await page.evaluate(ms => new Promise(r => setTimeout(r, ms)), 500 + Math.random() * 1000);
      }
      
      // Simular scrolling como un humano
      await page.evaluate(() => {
        return new Promise((resolve) => {
          let totalHeight = 0;
          const distance = 100;
          const timer = setInterval(() => {
            window.scrollBy(0, distance);
            totalHeight += distance;
            
            if (totalHeight >= 1000) {
              clearInterval(timer);
              setTimeout(resolve, 1000);
            }
          }, 100);
        });
      });
      
      // Esperar a que el desafío se resuelva potencialmente
      console.log('Esperando a que se resuelva el desafío de Cloudflare...');
      await page.evaluate(ms => new Promise(r => setTimeout(r, ms)), 10000);
      
      // Verificar si el desafío se ha resuelto
      const challengeResolved = await page.evaluate(() => {
        return document.querySelector('#challenge-running') === null &&
               document.querySelector('#challenge-form') === null &&
               !document.body?.innerText.includes('checking your browser');
      });
      
      if (challengeResolved) {
        console.log('¡Desafío de Cloudflare resuelto! Continuando...');
        
        // Extraer y guardar las cookies de Cloudflare para uso futuro
        const cookies = await page.cookies();
        const cfClearance = cookies.find(c => c.name === 'cf_clearance');
        if (cfClearance) {
          console.log('Cookie cf_clearance encontrada:', cfClearance.value);
        }
        
        return true;
      } else {
        console.log('No se pudo resolver el desafío de Cloudflare automáticamente.');
        return false;
      }
    } catch (error) {
      console.error('Error al manejar la protección:', error);
      return false;
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
    return this.pages.get('main');
  }
}

module.exports = BrowserManager;