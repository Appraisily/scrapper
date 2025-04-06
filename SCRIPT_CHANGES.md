# Scraper Script Improvements

## Changes Made

### 1. Modified `process_all_KWs.sh`

#### Resource Optimization Parameters
- Added resource configuration parameters to optimize performance:
  ```bash
  --url-query "imageConcurrency=2"  # Limit parallel image downloads
  --url-query "maxMemoryGB=4"       # Set memory allocation
  ```

#### Error Handling Improvements
- Changed error handling to continue on errors rather than stopping:
  ```bash
  # Old behavior - stopped script on first error:
  echo "Stopping script due to error."
  exit 1 # Exit the script immediately on failure
  
  # New behavior - continues processing other keywords:
  echo "Warning: Continuing despite error to process remaining keywords"
  # Still add to processed log to avoid retrying this problematic keyword
  echo "$keyword" >> "$PROCESSED_LOG"
  ```

#### Reduced Rate Limiting
- Increased delay between keywords from 2 to 5 seconds:
  ```bash
  echo "Waiting 5 seconds before next keyword to reduce rate limiting..."
  sleep 5
  ```

### 2. Fixed Browser Instance Management in `search-storage.js`

#### Robust Error Handling for Event Listeners
- Added proper error handling around `page.removeListener` to handle missing functions:
  ```javascript
  try {
    if (page && typeof page.removeListener === 'function') {
      page.removeListener('request', requestHandler);
    } else {
      console.log('Warning: page.removeListener is not available or not a function');
    }
  } catch (listenerError) {
    console.log(`Warning: Error removing request listener: ${listenerError.message}`);
  }
  ```

### 3. Added Problematic Image Skipping

- Implemented a blacklist to skip known problematic images that cause infinite loops:
  ```javascript
  // Skip known problematic images
  const problematicImages = [
    'H0587-L73067353',
    'H0587-L73067356'
  ];
  
  // Check if this is a known problematic image
  const isProblematic = problematicImages.some(problemId => url.includes(problemId));
  if (isProblematic) {
    console.log(`Skipping known problematic image: ${url}`);
    return `skipped:${url}`;
  }
  ```

- Added handling for skipped images in result processing:
  ```javascript
  if (gcsPath.startsWith('skipped:')) {
    console.log(`Image was skipped: ${gcsPath}`);
    lots[index].imagePath = null;
    lots[index].imageSkipped = true;
    successCount++; // Count as success to avoid retries
    return { success: true, index, skipped: true };
  }
  ```

- Added same problematic image skipping to the fallback method

### 4. Added GCS Logging for Problematic Images

- Created a new method to log problematic images to GCS:
  ```javascript
  async logProblematicImage(imageUrl, category, lotNumber, subcategory = null, reason = 'unknown', additionalInfo = {}) {
    // Create log file for problematic images in GCS
    // Each entry includes detailed information about the failed image
  }
  ```

- Added logging in three key places:
  1. When skipping blacklisted images
  2. When skipping blacklisted images in fallback method
  3. When image download fails after retries

- Log format (JSONL with each entry containing):
  ```javascript
  {
    timestamp: "2025-03-31T00:00:00.000Z",
    imageUrl: "https://image.invaluable.com/...",
    category: "furniture",
    subcategory: "chair",
    lotNumber: "123",
    reason: "blacklisted", // or "download_error", "max_retries_exceeded"
    error: "Error message",
    attempt: 2,
    maxRetries: 2
  }
  ```

- Log file location:
  - `invaluable-data/{category}/{subcategory}/problematic_images.jsonl`
  - One log file per category/subcategory for easy analysis

## Benefits of These Changes

1. **Reliability**: The script will now continue processing all keywords even if some encounter errors
2. **Resource Management**: Limited concurrency and memory usage helps prevent browser crashes
3. **Anti-detection**: Slower processing with longer delays helps avoid anti-scraping measures
4. **Error Handling**: Proper checks before calling functions prevents crashes due to undefined objects
5. **Problem Avoidance**: Known problematic images are skipped to prevent infinite error loops
6. **Traceability**: All problematic images are logged to GCS for later analysis

## Next Steps

1. **Monitoring**: Run the updated script and monitor for any recurring issues
2. **Analysis**: Review the problematic_images.jsonl files to identify patterns in failing images
3. **Further Optimizations**: Consider adjusting concurrency and memory parameters based on results
4. **Blacklist Management**: If more problematic images are found, they can be added to the blacklist
5. **Authentication**: If issues persist, investigate adding better authentication cookies to the requests