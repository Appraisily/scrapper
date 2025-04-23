#!/usr/bin/env node

/**
 * Script to run the Artist Directory Scraper
 * Fetches HTML content from Invaluable artist directory pages
 * 
 * Usage: 
 *   node scrape-artists.js [options]
 * 
 * Options:
 *   --output-dir=DIR     Directory to save HTML files (default: artist_directory)
 *   --min-delay=MS       Minimum delay between requests in ms (default: 1000)
 *   --max-delay=MS       Maximum delay between requests in ms (default: 3000)
 *   --letters=A,B,C      Only scrape specified primary letters (default: all)
 */

const ArtistDirectoryScraper = require('./src/scrapers/artist-directory-scraper');

// Parse command line arguments
const args = process.argv.slice(2);
const options = {
  outputDir: 'artist_directory',
  minDelay: 1000,
  maxDelay: 3000,
  letters: null
};

// Process arguments
args.forEach(arg => {
  if (arg.startsWith('--output-dir=')) {
    options.outputDir = arg.split('=')[1];
  } else if (arg.startsWith('--min-delay=')) {
    options.minDelay = parseInt(arg.split('=')[1], 10);
  } else if (arg.startsWith('--max-delay=')) {
    options.maxDelay = parseInt(arg.split('=')[1], 10);
  } else if (arg.startsWith('--letters=')) {
    options.letters = arg.split('=')[1].split(',');
  }
});

// Initialize scraper with options
const scraper = new ArtistDirectoryScraper({
  outputDir: options.outputDir,
  minDelay: options.minDelay,
  maxDelay: options.maxDelay
});

// Customize letters if specified
if (options.letters) {
  scraper.primaryLetters = options.letters;
  console.log(`Only scraping primary letters: ${options.letters.join(', ')}`);
}

// Display configuration
console.log('Artist Directory Scraper Configuration:');
console.log(`- Output Directory: ${options.outputDir}`);
console.log(`- Delay Range: ${options.minDelay}-${options.maxDelay}ms`);
console.log(`- Primary Letters: ${scraper.primaryLetters.length} letters`);
console.log(`- Secondary Combinations: ${scraper.secondaryLetters.length} per letter`);
console.log(`- Total Pages: ${scraper.primaryLetters.length * (1 + scraper.secondaryLetters.length)}`);

// Run the scraper
(async () => {
  try {
    console.log('\nStarting scraper...');
    const startTime = Date.now();
    
    const results = await scraper.scrapeAll();
    
    const endTime = Date.now();
    const durationMs = endTime - startTime;
    const durationMin = Math.floor(durationMs / 60000);
    const durationSec = Math.floor((durationMs % 60000) / 1000);
    
    console.log(`\nScrape completed in ${durationMin}m ${durationSec}s`);
    console.log(`Results saved to ${options.outputDir}`);
  } catch (error) {
    console.error('Scraper failed with error:', error);
    process.exit(1);
  }
})(); 