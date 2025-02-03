const { constants } = require('../utils');
const ApiMonitor = require('./api-monitor');

class SearchScraper {
  constructor(browserManager, storage) {
    if (!browserManager) throw new Error('Browser manager is required');
    if (!storage) throw new Error('Storage instance is required');
    
    this.browserManager = browserManager;
    this.storage = storage;
    this.artists = [
      'Dirk van der Aa',
      'Jens Aabo'
    ];
  }

  async close() {
    await this.browserManager.close();
  }

  async searchWithCookies(cookies) {
    try {
      const allResults = [];
      
      console.log('🔄 Starting multi-artist search process');
      console.log(`📚 Processing ${this.artists.length} artists`);
      
      for (const artist of this.artists) {
        console.log(`\n📚 Processing artist: ${artist}`);
        
        try {
          const result = await this.processArtist(artist, cookies);
          
          // Save results immediately
          console.log(`💾 Saving results for ${artist}`);
          const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
          const metadata = {
            source: 'invaluable',
            artist,
            timestamp,
            searchParams: {
              priceResult: { min: 250 },
              sort: 'auctionDateAsc'
            },
            status: 'processed'
          };

          await this.saveArtistResults(result, metadata);
          allResults.push(result);
          
        } catch (artistError) {
          console.error(`❌ Error processing artist ${artist}:`, artistError.message);
        }
        
        // Pause between artists
        console.log('⏳ Pausing before next artist...');
        await new Promise(resolve => setTimeout(resolve, 5000));
      }
      
      return {
        results: allResults,
        timestamp: new Date().toISOString()
      };
    } catch (error) {
      console.error('Multi-artist search error:', error);
      throw error;
    }
  }

  async processArtist(artist, cookies) {
    const page = this.browserManager.getPage();
    
    try {
      // Only set cookies for the first artist
      if (!this.cookiesSet) {
        console.log(`🍪 Setting ${cookies.length} cookies for first artist`);
        await page.setCookie(...cookies);
        this.cookiesSet = true;
      }

      const currentCookies = await page.cookies();
      console.log(`  • Verified ${currentCookies.length} cookies set`);
      
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
    if (!this.apiMonitorSet) {
      await page.setRequestInterception(true);
      this.apiMonitorSet = true;
    }

    const apiMonitor = new ApiMonitor();
    apiMonitor.setupResponseMonitoring(page);
    let searchResultsFound = false;

    console.log('🌐 Step 4: Navigating to search URL');
    let initialHtml = null;
    let protectionHtml = null;
    let finalHtml = null;

    try {
      // Load page and capture initial HTML
      await page.goto(searchUrl, {
        waitUntil: 'networkidle0',
        timeout: constants.navigationTimeout,
        referer: 'https://www.invaluable.com/',
        waitUntil: ['domcontentloaded', 'networkidle0']
      });
      
      // Verify cookies after navigation
      const postNavCookies = await page.cookies();
      console.log(`  • Post-navigation cookies: ${postNavCookies.length}`);
      
      // Small delay after navigation
      await page.evaluate(() => new Promise(r => setTimeout(r, 2000)));
      
      console.log('📄 Step 5: Capturing initial HTML');
      initialHtml = await page.content();
      
      // Handle protection if needed
      if (initialHtml.includes('checking your browser') || 
          initialHtml.includes('Access to this page has been denied')) {
        console.log('🛡️ Step 6a: Protection page detected');
        protectionHtml = initialHtml;
        console.log('🤖 Step 6b: Handling protection challenge');
        await this.browserManager.handleProtection();
        
        // Get updated cookies after protection
        const postProtectionCookies = await page.cookies();
        console.log(`  • Post-protection cookies: ${postProtectionCookies.length}`);
        
        console.log('✅ Step 6c: Protection cleared, capturing new HTML');
        initialHtml = await page.content();
      }

      // Wait for search results or no results message
      try {
        await page.waitForFunction(() => {
          return document.querySelector('.lot-search-result') !== null ||
                 document.querySelector('.no-results-message') !== null;
        }, { timeout: constants.defaultTimeout });
        searchResultsFound = true;
      } catch (waitError) {
        console.log('⚠️ Search results not found within timeout, capturing current state');
      }

      // Capture final state
      console.log('📄 Step 8: Capturing final state');
      finalHtml = await page.content();

      const apiData = apiMonitor.getData();
      console.log('📊 Step 9: Final status:');
      console.log(`  • API responses captured: ${apiData.responses.length}`);
      console.log(`  • First response: ${apiMonitor.hasFirstResponse() ? '✅' : '❌'}`);
      console.log(`  • Search results found: ${searchResultsFound ? '✅' : '❌'}`);

      return {
        html: {
          initial: initialHtml,
          protection: protectionHtml,
          final: finalHtml,
          searchResultsFound
        },
        apiData,
        timestamp: new Date().toISOString()
      };

    } catch (error) {
      console.error('Error during artist search:', error.message);
      throw error;
    }
  }

  async saveArtistResults(result, metadata) {
    try {
      const timestamp = metadata.timestamp;
      const baseFolder = 'Fine Art/artists';
      const artistId = result.artist.toLowerCase().replace(/[^a-z0-9]+/g, '-');
      const searchId = `${metadata.source}-${artistId}-${timestamp}`;

      console.log(`📁 Saving files for ${result.artist}`);
      
      // Save HTML files
      metadata.files = {};
      
      if (result.html.initial) {
        const filename = `${baseFolder}/${searchId}-initial.html`;
        await this.storage.saveFile(filename, result.html.initial);
        metadata.files.initial = filename;
      }
      
      if (result.html.protection) {
        const filename = `${baseFolder}/${searchId}-protection.html`;
        await this.storage.saveFile(filename, result.html.protection);
        metadata.files.protection = filename;
      }
      
      if (result.html.final) {
        const filename = `${baseFolder}/${searchId}-final.html`;
        await this.storage.saveFile(filename, result.html.final);
        metadata.files.final = filename;
      }
      
      // Save API responses
      if (result.apiData?.responses?.length > 0) {
        metadata.files.api = [];
        
        for (let i = 0; i < result.apiData.responses.length; i++) {
          const filename = `${baseFolder}/${searchId}-response${i + 1}.json`;
          await this.storage.saveFile(filename, result.apiData.responses[i]);
          metadata.files.api.push(filename);
        }
      }
      
      // Save metadata
      const metadataFilename = `${baseFolder}/${searchId}-metadata.json`;
      await this.storage.saveFile(metadataFilename, JSON.stringify(metadata, null, 2));
      
      console.log(`✅ Saved all files for ${result.artist}`);
      return { searchId, metadata };
    } catch (error) {
      console.error(`Error saving results for ${result.artist}:`, error.message);
      throw error;
    }
  }
}

module.exports = SearchScraper;