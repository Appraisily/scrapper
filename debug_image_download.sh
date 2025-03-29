#!/bin/bash
# Debug script to test image downloading functionality specifically

# Configuration
SERVICE_URL="https://scrapper-856401495068.us-central1.run.app/api/search"
BUCKET_NAME="invaluable-html-archive-images"
TEST_KEYWORD="furniture"

echo "=== Image Download Debug Test ==="
echo "Service URL: $SERVICE_URL"
echo "Target bucket: $BUCKET_NAME"
echo "Test keyword: $TEST_KEYWORD"
echo "Started at $(date)"

# Build URL with explicit saveImages parameter for debugging
REQUEST_URL="$SERVICE_URL?query=$TEST_KEYWORD&saveToGcs=true&saveImages=true&bucket=$BUCKET_NAME&fetchAllPages=false&maxPages=1"

echo "Request URL: $REQUEST_URL"
echo "Sending request to service with debug options..."

# Use verbose curl to see headers
RESPONSE=$(curl -v "$REQUEST_URL" 2>&1)

# Save the response for analysis
echo "$RESPONSE" > image_download_debug_response.txt

echo "Response saved to image_download_debug_response.txt"
echo "Test completed at $(date)"

# Analyze the results
echo "Checking for image-related output in the response..."
grep -i "image\|photo" image_download_debug_response.txt | head -10