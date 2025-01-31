# Invaluable Art Market Scraper

A specialized Node.js web scraper for extracting art auction data from Invaluable.com. Built with Puppeteer, Express, and advanced anti-detection measures.

## Live API

The scraper API is available at:
```
https://scrapper-856401495068.us-central1.run.app
```

## Features

### Invaluable Data Collection
- Real-time auction data extraction
- Price estimates and current bids
- Auction house information
- Lot details
- Cookie consent handling
- Protection bypass mechanisms

### Technical Features
- **Advanced Browser Automation**
  - Puppeteer with Stealth Plugin
  - Human-like behavior simulation
  - Dynamic viewport handling
  - Network condition emulation
  - Protection bypass mechanisms

- **Security & Reliability**
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

## Prerequisites

- Node.js (v18 or higher)
- npm
- Docker (for containerized deployment)
- Google Cloud SDK (for deployment)

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

3. Start the development server:
```bash
npm start
```

## API Endpoints

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

### Specialized Picasso Search
```
GET /api/invaluable/search-picasso
```
Performs a specialized search for Picasso works using authenticated cookies.
Returns a URL to the saved HTML content in Google Cloud Storage.

## Development

Start the development server:
```bash
npm run dev
```

The server will start on port 8080 (or the port specified in your environment).

## Docker Deployment

Build the Docker image:
```bash
docker build -t invaluable-scraper .
docker tag invaluable-scraper gcr.io/$PROJECT_ID/worthpoint-scraper
```

Run the container:
```bash
docker run -p 8080:8080 invaluable-scraper
```

## Google Cloud Run Deployment

Deploy to Cloud Run:
```bash
gcloud builds submit --config cloudbuild.yaml
```

## Project Structure

```
├── src/
│   ├── server.js                 # Express server and API routes
│   ├── scrapers/
│   │   └── invaluable/
│   │       ├── index.js         # Main scraper export
│   │       ├── browser.js       # Browser management
│   │       ├── auth.js          # Authentication handling
│   │       ├── search.js        # Search functionality
│   │       └── utils.js         # Utility functions
│   └── utils/
│       ├── storage.js           # Google Cloud Storage
│       └── drive-logger.js      # HTML logging
├── Dockerfile                    # Docker configuration
├── cloudbuild.yaml              # Cloud Build configuration
└── package.json                 # Project dependencies
```

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
- ✅ Invaluable integration
- ✅ Protection bypass
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

MIT License