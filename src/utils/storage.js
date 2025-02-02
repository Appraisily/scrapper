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
        await this.initialize();
      }

      const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
      const baseFolder = 'Fine Art';
      const searchId = `${metadata.source}-${metadata.query}-${timestamp}`;

      // Save initial HTML for verification
      const htmlFilename = `${baseFolder}/html/${searchId}.html`;
      const htmlFile = this.storage.bucket(this.bucketName).file(htmlFilename);
      await htmlFile.save(html.html);
      
      // Save raw API response if present
      if (html.apiData?.response) {
        const apiFilename = `${baseFolder}/api/${searchId}.json`;
        const apiFile = this.storage.bucket(this.bucketName).file(apiFilename);
        await apiFile.save(html.apiData.response);
        metadata.files = { html: htmlFilename, api: apiFilename };
      } else {
        metadata.files = { html: htmlFilename };
      }
      
      metadata.captureTimestamp = html.timestamp;

      // Save metadata file
      const metadataFilename = `${baseFolder}/metadata/${searchId}.json`;
      const metadataFile = this.storage.bucket(this.bucketName).file(metadataFilename);
      await metadataFile.save(JSON.stringify(metadata, null, 2));

      console.log(`[Storage] Raw data saved successfully for search ID: ${searchId}`);
      
      return {
        searchId,
        htmlPath: metadata.files.html,
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