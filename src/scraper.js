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

    // Override navigator.webdriver
    await this.page.evaluateOnNewDocument(() => {
      // More sophisticated webdriver override
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
      HTMLCanvasElement.prototype.getContext = function(contextType, contextAttributes) {
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
      
      // Add more sophisticated browser features
      Object.defineProperty(navigator, 'connection', {
        get: () => ({
          effectiveType: '4g',
          rtt: 50,
          downlink: 10,
          saveData: false
        })
      });
      
      // Add battery API
      navigator.getBattery = () => 
        Promise.resolve({
          charging: true,
          chargingTime: 0,
          dischargingTime: Infinity,
          level: 0.93
        });

      // Add performance timing
      if (!window.performance) {
        window.performance = {
          memory: {
            jsHeapSizeLimit: 2172649472,
            totalJSHeapSize: 2172649472,
            usedJSHeapSize: 2172649472
          },
          timeOrigin: Date.now(),
          timing: {
            navigationStart: Date.now(),
            loadEventEnd: Date.now() + 500
          }
        };
      }
      
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
      'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8,application/signed-exchange;v=b3;q=0.7',
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

  async handleProtection() {
    try {
      console.log('[Protection] Step 1: Analyzing protection page...');
      
      // First request to get the challenge
      const response = await this.page.goto('https://www.worthpoint.com/app/login/auth', {
        headers: {
          'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8',
          'Accept-Language': 'en-US,en;q=0.9',
          'Cache-Control': 'no-cache',
          'Sec-Ch-Ua': '"Not_A Brand";v="8", "Chromium";v="120", "Google Chrome";v="120"',
          'Sec-Ch-Ua-Mobile': '?0',
          'Sec-Ch-Ua-Platform': '"Windows"',
          'Sec-Fetch-Dest': 'document',
          'Sec-Fetch-Mode': 'navigate',
          'Sec-Fetch-Site': 'none',
          'Sec-Fetch-User': '?1',
          'Upgrade-Insecure-Requests': '1'
        }
      });
      
      const html = await response.text();
      const cookies = response.headers()['set-cookie'] || [];
      
      // Extract PX parameters
      const pxAppIdMatch = html.match(/PX([a-zA-Z0-9]+)/);
      const pxAppId = pxAppIdMatch ? pxAppIdMatch[1] : null;
      
      if (!pxAppId) {
        throw new Error('Could not find PX App ID');
      }
      
      console.log('[Protection] Step 2: Found PX App ID:', pxAppId);
      
      // Generate client-specific data
      const clientData = {
        uuid: Math.random().toString(36).substring(2),
        userAgent: await this.page.evaluate(() => navigator.userAgent),
        timeStamp: Date.now(),
        screenRes: '1920x1080',
        devicePixelRatio: 1,
        language: 'en-US',
        platform: 'Win32',
        touch: false
      };
      
      // Send client data
      const challengeResponse = await this.page.evaluate(async (data) => {
        const response = await fetch('/lIUjcOwl/api/v1/collector', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            appId: data.pxAppId,
            tag: 'v8.0.2',
            uuid: data.clientData.uuid,
            cs: data.clientData.screenRes,
            ...data.clientData
          })
        });
        return response.json();
      }, { pxAppId, clientData });
      
      console.log('[Protection] Step 3: Challenge response:', challengeResponse);
      
      // Add more realistic browser behavior
      await this.page.evaluate(() => {
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
      
      // Add random mouse movements
      await this.page.mouse.move(
        100 + Math.random() * 100,
        100 + Math.random() * 100,
        { steps: 10 }
      );
      
      // Wait for protection to clear
      await this.page.waitForFunction(() => {
        return !document.querySelector('#px-captcha') && 
               !document.querySelector('.px-block') &&
               document.cookie.includes('_px3=');
      }, { timeout: 30000 });
      
      console.log('[Protection] Step 4: Protection cleared');
      
      return true;
    } catch (error) {
      console.error('[Protection] Error handling protection:', error);
      throw error;
    }
  }

  // Rest of the class remains the same...
}

module.exports = WorthpointScraper;