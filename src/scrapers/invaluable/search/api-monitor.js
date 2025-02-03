const { constants } = require('../utils');

class ApiMonitor {
  constructor(storage, artist, timestamp) {
    if (!storage) throw new Error('Storage instance is required');
    if (!artist) throw new Error('Artist name is required');
    if (!timestamp) throw new Error('Timestamp is required');
    
    this.storage = storage;
    this.artist = artist;
    this.timestamp = timestamp;
    this.responses = [];
    this.seenResponses = new Set();
    this.firstResponseCaptured = false;
    this.savedFiles = [];
  }

  setupRequestInterception(page) {
    console.log('Setting up request interception');
    
    // Intercept Algolia API requests
    page.on('request', async (request) => {
      try {
        const url = request.url();
        if (url.includes('algolia.invaluable.com/1/indexes/*/queries')) {
          console.log('  • Intercepting API request:', url);
          const headers = request.headers();
          request.continue({
            headers: {
              ...headers,
              'x-algolia-api-key': 'NO_KEY',
              'x-algolia-application-id': '0HJBNDV358',
              'content-type': 'application/x-www-form-urlencoded'
            }
          });
        } else {
          request.continue();
        }
      } catch (error) {
        if (!error.message.includes('Request is already handled')) {
          console.error('Error intercepting request:', error);
        }
        request.continue();
      }
    });

    page.on('response', async (response) => {
      try {
        const url = response.url();
        if (url.includes('algolia.invaluable.com/1/indexes/*/queries') && response.status() === 200) {
          console.log('  • Received API response:', url);
          response.text().then(responseData => {
            if (responseData.length < 1000) {
              console.log('    - Skipping small response:', responseData.length, 'bytes');
              return;
            }
            
            const responseHash = this.hashResponse(responseData);

            if (this.seenResponses.has(responseHash)) {
              console.log('    - Duplicate response detected');
              return;
            }

            this.seenResponses.add(responseHash);
            console.log('    - New unique response:', (responseData.length / 1024).toFixed(2), 'KB');
            
            // Save response immediately
            this.saveResponse(responseData, url).catch(error => {
              console.error('Error saving response:', error);
            });
          }).catch(error => {
            console.error('    - Error reading response:', error.message);
          });
        }
      } catch (error) {
        if (!error.message.includes('Target closed')) {
          console.error('    - Error handling response:', error.message);
        }
      }
    });
  }

  async saveResponse(responseData, url) {
    try {
      // Create a clean artist ID for filenames
      const artistId = this.artist.toLowerCase().replace(/[^a-z0-9]+/g, '-');
      
      // Organize files in a clear structure for Algolia responses:
      // invaluable/algolia/
      //   artists/
      //     {artist-id}/
      //       {timestamp}/
      //         responses/
      //           response-{n}.json
      //         metadata.json
      
      const responseCount = this.savedFiles.length + 1;
      const filename = `invaluable/algolia/artists/${artistId}/${this.timestamp}/responses/response-${responseCount}.json`;
      
      // Save the response with metadata
      const responseWithMetadata = {
        artist: this.artist,
        timestamp: new Date().toISOString(),
        url,
        data: JSON.parse(responseData)
      };
      
      await this.storage.saveFile(filename, JSON.stringify(responseWithMetadata, null, 2));
      this.savedFiles.push(filename);
      
      // Save metadata file
      const metadataFilename = `invaluable/algolia/artists/${artistId}/${this.timestamp}/metadata.json`;
      const metadata = {
        artist: this.artist,
        timestamp: this.timestamp,
        searchParams: {
          priceResult: { min: 250 },
          upcoming: false,
          sort: 'auctionDateAsc'
        },
        type: 'algolia',
        responseFiles: this.savedFiles,
        status: 'captured'
      };
      
      await this.storage.saveFile(metadataFilename, JSON.stringify(metadata, null, 2));
      
      console.log(`    - Saved response ${responseCount} to ${filename}`);
      
    } catch (error) {
      console.error(`Error saving response for ${this.artist}:`, error);
      throw error;
    }
  }

  getData() {
    return {
      savedFiles: this.savedFiles,
      responseCount: this.savedFiles.length
    };
  }

  hasResponses() {
    return this.savedFiles.length > 0;
  }
}

module.exports = ApiMonitor;