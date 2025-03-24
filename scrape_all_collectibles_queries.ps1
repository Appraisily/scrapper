# PowerShell script to scrape all collectible categories from Invaluable
# This script calls the API endpoint for each collectible query

# API base URL - using the generic endpoint
$apiBaseUrl = "https://valuer-dev-856401495068.us-central1.run.app/api/invaluable/scrape"

# Define all collectible categories to search for in alphabetical order
$queries = @(
    "Advertising and Signs",
    "Autographs",
    "Automobilia and Petroliana",
    "Books, Maps and Manuscripts",
    "Breweriana and Barware",
    "Coins and Currency",
    "Comics and Graphic Novels",
    "Couture, Fashion and Accessories",
    "Decorative Arts",
    "Dolls and Bears",
    "Entertainment and Celebrity Memorabilia",
    "Ephemera, Cards and Documents",
    "Fine Art and Prints",
    "General",
    "Historical and Political",
    "Jewelry and Watches",
    "Kitchen and Houseware Collectibles",
    "Maritime and Nautical",
    "Military and Wartime",
    "Miscellaneous",
    "Musical Instruments and Equipment",
    "Natural History and Fossils",
    "Office and Writing Instruments",
    "Photography and Cameras",
    "Railroadiana",
    "Space and Aviation",
    "Sports Memorabilia",
    "Stamps and Philatelic Items",
    "Tobacciana",
    "Tools",
    "Toys and Games",
    "Trading Cards",
    "Tribal and Ethnographic Art",
    "Vintage Technology and Electronics"
)

# Function to URL encode spaces in query names
function UrlEncode($text) {
    return [System.Uri]::EscapeDataString($text)
}

Write-Host "Starting scraping of all collectible categories..."
Write-Host "================================================="

# Create results directory if it doesn't exist
$resultsDir = "collectibles_queries_results"
if (-not (Test-Path $resultsDir)) {
    New-Item -ItemType Directory -Path $resultsDir | Out-Null
    Write-Host "Created results directory: $resultsDir"
}

$totalQueries = $queries.Length
$currentQuery = 0

# Loop through each query and call the API
foreach ($query in $queries) {
    $currentQuery++
    $encodedQuery = UrlEncode($query)
    
    Write-Host ""
    Write-Host "[$currentQuery/$totalQueries] Scraping: $query" -ForegroundColor Green
    
    # Call the API endpoint with the keyword/query structure
    # - keyword=collectible (folder name)
    # - query=specific collectible category (subfolder name)
    # - category=Collectibles (for Invaluable search constraint)
    curl "$apiBaseUrl`?fetchAllPages=true&keyword=collectible&query=$encodedQuery&category=Collectibles"
    
    # Don't wait after the last query
    if ($currentQuery -lt $totalQueries) {
        Write-Host "`nCompleted $query. Waiting 2 seconds before next request...`n"
        Start-Sleep -Seconds 2
    } else {
        Write-Host "`nCompleted $query (final query)`n"
    }
}

Write-Host "================================================="
Write-Host "All collectible categories have been processed ($totalQueries total)." -ForegroundColor Green 