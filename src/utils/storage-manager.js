/**
 * Storage Manager for Google Cloud Storage
 * Handles saving data and checkpoints to specified GCS bucket
 */
const { Storage } = require('@google-cloud/storage');

class StorageManager {
  constructor(options = {}) {
    this.bucketName = options.bucketName || 'invaluable-data';
    this.batchSize = options.batchSize || 100; // Pages per batch file
    
    // Initialize Storage with provided credentials or use default
    if (options.credentials) {
      // Use explicitly provided credentials
      this.storage = new Storage({ 
        credentials: options.credentials 
      });
      console.log('Using provided GCS credentials');
    } else {
      // Use application default credentials or GOOGLE_APPLICATION_CREDENTIALS
      this.storage = new Storage();
      console.log('Using application default credentials for GCS');
    }
    
    this.bucket = this.storage.bucket(this.bucketName);
  }
  
  /**
   * Generate file path for batch data
   */
  getBatchFilePath(category, startPage, endPage) {
    const paddedStart = String(startPage).padStart(3, '0');
    const paddedEnd = String(endPage).padStart(3, '0');
    return `raw/${category}/page_${paddedStart}-${paddedEnd}.json`;
  }
  
  /**
   * Save metadata about the collection
   */
  async saveMetadata(category, metadata) {
    const filePath = `raw/${category}/metadata.json`;
    try {
      const file = this.bucket.file(filePath);
      await file.save(JSON.stringify(metadata, null, 2), {
        contentType: 'application/json',
        gzip: true,
      });
      console.log(`Metadata saved to gs://${this.bucketName}/${filePath}`);
      return `gs://${this.bucketName}/${filePath}`;
    } catch (error) {
      console.error(`Error saving metadata: ${error.message}`);
      throw error;
    }
  }
  
  /**
   * Save batch of pages to GCS
   */
  async saveBatch(category, startPage, endPage, batchData) {
    const filePath = this.getBatchFilePath(category, startPage, endPage);
    
    try {
      const file = this.bucket.file(filePath);
      await file.save(JSON.stringify(batchData, null, 2), {
        contentType: 'application/json',
        gzip: true,
        metadata: {
          cacheControl: 'public, max-age=3600',
        },
      });
      
      console.log(`Batch saved to gs://${this.bucketName}/${filePath}`);
      return `gs://${this.bucketName}/${filePath}`;
    } catch (error) {
      console.error(`Error saving batch: ${error.message}`);
      throw error;
    }
  }
  
  /**
   * Check if a batch file already exists
   */
  async batchExists(category, startPage, endPage) {
    const filePath = this.getBatchFilePath(category, startPage, endPage);
    try {
      const file = this.bucket.file(filePath);
      const [exists] = await file.exists();
      return exists;
    } catch (error) {
      console.error(`Error checking if batch exists: ${error.message}`);
      return false;
    }
  }
  
  /**
   * Get checkpoint data
   */
  async getCheckpoint(category) {
    const filePath = `raw/${category}/checkpoint.json`;
    try {
      const file = this.bucket.file(filePath);
      const [exists] = await file.exists();
      
      if (!exists) {
        return null;
      }
      
      const [content] = await file.download();
      return JSON.parse(content.toString());
    } catch (error) {
      console.error(`Error getting checkpoint: ${error.message}`);
      return null;
    }
  }
  
  /**
   * Save checkpoint data
   */
  async saveCheckpoint(category, checkpointData) {
    const filePath = `raw/${category}/checkpoint.json`;
    try {
      const file = this.bucket.file(filePath);
      await file.save(JSON.stringify(checkpointData, null, 2), {
        contentType: 'application/json',
      });
      console.log(`Checkpoint saved to gs://${this.bucketName}/${filePath}`);
      return `gs://${this.bucketName}/${filePath}`;
    } catch (error) {
      console.error(`Error saving checkpoint: ${error.message}`);
      throw error;
    }
  }
}

module.exports = StorageManager; 