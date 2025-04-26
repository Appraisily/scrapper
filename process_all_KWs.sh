#!/bin/bash

# Configuration
SERVICE_URL="https://scrapper-856401495068.us-central1.run.app/api/search"
TARGET_BUCKET="invaluable-html-archive-images"
KEYWORDS_FILE="KWs.txt"
PROCESSED_LOG="processed_KWs.log"
TEMP_ALL_KEYWORDS_FILE=$(mktemp)  # Temporary file for all keywords from JSON
TEMP_UNPROCESSED_FILE=$(mktemp) # Temporary file for unprocessed keywords
FORCE_MODE=false # Default: don't force reprocessing
MAX_RESTARTS=2 # Maximum number of times to attempt a restart for a single keyword

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
  # Clean up any lingering curl output files
  rm -f curl_output_*.tmp curl_error_*.tmp
}
trap cleanup EXIT INT TERM # Ensure cleanup happens on script exit or interruption

# Function to format timestamp for logging
timestamp() {
  date +"%Y-%m-%d %H:%M:%S"
}

# Function to make the API request and handle response
# Takes keyword, start_page (optional), and attempt number as arguments
make_request() {
  local keyword="$1"
  local start_page="$2" # Optional start page for restarts
  local attempt="$3"
  local curl_output_file=$(mktemp curl_output_${keyword// /_}_${attempt}.tmp) # Unique temp file name
  local curl_error_file=$(mktemp curl_error_${keyword// /_}_${attempt}.tmp)
  local request_url="$SERVICE_URL"
  local query_params=(
    "query=$keyword"
    "saveToGcs=true"
    "saveImages=true"
    "bucket=$TARGET_BUCKET"
    "fetchAllPages=true"
  )

  # Add startPage parameter if provided (for restarts)
  if [ -n "$start_page" ]; then
    query_params+=("startPage=$start_page")
    echo "$(timestamp) Attempt ${attempt}: Sending request with startPage=${start_page}..."
  else
    echo "$(timestamp) Attempt ${attempt}: Sending initial request..."
  fi

  # Construct the full URL with query parameters properly encoded
  local full_url="${request_url}?"
  local first_param=true
  for param in "${query_params[@]}"; do
    if [ "$first_param" = true ]; then
      full_url+="$param"
      first_param=false
    else
      full_url+="&$param"
    fi
  done

  echo "$(timestamp) Request URL: $full_url"

  # Execute curl with a long timeout (60 minutes)
  curl -sS --fail --max-time 3600 "$full_url" > "$curl_output_file" 2> "$curl_error_file"
  local exit_status=$?

  # Store results in global variables for the main loop to access
  # Using unique names to avoid conflicts in potential recursive calls (though we avoid recursion here)
  # Use eval to dynamically set variable names based on attempt number
  eval "REQUEST_EXIT_STATUS_${attempt}=${exit_status}"
  eval "REQUEST_OUTPUT_FILE_${attempt}='${curl_output_file}'"
  eval "REQUEST_ERROR_FILE_${attempt}='${curl_error_file}'"
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

  # --- Request Loop with Restart Logic ---
  success=false
  start_page="" # Start with no specific start page
  restart_count=0

  while [ "$restart_count" -le "$MAX_RESTARTS" ]; do
    attempt=$((restart_count + 1))
    make_request "$keyword" "$start_page" "$attempt"

    # Retrieve results from global variables set by make_request
    current_exit_status=$(eval echo \$REQUEST_EXIT_STATUS_${attempt})
    current_output_file=$(eval echo \$REQUEST_OUTPUT_FILE_${attempt})
    current_error_file=$(eval echo \$REQUEST_ERROR_FILE_${attempt})

    if [ "$current_exit_status" -eq 0 ]; then
      # Check for restartNeeded flag first
      if jq -e '.restartNeeded == true' "$current_output_file" > /dev/null 2>&1; then
        start_page=$(jq -r '.startPage // ""' "$current_output_file")
        if [ -n "$start_page" ]; then
          echo "$(timestamp) Attempt ${attempt}: Received restart signal. Will restart from page $start_page."
          restart_count=$((restart_count + 1))
          # Clean up temp files for this attempt before the next one
          rm -f "$current_output_file" "$current_error_file"
          # Check if we exceeded max restarts
          if [ "$restart_count" -gt "$MAX_RESTARTS" ]; then
             echo "$(timestamp) Maximum restart attempts ($MAX_RESTARTS) reached for keyword '$keyword'. Marking as failed."
             success=false
             break # Exit the inner while loop
          fi
          # Continue to the next iteration of the while loop to make the new request
          continue
        else
          echo "$(timestamp) Attempt ${attempt}: Received restartNeeded=true but no startPage provided. Treating as failure."
          success=false
          break # Exit the inner while loop
        fi
      # If no restart needed, check for overall success
      elif jq -e '.success == true' "$current_output_file" > /dev/null 2>&1; then
        total_items=$(jq -r '.pagination.totalItems // 0' "$current_output_file")
        total_results=$(jq -r '.data.totalResults // 0' "$current_output_file")
        echo "$(timestamp) Attempt ${attempt}: Successfully processed keyword: '$keyword'"
        echo "$(timestamp) Found $total_items total items, $total_results results returned"
        if jq -e '.scrapingSummary' "$current_output_file" > /dev/null 2>&1; then
           pages_processed=$(jq -r '.scrapingSummary.pagesProcessed // 0' "$current_output_file")
           pages_skipped=$(jq -r '.scrapingSummary.skippedExistingPages // 0' "$current_output_file")
           total_pages=$(jq -r '.scrapingSummary.totalPagesFound // 0' "$current_output_file")
           echo "$(timestamp) Scraping summary: Processed $pages_processed pages, skipped $pages_skipped existing pages, found $total_pages total pages"
        fi
        success=true
        break # Exit the inner while loop, keyword processed successfully
      else
        echo "$(timestamp) Attempt ${attempt}: API returned success=false or unexpected JSON for keyword: '$keyword'"
        if jq -e '.error' "$current_output_file" > /dev/null 2>&1; then
          error_msg=$(jq -r '.error' "$current_output_file")
          echo "$(timestamp) Error message: $error_msg"
        else
          echo "$(timestamp) Response content:"
          cat "$current_output_file"
        fi
        success=false
        break # Exit the inner while loop, keyword failed
      fi
    else
      echo "$(timestamp) Attempt ${attempt}: Error processing keyword: '$keyword'"
      echo "$(timestamp) Curl command exited with status $current_exit_status."
      echo "$(timestamp) Error details (from stderr):"
      cat "$current_error_file"
      if [ "$current_exit_status" -eq 28 ]; then
        echo "$(timestamp) Request timed out after 60 minutes."
      fi
      success=false
      break # Exit the inner while loop, keyword failed due to curl error
    fi

    # Should not be reached if break conditions work correctly, but acts as safety
    break

  done # End of while loop for restarts

  # Clean up temp files for the last attempt
  rm -f "$current_output_file" "$current_error_file"

  # --- Log Result ---
  # Decide whether to add to processed log based on final 'success' status
  if [ "$success" = true ]; then
     # Ensure removal if FORCE_MODE is on, then add
    if [ "$FORCE_MODE" = true ]; then
      TEMP_LOG_FILE=$(mktemp)
      grep -Fxv "$keyword" "$PROCESSED_LOG" > "$TEMP_LOG_FILE"
      mv "$TEMP_LOG_FILE" "$PROCESSED_LOG"
    fi
    echo "$keyword" >> "$PROCESSED_LOG"
    echo "$(timestamp) Keyword '$keyword' marked as successfully processed."
  else
    echo "$(timestamp) WARNING: Keyword '$keyword' failed after all attempts (including restarts)."
    echo "$(timestamp) Adding to processed log to avoid retrying in future runs (unless --force is used)."
    # Ensure removal if FORCE_MODE is on, then add
    if [ "$FORCE_MODE" = true ]; then
      TEMP_LOG_FILE=$(mktemp)
      grep -Fxv "$keyword" "$PROCESSED_LOG" > "$TEMP_LOG_FILE"
      mv "$TEMP_LOG_FILE" "$PROCESSED_LOG"
    fi
    echo "$keyword" >> "$PROCESSED_LOG"
  fi

  echo "$(timestamp) Completed processing for keyword '$keyword' at $(date)"
  echo "$(timestamp) Taking a short break before the next keyword..."
  sleep 10 # Short break between keywords
  echo "=============================================================="

done < "$TEMP_UNPROCESSED_FILE" # Read from the temp file containing only unprocessed KWs

echo "=============================================================="
echo "$(timestamp) All keyword processing attempts completed."
echo "$(timestamp) Total unprocessed keywords attempted: $current_kw_num"
echo "$(timestamp) Check $PROCESSED_LOG for the list of keywords attempted in this run."
echo "=============================================================="

# Cleanup is handled by the trap

exit 0