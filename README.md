# Invaluable Art Market Scraper

A specialized Node.js web scraper for extracting fine art auction data from Invaluable.com. Built with Puppeteer, Express, and advanced anti-detection measures. Focuses on capturing both API responses and HTML states while handling protection challenges.

## Overview

This scraper is designed to capture both HTML content and API responses from Invaluable's art auction listings and artist directories, with specific focus on:
- API response monitoring and capture
- Cookie-based authentication
- Protection/challenge page handling
- Raw HTML state preservation

## Features

### Core Functionality

#### Search Scraper
- Multi-artist search processing
- Cookie-based authentication
- API response capture and deduplication
- Multi-tab processing
- Parallel artist processing
- Independent browser instance

#### API Response Monitoring
- Response size validation
- Duplicate detection
- Hash-based comparison
- First response capture
- Response metadata tracking

### Protection Handling
- Cloudflare challenge bypass
- Bot detection avoidance
- Cookie persistence and validation
- Session persistence
- Protection state detection

### Technical Features

#### Browser Automation
- Independent browser instances per scraper
- Multi-tab support
- Cookie management
- Puppeteer with Stealth Plugin
- Human behavior simulation:
  - Random mouse movements
  - Natural scrolling patterns
  - Realistic timing delays
  - Dynamic viewport handling

#### Storage Integration
- Google Cloud Storage organization:
  ```
  Fine Art/
  ├── api/
  │   ├── {searchId}-{artistId}-response1.json
  │   └── {searchId}-{artistId}-response2.json
  ├── metadata/
  │   └── {searchId}.json
  └── html/
      ├── {searchId}-{artistId}-initial.html
      └── {searchId}-{artistId}-final.html
  ```

#### API Features
- RESTful endpoints
- Query parameter support
- Comprehensive response format
- Error handling and recovery
- Debug logging

## Prerequisites

- Node.js (v18 or higher)
- Google Cloud SDK
- Docker (for containerization)
- Access to Google Cloud Storage bucket

## Environment Variables

Required variables in `.env`:
```
GOOGLE_CLOUD_PROJECT=your-project-id
STORAGE_BUCKET=invaluable-html-archive
```

## Installation

1. Clone the repository:
```bash
git clone <repository-url>
cd invaluable-scraper
```

2. Install dependencies:
```bash
npm install
```

3. Start the server:
```bash
npm start
```

## API Documentation

### Search Endpoint

```
GET /api/invaluable
```

Searches for artworks by specified artists with configurable parameters.

Example Response:
```json
{
  "success": true,
  "results": [
    {
      "artist": "Artist Name",
      "apiData": {
        "responses": [...]
      },
      "timestamp": "2024-02-03T09:15:51.894Z"
    }
  ],
  "timestamp": "2024-02-03T09:15:51.894Z"
}
```

## Architecture

### Scraper Components

#### API Response Monitor
- Dedicated browser instance
- Independent state management
- Handles artist directory crawling
- Manages subindex processing
- Saves HTML states and results

#### Search Scraper
- Separate browser instance
- Cookie-based authentication
- API response monitoring
- Multi-artist search processing
- Independent storage operations

### Process Flow

1. Server Initialization
   - Create storage connection
   - Initialize browser instance
   - Set up API endpoints

2. Search Process
   - Process each artist independently
   - Create new tab per artist
   - Monitor API responses
   - Handle protection
   - Save results and metadata

## Error Handling

The system includes robust error handling for:
- Network timeouts (45s default)
- Protection challenges
- API failures
- Storage errors
- Invalid responses
- Rate limiting

Key features:
- Independent error handling per scraper
- Automatic retries (3 attempts)
- Debug screenshots
- State preservation
- Detailed error logging
- Graceful degradation

## Deployment

### Docker

Build the image:
```bash
docker build -t invaluable-scraper .
```

Run locally:
```bash
docker run -p 8080:8080 \
  -e GOOGLE_CLOUD_PROJECT=your-project-id \
  -e STORAGE_BUCKET=invaluable-html-archive \
  invaluable-scraper
```

### Google Cloud Run

Deploy using Cloud Build:
```bash
gcloud builds submit --config cloudbuild.yaml
```

## Project Structure

```
├── src/
│   ├── server.js                 # Express server setup
│   ├── routes/
│   │   ├── artists.js           # Artist list endpoint
│   │   └── search.js            # Search endpoint
│   ├── scrapers/
│   │   └── invaluable/
│   │       ├── index.js         # Main scraper class
│   │       ├── browser.js       # Browser management
│   │       ├── auth.js          # Authentication handling
│   │       ├── utils.js         # Shared utilities
│   │       └── search/          # Search scraper
│   │           ├── index.js     # Search implementation
│   │           ├── api-monitor.js # API response capture
│   └── utils/
│       └── storage.js           # GCS integration
├── Dockerfile                    # Container configuration
├── cloudbuild.yaml              # Cloud Build config
└── package.json                 # Dependencies
```

## License

MIT License