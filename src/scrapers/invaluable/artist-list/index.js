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
    const apiResponses = [];
    
    // Required cookies for Algolia API
    const cookies = [
      {
        name: 'AZTOKEN-PROD',
        value: '4F562873-F229-4346-A846-37E9A451FA9E',
        domain: '.invaluable.com',
        path: '/',
        httpOnly: true,
        secure: true,
        sameSite: 'None'
      },
      {
        name: 'cf_clearance',
        value: 'Yq4QHU.y14z93vU3CmLCK80CU7Pq6pgupmW0eM8k548-1738320515-1.2.1.1-ZFXBFgIPHghfvwwfhRbZx27.6zPihqfQ4vGP0VY1v66mKc.wwAOVRiRJhK6ouVt_.wMB30bkeY0r9NK.KUTU4gu7GzZxbyh0EH_gE36kcnHDvGATrI_vFs9y1XHq3PgtlHmBUflqgjcS6x9MC5YpXoeELPYiT0k59IPMn..1cHED7zV6T78hILKinjM6hZ.ZeQwetIN6SPmuvXb7V2z2ddJa64Vg_zUi.euce0SjjJr5ti7tHWoFsTV1DO1MkFwDfUpy1yTCdESho.EwyRgfdfRAlx6njkTmlWNkp1aXcXU',
        domain: '.invaluable.com',
        path: '/',
        httpOnly: true,
        secure: true,
        sameSite: 'Lax'
      }
    ];

    try {
      console.log('🔄 Starting A section artist list extraction');
      console.log('📑 Setting up request interception');

      // Set cookies before navigation
      console.log('🍪 Setting required cookies');
      await page.setCookie(...cookies);

      await page.setRequestInterception(true);

      // Intercept Algolia API requests
      page.on('request', request => {
        const url = request.url();
        if (url.includes('/1/indexes/*/queries')) {
          console.log('🔍 Intercepted Algolia request:', url);
          
          // Add required Algolia headers
          const headers = {
            ...request.headers(),
            'x-algolia-api-key': '6be0576ff61c053d5f9a3225e2a90f76',
            'x-algolia-application-id': '0HJBNDV358',
            'Cookie': cookies.map(c => `${c.name}=${c.value}`).join('; '),
            'content-type': 'application/x-www-form-urlencoded'
          };

          request.continue({ headers });
        } else {
          request.continue();
        }
      });

      // Intercept responses
      page.on('response', async response => {
        const url = response.url();
        if (url.includes('/1/indexes/*/queries')) {
          console.log('📥 Intercepted Algolia response');
          console.log('  • Status:', response.status());
          
          try {
            const responseText = await response.text();
            if (responseText) {
              console.log('  • Response size:', responseText.length, 'bytes');
              apiResponses.push({
                url,
                status: response.status(),
                headers: response.headers(),
                body: responseText,
                timestamp: new Date().toISOString()
              });
            }
          } catch (error) {
            console.error('  • Error parsing response:', error.message);
          }
        }
      });

          
      // Set required headers for the page
      await page.setExtraHTTPHeaders({
        'accept': '*/*',
        'accept-language': 'es-ES,es;q=0.9,en;q=0.8',
        'sec-ch-ua': '"Not A(Brand";v="8", "Chromium";v="132", "Google Chrome";v="132"',
        'sec-ch-ua-mobile': '?0',
        'sec-ch-ua-platform': '"Windows"',
        'sec-fetch-dest': 'empty',
        'sec-fetch-mode': 'cors',
        'sec-fetch-site': 'same-site'
      });

      // Navigate to artists page
      console.log('🌐 Navigating to artists directory');
      await page.goto('https://www.invaluable.com/artists/', {
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
      
      // Wait for initial responses
      await new Promise(resolve => setTimeout(resolve, 5000));

      if (apiResponses.length === 0) {
        // Try scrolling to trigger more requests
        await page.evaluate(() => {
          window.scrollBy(0, 500);
        });
        
        // Wait a bit more
        await new Promise(resolve => setTimeout(resolve, 5000));
        
        if (apiResponses.length === 0) {
          throw new Error('No API response captured');
        }
      }

      console.log(`✅ Captured ${apiResponses.length} API responses`);

      // Save raw API responses
      const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
      for (let i = 0; i < apiResponses.length; i++) {
        const response = apiResponses[i];
        const filename = `artists/api/algolia-${timestamp}-${i + 1}.json`;
        await this.storage.saveFile(filename, JSON.stringify(response, null, 2));
        console.log(`  • Saved response ${i + 1} to ${filename}`);
      }

      return {
        success: true,
        responses: apiResponses.length,
        responseUrls: apiResponses.map(r => r.url),
        timestamp: new Date().toISOString(),
        source: 'invaluable',
        section: 'A',
        files: apiResponses.map((_, i) => `artists/api/algolia-${timestamp}-${i + 1}.json`)
      };
    } catch (error) {
      // Even if we hit an error, try to save any responses we did capture
      if (apiResponses.length > 0) {
        console.log('Saving captured responses despite error...');
        const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
        for (let i = 0; i < apiResponses.length; i++) {
          try {
            const response = apiResponses[i];
            const filename = `artists/api/algolia-${timestamp}-${i + 1}.json`;
            await this.storage.saveFile(filename, JSON.stringify(response, null, 2));
            console.log(`  • Saved response ${i + 1} to ${filename}`);
          } catch (saveError) {
            console.error(`Error saving response ${i + 1}:`, saveError.message);
          }
        }
      }

      console.error('Error getting artist list:', error);
      throw error;
    } finally {
      await page.close();
    }
  }
}

module.exports = ArtistListScraper;