# Scraper API Endpoints

The Scraper API allows you to start and monitor data collection jobs that run in the background and store data directly to Google Cloud Storage.

## Endpoints

### Start a Scraping Job

```
POST /api/scraper/start
```

This endpoint starts a new scraping job that collects data from Invaluable and saves it to Google Cloud Storage.

#### Request Body

```json
{
  "category": "furniture",       // Required: Category to scrape
  "query": "antique",            // Optional: Additional keyword filter
  "maxPages": 3,                 // Optional: Max pages to scrape (default 10)
  "startPage": 1,                // Optional: Page to start from (default 1)
  "batchSize": 100,              // Optional: Pages per batch file (default 100)
  "gcsBucket": "invaluable-data", // Optional: GCS bucket name (default "invaluable-data")
  "baseDelay": 2000,             // Optional: Base delay between requests in ms (default 2000)
  "maxDelay": 30000,             // Optional: Maximum delay in ms (default 30000)
  "minDelay": 1000,              // Optional: Minimum delay in ms (default 1000)
  "saveToGcs": true              // Optional: Whether to save to GCS (default true)
}
```

#### Response

```json
{
  "success": true,
  "message": "Scraping job started",
  "jobDetails": {
    "category": "furniture",
    "query": "antique",
    "maxPages": 3,
    "startPage": 1,
    "saveToGcs": true,
    "gcsBucket": "invaluable-data",
    "estimatedTimeMinutes": 2
  }
}
```

#### Notes

- The endpoint returns immediately with a success message, and the scraping job continues in the background.
- The job runs asynchronously and doesn't block other API requests.
- Logs for the job progress will be visible in the server console.

### Check Job Status (Future Implementation)

```
GET /api/scraper/status/:jobId
```

This endpoint will provide the status of a scraping job. Not yet fully implemented.

## Example Usage

### Start a 3-page scraping job

```bash
curl -X POST "https://valuer-dev-856401495068.us-central1.run.app/api/scraper/start" \
  -H "Content-Type: application/json" \
  -d '{
    "category": "furniture",
    "maxPages": 3,
    "gcsBucket": "invaluable-data"
  }'
```

### Start a job with custom parameters

```bash
curl -X POST "https://valuer-dev-856401495068.us-central1.run.app/api/scraper/start" \
  -H "Content-Type: application/json" \
  -d '{
    "category": "jewelry",
    "query": "diamond",
    "maxPages": 5,
    "batchSize": 50,
    "baseDelay": 3000
  }'
```

## GCS Data Structure

Data is stored in Google Cloud Storage with the following structure:

```
gs://[bucket-name]/
  └── raw/
      └── [category]/
          ├── metadata.json       # Collection info, statistics
          ├── page_001-100.json   # Batched page results
          ├── page_101-200.json   # Batched page results
          └── ...
``` 