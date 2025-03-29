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

The application now includes dynamic resource scaling based on available memory:

| Memory Configuration | Concurrent Image Downloads | Browser Restart Frequency |
|---------------------|---------------------------|---------------------------|
| 2GB RAM | 3 (in Cloud Run), 2 (local) | Every ~30 images |
| 4GB RAM | 6 (in Cloud Run), 4 (local) | Every ~60 images |
| 8GB RAM | 10 (in Cloud Run), 6 (local) | Every ~120 images |
| 16GB RAM | 16 (in Cloud Run), 6 (local) | Every ~240 images |

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

## Batch Scraping Scripts

The repository includes several scripts for batch scraping operations:

- `scrape_test_keywords.sh` - Test scrape with specific keywords
- `scrape_all_keywords.sh` - Scrape all keywords from KWs.txt
- `scrape_all_furniture_subcategories.sh` - Scrape all furniture subcategories

Example usage:
```bash
./scrape_test_keywords.sh furniture
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
│   │   ├── search.js            # Main search endpoint
│   │   └── furniture-subcategories.js # Furniture-specific endpoints
│   └── utils/                    # Storage utilities
│       └── search-storage.js     # GCS storage management
├── Dockerfile                    # Container configuration
└── cloudbuild.yaml              # Cloud deployment
```

## Performance Optimization

- **Browser Reuse**: The scraper reuses browser instances to reduce resource consumption
- **Dynamic Concurrency**: Automatically adjusts parallel operations based on available memory
- **Environment-Specific Configuration**: Optimizes settings for Cloud Run vs local environments
- **Memory-Aware Processing**: Scales batch sizes and restart frequency based on resource availability
- **Adaptive Timeout Management**: Uses custom timeout settings for varying network conditions

See [Resource Optimization Guide](docs/resource-optimization.md) for configuration options.

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