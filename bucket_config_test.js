/**
 * Test script to verify the storage bucket configuration
 * 
 * Usage:
 * node bucket_config_test.js
 */

// Import the modified SearchStorageService
const SearchStorageService = require('./src/utils/search-storage.js');

// Test different configuration scenarios
async function testBucketConfig() {
  console.log('==== Testing Storage Bucket Configuration ====');
  
  // Test default configuration
  const defaultStorage = new SearchStorageService();
  console.log(`Default bucket: ${defaultStorage.bucketName}`);
  
  // Test with custom bucket
  const customStorage = new SearchStorageService({
    bucketName: 'test-custom-bucket'
  });
  console.log(`Custom bucket: ${customStorage.bucketName}`);
  
  // Test with environment variable (simulate by setting process.env)
  const originalEnv = process.env.STORAGE_BUCKET;
  process.env.STORAGE_BUCKET = 'env-bucket-name';
  const envStorage = new SearchStorageService();
  console.log(`Environment bucket: ${envStorage.bucketName}`);
  
  // Restore original environment
  if (originalEnv === undefined) {
    delete process.env.STORAGE_BUCKET;
  } else {
    process.env.STORAGE_BUCKET = originalEnv;
  }
  
  // Test file path construction
  console.log('\n==== Testing Path Construction ====');
  
  // Test page file paths
  const pageFilePath1 = defaultStorage.getPageFilePath('furniture', 1);
  console.log(`Page file path (simple): ${pageFilePath1}`);
  
  const pageFilePath2 = defaultStorage.getPageFilePath('Asian Art', 5, 'Chinese Ceramics');
  console.log(`Page file path (with subcategory): ${pageFilePath2}`);
  
  // Test image file paths
  const imageFilePath1 = defaultStorage.getImageFilePath('furniture', null, 'L12345', 'https://example.com/image.jpg');
  console.log(`Image file path (simple): ${imageFilePath1}`);
  
  const imageFilePath2 = defaultStorage.getImageFilePath('Asian Art', 'Chinese Ceramics', 'L67890', 'https://example.com/image.png');
  console.log(`Image file path (with subcategory): ${imageFilePath2}`);
  
  console.log('\nTest completed successfully');
}

// Run the test
testBucketConfig().catch(error => {
  console.error('Test failed:', error);
  process.exit(1);
}); 