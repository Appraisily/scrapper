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
   * Initialize browser if it doesn't exist yet
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
    this.browser = await puppeteer.launch({
      headless: 'new',
      args: [
        '--no-sandbox',
        '--disable-setuid-sandbox',
        '--disable-dev-shm-usage',
        '--disable-accelerated-2d-canvas',
        '--disable-gpu',
        '--window-size=1280,720'
      ],
      protocolTimeout: 60000, // Increase protocol timeout to 60 seconds
      timeout: 60000 // Increase browser launch timeout
    });
    
    this.shouldCloseBrowser = true;
    console.log('Browser initialized successfully');
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
   * Download an image using browser and save to GCS
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
      
      // Reuse existing page if possible rather than creating new ones
      console.log(`Downloading image from ${url} using browser`);
      let page;
      try {
        // Try to get an existing page
        const pages = await this.browser.pages();
        if (pages.length > 0) {
          page = pages[0]; // Reuse the first available page
          console.log("Reusing existing browser page");
        } else {
          page = await this.browser.newPage();
          console.log("Created new browser page");
        }
      } catch (pageError) {
        console.log("Error getting existing pages, creating new one:", pageError.message);
        page = await this.browser.newPage();
      }
      
      try {
        // Set viewport
        await page.setViewport({ width: 1280, height: 720 });
        
        // Set extra headers
        await page.setExtraHTTPHeaders({
          'Referer': 'https://www.invaluable.com/',
          'Accept': 'image/avif,image/webp,image/apng,image/svg+xml,image/*,*/*;q=0.8'
        });
        
        // Enable request interception to capture the image response
        await page.setRequestInterception(true);
        
        let imageBuffer = null;
        let contentType = 'image/jpeg';
        
        // Listen for responses to capture the image data
        page.on('request', request => {
          request.continue();
        });
        
        page.on('response', async response => {
          if (response.url() === url && response.status() === 200) {
            try {
              imageBuffer = await response.buffer();
              contentType = response.headers()['content-type'] || 'image/jpeg';
              console.log(`Successfully captured image response: ${response.status()}, content-type: ${contentType}`);
            } catch (err) {
              console.error(`Error capturing response buffer: ${err.message}`);
            }
          }
        });
        
        // Navigate to the image URL with increased timeout
        const response = await page.goto(url, {
          waitUntil: 'networkidle0',
          timeout: 60000  // Increased from 15000 to 60000
        });
        
        // If we couldn't capture the buffer from the response event, try to get it directly
        if (!imageBuffer && response && response.status() === 200) {
          imageBuffer = await response.buffer();
          contentType = response.headers()['content-type'] || 'image/jpeg';
          console.log(`Captured image buffer directly from response`);
        }
        
        // Check if we have image data
        if (!imageBuffer) {
          console.log(`Alternative method: trying to get image from page content...`);
          
          // Try to get the image as base64 from the page
          const base64Data = await page.evaluate(() => {
            const img = document.querySelector('img');
            if (img && img.complete) {
              const canvas = document.createElement('canvas');
              canvas.width = img.naturalWidth;
              canvas.height = img.naturalHeight;
              const ctx = canvas.getContext('2d');
              ctx.drawImage(img, 0, 0);
              return canvas.toDataURL('image/jpeg').replace(/^data:image\/jpeg;base64,/, '');
            }
            return null;
          });
          
          if (base64Data) {
            imageBuffer = Buffer.from(base64Data, 'base64');
            contentType = 'image/jpeg';
            console.log(`Successfully extracted image data from page`);
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
        // Don't close the page, we'll reuse it for future requests
        // Just navigate to about:blank to clear resources
        try {
          await page.goto('about:blank', { waitUntil: 'networkidle0', timeout: 5000 });
        } catch (clearError) {
          // Ignore errors when navigating to about:blank
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
   * Fake fallback method that now just delegates to the browser method
   * @param {string} imageUrl - URL of the image to download
   * @param {string} category - Category/search term
   * @param {string} lotNumber - Lot number of the item
   * @param {string} subcategory - Optional subcategory
   * @returns {Promise<string>} - GCS file path where image was saved
   */
  async saveImageFallback(imageUrl, category, lotNumber, subcategory = null) {
    // Initialize browser if needed
    await this.initBrowser(null);
    
    // Just use the browser method since direct HTTP requests are failing
    return this.saveImage(imageUrl, category, lotNumber, subcategory, this.browser);
  }

  /**
   * Process and save images for search results
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
      
      // Use moderate concurrency that worked before
      const concurrencyLimit = 3; // Keeping moderate concurrency - will increase cloud resources instead

      // Process in batches
      for (let i = 0; i < lots.length; i += concurrencyLimit) {
        const batch = lots.slice(i, i + concurrencyLimit);
        
        console.log(`Processing batch ${Math.floor(i/concurrencyLimit) + 1} of ${Math.ceil(lots.length/concurrencyLimit)}`);
        
        // Process each batch in parallel
        await Promise.all(batch.map(async (lot, index) => {
          const currentIndex = i + index;
          const imageUrl = lot.image;
          
          if (!imageUrl) {
            console.log(`No image URL for lot ${lot.lotNumber || currentIndex}`);
            return;
          }
          
          // Log the original image URL format
          console.log(`Processing image: ${imageUrl} for lot ${lot.lotNumber || currentIndex}`);
          
          try {
            // Save the image and get the storage path - pass the browser instance
            const gcsPath = await this.saveImage(
              imageUrl, 
              category, 
              lot.lotNumber || `item_${currentIndex}`, 
              subcategory,
              this.browser // Reuse the same browser instance
            );
            
            // Add the storage path to the lot data
            if (gcsPath) {
              lots[currentIndex].imagePath = gcsPath;
            }
          } catch (error) {
            console.error(`Failed to save image for lot ${lot.lotNumber || currentIndex}: ${error.message}`);
          }
        }));
        
        // Reduced delay between batches
        // Simple delay between batches without resetting browser
        if (i + concurrencyLimit < lots.length) {
          const delayMs = 500; // Keep normal delay
          console.log(`Waiting ${delayMs}ms before next batch...`);
          await new Promise(resolve => setTimeout(resolve, delayMs));
        }
      }
      
      console.log(`Completed image processing for ${category}`);
      return resultsCopy;
    } finally {
      // Close the browser if we created it
      await this.closeBrowser();
    }
  }
}

module.exports = SearchStorageService; 