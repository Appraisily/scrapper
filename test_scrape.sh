#!/bin/bash
# Test script to scrape the first 3 keywords
# This is a simplified version for testing the remote service

# Configuration
SERVICE_URL="https://scrapper-856401495068.us-central1.run.app/api/search"
BUCKET_NAME="invaluable-html-archive-images"
INPUT_FILE="KWs.txt"
TEST_COUNT=3 # Number of keywords to test

echo "Testing scrape service with the first $TEST_COUNT keywords"
echo "Service URL: $SERVICE_URL"
echo "Target bucket: $BUCKET_NAME"

# Check if input file exists
if [ ! -f "$INPUT_FILE" ]; then
  echo "Error: Keywords file $INPUT_FILE not found!"
  exit 1
fi

# Get first N keywords
KEYWORDS=$(head -n $TEST_COUNT "$INPUT_FILE")

# Process each test keyword
COUNT=0
for KW in $KEYWORDS; do
  COUNT=$((COUNT + 1))
  
  echo "[$COUNT/$TEST_COUNT] Testing keyword: '$KW'"
  echo "Started at $(date)"
  
  # Prepare the keyword for URL
  CLEAN_KW=$(echo "$KW" | tr ' ' '+')
  
  # Call the scraper service with all options
  echo "Sending request to service..."
  
  RESPONSE=$(curl -s -g "$SERVICE_URL?query=$CLEAN_KW&saveToGcs=true&saveImages=true&bucket=$BUCKET_NAME&fetchAllPages=true")
  
  # Check for successful response
  if [ -z "$RESPONSE" ]; then
    echo "Error: Empty response from service for keyword '$KW'"
    continue
  fi
  
  # Log basic response info
  echo "Response received from service"
  
  # Extract basic stats if jq is available
  if command -v jq &> /dev/null; then
    echo "Response details:"
    echo "- Total Items: $(echo $RESPONSE | jq -r '.pagination.totalItems // 0')"
    echo "- Total Pages: $(echo $RESPONSE | jq -r '.pagination.totalPages // 0')"
    echo "- Results Count: $(echo $RESPONSE | jq -r '.data.totalResults // 0')"
  fi
  
  echo "Completed at $(date)"
  echo "-----------------------------------"
done

echo "Test completed. Check the bucket to verify data was saved correctly."

# Make script executable
chmod +x test_scrape.sh