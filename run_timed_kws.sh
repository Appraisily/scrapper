#!/bin/bash

# Configuration
SERVICE_URL="https://scrapper-856401495068.us-central1.run.app/api/search"
TARGET_BUCKET="invaluable-html-archive-images"
KEYWORDS_FILE="KWs.txt"
PROCESSED_LOG="processed_KWs.log"
TEMP_ALL_KEYWORDS_FILE=$(mktemp)  # Temporary file for all keywords from JSON
TEMP_UNPROCESSED_FILE=$(mktemp) # Temporary file for unprocessed keywords
DELAY_MINUTES=2  # Delay between keyword submissions

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

# Calculate expected completion time
total_minutes=$((unprocessed_count * DELAY_MINUTES))
total_hours=$((total_minutes / 60))
remaining_minutes=$((total_minutes % 60))
completion_date=$(date -d "+$total_hours hour +$remaining_minutes minute" "+%Y-%m-%d %H:%M:%S")

echo "$(timestamp) Starting timed processing with $DELAY_MINUTES minutes between submissions..."
echo "$(timestamp) Estimated completion time: $completion_date (in ~$total_hours hours and $remaining_minutes minutes)"

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

  # Create a unique ID for this run
  run_id=$(date +"%Y%m%d_%H%M%S")_$current_kw_num
  log_file="scrape_logs/kw_${keyword// /_}_${run_id}.log"
  mkdir -p scrape_logs
  
  # Prepare the URL 
  request_url="$SERVICE_URL?query=$keyword&saveToGcs=true&saveImages=true&bucket=$TARGET_BUCKET&fetchAllPages=true&imageConcurrency=4&maxMemoryGB=4"
  echo "$(timestamp) Submitting request to service (not waiting for completion)..."
  echo "$(timestamp) Request URL: $request_url"
  
  # Launch curl in the background to avoid waiting for completion
  curl -sS --fail \
    --max-time 3600 \
    --url-query "query=$keyword" \
    --url-query "saveToGcs=true" \
    --url-query "saveImages=true" \
    --url-query "bucket=$TARGET_BUCKET" \
    --url-query "fetchAllPages=true" \
    --url-query "imageConcurrency=4" \
    --url-query "maxMemoryGB=4" \
    "$SERVICE_URL" > "$log_file" 2>&1 &
  
  # Record that we've processed this keyword
  echo "$keyword" >> "$PROCESSED_LOG"
  echo "$(timestamp) Marked as processed in log file"
  
  # Calculate minutes remaining and completion time
  remaining_kws=$((unprocessed_count - current_kw_num))
  remaining_minutes=$((remaining_kws * DELAY_MINUTES))
  remaining_hours=$((remaining_minutes / 60))
  remaining_mins=$((remaining_minutes % 60))
  completion_date=$(date -d "+$remaining_hours hour +$remaining_mins minute" "+%Y-%m-%d %H:%M:%S")
  
  echo "$(timestamp) Submitted at $(date)"
  echo "$(timestamp) Remaining: ~$remaining_hours hours and $remaining_mins minutes (est. completion: $completion_date)"
  echo "$(timestamp) Waiting $DELAY_MINUTES minutes before submitting next keyword..."
  echo "=============================================================="
  
  # Wait before processing the next keyword
  sleep $((DELAY_MINUTES * 60))

done < "$TEMP_UNPROCESSED_FILE" # Read from the temp file containing only unprocessed KWs

echo "=============================================================="
echo "$(timestamp) All keywords have been submitted."
echo "$(timestamp) Total keywords submitted: $current_kw_num"
echo "$(timestamp) Submissions will continue running in the background."
echo "$(timestamp) Check $PROCESSED_LOG for the list of submitted keywords."
echo "=============================================================="

exit 0