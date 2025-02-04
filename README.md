# Invaluable Art Market Scraper

A specialized Node.js web scraper for extracting fine art auction data from Invaluable.com. Built with Puppeteer, Express, and advanced anti-detection measures. Focuses on capturing both API responses and HTML states while handling protection challenges.

## Overview

This scraper is designed to capture both HTML content and API responses from Invaluable's art auction listings and artist directories, with specific focus on:
- Algolia API response monitoring and capture
- Cookie-based authentication
- Protection/challenge page handling
- Raw HTML state preservation

## Features

### Core Functionality

#### Artist Directory Scraper
- Algolia API response capture
- Cookie-based authentication
- Multi-page processing
- Protection state handling
- Response deduplication

#### Search Scraper
- Multi-artist search processing
- Cookie-based authentication
- catResults API response capture
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
  invaluable/
  ├── algolia/
  │   └── artists/
  │       └── {artistId}/
  │           └── {timestamp}/
  │               ├── responses/
  │               │   ├── response-1.json
  │               │   └── response-2.json
  │               └── metadata.json
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

### Artist Directory Endpoint

```
GET /api/invaluable/artists
```

Retrieves the list of artists from Invaluable's artist directory.

Example Response:
```json
{
  "success": true,
  "message": "Artist list retrieved successfully",
  "data": {
    "responses": 2,
    "responseUrls": ["..."],
    "timestamp": "2024-02-03T23:40:43.635Z",
    "source": "invaluable",
    "section": "A"
  },
  "files": {
    "json": {
      "path": "artists/A.json",
      "url": "..."
    }
  }
}
```

### Search Endpoint

```
GET /api/invaluable
```

Searches for artworks by specified artists with configurable parameters.

Example Response:
```json
{
  "success": true,
  "message": "Search results saved successfully",
  "searchId": "invaluable-artist-2024-02-03T23-40-43",
  "files": {
    "responses": ["..."],
    "metadata": "..."
  },
  "metadata": {
    "source": "invaluable",
    "timestamp": "2024-02-03T23:40:43.635Z",
    "searchParams": {
      "priceResult": { "min": 250 },
      "sort": "auctionDateAsc"
    }
  }
}
```

## Architecture

### Scraper Components

#### Artist Directory Scraper
- Dedicated browser instance
- Independent state management
- Handles Algolia API monitoring
- Manages directory crawling
- Saves API responses

#### Search Scraper
- Separate browser instance
- Cookie-based authentication
- catResults API monitoring
- Multi-artist search processing
- Independent storage operations

### Process Flow

1. Server Initialization
   - Create storage connection
   - Initialize browser instances
   - Set up API endpoints

2. Search Process
   - Process each artist independently
   - Create new tab per artist
   - Monitor API responses
   - Handle protection
   - Save results and metadata

## Error Handling

The system includes robust error handling for:
- Network timeouts (90s default)
- Protection challenges
- API failures
- Storage errors
- Invalid responses
- Rate limiting

Key features:
- Independent error handling per scraper
- Automatic retries
- Debug logging
- State preservation
- Graceful degradation

## Deployment

### Docker

Build the image:
```bash
docker build -t invaluable-scraper .
```

Run locally:
```bash
docker run -p 3000:3000 \
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
│   │   ├── artists.js           # Artist directory endpoint
│   │   └── search.js            # Search endpoint
│   ├── scrapers/
│   │   └── invaluable/
│   │       ├── index.js         # Main scraper class
│   │       ├── browser.js       # Browser management
│   │       ├── auth.js          # Authentication handling
│   │       ├── utils.js         # Shared utilities
│   │       ├── artist-list/     # Artist directory scraper
│   │       │   └── index.js     # Directory implementation
│   │       └── search/          # Search scraper
│   │           ├── index.js     # Search implementation
│   │           └── api-monitor.js # API response capture
│   └── utils/
│       └── storage.js           # GCS integration
├── Dockerfile                    # Container configuration
├── cloudbuild.yaml              # Cloud Build config
└── package.json                 # Dependencies
```

## License

MIT License