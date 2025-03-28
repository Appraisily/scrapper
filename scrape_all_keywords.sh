#!/bin/bash
# Orchestration script for keyword scraping
# This script processes all keywords from KWs.txt using the /api/search endpoint 
# IMPORTANT: Only use the /api/search endpoint, not /api/scraper/start

# Configuration
SERVICE_URL="https://scrapper-856401495068.us-central1.run.app/api/search"
BUCKET_NAME="invaluable-html-archive-images"
INPUT_FILE="KWs.txt"
LOG_FILE="scraping_progress.log"
PROGRESS_FILE="completed_keywords.txt"

# Create or append to log file
echo "====================================" >> $LOG_FILE
echo "Scraping job started at $(date)" >> $LOG_FILE
echo "Service URL: $SERVICE_URL" >> $LOG_FILE
echo "Target bucket: $BUCKET_NAME" >> $LOG_FILE
echo "====================================" >> $LOG_FILE

# Create progress file if it doesn't exist
if [ ! -f "$PROGRESS_FILE" ]; then
  touch "$PROGRESS_FILE"
  echo "Created new progress file" >> $LOG_FILE
else
  echo "Resuming from existing progress file" >> $LOG_FILE
  echo "$(wc -l < $PROGRESS_FILE) keywords already processed" >> $LOG_FILE
fi

# Check if input file exists
if [ ! -f "$INPUT_FILE" ]; then
  echo "Error: Keywords file $INPUT_FILE not found!" | tee -a $LOG_FILE
  exit 1
fi

# Extract keywords from JSON array format safely by using 'jq' if available
if command -v jq &> /dev/null; then
  echo "Using jq to parse JSON array" >> $LOG_FILE
  # Create a clean keywords file from the JSON format
  jq -r ".[] | select(. != null)" "$INPUT_FILE" > clean_keywords.txt
  INPUT_FILE="clean_keywords.txt"
  echo "Created clean keywords file from JSON array" >> $LOG_FILE
else
  echo "WARNING: jq not found. If your KWs.txt is in JSON format, parsing may not work correctly." | tee -a $LOG_FILE
  # Try a simple extraction as fallback
  if grep -q "^\[" "$INPUT_FILE"; then
    echo "Detected JSON array format, attempting simple extraction..." >> $LOG_FILE
    grep -v "^\[" "$INPUT_FILE" | grep -v "^\]" | sed 's/^[ ]*"//' | sed 's/",\?$//g' > clean_keywords.txt
    INPUT_FILE="clean_keywords.txt"
  fi
fi

# Count total keywords
TOTAL_KEYWORDS=$(wc -l < "$INPUT_FILE")
echo "Total keywords to process: $TOTAL_KEYWORDS" >> $LOG_FILE

# Create a temporary file with keywords that haven't been processed yet
grep -v -f "$PROGRESS_FILE" "$INPUT_FILE" > temp_remaining_keywords.txt
REMAINING_KEYWORDS=$(wc -l < temp_remaining_keywords.txt)
echo "Remaining keywords to process: $REMAINING_KEYWORDS" >> $LOG_FILE

# Process each keyword
CURRENT=0
TOTAL_REMAINING=$REMAINING_KEYWORDS

while read -r KW; do
  # Skip empty lines
  if [ -z "$KW" ]; then
    continue
  fi
  
  CURRENT=$((CURRENT + 1))
  echo "[$CURRENT/$TOTAL_REMAINING] Processing keyword: '$KW'" | tee -a $LOG_FILE
  echo "Started at $(date)" >> $LOG_FILE
  
  # Format URL parameters - replace hyphens with spaces and encode properly
  FORMATTED_KW=$(echo "$KW" | tr '-' ' ')
  ENCODED_KW=$(echo "$FORMATTED_KW" | tr ' ' '%20')
  
  # Call the scraper service with full options
  # - saveToGcs=true: Save results to GCS
  # - saveImages=true: Download and save images
  # - bucket: Specify our images bucket
  # - fetchAllPages=true: Let the service scrape all available pages
  echo "Sending request to service..." >> $LOG_FILE
  
  # IMPORTANT: Make sure saveImages=true is included for image downloading
  # Match Invaluable's exact URL format
  RESPONSE=$(curl -s -g "$SERVICE_URL?query=$ENCODED_KW&keyword=$ENCODED_KW&currentBid%5Bmin%5D=250&saveToGcs=true&saveImages=true&bucket=$BUCKET_NAME&fetchAllPages=true")
  
  # Check for successful response
  if [ -z "$RESPONSE" ]; then
    echo "Error: Empty response from service for keyword '$KW'" | tee -a $LOG_FILE
    continue
  fi
  
  # Log response summary if jq is available
  if command -v jq &> /dev/null; then
    TOTAL_ITEMS=$(echo $RESPONSE | jq -r '.pagination.totalItems // 0')
    TOTAL_PAGES=$(echo $RESPONSE | jq -r '.pagination.totalPages // 0')
    TOTAL_RESULTS=$(echo $RESPONSE | jq -r '.data.totalResults // 0')
    
    echo "Successfully scraped $TOTAL_RESULTS results across $TOTAL_PAGES pages (from $TOTAL_ITEMS total items) for '$KW'" | tee -a $LOG_FILE
  else
    echo "Successfully processed keyword '$KW'" | tee -a $LOG_FILE
  fi
  
  # Mark as completed
  echo "$KW" >> "$PROGRESS_FILE"
  
  # Calculate and show progress
  COMPLETED=$(wc -l < "$PROGRESS_FILE")
  PCT_COMPLETE=$(( (COMPLETED * 100) / TOTAL_KEYWORDS ))
  
  echo "Completed at $(date)" >> $LOG_FILE
  echo "Progress: $COMPLETED/$TOTAL_KEYWORDS keywords ($PCT_COMPLETE%)" | tee -a $LOG_FILE
  echo "-----------------------------------" >> $LOG_FILE
done < temp_remaining_keywords.txt

# Clean up
rm temp_remaining_keywords.txt
[ -f "clean_keywords.txt" ] && rm clean_keywords.txt

# Final summary
echo "====================================" >> $LOG_FILE
echo "Scraping job completed at $(date)" >> $LOG_FILE
echo "Total keywords processed: $(wc -l < $PROGRESS_FILE)/$TOTAL_KEYWORDS" >> $LOG_FILE
echo "====================================" >> $LOG_FILE

echo "Scraping job completed. See $LOG_FILE for details."

# Make script executable
chmod +x scrape_all_keywords.sh