#!/bin/bash

# Configuration
SERVICE_URL="https://scrapper-856401495068.us-central1.run.app/api/search"
TARGET_BUCKET="invaluable-html-archive-images"
KEYWORDS_FILE="KWs.txt"
PROCESSED_LOG="processed_KWs.log"
TEMP_ALL_KEYWORDS_FILE=$(mktemp)  # Temporary file for all keywords from JSON
TEMP_UNPROCESSED_FILE=$(mktemp) # Temporary file for unprocessed keywords
DELAY_SECONDS=10  # Delay between keyword submissions

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

echo "$(timestamp) Starting processing with $DELAY_SECONDS seconds between submissions..."

mkdir -p scrape_logs

current_kw_num=0
# Read unprocessed keywords line by line from the temporary file
while IFS= read -r keyword || [[ -n "$keyword" ]]; do
  # Skip empty lines
  if [ -z "$keyword" ]; then
    continue
  fi

  current_kw_num=$((current_kw_num + 1))
  
  echo "$(timestamp) [${current_kw_num}/${unprocessed_count}] Submitting: '$keyword'"
  
  # Submit the request to the service with a timeout (don't wait for response)
  nohup curl -s \
    --max-time 2 \
    --url-query "query=$keyword" \
    --url-query "saveToGcs=true" \
    --url-query "saveImages=true" \
    --url-query "bucket=$TARGET_BUCKET" \
    --url-query "fetchAllPages=true" \
    --url-query "imageConcurrency=4" \
    --url-query "maxMemoryGB=4" \
    "$SERVICE_URL" > /dev/null 2>&1 &
  
  # Mark as processed
  echo "$keyword" >> "$PROCESSED_LOG"
  
  # Take a short break before the next submission
  sleep $DELAY_SECONDS

done < "$TEMP_UNPROCESSED_FILE"

echo "$(timestamp) All $current_kw_num keywords have been submitted."
echo "$(timestamp) Requests will continue processing in the background."

exit 0