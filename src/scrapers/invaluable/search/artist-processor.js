const { constants } = require('../utils');
const ApiMonitor = require('./api-monitor');

class ArtistProcessor {
  constructor(browserManager) {
    this.browserManager = browserManager;
  }

  async processArtist(artist, cookies) {
    const page = this.browserManager.getPage();
    
    try {
      await page.setRequestInterception(false);
      await page.removeAllListeners('request');
      await page.removeAllListeners('response');
      
      await page.setCookie(...cookies);
      
      // Properly construct the search URL
      const searchParams = new URLSearchParams({
        'priceResult[min]': '250',
        'upcoming': 'false',
        'query': artist,
        'keyword': artist
      });
      const searchUrl = `https://www.invaluable.com/search?${searchParams.toString()}`;
      console.log(`🔗 Search URL: ${searchUrl}`);
      
      // Process search
      const searchResult = await this.processArtistSearch(page, searchUrl);
      return {
        artist,
        ...searchResult
      };
    } catch (error) {
      console.error(`❌ Error processing artist ${artist}:`, error.message);
      throw error;
    }
  }

  async processArtistSearch(page, searchUrl) {
    console.log('👀 Step 3: Enabling API request interception');
    await page.setRequestInterception(true);
    const apiMonitor = new ApiMonitor();
    apiMonitor.setupRequestInterception(page);

    console.log('🌐 Step 4: Navigating to search URL');
    let initialHtml = null;
    let protectionHtml = null;
    let finalHtml = null;

    try {
      // Load page and capture initial HTML
      await page.goto(searchUrl, {
        waitUntil: 'networkidle0',
        timeout: constants.navigationTimeout
      });
      console.log('📄 Step 5: Capturing initial HTML');
      initialHtml = await page.content();
      
      // Handle protection if needed
      if (initialHtml.includes('checking your browser') || 
          initialHtml.includes('Access to this page has been denied')) {
        console.log('🛡️ Step 6a: Protection page detected');
        protectionHtml = initialHtml;
        console.log('🤖 Step 6b: Handling protection challenge');
        await this.browserManager.handleProtection();
        console.log('✅ Step 6c: Protection cleared, capturing new HTML');
        initialHtml = await page.content();
      }

      // Wait for search results or no results message
      await page.waitForFunction(() => {
        return document.querySelector('.lot-search-result') !== null ||
               document.querySelector('.no-results-message') !== null;
      }, { timeout: constants.defaultTimeout });

      // Capture final state
      console.log('📄 Step 8: Capturing final state');
      finalHtml = await page.content();

      const apiData = apiMonitor.getData();
      console.log('📊 Step 9: Final status:');
      console.log(`  • API responses captured: ${apiData.responses.length}`);
      console.log(`  • First response: ${apiMonitor.hasFirstResponse() ? '✅' : '❌'}`);

      return {
        html: {
          initial: initialHtml,
          protection: protectionHtml,
          final: finalHtml
        },
        apiData,
        timestamp: new Date().toISOString()
      };

    } catch (error) {
      console.error('Error during artist search:', error.message);
      throw error;
    }
  }
}

module.exports = ArtistProcessor;