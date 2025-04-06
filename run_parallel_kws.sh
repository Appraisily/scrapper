#!/bin/bash

# Configuration
SERVICE_URL="https://scrapper-856401495068.us-central1.run.app/api/search"
TARGET_BUCKET="invaluable-html-archive-images"
KEYWORDS_FILE="KWs.txt"
PROCESSED_LOG="processed_KWs.log"
TEMP_ALL_KEYWORDS_FILE=$(mktemp)  # Temporary file for all keywords from JSON
TEMP_UNPROCESSED_FILE=$(mktemp) # Temporary file for unprocessed keywords
MAX_RETRY_COUNT=3 # Number of retries for failed requests
MAX_PARALLEL_JOBS=5 # Maximum number of parallel jobs
TMP_DIR=$(mktemp -d) # Temporary directory for job tracking

# --- Helper Functions ---
cleanup() {
  echo "Cleaning up temporary files..."
  rm -rf "$TMP_DIR"
  rm -f "$TEMP_ALL_KEYWORDS_FILE"
  rm -f "$TEMP_UNPROCESSED_FILE"
}
trap cleanup EXIT INT TERM # Ensure cleanup happens on script exit or interruption

# Function to format timestamp for logging
timestamp() {
  date +"%Y-%m-%d %H:%M:%S"
}

# Function to process a single keyword
process_keyword() {
  local keyword=$1
  local job_id=$2
  local log_file="$TMP_DIR/job_${job_id}.log"
  local status_file="$TMP_DIR/job_${job_id}.status"

  # Mark job as running
  echo "running" > "$status_file"
  
  echo "$(timestamp) [Job $job_id] Processing keyword: '$keyword'" >> "$log_file"
  echo "$(timestamp) [Job $job_id] Started at $(date)" >> "$log_file"

  # Initialize retry counter
  retry_count=0
  success=false

  while [ $retry_count -lt $MAX_RETRY_COUNT ] && [ "$success" = false ]; do
    if [ $retry_count -gt 0 ]; then
      echo "$(timestamp) [Job $job_id] Retry attempt $retry_count for keyword '$keyword'" >> "$log_file"
      # Exponential backoff for retries: 30s, 60s, 120s
      backoff_time=$((30 * (2 ** (retry_count - 1))))
      echo "$(timestamp) [Job $job_id] Waiting $backoff_time seconds before retrying..." >> "$log_file"
      sleep $backoff_time
    fi

    # Prepare output files
    curl_output_file="$TMP_DIR/curl_output_${job_id}"
    curl_error_file="$TMP_DIR/curl_error_${job_id}"

    echo "$(timestamp) [Job $job_id] Sending request to service and waiting for completion..." >> "$log_file"
    request_url="$SERVICE_URL?query=$keyword&saveToGcs=true&saveImages=true&bucket=$TARGET_BUCKET&fetchAllPages=true&imageConcurrency=4&maxMemoryGB=4"
    echo "$(timestamp) [Job $job_id] Request URL: $request_url" >> "$log_file"
    
    # Execute curl with a long timeout (60 minutes)
    curl -sS --fail \
      --max-time 3600 \
      --url-query "query=$keyword" \
      --url-query "saveToGcs=true" \
      --url-query "saveImages=true" \
      --url-query "bucket=$TARGET_BUCKET" \
      --url-query "fetchAllPages=true" \
      --url-query "imageConcurrency=4" \
      --url-query "maxMemoryGB=4" \
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
          
          echo "$(timestamp) [Job $job_id] Successfully processed keyword: '$keyword'" >> "$log_file"
          echo "$(timestamp) [Job $job_id] Found $total_items total items, $total_results results returned" >> "$log_file"
          
          # If we have scrapingSummary, extract and display that information
          if jq -e '.scrapingSummary' "$curl_output_file" > /dev/null 2>&1; then
            pages_processed=$(jq -r '.scrapingSummary.pagesProcessed' "$curl_output_file")
            pages_skipped=$(jq -r '.scrapingSummary.skippedExistingPages // 0' "$curl_output_file")
            total_pages=$(jq -r '.scrapingSummary.totalPagesFound // 0' "$curl_output_file")
            
            echo "$(timestamp) [Job $job_id] Scraping summary: Processed $pages_processed pages, skipped $pages_skipped existing pages, found $total_pages total pages" >> "$log_file"
          fi
          
          # Add the successfully processed keyword to the log file
          # Use flock to safely write to the shared log file
          (
            flock -x 200
            echo "$keyword" >> "$PROCESSED_LOG"
          ) 200>>"$TMP_DIR/logfile.lock"
          
          success=true
        else
          echo "$(timestamp) [Job $job_id] API returned success=false for keyword: '$keyword'" >> "$log_file"
          # Show error message if available
          if jq -e '.error' "$curl_output_file" > /dev/null 2>&1; then
            error_msg=$(jq -r '.error' "$curl_output_file")
            echo "$(timestamp) [Job $job_id] Error message: $error_msg" >> "$log_file"
          fi
          # This is an API-level failure, retry
          retry_count=$((retry_count + 1))
        fi
      else
        echo "$(timestamp) [Job $job_id] Invalid or unexpected JSON response for keyword: '$keyword'" >> "$log_file"
        # This could be a connection issue or a corrupted response, retry
        retry_count=$((retry_count + 1))
      fi
    else
      echo "$(timestamp) [Job $job_id] Error: Failed to process keyword: '$keyword'" >> "$log_file"
      echo "$(timestamp) [Job $job_id] Curl command exited with status $exit_status." >> "$log_file"
      echo "$(timestamp) [Job $job_id] Error details (from stderr):" >> "$log_file"
      cat "$curl_error_file" >> "$log_file"
      
      # Check if this was a timeout (exit code 28)
      if [ $exit_status -eq 28 ]; then
        echo "$(timestamp) [Job $job_id] Request timed out after 60 minutes. This suggests a very large dataset or service issues." >> "$log_file"
      fi
      
      # This is a connection-level failure, retry
      retry_count=$((retry_count + 1))
    fi

    # Clean up temp files for this attempt
    rm -f "$curl_output_file" "$curl_error_file"
  done
  
  # After all retries, check if we succeeded
  if [ "$success" = false ]; then
    echo "$(timestamp) [Job $job_id] WARNING: Failed to process keyword '$keyword' after $MAX_RETRY_COUNT attempts." >> "$log_file"
    echo "$(timestamp) [Job $job_id] Adding to processed log to avoid endless retries in future runs." >> "$log_file"
    
    # Use flock to safely write to the shared log file
    (
      flock -x 200
      echo "$keyword" >> "$PROCESSED_LOG"
    ) 200>>"$TMP_DIR/logfile.lock"
  fi
  
  echo "$(timestamp) [Job $job_id] Completed at $(date)" >> "$log_file"

  # Mark job as completed
  echo "completed" > "$status_file"
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

echo "$(timestamp) Identifying unprocessed keywords..."
# Use grep to find keywords in the extracted list that are NOT in processed_KWs.log
grep -Fxvf "$PROCESSED_LOG" "$TEMP_ALL_KEYWORDS_FILE" > "$TEMP_UNPROCESSED_FILE"

unprocessed_count=$(wc -l < "$TEMP_UNPROCESSED_FILE")
processed_count=$(grep -cFxf "$PROCESSED_LOG" "$TEMP_ALL_KEYWORDS_FILE") 

echo "$(timestamp) Found $unprocessed_count keywords to process out of $total_count total. $processed_count already processed."

if [ "$unprocessed_count" -eq 0 ]; then
  echo "$(timestamp) All keywords from '$KEYWORDS_FILE' have already been processed according to '$PROCESSED_LOG'."
  exit 0
fi

echo "$(timestamp) Starting parallel processing with up to $MAX_PARALLEL_JOBS jobs..."

job_id=0
current_kw_num=0

# Create a monitor function to show progress and logs
monitor_logs() {
  while true; do
    clear
    echo "==== PARALLEL KEYWORD PROCESSING STATUS ===="
    echo "$(timestamp) Processing $unprocessed_count keywords with up to $MAX_PARALLEL_JOBS parallel jobs"
    echo "Total completed: $current_kw_num / $unprocessed_count"
    echo ""
    echo "Active jobs:"
    
    # List all running jobs with their current status
    for ((i=1; i<=job_id; i++)); do
      status_file="$TMP_DIR/job_${i}.status"
      log_file="$TMP_DIR/job_${i}.log"
      
      if [ -f "$status_file" ]; then
        status=$(cat "$status_file")
        if [ "$status" = "running" ]; then
          kw=$(tail -n 20 "$log_file" | grep -m 1 "Processing keyword" | sed -E 's/.*Processing keyword: '\''(.*)'\''$/\1/')
          echo "Job $i: Processing '$kw'"
          
          # Show last few lines of the log
          echo "  Recent activity:"
          tail -n 3 "$log_file" | sed 's/^/  /'
          echo ""
        fi
      fi
    done
    
    sleep 5
  done
}

# Start the monitor in background
monitor_logs &
monitor_pid=$!

# Read unprocessed keywords line by line and process in parallel
while IFS= read -r keyword || [[ -n "$keyword" ]]; do
  # Skip empty lines
  if [ -z "$keyword" ]; then
    continue
  fi

  current_kw_num=$((current_kw_num + 1))
  job_id=$((job_id + 1))

  # Wait if we have reached the maximum number of parallel jobs
  while [ $(find "$TMP_DIR" -name "*.status" -exec cat {} \; | grep -c "running") -ge $MAX_PARALLEL_JOBS ]; do
    sleep 2
  done

  # Start processing this keyword in the background
  process_keyword "$keyword" "$job_id" &
  
  # Take a short break to avoid hammering the API
  sleep 2
  
done < "$TEMP_UNPROCESSED_FILE"

# Wait for all background jobs to complete
echo "$(timestamp) Waiting for all jobs to complete..."
wait

# Kill the monitor
kill $monitor_pid >/dev/null 2>&1

# Print summary of all job logs
echo "==== PROCESSING SUMMARY ===="
for ((i=1; i<=job_id; i++)); do
  log_file="$TMP_DIR/job_${i}.log"
  if [ -f "$log_file" ]; then
    kw=$(grep -m 1 "Processing keyword" "$log_file" | sed -E 's/.*Processing keyword: '\''(.*)'\''$/\1/')
    if grep -q "Successfully processed keyword" "$log_file"; then
      echo "✓ Job $i: Successfully processed '$kw'"
    else
      echo "✗ Job $i: Failed to process '$kw'"
    fi
  fi
done

echo "=============================================================="
echo "$(timestamp) All keywords processing attempts completed."
echo "$(timestamp) Total keywords processed: $current_kw_num"
echo "$(timestamp) Check $PROCESSED_LOG for the list of completed keywords."
echo "=============================================================="

exit 0