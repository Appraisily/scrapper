const puppeteer = require('puppeteer');

class WorthpointScraper {
  constructor() {
    this.browser = null;
    this.page = null;
  }

  async initialize() {
    this.browser = await puppeteer.launch({
      headless: 'new',
      args: ['--no-sandbox', '--disable-setuid-sandbox']
    });
    this.page = await this.browser.newPage();
  }

  async login(username, password) {
    try {
      await this.page.goto('https://www.worthpoint.com/login');
      
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