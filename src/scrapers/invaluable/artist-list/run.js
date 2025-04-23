#!/usr/bin/env node

/**
 * Script to run the artist list scraper
 */

const ArtistListScraper = require('./scraper');

async function runScraper() {
  const scraper = new ArtistListScraper();
  
  try {
    console.log('Starting artist list scraper...');
    await scraper.initialize();
    await scraper.scrapeAllArtists();
    console.log('Scraping completed successfully');
    
    // Exit with success
    process.exit(0);
  } catch (error) {
    console.error('Error running artist list scraper:', error);
    
    // Exit with error
    process.exit(1);
  } finally {
    // Make sure browser is closed
    await scraper.close();
  }
}

// Run the script
runScraper(); 