# Invaluable Advanced Scraper

A powerful Node.js application for scraping auction data from Invaluable with resumable pagination, browser automation, and cloud storage integration. Built with Puppeteer and Express, this tool handles all the complexities of cookie management, request interception, and protection challenges.

## Key Features

- **Advanced Browser Automation**
  - Puppeteer with stealth plugins
  - Cookie and session management
  - Request/response interception
  - Protection challenge handling

- **Intelligent Pagination**
  - Auto-resumable data collection
  - Progress tracking and checkpoints
  - Metadata-driven page detection
  - Skips already processed pages

- **Google Cloud Integration**
  - Automatic storage in GCS buckets
  - Structured data organization
  - Batched storage for efficiency

- **RESTful API Interface**
  - Dynamic parameter support
  - Search endpoint with comprehensive options
  - Category-specific scraping endpoints
  - Direct API data submission endpoint

## API Endpoints

### Main Search
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

## Deployment

Deploy to Google Cloud Run:
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
│   ├── scrapers/invaluable/      # Core scraping logic
│   │   ├── browser.js           # Browser automation
│   │   ├── pagination/          # Pagination handling
│   │   └── utils.js             # Utility functions
│   ├── routes/                   # API endpoints
│   └── utils/                    # Storage utilities
├── Dockerfile                    # Container configuration
└── cloudbuild.yaml              # Cloud deployment
```

## License

MIT License