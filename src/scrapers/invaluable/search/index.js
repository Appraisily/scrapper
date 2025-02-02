const { constants } = require('../utils');
const ApiMonitor = require('./api-monitor');

class SearchManager {
  constructor(browserManager) {
    this.browserManager = browserManager;
    this.artists = [
      'Cornelis Johannes van der Aa',
      'Dirk van der Aa',
      'Jens Aabo'
    ];
  }

  async getArtistList() {
    try {
      const page = this.browserManager.getPage();
      console.log('🔄 Starting artist list extraction');
      
      const firstLetter = 'A';
      const subLetter = 'a';
      const section = `${firstLetter}${subLetter}`;
      const baseUrl = `https://www.invaluable.com/artists/${firstLetter}/${firstLetter}${subLetter}/?pageType=soldAtAuction`;
      console.log('🌐 Navigating to base page:', baseUrl);
      
      await page.goto(baseUrl, {
        waitUntil: 'networkidle0',
        timeout: constants.navigationTimeout
      });
      
      // Handle protection if needed
      const html = await page.content();
      if (html.includes('checking your browser') || 
          html.includes('Access to this page has been denied')) {
        console.log('🛡️ Protection page detected, handling...');
        await this.browserManager.handleProtection();
        await page.waitForTimeout(2000);
      }
      
      // Extract subindexes first
      console.log('📑 Extracting subindexes');
      const subindexes = await page.evaluate(() => {
        const links = Array.from(document.querySelectorAll('.ais-Hits-list a'));
        return links.map(link => {
          const text = link.textContent.trim();
          const href = link.getAttribute('href');
          return { text, href };
        });
      });
      
      console.log(`Found ${subindexes.length} subindexes:`, subindexes.map(s => s.text).join(', '));
      
      // Process each subindex
      const allArtists = [];
      
      for (const subindex of subindexes) {
        console.log(`\n🔍 Processing subindex: ${subindex.text}`);
        
        // Navigate to subindex page
        await page.goto(subindex.href, {
          waitUntil: 'networkidle0',
          timeout: constants.navigationTimeout
        });
        
        // Wait for artist list to load
        await page.waitForSelector('.ais-Hits-list', { timeout: constants.defaultTimeout });
        
        // Extract artists from this subindex
        const artists = await page.evaluate(() => {
          const items = Array.from(document.querySelectorAll('.ais-Hits-item'));
          return items.map(item => {
            const link = item.querySelector('a');
            const span = item.querySelector('span');
            if (!link || !span) return null;
            
            const url = link.href;
            const fullText = span.textContent;
            const match = fullText.match(/^(.+?)\s*\((\d+)\)$/);
            
            if (!match) return null;
            
            return {
              name: match[1].trim(),
              count: parseInt(match[2], 10),
              url: url
            };
          }).filter(item => item !== null);
        });
        
        console.log(`📝 Found ${artists.length} artists in subindex ${subindex.text}`);
        allArtists.push(...artists);
        
        // Brief pause between subindexes
        await page.waitForTimeout(1000);
      }
      
      console.log(`\n📊 Total artists found across all subindexes: ${allArtists.length}`);
      
      // Sort artists by name
      allArtists.sort((a, b) => a.name.localeCompare(b.name));
      
      return {
        success: true,
        artists: allArtists,
        timestamp: new Date().toISOString(),
        source: 'invaluable',
        section,
        url: baseUrl,
        subindexes: subindexes.map(s => s.text),
        totalFound: allArtists.length
      };
      
    } catch (error) {
      console.error('Error getting artist list:', error);
      throw error;
    }
  }

  async searchWithCookies(cookies) {
    try {
      const page = this.browserManager.getPage();
      
      // Set cookies
      await page.setCookie(...cookies);
      
      console.log('🔄 Starting multi-artist search process');
      console.log(`📚 Processing ${this.artists.length} artists`);
      
      const results = [];
      
      for (const artist of this.artists) {
        console.log(`\n📚 Processing artist: ${artist}`);
        
        const searchUrl = `https://www.invaluable.com/search?priceResult[min]=250&upcoming=false&query=${encodeURIComponent(artist)}&keyword=${encodeURIComponent(artist)}`;
        console.log(`🔗 Search URL: ${searchUrl}`);
        
        const artistResult = await this.processArtistSearch(page, searchUrl, cookies);
        results.push({
          artist,
          ...artistResult
        });
        
        // Brief pause between artists
        await new Promise(resolve => setTimeout(resolve, 2000));
      }
      
      return {
        results,
        timestamp: new Date().toISOString()
      };
    } catch (error) {
      console.error('Multi-artist search error:', error);
      throw error;
    }
  }

  async processArtistSearch(page, url, cookies) {
    try {
      let initialHtml = null;
      let protectionHtml = null;
      let finalHtml = null;

      console.log('🍪 Step 2: Setting authentication cookies');
      await page.setCookie(...cookies);

      // Set up API monitoring before navigation
      const apiMonitor = new ApiMonitor();
      console.log('👀 Step 3: Enabling API request interception');

      // Ensure request interception is properly set up
      const isInterceptionEnabled = await page.evaluate(() => {
        return !!(window.CDP && window.CDP.Network);
      });

      if (isInterceptionEnabled) {
        await page.setRequestInterception(false);
      }
      await page.setRequestInterception(true);
      apiMonitor.setupRequestInterception(page);
      
      console.log('🌐 Step 4: Navigating to search URL');

      try {
        console.log('  • Starting navigation with API monitoring');
        const navigationPromise = page.goto(url, {
          waitUntil: 'networkidle0',
          timeout: constants.navigationTimeout
        });

        await navigationPromise;
        console.log('  • Navigation complete');

        console.log('📄 Step 5: Capturing initial HTML');
        initialHtml = await page.content();
        console.log(`  • Size: ${(initialHtml.length / 1024).toFixed(2)} KB`);

        // Check for protection page
        if (initialHtml.includes('checking your browser') || 
            initialHtml.includes('Access to this page has been denied')) {
          console.log('🛡️ Step 6a: Protection page detected');
          protectionHtml = initialHtml;
          console.log('🤖 Step 6b: Processing protection challenge');
          await this.browserManager.handleProtection();
          console.log('✅ Step 6c: Protection cleared');
          initialHtml = await page.content();
        } else {
          console.log('✅ Step 6: No protection detected');
        }

        // Check if we got the API response during navigation
        if (apiMonitor.hasFirstResponse()) {
          console.log('📥 Step 7: API response captured during navigation');
          console.log(`  • Response size: ${(apiMonitor.getFirstResponseSize() / 1024).toFixed(2)} KB`);
        } else {
          console.log('⚠️ Step 7: No API response captured during navigation');
        }

        // Capture final HTML
        console.log('📄 Step 8: Capturing final state');
        finalHtml = await page.content();
        console.log(`  • Size: ${(finalHtml.length / 1024).toFixed(2)} KB`);

      } catch (error) {
        console.log('❌ Error during process:', error.message);
      }

      try {
        // Clean up request interception
        await page.removeAllListeners('request');
        await page.removeAllListeners('response');
        await page.setRequestInterception(false);
      } catch (error) {
        console.log('⚠️ Cleanup warning:', error.message);
      }

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
        timestamp: new Date().toISOString(),
        url
      };
    } catch (error) {
      console.error('Search with cookies error:', error);
      throw error;
    }
  }
}

module.exports = SearchManager;