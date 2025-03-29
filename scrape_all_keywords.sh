#!/bin/bash
# Advanced script for keyword scraping with robust error handling
# Processes one keyword at a time, tracks progress, and can resume from interruptions
# Adds monitoring for service availability and detailed logging

# Configuration
SERVICE_URL="https://scrapper-856401495068.us-central1.run.app/api/search"
BUCKET_NAME="invaluable-html-archive-images"
INPUT_FILE="KWs.txt"
PROGRESS_FILE="scrape_progress.txt"
REMAINING_FILE="temp_remaining_keywords.txt"
LOG_DIR="scrape_logs"

# Timing and retry parameters
REQUEST_DELAY=60 # Seconds to wait between attempts if service is unavailable
MAX_RETRIES=5 # Maximum number of retries per keyword
TIMEOUT=10800 # Maximum time (in seconds) to wait for a single keyword to complete (3 hours)
MAX_WAIT_TIME=1800 # Maximum time (in seconds) to wait for service to become available again (30 minutes)

# Resource configuration parameters (passed to the service)
# These will be sent as URL parameters to configure the server-side behavior
MAX_MEMORY_GB=${MAX_MEMORY_GB:-8} # Use environment variable or default to 8GB
IMAGE_CONCURRENCY=${IMAGE_CONCURRENCY:-0} # Use environment variable or default to auto-calculation based on memory
ENVIRONMENT=${ENVIRONMENT:-"cloud"} # Use environment variable or default to "cloud" (alternative: "local")

# Create logs directory if it doesn't exist
mkdir -p "$LOG_DIR"

# Generate timestamp for log files
TIMESTAMP=$(date +%Y%m%d_%H%M%S)
MAIN_LOG="$LOG_DIR/scrape_main_$TIMESTAMP.log"
ERROR_LOG="$LOG_DIR/scrape_errors_$TIMESTAMP.log"
KW_LOG="$LOG_DIR/kw_$TIMESTAMP.log"

# Function to log messages
log() {
  echo "[$(date +"%Y-%m-%d %H:%M:%S")] $1" | tee -a "$MAIN_LOG"
}

# Function to log errors
error_log() {
  echo "[$(date +"%Y-%m-%d %H:%M:%S")] ERROR: $1" | tee -a "$ERROR_LOG" | tee -a "$MAIN_LOG"
}

# Function to check if service is available
check_service() {
  log "Checking service availability..."
  local status=$(curl -s -o /dev/null -w "%{http_code}" "$SERVICE_URL?query=test")
  if [ "$status" -eq 200 ] || [ "$status" -eq 400 ]; then
    log "Service is available (status code: $status)"
    return 0  # Service is available
  else
    error_log "Service is unavailable (status code: $status)"
    return 1  # Service is unavailable
  fi
}

# Function to wait for service to become available
wait_for_service() {
  local wait_time=0
  local interval=60 # Check every minute
  
  while [ $wait_time -lt $MAX_WAIT_TIME ]; do
    if check_service; then
      log "Service is now available, continuing with scraping"
      return 0
    fi
    
    log "Service unavailable, waiting $interval seconds (total waited: $wait_time/$MAX_WAIT_TIME seconds)..."
    sleep $interval
    wait_time=$((wait_time + interval))
  done
  
  error_log "Service remained unavailable after waiting $MAX_WAIT_TIME seconds. Exiting."
  return 1
}

# Function to scrape a single keyword
scrape_keyword() {
  local keyword="$1"
  local retry=0
  local success=false
  
  # Skip if keyword is empty
  if [ -z "$keyword" ]; then
    log "Skipping empty keyword"
    return 0
  fi
  
  # Format URL parameters - properly encode query
  local encoded_kw=$(echo "$keyword" | tr ' ' '+')
  
  # Build URL with query parameters - include saveImages=true and resource configuration
  local request_url="$SERVICE_URL?query=$encoded_kw&saveToGcs=true&saveImages=true&bucket=$BUCKET_NAME&fetchAllPages=true&maxMemoryGB=$MAX_MEMORY_GB&imageConcurrency=$IMAGE_CONCURRENCY&environment=$ENVIRONMENT"
  
  log "Processing keyword: '$keyword'"
  log "Request URL: $request_url"
  echo "$keyword" > "$KW_LOG"
  
  while [ $retry -lt $MAX_RETRIES ] && [ "$success" = false ]; do
    # Check if service is available, wait if it's not
    if ! check_service; then
      if ! wait_for_service; then
        error_log "Service unavailable for too long. Aborting keyword '$keyword'."
        return 2 # Special return code for service unavailability
      fi
    fi
    
    # Send GET request to the search service with timeout
    log "Sending request to service (attempt $((retry + 1))/$MAX_RETRIES)..."
    
    # Use timeout command to prevent hanging
    if timeout $TIMEOUT curl -s "$request_url" > /tmp/scrape_response.json; then
      # Check for successful response
      if [ -s /tmp/scrape_response.json ]; then
        response=$(cat /tmp/scrape_response.json)
        
        # Check if response contains "Service Unavailable" or other error indicators
        if [[ "$response" == *"Service Unavailable"* ]] || [[ "$response" == *"<!DOCTYPE html>"* ]] || [[ "$response" == *"Error"* ]]; then
          error_log "Service returned error page. Waiting before retry..."
          sleep $REQUEST_DELAY
          retry=$((retry + 1))
          continue
        elif [[ "$response" == *"error"* ]] && [[ "$response" == *"message"* ]]; then
          error_message=$(echo "$response" | grep -o '"message":"[^"]*"' | cut -d'"' -f4)
          error_log "Service returned error: $error_message. Waiting before retry..."
          sleep $REQUEST_DELAY
          retry=$((retry + 1))
          continue
        else
          # Check if it's a valid JSON response
          if echo "$response" | jq empty >/dev/null 2>&1; then
            log "Successfully processed keyword: '$keyword'"
            
            # Extract basic stats if jq is available
            if command -v jq &> /dev/null; then
              total_items=$(echo "$response" | jq -r '.pagination.totalItems // 0')
              total_pages=$(echo "$response" | jq -r '.pagination.totalPages // 0')
              total_results=$(echo "$response" | jq -r '.data.totalResults // 0')
              
              log "Results for '$keyword': $total_items items across $total_pages pages, $total_results results returned"
            fi
            
            # Mark as successfully processed
            echo "$keyword" >> "$PROGRESS_FILE"
            success=true
            break
          else
            error_log "Invalid JSON response for keyword '$keyword'. Retrying..."
            retry=$((retry + 1))
            sleep $REQUEST_DELAY
            continue
          fi
        fi
      else
        error_log "Empty response from service for keyword '$keyword'. Retrying..."
        retry=$((retry + 1))
        sleep $REQUEST_DELAY
      fi
    else
      error_log "Request timed out after $TIMEOUT seconds for keyword '$keyword'. Retrying..."
      retry=$((retry + 1))
      sleep $REQUEST_DELAY
    fi
  done
  
  if [ "$success" = false ]; then
    error_log "Failed to process keyword '$keyword' after $MAX_RETRIES attempts. Moving to next keyword."
    return 1
  fi
  
  return 0
}

# Check if input file exists
if [ ! -f "$INPUT_FILE" ]; then
  error_log "Keywords file $INPUT_FILE not found!"
  exit 1
fi

# Initialize progress tracking
log "Initializing keyword processing..."

# Extract keywords from JSON array format safely by using 'jq' if available
if command -v jq &> /dev/null; then
  log "Using jq to parse JSON array in $INPUT_FILE"
  # Extract keywords safely with jq
  jq -r ".[] | select(. != null)" "$INPUT_FILE" > /tmp/all_keywords.txt
else
  log "jq not found, using simple text extraction (may not be reliable for all JSON formats)"
  
  # Try a simple extraction as fallback
  if grep -q "^\[" "$INPUT_FILE"; then
    log "Detected JSON array format, attempting simple extraction..."
    grep -v "^\[" "$INPUT_FILE" | grep -v "^\]" | sed 's/^[ ]*"//' | sed 's/",\?$//g' > /tmp/all_keywords.txt
  else
    # Assume plain text, one keyword per line
    cp "$INPUT_FILE" /tmp/all_keywords.txt
  fi
fi

# Check for progress file to resume
if [ -f "$PROGRESS_FILE" ]; then
  log "Found progress file. Resuming from previous run."
  
  # Filter out already processed keywords
  if [ -s "$PROGRESS_FILE" ]; then
    # Use grep to find lines in all_keywords.txt that are not in PROGRESS_FILE
    grep -Fxv -f "$PROGRESS_FILE" /tmp/all_keywords.txt > "$REMAINING_FILE" || true
  else
    cp /tmp/all_keywords.txt "$REMAINING_FILE"
  fi
  
  processed_count=$(wc -l < "$PROGRESS_FILE")
  remaining_count=$(wc -l < "$REMAINING_FILE")
  all_count=$(wc -l < /tmp/all_keywords.txt)
  
  log "Progress: $processed_count/$all_count keywords already processed"
  log "Remaining: $remaining_count keywords to process"
else
  log "Starting fresh run. Processing all keywords from $INPUT_FILE."
  log "Progress will be tracked in $PROGRESS_FILE."
  
  # Create empty progress file
  > "$PROGRESS_FILE"
  
  # Use all keywords as remaining
  cp /tmp/all_keywords.txt "$REMAINING_FILE"
  
  all_count=$(wc -l < /tmp/all_keywords.txt)
  log "Found $all_count total keywords to process."
fi

# Process each keyword from the remaining file
total_keywords=$(wc -l < "$REMAINING_FILE")
current=0

log "Starting processing of $total_keywords keywords..."
log "Logs are being saved to $MAIN_LOG and $ERROR_LOG"
log "Currently active keyword is tracked in $KW_LOG"

# Check if service is available before starting
if ! check_service; then
  if ! wait_for_service; then
    error_log "Service unavailable for too long. Exiting."
    exit 1
  fi
fi

while IFS= read -r keyword; do
  current=$((current + 1))
  
  log "[$current/$total_keywords] Processing keyword: '$keyword'"
  
  # Skip if already processed (extra check)
  if grep -Fx "$keyword" "$PROGRESS_FILE" > /dev/null; then
    log "Keyword '$keyword' already processed. Skipping."
    continue
  fi
  
  # Process the keyword
  scrape_keyword "$keyword"
  result=$?
  
  # Check if we need to abort due to prolonged service unavailability
  if [ $result -eq 2 ]; then
    error_log "Aborting script due to prolonged service unavailability."
    exit 1
  fi
  
  # Update remaining keywords file (remove the processed keyword)
  if [ -f "$REMAINING_FILE" ]; then
    grep -vFx "$keyword" "$REMAINING_FILE" > "$REMAINING_FILE.tmp" || true
    mv "$REMAINING_FILE.tmp" "$REMAINING_FILE"
  fi
  
  # Calculate and show progress
  processed_count=$(wc -l < "$PROGRESS_FILE")
  all_count=$(wc -l < /tmp/all_keywords.txt)
  percent=$((processed_count * 100 / all_count))
  
  log "Completed [$current/$total_keywords]. Overall progress: $processed_count/$all_count ($percent%)."
  log "Waiting 10 seconds before next keyword to let service stabilize..."
  
  # Small delay before next keyword to let system stabilize
  sleep 10
done < "$REMAINING_FILE"

log "All keywords processed. Script completed successfully."
log "Check $PROGRESS_FILE for the list of processed keywords."
log "Check the GCS bucket to verify data was saved correctly."
log "Bucket path: gs://$BUCKET_NAME/"

# Cleanup temporary files
if [ -f /tmp/scrape_response.json ]; then
  rm /tmp/scrape_response.json
fi
if [ -f /tmp/all_keywords.txt ]; then
  rm /tmp/all_keywords.txt
fi