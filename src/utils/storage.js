const { Storage } = require('@google-cloud/storage');

class CloudStorage {
  constructor() {
    this.storage = new Storage();
    this.bucketName = 'images_free_reports';
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

  async saveScreenshot(buffer, prefix) {
    try {
      if (!this.initialized) {
        await this.initialize();
      }

      const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
      const filename = `scrapper/screenshots/${prefix}-${timestamp}.png`;
      
      const file = this.storage.bucket(this.bucketName).file(filename);
      await file.save(buffer);
      
      const [url] = await file.getSignedUrl({
        version: 'v4',
        action: 'read',
        expires: Date.now() + 7 * 24 * 60 * 60 * 1000 // 7 days
      });

      console.log(`[Storage] Screenshot saved: ${url}`);
      return url;
    } catch (error) {
      console.error('[Storage] Error saving screenshot:', error);
      return null;
    }
  }

  async saveHtml(html, prefix) {
    try {
      if (!this.initialized) {
        await this.initialize();
      }

      const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
      const filename = `scrapper/html/${prefix}-${timestamp}.html`;
      
      const file = this.storage.bucket(this.bucketName).file(filename);
      await file.save(html);
      
      const [url] = await file.getSignedUrl({
        version: 'v4',
        action: 'read',
        expires: Date.now() + 7 * 24 * 60 * 60 * 1000 // 7 days
      });

      console.log(`[Storage] HTML saved: ${url}`);
      return url;
    } catch (error) {
      console.error('[Storage] Error saving HTML:', error);
      return null;
    }
  }
}

// Export singleton instance
const storage = new CloudStorage();
module.exports = storage;