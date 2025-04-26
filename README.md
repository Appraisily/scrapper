# Invaluable Advanced Scraper

A powerful Node.js application for scraping auction data from Invaluable with resumable pagination, browser automation, and cloud storage integration. Built with Puppeteer and Express, this tool handles all the complexities of cookie management, request interception, and protection challenges.

## Key Features

- **Advanced Browser Automation**
  - Puppeteer with stealth plugins for bypassing anti-bot protections
  - Sophisticated cookie and session management
  - Request/response interception for capturing API data
  - Automatic protection challenge handling
  - Browser instance reuse for efficient resource utilization

- **Intelligent Pagination**
  - Auto-resumable data collection with checkpoints
  - Progress tracking and detailed logging
  - Metadata-driven page detection and navigation
  - Skip already processed pages for faster re-runs
  - Automatic rate limiting to avoid detection

- **Comprehensive Image Downloading**
  - Browser-based image downloading that bypasses Cloudflare protection
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
  - Comprehensive collection of artist data from A to C
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
│   ├── routes/                    # API endpoints
│   │   ├── search.js              # Search endpoint handlers
│   │   ├── scraper.js             # Scraper job management
│   │   └── general-scraper.js     # General scraping endpoints
│   ├── examples/                  # Example implementations
│   └── utils/                     # Utility functions
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
   - Methods:
     - `initialize()`: Sets up the browser instance and configurations
     - `close()`: Closes browser instances and resources
     - `search(params)`: Performs a search with given parameters
     - `getDetails(url)`: Fetches details for a specific auction item
     - `downloadImage(imageUrl, savePath)`: Downloads and stores images

2. **BrowserManager** (src/scrapers/invaluable/browser.js)
   - Handles browser automation with Puppeteer
   - Methods:
     - `launch()`: Starts a browser instance with stealth plugins
     - `getPage()`: Returns an active page or creates a new one
     - `closePage(page)`: Safely closes a page
     - `interceptRequest(page, pattern, handler)`: Sets up request interception
     - `rotateUserAgent()`: Changes user agent for detection avoidance
     - `handleProtectionChallenge(page)`: Handles anti-bot security measures
     - `restartBrowser()`: Restarts browser to free resources

3. **UrlBuilder** (src/scrapers/invaluable/url-builder.js)
   - Constructs search and filter URLs
   - Methods:
     - `buildSearchUrl(params)`: Creates search URLs with filters
     - `buildItemUrl(lotId)`: Generates item detail URLs
     - `parsePagination(html)`: Extracts pagination data

4. **SearchHandler** (src/scrapers/invaluable/search-handler.js)
   - Processes search results and extracting data
   - Methods:
     - `processSearchResults(html)`: Extracts item data from search results
     - `processItemDetail(html)`: Parses item detail pages
     - `extractImageUrls(html)`: Gets image URLs from HTML
     - `saveToStorage(data, bucket, path)`: Saves data to Google Cloud Storage

5. **PaginationManager** (src/scrapers/invaluable/pagination/)
   - Handles pagination logic and progress tracking
   - Methods:
     - `getCurrentPage(html)`: Gets current page number
     - `getTotalPages(html)`: Gets total available pages
     - `getNextPageUrl(html)`: Gets URL for next page
     - `trackProgress(currentPage, totalPages)`: Records progress

6. **AuthManager** (src/scrapers/invaluable/auth.js)
   - Manages cookies, sessions, and authentication
   - Methods:
     - `login(page)`: Performs login if needed
     - `refreshCookies(page)`: Updates authentication cookies
     - `checkAuthStatus(page)`: Verifies authentication status

7. **ArtistDirectoryScraper** (src/scrapers/artist-directory-scraper.js)
   - Specialized scraper for artist directory
   - Methods:
     - `scrapeAll()`: Scrapes all artists
     - `scrapePrimaryLetter(letter)`: Scrapes a specific letter section
     - `scrapeLetterCombination(primary, secondary)`: Scrapes combination pages
     - `parseArtistList(html)`: Extracts artist information

### API Endpoints (src/routes/)

1. **Search Endpoints** (search.js)
   - `GET /api/search`: Main search endpoint with multiple parameters
   - `GET /api/search/item/:lotId`: Get details for specific item

2. **Scraper Job Management** (scraper.js)
   - `POST /api/scraper/start`: Start a background scraping job
   - `GET /api/scraper/status/:jobId`: Check job status

3. **General Scraper Endpoints** (general-scraper.js)
   - `GET /api/invaluable/category/:category`: Category-specific scraping
   - `GET /api/invaluable/furniture/list`: List furniture subcategories

## Environment Variables & Configuration

The application uses the following environment variables:

| Variable | Description | Default |
|----------|-------------|---------|
| `PORT` | Server port | 8080 |
| `GOOGLE_CLOUD_PROJECT` | GCP project ID | (required for GCS) |
| `STORAGE_BUCKET` | Default GCS bucket for storage | invaluable-html-archive |
| `MAX_MEMORY_GB` | Maximum memory allocation | Auto-detected |
| `IMAGE_CONCURRENCY` | Number of simultaneous downloads | Based on memory |
| `ENVIRONMENT` | Deployment environment (cloud/local) | Detected |
| `HEADLESS` | Run browser in headless mode | true |
| `DEBUG` | Enable debug logging | false |
| `REQUEST_TIMEOUT` | Request timeout in milliseconds | 30000 |
| `PAGE_LOAD_TIMEOUT` | Page load timeout in milliseconds | 60000 |
| `NAVIGATION_TIMEOUT` | Navigation timeout in milliseconds | 90000 |

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
    "puppeteer-extra-plugin-stealth": "^2.11.2",
    "uuid": "^9.0.0"
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
- `bucket` - Optional custom GCS bucket name (defaults to environment variable STORAGE_BUCKET)

Images are saved in a structured format:
```
invaluable-data/{category}/{subcategory}/images/{lotNumber}_{filename}.jpg
```

The image download feature uses browser-based downloading to bypass Cloudflare protection:
- Reuses the existing browser session that already passed Cloudflare checks
- Maintains cookies and authentication state during image downloads
- Processes images in optimized batches to balance speed and resource usage
- Uses increased timeout settings to handle large images
- Implements page reuse strategies to minimize browser resource consumption

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

## Resource Requirements

- **Minimum**: 2 CPUs, 2GB RAM
- **Recommended**: 4+ CPUs, 4-8GB RAM for handling image downloads and pagination
- **High Performance**: 8+ CPUs, 16GB RAM for large-scale concurrent image processing
- **Storage**: Depends on data volume, but plan for at least 10GB initially

The application includes dynamic resource scaling based on available memory:

| Memory Configuration | Concurrent Image Downloads | Browser Restart Frequency |
|---------------------|---------------------------|---------------------------|
| 2GB RAM | 3 (in Cloud Run), 2 (local) | Every ~30 images |
| 4GB RAM | 6 (in Cloud Run), 4 (local) | Every ~60 images |
| 8GB RAM | 10 (in Cloud Run), 6 (local) | Every ~120 images |
| 16GB RAM | 16 (in Cloud Run), 6 (local) | Every ~240 images |

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

## Shell Scripts

The repository includes multiple shell scripts for various tasks:

1. **Artist Scraping Scripts**:
   - `scrape_artists.sh` / `scrape_artists.ps1`: Scrape artist directory
   - `parse-artists.js`: Process artist data

2. **Keyword Processing Scripts**:
   - `process_all_KWs.sh`: Process all keywords
   - `clean_launch_kws.sh`: Clean and launch keyword scraping
   - `fix_json_kws.sh`: Fix JSON keyword files

3. **Execution Scripts**:
   - `run_with_delay.sh`: Run scraper with delay
   - `run_timed_kws.sh`: Run with time constraints
   - `run_parallel_kws.sh`: Run in parallel
   - `run_with_memory.sh`: Run with memory management

4. **Category-Specific Scripts**:
   - `scrape_all_asian_art_queries.ps1`
   - `scrape_all_collectibles_queries.ps1`
   - `scrape_all_firearms_queries.ps1`
   - `scrape_all_furniture_queries.ps1`

5. **Utility Scripts**:
   - `start_local_server.sh`: Start local server
   - `setup_image_bucket.sh`: Set up GCS bucket
   - `analyze_bucket.py`: Analyze GCS bucket contents

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

# Furniture subcategory with auto-pagination
curl "http://localhost:8080/api/furniture/scrape/Chairs?fetchAllPages=true"

# Start a background scraping job
curl -X POST "http://localhost:8080/api/scraper/start" \
     -H "Content-Type: application/json" \
     -d '{"category":"furniture", "maxPages":10, "saveToGcs":true, "saveImages":true}'
```

## Performance Optimization

- **Browser Reuse**: The scraper reuses browser instances to reduce resource consumption
- **Dynamic Concurrency**: Automatically adjusts parallel operations based on available memory
- **Environment-Specific Configuration**: Optimizes settings for Cloud Run vs local environments
- **Memory-Aware Processing**: Scales batch sizes and restart frequency based on resource availability
- **Adaptive Timeout Management**: Uses custom timeout settings for varying network conditions

### Environment Configuration Options

Configure the scraper's resource usage with environment variables:

```bash
# Set maximum memory available to the application (in GB)
MAX_MEMORY_GB=8

# Set explicit concurrency for image downloads (overrides automatic calculation)
IMAGE_CONCURRENCY=10

# Set environment type (cloud or local) to adjust optimization strategies
ENVIRONMENT=cloud
```

These can also be passed as URL parameters to the API endpoints:

```bash
curl "http://localhost:8080/api/search?query=furniture&saveImages=true&maxMemoryGB=8&imageConcurrency=10"
```

## License

MIT License