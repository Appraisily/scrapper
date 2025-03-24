# Furniture Subcategory Scraping Guide

This guide explains how to use the furniture subcategory feature to scrape items from specific furniture subcategories on Invaluable.

## Why Subcategories?

Scraping by furniture subcategories offers several advantages:
1. **Better session management**: The API behaves more consistently with smaller, more focused requests
2. **Avoids session timeouts**: Each subcategory has fewer items, reducing the chance of session expiry after page ~141
3. **More organized data**: Data is stored in subcategory-specific folders for better organization
4. **Easier resumption**: You can resume scraping from a specific subcategory or page

## Available Subcategories

The scraper supports 23 furniture subcategories, including:
- Tables, Stands & Consoles (34,851 items)
- Chairs (23,196 items)
- Cabinets & Storage (19,307 items)
- Desks, Secretaries & Bureaus (17,240 items)
- Sofas & Settees (7,644 items)
- And more...

You can get the full list using the `/api/furniture/list` endpoint.

## API Endpoints

### List All Subcategories
```
GET /api/furniture/list
```

Returns a list of all available furniture subcategories with their item counts.

### Get Subcategory Info
```
GET /api/furniture/info/:subcategory
```

Returns information about a specific subcategory, including:
- Name and item count
- List of existing pages already stored in GCS
- Encoded value for use in URLs

### Scrape a Subcategory
```
GET /api/furniture/scrape/:subcategory?startPage=1&maxPages=100&fetchAllPages=true
```

Parameters:
- `startPage`: The page to start scraping from (default: 1)
- `maxPages`: Maximum number of pages to scrape (optional - will auto-determine if not provided)
- `fetchAllPages`: Whether to fetch all pages or just the first one (default: true)

#### Automatic Pagination

The subcategory scraper now supports automatic pagination - you don't need to specify the maxPages parameter:

```bash
curl "https://valuer-dev-856401495068.us-central1.run.app/api/furniture/scrape/Chairs?fetchAllPages=true"
```

When no maxPages parameter is provided, the system will:
1. Make an initial API request to determine the total number of items and pages
2. Automatically calculate the correct number of pages to scrape
3. Begin scraping from the specified startPage (or page 1 by default)
4. Skip any pages that already exist in Google Cloud Storage
5. Return a summary with the total pages found, pages processed, and pages skipped

This means you no longer need to know how many pages each subcategory has in advance - the system will figure it out automatically.

## Example Usage

### Using the API Directly

To scrape "Tables, Stands & Consoles" starting from page 1, up to 50 pages:

```bash
curl "https://valuer-dev-856401495068.us-central1.run.app/api/furniture/scrape/Tables,%20Stands%20%26%20Consoles?startPage=1&maxPages=50"
```

### Using the Example Scripts

1. Use the Node.js example script:

```bash
# Syntax: node script.js [subcategory] [maxPages] [startPage]
node src/examples/furniture-subcategory-scraper.js "Chairs" 20 1
```

2. Use the Bash script to scrape all subcategories:

```bash
# Change settings with environment variables
MAX_PAGES=100 START_PAGE=1 DELAY=20 ./scripts/scrape-furniture-subcategories.sh
```

## Storage Structure

The data is stored in Google Cloud Storage with the following structure:

```
invaluable-data/
├── furniture/
│   ├── tables-stands-consoles/
│   │   ├── page_0001.json
│   │   ├── page_0002.json
│   │   └── ...
│   ├── chairs/
│   │   ├── page_0001.json
│   │   └── ...
│   └── ...
```

## Resuming Scraping

To resume scraping from a specific page:

1. Check existing pages:
```bash
curl "https://valuer-dev-856401495068.us-central1.run.app/api/furniture/info/Chairs"
```

2. Resume from the next page:
```bash
curl "https://valuer-dev-856401495068.us-central1.run.app/api/furniture/scrape/Chairs?startPage=42&maxPages=100"
```

The scraper will automatically skip any pages that already exist in storage. 