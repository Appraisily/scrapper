const { Storage } = require('@google-cloud/storage');

class CloudStorage {
  constructor() {
    this.storage = new Storage();
    this.bucketName = 'art-market-data';
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
      
      // Save HTML file
      const htmlFilename = `${baseFolder}/html/${searchId}.html`;
      const htmlFile = this.storage.bucket(this.bucketName).file(htmlFilename);
      await htmlFile.save(html);
      
      // Save metadata file
      const metadataFilename = `${baseFolder}/metadata/${searchId}.json`;
      const metadataFile = this.storage.bucket(this.bucketName).file(metadataFilename);
      await metadataFile.save(JSON.stringify(metadata, null, 2));
      
      // Get signed URLs for both files
      const [htmlUrl] = await htmlFile.getSignedUrl({
        version: 'v4',
        action: 'read',
        expires: Date.now() + 7 * 24 * 60 * 60 * 1000 // 7 days
      });
      
      const [metadataUrl] = await metadataFile.getSignedUrl({
        version: 'v4',
        action: 'read',
        expires: Date.now() + 7 * 24 * 60 * 60 * 1000 // 7 days
      });

      console.log(`[Storage] Files saved successfully:
        HTML: ${htmlUrl}
        Metadata: ${metadataUrl}`);
      
      return {
        searchId,
        htmlUrl,
        metadataUrl,
        htmlPath: htmlFilename,
        metadataPath: metadataFilename
      };
    } catch (error) {
      console.error('[Storage] Error saving search data:', error);
      throw error;
    }
  }
}

// Export singleton instance
const storage = new CloudStorage();
module.exports = storage;