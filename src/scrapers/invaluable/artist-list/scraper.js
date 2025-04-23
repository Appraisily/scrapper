const puppeteer = require('puppeteer');
const fs = require('fs').promises;
const path = require('path');

/**
 * ArtistListScraper class for scraping artist data from invaluable.com
 */
class ArtistListScraper {
  constructor() {
    this.browser = null;
    this.page = null;
    this.outputDir = path.join(__dirname, 'output');
    this.artists = [];
    this.baseUrl = 'https://www.invaluable.com/artists/';
  }

  /**
   * Initialize the browser
   */
  async initialize() {
    try {
      console.log('Initializing browser...');
      this.browser = await puppeteer.launch({
        headless: false,
        args: ['--no-sandbox', '--disable-setuid-sandbox']
      });
      this.page = await this.browser.newPage();
      await this.page.setViewport({ width: 1366, height: 768 });
      await this.page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36');
      
      // Create output directory if it doesn't exist
      try {
        await fs.mkdir(this.outputDir, { recursive: true });
        console.log(`Created output directory at ${this.outputDir}`);
      } catch (err) {
        console.error('Error creating output directory:', err);
      }
      
      console.log('Browser initialized successfully');
    } catch (error) {
      console.error('Error initializing browser:', error);
      throw error;
    }
  }

  /**
   * Close the browser
   */
  async close() {
    if (this.browser) {
      await this.browser.close();
      this.browser = null;
      this.page = null;
      console.log('Browser closed successfully');
    }
  }

  /**
   * Get all the letters we need to scrape (A to C)
   */
  getLettersToScrape() {
    return ['A', 'B', 'C'];
  }

  /**
   * Get all sub-letters for a given first letter (e.g., Aa, Ab, Ac...)
   * @param {string} firstLetter - The first letter to get sub-letters for
   */
  async getSubLetters(firstLetter) {
    try {
      const url = `${this.baseUrl}${firstLetter}/`;
      await this.page.goto(url, { waitUntil: 'networkidle2', timeout: 60000 });
      
      // Wait for the sub-letter navigation to load
      await this.page.waitForSelector('.directory-alpha-nav ul.ais-Hits-list li a', { timeout: 10000 });
      
      // Get all sub-letter links
      const subLetterLinks = await this.page.evaluate(() => {
        const links = Array.from(document.querySelectorAll('.directory-alpha-nav ul.ais-Hits-list li a'));
        return links.map(link => {
          return {
            text: link.textContent.trim(),
            url: link.href
          };
        });
      });
      
      return subLetterLinks;
    } catch (error) {
      console.error(`Error getting sub-letters for ${firstLetter}:`, error);
      return [];
    }
  }

  /**
   * Scrape artists from a specific page
   * @param {string} url - The URL to scrape
   */
  async scrapeArtistsPage(url) {
    try {
      console.log(`Scraping artists from ${url}`);
      await this.page.goto(url, { waitUntil: 'networkidle2', timeout: 60000 });
      
      // Wait for the artist list to load
      await this.page.waitForSelector('.ais-Hits-list li.ais-Hits-item a', { timeout: 10000 });
      
      // Extract artists
      const pageArtists = await this.page.evaluate(() => {
        const artistElements = Array.from(document.querySelectorAll('.ais-Hits-list li.ais-Hits-item a'));
        return artistElements.map(element => {
          const nameWithCount = element.querySelector('span').textContent.trim();
          // Extract name from format "Name (count)"
          const name = nameWithCount.replace(/\s*\(\d+\)$/, '').trim();
          return {
            name: name,
            url: element.href
          };
        });
      });
      
      console.log(`Found ${pageArtists.length} artists on this page`);
      return pageArtists;
    } catch (error) {
      console.error(`Error scraping artists from ${url}:`, error);
      return [];
    }
  }

  /**
   * Scrape all artists from A to C
   */
  async scrapeAllArtists() {
    try {
      if (!this.browser) {
        await this.initialize();
      }
      
      const letters = this.getLettersToScrape();
      for (const letter of letters) {
        console.log(`Processing letter: ${letter}`);
        
        // First scrape the main letter page
        const mainLetterUrl = `${this.baseUrl}${letter}/`;
        const mainPageArtists = await this.scrapeArtistsPage(mainLetterUrl);
        this.artists = this.artists.concat(mainPageArtists);
        
        // Then get all sub-letters and scrape each
        const subLetters = await this.getSubLetters(letter);
        for (const subLetter of subLetters) {
          // Skip the first sub-letter as it's the same as the main page we just scraped
          if (subLetter.text.toLowerCase() === letter.toLowerCase() || 
              subLetter.text.toLowerCase() === letter.toLowerCase() + letter.toLowerCase()) {
            continue;
          }
          
          const subLetterArtists = await this.scrapeArtistsPage(subLetter.url);
          this.artists = this.artists.concat(subLetterArtists);
          
          // Add a small delay to avoid overloading the server
          await new Promise(resolve => setTimeout(resolve, 2000));
        }
        
        // Save progress after each letter
        await this.saveProgress(letter);
      }
      
      // Save final results
      await this.saveResults();
      console.log(`Scraping completed. Found ${this.artists.length} artists.`);
    } catch (error) {
      console.error('Error scraping artists:', error);
      throw error;
    }
  }

  /**
   * Save progress after completing a letter
   * @param {string} letter - The letter that was just completed
   */
  async saveProgress(letter) {
    try {
      const filename = path.join(this.outputDir, `artists_${letter}_progress.json`);
      await fs.writeFile(filename, JSON.stringify(this.artists, null, 2));
      console.log(`Progress saved to ${filename}`);
    } catch (error) {
      console.error('Error saving progress:', error);
    }
  }

  /**
   * Save final results to JSON and TXT files
   */
  async saveResults() {
    try {
      // Save as JSON
      const jsonFilename = path.join(this.outputDir, 'artists_A_to_C.json');
      await fs.writeFile(jsonFilename, JSON.stringify(this.artists, null, 2));
      console.log(`Results saved to ${jsonFilename}`);
      
      // Save as TXT (names only)
      const txtFilename = path.join(this.outputDir, 'artists_A_to_C_names.txt');
      const artistNames = this.artists.map(artist => artist.name).join('\n');
      await fs.writeFile(txtFilename, artistNames);
      console.log(`Artist names saved to ${txtFilename}`);
      
      // Save as TXT (names with URLs)
      const txtUrlFilename = path.join(this.outputDir, 'artists_A_to_C_with_urls.txt');
      const artistsWithUrls = this.artists.map(artist => `${artist.name}\t${artist.url}`).join('\n');
      await fs.writeFile(txtUrlFilename, artistsWithUrls);
      console.log(`Artist names with URLs saved to ${txtUrlFilename}`);
    } catch (error) {
      console.error('Error saving results:', error);
    }
  }
}

module.exports = ArtistListScraper; 