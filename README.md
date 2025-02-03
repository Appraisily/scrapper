# Invaluable Art Market Scraper

A specialized Node.js web scraper for extracting fine art auction data from Invaluable.com. Built with Puppeteer, Express, and advanced anti-detection measures.

## Overview

This scraper is designed to capture both HTML content and API responses from Invaluable's art auction listings, with specific focus on:
- Initial page load data
- Protection/challenge page handling
- "Load More" pagination responses
- Raw HTML states at various stages
- Structured API responses

## Features

### Core Functionality
- **HTML Capture**
  - Initial page state
  - Protection/challenge pages
  - Final page state after interactions
  - Automatic state tracking

- **API Response Capture**
  - First page results
  - Pagination/load more responses
  - Raw JSON preservation
  - Response deduplication

- **Protection Handling**
  - Cloudflare challenge bypass
  - Bot detection avoidance
  - Cookie management
  - Session persistence

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
  ├── html/
  │   ├── {searchId}-initial.html
  │   ├── {searchId}-protection.html
  │   └── {searchId}-final.html
  ├── api/
  │   ├── {searchId}-response1.json
  │   └── {searchId}-response2.json
  └── metadata/
      └── {searchId}.json
  ```

#### API Features
- RESTful endpoint
- Query parameter support
- Comprehensive response format
- Error handling

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

Query Parameters:
- `query` (optional): Main search query (default: "fine art")
- `keyword` (optional): Additional keyword filter (default: "fine art")

Example Response:
```json
{
  "success": true,
  "message": "Search results saved successfully",
  "searchId": "invaluable-fine-art-2024-02-02T17-38-07-714Z",
  "files": {
    "html": {
      "initial": "Fine Art/html/invaluable-fine-art-2024-02-02T17-38-07-714Z-initial.html",
      "protection": "Fine Art/html/invaluable-fine-art-2024-02-02T17-38-07-714Z-protection.html",
      "final": "Fine Art/html/invaluable-fine-art-2024-02-02T17-38-07-714Z-final.html"
    },
    "api": [
      "Fine Art/api/invaluable-fine-art-2024-02-02T17-38-07-714Z-response1.json",
      "Fine Art/api/invaluable-fine-art-2024-02-02T17-38-07-714Z-response2.json"
    ]
  },
  "metadata": {
    "source": "invaluable",
    "query": "fine art",
    "keyword": "fine art",
    "timestamp": "2024-02-02T17:38:07.714Z",
    "searchUrl": "https://www.invaluable.com/search?...",
    "searchParams": {
      "upcoming": false,
      "query": "fine art",
      "keyword": "fine art",
      "priceResult": { "min": 250 },
      "dateTimeUTCUnix": { "min": 1577833200 },
      "dateType": "Custom",
      "sort": "auctionDateAsc"
    },
    "status": "pending_processing"
  }
}
```

## Process Flow

The scraper follows these steps (with detailed logging):

1. 🔄 Start search process
2. 🍪 Set authentication cookies
3. 👀 Enable API request interception
4. 🌐 Navigate to search URL
5. 📄 Capture initial HTML
6. 🛡️ Handle protection if needed
   - 🤖 Process challenge
   - ✅ Clear protection
7. ⏳ Wait for first API response
8. 📥 Capture first API response
9. ⌛ Pause before load more
10. 🔍 Handle load more
    - 🖱️ Click button
    - ⏳ Wait for response
    - 📥 Capture second response
11. 📄 Capture final state
12. 📊 Generate status report
13. 💾 Initialize storage
14. 📁 Save all files
15. ✅ Complete process

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
│   ├── scrapers/
│   │   └── invaluable/
│   │       ├── index.js         # Main scraper class
│   │       ├── browser.js       # Browser management
│   │       ├── auth.js          # Authentication handling
│   │       └── search/
│   │           ├── index.js     # Search functionality
│   │           ├── api-monitor.js # API response capture
│   │           └── pagination-handler.js # Load more handling
│   └── utils/
│       └── storage.js           # GCS integration
├── Dockerfile                    # Container configuration
├── cloudbuild.yaml              # Cloud Build config
└── package.json                 # Dependencies
```

## Error Handling

The system handles various error scenarios:
- Network timeouts
- Protection challenges
- API failures
- Storage errors
- Invalid responses
- Rate limiting

## Contributing

1. Fork the repository
2. Create a feature branch
3. Commit your changes
4. Push to the branch
5. Create a Pull Request

## License

MIT License