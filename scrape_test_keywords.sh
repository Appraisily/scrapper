#!/bin/bash
# Script to test scraping the first 5 keywords from KWs.txt with image downloading

# Configuration
SERVICE_URL="https://scrapper-856401495068.us-central1.run.app/api/search"
BUCKET_NAME="invaluable-html-archive-images"  # Dedicated bucket for images
MAX_KEYWORDS=5
INPUT_FILE="KWs.txt"
LOG_FILE="scrape_test_results.log"
MAX_PAGES=10  # Number of pages to scrape per keyword

# Create log file and start logging
echo "Starting test scraping at $(date)" > $LOG_FILE
echo "Service URL: $SERVICE_URL" >> $LOG_FILE
echo "Target bucket: $BUCKET_NAME" >> $LOG_FILE
echo "Max keywords to process: $MAX_KEYWORDS" >> $LOG_FILE

# Check if input file exists
if [ ! -f "$INPUT_FILE" ]; then
  echo "Error: Keywords file $INPUT_FILE not found!" | tee -a $LOG_FILE
  exit 1
fi

# Read the first MAX_KEYWORDS from the file
echo "Reading first $MAX_KEYWORDS keywords from $INPUT_FILE..." | tee -a $LOG_FILE
KEYWORDS=$(head -n $MAX_KEYWORDS "$INPUT_FILE")

# Process each keyword
KEYWORD_COUNT=0
for KW in $KEYWORDS; do
  KEYWORD_COUNT=$((KEYWORD_COUNT + 1))
  
  # Clean up keyword for use in URLs
  CLEAN_KW=$(echo "$KW" | tr ' ' '+')
  
  echo "-------------------------------------------" | tee -a $LOG_FILE
  echo "[$KEYWORD_COUNT/$MAX_KEYWORDS] Processing keyword: '$KW'" | tee -a $LOG_FILE
  echo "Starting at $(date)" | tee -a $LOG_FILE
  
  # First, check if this keyword has already been scraped
  KW_FOLDER_CHECK=$(gsutil ls -d "gs://$BUCKET_NAME/invaluable-data/$KW/" 2>/dev/null || echo "")
  
  if [ ! -z "$KW_FOLDER_CHECK" ]; then
    echo "Keyword '$KW' has already been scraped. Checking if it has all pages and images..." | tee -a $LOG_FILE
    
    # Count JSON files for this keyword
    JSON_COUNT=$(gsutil ls "gs://$BUCKET_NAME/invaluable-data/$KW/*.json" 2>/dev/null | wc -l)
    
    # Check if images folder exists
    IMAGE_FOLDER_EXISTS=$(gsutil ls -d "gs://$BUCKET_NAME/invaluable-data/$KW/images/" 2>/dev/null || echo "")
    
    if [ ! -z "$IMAGE_FOLDER_EXISTS" ]; then
      # Count images
      IMAGE_COUNT=$(gsutil ls "gs://$BUCKET_NAME/invaluable-data/$KW/images/*" 2>/dev/null | wc -l)
      echo "Found $JSON_COUNT JSON files and $IMAGE_COUNT images for '$KW'" | tee -a $LOG_FILE
    else
      echo "Found $JSON_COUNT JSON files but no images folder for '$KW'" | tee -a $LOG_FILE
    fi
    
    # If we have all pages and images folder exists, skip this keyword
    if [ "$JSON_COUNT" -ge "$MAX_PAGES" ] && [ ! -z "$IMAGE_FOLDER_EXISTS" ]; then
      echo "Keyword '$KW' already has $JSON_COUNT pages and images. Skipping." | tee -a $LOG_FILE
      continue
    fi
  fi
  
  # Make initial scraping request to get the first page and pagination info
  echo "Sending scrape request for first page of '$KW'..." | tee -a $LOG_FILE
  
  INITIAL_RESPONSE=$(curl -s -g "$SERVICE_URL?query=$CLEAN_KW&saveToGcs=true&saveImages=true&bucket=$BUCKET_NAME&fetchAllPages=false")
  
  # Check if the request was successful
  if [ -z "$INITIAL_RESPONSE" ]; then
    echo "Error: Empty response from service for keyword '$KW'" | tee -a $LOG_FILE
    continue
  fi
  
  # Parse total pages and items if you have jq installed
  if command -v jq &> /dev/null; then
    TOTAL_PAGES=$(echo $INITIAL_RESPONSE | jq -r '.pagination.totalPages // 0')
    TOTAL_ITEMS=$(echo $INITIAL_RESPONSE | jq -r '.pagination.totalItems // 0')
    echo "Found $TOTAL_ITEMS items across $TOTAL_PAGES pages for '$KW'" | tee -a $LOG_FILE
  else
    echo "jq not installed - cannot parse pagination info" | tee -a $LOG_FILE
    TOTAL_PAGES=$MAX_PAGES
  fi
  
  # Limit to MAX_PAGES
  if [ "$TOTAL_PAGES" -gt "$MAX_PAGES" ]; then
    TOTAL_PAGES=$MAX_PAGES
    echo "Limiting to $MAX_PAGES pages for testing" | tee -a $LOG_FILE
  fi
  
  # Sleep to avoid rate limiting
  echo "Waiting 5 seconds before continuing to additional pages..." | tee -a $LOG_FILE
  sleep 5
  
  # If more than one page, continue with pages 2 through TOTAL_PAGES
  if [ "$TOTAL_PAGES" -gt 1 ]; then
    for PAGE in $(seq 2 $TOTAL_PAGES); do
      echo "Scraping page $PAGE of $TOTAL_PAGES for '$KW'..." | tee -a $LOG_FILE
      
      PAGE_RESPONSE=$(curl -s -g "$SERVICE_URL?query=$CLEAN_KW&saveToGcs=true&saveImages=true&bucket=$BUCKET_NAME&fetchAllPages=false&page=$PAGE")
      
      # Check if the request was successful
      if [ -z "$PAGE_RESPONSE" ]; then
        echo "Error: Empty response from service for keyword '$KW' page $PAGE" | tee -a $LOG_FILE
        continue
      fi
      
      # Success
      echo "Successfully scraped page $PAGE for '$KW'" | tee -a $LOG_FILE
      
      # Sleep between pages to avoid rate limiting
      if [ "$PAGE" -lt "$TOTAL_PAGES" ]; then
        SLEEP_TIME=$((3 + RANDOM % 5))
        echo "Waiting $SLEEP_TIME seconds before next page..." | tee -a $LOG_FILE
        sleep $SLEEP_TIME
      fi
    done
  fi
  
  # Verify results in GCS
  echo "Verifying results in GCS..." | tee -a $LOG_FILE
  
  # Check if the folder was created
  KW_FOLDER=$(gsutil ls -d "gs://$BUCKET_NAME/invaluable-data/$KW/" 2>/dev/null || echo "")
  
  if [ -z "$KW_FOLDER" ]; then
    echo "Error: Folder for keyword '$KW' was not created in GCS" | tee -a $LOG_FILE
    continue
  fi
  
  # Count JSON files
  JSON_COUNT=$(gsutil ls "gs://$BUCKET_NAME/invaluable-data/$KW/*.json" 2>/dev/null | wc -l)
  
  # Check if images folder exists
  IMAGE_FOLDER=$(gsutil ls -d "gs://$BUCKET_NAME/invaluable-data/$KW/images/" 2>/dev/null || echo "")
  
  if [ -z "$IMAGE_FOLDER" ]; then
    echo "Warning: No images folder found for keyword '$KW'" | tee -a $LOG_FILE
  else
    # Count images
    IMAGE_COUNT=$(gsutil ls "gs://$BUCKET_NAME/invaluable-data/$KW/images/*" 2>/dev/null | wc -l)
    echo "Found $IMAGE_COUNT images for keyword '$KW'" | tee -a $LOG_FILE
  fi
  
  echo "Successfully processed keyword '$KW' with $JSON_COUNT JSON files" | tee -a $LOG_FILE
  
  # Longer delay between keywords
  if [ "$KEYWORD_COUNT" -lt "$MAX_KEYWORDS" ]; then
    SLEEP_TIME=$((15 + RANDOM % 15))
    echo "Waiting $SLEEP_TIME seconds before next keyword..." | tee -a $LOG_FILE
    sleep $SLEEP_TIME
  fi
done

echo "-------------------------------------------" | tee -a $LOG_FILE
echo "Test scraping completed at $(date)" | tee -a $LOG_FILE
echo "Processed $KEYWORD_COUNT keywords" | tee -a $LOG_FILE
echo "Log saved to $LOG_FILE"

# Make the script executable
chmod +x scrape_test_keywords.sh