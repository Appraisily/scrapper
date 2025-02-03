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
        console.log('💾 Initializing storage');
        await this.initialize();
      }

      const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
      const baseFolder = 'Furniture';
      const searchId = `${metadata.source}-furniture-${timestamp}`;
      console.log('📁 Starting file saves');
      console.log('  • Search ID:', searchId);

      metadata.files = {};
      metadata.files.html = {};
      
      // Save HTML files
      if (html.html.initial) {
        console.log('  • Saving initial HTML');
        const filename = `${baseFolder}/html/${searchId}-initial.html`;
        const file = this.storage.bucket(this.bucketName).file(filename);
        await file.save(html.html.initial, {
          contentType: 'text/html',
          metadata: {
            type: 'initial',
            searchId
          }
        });
        metadata.files.html.initial = filename;
        console.log(`    - Saved ${(html.html.initial.length / 1024).toFixed(2)} KB`);
      }
      
      if (html.html.protection) {
        console.log('  • Saving protection HTML');
        const filename = `${baseFolder}/html/${searchId}-protection.html`;
        const file = this.storage.bucket(this.bucketName).file(filename);
        await file.save(html.html.protection, {
          contentType: 'text/html',
          metadata: {
            type: 'protection',
            searchId
          }
        });
        metadata.files.html.protection = filename;
        console.log(`    - Saved ${(html.html.protection.length / 1024).toFixed(2)} KB`);
      }
      
      if (html.html.final) {
        console.log('  • Saving final HTML');
        const filename = `${baseFolder}/html/${searchId}-final.html`;
        const file = this.storage.bucket(this.bucketName).file(filename);
        await file.save(html.html.final, {
          contentType: 'text/html',
          metadata: {
            type: 'final',
            searchId
          }
        });
        metadata.files.html.final = filename;
        console.log(`    - Saved ${(html.html.final.length / 1024).toFixed(2)} KB`);
      }
      
      // Save API responses
      metadata.files.api = [];
      if (html.apiData?.responses?.length > 0) {
        console.log('  • Saving API responses');
        for (let i = 0; i < html.apiData.responses.length; i++) {
          const response = html.apiData.responses[i];
          const filename = `${baseFolder}/api/${searchId}-response${i + 1}.json`;
          const file = this.storage.bucket(this.bucketName).file(filename);
          await file.save(response, {
            contentType: 'application/json',
            metadata: {
              type: 'api_response',
              responseNumber: `${i + 1}`,
              searchId
            }
          });
          metadata.files.api.push(filename);
          console.log(`    - Response ${i + 1}: ${(response.length / 1024).toFixed(2)} KB`);
        }
      }
      
      console.log('  • Saving metadata');
      const metadataFilename = `${baseFolder}/metadata/${searchId}.json`;
      const metadataFile = this.storage.bucket(this.bucketName).file(metadataFilename);
      await metadataFile.save(JSON.stringify(metadata, null, 2), {
        contentType: 'application/json',
        metadata: {
          type: 'metadata',
          searchId
        }
      });

      console.log('✅ All files saved successfully');
      console.log('  Files saved:');
      console.log('    - HTML:', Object.keys(metadata.files.html).length, 'files');
      console.log('    - API:', metadata.files.api.length, 'responses');
      console.log('    - Metadata: 1 file');
      
      return {
        searchId,
        files: metadata.files,
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
        console.log('Initializing storage for JSON save');
        await this.initialize();
      }

      console.log(`Saving JSON file: ${filename}`);
      
      // Create parent directories if they don't exist
      const file = this.storage.bucket(this.bucketName).file(filename);
      
      // Check if file exists
      const [exists] = await file.exists();
      if (exists) {
        console.log('File already exists, updating content');
      }
      
      // Save the file
      await file.save(JSON.stringify(data, null, 2));
      console.log('File saved successfully');

      // Generate signed URL
      const [url] = await file.getSignedUrl({
        version: 'v4',
        action: 'read',
        expires: Date.now() + 7 * 24 * 60 * 60 * 1000
      });
      console.log('Generated signed URL');

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