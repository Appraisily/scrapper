const { Storage } = require('@google-cloud/storage');

class CloudStorage {
  constructor() {
    this.storage = new Storage();
    this.bucketName = process.env.STORAGE_BUCKET || 'invaluable-html-archive';
    this.initialized = false;
  }

  async initialize() {
    if (this.initialized) return;
    
    try {
      const [bucket] = await this.storage.bucket(this.bucketName).exists();
      if (!bucket) {
        throw new Error(`Bucket ${this.bucketName} does not exist`);
      }
      this.initialized = true;
    } catch (error) {
      console.error('[Storage] Error initializing bucket:', error);
      throw error;
    }
  }

  async saveSearchData(html, metadata) {
    try {
      if (!this.initialized) {
        console.log('💾 Step 13: Initializing storage');
        await this.initialize();
      }

      const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
      const baseFolder = 'Fine Art';
      const searchId = `${metadata.source}-${metadata.query}-${timestamp}`;
      console.log('📁 Step 14: Starting file saves');

      // Save all HTML states
      metadata.files = {};
      
      if (html.html.initial) {
        console.log('  • Saving initial HTML');
        const initialHtmlFilename = `${baseFolder}/html/${searchId}-initial.html`;
        const initialHtmlFile = this.storage.bucket(this.bucketName).file(initialHtmlFilename);
        await initialHtmlFile.save(html.html.initial);
        metadata.files.initialHtml = initialHtmlFilename;
      }
      
      if (html.html.protection) {
        console.log('  • Saving protection HTML');
        const protectionHtmlFilename = `${baseFolder}/html/${searchId}-protection.html`;
        const protectionHtmlFile = this.storage.bucket(this.bucketName).file(protectionHtmlFilename);
        await protectionHtmlFile.save(html.html.protection);
        metadata.files.protectionHtml = protectionHtmlFilename;
      }
      
      if (html.html.final) {
        console.log('  • Saving final HTML');
        const finalHtmlFilename = `${baseFolder}/html/${searchId}-final.html`;
        const finalHtmlFile = this.storage.bucket(this.bucketName).file(finalHtmlFilename);
        await finalHtmlFile.save(html.html.final);
        metadata.files.finalHtml = finalHtmlFilename;
      }
      
      // Save API responses if present
      if (html.apiData?.responses?.length > 0) {
        console.log('  • Saving API responses');
        const apiResponses = html.apiData.responses;
        metadata.files.api = [];
        
        for (let i = 0; i < apiResponses.length; i++) {
          console.log(`    - Saving API response ${i + 1}`);
          const apiFilename = `${baseFolder}/api/${searchId}-response${i + 1}.json`;
          const apiFile = this.storage.bucket(this.bucketName).file(apiFilename);
          await apiFile.save(apiResponses[i]);
          metadata.files.api.push(apiFilename);
        }
      }
      
      metadata.captureTimestamp = html.timestamp;
      console.log('  • Saving metadata');

      // Save metadata file
      const metadataFilename = `${baseFolder}/metadata/${searchId}.json`;
      const metadataFile = this.storage.bucket(this.bucketName).file(metadataFilename);
      await metadataFile.save(JSON.stringify(metadata, null, 2));

      console.log('✅ Step 15: All files saved successfully');
      console.log(`  Search ID: ${searchId}`);
      
      return {
        searchId,
        htmlPaths: {
          initial: metadata.files.initialHtml,
          protection: metadata.files.protectionHtml,
          final: metadata.files.finalHtml
        },
        apiPath: metadata.files.api,
        metadataPath: metadataFilename
      };
    } catch (error) {
      console.error('[Storage] Error saving search data:', error);
      throw error;
    }
  }

  async saveJsonFile(filename, data) {
    try {
      if (!this.initialized) {
        await this.initialize();
      }

      const file = this.storage.bucket(this.bucketName).file(filename);
      await file.save(JSON.stringify(data, null, 2));

      const [url] = await file.getSignedUrl({
        version: 'v4',
        action: 'read',
        expires: Date.now() + 7 * 24 * 60 * 60 * 1000
      });

      return url;
    } catch (error) {
      console.error('[Storage] Error saving JSON file:', error);
      throw error;
    }
  }
}

// Export singleton instance
const storage = new CloudStorage();
module.exports = storage;