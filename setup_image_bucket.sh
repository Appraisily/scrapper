#!/bin/bash
# Script to create and initialize the invaluable-html-archive-images bucket

# Configuration
PROJECT_ID="civil-forge-403609"
BUCKET_NAME="invaluable-html-archive-images"
REGION="us-central1"
LOG_FILE="bucket_setup.log"

echo "Setting up image storage bucket..." | tee $LOG_FILE
echo "Started at: $(date)" | tee -a $LOG_FILE
echo "Project ID: $PROJECT_ID" | tee -a $LOG_FILE
echo "Bucket name: $BUCKET_NAME" | tee -a $LOG_FILE
echo "Region: $REGION" | tee -a $LOG_FILE

# Check if the bucket already exists
echo "Checking if bucket already exists..." | tee -a $LOG_FILE
BUCKET_EXISTS=$(gsutil ls -p $PROJECT_ID 2>/dev/null | grep "gs://$BUCKET_NAME/")

if [ ! -z "$BUCKET_EXISTS" ]; then
  echo "Bucket $BUCKET_NAME already exists." | tee -a $LOG_FILE
else
  echo "Creating new bucket $BUCKET_NAME..." | tee -a $LOG_FILE
  
  # Create the bucket with appropriate settings
  gsutil mb -p $PROJECT_ID -l $REGION -b on gs://$BUCKET_NAME/
  
  if [ $? -eq 0 ]; then
    echo "Bucket created successfully." | tee -a $LOG_FILE
  else
    echo "Failed to create bucket. Please check your permissions and project ID." | tee -a $LOG_FILE
    exit 1
  fi
  
  # Set uniform bucket-level access
  echo "Setting uniform bucket-level access..." | tee -a $LOG_FILE
  gsutil uniformbucketlevelaccess set on gs://$BUCKET_NAME/
  
  # Enable public access prevention
  echo "Enabling public access prevention..." | tee -a $LOG_FILE
  gsutil pap set enforced gs://$BUCKET_NAME/
  
  # Set lifecycle management policy for cold storage after 90 days
  echo "Setting lifecycle management policy..." | tee -a $LOG_FILE
  
  # Create a temporary lifecycle policy file
  cat > /tmp/lifecycle.json << EOL
{
  "lifecycle": {
    "rule": [
      {
        "action": {
          "type": "SetStorageClass",
          "storageClass": "NEARLINE"
        },
        "condition": {
          "age": 90,
          "matchesStorageClass": ["STANDARD"]
        }
      }
    ]
  }
}
EOL
  
  # Apply the lifecycle policy
  gsutil lifecycle set /tmp/lifecycle.json gs://$BUCKET_NAME/
  
  # Clean up the temporary file
  rm /tmp/lifecycle.json
fi

# Create the main data directory structure
echo "Creating base directory structure..." | tee -a $LOG_FILE
gsutil cp /dev/null gs://$BUCKET_NAME/invaluable-data/.keep

echo "Bucket setup completed at: $(date)" | tee -a $LOG_FILE
echo "Ready to use bucket gs://$BUCKET_NAME/ for image storage" | tee -a $LOG_FILE

# Make the script executable
chmod +x setup_image_bucket.sh