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
    // Create a new tab for each artist
    const page = await this.browserManager.browser.newPage();
    
    // Reset request interception and listeners
    await page.setRequestInterception(false);
    await page.removeAllListeners('request');
    await page.removeAllListeners('response');
    
    try {
      // Prepare cookies with required fields
      const validatedCookies = cookies.map(cookie => {
        const baseCookie = {
          name: cookie.name,
          value: cookie.value,
          domain: cookie.domain || '.invaluable.com',
          path: cookie.path || '/',
          expires: -1,
          httpOnly: true,
          secure: true,
          sameSite: 'None'
        };

        // Special handling for specific cookies
        if (cookie.name === 'cf_clearance') {
          baseCookie.sameSite = 'Lax';
        }

        return baseCookie;
      });

      // Always set cookies before each request
      console.log(`🍪 Setting ${validatedCookies.length} cookies for ${artist}`);
      await page.setCookie(...validatedCookies);

      // Verify cookies were set
      const currentCookies = await page.cookies('https://www.invaluable.com');
      console.log('  • Verified cookies:', currentCookies.map(c => c.name).join(', '));

      // Ensure critical cookies are present
      const requiredCookies = ['cf_clearance', 'AZTOKEN-PROD'];
      const missingCookies = requiredCookies.filter(name => 
        !currentCookies.some(c => c.name === name)
      );

      if (missingCookies.length > 0) {
        throw new Error(`Missing required cookies: ${missingCookies.join(', ')}`);
      }
      
      // Properly construct the search URL
      const searchParams = new URLSearchParams({
        'priceResult[min]': '250',
        'upcoming': 'false',
        'query': artist,
        'keyword': artist
      });
      const searchUrl = `https://www.invaluable.com/search?${searchParams.toString()}`;
      console.log(`🔗 Search URL: ${searchUrl}`);
      
      try {
        // Process search
        const searchResult = await this.processArtistSearch(page, searchUrl);
        return {
          artist,
          ...searchResult
        };
      } finally {
        // Close the tab when done
        await page.close();
      }
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
    let cookies = await page.cookies('https://www.invaluable.com');

    try {
      await page.goto(searchUrl, {
        waitUntil: 'networkidle0',
        waitUntil: ['domcontentloaded', 'networkidle0'],
        timeout: constants.navigationTimeout,
        referer: 'https://www.invaluable.com/',
        headers: {
          'Cookie': cookies.map(c => `${c.name}=${c.value}`).join('; ')
        }
      });

      // Wait for initial page load
      await page.evaluate(() => new Promise(r => setTimeout(r, 3000)));
      
      // Verify cookies after navigation
      const postNavCookies = await page.cookies('https://www.invaluable.com');
      console.log('  • Post-navigation cookies:', postNavCookies.map(c => `${c.name} (${c.domain})`).join(', '));

      // Handle protection if needed
      const pageContent = await page.content();
      if (pageContent.includes('checking your browser') || 
          pageContent.includes('Access to this page has been denied')) {
        console.log('🛡️ Step 6a: Protection page detected');
        console.log('🤖 Step 6b: Handling protection challenge');
        await this.browserManager.handleProtection();
        
        // Get updated cookies after protection
        const postProtectionCookies = await page.cookies();
        console.log('  • Post-protection cookies:', postProtectionCookies.map(c => `${c.name} (${c.domain})`).join(', '));
      }

      // Wait for search results or no results message
      try {
        await page.waitForFunction(() => {
          return document.querySelector('.lot-search-result') !== null ||
                 document.querySelector('.no-results-message') !== null;
        }, { 
          timeout: constants.defaultTimeout,
          polling: 1000 // Poll every second
        });
      } catch (waitError) {
        console.log('⚠️ Search results not found within timeout, capturing current state');
        console.log('Current page URL:', page.url());
      }

      const apiData = apiMonitor.getData();
      console.log('📊 Step 9: Final status:');
      console.log(`  • API responses captured: ${apiData.responses.length}`);
      console.log(`  • First response: ${apiMonitor.hasFirstResponse() ? '✅' : '❌'}`);

      return {
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