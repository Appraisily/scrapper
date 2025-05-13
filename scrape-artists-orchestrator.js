#!/usr/bin/env node

/**
 * Command-line script to run the Artist Scraper Orchestrator
 */
const ArtistScraperOrchestrator = require('./src/orchestrators/artist-scraper-orchestrator');

// Simple command-line argument parsing
const args = process.argv.slice(2);
const options = {
  startIndex: 0,
  maxArtists: 0,
  delayBetweenArtists: 5000,
  maxRetries: 3,
  saveImages: true,
  artistsFilePath: 'artists.json'
};

// Parse arguments
for (let i = 0; i < args.length; i++) {
  const arg = args[i];
  
  if (arg === '--start' || arg === '-s') {
    options.startIndex = parseInt(args[++i]) || 0;
  } else if (arg === '--max' || arg === '-m') {
    options.maxArtists = parseInt(args[++i]) || 0;
  } else if (arg === '--delay' || arg === '-d') {
    options.delayBetweenArtists = parseInt(args[++i]) || 5000;
  } else if (arg === '--retries' || arg === '-r') {
    options.maxRetries = parseInt(args[++i]) || 3;
  } else if (arg === '--no-images') {
    options.saveImages = false;
  } else if (arg === '--file' || arg === '-f') {
    options.artistsFilePath = args[++i] || 'artists.json';
  } else if (arg === '--help' || arg === '-h') {
    console.log(`
Artist Scraper Orchestrator

Usage:
  node scrape-artists-orchestrator.js [options]

Options:
  --start, -s       Starting index in the artists array (default: 0)
  --max, -m         Maximum number of artists to process (default: 0, all)
  --delay, -d       Delay between artists in milliseconds (default: 5000)
  --retries, -r     Maximum number of retries per artist (default: 3)
  --no-images       Disable image downloading
  --file, -f        Path to artists.json file (default: artists.json)
  --help, -h        Show this help
`);
    process.exit(0);
  }
}

// Create and run the orchestrator
const orchestrator = new ArtistScraperOrchestrator(options);

console.log('Starting Artist Scraper Orchestrator with options:', options);

orchestrator.run()
  .then(results => {
    console.log('Orchestrator completed successfully:', results);
    process.exit(0);
  })
  .catch(error => {
    console.error('Orchestrator failed:', error);
    process.exit(1);
  }); 