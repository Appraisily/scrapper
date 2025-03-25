#!/bin/bash

# Script to list ALL folders and subfolders in the Google Cloud Storage bucket recursively

BUCKET_NAME="invaluable-html-archive"
OUTPUT_FILE="invaluable_folders_recursive.json"

echo "Listing ALL folders recursively from gs://$BUCKET_NAME..."

# List all objects in the bucket recursively
# Use gsutil ls -r to get all files and folders
ALL_PATHS=$(gsutil ls -r "gs://$BUCKET_NAME/**")

# Extract unique directory paths
echo "Extracting unique folder paths..."
UNIQUE_FOLDERS=$(echo "$ALL_PATHS" | grep -o "gs://$BUCKET_NAME/[^[:space:]]*/" | sort -u)

# Count total folders
FOLDER_COUNT=$(echo "$UNIQUE_FOLDERS" | wc -l)
echo "Found $FOLDER_COUNT unique folders"

# Create a JSON structure
echo "{" > $OUTPUT_FILE
echo "  \"bucket\": \"$BUCKET_NAME\"," >> $OUTPUT_FILE
echo "  \"timestamp\": \"$(date -u +"%Y-%m-%dT%H:%M:%SZ")\"," >> $OUTPUT_FILE
echo "  \"total_folders\": $FOLDER_COUNT," >> $OUTPUT_FILE
echo "  \"folders\": [" >> $OUTPUT_FILE

# Process each folder
FIRST=true
for folder in $UNIQUE_FOLDERS; do
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
  
  # Count JSON files in this folder
  JSON_COUNT=$(gsutil ls "$folder*.json" 2>/dev/null | wc -l)
  
  # Count image files in this folder
  IMAGE_COUNT=$(gsutil ls "$folder*.jpg" "$folder*.jpeg" "$folder*.png" 2>/dev/null | wc -l)
  
  # Write folder to JSON
  echo "    {" >> $OUTPUT_FILE
  echo "      \"path\": \"$DISPLAY_PATH\"," >> $OUTPUT_FILE
  echo "      \"json_files\": $JSON_COUNT," >> $OUTPUT_FILE
  echo "      \"image_files\": $IMAGE_COUNT" >> $OUTPUT_FILE
  echo -n "    }" >> $OUTPUT_FILE
done

echo "" >> $OUTPUT_FILE
echo "  ]" >> $OUTPUT_FILE
echo "}" >> $OUTPUT_FILE

echo "Complete folder list saved to $OUTPUT_FILE"

# Create a more readable summary by category
echo "Generating category summary..."
SUMMARY_FILE="invaluable_category_summary.json"

# Extract categories (first-level folders)
echo "{" > $SUMMARY_FILE
echo "  \"bucket\": \"$BUCKET_NAME\"," >> $SUMMARY_FILE
echo "  \"timestamp\": \"$(date -u +"%Y-%m-%dT%H:%M:%SZ")\"," >> $SUMMARY_FILE
echo "  \"categories\": {" >> $SUMMARY_FILE

# Process categories
CATEGORIES=$(echo "$UNIQUE_FOLDERS" | grep -o "gs://$BUCKET_NAME/[^/]*/")
CATEGORY_FIRST=true

for category_path in $CATEGORIES; do
  CATEGORY=$(echo $category_path | sed "s|gs://$BUCKET_NAME/||" | sed 's|/$||')
  
  # Skip if empty
  if [ -z "$CATEGORY" ]; then
    continue
  fi
  
  # Add comma for all but the first entry
  if [ "$CATEGORY_FIRST" = true ]; then
    CATEGORY_FIRST=false
  else
    echo "," >> $SUMMARY_FILE
  fi
  
  # Count subcategories
  SUBCATEGORIES=$(echo "$UNIQUE_FOLDERS" | grep "gs://$BUCKET_NAME/$CATEGORY/" | grep -o "gs://$BUCKET_NAME/$CATEGORY/[^/]*/" | sed "s|gs://$BUCKET_NAME/$CATEGORY/||" | sed 's|/$||' | sort -u)
  SUBCATEGORY_COUNT=$(echo "$SUBCATEGORIES" | grep -v "^$" | wc -l)
  
  # Count total files in category
  JSON_COUNT=$(gsutil ls "gs://$BUCKET_NAME/$CATEGORY/**.json" 2>/dev/null | wc -l)
  IMAGE_COUNT=$(gsutil ls "gs://$BUCKET_NAME/$CATEGORY/**.jpg" "gs://$BUCKET_NAME/$CATEGORY/**.jpeg" "gs://$BUCKET_NAME/$CATEGORY/**.png" 2>/dev/null | wc -l)
  
  # Write category to JSON
  echo "    \"$CATEGORY\": {" >> $SUMMARY_FILE
  echo "      \"subcategory_count\": $SUBCATEGORY_COUNT," >> $SUMMARY_FILE
  echo "      \"json_files\": $JSON_COUNT," >> $SUMMARY_FILE
  echo "      \"image_files\": $IMAGE_COUNT," >> $SUMMARY_FILE
  
  # Add subcategories array
  echo "      \"subcategories\": [" >> $SUMMARY_FILE
  
  # Process subcategories
  SUBCAT_FIRST=true
  for subcat in $SUBCATEGORIES; do
    # Skip if empty
    if [ -z "$subcat" ]; then
      continue
    fi
    
    # Add comma for all but the first entry
    if [ "$SUBCAT_FIRST" = true ]; then
      SUBCAT_FIRST=false
    else
      echo "," >> $SUMMARY_FILE
    fi
    
    # Count files in subcategory
    SUB_JSON_COUNT=$(gsutil ls "gs://$BUCKET_NAME/$CATEGORY/$subcat/**.json" 2>/dev/null | wc -l)
    SUB_IMAGE_COUNT=$(gsutil ls "gs://$BUCKET_NAME/$CATEGORY/$subcat/**.jpg" "gs://$BUCKET_NAME/$CATEGORY/$subcat/**.jpeg" "gs://$BUCKET_NAME/$CATEGORY/$subcat/**.png" 2>/dev/null | wc -l)
    
    # Write subcategory info
    echo "        {" >> $SUMMARY_FILE
    echo "          \"name\": \"$subcat\"," >> $SUMMARY_FILE
    echo "          \"json_files\": $SUB_JSON_COUNT," >> $SUMMARY_FILE
    echo "          \"image_files\": $SUB_IMAGE_COUNT" >> $SUMMARY_FILE
    echo -n "        }" >> $SUMMARY_FILE
  done
  
  echo "" >> $SUMMARY_FILE
  echo "      ]" >> $SUMMARY_FILE
  echo -n "    }" >> $SUMMARY_FILE
done

echo "" >> $SUMMARY_FILE
echo "  }" >> $SUMMARY_FILE
echo "}" >> $SUMMARY_FILE

echo "Category summary saved to $SUMMARY_FILE"

# Make the script executable
chmod +x list-folders-recursive.sh