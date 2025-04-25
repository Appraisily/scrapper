#!/bin/bash

# Configuration
SERVICE_URL="https://scrapper-856401495068.us-central1.run.app/api/search"
TARGET_BUCKET="invaluable-html-archive-images"
KEYWORDS_FILE="KWs.txt"
PROCESSED_LOG="processed_KWs.log"
TEMP_ALL_KEYWORDS_FILE=$(mktemp)  # Temporary file for all keywords from JSON
TEMP_UNPROCESSED_FILE=$(mktemp) # Temporary file for unprocessed keywords
MAX_RETRY_COUNT=3 # Number of retries for failed requests
FORCE_MODE=false # Default: don't force reprocessing

# Parse command line arguments
while [[ $# -gt 0 ]]; do
  key="$1"
  case $key in
    -f|--force)
      FORCE_MODE=true
      echo "Force mode activated: All keywords will be processed regardless of processed_KWs.log"
      shift
      ;;
    *)
      echo "Unknown option: $key"
      echo "Usage: $0 [-f|--force]"
      echo "  -f, --force    Force reprocessing of all keywords, even those already in processed_KWs.log"
      exit 1
      ;;
  esac
done

# --- Helper Functions ---
cleanup() {
  echo "Cleaning up temporary files..."
  rm -f "$TEMP_ALL_KEYWORDS_FILE"
  rm -f "$TEMP_UNPROCESSED_FILE"
}
trap cleanup EXIT INT TERM # Ensure cleanup happens on script exit or interruption

# Function to format timestamp for logging
timestamp() {
  date +"%Y-%m-%d %H:%M:%S"
}

# --- Main Script ---

# Check if jq is installed
if ! command -v jq &> /dev/null; then
    echo "Error: jq is not installed. Please install jq to parse the keywords JSON file."
    exit 1
fi

# Check if keywords file exists
if [ ! -f "$KEYWORDS_FILE" ]; then
  echo "Error: Keywords file '$KEYWORDS_FILE' not found."
  exit 1
fi

# Create log file if it doesn't exist
touch "$PROCESSED_LOG"

echo "$(timestamp) Extracting keywords from $KEYWORDS_FILE using jq..."
# Extract keywords safely with jq, store in a temporary file
jq -r '.[] | select(. != null and . != "")' "$KEYWORDS_FILE" > "$TEMP_ALL_KEYWORDS_FILE"
if [ $? -ne 0 ]; then
    echo "$(timestamp) Error: Failed to parse $KEYWORDS_FILE with jq. Is it valid JSON?"
    exit 1
fi

total_count=$(wc -l < "$TEMP_ALL_KEYWORDS_FILE")
echo "$(timestamp) Found $total_count total keywords in $KEYWORDS_FILE."

# If in force mode, process all keywords
if [ "$FORCE_MODE" = true ]; then
  echo "$(timestamp) Force mode enabled - processing all $total_count keywords"
  cp "$TEMP_ALL_KEYWORDS_FILE" "$TEMP_UNPROCESSED_FILE"
  unprocessed_count=$total_count
  processed_count=0
else
  echo "$(timestamp) Identifying unprocessed keywords..."
  # Use grep to find keywords in the extracted list that are NOT in processed_KWs.log
  # -F treats patterns as fixed strings
  # -x matches whole lines exactly
  # -v inverts the match (selects non-matching lines)
  # -f reads patterns (processed keywords) from processed_KWs.log
  grep -Fxvf "$PROCESSED_LOG" "$TEMP_ALL_KEYWORDS_FILE" > "$TEMP_UNPROCESSED_FILE"

  unprocessed_count=$(wc -l < "$TEMP_UNPROCESSED_FILE")
  processed_count=$(grep -cFxf "$PROCESSED_LOG" "$TEMP_ALL_KEYWORDS_FILE") # Count lines in log that ARE in the master list

  echo "$(timestamp) Found $unprocessed_count keywords to process out of $total_count total. $processed_count already processed."
fi

if [ "$unprocessed_count" -eq 0 ]; then
  echo "$(timestamp) All keywords from '$KEYWORDS_FILE' have already been processed according to '$PROCESSED_LOG'."
  echo "$(timestamp) To reprocess all keywords, use the --force option."
  exit 0
fi

echo "$(timestamp) Starting processing..."

current_kw_num=0
# Read unprocessed keywords line by line from the temporary file
while IFS= read -r keyword || [[ -n "$keyword" ]]; do
  # Skip empty lines just in case (though jq should prevent them)
  if [ -z "$keyword" ]; then
    continue
  fi

  current_kw_num=$((current_kw_num + 1))
  echo "=============================================================="
  echo "$(timestamp) [${current_kw_num}/${unprocessed_count}] Processing keyword: '$keyword'"
  echo "Started at $(date)"

  # Initialize retry counter
  retry_count=0
  success=false

  while [ $retry_count -lt $MAX_RETRY_COUNT ] && [ "$success" = false ]; do
    if [ $retry_count -gt 0 ]; then
      echo "$(timestamp) Retry attempt $retry_count for keyword '$keyword'"
      # Exponential backoff for retries: 30s, 2m, 5m
      backoff_time=$((30 * (2 ** (retry_count - 1))))
      echo "$(timestamp) Waiting $backoff_time seconds before retrying..."
      sleep $backoff_time
    fi

    # Prepare output files
    curl_output_file=$(mktemp)
    curl_error_file=$(mktemp)

    echo "$(timestamp) Sending request to service and waiting for completion..."
    echo "$(timestamp) Request URL: $SERVICE_URL?query=$keyword&saveToGcs=true&saveImages=true&bucket=$TARGET_BUCKET&fetchAllPages=true&imageConcurrency=4&maxMemoryGB=4"
    
    # Execute curl with a long timeout (60 minutes)
    # The API is synchronous, so this will block until the entire scraping job is complete
    curl -sS --fail \
      --max-time 3600 \
      --url-query "query=$keyword" \
      --url-query "saveToGcs=true" \
      --url-query "saveImages=true" \
      --url-query "bucket=$TARGET_BUCKET" \
      --url-query "fetchAllPages=true" \
      --url-query "imageConcurrency=4" \
      --url-query "maxMemoryGB=8" \
      "$SERVICE_URL" > "$curl_output_file" 2> "$curl_error_file"
    
    # Check curl exit status
    exit_status=$?

    if [ $exit_status -eq 0 ]; then
      # Check if the response is a valid JSON and contains success field
      if jq -e '.success' "$curl_output_file" > /dev/null 2>&1; then
        is_success=$(jq -r '.success' "$curl_output_file")
        
        if [ "$is_success" = "true" ]; then
          # Extract some information from the response to confirm success
          total_items=$(jq -r '.pagination.totalItems // 0' "$curl_output_file")
          total_results=$(jq -r '.data.totalResults // 0' "$curl_output_file")
          
          echo "$(timestamp) Successfully processed keyword: '$keyword'"
          echo "$(timestamp) Found $total_items total items, $total_results results returned"
          
          # If we have scrapingSummary, extract and display that information
          if jq -e '.scrapingSummary' "$curl_output_file" > /dev/null 2>&1; then
            pages_processed=$(jq -r '.scrapingSummary.pagesProcessed // 0' "$curl_output_file")
            pages_skipped=$(jq -r '.scrapingSummary.skippedExistingPages // 0' "$curl_output_file")
            total_pages=$(jq -r '.scrapingSummary.totalPagesFound // 0' "$curl_output_file")
            
            echo "$(timestamp) Scraping summary: Processed $pages_processed pages, skipped $pages_skipped existing pages, found $total_pages total pages"
          fi
          
          # In force mode, we need to remove previous entries before adding
          if [ "$FORCE_MODE" = true ]; then
            # Make a temporary file for the new log
            TEMP_LOG_FILE=$(mktemp)
            # Remove existing entry for this keyword if present
            grep -Fxv "$keyword" "$PROCESSED_LOG" > "$TEMP_LOG_FILE"
            # Replace the log file with our filtered version
            mv "$TEMP_LOG_FILE" "$PROCESSED_LOG"
          fi
          
          # Add the successfully processed keyword to the log file
          echo "$keyword" >> "$PROCESSED_LOG"
          success=true
        else
          echo "$(timestamp) API returned success=false for keyword: '$keyword'"
          # Show error message if available
          if jq -e '.error' "$curl_output_file" > /dev/null 2>&1; then
            error_msg=$(jq -r '.error' "$curl_output_file")
            echo "$(timestamp) Error message: $error_msg"
          fi
          # This is an API-level failure, retry
          retry_count=$((retry_count + 1))
        fi
      else
        echo "$(timestamp) Invalid or unexpected JSON response for keyword: '$keyword'"
        # This could be a connection issue or a corrupted response, retry
        retry_count=$((retry_count + 1))
      fi
    else
      echo "$(timestamp) Error: Failed to process keyword: '$keyword'"
      echo "$(timestamp) Curl command exited with status $exit_status."
      echo "$(timestamp) Error details (from stderr):"
      cat "$curl_error_file"
      
      # Check if this was a timeout (exit code 28)
      if [ $exit_status -eq 28 ]; then
        echo "$(timestamp) Request timed out after 60 minutes. This suggests a very large dataset or service issues."
      fi
      
      # This is a connection-level failure, retry
      retry_count=$((retry_count + 1))
    fi

    # Clean up temp files for this attempt
    rm -f "$curl_output_file" "$curl_error_file"
  
  done
  
  # After all retries, check if we succeeded
  if [ "$success" = false ]; then
    echo "$(timestamp) WARNING: Failed to process keyword '$keyword' after $MAX_RETRY_COUNT attempts."
    echo "$(timestamp) Adding to processed log to avoid endless retries in future runs."
    
    # In force mode, remove any previous entries of this keyword first
    if [ "$FORCE_MODE" = true ]; then
      TEMP_LOG_FILE=$(mktemp)
      grep -Fxv "$keyword" "$PROCESSED_LOG" > "$TEMP_LOG_FILE"
      mv "$TEMP_LOG_FILE" "$PROCESSED_LOG"
    fi
    
    echo "$keyword" >> "$PROCESSED_LOG"
  fi
  
  echo "$(timestamp) Completed at $(date)"
  echo "$(timestamp) Taking a short break before the next keyword to allow resources to clean up..."
  sleep 10  # Short break between keywords
  echo "=============================================================="

done < "$TEMP_UNPROCESSED_FILE" # Read from the temp file containing only unprocessed KWs

echo "=============================================================="
echo "$(timestamp) All keywords processing attempts completed."
echo "$(timestamp) Total keywords processed: $current_kw_num"
echo "$(timestamp) Check $PROCESSED_LOG for the list of completed keywords."
echo "=============================================================="

# Cleanup is handled by the trap

exit 0