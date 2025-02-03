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
        console.log('🛡️ Step 1: Protection page detected');
        
        // Add longer wait before handling protection
        console.log('⏳ Step 2: Initial pause before handling protection');
        await new Promise(resolve => setTimeout(resolve, 5000));
        
        console.log('🤖 Step 3: Handling protection challenge');
        try {
          await this.browserManager.handleProtection();
        } catch (protectionError) {
          console.error('❌ Protection handling failed:', protectionError.message);
          throw protectionError;
        }
        
        console.log('⏳ Step 4: Pause after protection cleared');
        await new Promise(resolve => setTimeout(resolve, 5000));
        
        console.log('🔄 Step 5: Reloading page after protection');
        await page.goto(baseUrl, {
          waitUntil: 'networkidle0',
          timeout: constants.navigationTimeout
        });
        
        console.log('📄 Step 6: Capturing post-protection HTML');
        initialHtml = await page.content();
        
        // Verify protection is really cleared
        if (initialHtml.includes('checking your browser') || 
            initialHtml.includes('Access to this page has been denied')) {
          throw new Error('Protection still present after handling');
        }
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
      const allResults = [];
      
      console.log('🔄 Starting multi-artist search process');
      console.log(`📚 Processing ${this.artists.length} artists`);
      
      for (const artist of this.artists) {
        console.log(`\n📚 Processing artist: ${artist}`);
        let artistResult = null;
        
        try {
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
          artistResult = await this.processArtistSearch(page, searchUrl, cookies);
          const result = {
            artist,
            ...artistResult
          };

          // Save this artist's results immediately
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
          // Continue with next artist even if this one fails
        }
          
          // Longer pause between artists to avoid rate limiting
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

  async saveArtistResults(result, metadata) {
    try {
      const timestamp = metadata.timestamp;
      const baseFolder = 'Fine Art/artists';
      const artistId = result.artist.toLowerCase().replace(/[^a-z0-9]+/g, '-');
      const searchId = `${metadata.source}-${artistId}-${timestamp}`;

      console.log(`📁 Saving files for ${result.artist}`);
      
      // Save HTML files
      if (result.html.initial) {
        const filename = `${baseFolder}/${searchId}-initial.html`;
        await this.storage.saveFile(filename, result.html.initial);
        metadata.files = metadata.files || {};
        metadata.files.initial = filename;
      }
      
      if (result.html.protection) {
        const filename = `${baseFolder}/${searchId}-protection.html`;
        await this.storage.saveFile(filename, result.html.protection);
        metadata.files = metadata.files || {};
        metadata.files.protection = filename;
      }
      
      if (result.html.final) {
        const filename = `${baseFolder}/${searchId}-final.html`;
        await this.storage.saveFile(filename, result.html.final);
        metadata.files = metadata.files || {};
        metadata.files.final = filename;
      }
      
      // Save API responses
      if (result.apiData?.responses?.length > 0) {
        metadata.files = metadata.files || {};
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

module.exports = SearchManager;