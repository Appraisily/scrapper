# PowerShell script to test GCS integration with the scraper

# Path to your service account JSON file
# If you're already authenticated with gcloud or running in GCP,
# you can comment this out
# $env:GOOGLE_APPLICATION_CREDENTIALS = "C:\path\to\your-service-account.json"

# Set GCS bucket name (modify as needed)
$env:GCS_BUCKET = "invaluable-data"

# Set log level to show more details
$env:DEBUG = "true"

# Run the test
Write-Host "Running GCS integration test..."
npm run test:gcs

# Check exit code
if ($LASTEXITCODE -eq 0) {
    Write-Host "Test completed successfully!" -ForegroundColor Green
    Write-Host "You can view the saved data in GCS by running:"
    Write-Host "gcloud storage ls gs://$env:GCS_BUCKET/raw/furniture/" -ForegroundColor Cyan
} else {
    Write-Host "Test failed. Check the logs for errors." -ForegroundColor Red
} 