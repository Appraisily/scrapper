# GCS Storage Configuration Changes

## Current Issues

The current scraping system has the following issues that need to be addressed:

1. **Bucket Configuration Mismatch**: 
   - `process_all_KWs.sh` targets the bucket "invaluable-html-archive-images"
   - `search-storage.js` uses `process.env.STORAGE_BUCKET` or falls back to "invaluable-html-archive"
   - This mismatch can cause JSON files and images to be stored in different buckets

2. **Storage Structure**:
   - We want all data (JSON files and images) stored in a single bucket with a consistent folder structure:
     - Bucket root: "invaluable-html-archive-images"
     - Main folder: "invaluable-data/"
     - For each keyword: A dedicated subfolder (e.g., "action-figures-/")
     - JSON files: Stored directly in the keyword subfolder
     - Images: Stored in an "images/" subfolder inside each keyword subfolder

## Required Changes

### 1. Update SearchStorageService Configuration

In the `src/utils/search-storage.js` file, we need to update the bucket configuration to always use "invaluable-html-archive-images" unless explicitly overridden:

```javascript
constructor(options = {}) {
  // Use STORAGE_BUCKET environment variable, or the provided bucket name, 
  // or use "invaluable-html-archive-images" as the hardcoded fallback
  this.bucketName = process.env.STORAGE_BUCKET || 
                    options.bucketName || 
                    'invaluable-html-archive-images';
  
  console.log(`Using GCS bucket: ${this.bucketName}`);
  
  // Rest of the constructor remains unchanged
  ...
}
```

### 2. Ensure Correct Path Construction

Verify that the `getPageFilePath` and `getImageFilePath` methods in `search-storage.js` construct paths according to our desired structure:

```javascript
/**
 * Generate file path for page results
 * Format: invaluable-data/{category}/page_XXXX.json
 */
getPageFilePath(category, pageNumber, subcategory = null) {
  const paddedPage = String(pageNumber).padStart(4, '0');
  
  if (subcategory) {
    // If subcategory is provided, use a nested path structure
    const sanitizedCategory = this.sanitizeName(category);
    const sanitizedSubcategory = this.sanitizeName(subcategory);
    return `invaluable-data/${sanitizedCategory}/${sanitizedSubcategory}/page_${paddedPage}.json`;
  } else {
    // Default path structure without subcategory
    const sanitizedCategory = this.sanitizeName(category);
    return `invaluable-data/${sanitizedCategory}/page_${paddedPage}.json`;
  }
}

/**
 * Generate file path for images
 * Format: invaluable-data/{category}/images/{lotNumber}.{extension}
 */
getImageFilePath(category, subcategory, lotNumber, imageUrl) {
  // Extract file extension from URL or default to jpg
  const extension = path.extname(imageUrl).substring(1) || 'jpg';
  
  if (subcategory) {
    // Nested structure
    const sanitizedCategory = this.sanitizeName(category);
    const sanitizedSubcategory = this.sanitizeName(subcategory);
    return `invaluable-data/${sanitizedCategory}/${sanitizedSubcategory}/images/${lotNumber}.${extension}`;
  } else {
    // Flat structure
    const sanitizedCategory = this.sanitizeName(category);
    return `invaluable-data/${sanitizedCategory}/images/${lotNumber}.${extension}`;
  }
}
```

### 3. Improve Check for Existing Files

Ensure that methods that check if files exist use the correct bucket name and path structure. This will prevent redownloading images that are already stored:

```javascript
/**
 * Check if page results exist
 */
async pageResultsExist(category, pageNumber, subcategory = null) {
  if (!category) {
    return false;
  }
  
  const filePath = this.getPageFilePath(category, pageNumber, subcategory);
  
  try {
    const file = this.bucket.file(filePath);
    const [exists] = await file.exists();
    if (exists) {
      console.log(`Page results already exist: gs://${this.bucketName}/${filePath}`);
    }
    return exists;
  } catch (error) {
    console.error(`Error checking if page results exist: ${error.message}`);
    return false;
  }
}

/**
 * Check if image exists
 */
async imageExists(category, lotNumber, subcategory = null, imageUrl) {
  if (!category || !lotNumber) {
    return false;
  }
  
  const filePath = this.getImageFilePath(category, subcategory, lotNumber, imageUrl);
  
  try {
    const file = this.bucket.file(filePath);
    const [exists] = await file.exists();
    if (exists) {
      console.log(`Image already exists: gs://${this.bucketName}/${filePath}`);
    }
    return exists;
  } catch (error) {
    console.error(`Error checking if image exists: ${error.message}`);
    return false;
  }
}
```

### 4. Update Process for Saving Images

Add a check to skip image download if the image already exists:

```javascript
async saveImage(imageUrl, category, lotNumber, subcategory = null, externalBrowser = null) {
  if (!imageUrl || !category || !lotNumber) {
    console.warn('Missing required parameters for saving image');
    return null;
  }
  
  // Check if the image already exists
  const imageAlreadyExists = await this.imageExists(category, lotNumber, subcategory, imageUrl);
  if (imageAlreadyExists) {
    // Return the path of the existing image
    return `gs://${this.bucketName}/${this.getImageFilePath(category, subcategory, lotNumber, imageUrl)}`;
  }
  
  // If it doesn't exist, proceed with downloading and saving
  // ... (rest of the saveImage logic)
}
```

### 5. Update the API Endpoint

Ensure the search API endpoint in `src/routes/search.js` correctly passes the specified bucket name to the storage service:

```javascript
// When creating a storage instance for saving files:
const storageOptions = {};
if (customBucket) {
  console.log(`Using custom bucket: ${customBucket}`);
  storageOptions.bucketName = customBucket;
}

// Create storage instance with custom options if provided
const storage = customBucket 
  ? new SearchStorageService(storageOptions) 
  : searchStorage;
```

## Testing and Deployment

After implementing these changes:

1. Test with a small set of keywords first to verify files are saved to the correct bucket and folder structure.
2. Check existing images are not redownloaded, but missing ones are fetched.
3. Verify JSON files for each page are correctly saved in their respective keyword folders.
4. Update the Cloud Run service with the new code.
5. Run the full keyword processing script to process all keywords.

## Monitoring and Verification

During the full processing:

1. Monitor the Cloud Run service logs for any errors or warnings.
2. Periodically check the GCS bucket to confirm files are being saved in the correct locations.
3. Verify both JSON files and images are stored for each keyword.

This approach ensures we maintain the existing image files while correctly saving JSON files in the same bucket structure. 