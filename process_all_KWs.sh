#!/bin/bash

# Configuration
SERVICE_URL="https://scrapper-856401495068.us-central1.run.app/api/search"
TARGET_BUCKET="invaluable-html-archive-images"
KEYWORDS_FILE="KWs.txt"
PROCESSED_LOG="processed_KWs.log"
FORCE_MODE=false # Default: don't force reprocessing
MAX_RESTARTS=2   # Maximum number of restart attempts 

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

# Function to format timestamp for logging
timestamp() {
  date +"%Y-%m-%d %H:%M:%S"
}

# Function to process a single search request
process_request() {
  local keyword="$1"
  local start_page="$2"
  local attempt="$3"
  
  # Build query URL
  local url="${SERVICE_URL}?query=${keyword}&saveToGcs=true&saveImages=true&bucket=${TARGET_BUCKET}&fetchAllPages=true"
  
  # Add start page if specified
  if [ -n "$start_page" ]; then
    url="${url}&startPage=${start_page}"
    echo "$(timestamp) Attempt ${attempt}: Sending request with startPage=${start_page}..."
  else
    echo "$(timestamp) Attempt ${attempt}: Sending initial request..."
  fi
  
  echo "$(timestamp) Request URL: $url"
  
  # Create temporary files for this request
  local output_file=$(mktemp)
  local error_file=$(mktemp)
  
  # Send the request
  curl -sS --fail --max-time 3600 "$url" > "$output_file" 2> "$error_file"
  local curl_status=$?
  
  # Check for curl errors
  if [ $curl_status -ne 0 ]; then
    echo "$(timestamp) Attempt ${attempt}: Error processing keyword: '$keyword'"
    echo "$(timestamp) Curl command exited with status $curl_status."
    echo "$(timestamp) Error details (from stderr):"
    cat "$error_file"
    if [ $curl_status -eq 28 ]; then
      echo "$(timestamp) Request timed out after 60 minutes."
    fi
    rm -f "$output_file" "$error_file"
    return 1 # Failure
  fi
  
  # Check for restart needed
  if jq -e '.restartNeeded == true' "$output_file" > /dev/null 2>&1; then
    # Get the page to restart from
    local next_page=$(jq -r '.startPage // ""' "$output_file")
    rm -f "$output_file" "$error_file"
    
    if [ -n "$next_page" ]; then
      echo "$(timestamp) Attempt ${attempt}: Received restart signal. Need to restart from page $next_page."
      # Return special code and page number for restart
      echo "RESTART:$next_page"
      return 2 # Special return code for restart
    else
      echo "$(timestamp) Attempt ${attempt}: Received restartNeeded=true but no startPage provided."
      return 1 # Failure
    fi
  fi
  
  # Check for success
  if jq -e '.success == true' "$output_file" > /dev/null 2>&1; then
    # Extract stats for logging
    local total_items=$(jq -r '.pagination.totalItems // 0' "$output_file")
    local total_results=$(jq -r '.data.totalResults // 0' "$output_file")
    
    echo "$(timestamp) Attempt ${attempt}: Successfully processed keyword: '$keyword'"
    echo "$(timestamp) Found $total_items total items, $total_results results returned"
    
    # Show scraping summary if available
    if jq -e '.scrapingSummary' "$output_file" > /dev/null 2>&1; then
      local pages_processed=$(jq -r '.scrapingSummary.pagesProcessed // 0' "$output_file")
      local pages_skipped=$(jq -r '.scrapingSummary.skippedExistingPages // 0' "$output_file")
      local total_pages=$(jq -r '.scrapingSummary.totalPagesFound // 0' "$output_file")
      echo "$(timestamp) Scraping summary: Processed $pages_processed pages, skipped $pages_skipped existing pages, found $total_pages total pages"
    fi
    
    rm -f "$output_file" "$error_file"
    return 0 # Success
  else
    # Failed with an error from the API
    echo "$(timestamp) Attempt ${attempt}: API returned unsuccessful response for keyword: '$keyword'"
    
    # Show error message if available
    if jq -e '.error' "$output_file" > /dev/null 2>&1; then
      local error_msg=$(jq -r '.error' "$output_file")
      echo "$(timestamp) Error message: $error_msg"
    fi
    
    rm -f "$output_file" "$error_file"
    return 1 # Failure
  fi
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

# Process the keywords file
if [ "$FORCE_MODE" = true ]; then
  # Process all keywords in force mode
  keywords_to_process=$(jq -r '.[] | select(. != null and . != "")' "$KEYWORDS_FILE")
  keyword_count=$(echo "$keywords_to_process" | wc -l)
  echo "$(timestamp) Force mode enabled - processing all $keyword_count keywords"
else
  # Only process keywords not in the log
  all_keywords=$(jq -r '.[] | select(. != null and . != "")' "$KEYWORDS_FILE")
  keyword_count=$(echo "$all_keywords" | wc -l)
  
  # Create a temporary file with unprocessed keywords
  unprocessed_file=$(mktemp)
  echo "$all_keywords" | grep -Fxvf "$PROCESSED_LOG" > "$unprocessed_file" || true
  
  keywords_to_process=$(cat "$unprocessed_file")
  unprocessed_count=$(echo "$keywords_to_process" | grep -v "^$" | wc -l)
  processed_count=$((keyword_count - unprocessed_count))
  
  echo "$(timestamp) Found $unprocessed_count keywords to process out of $keyword_count total. $processed_count already processed."
  rm -f "$unprocessed_file"
  
  if [ $unprocessed_count -eq 0 ]; then
    echo "$(timestamp) All keywords from '$KEYWORDS_FILE' have already been processed according to '$PROCESSED_LOG'."
    echo "$(timestamp) To reprocess all keywords, use the --force option."
    exit 0
  fi
fi

echo "$(timestamp) Starting processing..."

# Process each keyword
current_kw_num=0
echo "$keywords_to_process" | while IFS= read -r keyword || [[ -n "$keyword" ]]; do
  # Skip empty lines
  if [ -z "$keyword" ]; then
    continue
  fi
  
  current_kw_num=$((current_kw_num + 1))
  echo "=============================================================="
  echo "$(timestamp) [${current_kw_num}/${keyword_count}] Processing keyword: '$keyword'"
  echo "Started at $(date)"
  
  # Process with restart logic
  success=false
  start_page=""
  restart_count=0
  
  # Make initial request
  result=$(process_request "$keyword" "$start_page" 1)
  status=$?
  
  # Restart loop
  while [ $status -eq 2 ] && [ $restart_count -lt $MAX_RESTARTS ]; do
    # Extract the page number from the result (format: RESTART:pagenum)
    start_page=${result#RESTART:}
    restart_count=$((restart_count + 1))
    
    # Make restart request
    result=$(process_request "$keyword" "$start_page" $((restart_count + 1)))
    status=$?
  done
  
  # Final status check
  if [ $status -eq 0 ]; then
    success=true
  else
    success=false
  fi
  
  # Update processed log
  if [ "$FORCE_MODE" = true ]; then
    # In force mode, remove any previous entries before adding
    temp_log=$(mktemp)
    grep -Fxv "$keyword" "$PROCESSED_LOG" > "$temp_log" || true
    mv "$temp_log" "$PROCESSED_LOG"
  fi
  
  # Add to processed log regardless of success (to avoid retrying failed keywords)
  echo "$keyword" >> "$PROCESSED_LOG"
  
  if [ "$success" = true ]; then
    echo "$(timestamp) Keyword '$keyword' successfully processed and marked as completed."
  else
    if [ $restart_count -gt 0 ]; then
      echo "$(timestamp) WARNING: Keyword '$keyword' failed after $restart_count restart attempts."
    else
      echo "$(timestamp) WARNING: Keyword '$keyword' failed processing."
    fi
    echo "$(timestamp) Adding to processed log to avoid retrying in future runs (unless --force is used)."
  fi
  
  echo "$(timestamp) Completed processing for keyword '$keyword' at $(date)"
  echo "$(timestamp) Taking a short break before the next keyword..."
  sleep 10
  echo "=============================================================="
done

echo "=============================================================="
echo "$(timestamp) All keyword processing attempts completed."
echo "$(timestamp) Check $PROCESSED_LOG for the list of keywords attempted in this run."
echo "=============================================================="

exit 0