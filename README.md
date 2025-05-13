# Invaluable Advanced Scraper

A powerful Node.js application for scraping auction data from Invaluable with resumable pagination, browser automation, and cloud storage integration. Built with Puppeteer and Express, this tool handles all the complexities of cookie management, request interception, and protection challenges.

## Key Features

- **Advanced Browser Automation**
  - Puppeteer with stealth plugins for bypassing anti-bot protections
  - Sophisticated cookie and session management
  - Request/response interception for capturing API data
  - Automatic protection challenge handling
  - Keyword-based browser instances for efficient resource isolation

- **Intelligent Pagination**
  - Auto-resumable data collection with automatic restart on blank pages
  - Self-recovery when encountering empty result pages
  - Progress tracking and detailed logging
  - Metadata-driven page detection and navigation
  - Skip already processed pages for faster re-runs
  - Automatic rate limiting to avoid detection

- **Comprehensive Image Downloading**
  - Browser-based image downloading that bypasses Cloudflare protection
  - Tab pooling system for efficient tab reuse
  - Automatic image saving to Google Cloud Storage
  - Structured storage paths for easy retrieval
  - Optimized batching to prevent timeouts
  - Fallback mechanisms when primary download fails

- **Google Cloud Integration**
  - Seamless storage in GCS buckets with customizable paths
  - Structured data organization by category and subcategory
  - Efficient batched storage for optimal performance
  - Automatic metadata inclusion for better searchability
  - Support for custom bucket configuration

- **RESTful API Interface**
  - Dynamic parameter support for flexible queries
  - Comprehensive search endpoint with extensive options
  - Category-specific scraping endpoints
  - Direct API data submission endpoint
  - Batch processing of multiple requests

- **Artist List Scraper**
  - Comprehensive collection of artist data
  - Alphabetical navigation through nested sub-letter pages
  - Extraction of artist names and URLs
  - Multiple output formats (JSON, TXT)
  - Progress tracking and resumable operation

## Project Structure

```
├── src/                           # Main source code
│   ├── server.js                  # Express server setup
│   ├── scrapers/                  # Scraper implementations
│   │   ├── artist-directory-scraper.js  # Artist directory scraper
│   │   └── invaluable/            # Invaluable-specific code
│   │       ├── scraper.js         # Core scraper implementation
│   │       ├── browser.js         # Browser management 
│   │       ├── url-builder.js     # URL construction utilities
│   │       ├── utils.js           # Helper functions
│   │       ├── index.js           # Export module
│   │       ├── search-handler.js  # Search results processing
│   │       ├── auth.js            # Authentication handling
│   │       ├── artist-list/       # Artist list scraper
│   │       └── pagination/        # Pagination handling
│   │           ├── index.js       # Main pagination logic
│   │           ├── pagination-manager.js # Manages pagination state
│   │           ├── navigation-params.js  # Handling navigation parameters
│   │           ├── request-interceptor.js # Intercepts and modifies requests
│   │           ├── cookie-manager.js     # Manages cookies for requests
│   │           └── results-processor.js  # Processes pagination results
│   ├── routes/                    # API endpoints
│   │   ├── search.js              # Search endpoint handlers
│   │   ├── scraper.js             # Scraper job management
│   │   └── general-scraper.js     # General scraping endpoints
│   ├── examples/                  # Example implementations
│   └── utils/                     # Utility functions
│       ├── search-storage.js      # Google Cloud Storage integration
│       └── storage-manager.js     # Storage management utilities
├── scripts/                       # Shell scripts for operations
├── debug_json/                    # JSON debug output directory
├── artist_directory/              # Artist data storage
├── node_modules/                  # Dependencies
├── public/                        # Static files
├── .dockerignore                  # Docker ignore rules
├── .gitignore                     # Git ignore rules
├── artists.json                   # Artist data file
├── artists.txt                    # Artist list
├── browser-interceptor.js         # Browser interception script
├── client-interceptor.html        # Client-side interceptor
├── clean_KWs.txt                  # Cleaned keywords list
├── cloudbuild.yaml                # Google Cloud build config
├── CODE_REVIEW_REPORT.md          # Code review documentation
├── Dockerfile                     # Docker container definition
├── KWs.txt                        # Keywords list
├── KWs_back.txt                   # Backup keywords
├── package-lock.json              # Dependency lock file
├── package.json                   # Project definition and dependencies
├── parse-artists.js               # Artist data parser
├── README.md                      # Project documentation
└── Various shell scripts (.sh, .ps1)  # Automation scripts
```

## Classes & Components

### Core Components

1. **InvaluableScraper** (src/scrapers/invaluable/index.js, scraper.js)
   - Main scraper class that orchestrates the entire scraping process
   - Maintains keyword-specific browser instances
   - Implements automatic restart logic for blank pages
   - Methods:
     - `initialize()`: Sets up the browser instance and configurations
     - `close()`: Closes browser instances and resources
     - `search(params)`: Performs a search with given parameters
     - `searchAllPages(params, cookies, maxPages)`: Fetches all pages with auto-restart

2. **BrowserManager** (src/scrapers/invaluable/browser.js)
   - Handles browser automation with Puppeteer
   - Implements keyword-based instance pool pattern
   - Methods:
     - `getInstance(keyword)`: Returns a browser instance for the specific keyword
     - `initialize()`: Starts a browser instance with stealth plugins
     - `getPage()`: Returns an active page or creates a new one
     - `createTab(name)`: Creates a new tab with specified name
     - `closeTab(name)`: Safely closes a named tab
     - `close()`: Shuts down the browser instance
     - `handleProtection()`: Handles anti-bot security measures

3. **SearchStorageService** (src/utils/search-storage.js)
   - Manages Google Cloud Storage operations
   - Implements keyword-based instance pooling
   - Implements tab pooling for efficient image downloading
   - Methods:
     - `getInstance(options)`: Returns storage instance for specific keyword
     - `saveImage(imageUrl, category, lotNumber)`: Downloads and saves images
     - `savePageResults(category, pageNumber, rawResults)`: Saves page results
     - `saveAllImages(searchResults, category)`: Processes and saves all images
     - `closeBrowser()`: Cleans up browser resources

4. **PaginationHandler** (src/scrapers/invaluable/pagination/index.js)
   - Handles pagination and empty page detection
   - Implements restart signaling when blank pages are detected
   - Methods:
     - `handlePagination()`: Manages the pagination process
     - Returns restart signal with info when blank page is detected

### API Endpoints (src/routes/)

1. **Search Endpoints** (search.js)
   - `GET /api/search`: Main search endpoint with multiple parameters
   - Creates keyword-specific scrapers for each request

2. **Scraper Job Management** (scraper.js)
   - `POST /api/scraper/start`: Start a background scraping job
   - `GET /api/scraper/status/:jobId`: Check job status

3. **General Scraper Endpoints** (general-scraper.js)
   - `GET /api/invaluable/scrape`: General scraping endpoint
   - `GET /api/invaluable/scrape-artist`: Artist-specific scraping

## Latest Enhancements

### Keyword-Based Resource Management

The system now implements an advanced keyword-based resource management approach:

1. **Isolated Browser Instances**
   - Each keyword gets its own isolated browser instance
   - Prevents resource contention between different keyword searches
   - Ensures proper separation of cookies and sessions

2. **Tab Pooling for Image Downloads**
   - Reuses a pool of browser tabs for image downloads
   - Limits the maximum number of tabs per instance (default: 5)
   - Properly resets tabs between uses
   - Significantly reduces system resource usage

3. **Automatic Restart on Blank Pages**
   - Detects when a page returns no new results
   - Automatically restarts the browser session
   - Continues pagination from the problematic page
   - Preserves previously collected results

4. **Self-Healing Pagination**
   - When a blank page is encountered, the system will:
     - Signal the need for a restart with the specific page number
     - Close and reinitialize the browser to clear any session issues
     - Restart from the problematic page
     - Merge new results with previously collected data
     - Continue pagination from that point

### Resource Optimization

The application includes dynamic resource scaling based on available memory:

| Memory Configuration | Image Tab Pool Size | Browser Restart Frequency |
|---------------------|---------------------|---------------------------|
| 2GB RAM | 3 tabs | Every ~30 images |
| 4GB RAM | 5 tabs | Every ~60 images |
| 8GB RAM | 8 tabs | Every ~120 images |
| 16GB RAM | 12 tabs | Every ~240 images |

## Environment Variables & Configuration

The application uses the following environment variables:

| Variable | Description | Default |
|----------|-------------|---------|
| `PORT` | Server port | 8080 |
| `GOOGLE_CLOUD_PROJECT` | GCP project ID | (required for GCS) |
| `STORAGE_BUCKET` | Default GCS bucket for storage | invaluable-html-archive-images |
| `MAX_MEMORY_GB` | Maximum memory allocation | Auto-detected |
| `IMAGE_CONCURRENCY` | Number of simultaneous downloads | Based on memory |
| `MAX_IMAGE_TABS` | Maximum tabs in the pool per keyword | 5 |
| `ENVIRONMENT` | Deployment environment (cloud/local) | Detected |

## Dependencies

```json
{
  "dependencies": {
    "@google-cloud/storage": "^6.10.1",
    "axios": "^1.6.7",
    "cors": "^2.8.5",
    "express": "^4.18.2",
    "puppeteer": "^22.15.0",
    "puppeteer-extra": "^3.3.6",
    "puppeteer-extra-plugin-stealth": "^2.11.2"
  }
}
```

## API Endpoints

### Main Search
```
GET /api/search
```
Supports comprehensive search parameters including query, price ranges, and categories.

#### Pagination Control
- `fetchAllPages=true` - Fetch all available pages of results
- `maxPages=N` - Limit the number of pages to fetch

#### Image Storage
Enable automatic image downloading with the following parameters:
- `saveToGcs=true` - Save results to Google Cloud Storage
- `saveImages=true` - Download and save item images to GCS
- `bucket` - Optional custom GCS bucket name

Images are saved in a structured format:
```
invaluable-data/{category}/{subcategory}/images/{lotNumber}_{filename}.jpg
```

### General Scraper
```
GET /api/invaluable/scrape
```
Provides a general-purpose scraping endpoint for any category or keyword.

Parameters:
- `keyword` - The main category or folder name
- `query` - The specific search term or subfolder name
- `maxPages` - Maximum pages to process
- `fetchAllPages=true` - Fetch all available pages

### Artist Scraper
```
GET /api/invaluable/scrape-artist
```
Specialized endpoint for scraping artist auction results.

Parameters:
- `artist` - The artist name to scrape
- `maxPages` - Maximum pages to process
- `fetchAllPages=true` - Fetch all available pages

## Usage Examples

```bash
# Basic search
curl "http://localhost:8080/api/search?query=furniture"

# Search with price range
curl "http://localhost:8080/api/search?query=furniture&priceResult%5Bmin%5D=1750&priceResult%5Bmax%5D=3250"

# Search with image saving
curl "http://localhost:8080/api/search?query=furniture&saveToGcs=true&saveImages=true"

# Search with custom storage bucket
curl "http://localhost:8080/api/search?query=furniture&saveToGcs=true&saveImages=true&bucket=custom-bucket-name"

# Scrape category with auto-restart on blank pages
curl "http://localhost:8080/api/invaluable/scrape?keyword=furniture&query=chairs&fetchAllPages=true"

# Scrape artist with auto-pagination
curl "http://localhost:8080/api/invaluable/scrape-artist?artist=picasso&fetchAllPages=true"
```

## Processing Keywords with Script

The `process_all_KWs.sh` script provides a powerful way to process multiple keywords in sequence:

```bash
# Process all keywords in KWs.txt
./process_all_KWs.sh

# Force reprocessing of all keywords, even if already processed
./process_all_KWs.sh -f
```

The script features:
- Automatic retry with restart logic when blank pages are encountered
- Tracking of processed keywords to avoid reprocessing
- Configurable maximum restart attempts
- Detailed logging of progress

## Installation

1. Clone the repository
2. Install dependencies:
   ```bash
   npm install
   ```
3. Configure environment variables:
   ```
   GOOGLE_CLOUD_PROJECT=your-project-id
   STORAGE_BUCKET=invaluable-html-archive-images
   ```
4. Start the server:
   ```bash
   npm start
   ```

## Docker Deployment

### Build and Run Locally
```bash
docker build -t invaluable-scraper .
docker run -p 8080:8080 -e GOOGLE_CLOUD_PROJECT=your-project-id invaluable-scraper
```

### Google Cloud Run Deployment
The repository includes a `cloudbuild.yaml` file for automatic deployment to Google Cloud Run:

```bash
gcloud builds submit --config cloudbuild.yaml
```

**Note**: Since this app is deployed through GitHub to Cloud Run, environment variables and secrets are configured as runtime variables in the Cloud Run service, not through .env files.

## License

MIT License