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
  "data": [
    {
      // Captured JSON responses from catResults endpoint
    }
  ]
}
```

## Error Response

```json
{
  "error": "Failed to fetch search results",
  "message": "Error details"
}
```