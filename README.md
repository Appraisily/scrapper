# Art Market Data Scraper

A comprehensive Node.js web scraper for extracting fine art sales data from multiple sources including Worthpoint, Christie's, and Invaluable. Built with Puppeteer and Express.

## Features

### Multi-Source Data Collection
- **Worthpoint.com**
  - Browser-based scraping
  - Direct API integration
  - Historical sales data
  - Price trends
  
- **Christie's**
  - Auction results
  - Lot details
  - Sale totals
  - Upcoming auctions
  
- **Invaluable**
  - Real-time auction data
  - Price estimates
  - Auction house information
  - Lot details

### Technical Features
- Headless browser automation with Puppeteer
- Anti-detection measures
- Automatic login handling
- Rate limiting and retry logic
- Error handling and logging
- REST API endpoints
- CORS support
- Docker containerization
- Cloud Run deployment

## Prerequisites

- Node.js (v18 or higher)
- npm
- Docker (for containerized deployment)
- Google Cloud SDK (for deployment)

## Installation

1. Clone the repository:
```bash
git clone [repository-url]
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

## API Endpoints

### Worthpoint Browser Scraping
```
GET /api/art/browser
```
Returns fine art sales data scraped using browser automation.

### Worthpoint API
```
GET /api/art/api
```
Returns fine art sales data fetched directly from Worthpoint's API.

### Christie's Auctions
```
GET /api/christies
```
Query Parameters:
- `month` (optional): Filter by month (1-12)
- `year` (optional): Filter by year
- `page` (optional): Page number (default: 1)
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
- `minPrice` (optional): Minimum price (default: 250)
- `upcoming` (optional): Include upcoming auctions (default: false)
- `query` (optional): Search query
- `keyword` (optional): Additional keywords

## Development

Start the development server:
```bash
npm run dev
```

The server will start on port 3000 (or the port specified in your .env file).

## Docker Deployment

Build the Docker image:
```bash
docker build -t art-market-scraper .
```

Run the container:
```bash
docker run -p 3000:3000 --env-file .env art-market-scraper
```

## Google Cloud Run Deployment

Deploy to Cloud Run:
```bash
gcloud builds submit --config cloudbuild.yaml
```

## Project Structure

```
├── src/
│   ├── server.js           # Express server and API routes
│   ├── scraper.js          # Worthpoint browser scraper
│   ├── api-scraper.js      # Worthpoint API integration
│   ├── christies-scraper.js# Christie's scraper
│   ├── invaluable-scraper.js# Invaluable scraper
│   └── secrets.js          # Secrets management
├── Dockerfile              # Docker configuration
├── cloudbuild.yaml         # Cloud Build configuration
├── package.json            # Project dependencies
└── README.md              # Documentation
```

## Security Notes

- Credentials are managed through Google Cloud Secret Manager
- All requests use HTTPS
- Rate limiting is implemented to prevent abuse
- Anti-bot detection measures are in place
- Sensitive data is not logged

## Error Handling

The API implements comprehensive error handling:
- Network errors
- Authentication failures
- Rate limiting
- Invalid parameters
- Scraping failures

## Current Status

The project is actively maintained and includes:
- ✅ Worthpoint integration (both browser and API)
- ✅ Christie's auction data scraping
- ✅ Invaluable integration
- ✅ Containerized deployment
- ✅ Cloud Run hosting
- ✅ Automated builds

## Contributing

1. Fork the repository
2. Create a feature branch
3. Commit your changes
4. Push to the branch
5. Create a Pull Request

## License

[Add your license here]

## Support

For support, please [create an issue](repository-issues-url) or contact the maintainers.