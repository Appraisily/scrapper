const { constants } = require('../utils');

class ArtistListExtractor {
  constructor(browserManager, storage) {
    this.browserManager = browserManager;
    this.storage = storage;
    this.bucketName = process.env.STORAGE_BUCKET || 'invaluable-html-archive';
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
      await page.waitForFunction(() => {
        return document.querySelector('.ais-Hits-list') !== null ||
               document.querySelector('.no-results-message') !== null;
      }, { timeout: constants.defaultTimeout });
      
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
      const baseUrl = 'https://www.invaluable.com';
      return links
        .map(link => {
          const text = link.textContent.trim();
          const href = link.getAttribute('href');
          // Ensure href starts with a slash and doesn't include domain
          const cleanHref = href.startsWith('http') 
            ? href.replace(/^https?:\/\/[^\/]+/, '')
            : href;
            
          if (cleanHref.match(/\/artists\/A\/A[a-z]\/?/i)) {
            return { 
              text, 
              href: cleanHref // Store clean href without domain
            };
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
      await new Promise(resolve => setTimeout(resolve, 3000));
    }
    
    return allArtists;
  }

  async processSubindex(page, subindex) {
    // Add domain to clean href
    const subindexUrl = new URL(subindex.href, 'https://www.invaluable.com').href;
    console.log(`  • URL: ${subindexUrl}`);
    
    let retryCount = 0;
    const maxRetries = 3;
    let htmlStates = {
      initial: null,
      protection: null,
      final: null
    };
    
    while (retryCount < maxRetries) {
      try {
        await page.goto(subindexUrl, {
          waitUntil: 'networkidle0',
          timeout: constants.navigationTimeout
        });
        
        console.log(`  • Capturing initial HTML for attempt ${retryCount + 1}`);
        htmlStates.initial = await page.content();
        
        const currentHtml = await page.content();
        if (currentHtml.includes('checking your browser') || 
            currentHtml.includes('Access to this page has been denied')) {
          console.log('  • Protection detected, handling...');
          htmlStates.protection = currentHtml;
          await this.browserManager.handleProtection();
        }
        
        await page.waitForSelector('.ais-Hits-list', { timeout: constants.defaultTimeout });
        
        console.log(`  • Capturing final HTML for attempt ${retryCount + 1}`);
        htmlStates.final = await page.content();
        
        const artists = await this.extractArtistsFromPage(page);
        
        // Save HTML states for this subindex
        const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
        const subindexId = subindex.text.toLowerCase().replace(/[^a-z0-9]+/g, '-');
        
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
        
        // Save error state HTML if available
        if (htmlStates.initial) {
          const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
          const subindexId = subindex.text.toLowerCase().replace(/[^a-z0-9]+/g, '-');
          const filename = `artists/subindexes/${subindexId}-${timestamp}-error-attempt-${retryCount}.html`;
          await this.saveHtml(filename, htmlStates.initial);
        }
        
        if (retryCount === maxRetries) {
          console.log(`  • No artists found in subindex ${subindex.text} after ${maxRetries} attempts`);
          return [];
        }
        await new Promise(resolve => setTimeout(resolve, 5000));
      }
    }
    
    return [];
  }
  
  async saveHtml(filename, content) {
    try {
      console.log(`  • Saving HTML: ${filename}`);
      await this.browserManager.getPage().evaluate(ms => new Promise(r => setTimeout(r, ms)), 1000);
      const file = this.storage.bucket(this.bucketName).file(filename);
      await file.save(content);
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

module.exports = ArtistListExtractor;