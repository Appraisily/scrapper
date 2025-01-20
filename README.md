# Art Market Data Scraper

A comprehensive Node.js web scraper for extracting fine art sales data from multiple sources including Worthpoint, Christie's, and Invaluable. Built with Puppeteer, Express, and advanced anti-detection measures.

## Features

### Multi-Source Data Collection
- **Worthpoint.com**
  - Browser-based scraping with anti-detection
  - Direct API integration with CSRF handling
  - Historical sales data
  - Price trends
  - Automated login with protection bypass
  
- **Christie's**
  - Auction results
  - Lot details
  - Sale totals
  - Upcoming auctions
  - Dynamic content handling
  
- **Invaluable**
  - Real-time auction data
  - Price estimates
  - Auction house information
  - Lot details
  - Cookie consent handling
  - Automated login

### Technical Features
- **Advanced Browser Automation**
  - Puppeteer with Stealth Plugin
  - Human-like behavior simulation
  - Dynamic viewport handling
  - Network condition emulation
  - Protection bypass mechanisms

- **Security & Reliability**
  - CSRF token handling
  - Cookie management
  - Rate limiting and retry logic
  - Comprehensive error handling
  - Detailed logging

- **API Features**
  - RESTful endpoints
  - CORS support
  - Query parameter handling
  - Response formatting

- **Deployment**
  - Docker containerization
  - Google Cloud Run deployment
  - Environment variable management
  - Secret management

## Prerequisites

- Node.js (v18 or higher)
- npm
- Docker (for containerized deployment)
- Google Cloud SDK (for deployment)

## Installation

1. Clone the repository:
```bash
git clone <repository-url>
cd art-market-scraper
```

2. Install dependencies:
```bash
npm install
```

3. Create a `.env` file in the root directory with your credentials:
```
WORTHPOINT_USERNAME=your_username
WORTHPOINT_PASSWORD=your_password
PORT=3000
NODE_ENV=development
GOOGLE_CLOUD_PROJECT=your-project-id
```

4. Set up Google Cloud Secret Manager:
- Create secrets for `worthpoint-username` and `worthpoint-password`
- Ensure the service account has access to these secrets
- The application will automatically fetch credentials from Secret Manager

## API Endpoints

### Worthpoint Browser Scraping
```
GET /api/art/browser
```
Query Parameters:
- `max` (optional): Maximum results to return (default: 100)
- `sort` (optional): Sort order (default: SaleDate)
- `rMin` (optional): Minimum price (default: 200)

Returns fine art sales data scraped using browser automation.

### Worthpoint API
```
GET /api/art/api
```
Query Parameters:
- Same as browser endpoint
- Additional support for price distribution analysis

Returns fine art sales data fetched directly from Worthpoint's API.
Returns fine art sales data fetched directly from Worthpoint's API.

### Christie's Auctions
```
GET /api/christies
```
Query Parameters:
- `month` (optional): Filter by month (1-12)
- `year` (optional): Filter by year (e.g., 2024)
- `page` (optional): Page number for pagination (default: 1)
- `pageSize` (optional): Results per page (default: 60)

### Christie's Lot Details
```
GET /api/christies/lot/:lotId
```
Returns detailed information about a specific auction lot.


### Invaluable Search
```
GET /api/invaluable
```
Query Parameters:
- `currency` (optional): Currency code (default: USD)
- `minPrice` (optional): Minimum price filter (default: 250)
- `upcoming` (optional): Include upcoming auctions (default: false)
- `query` (optional): Main search query
- `keyword` (optional): Additional keyword filters
Returns auction data from Invaluable with detailed lot information.

## Development

Start the development server:
```bash
npm run dev
```
The server includes hot reloading for development.

The server will start on port 3000 (or the port specified in your .env file).

## Docker Deployment

Build the Docker image:
```bash
docker build -t art-market-scraper .
docker tag art-market-scraper gcr.io/$PROJECT_ID/worthpoint-scraper
```

Run the container:
```bash
docker run -p 3000:3000 --env-file .env art-market-scraper
```
The container includes all necessary Chrome dependencies.

## Google Cloud Run Deployment

Deploy to Cloud Run:
```bash
gcloud builds submit --config cloudbuild.yaml
```

The deployment includes automatic environment variable configuration
and secret management.

## Project Structure

```
├── src/
│   ├── server.js           # Express server and API routes
│   ├── scraper.js          # Worthpoint browser scraper
│   ├── api-scraper.js      # Worthpoint API client
│   ├── christies-scraper.js# Christie's scraper
│   ├── invaluable-scraper.js# Invaluable scraper
│   └── secrets.js          # Secrets management
├── Dockerfile              # Docker configuration
├── .dockerignore          # Docker ignore rules
├── .env                   # Environment variables
├── cloudbuild.yaml         # Cloud Build configuration
├── package.json            # Project dependencies
└── README.md              # Documentation
```

## Security Notes

- Credentials are managed through Google Cloud Secret Manager
- All external requests use HTTPS
- Comprehensive rate limiting
- Advanced anti-bot detection measures
- Protection bypass mechanisms
- Secure cookie handling
- No sensitive data logging

## Error Handling

The API implements comprehensive error handling:
- Network errors
- Authentication failures
- Rate limiting
- Invalid parameters
- CAPTCHA detection
- Protection challenges
- Scraping failures

## Current Status

The project is actively maintained and includes:
- ✅ Worthpoint integration (both browser and API)
- ✅ Christie's auction data scraping
- ✅ Invaluable integration
- ✅ Containerized deployment
- ✅ Cloud Run hosting
- ✅ Protection bypass
- ✅ Automated builds

## Contributing

1. Fork the repository
2. Create a feature branch
3. Commit your changes
4. Push to the branch
5. Create a Pull Request

## License

MIT License

## Support
