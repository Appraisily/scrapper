const { constants } = require('../utils');
const ApiMonitor = require('./api-monitor');

class SearchManager {
  constructor(browserManager) {
    this.browserManager = browserManager;
    this.searchUrl = 'https://www.invaluable.com/search?supercategoryName=Furniture&priceResult[min]=250&upcoming=false&query=furniture&keyword=furniture';
    this.delay = ms => page.evaluate(ms => new Promise(r => setTimeout(r, ms)), ms);
  }

  async searchFurniture(cookies) {
    try {
      const page = this.browserManager.getPage();
      console.log('🔄 Starting furniture search process');
      
      // Reset page
      await page.setRequestInterception(false);
      await page.removeAllListeners('request');
      await page.removeAllListeners('response');
      
      // Set cookies
      await page.setCookie(...cookies);
      
      let initialHtml = null;
      let protectionHtml = null;
      let finalHtml = null;

      const apiMonitor = new ApiMonitor();
      console.log('👀 Step 3: Enabling API request interception');
      await page.setRequestInterception(true);
      apiMonitor.setupRequestInterception(page);
      
      console.log('🌐 Step 4: Navigating to furniture search URL');

      try {
        console.log('  • Starting navigation with API monitoring');
        await page.goto(this.searchUrl, {
          waitUntil: 'networkidle0',
          timeout: constants.navigationTimeout
        });
        console.log('  • Navigation complete');

        await this.delay(2000);

        console.log('📄 Step 5: Capturing initial HTML');
        initialHtml = await page.content();
        console.log(`  • Size: ${(initialHtml.length / 1024).toFixed(2)} KB`);

        if (initialHtml.includes('checking your browser') || 
            initialHtml.includes('Access to this page has been denied')) {
          console.log('🛡️ Step 6a: Protection page detected');
          protectionHtml = initialHtml;
          console.log('🤖 Step 6b: Processing protection challenge');
          await this.browserManager.handleProtection();
          await this.delay(2000);
          console.log('✅ Step 6c: Protection cleared');
          await page.goto(this.searchUrl, { waitUntil: 'networkidle0', timeout: constants.navigationTimeout });
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

        await this.delay(2000);

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
        url: this.searchUrl
      };
    } catch (error) {
      console.error('Furniture search error:', error);
      throw error;
    }
  }
}

module.exports = SearchManager;