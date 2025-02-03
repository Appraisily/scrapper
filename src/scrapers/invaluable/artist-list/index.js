const { constants } = require('../utils');

class ArtistListScraper {
  constructor(browserManager, storage) {
    if (!browserManager) throw new Error('Browser manager is required');
    if (!storage) throw new Error('Storage instance is required');
    
    this.browserManager = browserManager;
    this.storage = storage;
  }

  async close() {
    await this.browserManager.close();
  }

  async extractArtistList() {
    const page = await this.browserManager.browser.newPage();
    const apiResponses = [];

    try {
      console.log('🔄 Starting A section artist list extraction');
      console.log('📑 Setting up request interception');

      await page.setRequestInterception(true);

      // Intercept Algolia API requests
      page.on('request', request => {
        const url = request.url();
        if (url.includes('algolia.invaluable.com/1/indexes/*/queries')) {
          console.log('🔍 Intercepted Algolia request:', url);
          
          // Add required Algolia headers
          const headers = {
            ...request.headers(),
            'x-algolia-api-key': 'NO_KEY',
            'x-algolia-application-id': '0HJBNDV358',
            'content-type': 'application/x-www-form-urlencoded'
          };

          request.continue({ headers });
        } else {
          request.continue();
        }
      });

      // Intercept responses
      page.on('response', async response => {
        const url = response.url();
        if (url.includes('algolia.invaluable.com/1/indexes/*/queries')) {
          console.log('📥 Intercepted Algolia response');
          console.log('  • Status:', response.status());
          
          try {
            const responseText = await response.text();
            if (responseText) {
              console.log('  • Response size:', responseText.length, 'bytes');
              apiResponses.push({
                url,
                status: response.status(),
                headers: response.headers(),
                body: responseText,
                timestamp: new Date().toISOString()
              });
            }
          } catch (error) {
            console.error('  • Error parsing response:', error.message);
          }
        }
      });

          
      // Set required headers for the page
      await page.setExtraHTTPHeaders({
        'accept': '*/*',
        'accept-language': 'es-ES,es;q=0.9,en;q=0.8',
        'sec-ch-ua': '"Not A(Brand";v="8", "Chromium";v="132", "Google Chrome";v="132"',
        'sec-ch-ua-mobile': '?0',
        'sec-ch-ua-platform': '"Windows"',
        'sec-fetch-dest': 'empty',
        'sec-fetch-mode': 'cors',
        'sec-fetch-site': 'same-site'
      });

      // Navigate to artists page
      console.log('🌐 Navigating to artists directory');
      await page.goto('https://www.invaluable.com/artists/A/', {
        waitUntil: 'networkidle0',
        timeout: constants.navigationTimeout
      });

      // Wait for potential Cloudflare challenge
      const content = await page.content();
      if (content.includes('checking your browser') || 
          content.includes('Access to this page has been denied')) {
        console.log('🛡️ Protection detected, handling...');
        await this.browserManager.handleProtection();
      }

      // Wait for API response
      console.log('⏳ Waiting for API response...');
      
      // Wait for initial responses
      await new Promise(resolve => setTimeout(resolve, 5000));

      if (apiResponses.length === 0) {
        // Try scrolling to trigger more requests
        await page.evaluate(() => {
          window.scrollBy(0, 500);
        });
        
        // Wait a bit more
        await new Promise(resolve => setTimeout(resolve, 5000));
        
        if (apiResponses.length === 0) {
          throw new Error('No API response captured');
        }
      }

      console.log(`✅ Captured ${apiResponses.length} API responses`);

      // Save raw API responses
      const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
      for (let i = 0; i < apiResponses.length; i++) {
        const response = apiResponses[i];
        const filename = `artists/api/algolia-${timestamp}-${i + 1}.json`;
        await this.storage.saveFile(filename, JSON.stringify(response, null, 2));
        console.log(`  • Saved response ${i + 1} to ${filename}`);
      }

      return {
        success: true,
        responses: apiResponses.length,
        responseUrls: apiResponses.map(r => r.url),
        timestamp: new Date().toISOString(),
        source: 'invaluable',
        section: 'A',
        files: apiResponses.map((_, i) => `artists/api/algolia-${timestamp}-${i + 1}.json`)
      };
    } catch (error) {
      // Even if we hit an error, try to save any responses we did capture
      if (apiResponses.length > 0) {
        console.log('Saving captured responses despite error...');
        const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
        for (let i = 0; i < apiResponses.length; i++) {
          try {
            const response = apiResponses[i];
            const filename = `artists/api/algolia-${timestamp}-${i + 1}.json`;
            await this.storage.saveFile(filename, JSON.stringify(response, null, 2));
            console.log(`  • Saved response ${i + 1} to ${filename}`);
          } catch (saveError) {
            console.error(`Error saving response ${i + 1}:`, saveError.message);
          }
        }
      }

      console.error('Error getting artist list:', error);
      throw error;
    } finally {
      await page.close();
    }
  }
}

module.exports = ArtistListScraper;