#!/bin/bash
# Script to scrape auction data for multiple artists

# Configuration
API_URL=${API_URL:-"http://localhost:8080"}
ENDPOINT="/api/invaluable/scrape-artist"
ARTISTS_FILE=${ARTISTS_FILE:-"artists.txt"}
FIRST_ONLY=false

# Parse command line arguments
while getopts "f" opt; do
  case $opt in
    f)
      FIRST_ONLY=true
      ;;
    \?)
      echo "Invalid option: -$OPTARG" >&2
      echo "Usage: $0 [-f]"
      echo "  -f  Process only the first artist (for testing)"
      exit 1
      ;;
  esac
done

echo "Starting artist scraping script..."
echo "Using API URL: $API_URL"
echo "Using artist list: $ARTISTS_FILE"
if [ "$FIRST_ONLY" = true ]; then
  echo "Mode: Testing (first artist only)"
else
  echo "Mode: Full processing (all artists)"
fi

# Check if the artists file exists
if [ ! -f "$ARTISTS_FILE" ]; then
  echo "Error: Artists file '$ARTISTS_FILE' not found."
  exit 1
fi

# Process artists
processed_count=0
cat "$ARTISTS_FILE" | while read -r artist; do
  # Skip empty lines and comments
  if [[ -z "$artist" || "$artist" =~ ^# ]]; then
    continue
  fi
  
  # If we've already processed one artist and FIRST_ONLY is true, skip
  if [ "$FIRST_ONLY" = true ] && [ $processed_count -gt 0 ]; then
    echo "First artist processed. Skipping remaining artists due to -f flag."
    break
  fi
  
  echo "---------------------------------------"
  echo "Scraping artist: $artist"
  
  # Encode the artist name for URL
  encoded_artist=$(echo "$artist" | jq -s -R -r @uri)
  
  # Make the API call
  echo "Calling API: $API_URL$ENDPOINT?artist=$encoded_artist"
  curl -s "$API_URL$ENDPOINT?artist=$encoded_artist" | jq .
  
  echo "Completed scraping for artist: $artist"
  
  processed_count=$((processed_count + 1))
  
  # If FIRST_ONLY is true, we're done after the first artist
  if [ "$FIRST_ONLY" = true ]; then
    echo "First artist processed. Stopping due to -f flag."
    break
  fi
  
  echo "Waiting before next artist..."
  sleep 10
done

echo "Artist scraping completed!"
echo "Artists processed: $processed_count" 