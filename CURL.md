# Invaluable Search API Documentation

## Endpoint

```bash
GET /api/search
```

## Query Parameters

Any valid Invaluable search parameters can be used. Common parameters include:

- `query`: Search query
- `keyword`: Additional keyword filter
- `supercategoryName`: Category name (e.g., "Furniture", "Fine Art")
- `priceResult[min]`: Minimum price
- `priceResult[max]`: Maximum price
- `houseName`: Auction house name
- `upcoming`: Filter for upcoming auctions (true/false)
- `saveToGcs`: Save results to Google Cloud Storage (true/false)
- `saveImages`: Download and save item images (true/false)
- `bucket`: Optional custom GCS bucket name (defaults to environment variable STORAGE_BUCKET)

## Examples

```bash
# Basic search
curl "http://localhost:8080/api/search?query=furniture"

# Search with price range
curl "http://localhost:8080/api/search?query=furniture&priceResult[min]=250&priceResult[max]=500"

# Search with multiple parameters
curl "http://localhost:8080/api/search?supercategoryName=Furniture&priceResult[min]=500&priceResult[max]=5000"

# Search specific auction house
curl "http://localhost:8080/api/search?houseName=DOYLE%20Auctioneers%20%26%20Appraisers&query=antique"

# Search with image saving
curl "http://localhost:8080/api/search?query=furniture&saveToGcs=true&saveImages=true"

# Search with custom bucket
curl "http://localhost:8080/api/search?query=furniture&saveToGcs=true&saveImages=true&bucket=invaluable-html-archive-dev"
```

## Response Format

```json
{
  "success": true,
  "timestamp": "2024-02-14T12:34:56.789Z",
  "parameters": {
    "query": "furniture",
    "priceResult[min]": "250",
    "priceResult[max]": "500"
  },
  "data": {
    "lots": [
      {
        "title": "Antique French Provincial Dining Table",
        "date": "2025-04-15T10:00:00Z",
        "auctionHouse": "Example Auction House",
        "price": {
          "amount": 1200,
          "currency": "USD",
          "symbol": "$"
        },
        "image": "example/123/789123.jpg",
        "imagePath": "gs://invaluable-html-archive/invaluable-data/furniture/dining-table/images/lot123_789123.jpg",
        "lotNumber": "123",
        "saleType": "Live"
      }
    ],
    "totalResults": 1
  }
}
```

## Error Response

```json
{
  "error": "Failed to fetch search results",
  "message": "Error details"
}
```