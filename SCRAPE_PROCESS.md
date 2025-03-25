# Invaluable Data Scraping Process

This document outlines the process for scraping auction data and images from Invaluable.com using the deployed scraper service.

## Overview

The scraping process involves:

1. Creating a dedicated Google Cloud Storage bucket for images
2. Using orchestration scripts to send keywords one by one to the scraper service
3. The service handles scraping data and images for each keyword
4. All data is saved to the GCS bucket in an organized structure

## Setup

### Bucket Creation

Create the dedicated bucket for images with:

```bash
gcloud storage buckets create gs://invaluable-html-archive-images \
  --project=civil-forge-403609 \
  --location=us-central1 \
  --uniform-bucket-level-access \
  --public-access-prevention
```

### Input File

Ensure you have a file called `KWs.txt` with one keyword per line. Example:

```
antique furniture
fine art
victorian chairs
chinese porcelain
vintage jewelry
```

## Scraping Scripts

Two scripts are provided for orchestrating the scraping process:

### 1. Test Script (`test_scrape.sh`)

This script processes the first 3 keywords from your list to verify everything works correctly.

```bash
chmod +x test_scrape.sh
./test_scrape.sh
```

### 2. Main Orchestration Script (`scrape_all_keywords.sh`)

This script processes all keywords from the input file, with progress tracking and logging.

```bash
chmod +x scrape_all_keywords.sh
./scrape_all_keywords.sh
```

## How It Works

### Service URL and Parameters

The orchestration scripts call the scraper service with the following URL pattern:

```
https://scrapper-856401495068.us-central1.run.app/api/search?query=YOUR_KEYWORD&saveToGcs=true&saveImages=true&bucket=invaluable-html-archive-images&fetchAllPages=true
```

Parameters explained:
- `query`: The search keyword (URL-encoded)
- `saveToGcs`: Flag to save results to Google Cloud Storage
- `saveImages`: Flag to download and save item images
- `bucket`: Destination GCS bucket name
- `fetchAllPages`: Flag to scrape all available result pages

### Progress Tracking

The main orchestration script:
- Maintains a file `completed_keywords.txt` with processed keywords
- Can be stopped and restarted at any time - it will resume from where it left off
- Logs all activities to `scraping_progress.log`

### Expected Output Structure

Data is organized in the bucket as follows:

```
gs://invaluable-html-archive-images/
└── invaluable-data/
    └── {keyword}/
        ├── page_0001.json
        ├── page_0002.json
        ├── ...
        └── images/
            ├── {lotNumber}_image1.jpg
            ├── {lotNumber}_image2.jpg
            └── ...
```

## Data Volume Considerations

With approximately 2,800 keywords, each with multiple pages and images:

- **JSON Data**: Each keyword may generate 10+ pages of JSON data (~10-20KB per page)
- **Images**: Each keyword may generate 500-1000 images (~200KB per image)
- **Total Storage**: Approximately 300-500GB of total data (mostly images)

## Monitoring

To monitor the scraping process:

1. Check the log file:
   ```bash
   tail -f scraping_progress.log
   ```

2. Check progress stats:
   ```bash
   echo "Completed: $(wc -l < completed_keywords.txt) / $(wc -l < KWs.txt) keywords"
   ```

3. Check the bucket contents:
   ```bash
   gsutil ls -l "gs://invaluable-html-archive-images/invaluable-data/"
   ```

## Troubleshooting

Common issues and solutions:

1. **Empty response from service**:
   - Check if the service is online
   - Verify your network connection
   - The keyword might need URL encoding for special characters

2. **Missing images**:
   - Some items may not have images
   - Cloudflare protection might block some image downloads

3. **Interrupted process**:
   - Simply restart the script - it will continue from where it left off

## Next Steps

After completing the scraping process:

1. Verify data quality and completeness
2. Process the raw data into a structured database
3. Implement lifecycle policies for cost-effective storage
4. Create thumbnail versions of images for faster loading

## Processing Resources

For large-scale data processing after scraping:

1. **ETL Processing**: See `DATA_PROCESSING_PLAN.md` for detailed information on processing the scraped data
2. **Database Design**: Consider PostgreSQL for structured auction data
3. **Image Processing**: Use Cloud Functions to generate thumbnails and extract metadata