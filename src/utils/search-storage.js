/**
 * Search Results Storage Service for Google Cloud Storage
 * Handles saving search results and associated images to specified GCS bucket
 */
const { Storage } = require('@google-cloud/storage');
const path = require('path');
const axios = require('axios');
const puppeteer = require('puppeteer-extra');
const StealthPlugin = require('puppeteer-extra-plugin-stealth');

// Configure puppeteer with stealth plugin to avoid detection
puppeteer.use(StealthPlugin());

class SearchStorageService {
  constructor(options = {}) {
    // Use STORAGE_BUCKET environment variable, or the provided bucket name, 
    // or the hardcoded fallback value
    this.bucketName = process.env.STORAGE_BUCKET || 
                      options.bucketName || 
                      'invaluable-html-archive';
    
    console.log(`Using GCS bucket: ${this.bucketName}`);
    
    // Initialize Storage with provided credentials or use default
    if (options.credentials) {
      // Use explicitly provided credentials
      this.storage = new Storage({ 
        credentials: options.credentials 
      });
      console.log('Using provided GCS credentials for SearchStorageService');
    } else {
      // Use application default credentials or GOOGLE_APPLICATION_CREDENTIALS
      this.storage = new Storage();
      console.log('Using application default credentials for SearchStorageService');
    }
    
    this.bucket = this.storage.bucket(this.bucketName);
    
    // HTTP client for image downloading (fallback only)
    this.httpClient = axios.create({
      timeout: 30000, // 30 seconds timeout (increased from 10s)
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/134.0.0.0 Safari/537.36',
        'Referer': 'https://www.invaluable.com/',
        'Accept': 'image/avif,image/webp,image/apng,image/svg+xml,image/*,*/*;q=0.8',
        'Accept-Language': 'en-US,en;q=0.9',
        'Cache-Control': 'no-cache',
        'Pragma': 'no-cache',
        'DNT': '1'
      },
      maxRedirects: 5
    });
    
    // Browser instance (will be initialized on demand)
    this.browser = null;
    
    // Track if we need to close the browser when done
    this.shouldCloseBrowser = false;
  }
  
  /**
   * Sanitize a name for file path use
   * @param {string} name - The name to sanitize
   * @returns {string} - Sanitized name
   */
  sanitizeName(name) {
    if (!name) return 'unknown';
    
    return name.toLowerCase()
      .replace(/[^a-z0-9-_]/g, '-')
      .replace(/-+/g, '-');
  }
  
  /**
   * Generate file path for page results
   * Format: invaluable-data/{category}/page_XXXX.json
   */
  getPageFilePath(category, pageNumber, subcategory = null) {
    const paddedPage = String(pageNumber).padStart(4, '0');
    
    if (subcategory) {
      // If subcategory is provided, use a nested path structure
      // This now represents the keyword/query pattern where:
      // - category is the keyword (e.g., "furniture", "collectible")
      // - subcategory is the query (e.g., "furniture", "memorabilia")
      const sanitizedCategory = this.sanitizeName(category);
      const sanitizedSubcategory = this.sanitizeName(subcategory);
      return `invaluable-data/${sanitizedCategory}/${sanitizedSubcategory}/page_${paddedPage}.json`;
    } else {
      // Default path structure without subcategory
      const sanitizedCategory = this.sanitizeName(category);
      return `invaluable-data/${sanitizedCategory}/page_${paddedPage}.json`;
    }
  }
  
  /**
   * Generate folder path for a keyword and query
   * @param {string} keyword - Main category (e.g., "furniture")
   * @param {string} query - Specific query (e.g., "chair")
   * @returns {string} - The folder path in GCS
   */
  getFolderPath(keyword, query = null) {
    const sanitizedKeyword = this.sanitizeName(keyword);
    
    if (query) {
      const sanitizedQuery = this.sanitizeName(query);
      return `invaluable-data/${sanitizedKeyword}/${sanitizedQuery}/`;
    } else {
      return `invaluable-data/${sanitizedKeyword}/`;
    }
  }
  
  /**
   * Check if a folder exists in GCS for the given keyword and query
   * @param {string} keyword - Main category folder (e.g., "furniture")
   * @param {string} query - Specific query subfolder (e.g., "chair")
   * @returns {Promise<boolean>} - Whether the folder exists
   */
  async folderExists(keyword, query = null) {
    try {
      const folderPath = this.getFolderPath(keyword, query);
      console.log(`Checking if folder exists: gs://${this.bucketName}/${folderPath}`);
      
      // In GCS, folders are virtual, so we check for any objects with the prefix
      const [files] = await this.bucket.getFiles({
        prefix: folderPath,
        maxResults: 1  // We only need one file to confirm folder exists
      });
      
      const exists = files.length > 0;
      console.log(`Folder ${folderPath} ${exists ? 'exists' : 'does not exist'} in GCS`);
      return exists;
    } catch (error) {
      console.error(`Error checking if folder exists: ${error.message}`);
      return false;
    }
  }
  
  /**
   * Save single page of results to GCS
   * @param {string} category - Category/search term used (this will be the keyword folder)
   * @param {number} pageNumber - Page number
   * @param {object} rawResults - Raw JSON response from the API
   * @param {string} subcategory - Optional subcategory name (this will be the query subfolder)
   * @returns {Promise<string>} - GCS file path
   */
  async savePageResults(category, pageNumber, rawResults, subcategory = null) {
    if (!category) {
      throw new Error('Category is required for storing search results');
    }
    
    const filePath = this.getPageFilePath(category, pageNumber, subcategory);
    
    try {
      const file = this.bucket.file(filePath);
      await file.save(JSON.stringify(rawResults, null, 2), {
        contentType: 'application/json',
        gzip: true,
        metadata: {
          cacheControl: 'public, max-age=3600',
        },
      });
      
      console.log(`Search results saved to gs://${this.bucketName}/${filePath}`);
      return `gs://${this.bucketName}/${filePath}`;
    } catch (error) {
      console.error(`Error saving search results: ${error.message}`);
      throw error;
    }
  }
  
  /**
   * Check if page results exist
   * @param {string} category - Category/search term used (keyword folder)
   * @param {number} pageNumber - Page number
   * @param {string} subcategory - Optional subcategory name (query subfolder)
   * @returns {Promise<boolean>} - Whether the file exists
   */
  async pageResultsExist(category, pageNumber, subcategory = null) {
    if (!category) {
      return false;
    }
    
    const filePath = this.getPageFilePath(category, pageNumber, subcategory);
    
    try {
      const file = this.bucket.file(filePath);
      const [exists] = await file.exists();
      return exists;
    } catch (error) {
      console.error(`Error checking if page results exist: ${error.message}`);
      return false;
    }
  }
  
  /**
   * List all existing pages for a category and subcategory
   * @param {string} category - Main category (keyword folder)
   * @param {string} subcategory - Optional subcategory (query subfolder)
   * @returns {Promise<Array<number>>} - Array of existing page numbers
   */
  async listExistingPages(category, subcategory = null) {
    if (!category) {
      return [];
    }
    
    try {
      let prefix;
      if (subcategory) {
        const sanitizedCategory = this.sanitizeName(category);
        const sanitizedSubcategory = this.sanitizeName(subcategory);
        prefix = `invaluable-data/${sanitizedCategory}/${sanitizedSubcategory}/`;
      } else {
        const sanitizedCategory = this.sanitizeName(category);
        prefix = `invaluable-data/${sanitizedCategory}/`;
      }
      
      const [files] = await this.bucket.getFiles({ prefix });
      
      // Extract page numbers from filenames using regex
      const pageNumbers = files
        .map(file => {
          const match = file.name.match(/page_(\d{4})\.json$/);
          return match ? parseInt(match[1], 10) : null;
        })
        .filter(pageNum => pageNum !== null)
        .sort((a, b) => a - b);
      
      return pageNumbers;
    } catch (error) {
      console.error(`Error listing existing pages: ${error.message}`);
      return [];
    }
  }

  /**
   * Generate image file path for an auction item
   * Format: invaluable-data/{category}/{subcategory}/images/{lotNumber}_{imageName}.jpg
   * @param {string} category - Category/search term
   * @param {string} subcategory - Optional subcategory
   * @param {string} lotNumber - Lot number of the item
   * @param {string} imageUrl - Original image URL
   * @returns {string} - GCS file path for the image
   */
  getImageFilePath(category, subcategory, lotNumber, imageUrl) {
    // Extract the image filename from the URL
    const imageFileName = path.basename(imageUrl);
    const sanitizedCategory = this.sanitizeName(category);
    
    if (subcategory) {
      const sanitizedSubcategory = this.sanitizeName(subcategory);
      return `invaluable-data/${sanitizedCategory}/${sanitizedSubcategory}/images/${lotNumber}_${imageFileName}`;
    } else {
      return `invaluable-data/${sanitizedCategory}/images/${lotNumber}_${imageFileName}`;
    }
  }

  /**
   * Initialize browser with environment-specific optimizations
   * @param {Object} externalBrowser - Optional external browser instance to use
   * @returns {Promise<Object>} - Puppeteer browser instance
   */
  async initBrowser(externalBrowser = null) {
    if (externalBrowser) {
      console.log('Using provided external browser instance');
      this.browser = externalBrowser;
      this.shouldCloseBrowser = false;
      return this.browser;
    }
    
    if (this.browser) {
      return this.browser;
    }
    
    console.log('Initializing browser for image downloads...');
    
    // Detect environment and available resources
    const isCloudRun = process.env.K_SERVICE ? true : false;
    const maxMemoryGB = parseInt(process.env.MAX_MEMORY_GB || '4', 10);
    
    // Optimize browser configuration based on environment
    const args = [
      '--no-sandbox',
      '--disable-setuid-sandbox',
      '--disable-dev-shm-usage',
      '--disable-accelerated-2d-canvas',
      '--disable-gpu',
      '--window-size=1280,720'
    ];
    
    // Add additional optimizations for high-memory environments
    if (maxMemoryGB >= 8) {
      // Additional memory-related optimizations for higher resource environments
      args.push(
        '--js-flags=--expose-gc',
        '--disable-features=site-per-process',
        '--single-process', // Use single process for memory management
        '--disable-field-trial-config', // Disable field trials to reduce memory
        '--no-zygote' // Disable zygote process to reduce memory usage
      );
    }
    
    // Configure context size based on available memory
    // Higher memory = more browser contexts for parallel processing
    const maxContexts = Math.max(2, Math.min(8, Math.floor(maxMemoryGB / 2)));
    args.push(`--max-active-webgl-contexts=${maxContexts}`);
    
    // Configure timeouts based on environment
    // Cloud Run environments can have longer timeouts due to better stability
    const protocolTimeout = isCloudRun ? 90000 : 60000; // 90 seconds in Cloud Run
    const browserTimeout = isCloudRun ? 90000 : 60000; // 90 seconds in Cloud Run
    
    // Launch browser with optimized configuration
    this.browser = await puppeteer.launch({
      headless: 'new',
      args,
      protocolTimeout,
      timeout: browserTimeout,
      // Set default viewport based on most common image sizes
      defaultViewport: {
        width: 1280,
        height: 960,
        deviceScaleFactor: 1
      }
    });
    
    this.shouldCloseBrowser = true;
    console.log('Browser initialized successfully with environment-specific optimizations');
    console.log(`Browser configuration: Memory ${maxMemoryGB}GB, max contexts: ${maxContexts}, timeouts: ${protocolTimeout}ms`);
    return this.browser;
  }
  
  /**
   * Close browser if we created it
   */
  async closeBrowser() {
    if (this.browser && this.shouldCloseBrowser) {
      console.log('Closing browser...');
      await this.browser.close();
      this.browser = null;
      console.log('Browser closed');
    }
  }
  
  /**
   * Log problematic images to GCS for later analysis
   * @param {string} imageUrl - URL of the problematic image
   * @param {string} category - Category/keyword being processed
   * @param {string} lotNumber - Lot number of the item
   * @param {string} subcategory - Optional subcategory
   * @param {string} reason - Reason for skipping/failure
   * @param {Object} additionalInfo - Any additional information to log
   * @returns {Promise<void>}
   */
  async logProblematicImage(imageUrl, category, lotNumber, subcategory = null, reason = 'unknown', additionalInfo = {}) {
    try {
      // Generate log file path
      const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
      const sanitizedCategory = this.sanitizeName(category);
      let logPath;
      
      if (subcategory) {
        const sanitizedSubcategory = this.sanitizeName(subcategory);
        logPath = `invaluable-data/${sanitizedCategory}/${sanitizedSubcategory}/problematic_images.jsonl`;
      } else {
        logPath = `invaluable-data/${sanitizedCategory}/problematic_images.jsonl`;
      }
      
      // Create log entry
      const logEntry = {
        timestamp: new Date().toISOString(),
        imageUrl,
        category,
        subcategory: subcategory || null,
        lotNumber,
        reason,
        ...additionalInfo
      };
      
      // Convert to JSON line format
      const logLine = JSON.stringify(logEntry) + '\n';
      
      // Check if file exists first
      const file = this.bucket.file(logPath);
      const [exists] = await file.exists();
      
      if (exists) {
        // Append to existing file
        await file.append(logLine);
      } else {
        // Create new file
        await file.save(logLine, {
          contentType: 'application/json',
          metadata: {
            description: 'Log of problematic images encountered during scraping'
          }
        });
      }
      
      console.log(`Logged problematic image to ${logPath}`);
    } catch (error) {
      // Don't let logging errors disrupt the main process
      console.error(`Error logging problematic image: ${error.message}`);
    }
  }
  
  /**
   * Download an image using browser with improved request handling
   * This method uses a fresh page for each image to prevent request conflicts
   * 
   * @param {string} imageUrl - URL of the image to download
   * @param {string} category - Category/search term
   * @param {string} lotNumber - Lot number of the item
   * @param {string} subcategory - Optional subcategory
   * @param {Object} externalBrowser - Optional external browser instance to use
   * @returns {Promise<string>} - GCS file path where image was saved
   */
  async saveImage(imageUrl, category, lotNumber, subcategory = null, externalBrowser = null) {
    if (!imageUrl || !category || !lotNumber) {
      throw new Error('Image URL, category, and lot number are required for storing images');
    }

    try {
      // Fix image URL if needed (ensure complete URL)
      let url = imageUrl;
      if (!url.startsWith('http')) {
        // If it starts with a house name without the proper prefix
        if (!url.startsWith('image.invaluable.com')) {
          url = `https://image.invaluable.com/housePhotos/${url}`;
        } else {
          url = `https://${url}`;
        }
      }
      
      // Skip known problematic images
      const problematicImages = [
        'H0587-L73067353',
        'H0587-L73067356'
      ];
      
      // Check if this is a known problematic image
      const isProblematic = problematicImages.some(problemId => url.includes(problemId));
      if (isProblematic) {
        console.log(`Skipping known problematic image: ${url}`);
        
        // Log the problematic image to GCS
        await this.logProblematicImage(url, category, lotNumber, subcategory, 'blacklisted');
        
        return `skipped:${url}`;
      }
      
      // Generate GCS file path for the image
      const filePath = this.getImageFilePath(category, subcategory, lotNumber, url);
      
      // Check if image already exists in storage
      const file = this.bucket.file(filePath);
      const [exists] = await file.exists();
      
      if (exists) {
        console.log(`Image already exists at gs://${this.bucketName}/${filePath}`);
        return `gs://${this.bucketName}/${filePath}`;
      }
      
      // Initialize browser if needed
      await this.initBrowser(externalBrowser);
      
      // Always create a new page for each image to prevent request conflicts
      console.log(`Downloading image from ${url} using browser`);
      const page = await this.browser.newPage();
      
      try {
        // Configure page
        await page.setViewport({ width: 1280, height: 720 });
        await page.setExtraHTTPHeaders({
          'Referer': 'https://www.invaluable.com/',
          'Accept': 'image/avif,image/webp,image/apng,image/svg+xml,image/*,*/*;q=0.8',
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/121.0.0.0 Safari/537.36'
        });
        
        // Prepare variables to store response data
        let imageBuffer = null;
        let contentType = 'image/jpeg';
        
        // First attempt: Try direct navigation without interception
        try {
          console.log(`Attempting direct navigation to image URL...`);
          const response = await page.goto(url, {
            waitUntil: 'networkidle0',
            timeout: 30000
          });
          
          if (response && response.status() === 200) {
            try {
              imageBuffer = await response.buffer();
              contentType = response.headers()['content-type'] || 'image/jpeg';
              console.log(`Successfully captured image via direct navigation`);
            } catch (bufferError) {
              console.log(`Error getting buffer from response: ${bufferError.message}`);
            }
          }
        } catch (navError) {
          console.log(`Navigation error: ${navError.message}`);
        }
        
        // Second attempt: Try request interception if direct navigation failed
        if (!imageBuffer) {
          console.log(`Trying with request interception...`);
          
          // Reset page
          await page.goto('about:blank');
          
          // Set up request interception with proper handlers
          await page.setRequestInterception(true);
          
          const requestHandler = (request) => {
            if (request.resourceType() === 'image' || request.url() === url) {
              // Continue the image request
              request.continue();
            } else if (['stylesheet', 'font', 'media'].includes(request.resourceType())) {
              // Block unnecessary resources
              request.abort();
            } else {
              // Continue other requests
              request.continue();
            }
          };
          
          // Add event listener for requests
          page.on('request', requestHandler);
          
          // Add event listener for responses
          const responsePromise = new Promise((resolve) => {
            page.once('response', async (response) => {
              if (response.url() === url && response.status() === 200) {
                try {
                  const buffer = await response.buffer();
                  const headers = response.headers();
                  resolve({ buffer, contentType: headers['content-type'] || 'image/jpeg' });
                } catch (err) {
                  console.log(`Error in response handler: ${err.message}`);
                  resolve(null);
                }
              } else {
                resolve(null);
              }
            });
          });
          
          // Navigate to the image URL
          try {
            await page.goto(url, { 
              waitUntil: 'networkidle0',
              timeout: 30000
            });
            
            // Wait for response handler to complete
            const responseData = await responsePromise;
            if (responseData) {
              imageBuffer = responseData.buffer;
              contentType = responseData.contentType;
              console.log(`Successfully captured image via interception`);
            }
            
            // Remove the request handler to prevent memory leaks
            try {
              if (page && typeof page.removeListener === 'function') {
                page.removeListener('request', requestHandler);
              } else {
                console.log('Warning: page.removeListener is not available or not a function');
              }
            } catch (listenerError) {
              console.log(`Warning: Error removing request listener: ${listenerError.message}`);
            }
          } catch (navError) {
            console.log(`Interception navigation error: ${navError.message}`);
            // Remove the request handler with proper error handling
            try {
              if (page && typeof page.removeListener === 'function') {
                page.removeListener('request', requestHandler);
              } else {
                console.log('Warning: page.removeListener is not available or not a function');
              }
            } catch (listenerError) {
              console.log(`Warning: Error removing request listener: ${listenerError.message}`);
            }
          }
        }
        
        // Third attempt: Try to extract from DOM if previous methods failed
        if (!imageBuffer) {
          console.log(`Trying to extract image from DOM...`);
          
          // Navigate to the image URL without interception
          await page.setRequestInterception(false);
          await page.goto(url, { timeout: 30000 });
          
          // Try to get the image as base64 from the page
          const base64Data = await page.evaluate(() => {
            const img = document.querySelector('img');
            if (img && img.complete) {
              try {
                const canvas = document.createElement('canvas');
                canvas.width = img.naturalWidth || 300;
                canvas.height = img.naturalHeight || 300;
                const ctx = canvas.getContext('2d');
                ctx.drawImage(img, 0, 0);
                return canvas.toDataURL('image/jpeg').replace(/^data:image\/jpeg;base64,/, '');
              } catch (e) {
                return null;
              }
            }
            return null;
          });
          
          if (base64Data) {
            imageBuffer = Buffer.from(base64Data, 'base64');
            contentType = 'image/jpeg';
            console.log(`Successfully extracted image from DOM`);
          }
        }
        
        // If we still don't have an image, try a direct XHR request from within the page
        if (!imageBuffer) {
          console.log(`Trying XHR request from within page...`);
          
          const xhrResult = await page.evaluate(async (imageUrl) => {
            return new Promise((resolve) => {
              const xhr = new XMLHttpRequest();
              xhr.open('GET', imageUrl, true);
              xhr.responseType = 'arraybuffer';
              xhr.onload = function() {
                if (this.status === 200) {
                  const contentType = xhr.getResponseHeader('Content-Type') || 'image/jpeg';
                  
                  // Convert ArrayBuffer to Base64
                  const uInt8Array = new Uint8Array(this.response);
                  let binaryString = '';
                  for (let i = 0; i < uInt8Array.length; i++) {
                    binaryString += String.fromCharCode(uInt8Array[i]);
                  }
                  const base64 = btoa(binaryString);
                  
                  resolve({ success: true, data: base64, contentType });
                } else {
                  resolve({ success: false, error: `Status code: ${this.status}` });
                }
              };
              xhr.onerror = function() {
                resolve({ success: false, error: 'XHR request failed' });
              };
              xhr.send();
            });
          }, url);
          
          if (xhrResult && xhrResult.success) {
            imageBuffer = Buffer.from(xhrResult.data, 'base64');
            contentType = xhrResult.contentType;
            console.log(`Successfully downloaded image via XHR`);
          }
        }
        
        // If we still don't have an image, throw an error
        if (!imageBuffer) {
          throw new Error(`Failed to download image: Could not capture image data`);
        }
        
        // Save image to GCS
        await file.save(imageBuffer, {
          contentType,
          metadata: {
            cacheControl: 'public, max-age=31536000', // Cache for 1 year
            source: url
          },
        });
        
        console.log(`Image saved to gs://${this.bucketName}/${filePath}`);
        return `gs://${this.bucketName}/${filePath}`;
      } finally {
        // Always close the page to free resources
        try {
          await page.close();
        } catch (closeError) {
          console.log(`Error closing page: ${closeError.message}`);
        }
      }
    } catch (error) {
      console.error(`Error saving image: ${error.message}`);
      
      // Try fallback to direct HTTP request if browser method fails
      try {
        console.log(`Trying fallback method with direct HTTP request...`);
        return await this.saveImageFallback(imageUrl, category, lotNumber, subcategory);
      } catch (fallbackError) {
        console.error(`Fallback method also failed: ${fallbackError.message}`);
        return null;
      }
    }
  }
  
  /**
   * Enhanced fallback method for image download
   * Uses a completely different approach with axios with custom headers
   * 
   * @param {string} imageUrl - URL of the image to download
   * @param {string} category - Category/search term
   * @param {string} lotNumber - Lot number of the item
   * @param {string} subcategory - Optional subcategory
   * @returns {Promise<string>} - GCS file path where image was saved
   */
  async saveImageFallback(imageUrl, category, lotNumber, subcategory = null) {
    try {
      // Fix image URL if needed (ensure complete URL)
      let url = imageUrl;
      if (!url.startsWith('http')) {
        // If it starts with a house name without the proper prefix
        if (!url.startsWith('image.invaluable.com')) {
          url = `https://image.invaluable.com/housePhotos/${url}`;
        } else {
          url = `https://${url}`;
        }
      }
      
      // Skip known problematic images
      const problematicImages = [
        'H0587-L73067353',
        'H0587-L73067356'
      ];
      
      // Check if this is a known problematic image
      const isProblematic = problematicImages.some(problemId => url.includes(problemId));
      if (isProblematic) {
        console.log(`Skipping known problematic image in fallback method: ${url}`);
        
        // Log the problematic image to GCS
        await this.logProblematicImage(url, category, lotNumber, subcategory, 'blacklisted_fallback');
        
        return `skipped:${url}`;
      }
      
      // Generate GCS file path for the image
      const filePath = this.getImageFilePath(category, subcategory, lotNumber, url);
      
      // Check if image already exists in storage
      const file = this.bucket.file(filePath);
      const [exists] = await file.exists();
      
      if (exists) {
        console.log(`Image already exists at gs://${this.bucketName}/${filePath}`);
        return `gs://${this.bucketName}/${filePath}`;
      }
      
      // Download image with enhanced headers
      console.log(`Downloading image from ${url} using enhanced HTTP request`);
      
      // Create a custom Axios instance with improved settings
      const client = axios.create({
        timeout: 60000, // 60 second timeout
        maxRedirects: 5,
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/121.0.0.0 Safari/537.36',
          'Referer': 'https://www.invaluable.com/',
          'Accept': 'image/avif,image/webp,image/apng,image/svg+xml,image/*,*/*;q=0.8',
          'Accept-Language': 'en-US,en;q=0.9',
          'Cache-Control': 'no-cache',
          'Pragma': 'no-cache',
          'Connection': 'keep-alive',
          'DNT': '1',
          'Sec-Fetch-Dest': 'image',
          'Sec-Fetch-Mode': 'no-cors',
          'Sec-Fetch-Site': 'same-site'
        },
        responseType: 'arraybuffer'
      });
      
      // Add random cookies to look like a browser
      const cookies = [
        `_ga=GA1.2.${Math.floor(Math.random() * 1000000000)}.${Math.floor(Date.now() / 1000) - Math.floor(Math.random() * 10000000)}`,
        `_gid=GA1.2.${Math.floor(Math.random() * 1000000000)}.${Math.floor(Date.now() / 1000) - Math.floor(Math.random() * 100000)}`,
        `_gat=1`,
        `_invaluable_session=${Math.random().toString(36).substring(2, 15) + Math.random().toString(36).substring(2, 15)}`
      ].join('; ');
      
      client.defaults.headers.common['Cookie'] = cookies;
      
      // Make the request
      const response = await client.get(url);
      
      // Get content type from response
      const contentType = response.headers['content-type'] || 'image/jpeg';
      
      // Save image to GCS
      await file.save(response.data, {
        contentType,
        metadata: {
          cacheControl: 'public, max-age=31536000', // Cache for 1 year
          source: url
        },
      });
      
      console.log(`Image saved to gs://${this.bucketName}/${filePath}`);
      return `gs://${this.bucketName}/${filePath}`;
    } catch (error) {
      console.error(`Error in enhanced HTTP download: ${error.message}`);
      
      // Try using browser method as last resort
      try {
        console.log("Falling back to browser method for image download...");
        await this.initBrowser(null);
        return await this.saveImage(imageUrl, category, lotNumber, subcategory, this.browser);
      } catch (browserError) {
        console.error(`Browser fallback also failed: ${browserError.message}`);
        return null;
      }
    }
  }

  /**
   * Process and save images for search results with advanced error handling
   * Uses controlled concurrency and multiple approaches for image downloading
   * 
   * @param {Object} searchResults - Formatted search results
   * @param {string} category - Category/search term
   * @param {string} subcategory - Optional subcategory
   * @param {Object} externalBrowser - Optional browser instance to reuse
   * @returns {Promise<Object>} - Results with added image storage paths
   */
  async saveAllImages(searchResults, category, subcategory = null, externalBrowser = null) {
    if (!searchResults || !searchResults.data || !searchResults.data.lots) {
      console.warn('No valid search results provided for image saving');
      return searchResults;
    }

    console.log(`Processing images for ${searchResults.data.lots.length} items in ${category}`);
    
    // Create a copy of the results to avoid modifying the original
    const resultsCopy = JSON.parse(JSON.stringify(searchResults));
    
    try {
      // Initialize shared browser instance if needed
      await this.initBrowser(externalBrowser);
      
      // Process each lot in sequential batches with a concurrency limit
      const lots = resultsCopy.data.lots;
      
      // Use dynamic concurrency based on the available memory and environment
      // This advanced configuration adapts to the deployment environment
      const isCloudRun = process.env.K_SERVICE ? true : false; // Check if running in Cloud Run
      
      // Get environment-specific memory settings with improved defaults
      const maxMemoryGB = parseInt(process.env.MAX_MEMORY_GB || '4', 10); // Default to 4GB
      
      // Calculate optimal concurrency based on environment and memory
      // Cloud Run environments can handle higher concurrency due to better networking
      // Local environments should be more conservative to avoid resource exhaustion
      let concurrencyLimit;
      
      if (isCloudRun) {
        // Cloud Run can handle more concurrent downloads:
        // 2GB RAM = 3 concurrent downloads
        // 4GB RAM = 6 concurrent downloads
        // 8GB RAM = 10 concurrent downloads
        // 16GB RAM = 16 concurrent downloads
        concurrencyLimit = Math.min(Math.max(3, Math.floor(maxMemoryGB * 1.5)), 16);
      } else {
        // Local environment uses more conservative limits:
        // 2GB RAM = 2 concurrent downloads
        // 4GB RAM = 4 concurrent downloads
        // 8GB RAM = 6 concurrent downloads
        concurrencyLimit = Math.min(Math.max(2, Math.floor(maxMemoryGB)), 6);
      }
      
      // Allow explicit override through environment variable
      if (process.env.IMAGE_CONCURRENCY) {
        const explicitLimit = parseInt(process.env.IMAGE_CONCURRENCY, 10);
        if (!isNaN(explicitLimit) && explicitLimit > 0) {
          concurrencyLimit = explicitLimit;
          console.log(`Using explicitly configured concurrency limit: ${concurrencyLimit}`);
        }
      }
      
      console.log(`Using concurrency limit of ${concurrencyLimit} based on available memory (${maxMemoryGB}GB)`);

      // Keep track of successes and failures
      let successCount = 0;
      let failureCount = 0;
      let retryCount = 0;
      
      // Create a pool of tasks to process with controlled concurrency
      const taskQueue = [];
      
      // Add all lots to the task queue
      for (let i = 0; i < lots.length; i++) {
        const lot = lots[i];
        const imageUrl = lot.image;
        
        if (!imageUrl) {
          console.log(`No image URL for lot ${lot.lotNumber || i}`);
          continue;
        }
        
        taskQueue.push({
          index: i,
          lot,
          imageUrl,
          lotNumber: lot.lotNumber || `item_${i}`,
          retryCount: 0
        });
      }
      
      // Process the task queue with controlled concurrency
      while (taskQueue.length > 0) {
        // Take next batch of tasks
        const batchTasks = taskQueue.splice(0, concurrencyLimit);
        const batchNumber = Math.floor((successCount + failureCount) / concurrencyLimit) + 1;
        
        console.log(`Processing batch ${batchNumber} with ${batchTasks.length} images, ${taskQueue.length} remaining in queue`);
        
        // Process batch in parallel
        const results = await Promise.allSettled(
          batchTasks.map(async (task) => {
            const { index, lot, imageUrl, lotNumber, retryCount } = task;
            
            console.log(`Processing image: ${imageUrl} for lot ${lotNumber} (attempt ${retryCount + 1})`);
            
            try {
              // First try the primary browser-based method
              const gcsPath = await this.saveImage(
                imageUrl, 
                category, 
                lotNumber, 
                subcategory,
                this.browser
              );
              
              if (gcsPath) {
                // Check if this is a skipped image
                if (gcsPath.startsWith('skipped:')) {
                  console.log(`Image was skipped: ${gcsPath}`);
                  lots[index].imagePath = null;
                  lots[index].imageSkipped = true;
                  successCount++; // Count as success to avoid retries
                  return { success: true, index, skipped: true };
                } else {
                  lots[index].imagePath = gcsPath;
                  successCount++;
                  return { success: true, index, gcsPath };
                }
              } else {
                throw new Error("saveImage returned null path");
              }
            } catch (error) {
              // Log the error
              console.error(`Error saving image for lot ${lotNumber}: ${error.message}`);
              
              // Log the failed image to GCS
              try {
                await this.logProblematicImage(
                  imageUrl, 
                  category, 
                  lotNumber, 
                  subcategory, 
                  retryCount >= 2 ? 'max_retries_exceeded' : 'download_error',
                  { 
                    error: error.message,
                    attempt: retryCount + 1,
                    maxRetries: 2
                  }
                );
              } catch (logError) {
                console.error(`Failed to log problematic image: ${logError.message}`);
              }
              
              // If retries remain, add back to queue
              if (retryCount < 2) {
                console.log(`Scheduling retry for image ${lotNumber} (attempt ${retryCount + 2})`);
                taskQueue.push({
                  ...task,
                  retryCount: retryCount + 1
                });
                retryCount++;
                return { success: false, retry: true, index };
              } else {
                // Mark as failed after max retries
                failureCount++;
                return { success: false, retry: false, index, error: error.message };
              }
            }
          })
        );
        
        // Log batch results
        const batchSucceeded = results.filter(r => r.status === 'fulfilled' && r.value && r.value.success).length;
        const batchRetried = results.filter(r => r.status === 'fulfilled' && r.value && !r.value.success && r.value.retry).length;
        const batchFailed = results.filter(r => (r.status === 'rejected' || (r.status === 'fulfilled' && r.value && !r.value.success && !r.value.retry))).length;
        
        console.log(`Batch ${batchNumber} results: ${batchSucceeded} successful, ${batchRetried} scheduled for retry, ${batchFailed} failed`);
        
        // Delay between batches to prevent overwhelming the system
        if (taskQueue.length > 0) {
          const delayMs = 1000; // 1 second delay between batches
          console.log(`Waiting ${delayMs}ms before next batch...`);
          await new Promise(resolve => setTimeout(resolve, delayMs));
          
          // Adaptively restart the browser to optimize memory usage
          const totalProcessed = successCount + failureCount;
          
          // Calculate restart frequency based on environment and memory
          // Higher memory = less frequent restarts
          // Cloud Run = more aggressive memory management
          const restartFrequency = isCloudRun 
            ? Math.max(20, Math.min(50, 15 * maxMemoryGB))  // Cloud Run: between 20-50 images
            : Math.max(30, Math.min(100, 25 * maxMemoryGB)); // Local: between 30-100 images
          
          if (totalProcessed > 0 && totalProcessed % restartFrequency === 0) {
            try {
              console.log(`Restarting browser to free memory (restart frequency: every ${restartFrequency} images)...`);
              await this.closeBrowser();
              
              // Run garbage collection if available (Node.js with --expose-gc flag)
              if (global.gc) {
                console.log("Running garbage collection...");
                global.gc();
              }
              
              // Give system time to reclaim resources
              const cooldownTime = isCloudRun ? 1000 : 2000; // Shorter cooldown in Cloud Run
              await new Promise(resolve => setTimeout(resolve, cooldownTime));
              
              // Reinitialize browser
              await this.initBrowser(externalBrowser);
              console.log("Browser restarted successfully");
            } catch (restartError) {
              console.error(`Error restarting browser: ${restartError.message}`);
            }
          }
        }
      }
      
      // Log final statistics
      console.log(`Image processing completed for ${category}`);
      console.log(`Final results: ${successCount} successful, ${failureCount} failed, ${retryCount} retries`);
      
      return resultsCopy;
    } finally {
      try {
        // Close the browser if we created it
        await this.closeBrowser();
      } catch (closeError) {
        console.error(`Error closing browser: ${closeError.message}`);
      }
    }
  }
}

module.exports = SearchStorageService;