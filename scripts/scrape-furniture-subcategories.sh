#!/bin/bash
# Script to scrape all furniture subcategories in sequence

# API URL (default to localhost)
API_URL=${API_URL:-"http://localhost:8080/api"}

# Configuration
MAX_PAGES=${MAX_PAGES:-250}  # Max pages per subcategory
START_PAGE=${START_PAGE:-1}  # Starting page
DELAY=${DELAY:-10}           # Delay between subcategories in seconds

# Get list of all furniture subcategories
echo "Fetching list of furniture subcategories..."
SUBCATEGORIES=$(curl -s "$API_URL/furniture/list" | jq -r '.subcategories[].name')

if [ -z "$SUBCATEGORIES" ]; then
  echo "Error: Failed to fetch subcategories or none were found."
  exit 1
fi

# Count subcategories
TOTAL_SUBCATS=$(echo "$SUBCATEGORIES" | wc -l)
echo "Found $TOTAL_SUBCATS subcategories to process."
echo ""

# Process each subcategory
COUNTER=1
for SUBCAT in $SUBCATEGORIES; do
  echo "[$COUNTER/$TOTAL_SUBCATS] Processing subcategory: $SUBCAT"
  
  # URL encode the subcategory name
  ENCODED_SUBCAT=$(node -e "console.log(encodeURIComponent('$SUBCAT'))")
  
  # Build request URL
  REQUEST_URL="$API_URL/furniture/scrape/$ENCODED_SUBCAT?startPage=$START_PAGE&maxPages=$MAX_PAGES&fetchAllPages=true"
  
  echo "Making request to: $REQUEST_URL"
  START_TIME=$(date +%s)
  
  # Make the request and capture output
  RESPONSE=$(curl -s "$REQUEST_URL")
  END_TIME=$(date +%s)
  DURATION=$((END_TIME - START_TIME))
  
  # Check for success
  SUCCESS=$(echo "$RESPONSE" | jq -r '.success')
  if [ "$SUCCESS" == "true" ]; then
    TOTAL_HITS=$(echo "$RESPONSE" | jq -r '.resultSummary.totalHits')
    RESULTS_COUNT=$(echo "$RESPONSE" | jq -r '.resultSummary.resultsCount')
    PAGES_PROCESSED=$(echo "$RESPONSE" | jq -r '.resultSummary.pagesProcessed')
    SKIPPED_PAGES=$(echo "$RESPONSE" | jq -r '.resultSummary.skippedPages')
    
    echo "✅ Scraping completed in ${DURATION}s"
    echo "   Total hits: $TOTAL_HITS"
    echo "   Results fetched: $RESULTS_COUNT"
    echo "   Pages processed: $PAGES_PROCESSED"
    echo "   Pages skipped: $SKIPPED_PAGES"
  else
    ERROR_MSG=$(echo "$RESPONSE" | jq -r '.message')
    echo "❌ Scraping failed: $ERROR_MSG"
  fi
  
  echo ""
  
  # Increment counter
  COUNTER=$((COUNTER + 1))
  
  # Delay before next subcategory (unless it's the last one)
  if [ $COUNTER -le $TOTAL_SUBCATS ]; then
    echo "Waiting $DELAY seconds before processing next subcategory..."
    sleep $DELAY
  fi
done

echo "All furniture subcategories have been processed!" 