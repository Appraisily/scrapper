# Invaluable Art Market Scraper

A specialized Node.js web scraper for extracting fine art auction data from Invaluable.com. Built with Puppeteer, Express, and advanced anti-detection measures.

## Features

### Data Collection
- Real-time auction data extraction
- HTML content storage in Google Cloud Storage
- Structured metadata storage
- Protection bypass mechanisms
- Cookie-based authentication

### Technical Features
- **Advanced Browser Automation**
  - Puppeteer with Stealth Plugin
  - Human-like behavior simulation
  - Dynamic viewport handling
  - Network condition emulation
  - Protection bypass mechanisms

- **Cloud Storage Integration**
  - Organized folder structure for Fine Art data
  - HTML content storage
  - JSON metadata storage
  - Signed URLs for file access
  - Timestamped file organization

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
- Access to Google Cloud Storage bucket

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

The server will start on port 8080 (or the port specified in your environment).

## API Endpoint

### Invaluable Search
```
GET /api/invaluable
```
Query Parameters:
- `query` (optional): Main search query (default: "picasso")
- `keyword` (optional): Additional keyword filter (default: "picasso")

Returns:
```json
{
  "success": true,
  "message": "Search results saved successfully",
  "searchId": "invaluable-picasso-2024-01-15T10-30-00Z",
  "files": {
    "html": "Fine Art/html/invaluable-picasso-2024-01-15T10-30-00Z.html",
    "metadata": "Fine Art/metadata/invaluable-picasso-2024-01-15T10-30-00Z.json"
  },
  "urls": {
    "html": "https://storage.googleapis.com/...",
    "metadata": "https://storage.googleapis.com/..."
  },
  "metadata": {
    "source": "invaluable",
    "query": "picasso",
    "keyword": "picasso",
    "timestamp": "2024-01-15T10:30:00Z",
    "searchUrl": "https://www.invaluable.com/search?...",
    "searchParams": {
      "upcoming": false,
      "query": "picasso",
      "keyword": "picasso"
    },
    "status": "pending_processing"
  }
}
```

## Storage Structure

```
art-market-data/
└── Fine Art/
    ├── html/
    │   └── invaluable-{query}-{timestamp}.html
    └── metadata/
        └── invaluable-{query}-{timestamp}.json
```

## Development

Start the development server:
```bash
npm start
```

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
│       └── storage.js           # Google Cloud Storage integration
├── Dockerfile                    # Docker configuration
├── cloudbuild.yaml              # Cloud Build configuration
└── package.json                 # Project dependencies
```

## Error Handling

The API implements comprehensive error handling:
- Network errors
- Storage errors
- Rate limiting
- Invalid parameters
- Protection challenges
- Scraping failures

## Current Status

The project is actively maintained and includes:
- ✅ Invaluable integration
- ✅ Protection bypass
- ✅ Cloud Storage integration
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