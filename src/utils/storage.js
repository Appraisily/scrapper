const { Storage } = require('@google-cloud/storage');

class CloudStorage {
  constructor() {
    this.storage = new Storage();
    this.bucketName = 'invaluable-html-archive';
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

      // Parse the HTML data if it's a JSON string
      let parsedData, apiData;
      try {
        parsedData = JSON.parse(html);
        if (parsedData.apiRequests) {
          apiData = {
            apiRequests: parsedData.apiRequests,
            apiEndpoint: parsedData.apiEndpoint,
            apiResponse: parsedData.apiResponse
          };
        }
      } catch (e) {
        // If not JSON, treat as single HTML batch
        parsedData = { initialBatch: html };
      }

      // Parse the HTML data if it's a JSON string
      let parsedData;
      try {
        parsedData = JSON.parse(html);
      } catch (e) {
        // If not JSON, treat as single HTML batch
        parsedData = { initialBatch: html };
      }

      const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
      const baseFolder = 'Fine Art';
      const searchId = `${metadata.source}-${metadata.query}-${timestamp}`;
      
      // Save API data if available
      let apiUrl;
      if (apiData) {
        const apiFilename = `${baseFolder}/api/${searchId}-api.json`;
        const apiFile = this.storage.bucket(this.bucketName).file(apiFilename);
        await apiFile.save(JSON.stringify(apiData, null, 2));
        [apiUrl] = await apiFile.getSignedUrl({
          version: 'v4',
          action: 'read',
          expires: Date.now() + 7 * 24 * 60 * 60 * 1000
        });
        console.log(`[Storage] API data saved: ${apiUrl}`);
      }

      // Save initial batch
      const initialHtmlFilename = `${baseFolder}/html/${searchId}-batch1.html`;
      const initialHtmlFile = this.storage.bucket(this.bucketName).file(initialHtmlFilename);
      await initialHtmlFile.save(parsedData.initialBatch);
      
      // Save second batch if available
      let secondHtmlFilename, secondHtmlFile, secondHtmlUrl;
      if (parsedData.secondBatch) {
        secondHtmlFilename = `${baseFolder}/html/${searchId}-batch2.html`;
        secondHtmlFile = this.storage.bucket(this.bucketName).file(secondHtmlFilename);
        await secondHtmlFile.save(parsedData.secondBatch);
      }
      
      // Save metadata file
      const metadataFilename = `${baseFolder}/metadata/${searchId}.json`;
      const metadataFile = this.storage.bucket(this.bucketName).file(metadataFilename);
      
      // Update metadata with batch information
      metadata.batches = {
        total: parsedData.secondBatch ? 2 : 1,
        totalAvailable: parsedData.totalAvailable || 0,
        hasApiData: !!apiData
      };
      
      if (apiUrl) {
        metadata.apiDataUrl = apiUrl;
      }
      
      await metadataFile.save(JSON.stringify(metadata, null, 2));
      
      // Get signed URLs for both files
      const [initialHtmlUrl] = await initialHtmlFile.getSignedUrl({
        version: 'v4',
        action: 'read',
        expires: Date.now() + 7 * 24 * 60 * 60 * 1000 // 7 days
      });
      
      if (secondHtmlFile) {
        [secondHtmlUrl] = await secondHtmlFile.getSignedUrl({
        version: 'v4',
        action: 'read',
        expires: Date.now() + 7 * 24 * 60 * 60 * 1000 // 7 days
        });
      }
      
      const [metadataUrl] = await metadataFile.getSignedUrl({
        version: 'v4',
        action: 'read',
        expires: Date.now() + 7 * 24 * 60 * 60 * 1000 // 7 days
      });

      console.log(`[Storage] Files saved successfully:
        Batch 1: ${initialHtmlUrl}
        ${secondHtmlUrl ? `Batch 2: ${secondHtmlUrl}\n` : ''}
        Metadata: ${metadataUrl}`);
      
      return {
        searchId,
        htmlUrls: {
          batch1: initialHtmlUrl,
          batch2: secondHtmlUrl
        },
        apiUrl,
        metadataUrl,
        htmlPaths: {
          batch1: initialHtmlFilename,
          batch2: secondHtmlFilename
        },
        apiPath: apiData ? `${baseFolder}/api/${searchId}-api.json` : null,
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