#!/bin/bash
# Production scraping script for processing all keywords from KWs.txt
# Features:
# - Processes keywords in batches with configurable batch size
# - Saves progress and can resume from where it left off
# - Handles rate limiting and random delays
# - Logs all activity with timestamps
# - Verifies data in GCS after scraping

# Configuration
SERVICE_URL="https://scrapper-856401495068.us-central1.run.app/api/search"
BUCKET_NAME="invaluable-html-archive-images"  # Dedicated bucket for images
INPUT_FILE="KWs.txt"
LOG_DIR="scrape_logs"
PROGRESS_FILE="scrape_progress.txt"
BATCH_SIZE=50          # Number of keywords to process in a batch
MAX_PAGES=20           # Number of pages to scrape per keyword
PAGE_DELAY_MIN=3       # Minimum seconds to wait between pages
PAGE_DELAY_MAX=7       # Maximum seconds to wait between pages
KW_DELAY_MIN=10        # Minimum seconds to wait between keywords
KW_DELAY_MAX=20        # Maximum seconds to wait between keywords
BATCH_DELAY_MIN=300    # Minimum seconds to wait between batches (5 min)
BATCH_DELAY_MAX=600    # Maximum seconds to wait between batches (10 min)
MAX_RETRIES=3          # Maximum number of retries per keyword/page

# Create log directory if it doesn't exist
mkdir -p $LOG_DIR

# Define log files
MAIN_LOG="$LOG_DIR/scrape_main_$(date +%Y%m%d_%H%M%S).log"
ERROR_LOG="$LOG_DIR/scrape_errors_$(date +%Y%m%d_%H%M%S).log"
SUMMARY_LOG="$LOG_DIR/scrape_summary_$(date +%Y%m%d_%H%M%S).log"

# Start logging
echo "==== INVALUABLE DATA SCRAPING PROCESS ====" | tee -a $MAIN_LOG
echo "Started at: $(date)" | tee -a $MAIN_LOG
echo "Service URL: $SERVICE_URL" | tee -a $MAIN_LOG
echo "Target bucket: $BUCKET_NAME" | tee -a $MAIN_LOG
echo "Keywords file: $INPUT_FILE" | tee -a $MAIN_LOG
echo "Batch size: $BATCH_SIZE" | tee -a $MAIN_LOG
echo "Max pages per keyword: $MAX_PAGES" | tee -a $MAIN_LOG

# Check if input file exists
if [ ! -f "$INPUT_FILE" ]; then
  echo "Error: Keywords file $INPUT_FILE not found!" | tee -a $MAIN_LOG $ERROR_LOG
  exit 1
fi

# Count total keywords
TOTAL_KEYWORDS=$(wc -l < "$INPUT_FILE")
echo "Total keywords to process: $TOTAL_KEYWORDS" | tee -a $MAIN_LOG

# Check if progress file exists and load progress
if [ -f "$PROGRESS_FILE" ]; then
  PROCESSED_COUNT=$(wc -l < "$PROGRESS_FILE")
  echo "Found progress file with $PROCESSED_COUNT keywords already processed" | tee -a $MAIN_LOG
  
  # Create a temporary file with keywords that haven't been processed yet
  grep -v -f "$PROGRESS_FILE" "$INPUT_FILE" > temp_remaining_keywords.txt
  REMAINING_KEYWORDS=$(wc -l < temp_remaining_keywords.txt)
  echo "Remaining keywords to process: $REMAINING_KEYWORDS" | tee -a $MAIN_LOG
else
  echo "No progress file found. Starting from the beginning." | tee -a $MAIN_LOG
  touch "$PROGRESS_FILE"
  cp "$INPUT_FILE" temp_remaining_keywords.txt
  REMAINING_KEYWORDS=$TOTAL_KEYWORDS
  PROCESSED_COUNT=0
fi

# Helper function to log errors
log_error() {
  echo "[ERROR] $1" | tee -a $MAIN_LOG $ERROR_LOG
}

# Helper function to generate random delay
random_delay() {
  local MIN=$1
  local MAX=$2
  local DELAY=$((MIN + RANDOM % (MAX - MIN + 1)))
  echo $DELAY
}

# Function to process a single keyword
process_keyword() {
  local KW="$1"
  local KW_LOG="$LOG_DIR/kw_${KW// /_}_$(date +%Y%m%d_%H%M%S).log"
  
  echo "--------------------------------------------" | tee -a $MAIN_LOG $KW_LOG
  echo "Processing keyword: '$KW'" | tee -a $MAIN_LOG $KW_LOG
  echo "Started at: $(date)" | tee -a $KW_LOG
  
  # Clean up keyword for use in URLs
  local CLEAN_KW=$(echo "$KW" | tr ' ' '+')
  
  # First, check if this keyword has already been scraped
  local KW_FOLDER_CHECK=$(gsutil ls -d "gs://$BUCKET_NAME/invaluable-data/$KW/" 2>/dev/null || echo "")
  
  if [ ! -z "$KW_FOLDER_CHECK" ]; then
    echo "Keyword '$KW' has already been scraped. Checking if it has all pages and images..." | tee -a $KW_LOG
    
    # Count JSON files for this keyword
    local JSON_COUNT=$(gsutil ls "gs://$BUCKET_NAME/invaluable-data/$KW/*.json" 2>/dev/null | wc -l)
    
    # Check if images folder exists
    local IMAGE_FOLDER_EXISTS=$(gsutil ls -d "gs://$BUCKET_NAME/invaluable-data/$KW/images/" 2>/dev/null || echo "")
    
    if [ ! -z "$IMAGE_FOLDER_EXISTS" ]; then
      # Count images
      local IMAGE_COUNT=$(gsutil ls "gs://$BUCKET_NAME/invaluable-data/$KW/images/*" 2>/dev/null | wc -l)
      echo "Found $JSON_COUNT JSON files and $IMAGE_COUNT images for '$KW'" | tee -a $KW_LOG
    else
      echo "Found $JSON_COUNT JSON files but no images folder for '$KW'" | tee -a $KW_LOG
    fi
    
    # If we have all pages and images folder exists, skip this keyword
    if [ "$JSON_COUNT" -ge "$MAX_PAGES" ] && [ ! -z "$IMAGE_FOLDER_EXISTS" ]; then
      echo "Keyword '$KW' already has $JSON_COUNT pages and images. Skipping." | tee -a $KW_LOG $MAIN_LOG
      return 0
    fi
  fi
  
  # Make initial scraping request to get the first page and pagination info
  echo "Sending scrape request for first page of '$KW'..." | tee -a $KW_LOG $MAIN_LOG
  
  local RETRY_COUNT=0
  local SUCCESS=false
  
  while [ $RETRY_COUNT -lt $MAX_RETRIES ] && [ "$SUCCESS" = false ]; do
    INITIAL_RESPONSE=$(curl -s -g "$SERVICE_URL?query=$CLEAN_KW&saveToGcs=true&saveImages=true&bucket=$BUCKET_NAME&fetchAllPages=false")
    
    # Check if the request was successful
    if [ -z "$INITIAL_RESPONSE" ]; then
      RETRY_COUNT=$((RETRY_COUNT + 1))
      echo "Error: Empty response from service for keyword '$KW' (Attempt $RETRY_COUNT/$MAX_RETRIES)" | tee -a $KW_LOG $ERROR_LOG
      
      if [ $RETRY_COUNT -lt $MAX_RETRIES ]; then
        local RETRY_DELAY=$(random_delay 10 30)
        echo "Waiting $RETRY_DELAY seconds before retry..." | tee -a $KW_LOG
        sleep $RETRY_DELAY
      else
        log_error "Failed to scrape keyword '$KW' after $MAX_RETRIES attempts"
        return 1
      fi
    else
      SUCCESS=true
    fi
  done
  
  # Parse total pages and items if you have jq installed
  local TOTAL_PAGES=0
  local TOTAL_ITEMS=0
  
  if command -v jq &> /dev/null; then
    TOTAL_PAGES=$(echo $INITIAL_RESPONSE | jq -r '.pagination.totalPages // 0')
    TOTAL_ITEMS=$(echo $INITIAL_RESPONSE | jq -r '.pagination.totalItems // 0')
    echo "Found $TOTAL_ITEMS items across $TOTAL_PAGES pages for '$KW'" | tee -a $KW_LOG $MAIN_LOG
    
    # Check if we got zero results
    if [ "$TOTAL_ITEMS" -eq 0 ]; then
      echo "No results found for keyword '$KW'. Marking as processed but consider reviewing." | tee -a $KW_LOG $MAIN_LOG $ERROR_LOG
      echo "$KW" >> "$PROGRESS_FILE"
      return 0
    fi
  else
    echo "jq not installed - cannot parse pagination info" | tee -a $KW_LOG
    TOTAL_PAGES=$MAX_PAGES
  fi
  
  # Limit to MAX_PAGES
  if [ "$TOTAL_PAGES" -gt "$MAX_PAGES" ]; then
    TOTAL_PAGES=$MAX_PAGES
    echo "Limiting to $MAX_PAGES pages for keyword '$KW'" | tee -a $KW_LOG
  fi
  
  # Sleep to avoid rate limiting
  local PAGE_DELAY=$(random_delay $PAGE_DELAY_MIN $PAGE_DELAY_MAX)
  echo "Waiting $PAGE_DELAY seconds before continuing to additional pages..." | tee -a $KW_LOG
  sleep $PAGE_DELAY
  
  # If more than one page, continue with pages 2 through TOTAL_PAGES
  if [ "$TOTAL_PAGES" -gt 1 ]; then
    for PAGE in $(seq 2 $TOTAL_PAGES); do
      echo "Scraping page $PAGE of $TOTAL_PAGES for '$KW'..." | tee -a $KW_LOG
      
      # Reset retry count for each page
      RETRY_COUNT=0
      SUCCESS=false
      
      while [ $RETRY_COUNT -lt $MAX_RETRIES ] && [ "$SUCCESS" = false ]; do
        PAGE_RESPONSE=$(curl -s -g "$SERVICE_URL?query=$CLEAN_KW&saveToGcs=true&saveImages=true&bucket=$BUCKET_NAME&fetchAllPages=false&page=$PAGE")
        
        # Check if the request was successful
        if [ -z "$PAGE_RESPONSE" ]; then
          RETRY_COUNT=$((RETRY_COUNT + 1))
          echo "Error: Empty response for keyword '$KW' page $PAGE (Attempt $RETRY_COUNT/$MAX_RETRIES)" | tee -a $KW_LOG $ERROR_LOG
          
          if [ $RETRY_COUNT -lt $MAX_RETRIES ]; then
            local RETRY_DELAY=$(random_delay 10 30)
            echo "Waiting $RETRY_DELAY seconds before retry..." | tee -a $KW_LOG
            sleep $RETRY_DELAY
          else
            log_error "Failed to scrape page $PAGE for keyword '$KW' after $MAX_RETRIES attempts"
            # Don't return error, continue with other pages
            break
          fi
        else
          SUCCESS=true
          echo "Successfully scraped page $PAGE for '$KW'" | tee -a $KW_LOG
        fi
      done
      
      # Sleep between pages to avoid rate limiting
      if [ "$PAGE" -lt "$TOTAL_PAGES" ] && [ "$SUCCESS" = true ]; then
        local PAGE_DELAY=$(random_delay $PAGE_DELAY_MIN $PAGE_DELAY_MAX)
        echo "Waiting $PAGE_DELAY seconds before next page..." | tee -a $KW_LOG
        sleep $PAGE_DELAY
      fi
    done
  fi
  
  # Verify results in GCS
  echo "Verifying results in GCS for keyword '$KW'..." | tee -a $KW_LOG
  
  # Check if the folder was created
  local KW_FOLDER=$(gsutil ls -d "gs://$BUCKET_NAME/invaluable-data/$KW/" 2>/dev/null || echo "")
  
  if [ -z "$KW_FOLDER" ]; then
    log_error "Folder for keyword '$KW' was not created in GCS"
    return 1
  fi
  
  # Count JSON files
  local JSON_COUNT=$(gsutil ls "gs://$BUCKET_NAME/invaluable-data/$KW/*.json" 2>/dev/null | wc -l)
  
  # Check if images folder exists
  local IMAGE_FOLDER=$(gsutil ls -d "gs://$BUCKET_NAME/invaluable-data/$KW/images/" 2>/dev/null || echo "")
  
  if [ -z "$IMAGE_FOLDER" ]; then
    echo "Warning: No images folder found for keyword '$KW'" | tee -a $KW_LOG $ERROR_LOG
  else
    # Count images
    local IMAGE_COUNT=$(gsutil ls "gs://$BUCKET_NAME/invaluable-data/$KW/images/*" 2>/dev/null | wc -l)
    echo "Found $IMAGE_COUNT images for keyword '$KW'" | tee -a $KW_LOG
  fi
  
  echo "Successfully processed keyword '$KW' with $JSON_COUNT JSON files" | tee -a $KW_LOG $MAIN_LOG
  echo "Completed at: $(date)" | tee -a $KW_LOG
  
  # Mark keyword as processed
  echo "$KW" >> "$PROGRESS_FILE"
  
  return 0
}

# Process keywords in batches
BATCH_NUMBER=1
BATCH_START=$PROCESSED_COUNT
BATCH_END=$((BATCH_START + BATCH_SIZE))

if [ $BATCH_END -gt $TOTAL_KEYWORDS ]; then
  BATCH_END=$TOTAL_KEYWORDS
fi

while [ $BATCH_START -lt $TOTAL_KEYWORDS ]; do
  BATCH_KEYWORDS=$((BATCH_END - BATCH_START))
  
  echo "============================================" | tee -a $MAIN_LOG
  echo "Processing Batch #$BATCH_NUMBER: Keywords $((BATCH_START + 1))-$BATCH_END (Total: $BATCH_KEYWORDS)" | tee -a $MAIN_LOG
  echo "Started at: $(date)" | tee -a $MAIN_LOG
  
  # Process each keyword in the batch
  CURRENT_KW=$BATCH_START
  while read -r KW && [ $CURRENT_KW -lt $BATCH_END ]; do
    CURRENT_KW=$((CURRENT_KW + 1))
    
    # Skip blank lines
    if [ -z "$KW" ]; then
      continue
    fi
    
    # Process the keyword
    echo "[$CURRENT_KW/$TOTAL_KEYWORDS] Processing keyword: '$KW'" | tee -a $MAIN_LOG
    
    process_keyword "$KW"
    KW_RESULT=$?
    
    if [ $KW_RESULT -ne 0 ]; then
      log_error "Failed to completely process keyword '$KW'"
    fi
    
    # Delay between keywords
    if [ $CURRENT_KW -lt $BATCH_END ]; then
      KW_DELAY=$(random_delay $KW_DELAY_MIN $KW_DELAY_MAX)
      echo "Waiting $KW_DELAY seconds before next keyword..." | tee -a $MAIN_LOG
      sleep $KW_DELAY
    fi
  done < temp_remaining_keywords.txt
  
  # Update progress stats
  PROCESSED_COUNT=$(wc -l < "$PROGRESS_FILE")
  REMAINING_KEYWORDS=$((TOTAL_KEYWORDS - PROCESSED_COUNT))
  
  echo "Batch #$BATCH_NUMBER completed at: $(date)" | tee -a $MAIN_LOG
  echo "Total keywords processed so far: $PROCESSED_COUNT" | tee -a $MAIN_LOG
  echo "Remaining keywords: $REMAINING_KEYWORDS" | tee -a $MAIN_LOG
  
  # Prepare for next batch
  BATCH_NUMBER=$((BATCH_NUMBER + 1))
  BATCH_START=$BATCH_END
  BATCH_END=$((BATCH_START + BATCH_SIZE))
  
  if [ $BATCH_END -gt $TOTAL_KEYWORDS ]; then
    BATCH_END=$TOTAL_KEYWORDS
  fi
  
  # Delay between batches
  if [ $BATCH_START -lt $TOTAL_KEYWORDS ]; then
    BATCH_DELAY=$(random_delay $BATCH_DELAY_MIN $BATCH_DELAY_MAX)
    echo "Taking a longer break ($BATCH_DELAY seconds) before next batch..." | tee -a $MAIN_LOG
    sleep $BATCH_DELAY
    
    # Refresh the remaining keywords list
    grep -v -f "$PROGRESS_FILE" "$INPUT_FILE" > temp_remaining_keywords.txt
  fi
done

# Clean up temporary file
rm -f temp_remaining_keywords.txt

# Generate summary
echo "==== SCRAPING PROCESS SUMMARY ====" | tee -a $MAIN_LOG $SUMMARY_LOG
echo "Process completed at: $(date)" | tee -a $MAIN_LOG $SUMMARY_LOG
echo "Total keywords in input file: $TOTAL_KEYWORDS" | tee -a $MAIN_LOG $SUMMARY_LOG
echo "Total keywords processed: $PROCESSED_COUNT" | tee -a $MAIN_LOG $SUMMARY_LOG
echo "Remaining keywords: $REMAINING_KEYWORDS" | tee -a $MAIN_LOG $SUMMARY_LOG

if [ $REMAINING_KEYWORDS -eq 0 ]; then
  echo "All keywords have been processed successfully!" | tee -a $MAIN_LOG $SUMMARY_LOG
else
  echo "Not all keywords were processed. Check the logs for details." | tee -a $MAIN_LOG $SUMMARY_LOG
fi

echo "Main log file: $MAIN_LOG" | tee -a $SUMMARY_LOG
echo "Error log file: $ERROR_LOG" | tee -a $SUMMARY_LOG
echo "Summary log file: $SUMMARY_LOG" | tee -a $SUMMARY_LOG

echo "Scraping process complete!"

# Make the script executable
chmod +x scrape_all_keywords.sh