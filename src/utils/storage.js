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
      const searchId = `${metadata.source}-artists-${timestamp}`;
      console.log('📁 Step 14: Starting file saves');

      metadata.files = {};
      
      // Save results for each artist
      metadata.files.artists = [];
      
      for (const result of html.results) {
        const artistId = result.artist.toLowerCase().replace(/[^a-z0-9]+/g, '-');
        const artistFiles = {
          artist: result.artist,
          html: {},
          api: []
        };
        
        if (result.html.initial) {
          console.log(`  • Saving initial HTML for ${result.artist}`);
          const filename = `${baseFolder}/html/${searchId}-${artistId}-initial.html`;
          const file = this.storage.bucket(this.bucketName).file(filename);
          await file.save(result.html.initial);
          artistFiles.html.initial = filename;
        }
        
        if (result.html.protection) {
          console.log(`  • Saving protection HTML for ${result.artist}`);
          const filename = `${baseFolder}/html/${searchId}-${artistId}-protection.html`;
          const file = this.storage.bucket(this.bucketName).file(filename);
          await file.save(result.html.protection);
          artistFiles.html.protection = filename;
        }
        
        if (result.html.final) {
          console.log(`  • Saving final HTML for ${result.artist}`);
          const filename = `${baseFolder}/html/${searchId}-${artistId}-final.html`;
          const file = this.storage.bucket(this.bucketName).file(filename);
          await file.save(result.html.final);
          artistFiles.html.final = filename;
        }
        
        // Save API responses
        if (result.apiData?.responses?.length > 0) {
          console.log(`  • Saving API responses for ${result.artist}`);
          for (let i = 0; i < result.apiData.responses.length; i++) {
            const filename = `${baseFolder}/api/${searchId}-${artistId}-response${i + 1}.json`;
            const file = this.storage.bucket(this.bucketName).file(filename);
            await file.save(result.apiData.responses[i]);
            artistFiles.api.push(filename);
          }
        }
        
        metadata.files.artists.push(artistFiles);
      }
      
      console.log('  • Saving metadata');

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