# Google Cloud Scheduler Setup for Automated Scraping

This guide explains how to set up Google Cloud Scheduler to automatically trigger the scraping process at scheduled intervals without manual intervention.

## Overview

The scraper application now includes a `/api/invaluable/refresh-all` endpoint that can be triggered by Cloud Scheduler. When called, this endpoint will:

1. Read all keywords from the `KWs.txt` file
2. Process each keyword sequentially, scraping all available pages
3. Store results in Google Cloud Storage

## Implementation Details

The automated refresh functionality is built with a clean, modular design:

- **refresh-service.js**: Dedicated module that handles the core refresh logic
- **general-scraper.js**: Contains the HTTP endpoint that initiates the process

This separation ensures that the code is maintainable and follows best practices for organization.

## Prerequisites

- Google Cloud Platform account with billing enabled
- The scraper deployed to Google Cloud Run
- Appropriate IAM permissions to create and manage Cloud Scheduler jobs
- Service account with necessary permissions to invoke Cloud Run services

## Setup Instructions

### 1. Obtain the Cloud Run Service URL

First, make sure you have the URL of your deployed scraper service. It should look like:
```
https://scrapper-XXXXXXXX.run.app
```

### 2. Create a Service Account for Cloud Scheduler

Cloud Scheduler needs a service account with permission to invoke your Cloud Run service.

1. In the GCP Console, go to IAM & Admin > Service Accounts
2. Click "Create Service Account"
3. Name: `scheduler-invoker`
4. Description: `Service account for Cloud Scheduler to invoke Cloud Run services`
5. Click "Create and Continue"
6. Add the "Cloud Run Invoker" role (`roles/run.invoker`)
7. Click "Done"

### 3. Create a Cloud Scheduler Job

1. In the GCP Console, go to Cloud Scheduler
2. Click "Create Job"
3. Name: `scraper-refresh-daily` (or any descriptive name)
4. Region: Select the region where your Cloud Run service is deployed
5. Description: `Trigger daily refresh of all scraper keywords`
6. Frequency: Enter a cron expression for your desired schedule
   - For daily runs at 2 AM: `0 2 * * *`
   - For weekly runs on Sunday at 3 AM: `0 3 * * 0`
   - For monthly runs on the 1st at 4 AM: `0 4 1 * *`
7. Timezone: Select your preferred timezone

8. Under "Configure the execution":
   - Target type: `HTTP`
   - URL: `https://your-service-url/api/invaluable/refresh-all`
   - HTTP method: `GET`
   - Auth header: `Add OIDC token`
   - Service account: Select the `scheduler-invoker` service account you created
   - Audience: Enter your service URL `https://your-service-url`

9. Click "Create"

### 4. Test the Job

1. In the Cloud Scheduler interface, find your newly created job
2. Click "Run now" to test the job manually
3. Check Cloud Run logs to confirm that the scraper started successfully

## Monitoring and Troubleshooting

- **Logs**: View the Cloud Run logs to monitor the progress of your scraping jobs
- **Job History**: Cloud Scheduler maintains a history of job executions, allowing you to see if jobs have run successfully
- **Error Handling**: If a job fails, check the Cloud Run logs for error details

### Key Logs to Look For

The refresh service logs detailed information about each step of the process:
- Number of keywords found and processed
- Statistics for each keyword (pages processed, items found)
- Any errors encountered during processing

## Optimizing the Schedule

Consider the following when setting your schedule:

- **Resource Usage**: Scraping is resource-intensive. Schedule during off-peak hours.
- **Data Freshness**: How often do you need the data to be refreshed?
- **Cost Considerations**: More frequent scraping means higher compute costs.
- **Rate Limiting**: Frequent scraping may trigger rate limits on the target site.

## Adjusting the Keyword List

To modify the keywords being scraped:

1. Update the `KWs.txt` file in your repository
2. Redeploy your Cloud Run service with the updated file

The next scheduled run will automatically use the updated keyword list.

## Reusing the Code

The refresh-service module is designed to be reusable. If you need to trigger the refresh process from other parts of your application, you can simply import the module:

```javascript
const refreshService = require('./utils/refresh-service');

// Trigger the refresh process
const result = await refreshService.startRefresh();
```

This modular design makes the codebase more maintainable and extensible.

## Triggering the Artist Orchestrator

If you want Cloud Scheduler to iterate through a subset of the *artists.json* file (for example the first 10 artists) and trigger the full scraping workflow, use the new `/api/orchestrator/artists` endpoint that was added in PR #??? (this change).

Example Cloud Scheduler job configuration:

```
Target type : HTTP
URL         : https://scrapper-856401495068.us-central1.run.app/api/orchestrator/artists?maxArtists=10
Method      : GET
Auth Header : Add OIDC token (service account with *Cloud Run Invoker* role)
```

Query parameters you can tweak:

| Param            | Description                                             | Default |
|------------------|---------------------------------------------------------|---------|
| `startIndex`     | Start position inside artists array                     | `0`     |
| `maxArtists`     | Maximum number of artists to process                    | `10`    |
| `useSubset`      | `true` to automatically create/use `artists_subset.json`| `true`  |
| `subsetSize`     | How many artists to include in the subset file          | `10`    |

Because the orchestrator runs potentially for a long time, the endpoint returns HTTP **202 Accepted** immediately so Cloud Scheduler does not time-out. All progress is visible in the Cloud Run logs. 