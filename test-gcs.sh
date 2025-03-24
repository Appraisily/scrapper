#!/bin/bash
# Script to test GCS integration with the scraper

# Path to your service account JSON file
# If you're already authenticated with gcloud or running in GCP,
# you can comment this out to use Application Default Credentials
# export GOOGLE_APPLICATION_CREDENTIALS="/path/to/your-service-account.json"

# Set GCS bucket name (modify as needed)
export GCS_BUCKET="invaluable-data"

# Set log level to show more details
export DEBUG="true"

# Run the test
echo "Running GCS integration test..."
npm run test:gcs

# Check exit code
if [ $? -eq 0 ]; then
  echo "Test completed successfully!"
  echo "You can view the saved data in GCS by running:"
  echo "gsutil ls -l gs://$GCS_BUCKET/raw/furniture/"
else
  echo "Test failed. Check the logs for errors."
fi 