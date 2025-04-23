#!/bin/bash

# Script to run the artist list scraper

echo "Starting artist list scraper..."

# Change to the project directory
cd "$(dirname "$0")"

# Make sure node_modules are installed
if [ ! -d "node_modules" ]; then
  echo "Installing dependencies..."
  npm install
fi

# Create output directory if it doesn't exist
mkdir -p src/scrapers/invaluable/artist-list/output

# Run the scraper
node src/scrapers/invaluable/artist-list/run.js

echo "Scraping process completed." 