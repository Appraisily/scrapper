# Invaluable Advanced Scraper

A powerful Node.js application for scraping auction data from Invaluable with resumable pagination, browser automation, and cloud storage integration. Built with Puppeteer and Express, this tool handles all the complexities of cookie management, request interception, and protection challenges.

## Key Features

<<<<<<< HEAD
- **Advanced Browser Automation**
  - Puppeteer with stealth plugins
  - Cookie and session management
  - Request/response interception
  - Protection challenge handling
=======
This scraper is designed to capture both HTML content and API responses from Invaluable's art auction listings and artist directories, with specific focus on:
- Algolia API response monitoring and capture
- Cookie-based authentication
- Protection/challenge page handling
- Raw HTML state preservation
>>>>>>> 7d10b81a51bd91e28b43a094b6fd21593243d044

- **Intelligent Pagination**
  - Auto-resumable data collection
  - Progress tracking and checkpoints
  - Metadata-driven page detection
  - Skips already processed pages

- **Google Cloud Integration**
  - Automatic storage in GCS buckets
  - Structured data organization
  - Batched storage for efficiency

<<<<<<< HEAD
- **RESTful API Interface**
  - Dynamic parameter support
  - Search endpoint with comprehensive options
  - Category-specific scraping endpoints
  - Direct API data submission endpoint
=======
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
>>>>>>> 7d10b81a51bd91e28b43a094b6fd21593243d044

## API Endpoints

<<<<<<< HEAD
### Main Search
=======
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
>>>>>>> 7d10b81a51bd91e28b43a094b6fd21593243d044
```
GET /api/search
```
Supports comprehensive search parameters including query, price ranges, and categories.

### Furniture Subcategories
```
GET /api/furniture/list
GET /api/furniture/info/:subcategory
GET /api/furniture/scrape/:subcategory
```
Special endpoints for retrieving furniture subcategories data.

### Scraper Management
```
POST /api/scraper/start
GET /api/scraper/status/:jobId
```
Control endpoints for starting and monitoring scraping jobs.

## Installation

1. Clone the repository
2. Install dependencies:
   ```bash
   npm install
   ```
3. Configure environment variables:
   ```
   GOOGLE_CLOUD_PROJECT=your-project-id
   STORAGE_BUCKET=invaluable-html-archive
   ```
4. Start the server:
   ```bash
   npm start
   ```

## Docker Support

Build and run with Docker:
```bash
docker build -t invaluable-scraper .
docker run -p 8080:8080 -e GOOGLE_CLOUD_PROJECT=your-project-id invaluable-scraper
```

<<<<<<< HEAD
## Deployment

Deploy to Google Cloud Run:
=======
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
>>>>>>> 7d10b81a51bd91e28b43a094b6fd21593243d044
```bash
gcloud builds submit --config cloudbuild.yaml
```

## Usage Examples

```bash
# Basic search
curl "http://localhost:8080/api/search?query=furniture"

# Search with price range
curl "http://localhost:8080/api/search?query=furniture&priceResult%5Bmin%5D=1750&priceResult%5Bmax%5D=3250"

# Furniture subcategory with auto-pagination
curl "http://localhost:8080/api/furniture/scrape/Chairs?fetchAllPages=true"

# Start a background scraping job
curl -X POST "http://localhost:8080/api/scraper/start" \
     -H "Content-Type: application/json" \
     -d '{"category":"furniture", "maxPages":10, "saveToGcs":true}'
```

## Project Structure

```
├── src/
│   ├── server.js                 # Express server setup
<<<<<<< HEAD
│   ├── scrapers/invaluable/      # Core scraping logic
│   │   ├── browser.js           # Browser automation
│   │   ├── pagination/          # Pagination handling
│   │   └── utils.js             # Utility functions
│   ├── routes/                   # API endpoints
│   └── utils/                    # Storage utilities
=======
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
>>>>>>> 7d10b81a51bd91e28b43a094b6fd21593243d044
├── Dockerfile                    # Container configuration
└── cloudbuild.yaml              # Cloud deployment
```

## License

MIT License