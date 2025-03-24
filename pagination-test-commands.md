# Testing Pagination with Invaluable API Scraper

These commands will help you test the pagination functionality with the deployed API at `https://valuer-dev-856401495068.us-central1.run.app`.

## Basic Search Query (Single Page)

```bash
curl -X GET "https://valuer-dev-856401495068.us-central1.run.app/api/search?query=furniture" | jq
```

This will fetch the first page of results for "furniture". The `jq` command formats the JSON output for better readability.

## Fetch with Pagination (All Pages)

```bash
curl -X GET "https://valuer-dev-856401495068.us-central1.run.app/api/search?query=furniture&fetchAllPages=true&maxPages=2" | jq
```

This will automatically fetch and combine the first 2 pages of results for "furniture".

## Fetch a Specific Page

```bash
curl -X GET "https://valuer-dev-856401495068.us-central1.run.app/api/search?query=furniture&page=2" | jq
```

This fetches specifically the 2nd page of results.

## Advanced Query with Filters and Pagination

```bash
curl -X GET "https://valuer-dev-856401495068.us-central1.run.app/api/search?query=chair&fetchAllPages=true&maxPages=2&priceResult[min]=1000&priceResult[max]=5000" | jq
```

This searches for "chair" with a price range of $1,000-$5,000 and fetches up to 2 pages of results.

## Submit Direct API Data

If you've intercepted API data directly from Invaluable, you can submit it to the API:

```bash
curl -X POST "https://valuer-dev-856401495068.us-central1.run.app/api/search/direct" \
  -H "Content-Type: application/json" \
  -d '{"apiData": PASTE_YOUR_API_DATA_HERE, "searchParams": {"query": "furniture"}}' | jq
```

Replace `PASTE_YOUR_API_DATA_HERE` with the actual API data you intercepted.

## Combine Multiple Pages

If you have intercepted multiple pages of results, you can combine them:

```bash
curl -X POST "https://valuer-dev-856401495068.us-central1.run.app/api/search/combine-pages" \
  -H "Content-Type: application/json" \
  -d '{"pages": [PAGE1_DATA, PAGE2_DATA], "searchParams": {"query": "furniture"}}' | jq
```

Replace `PAGE1_DATA` and `PAGE2_DATA` with the actual API data from different pages.

## Using with Browser Console

For easiest use, simply go to Invaluable in your browser, open the developer console, and paste in the following code:

```javascript
// Load and run the interceptor script
fetch('https://valuer-dev-856401495068.us-central1.run.app/client-interceptor.html')
  .then(response => response.text())
  .then(html => {
    // Extract the interceptor code
    const match = html.match(/const interceptorCode = `([\s\S]*?)`/);
    if (match && match[1]) {
      eval(match[1]);
      console.log('Interceptor loaded successfully from remote server');
    } else {
      console.error('Could not extract interceptor code');
    }
  })
  .catch(error => console.error('Error loading interceptor:', error));
```

Then browse through multiple pages of search results. After collecting pages, use `window.exportAllPages()` to get the combined data. 