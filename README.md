# Invaluable Furniture Scraper

A specialized Node.js web scraper for extracting furniture auction data from Invaluable.com. Built with Puppeteer, Express, and advanced anti-detection measures.

## Overview

This scraper is designed to capture both HTML content and API responses from Invaluable's furniture auction listings, with specific focus on:
- Initial page load data
- Protection/challenge page handling
- API response capture
- Raw HTML states at various stages

## Features

### Core Functionality
- **HTML Capture**
  - Initial page state
  - Protection/challenge pages
  - Final page state after interactions
  - Automatic state tracking

- **API Response Capture**
  - Search results data
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
  Furniture/
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
- RESTful endpoint at `/api/invaluable/furniture`
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
cd invaluable-furniture-scraper
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
GET /api/invaluable/furniture
```

Query Parameters:
- `query` (optional): Additional search query
- `keyword` (optional): Additional keyword filter
- `minPrice` (optional): Minimum price filter
- `currency` (optional): Currency code (e.g., USD, EUR)
- `upcoming` (optional): Filter for upcoming auctions only

Example Response:
```json
{
  "success": true,
  "message": "Search results saved successfully",
  "searchId": "invaluable-furniture-2024-02-03T08-45-07-714Z",
  "files": {
    "html": {
      "initial": "Furniture/html/invaluable-furniture-2024-02-03T08-45-07-714Z-initial.html",
      "protection": "Furniture/html/invaluable-furniture-2024-02-03T08-45-07-714Z-protection.html",
      "final": "Furniture/html/invaluable-furniture-2024-02-03T08-45-07-714Z-final.html"
    },
    "api": [
      "Furniture/api/invaluable-furniture-2024-02-03T08-45-07-714Z-response1.json"
    ]
  },
  "metadata": {
    "source": "invaluable",
    "category": "furniture",
    "timestamp": "2024-02-03T08:45:07.714Z",
    "searchParams": {
      "priceResult": { "min": 250 },
      "query": "furniture",
      "keyword": "furniture",
      "supercategoryName": "Furniture"
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
8. 📥 Capture API response
9. 📄 Capture final state
10. 📊 Generate status report
11. 💾 Initialize storage
12. 📁 Save all files
13. ✅ Complete process

## Deployment

### Docker

Build the image:
```bash
docker build -t invaluable-furniture-scraper .
```

Run locally:
```bash
docker run -p 8080:8080 \
  -e GOOGLE_CLOUD_PROJECT=your-project-id \
  -e STORAGE_BUCKET=invaluable-html-archive \
  invaluable-furniture-scraper
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