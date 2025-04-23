const ArtistListScraper = require('./scraper');

async function main() {
  const scraper = new ArtistListScraper();
  
  try {
    console.log('Starting artist list scraper...');
    await scraper.initialize();
    await scraper.scrapeAllArtists();
    console.log('Scraping completed successfully');
  } catch (error) {
    console.error('Error in main process:', error);
  } finally {
    await scraper.close();
  }
}

// Run the scraper
if (require.main === module) {
  main().catch(console.error);
}

module.exports = { ArtistListScraper }; 