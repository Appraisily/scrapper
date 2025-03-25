#!/bin/bash

# Simple script to list ALL folders in the Google Cloud Storage bucket
# This version is optimized for Cloud Shell and handles large bucket structures

BUCKET_NAME="invaluable-html-archive"
OUTPUT_FILE="invaluable_all_folders.json"
TEMP_FILE="temp_folders.txt"

echo "Listing ALL folders from gs://$BUCKET_NAME..."

# List all folders and subfolders recursively with direct gsutil command
gsutil ls -d "gs://$BUCKET_NAME/**/" > $TEMP_FILE

# Count folders
FOLDER_COUNT=$(cat $TEMP_FILE | wc -l)
echo "Found $FOLDER_COUNT folders"

# Create a JSON structure
echo "{" > $OUTPUT_FILE
echo "  \"bucket\": \"$BUCKET_NAME\"," >> $OUTPUT_FILE
echo "  \"timestamp\": \"$(date -u +"%Y-%m-%dT%H:%M:%SZ")\"," >> $OUTPUT_FILE
echo "  \"total_folders\": $FOLDER_COUNT," >> $OUTPUT_FILE
echo "  \"folders\": [" >> $OUTPUT_FILE

# Process each folder
FIRST=true
while read folder; do
  # Remove bucket prefix for display
  DISPLAY_PATH=$(echo $folder | sed "s|gs://$BUCKET_NAME/||" | sed 's|/$||')
  
  # Skip if empty
  if [ -z "$DISPLAY_PATH" ]; then
    continue
  fi
  
  # Add comma for all but the first entry
  if [ "$FIRST" = true ]; then
    FIRST=false
  else
    echo "," >> $OUTPUT_FILE
  fi
  
  # Write folder to JSON
  echo "    \"$DISPLAY_PATH\"" >> $OUTPUT_FILE
done < $TEMP_FILE

echo "  ]" >> $OUTPUT_FILE
echo "}" >> $OUTPUT_FILE

# Clean up
rm $TEMP_FILE

echo "Complete folder list saved to $OUTPUT_FILE"

# Make the script executable
chmod +x list-all-folders.sh