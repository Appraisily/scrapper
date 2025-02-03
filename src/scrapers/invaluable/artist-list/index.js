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
    let apiResponse = null;

    try {
      console.log('🔄 Starting A section artist list extraction');
      console.log('📑 Setting up request interception');

      await page.setRequestInterception(true);

      // Intercept requests
      page.on('request', request => {
        const url = request.url();
        if (url.includes('algolia.invaluable.com')) {
          console.log('🔍 Intercepted Algolia request:', url);
          console.log('  • Headers:', request.headers());
        }
        request.continue();
      });

      // Intercept responses
      page.on('response', async response => {
        const url = response.url();
        if (url.includes('algolia.invaluable.com')) {
          console.log('📥 Intercepted Algolia response');
          console.log('  • Status:', response.status());
          
          try {
            const responseData = await response.json();
            console.log('  • Response size:', JSON.stringify(responseData).length, 'bytes');
            apiResponse = responseData;
          } catch (error) {
            console.error('  • Error parsing response:', error.message);
          }
        }
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
      await page.waitForResponse(
        response => response.url().includes('algolia.invaluable.com'),
        { timeout: constants.defaultTimeout }
      );

      if (!apiResponse) {
        throw new Error('No API response captured');
      }

      console.log('✅ API response captured successfully');

      // Save API response
      const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
      const filename = `artists/api/algolia-${timestamp}.json`;
      await this.storage.saveJsonFile(filename, apiResponse);

      // Process artists from response
      const artists = apiResponse.results[0].hits.map(hit => ({
        name: `${hit.firstName} ${hit.lastName}`.trim(),
        count: hit.totalCount,
        url: `https://www.invaluable.com/artist/${hit.artistRef}`,
        subindex: hit['alpha.lvl1'].split(' > ')[1]
      }));

      return {
        success: true,
        artists,
        timestamp: new Date().toISOString(),
        source: 'invaluable',
        section: 'A',
        totalFound: artists.length
      };

    } catch (error) {
      console.error('Error getting artist list:', error);
      throw error;
    } finally {
      await page.close();
    }
  }
}

module.exports = ArtistListScraper;