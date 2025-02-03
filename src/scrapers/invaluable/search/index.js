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
      console.log('🔄 Starting A section artist list extraction');
      
      const firstLetter = 'A';
      const baseUrl = `https://www.invaluable.com/artists/${firstLetter}/?pageType=soldAtAuction`;
      console.log('🌐 Navigating to base page:', baseUrl);
      
      let initialHtml = '';
      let finalHtml = '';
      
      await page.goto(baseUrl, {
        waitUntil: 'networkidle0',
        timeout: constants.navigationTimeout
      });
      
      // Capture initial HTML immediately
      console.log('📄 Capturing initial HTML state');
      initialHtml = await page.content();
      
      // Handle protection if needed
      if (initialHtml.includes('checking your browser') || 
          initialHtml.includes('Access to this page has been denied')) {
        console.log('🛡️ Protection page detected, handling...');
        await this.browserManager.handleProtection();
        await new Promise(resolve => setTimeout(resolve, 2000));
        
        // Get updated HTML after protection
        await page.goto(baseUrl, {
          waitUntil: 'networkidle0',
          timeout: constants.navigationTimeout
        });
        initialHtml = await page.content();
      }
      
      // Extract subindexes first
      console.log('📑 Extracting subindexes');
      const subindexes = await page.evaluate(() => {
        const links = Array.from(document.querySelectorAll('a[href*="/artists/A/"]'));
        return links
          .map(link => {
            const text = link.textContent.trim();
            const href = link.getAttribute('href');
            // Only include Aa, Ab, Ac, etc.
            if (href.match(/\/artists\/A\/A[a-z]\/?/i)) {
              return { text, href };
            }
            return null;
          })
          .filter(item => item !== null);
      });
      
      console.log(`Found ${subindexes.length} subindexes:`, subindexes.map(s => s.text).join(', '));
      
      // Process each A subindex
      const allArtists = [];
      
      for (const subindex of subindexes) {
        console.log(`\n🔍 Processing subindex: ${subindex.text}`);
        
        const subindexUrl = `https://www.invaluable.com${subindex.href}`;
        console.log(`  • URL: ${subindexUrl}`);
        
        await page.goto(subindexUrl, {
          waitUntil: 'networkidle0',
          timeout: constants.navigationTimeout
        });
        
        // Handle protection if needed
        const currentHtml = await page.content();
        if (currentHtml.includes('checking your browser') || 
            currentHtml.includes('Access to this page has been denied')) {
          console.log('  • Protection detected, handling...');
          await this.browserManager.handleProtection();
          await new Promise(resolve => setTimeout(resolve, 2000));
          await page.goto(subindexUrl, {
            waitUntil: 'networkidle0',
            timeout: constants.navigationTimeout
          });
        }
        
        // Wait for artist list
        try {
          await page.waitForSelector('.ais-Hits-list', { timeout: constants.defaultTimeout });
        } catch (error) {
          console.log(`  • No artists found in subindex ${subindex.text}`);
          continue;
        }
        
        // Extract artists
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
              url: url,
              subindex: link.href.split('/artists/A/')[1]?.split('/')[0] || ''
            };
          }).filter(item => item !== null);
        });
        
        console.log(`📝 Found ${artists.length} artists in subindex ${subindex.text}`);
        if (artists.length > 0) {
          console.log(`  • Sample artist: ${artists[0].name} (${artists[0].count})`);
        }
        
        allArtists.push(...artists);
        
        // Longer pause between subindexes to avoid rate limiting
        await new Promise(resolve => setTimeout(resolve, 3000));
      }
      
      console.log(`\n📊 Total artists found across all subindexes: ${allArtists.length}`);
      
      // Sort artists by name
      allArtists.sort((a, b) => a.name.localeCompare(b.name));
      
      // Capture final HTML state
      console.log('📄 Capturing final HTML state');
      finalHtml = await page.content();
      
      return {
        success: true,
        artists: allArtists,
        initialHtml,
        finalHtml,
        timestamp: new Date().toISOString(),
        source: 'invaluable',
        section: 'A',
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
      const results = [];
      
      console.log('🔄 Starting multi-artist search process');
      console.log(`📚 Processing ${this.artists.length} artists`);
      
      for (const artist of this.artists) {
        console.log(`\n📚 Processing artist: ${artist}`);
        
        // Reset page for each artist
        await page.setRequestInterception(false);
        await page.removeAllListeners('request');
        await page.removeAllListeners('response');
        
        // Set fresh cookies for each artist
        await page.setCookie(...cookies);
        
        // Create search URL
        const searchUrl = `https://www.invaluable.com/search?priceResult[min]=250&upcoming=false&query=${encodeURIComponent(artist)}&keyword=${encodeURIComponent(artist)}`;
        console.log(`🔗 Search URL: ${searchUrl}`);
        
        // Process this artist's search
        const artistResult = await this.processArtistSearch(page, searchUrl, cookies);
        results.push({
          artist,
          ...artistResult
        });
        
        // Longer pause between artists to avoid rate limiting
        console.log('⏳ Pausing before next artist...');
        await page.waitForTimeout(5000);
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

      const apiMonitor = new ApiMonitor();
      console.log('👀 Step 3: Enabling API request interception');
      await page.setRequestInterception(true);
      apiMonitor.setupRequestInterception(page);
      
      console.log('🌐 Step 4: Navigating to search URL');

      try {
        console.log('  • Starting navigation with API monitoring');
        await page.goto(url, {
          waitUntil: 'networkidle0',
          timeout: constants.navigationTimeout
        });
        console.log('  • Navigation complete');

        await new Promise(resolve => setTimeout(resolve, 2000));

        console.log('📄 Step 5: Capturing initial HTML');
        initialHtml = await page.content();
        console.log(`  • Size: ${(initialHtml.length / 1024).toFixed(2)} KB`);

        if (initialHtml.includes('checking your browser') || 
            initialHtml.includes('Access to this page has been denied')) {
          console.log('🛡️ Step 6a: Protection page detected');
          protectionHtml = initialHtml;
          console.log('🤖 Step 6b: Processing protection challenge');
          await this.browserManager.handleProtection();
          await new Promise(resolve => setTimeout(resolve, 2000));
          console.log('✅ Step 6c: Protection cleared');
          await page.goto(url, { waitUntil: 'networkidle0', timeout: constants.navigationTimeout });
          initialHtml = await page.content();
        } else {
          console.log('✅ Step 6: No protection detected');
        }

        if (apiMonitor.hasFirstResponse()) {
          console.log('📥 Step 7: API response captured during navigation');
          console.log(`  • Response size: ${(apiMonitor.getFirstResponseSize() / 1024).toFixed(2)} KB`);
        } else {
          console.log('⚠️ Step 7: No API response captured during navigation');
        }

        await new Promise(resolve => setTimeout(resolve, 2000));

        console.log('📄 Step 8: Capturing final state');
        finalHtml = await page.content();
        console.log(`  • Size: ${(finalHtml.length / 1024).toFixed(2)} KB`);

      } catch (error) {
        console.log('❌ Error during process:', error.message);
      }

      const monitorData = apiMonitor.getData();
      console.log('📊 Step 9: Final status:');
      console.log(`  • API responses captured: ${monitorData.responses.length}`);
      console.log(`  • First response: ${apiMonitor.hasFirstResponse() ? '✅' : '❌'}`);

      try {
        await page.removeAllListeners('request');
        await page.removeAllListeners('response');
        await page.setRequestInterception(false);
      } catch (error) {
        console.log('⚠️ Cleanup warning:', error.message);
      }

      return {
        html: {
          initial: initialHtml,
          protection: protectionHtml,
          final: finalHtml
        },
        apiData: monitorData,
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