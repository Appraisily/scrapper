# Worthpoint Art Scraper

A Node.js web scraper for extracting fine art sales data from Worthpoint.com using Puppeteer.

## Features

- Automated login to Worthpoint.com
- Scrapes fine art sales data including:
  - Title
  - Sale price
  - Sale date
  - Source (e.g., eBay)
  - Image URL
- Configurable search parameters
- Headless browser automation
- Error handling and retry logic

## Prerequisites

- Node.js (v14 or higher)
- npm
- A Worthpoint.com account

## Installation

1. Clone the repository:
```bash
git clone [repository-url]
cd worthpoint-scraper
```

2. Install dependencies:
```bash
npm install
```

3. Create a `.env` file in the root directory with your Worthpoint credentials:
```
WORTHPOINT_USERNAME=your_username
WORTHPOINT_PASSWORD=your_password
```

## Usage

Run the scraper:
```bash
npm start
```

The scraper will:
1. Log in to Worthpoint using provided credentials
2. Navigate to the fine art search results
3. Extract data from the search results
4. Output the data to the console

## Project Structure

```
├── src/
│   ├── index.js        # Main application entry point
│   └── scraper.js      # Scraper class implementation
├── .env                # Environment variables
├── package.json        # Project dependencies and scripts
└── README.md          # Project documentation
```

## Configuration

The search URL can be modified in `src/index.js` to change:
- Maximum results (`max=100`)
- Sort order (`sort=SaleDate`)
- Category (`categories=fine-art`)
- Minimum price (`rMin=200`)
- Date range (`saleDate=ALL_TIME`)

## Dependencies

- `puppeteer`: Web scraping and browser automation
- `dotenv`: Environment variable management

## Security Notes

- Never commit your `.env` file
- Store credentials securely
- Use environment variables for sensitive data

## License

[Add your license here]

## Contributing

[Add contribution guidelines if applicable]