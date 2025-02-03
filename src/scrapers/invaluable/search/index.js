const ArtistProcessor = require('./artist-processor');
const ArtistListExtractor = require('./artist-list-extractor');
const ResultSaver = require('./result-saver');

class SearchManager {
  constructor(browserManager) {
    this.browserManager = browserManager;
    this.artistProcessor = new ArtistProcessor(browserManager);
    this.artistListExtractor = new ArtistListExtractor(browserManager);
    this.resultSaver = new ResultSaver();
    this.artists = [
      'Cornelis Johannes van der Aa',
      'Dirk van der Aa',
      'Jens Aabo'
    ];
  }

  async getArtistList() {
    return this.artistListExtractor.extractArtistList();
  }

  async searchWithCookies(cookies) {
    try {
      const allResults = [];
      
      console.log('🔄 Starting multi-artist search process');
      console.log(`📚 Processing ${this.artists.length} artists`);
      
      for (const artist of this.artists) {
        console.log(`\n📚 Processing artist: ${artist}`);
        
        try {
          const result = await this.artistProcessor.processArtist(artist, cookies);
          
          // Save results immediately
          console.log(`💾 Saving results for ${artist}`);
          const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
          const metadata = {
            source: 'invaluable',
            artist,
            timestamp,
            searchParams: {
              priceResult: { min: 250 },
              sort: 'auctionDateAsc'
            },
            status: 'processed'
          };

          await this.resultSaver.saveArtistResults(result, metadata);
          allResults.push(result);
          
        } catch (artistError) {
          console.error(`❌ Error processing artist ${artist}:`, artistError.message);
        }
        
        // Pause between artists
        console.log('⏳ Pausing before next artist...');
        await new Promise(resolve => setTimeout(resolve, 5000));
      }
      
      return {
        results: allResults,
        timestamp: new Date().toISOString()
      };
    } catch (error) {
      console.error('Multi-artist search error:', error);
      throw error;
    }
  }
}

module.exports = SearchManager;