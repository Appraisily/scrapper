#!/bin/bash
# Test script to scrape keywords from KWs.txt
# This version uses the proper working endpoint: /api/search

# Configuration
SERVICE_URL="https://scrapper-856401495068.us-central1.run.app/api/search"
BUCKET_NAME="invaluable-html-archive-images"
INPUT_FILE="KWs.txt"
TEST_COUNT=3 # Number of keywords to test (default)
REQUEST_DELAY=2 # Seconds to wait between requests

# Process command line arguments
if [ "$1" != "" ]; then
  if [[ "$1" =~ ^[0-9]+$ ]]; then
    TEST_COUNT=$1
    echo "Using count: $TEST_COUNT"
  else
    # Single keyword mode
    KEYWORDS=("$1")
    echo "Using single keyword: $1"
    SINGLE_KEYWORD_MODE=true
  fi
fi

if [ "$SINGLE_KEYWORD_MODE" != "true" ]; then
  echo "Testing scrape service with the first $TEST_COUNT keywords from $INPUT_FILE"
  
  # Check if input file exists
  if [ ! -f "$INPUT_FILE" ]; then
    echo "Error: Keywords file $INPUT_FILE not found!"
    exit 1
  fi
  
  # Extract keywords from JSON array format safely by using 'jq' if available
  if command -v jq &> /dev/null; then
    echo "Using jq to parse JSON array"
    # Extract keywords safely with jq
    KEYWORDS_JSON=$(jq -r ".[] | select(. != null)" "$INPUT_FILE" | head -n $TEST_COUNT)
    readarray -t KEYWORDS <<< "$KEYWORDS_JSON"
  else
    echo "jq not found, using simple text extraction (may not be reliable for all JSON formats)"
    # Fallback to manual keywords for reliability
    echo "Using hardcoded test keywords instead"
    KEYWORDS=("furniture" "jewelry" "collectibles" "fine-art" "asian-art")
    KEYWORDS=("${KEYWORDS[@]:0:$TEST_COUNT}")
  fi
fi

echo "Testing scrape service with ${#KEYWORDS[@]} keywords: ${KEYWORDS[*]}"
echo "Service URL: $SERVICE_URL"
echo "Target bucket: $BUCKET_NAME"

# Process each test keyword
COUNT=0
for KW in "${KEYWORDS[@]}"; do
  COUNT=$((COUNT + 1))
  
  # Skip empty lines
  if [ -z "$KW" ]; then
    continue
  fi
  
  echo "[$COUNT/${#KEYWORDS[@]}] Testing keyword: '$KW'"
  echo "Started at $(date)"
  
  # Format URL parameters - properly encode query
  ENCODED_KW=$(echo "$KW" | tr ' ' '+')
  
  # Build URL with query parameters - include saveImages=true to download images
  # Add more Invaluable-specific parameters to match their website format
  REQUEST_URL="$SERVICE_URL?query=$ENCODED_KW&keyword=$ENCODED_KW&priceResult%5Bmin%5D=250&upcoming=false&saveToGcs=true&saveImages=true&bucket=$BUCKET_NAME"
  
  echo "Request URL: $REQUEST_URL"
  
  # Send GET request to the search service
  echo "Sending request to service..."
  RESPONSE=$(curl -s "$REQUEST_URL")
  
  # Check for successful response
  if [ -z "$RESPONSE" ]; then
    echo "Error: Empty response from service for keyword '$KW'"
    continue
  fi
  
  # Log basic response info
  echo "Response received from service (first 500 chars):"
  echo "${RESPONSE:0:500}..."
  
  # Extract basic stats if jq is available
  if command -v jq &> /dev/null; then
    echo "Response details:"
    echo "- Total Items: $(echo $RESPONSE | jq -r '.pagination.totalItems // 0')"
    echo "- Total Pages: $(echo $RESPONSE | jq -r '.pagination.totalPages // 0')"
    echo "- Results Count: $(echo $RESPONSE | jq -r '.data.totalResults // 0')"
  fi
  
  echo "Completed at $(date)"
  echo "-----------------------------------"
  
  # Add a delay between requests to avoid overwhelming the service
  if [ $COUNT -lt ${#KEYWORDS[@]} ]; then
    echo "Waiting $REQUEST_DELAY seconds before next request..."
    sleep $REQUEST_DELAY
  fi
done

echo "Test completed. Check the bucket to verify data was saved correctly."
echo "Bucket path: gs://$BUCKET_NAME/"