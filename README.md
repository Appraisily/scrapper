# Invaluable Art Market Scraper

A specialized Node.js web scraper for extracting fine art auction data from Invaluable.com. Built with Puppeteer, Express, and advanced anti-detection measures.

## Overview

This scraper is designed to capture both HTML content and API responses from Invaluable's art auction listings and artist directories, with specific focus on:
- Artist directory crawling
- Search results capture
- Protection/challenge page handling
- API response monitoring
- Raw HTML state preservation

## Features

### Core Functionality
- **Artist Directory Extraction**
  - Alphabetical artist browsing
  - Subindex processing
  - Artist count tracking
  - Comprehensive data collection

- **Search Results Capture**
  - Multiple artist processing
  - Price range filtering
  - Auction date sorting
  - Pagination handling

- **HTML State Tracking**
  - Initial page state
  - Protection/challenge pages
  - Final page state
  - State transition logging

- **API Response Capture**
  - Search result responses
  - Raw JSON preservation
  - Response deduplication
  - Size validation

### Protection Handling
- Cloudflare challenge bypass
- Bot detection avoidance
- Cookie management
- Session persistence
- Automatic retry logic

### Technical Features

#### Browser Automation
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
  ├── artists/
  │   ├── {artistId}-{timestamp}-initial.html
  │   ├── {artistId}-{timestamp}-protection.html
  │   ├── {artistId}-{timestamp}-final.html
  │   ├── {artistId}-{timestamp}-response1.json
  │   └── {artistId}-{timestamp}-metadata.json
  ├── subindexes/
  │   ├── {subindexId}-{timestamp}-initial.html
  │   ├── {subindexId}-{timestamp}-protection.html
  │   └── {subindexId}-{timestamp}-final.html
  └── debug/
      └── timeout-{timestamp}.png
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

### Artist List Endpoint

```
GET /api/invaluable/artists
```

Returns a list of artists from Invaluable's directory, starting with 'A'.

Example Response:
```json
{
  "success": true,
  "artists": [
    {
      "name": "Artist Name",
      "count": 42,
      "url": "https://www.invaluable.com/artist/...",
      "subindex": "Aa"
    }
  ],
  "artistListFound": true,
  "html": {
    "initial": "...",
    "protection": "...",
    "final": "..."
  },
  "timestamp": "2024-02-03T09:15:51.894Z",
  "source": "invaluable",
  "section": "A",
  "subindexes": ["Aa", "Ab", "Ac", ...],
  "totalFound": 150
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
  "results": [
    {
      "artist": "Artist Name",
      "html": {
        "initial": "...",
        "protection": "...",
        "final": "...",
        "searchResultsFound": true
      },
      "apiData": {
        "responses": [...]
      },
      "timestamp": "2024-02-03T09:15:51.894Z"
    }
  ],
  "timestamp": "2024-02-03T09:15:51.894Z"
}
```

## Process Flow

The scraper follows these steps:

1. 🔄 Initialize browser and storage
2. 🌐 Process each request:
   - Artist List:
     1. Navigate to artist directory
     2. Handle protection if needed
     3. Extract subindexes
     4. Process each subindex
     5. Save HTML states and results
   - Search:
     1. Process each artist
     2. Monitor API responses
     3. Handle protection
     4. Save results and metadata

## Error Handling

The system includes robust error handling for:
- Network timeouts (45s default)
- Protection challenges
- API failures
- Storage errors
- Invalid responses
- Rate limiting

Key features:
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
│   │       └── search/
│   │           ├── index.js     # Search manager
│   │           ├── artist-processor.js    # Artist search
│   │           ├── artist-list-extractor.js # Directory crawling
│   │           ├── api-monitor.js # API response capture
│   │           └── result-saver.js # Storage handling
│   └── utils/
│       └── storage.js           # GCS integration
├── Dockerfile                    # Container configuration
├── cloudbuild.yaml              # Cloud Build config
└── package.json                 # Dependencies
```

## License

MIT License