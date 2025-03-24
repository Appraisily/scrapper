# Invaluable API Scraper with Pagination

This guide explains how to use the pagination functionality in the Invaluable auction data scraper. The pagination allows you to fetch and combine multiple pages of search results, going beyond the default 96 items per page limit.

## Deployed Service

The service is deployed at:
```
https://valuer-dev-856401495068.us-central1.run.app
```

## Methods for Using Pagination

There are three main ways to use the pagination functionality:

### 1. Server-side Automatic Pagination

The simplest approach is to let the server fetch all pages for you automatically. This is done by adding the `fetchAllPages=true` parameter to your API requests.

Example:
```
https://valuer-dev-856401495068.us-central1.run.app/api/search?query=furniture&fetchAllPages=true&maxPages=3
```

This will:
- Search for "furniture"
- Automatically fetch up to 3 pages of results
- Combine all results into a single response

### 2. Browser-based Interception

For more control and visibility, you can use the browser-based interception method:

1. Copy the contents of the `browser-interceptor.js` file
2. Go to Invaluable.com and perform your search
3. Open your browser's developer console (F12 or right-click > Inspect > Console)
4. Paste and run the code
5. Browse through multiple pages of results (page 1, 2, 3, etc.)
6. The script will automatically intercept API responses on each page
7. Use `window.exportAllPages()` in the console to get the combined data
8. Use `window.sendToAPI()` to send the combined data to your API

This approach provides visual notifications as you collect pages and gives you full control over the process.

### 3. Client Interceptor Tool

For a more visual interface, you can use the client interceptor tool:

1. Visit your deployed client interceptor:
   ```
   https://valuer-dev-856401495068.us-central1.run.app/client-interceptor.html
   ```
2. Follow the instructions on the page to collect and combine multiple pages of results

## API Endpoints for Pagination

The following API endpoints support pagination:

### GET /api/search

Standard search endpoint with pagination options:

- `page`: Specific page number to fetch
- `fetchAllPages`: Set to `true` to automatically fetch all pages
- `maxPages`: Maximum number of pages to fetch when using `fetchAllPages`

Example:
```
GET /api/search?query=furniture&fetchAllPages=true&maxPages=5
```

### POST /api/search/direct

Accepts direct API data from client-side interception:

```
POST /api/search/direct
Content-Type: application/json

{
  "apiData": {...},  // The intercepted API data
  "searchParams": {...}  // Optional search parameters
}
```

### POST /api/search/combine-pages

Combines multiple pages of API data:

```
POST /api/search/combine-pages
Content-Type: application/json

{
  "pages": [{...}, {...}, ...],  // Array of page data objects
  "searchParams": {...}  // Optional search parameters
}
```

## Testing with curl

See `pagination-test-commands.md` for examples of curl commands to test the pagination functionality.

## Understanding the Results

When you receive paginated results, note the following:

- The `lots` array will contain items from all pages that were fetched
- The `totalResults` field shows the total number of items returned
- Original pagination metadata is preserved but updated to reflect the total count

## Performance Considerations

- Fetching many pages can take time, especially when using server-side pagination
- The default limit is 10 pages (approximately 960 items)
- For very large result sets, consider using filters to narrow down results

## Troubleshooting

If you encounter issues with pagination:

1. Check that the Cloudflare cookies are valid (they expire periodically)
2. Try using client-side interception if server-side pagination fails
3. Make sure your search query actually returns multiple pages of results
4. Check the API response for any error messages 