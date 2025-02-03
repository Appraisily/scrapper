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
    const page = this.browserManager.getPage();
    console.log('🔄 Starting A section artist list extraction');
    
    // Reset page state
    await page.setRequestInterception(false);
    await page.removeAllListeners('request');
    await page.removeAllListeners('response');
    
    const firstLetter = 'A';
    const baseUrl = `https://www.invaluable.com/artists/${firstLetter}/?pageType=soldAtAuction`;
    console.log('🌐 Navigating to base page:', baseUrl);
    
    let initialHtml = null;
    let protectionHtml = null;
    let finalHtml = null;
    
    try {
      console.log('📄 Step 1: Loading initial page');
      await page.goto(baseUrl, {
        waitUntil: 'networkidle0',
        timeout: constants.navigationTimeout
      });
      
      console.log('📄 Step 2: Capturing initial HTML');
      initialHtml = await page.content();
      
      // Handle protection if needed
      if (initialHtml.includes('checking your browser') || 
          initialHtml.includes('Access to this page has been denied')) {
        console.log('🛡️ Step 3a: Protection page detected');
        protectionHtml = initialHtml;
        console.log('🤖 Step 3b: Handling protection challenge');
        await this.browserManager.handleProtection();
        console.log('✅ Step 3c: Protection cleared');
        
        // Get updated HTML after protection
        console.log('📄 Step 3d: Capturing post-protection HTML');
        initialHtml = await page.content();
      }
      
      console.log('🔍 Step 4: Waiting for artist list');
      let artistListFound = false;
      
      try {
        await page.waitForFunction(() => {
          const list = document.querySelector('.ais-Hits-list');
          const noResults = document.querySelector('.no-results-message');
          const loading = document.querySelector('.loading-indicator');
          
          // Consider it ready if we have results or no results message, and no loading indicator
          return (list !== null || noResults !== null) && !loading;
        }, { timeout: constants.defaultTimeout });
        artistListFound = true;
        console.log('✅ Artist list found');
      } catch (waitError) {
        console.log('⚠️ Artist list not found within timeout, capturing current state');
        // Take screenshot for debugging
        try {
          const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
          const screenshotPath = `artists/debug/timeout-${timestamp}.png`;
          const screenshot = await page.screenshot({ fullPage: true });
          await this.storage.saveFile(screenshotPath, screenshot);
          console.log(`  • Debug screenshot saved: ${screenshotPath}`);
        } catch (screenshotError) {
          console.error('Failed to save debug screenshot:', screenshotError.message);
        }
      }
      
      console.log('📑 Step 5: Extracting subindexes');
      const subindexes = await this.extractSubindexes(page);
      console.log(`Found ${subindexes.length} subindexes`);
      
      console.log('🎨 Step 6: Processing artist data');
      const allArtists = await this.processSubindexes(page, subindexes);
      
      // Capture final HTML state
      console.log('📄 Step 7: Capturing final HTML state');
      finalHtml = await page.content();
      
      const result = {
        success: true,
        artists: allArtists,
        artistListFound,
        html: {
          initial: initialHtml,
          protection: protectionHtml,
          final: finalHtml
        },
        timestamp: new Date().toISOString(),
        source: 'invaluable',
        section: 'A',
        url: baseUrl,
        subindexes: subindexes.map(s => s.text),
        totalFound: allArtists.length
      };
      
      console.log(`✅ Step 8: Process complete - Found ${allArtists.length} artists`);
      return result;
      
    } catch (error) {
      console.error('Error getting artist list:', error);
      throw error;
    }
  }

  async extractSubindexes(page) {
    return page.evaluate(() => {
      const links = Array.from(document.querySelectorAll('a[href*="/artists/A/"]'));
      return links
        .map(link => {
          const text = link.textContent.trim();
          const href = link.getAttribute('href');
          // Ensure href starts with a slash
          const cleanHref = href.startsWith('http') 
            ? href.replace(/^https?:\/\/[^\/]+/, '')
            : href;
            
          if (cleanHref.match(/\/artists\/A\/A[a-z]\/?/i)) {
            return { text, href: cleanHref };
          }
          return null;
        })
        .filter(item => item !== null);
    });
  }

  async processSubindexes(page, subindexes) {
    const allArtists = [];
    
    for (const subindex of subindexes) {
      console.log(`\n🔍 Processing subindex: ${subindex.text}`);
      const artists = await this.processSubindex(page, subindex);
      allArtists.push(...artists);
      
      // Add a delay between subindexes to avoid rate limiting
      if (subindexes.indexOf(subindex) < subindexes.length - 1) {
        console.log('⏳ Pausing before next subindex...');
        await new Promise(resolve => setTimeout(resolve, 5000));
      }
    }
    
    return allArtists;
  }

  async processSubindex(page, subindex) {
    const subindexUrl = `https://www.invaluable.com${subindex.href}`;
    console.log(`\n  • Processing URL: ${subindexUrl}`);
    
    let retryCount = 0;
    const maxRetries = 3;
    let htmlStates = {
      initial: null,
      protection: null,
      final: null
    };
    
    while (retryCount < maxRetries) {
      try {
        console.log(`  • Starting attempt ${retryCount + 1}`);
        
        console.log(`  • Navigating to URL`);
        await page.goto(subindexUrl, {
          waitUntil: 'networkidle0',
          timeout: constants.navigationTimeout
        });
        
        await page.evaluate(() => new Promise(r => setTimeout(r, 2000)));
        
        console.log(`  • Capturing initial HTML for attempt ${retryCount + 1}`);
        htmlStates.initial = await page.content();
        
        console.log(`  • Checking for protection`);
        const currentHtml = await page.content();
        if (currentHtml.includes('checking your browser') || 
            currentHtml.includes('Access to this page has been denied')) {
          console.log('  • Protection detected, handling...');
          htmlStates.protection = currentHtml;
          await this.browserManager.handleProtection();
          await page.evaluate(() => new Promise(r => setTimeout(r, 2000)));
        }
        
        console.log(`  • Waiting for content to load`);
        try {
          await page.waitForFunction(() => {
            const list = document.querySelector('.ais-Hits-list');
            const noResults = document.querySelector('.no-results-message');
            const loading = document.querySelector('.loading-indicator');
            return (list !== null || noResults !== null) && !loading;
          }, { timeout: constants.defaultTimeout });
          console.log('  • Content loaded successfully');
        } catch (waitError) {
          console.log('  • Timeout waiting for results, capturing current state');
        }
        
        console.log(`  • Capturing final HTML for attempt ${retryCount + 1}`);
        htmlStates.final = await page.content();
        
        console.log(`  • Extracting artists from page`);
        const artists = await this.extractArtistsFromPage(page);
        console.log(`  • Found ${artists.length} artists`);
        
        // Save HTML states for this subindex
        const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
        const subindexId = `a-${subindex.text.toLowerCase().replace(/[^a-z0-9]+/g, '-')}`;
        
        if (htmlStates.initial) {
          const filename = `artists/subindexes/${subindexId}-${timestamp}-initial.html`;
          await this.saveHtml(filename, htmlStates.initial);
        }
        
        if (htmlStates.protection) {
          const filename = `artists/subindexes/${subindexId}-${timestamp}-protection.html`;
          await this.saveHtml(filename, htmlStates.protection);
        }
        
        if (htmlStates.final) {
          const filename = `artists/subindexes/${subindexId}-${timestamp}-final.html`;
          await this.saveHtml(filename, htmlStates.final);
        }
        
        return artists;
        
      } catch (error) {
        retryCount++;
        console.log(`  • Attempt ${retryCount} failed:`, error.message);
        
        if (retryCount === maxRetries) {
          console.log(`  • No artists found in subindex ${subindex.text} after ${maxRetries} attempts`);
          return [];
        }
        
        // Increase delay between retries
        const retryDelay = 5000 * (retryCount + 1);
        console.log(`  • Waiting ${retryDelay/1000}s before retry...`);
        await new Promise(resolve => setTimeout(resolve, retryDelay));
      }
    }
    
    return [];
  }
  
  async saveHtml(filename, content) {
    try {
      console.log(`  • Saving HTML: ${filename}`);
      await this.storage.saveFile(filename, content);
      console.log(`  • HTML saved successfully: ${filename}`);
    } catch (error) {
      console.error(`  • Error saving HTML ${filename}:`, error.message);
    }
  }

  async extractArtistsFromPage(page) {
    return page.evaluate(() => {
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
  }
}

module.exports = ArtistListScraper;