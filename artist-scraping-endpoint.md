# Artist-Specific Scraping Endpoint

## Overview

The artist-specific scraping endpoint allows you to fetch auction data for a specific artist from Invaluable auctions. This endpoint is optimized for artist-centric searches and handles all the complexities of pagination, browser automation, and data storage.

## Endpoint Details

```
GET /api/invaluable/scrape-artist
```

This endpoint is designed specifically for artist-focused scraping, providing targeted results for a single artist's auction items.

## Parameters

| Parameter | Type | Required | Description | Default |
|-----------|------|----------|-------------|---------|
| `artist` | string | Yes | The artist's name to search for | - |
| `fetchAllPages` | boolean | No | Whether to automatically fetch all available result pages | `false` |
| `maxPages` | number | No | Maximum number of pages to fetch | `1` |
| `saveToGcs` | boolean | No | Save results to Google Cloud Storage | `false` |
| `saveImages` | boolean | No | Download and save item images | `false` |
| `bucket` | string | No | Custom GCS bucket name | `invaluable-html-archive-images` |
| `startPage` | number | No | Page number to start scraping from | `1` |
| `skipProcessed` | boolean | No | Skip pages that have already been processed | `true` |

## Usage Examples

### Basic Artist Search

```bash
curl "http://localhost:8080/api/invaluable/scrape-artist?artist=picasso"
```

This will fetch only the first page of results for Picasso.

### Fetch All Available Pages

```bash
curl "http://localhost:8080/api/invaluable/scrape-artist?artist=picasso&fetchAllPages=true"
```

This will automatically paginate through all available results for Picasso.

### Limit Pages with Image Saving

```bash
curl "http://localhost:8080/api/invaluable/scrape-artist?artist=picasso&maxPages=5&saveToGcs=true&saveImages=true"
```

This will fetch up to 5 pages of results for Picasso and save both data and images to Google Cloud Storage.

### Custom Storage Bucket

```bash
curl "http://localhost:8080/api/invaluable/scrape-artist?artist=picasso&fetchAllPages=true&saveToGcs=true&saveImages=true&bucket=custom-artist-data"
```

This will save all Picasso auction data and images to a custom GCS bucket named "custom-artist-data".

### Resume Scraping from a Specific Page

```bash
curl "http://localhost:8080/api/invaluable/scrape-artist?artist=picasso&fetchAllPages=true&startPage=10"
```

This will start scraping from page 10 onwards for Picasso.

## Response Format

The endpoint returns JSON data with the following structure:

```json
{
  "success": true,
  "message": "Artist scraping initiated",
  "data": {
    "artist": "picasso",
    "totalResults": 1250,
    "totalPages": 63,
    "currentPage": 1,
    "results": [
      {
        "title": "Pablo Picasso (1881-1973) - Femme assise",
        "lotNumber": "123456",
        "description": "Signed and dated lower right",
        "estimate": "$80,000 - $120,000",
        "soldPrice": "$95,000",
        "auctionDate": "Jun 15, 2023",
        "auctionHouse": "Christie's",
        "medium": "Lithograph",
        "dimensions": "65.5 x 50.3 cm",
        "imageUrls": [
          "https://example.com/image1.jpg",
          "https://example.com/image2.jpg"
        ],
        "provenance": "Private Collection, Paris",
        "additionalInfo": {
          "catalogueRaisonne": "Bloch 1234",
          "edition": "50/75"
        }
      },
      // More results...
    ],
    "storage": {
      "savedToGcs": true,
      "bucket": "invaluable-html-archive-images",
      "path": "invaluable-data/artists/picasso/",
      "imagesSaved": 25
    }
  }
}
```

## Storage Structure

When using the `saveToGcs=true` parameter, data is stored in the following structure:

```
{bucket}/invaluable-data/artists/{artist_name}/page_{page_number}.json
```

When using `saveImages=true`, images are stored as:

```
{bucket}/invaluable-data/artists/{artist_name}/images/{lot_number}_{image_index}.jpg
```

## Advanced Features

### Automatic Restart on Blank Pages

The endpoint features automatic restart logic when blank pages are encountered:

1. When a page shows no results (which can happen due to session issues), the system detects this
2. The browser session is automatically restarted
3. The system continues pagination from the problematic page
4. Previously collected results are preserved

### Tab Pooling for Image Downloads

When downloading images with `saveImages=true`, the system:

- Uses a pool of browser tabs (maximum 5 by default)
- Reuses tabs efficiently for downloading multiple images
- Properly resets tab state between downloads
- Significantly reduces memory usage compared to creating a new tab for each image

## Error Handling

Common errors and their causes:

| Error | Cause | Solution |
|-------|-------|----------|
| "Artist parameter is required" | Missing artist name | Provide an artist name in the request |
| "Failed to initialize browser" | Resource limitations | Ensure sufficient system resources are available |
| "Failed to save to GCS" | Storage permissions | Check GCP credentials and bucket permissions |
| "Page timeout" | Network issues or site changes | Retry with a lower `maxPages` value or check network connectivity |

## Best Practices

1. **Artist Name Format**: Use the exact artist name as it appears on Invaluable. Multi-word artist names work best in quotes: `artist="Pablo Picasso"`

2. **Pagination Control**: For large artist catalogs:
   - Start with a small `maxPages` value to test results
   - Use `fetchAllPages=true` only when you're sure you want all pages
   - Monitor memory usage during large scrapes

3. **Resource Management**:
   - For high-volume artists (like Picasso), consider running scrapes in batches using `startPage` and `maxPages`
   - Allow 4-8GB of RAM for optimal performance when scraping with image downloading

4. **Storage Optimization**:
   - Group related artists in custom buckets
   - Consider using different bucket names for different art movements or periods

5. **Rate Limiting**:
   - The system includes automatic rate limiting to avoid detection
   - Do not attempt to run multiple concurrent scrapes for the same artist
   - Allow sufficient time between large scraping operations

## Integration with Other Endpoints

The artist scraping endpoint works well in combination with:

1. **Artist Directory Scraper**: Use the artist directory scraper to get a list of artist names, then use this endpoint to scrape each artist individually.

2. **Search Endpoint**: For more general searches that aren't artist-specific, use the main search endpoint.

## Troubleshooting

If you encounter issues:

1. Check the server logs for specific error messages
2. Verify your network connectivity and Invaluable site accessibility
3. Ensure your GCP credentials are properly configured if using GCS storage
4. Try reducing the scope of your request (fewer pages, no image downloading)
5. Restart the server if you encounter persistent browser automation issues 