/**
 * Search Results Storage Service for Google Cloud Storage
 * Handles saving search results and associated images to specified GCS bucket
 */
const { Storage } = require('@google-cloud/storage');
const path = require('path');
const axios = require('axios');

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
    
    // HTTP client for image downloading
    this.httpClient = axios.create({
      timeout: 10000, // 10 seconds timeout
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/134.0.0.0 Safari/537.36',
        'Referer': 'https://www.invaluable.com/',
        'Accept': 'image/avif,image/webp,image/apng,image/svg+xml,image/*,*/*;q=0.8'
      }
    });
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
   * Download an image from URL and save to GCS
   * @param {string} imageUrl - URL of the image to download
   * @param {string} category - Category/search term
   * @param {string} lotNumber - Lot number of the item
   * @param {string} subcategory - Optional subcategory
   * @returns {Promise<string>} - GCS file path where image was saved
   */
  async saveImage(imageUrl, category, lotNumber, subcategory = null) {
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
      
      // Download image with proper headers
      console.log(`Downloading image from ${url}`);
      const response = await this.httpClient.get(url, { responseType: 'arraybuffer' });
      
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
      console.error(`Error saving image: ${error.message}`);
      return null;
    }
  }

  /**
   * Process and save images for search results
   * @param {Object} searchResults - Formatted search results
   * @param {string} category - Category/search term
   * @param {string} subcategory - Optional subcategory
   * @returns {Promise<Object>} - Results with added image storage paths
   */
  async saveAllImages(searchResults, category, subcategory = null) {
    if (!searchResults || !searchResults.data || !searchResults.data.lots) {
      console.warn('No valid search results provided for image saving');
      return searchResults;
    }

    console.log(`Processing images for ${searchResults.data.lots.length} items in ${category}`);
    
    // Create a copy of the results to avoid modifying the original
    const resultsCopy = JSON.parse(JSON.stringify(searchResults));
    
    // Process each lot in parallel with a concurrency limit
    const concurrencyLimit = 5; // Limit concurrent downloads to avoid rate limiting
    const lots = resultsCopy.data.lots;
    
    // Process in batches
    for (let i = 0; i < lots.length; i += concurrencyLimit) {
      const batch = lots.slice(i, i + concurrencyLimit);
      
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
          // Save the image and get the storage path
          const gcsPath = await this.saveImage(
            imageUrl, 
            category, 
            lot.lotNumber || `item_${currentIndex}`, 
            subcategory
          );
          
          // Add the storage path to the lot data
          if (gcsPath) {
            lots[currentIndex].imagePath = gcsPath;
          }
        } catch (error) {
          console.error(`Failed to save image for lot ${lot.lotNumber || currentIndex}: ${error.message}`);
        }
      }));
      
      // Small delay between batches to avoid overwhelming the server
      if (i + concurrencyLimit < lots.length) {
        await new Promise(resolve => setTimeout(resolve, 500));
      }
    }
    
    console.log(`Completed image processing for ${category}`);
    return resultsCopy;
  }
}

module.exports = SearchStorageService; 