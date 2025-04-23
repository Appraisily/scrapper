/**
 * Artist Directory Scraper
 * Fetches HTML content from Invaluable artist directory pages and saves them in a structured folder
 */
const fs = require('fs').promises;
const path = require('path');
const puppeteer = require('puppeteer-extra');
const StealthPlugin = require('puppeteer-extra-plugin-stealth');
const axios = require('axios');

// Configure puppeteer with stealth plugin to avoid detection
puppeteer.use(StealthPlugin());

class ArtistDirectoryScraper {
  constructor(options = {}) {
    this.outputDir = options.outputDir || 'artist_directory';
    this.baseUrl = 'https://www.invaluable.com/artists';
    this.browser = null;
    
    // Basic delay configuration
    this.minDelay = options.minDelay || 1000;
    this.maxDelay = options.maxDelay || 3000;
    
    // Artist directory structure
    this.primaryLetters = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ'.split('');
    this.secondaryLetters = 'abcdefghijklmnopqrstuvwxyz'.split('');
  }
  
  /**
   * Initialize browser with stealth settings
   */
  async initialize() {
    if (this.browser) {
      return this.browser;
    }
    
    console.log('Initializing browser...');
    this.browser = await puppeteer.launch({
      headless: 'new',
      args: [
        '--no-sandbox',
        '--disable-setuid-sandbox',
        '--disable-dev-shm-usage',
        '--disable-accelerated-2d-canvas',
        '--disable-gpu',
        '--window-size=1280,720'
      ]
    });
    
    console.log('Browser initialized');
    return this.browser;
  }
  
  /**
   * Close browser if open
   */
  async close() {
    if (this.browser) {
      await this.browser.close();
      this.browser = null;
      console.log('Browser closed');
    }
  }
  
  /**
   * Generate a random delay between requests
   */
  async randomDelay() {
    const delay = Math.floor(this.minDelay + Math.random() * (this.maxDelay - this.minDelay));
    console.log(`Waiting ${delay}ms before next request...`);
    await new Promise(resolve => setTimeout(resolve, delay));
  }
  
  /**
   * Create directory if it doesn't exist
   */
  async ensureDir(dirPath) {
    try {
      await fs.mkdir(dirPath, { recursive: true });
    } catch (error) {
      if (error.code !== 'EEXIST') {
        throw error;
      }
    }
  }
  
  /**
   * Build URL for artist directory page
   */
  buildUrl(primaryLetter, secondaryLetters = null) {
    if (secondaryLetters) {
      // URL for specific combination like A/Aa/
      return `${this.baseUrl}/${primaryLetter}/${primaryLetter}${secondaryLetters}/`;
    } else {
      // URL for primary letter like /A/
      return `${this.baseUrl}/${primaryLetter}/`;
    }
  }
  
  /**
   * Fetch HTML content from a URL using puppeteer
   */
  async fetchPage(url) {
    console.log(`Fetching page: ${url}`);
    
    // Create new page for each request
    const page = await this.browser.newPage();
    
    try {
      // Set stealth headers
      await page.setExtraHTTPHeaders({
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/121.0.0.0 Safari/537.36',
        'Accept-Language': 'en-US,en;q=0.9',
        'Referer': 'https://www.invaluable.com/',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8'
      });
      
      // Navigate to URL
      await page.goto(url, { 
        waitUntil: 'networkidle2',
        timeout: 60000 
      });
      
      // Extract HTML content
      const htmlContent = await page.content();
      
      console.log(`Successfully fetched ${url} (${htmlContent.length} bytes)`);
      return htmlContent;
    } catch (error) {
      console.error(`Error fetching ${url}: ${error.message}`);
      return null;
    } finally {
      await page.close();
    }
  }
  
  /**
   * Save HTML content to file
   */
  async saveHtml(htmlContent, primaryLetter, secondaryLetters = null) {
    // Create primary letter directory
    const primaryDir = path.join(this.outputDir, primaryLetter);
    await this.ensureDir(primaryDir);
    
    let filePath;
    if (secondaryLetters) {
      // Save as A/Aa.html
      filePath = path.join(primaryDir, `${primaryLetter}${secondaryLetters}.html`);
    } else {
      // Save as A/A.html (primary letter page)
      filePath = path.join(primaryDir, `${primaryLetter}.html`);
    }
    
    await fs.writeFile(filePath, htmlContent);
    console.log(`Saved HTML to ${filePath}`);
    return filePath;
  }
  
  /**
   * Scrape all artist directory pages
   */
  async scrapeAll() {
    await this.initialize();
    
    console.log('Starting artist directory scrape...');
    
    // Track progress
    const results = {
      success: 0,
      failed: 0,
      skipped: 0
    };
    
    try {
      // Ensure output directory exists
      await this.ensureDir(this.outputDir);
      
      // Process each primary letter
      for (const primaryLetter of this.primaryLetters) {
        console.log(`\n===== Processing primary letter: ${primaryLetter} =====`);
        
        // Create main letter folder
        const letterDir = path.join(this.outputDir, primaryLetter);
        await this.ensureDir(letterDir);
        
        // Fetch primary letter page
        const primaryUrl = this.buildUrl(primaryLetter);
        const primaryHtml = await this.fetchPage(primaryUrl);
        
        if (primaryHtml) {
          // Save primary letter page
          await this.saveHtml(primaryHtml, primaryLetter);
          results.success++;
        } else {
          results.failed++;
        }
        
        // Fetch all secondary combinations for this letter
        for (const secondaryLetter of this.secondaryLetters) {
          // Secondary letter combination (e.g., "Aa", "Ab", etc.)
          const combination = secondaryLetter;
          const combinationUrl = this.buildUrl(primaryLetter, combination);
          
          // Check if file already exists
          const filePath = path.join(letterDir, `${primaryLetter}${combination}.html`);
          try {
            await fs.access(filePath);
            console.log(`File ${filePath} already exists, skipping...`);
            results.skipped++;
            continue;
          } catch (error) {
            // File doesn't exist, proceed with scraping
          }
          
          // Fetch combination page
          const html = await this.fetchPage(combinationUrl);
          
          if (html) {
            // Save combination page
            await this.saveHtml(html, primaryLetter, combination);
            results.success++;
          } else {
            results.failed++;
          }
          
          // Add delay between requests to avoid being blocked
          await this.randomDelay();
        }
        
        // Add longer delay between primary letters
        await this.randomDelay();
        await this.randomDelay();
      }
      
      console.log('\n===== Artist Directory Scrape Complete =====');
      console.log(`Total pages: ${results.success + results.failed + results.skipped}`);
      console.log(`Successfully fetched: ${results.success}`);
      console.log(`Failed: ${results.failed}`);
      console.log(`Skipped (already exist): ${results.skipped}`);
      console.log(`Output directory: ${path.resolve(this.outputDir)}`);
      
      return results;
    } catch (error) {
      console.error('Error during scrape:', error);
      throw error;
    } finally {
      await this.close();
    }
  }
}

module.exports = ArtistDirectoryScraper;

// Allow direct execution of the script
if (require.main === module) {
  (async () => {
    const scraper = new ArtistDirectoryScraper({
      outputDir: process.env.OUTPUT_DIR || 'artist_directory',
      minDelay: parseInt(process.env.MIN_DELAY || '1000', 10),
      maxDelay: parseInt(process.env.MAX_DELAY || '3000', 10)
    });
    
    try {
      await scraper.scrapeAll();
    } catch (error) {
      console.error('Scrape failed:', error);
      process.exit(1);
    }
  })();
} 