#!/bin/bash

# Script to list all folders in the Google Cloud Storage bucket and save to JSON

BUCKET_NAME="invaluable-html-archive"
OUTPUT_FILE="invaluable_folders.json"

echo "Listing folders from gs://$BUCKET_NAME..."

# List folders in the bucket (files with trailing slash)
FOLDERS=$(gsutil ls -d "gs://$BUCKET_NAME/*/" | sort)

# Process the output to get just the folder names
echo "{" > $OUTPUT_FILE
echo "  \"bucket\": \"$BUCKET_NAME\"," >> $OUTPUT_FILE
echo "  \"timestamp\": \"$(date -u +"%Y-%m-%dT%H:%M:%SZ")\"," >> $OUTPUT_FILE
echo "  \"folders\": [" >> $OUTPUT_FILE

# Process each folder
FIRST=true
for folder in $FOLDERS; do
  # Extract just the folder name (remove bucket prefix and trailing slash)
  NAME=$(echo $folder | sed "s|gs://$BUCKET_NAME/||" | sed 's|/$||')
  
  # Skip if empty
  if [ -z "$NAME" ]; then
    continue
  fi
  
  # Add comma for all but the first entry
  if [ "$FIRST" = true ]; then
    FIRST=false
  else
    echo "," >> $OUTPUT_FILE
  fi
  
  # Write folder to JSON
  echo "    {" >> $OUTPUT_FILE
  echo "      \"name\": \"$NAME\"," >> $OUTPUT_FILE
  
  # Get subfolders if any exist
  SUBFOLDERS=$(gsutil ls -d "$folder*/" | grep -v "^$folder\$" | sort)
  
  if [ -n "$SUBFOLDERS" ]; then
    echo "      \"subfolders\": [" >> $OUTPUT_FILE
    
    # Process subfolders
    SUB_FIRST=true
    for subfolder in $SUBFOLDERS; do
      # Extract just the subfolder name (remove parent folder prefix and trailing slash)
      SUBNAME=$(echo $subfolder | sed "s|$folder||" | sed 's|/$||')
      
      # Skip if empty
      if [ -z "$SUBNAME" ]; then
        continue
      fi
      
      # Add comma for all but the first entry
      if [ "$SUB_FIRST" = true ]; then
        SUB_FIRST=false
      else
        echo "," >> $OUTPUT_FILE
      fi
      
      # Write subfolder to JSON
      echo "        \"$SUBNAME\"" >> $OUTPUT_FILE
    done
    
    echo "      ]" >> $OUTPUT_FILE
  else
    echo "      \"subfolders\": []" >> $OUTPUT_FILE
  fi
  
  echo -n "    }" >> $OUTPUT_FILE
done

echo "" >> $OUTPUT_FILE
echo "  ]" >> $OUTPUT_FILE
echo "}" >> $OUTPUT_FILE

echo "Folder list saved to $OUTPUT_FILE"

# Display statistics
TOTAL_FOLDERS=$(grep -c "name" $OUTPUT_FILE)
echo "Total root folders found: $TOTAL_FOLDERS"

# Make the script executable
chmod +x list-folders.sh