# Artist Scraper Orchestrator

## Overview

This document outlines the implementation of an orchestrator for scraping auction data for individual artists from Invaluable. The orchestrator will:

1. Read artist information from the `artists.json` file
2. Use each artist's display name as the search query
3. Save results in a structured format in Google Cloud Storage
4. Track progress and handle failures gracefully

## Implementation Details

### Folder Structure

```
/invaluable-data/
  /artists/
    /[Artist Display Name]/
      /data/
        page_1.json
        page_2.json
        ...
      /images/
        [lot-number]_1.jpg
        [lot-number]_2.jpg
        ...
```

### Code Implementation

```javascript
/**
 * Artist Scraper Orchestrator
 * 
 * Reads artist information from artists.json and orchestrates
 * the scraping process for each artist, saving results to GCS.
 */
const fs = require('fs').promises;
const path = require('path');
const { InvaluableScraper } = require('./src/scrapers/invaluable');
const SearchStorageService = require('./src/utils/search-storage');

class ArtistScraperOrchestrator {
  constructor(options = {}) {
    // Main folder name for all artist data
    this.mainFolder = 'artists';
    
    // Configuration for the scraper
    this.maxConcurrent = options.maxConcurrent || 1; // Default to 1 concurrent scrape
    this.delayBetweenArtists = options.delayBetweenArtists || 5000; // 5 second delay between artists
    this.maxRetries = options.maxRetries || 3; // Number of retries per artist
    this.artistsFilePath = options.artistsFilePath || 'artists.json';
    this.saveImages = options.saveImages !== false; // Default to true
    this.startIndex = options.startIndex || 0; // Start from this index in the artists array
    this.maxArtists = options.maxArtists || 0; // Process all if 0, otherwise limit to this number
    
    // Storage and tracking
    this.storage = SearchStorageService.getInstance({ keyword: this.mainFolder });
    this.results = {
      total: 0,
      success: 0,
      failed: 0,
      skipped: 0
    };
    
    // Default cookies for API access
    this.defaultCookies = [
      {
        name: 'AZTOKEN-PROD',
        value: '1CA056EF-FA81-41E5-A17D-9BAF5700CB29',
        domain: '.invaluable.com'
      },
      {
        name: 'cf_clearance',
        value: 'Yq4QHU.y14z93vU3CmLCK80CU7Pq6pgupmW0eM8k548-1738320515-1.2.1.1-ZFXBFgIPHghfvwwfhRbZx27.6zPihqfQ4vGP0VY1v66mKc.wwAOVRiRJhK6ouVt_.wMB30bkeY0r9NK.KUTU4gu7GzZxbyh0EH_gE36kcnHDvGATrI_vFs9y1XHq3PgtlHmBUflqgjcS6x9MC5YpXoeELPYiT0k59IPMn..1cHED7zV6T78hILKinjM6hZ.ZeQwetIN6SPmuvXb7V2z2ddJa64Vg_zUi.euce0SjjJr5ti7tHWoFsTV1DO1MkFwDfUpy1yTCdESho.EwyRgfdfRAlx6njkTmlWNkp1aXcXU',
        domain: '.invaluable.com'
      }
    ];
  }
  
  /**
   * Load artists from JSON file in chunks to handle large file
   * @returns {Array} Array of artist objects
   */
  async loadArtists() {
    console.log(`Loading artists from ${this.artistsFilePath}...`);
    
    try {
      // For large JSON files, we need to use a streaming approach
      // This is a simplified version that assumes the file can fit in memory
      const fileContent = await fs.readFile(this.artistsFilePath, 'utf8');
      const artists = JSON.parse(fileContent);
      
      console.log(`Loaded ${artists.length} artists`);
      return artists;
    } catch (error) {
      console.error(`Error loading artists: ${error.message}`);
      throw error;
    }
  }
  
  /**
   * Check if artist has already been processed by looking for folder
   * @param {string} artistName - The display name of the artist
   * @returns {Promise<boolean>} True if already processed
   */
  async isArtistProcessed(artistName) {
    try {
      return await this.storage.folderExists(this.mainFolder, artistName);
    } catch (error) {
      console.error(`Error checking if artist ${artistName} is processed: ${error.message}`);
      return false;
    }
  }
  
  /**
   * Build search parameters for artist search
   * @param {string} artistName - The display name of the artist
   * @param {number} page - The page number
   * @returns {Object} Search parameters
   */
  buildSearchParams(artistName, page = 1) {
    return {
      query: artistName,
      artistName: artistName, // Use artist name as both query and specific artist filter
      page: page,
      saveImages: this.saveImages ? 'true' : 'false'
    };
  }
  
  /**
   * Process a single artist
   * @param {Object} artist - The artist object from artists.json
   * @returns {Promise<Object>} Result of processing
   */
  async processArtist(artist) {
    const artistName = artist.displayName;
    console.log(`\nProcessing artist: ${artistName}`);
    
    try {
      // Check if artist is already processed
      if (await this.isArtistProcessed(artistName)) {
        console.log(`Artist ${artistName} already processed, skipping...`);
        return { success: false, skipped: true };
      }
      
      // Create a keyword-specific scraper for this artist
      const scraper = new InvaluableScraper({ keyword: this.mainFolder });
      await scraper.initialize();
      
      try {
        // Build search parameters
        const searchParams = this.buildSearchParams(artistName);
        
        // Make a single page request to get metadata
        const initialResult = await scraper.search(searchParams, this.defaultCookies);
        
        // Extract total pages from the metadata
        let totalHits = 0;
        let totalPages = 0;
        let foundMetadata = false;
        
        // Parse metadata from different possible formats
        if (initialResult && typeof initialResult === 'object') {
          if ('nbPages' in initialResult) {
            totalPages = initialResult.nbPages;
            totalHits = initialResult.nbHits || 0;
            foundMetadata = true;
          } else if (initialResult.results?.[0]?.meta?.totalHits) {
            totalHits = initialResult.results[0].meta.totalHits;
            const hitsPerPage = initialResult.results[0].meta.hitsPerPage || 96;
            totalPages = Math.ceil(totalHits / hitsPerPage);
            foundMetadata = true;
          } else if (initialResult.results?.[0]?.nbHits) {
            totalHits = initialResult.results[0].nbHits;
            totalPages = initialResult.results[0].nbPages || Math.ceil(totalHits / 96);
            foundMetadata = true;
          }
        }
        
        if (!foundMetadata) {
          console.error(`Failed to find metadata for artist ${artistName}`);
          return { success: false, error: 'No metadata found' };
        }
        
        console.log(`Found ${totalHits} items across ${totalPages} pages for artist "${artistName}"`);
        
        // Save the first page results
        await this.storage.savePageResults(this.mainFolder, 1, initialResult, artistName);
        
        // If more than one page, scrape all pages
        if (totalPages > 1) {
          console.log(`Starting full search of all ${totalPages} pages for artist "${artistName}"`);
          await scraper.searchAllPages(searchParams, this.defaultCookies, totalPages);
        }
        
        console.log(`Successfully processed artist: ${artistName}`);
        return { success: true, totalHits, totalPages };
      } finally {
        // Always close the scraper
        await scraper.close();
      }
    } catch (error) {
      console.error(`Error processing artist ${artistName}: ${error.message}`);
      return { success: false, error: error.message };
    }
  }
  
  /**
   * Main orchestration method
   */
  async run() {
    console.log('Starting Artist Scraper Orchestrator');
    
    try {
      // Load all artists
      const allArtists = await this.loadArtists();
      this.results.total = allArtists.length;
      
      // Determine range to process
      const endIndex = this.maxArtists > 0 
        ? Math.min(this.startIndex + this.maxArtists, allArtists.length) 
        : allArtists.length;
      
      console.log(`Processing artists from index ${this.startIndex} to ${endIndex-1} (total: ${endIndex - this.startIndex})`);
      
      // Process artists sequentially
      for (let i = this.startIndex; i < endIndex; i++) {
        const artist = allArtists[i];
        
        // Skip if no display name
        if (!artist.displayName) {
          console.log(`Artist at index ${i} has no display name, skipping...`);
          this.results.skipped++;
          continue;
        }
        
        console.log(`[${i+1-this.startIndex}/${endIndex-this.startIndex}] Processing artist: ${artist.displayName}`);
        
        // Process with retries
        let result = null;
        let retries = 0;
        
        while (retries <= this.maxRetries) {
          if (retries > 0) {
            console.log(`Retry ${retries}/${this.maxRetries} for artist: ${artist.displayName}`);
          }
          
          result = await this.processArtist(artist);
          
          if (result.success || result.skipped) {
            break;
          }
          
          retries++;
          if (retries <= this.maxRetries) {
            // Wait longer between retries
            const retryDelay = this.delayBetweenArtists * 2;
            console.log(`Waiting ${retryDelay/1000} seconds before retry...`);
            await new Promise(resolve => setTimeout(resolve, retryDelay));
          }
        }
        
        // Update results
        if (result.success) {
          this.results.success++;
        } else if (result.skipped) {
          this.results.skipped++;
        } else {
          this.results.failed++;
        }
        
        // Log progress
        console.log(`Progress: ${this.results.success} successful, ${this.results.skipped} skipped, ${this.results.failed} failed (${i+1-this.startIndex}/${endIndex-this.startIndex} processed)`);
        
        // Add delay between artists
        if (i < endIndex - 1) {
          console.log(`Waiting ${this.delayBetweenArtists/1000} seconds before next artist...`);
          await new Promise(resolve => setTimeout(resolve, this.delayBetweenArtists));
        }
      }
      
      console.log('\n===== Artist Scraper Orchestrator Complete =====');
      console.log(`Total artists: ${this.results.total}`);
      console.log(`Successfully processed: ${this.results.success}`);
      console.log(`Failed: ${this.results.failed}`);
      console.log(`Skipped (already exist): ${this.results.skipped}`);
      
      return this.results;
    } catch (error) {
      console.error('Error in orchestrator:', error);
      throw error;
    }
  }
}

// Export the orchestrator
module.exports = ArtistScraperOrchestrator;

// Example usage:
/*
const orchestrator = new ArtistScraperOrchestrator({
  maxConcurrent: 1,
  delayBetweenArtists: 5000,
  startIndex: 0, 
  maxArtists: 10, // Process only 10 artists for testing
  saveImages: true
});

orchestrator.run()
  .then(results => {
    console.log('Orchestrator completed successfully:', results);
  })
  .catch(error => {
    console.error('Orchestrator failed:', error);
  });
*/
```

## Command-Line Interface

To make the orchestrator usable as a command-line tool, create a `scrape-artists-orchestrator.js` file:

```javascript
#!/usr/bin/env node

/**
 * Command-line script to run the Artist Scraper Orchestrator
 */
const ArtistScraperOrchestrator = require('./path/to/ArtistScraperOrchestrator');
const yargs = require('yargs/yargs');
const { hideBin } = require('yargs/helpers');

const argv = yargs(hideBin(process.argv))
  .option('start', {
    alias: 's',
    description: 'Starting index in the artists array',
    type: 'number',
    default: 0
  })
  .option('max', {
    alias: 'm',
    description: 'Maximum number of artists to process (0 for all)',
    type: 'number',
    default: 0
  })
  .option('delay', {
    alias: 'd',
    description: 'Delay between artists in milliseconds',
    type: 'number',
    default: 5000
  })
  .option('retries', {
    alias: 'r',
    description: 'Maximum number of retries per artist',
    type: 'number',
    default: 3
  })
  .option('no-images', {
    description: 'Disable image downloading',
    type: 'boolean',
    default: false
  })
  .option('file', {
    alias: 'f',
    description: 'Path to artists.json file',
    type: 'string',
    default: 'artists.json'
  })
  .help()
  .alias('help', 'h')
  .argv;

// Create and run the orchestrator
const orchestrator = new ArtistScraperOrchestrator({
  startIndex: argv.start,
  maxArtists: argv.max,
  delayBetweenArtists: argv.delay,
  maxRetries: argv.retries,
  saveImages: !argv['no-images'],
  artistsFilePath: argv.file
});

console.log('Starting Artist Scraper Orchestrator with options:', {
  startIndex: argv.start,
  maxArtists: argv.max,
  delayBetweenArtists: argv.delay,
  maxRetries: argv.retries,
  saveImages: !argv['no-images'],
  artistsFilePath: argv.file
});

orchestrator.run()
  .then(results => {
    console.log('Orchestrator completed successfully:', results);
    process.exit(0);
  })
  .catch(error => {
    console.error('Orchestrator failed:', error);
    process.exit(1);
  });
```

## Usage Examples

```bash
# Process all artists
node scrape-artists-orchestrator.js

# Process 10 artists starting from index 100
node scrape-artists-orchestrator.js --start 100 --max 10

# Process artists without downloading images
node scrape-artists-orchestrator.js --no-images

# Use a custom artists file
node scrape-artists-orchestrator.js --file path/to/custom-artists.json

# Run with minimal delay (not recommended, may trigger rate limits)
node scrape-artists-orchestrator.js --delay 1000
```

## Implementation Notes

1. **Memory Handling**: The artists.json file is very large. The orchestrator loads it all at once in this example, but for production use, consider implementing a streaming JSON parser or processing the file in chunks.

2. **Error Handling**: The orchestrator includes retry logic for individual artists and gracefully continues in case of failures.

3. **Storage Structure**: Results are saved using the existing SearchStorageService with a consistent structure:
   - Main folder: "artists"
   - Subfolders: Named after each artist (display name)
   - Content includes both JSON data and images

4. **Rate Limiting**: Includes configurable delays between artist processing to avoid overwhelming the target server.

5. **Progress Tracking**: Maintains detailed progress statistics and logs to help monitor long-running processes.

## Potential Enhancements

1. **Resumable Processing**: Add checkpointing to allow for interrupted processes to be resumed.

2. **Parallel Processing**: Implement controlled parallel processing with limit on concurrent scrapes.

3. **Filtered Processing**: Add options to select artists by criteria (e.g., starting with specific letters).

4. **Reporting**: Add detailed reporting of successful and failed artists.

5. **Webhooks**: Add options to notify external systems when the process completes or encounters errors. 