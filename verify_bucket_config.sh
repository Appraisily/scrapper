#!/bin/bash

# Verification script to test the bucket configuration after deployment
# Run this script after deploying the changes to confirm everything is working as expected

# Configuration
SERVICE_URL="https://scrapper-856401495068.us-central1.run.app/api/search"
TARGET_BUCKET="invaluable-html-archive-images"
TEST_KEYWORD="test-verification-keyword"

echo "=== GCS Bucket Configuration Verification ==="
echo "Testing with keyword: $TEST_KEYWORD"
echo "Service URL: $SERVICE_URL"
echo "Target bucket: $TARGET_BUCKET"
echo ""

# Execute a simple test request
echo "Sending test request..."
curl -s \
  --url-query "query=$TEST_KEYWORD" \
  --url-query "saveToGcs=true" \
  --url-query "saveImages=false" \
  --url-query "bucket=$TARGET_BUCKET" \
  --url-query "fetchAllPages=false" \
  "$SERVICE_URL" > test_response.json

# Check if the request was successful
if [ $? -ne 0 ]; then
  echo "Error: Failed to connect to the service."
  exit 1
fi

# Check if the response contains success=true
SUCCESS=$(cat test_response.json | grep -o '"success":true' || echo "")
if [ -z "$SUCCESS" ]; then
  echo "Error: The service returned an error response:"
  cat test_response.json | grep -o '"error":"[^"]*"' || echo "Unknown error"
  exit 1
fi

echo "Test request successful!"
echo ""

# Check if files were saved to GCS by looking for storage path in response
STORAGE_PATH=$(cat test_response.json | grep -o '"storagePath":"[^"]*"' || echo "")
if [ -n "$STORAGE_PATH" ]; then
  echo "Found storage path in response: $STORAGE_PATH"
  echo "Verification successful! The service is correctly saving files to GCS."
else
  echo "Warning: No storage path found in the response."
  echo "This might be normal if there were no results for the test keyword."
  echo "Please check the bucket manually to verify files were saved correctly."
fi

echo ""
echo "You can now run the full keyword processing script:"
echo "  nohup ./process_all_KWs.sh > process_all_KWs.out 2>&1 &"
echo ""
echo "=== Verification Complete ===" 