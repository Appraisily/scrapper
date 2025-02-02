const { constants } = require('../utils');
const ApiMonitor = require('./api-monitor');
const ResponseAnalyzer = require('./response-analyzer');
const PaginationHandler = require('./pagination-handler');

class SearchManager {
  constructor(browserManager) {
    this.browserManager = browserManager;
  }

  async getArtistList(cookies) {
    try {
      const page = this.browserManager.getPage();
      console.log('🔄 Starting artist list extraction');
      
      // Set cookies
      await page.setCookie(...cookies);
      
      const url = 'https://www.invaluable.com/artists/A/Aa/?pageType=soldAtAuction';
      console.log('🌐 Navigating to artists page:', url);
      
      await page.goto(url, {
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
      
      // Wait for artist list to load
      await page.waitForSelector('.ais-Hits-list', { timeout: constants.defaultTimeout });
      
      // Extract artist data
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
      
      console.log(`📝 Found ${artists.length} artists`);
      
      return {
        artists,
        timestamp: new Date().toISOString(),
        source: 'invaluable',
        section: 'A/Aa',
        url
      };
      
    } catch (error) {
      console.error('Error getting artist list:', error);
      throw error;
    }
  }

  async searchItems(params = {}) {
    try {
      const page = this.browserManager.getPage();
      const searchUrl = this.buildSearchUrl(params);
      
      console.log('Navigating to:', searchUrl.toString());
      await page.goto(searchUrl.toString(), { waitUntil: 'networkidle0' });
      
      await page.waitForSelector('.lot-search-result', { timeout: constants.defaultTimeout });
      await this.autoScroll(page);
      
      return this.extractItems(page);
    } catch (error) {
      console.error('Invaluable search error:', error);
      throw error;
    }
  }

  async searchWithCookies(cookies) {
    try {
      const page = this.browserManager.getPage();
      console.log('🔄 Starting multi-artist search process');
      
      const results = [];
      
      for (const artist of this.artists) {
        console.log(`\n📚 Processing artist: ${artist}`);
        
        const searchUrl = this.buildSearchUrl(artist);
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

  buildSearchUrl(artist) {
    const params = new URLSearchParams({
      query: artist,
      priceResult: JSON.stringify({ min: 250 }),
      sort: 'auctionDateAsc'
    });
    return `https://www.invaluable.com/search?${params.toString()}`;
  }

  async processArtistSearch(page, url, cookies) {
      
      let initialHtml = null;
      let protectionHtml = null;
      let finalHtml = null;

      console.log('🍪 Step 2: Setting authentication cookies');
      await page.setCookie(...cookies);

      console.log('👀 Step 3: Enabling API request interception');
      await page.setRequestInterception(true);
      const apiMonitor = new ApiMonitor();
      apiMonitor.setupRequestInterception(page);

      console.log('🌐 Step 4: Navigating to search URL');

      try {
        await page.goto(url, {
          waitUntil: 'networkidle0',
          timeout: constants.navigationTimeout
        });

        console.log('📄 Step 5: Initial page HTML captured');
        initialHtml = await page.content();
        
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

        console.log('⏳ Step 7: Waiting for first API response');
        
        try {
          if (apiMonitor.hasFirstResponse()) {
            console.log('📥 Step 8: First API response already captured');
          } else {
            await page.waitForResponse(
              response => response.url().includes('catResults'),
              { timeout: constants.defaultTimeout }
            );
            console.log('📥 Step 8: First API response captured');
          }
        } catch (error) {
          console.log('⚠️ Step 8 failed: Timeout waiting for first API response');
        }

        console.log('⌛ Step 9: Brief pause before load more');
        await new Promise(resolve => setTimeout(resolve, 2000));

        const loadMoreButton = await page.$('.load-more-button-holder button.load-more-btn');
        if (loadMoreButton) {
          console.log('🔍 Step 10a: Load more button found');
          
          const initialCount = await page.evaluate(() => {
            const countText = document.querySelector('.count-description .total-count')?.textContent;
            const count = countText ? parseInt(countText.replace(/,/g, ''), 10) : 0;
            console.log(`  • 📊 Found count text: "${countText}"`);
            return count;
          });
          console.log(`  • 📈 Total available items: ${initialCount.toLocaleString()}`);
          
          try {
            console.log('🖱️ Step 10b: Clicking load more button');
            console.log('  • Waiting for button to be ready...');
            await Promise.all([
              loadMoreButton.click(),
              page.waitForFunction(() => {
                const btn = document.querySelector('.load-more-button-holder button.load-more-btn');
                return btn && !btn.disabled;
              }, { timeout: constants.defaultTimeout })
            ]);
            console.log('  • ✅ Button clicked successfully');
            
            console.log('⏳ Step 10c: Waiting for second API response');
            await page.waitForResponse(
              response => response.url().includes('catResults'),
              { timeout: constants.defaultTimeout }
            );
            console.log('📥 Step 10d: Second API response captured');
            
            // Wait for new items to be rendered
            console.log('  • Waiting for new items to appear...');
            await page.waitForFunction((prevCount) => {
              const results = document.querySelectorAll('.lot-search-result');
              return results.length > prevCount;
            }, { timeout: constants.defaultTimeout }, initialCount);
            console.log('  • ✅ New items detected');
            
            // Capture intermediate HTML after load more
            const intermediateHtml = await page.content();
            console.log('📄 Step 10e: Captured intermediate HTML state');
            console.log(`  • Size: ${(intermediateHtml.length / 1024).toFixed(2)} KB`);
            
            // Get updated count
            const newCount = await page.evaluate(() => {
              const results = document.querySelectorAll('.lot-search-result');
              console.log(`Found ${results.length} items in DOM`);
              return results.length;
            });
            console.log(`  • 📊 Items loaded: ${newCount.toLocaleString()}`);
            console.log(`  • 📈 Items added: ${(newCount - initialCount).toLocaleString()}`);
            
            // Add intermediate HTML to result
            result.html.afterLoadMore = intermediateHtml;
          } catch (error) {
            console.log('❌ Step 10 failed:');
            console.log(`  • Error: ${error.message}`);
            console.log(`  • Stack: ${error.stack}`);
          }
        } else {
          console.log('ℹ️ Step 10: No load more button found');
          console.log('  • Checked selector: .load-more-button-holder button.load-more-btn');
        }

        console.log('📄 Step 11: Capturing final page state');
        finalHtml = await page.content();
        console.log(`  • Size: ${(finalHtml.length / 1024).toFixed(2)} KB`);

      } catch (error) {
        console.log('❌ Error during process:');
        console.log(`  • Message: ${error.message}`);
        console.log(`  • Stack: ${error.stack}`);
      }

      const apiData = apiMonitor.getData();
      console.log('📊 Step 12: Final status:');
      console.log(`  • Total unique responses: ${apiData.responses.length}`);
      console.log(`  • Response sizes: ${apiData.responses.map(r => (r.length / 1024).toFixed(2) + ' KB').join(', ')}`);
      console.log(`  • First response: ${apiMonitor.hasFirstResponse() ? '✅' : '❌'}`);
      console.log(`  • Second response: ${apiMonitor.hasSecondResponse() ? '✅' : '❌'}`);
      console.log(`  • Total seen responses: ${apiMonitor.seenResponses.size}`);

      return {
        html: {
          initial: initialHtml,
          protection: protectionHtml,
          afterLoadMore: null,
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

  async handleProtectionIfNeeded(page) {
    const html = await page.content();
    if (html.includes('checking your browser') || 
        html.includes('Access to this page has been denied')) {
      console.log('Protection page detected, handling...');
      await this.browserManager.handleProtection();
      
      await page.goto(url, {
        waitUntil: 'networkidle0',
        timeout: constants.navigationTimeout
      });
    }
  }

  async extractItems(page) {
    const items = await page.evaluate(() => {
      const results = Array.from(document.querySelectorAll('.lot-search-result'));
      return results.map(item => ({
        title: item.querySelector('.lot-title-text')?.textContent?.trim() || '',
        price: item.querySelector('.lot-price')?.textContent?.trim() || '',
        date: item.querySelector('.lot-time-remaining')?.textContent?.trim() || '',
        imageUrl: item.querySelector('.lot-image img')?.getAttribute('src') || '',
        auctionHouse: item.querySelector('.auction-house-name')?.textContent?.trim() || '',
        lotNumber: item.querySelector('.lot-number-text')?.textContent?.trim() || '',
        estimate: item.querySelector('.lot-estimate')?.textContent?.trim() || '',
        location: item.querySelector('.auction-house-location')?.textContent?.trim() || '',
        source: 'invaluable'
      }));
    });
    
    console.log(`Found ${items.length} items`);
    return items;
  }

  async autoScroll(page) {
    await page.evaluate(async () => {
      await new Promise((resolve) => {
        let totalHeight = 0;
        const distance = 100;
        const timer = setInterval(() => {
          const scrollHeight = document.documentElement.scrollHeight;
          window.scrollBy(0, distance);
          totalHeight += distance;
          
          if (totalHeight >= scrollHeight) {
            clearInterval(timer);
            resolve();
          }
        }, 100);
      });
    });
    
    await page.evaluate(() => new Promise(r => setTimeout(r, 2000)));
  }
  
  async simulateNaturalScrolling(page) {
    await page.evaluate(async () => {
      const sleep = ms => new Promise(r => setTimeout(r, ms));
      
      // Get total height
      const totalHeight = document.documentElement.scrollHeight;
      let currentPosition = 0;
      
      while (currentPosition < totalHeight) {
        // Random scroll amount between 100-300 pixels
        const scrollAmount = 100 + Math.floor(Math.random() * 200);
        currentPosition += scrollAmount;
        
        // Smooth scroll
        window.scrollTo({
          top: currentPosition,
          behavior: 'smooth'
        });
        
        // Random pause between 500ms and 1.5s
        await sleep(500 + Math.random() * 1000);
      }
    });
    
    // Final pause after scrolling
    await new Promise(resolve => setTimeout(resolve, 1000));
  }
}

module.exports = SearchManager;