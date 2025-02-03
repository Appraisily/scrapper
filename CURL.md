```bash
# Worthpoint Browser Scraping
curl "https://scrapper-856401495068.us-central1.run.app/api/art/browser"
curl "https://scrapper-856401495068.us-central1.run.app/api/art/browser?max=50&sort=SaleDate&rMin=500"
curl "https://scrapper-856401495068.us-central1.run.app/api/art/browser?saleDate=LAST_YEAR"

# Worthpoint API Search
curl "https://scrapper-856401495068.us-central1.run.app/api/art/api"
curl "https://scrapper-856401495068.us-central1.run.app/api/art/api?max=50&sort=PriceHighToLow&rMin=1000"
curl "https://scrapper-856401495068.us-central1.run.app/api/art/api?categories=fine-art,paintings"

# Christie's Auction Search
curl "https://scrapper-856401495068.us-central1.run.app/api/christies"
curl "https://scrapper-856401495068.us-central1.run.app/api/christies?month=1&year=2024"
curl "https://scrapper-856401495068.us-central1.run.app/api/christies?page=2&pageSize=30"

# Christie's Lot Details
curl "https://scrapper-856401495068.us-central1.run.app/api/christies/lot/12345"
curl "https://scrapper-856401495068.us-central1.run.app/api/christies/lot/67890"

# Invaluable Search
curl "https://scrapper-856401495068.us-central1.run.app/api/invaluable/furniture"
curl "https://scrapper-856401495068.us-central1.run.app/api/invaluable/furniture?currency=EUR&minPrice=1000"
curl "https://scrapper-856401495068.us-central1.run.app/api/invaluable/furniture?upcoming=true"
curl "https://scrapper-856401495068.us-central1.run.app/api/invaluable/furniture?query=antique&keyword=chair"

# Test All Endpoints Script
#!/bin/bash
curl -s "https://scrapper-856401495068.us-central1.run.app/api/art/browser" | jq .
curl -s "https://scrapper-856401495068.us-central1.run.app/api/art/api" | jq .
curl -s "https://scrapper-856401495068.us-central1.run.app/api/christies?month=1&year=2024" | jq .
curl -s "https://scrapper-856401495068.us-central1.run.app/api/christies/lot/12345" | jq .
```