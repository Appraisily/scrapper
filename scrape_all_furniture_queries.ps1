# PowerShell script to scrape all furniture queries from Invaluable
# This script calls the API endpoint for each furniture query

# API base URL - using the generic endpoint
$apiBaseUrl = "https://valuer-dev-856401495068.us-central1.run.app/api/invaluable/scrape"

# Define all furniture queries to search for, in alphabetical order
$queries = @(
    "Adirondack Chair",
    "Armchair",
    "Armoire",
    "Bar Cart",
    "Bar Stool",
    "Bean Bag",
    "Bed",
    "Bedroom Adjuncts",
    "Bedside Table",
    "Bench",
    "Bookcase",
    "Bookshelf",
    "Buffet",
    "Bunk Bed",
    "Canopy Bed",
    "Chair",
    "Chaise Lounge",
    "Chest of Drawers",
    "Chifforobe",
    "China Cabinet",
    "Closet System",
    "Club Chair",
    "Coat Rack",
    "Coffee Table",
    "Computer Desk",
    "Conference Table",
    "Console Table",
    "Credenza",
    "Cubicle Partition",
    "Daybed",
    "Deck Chair",
    "Desk",
    "Desks & Work Surfaces",
    "Dining Chair",
    "Dining Table",
    "Display Cabinet",
    "Double Bed",
    "Dressing Table",
    "Dresser",
    "Drop-leaf Table",
    "Drum Table",
    "End Table",
    "Entertainment Center",
    "Executive Chair",
    "Executive Desk",
    "Étagère",
    "Filing Cabinet",
    "Folding Chair",
    "Four-poster Bed",
    "Full Bed",
    "Futon",
    "Garden Bench",
    "Hall Tree",
    "Hammock",
    "Hat Stand",
    "Hutch",
    "King Bed",
    "Kitchen Table",
    "Lap Desk",
    "Lectern",
    "Lockers",
    "Loft Bed",
    "Lounge Chair",
    "Loveseat",
    "Media Console",
    "Murphy Bed",
    "Nesting Table",
    "Nightstand",
    "Office Chair",
    "Office Desk",
    "Office Furniture",
    "Ottoman",
    "Outdoor & Patio Furniture",
    "Outdoor Bench",
    "Outdoor Chair",
    "Patio Table",
    "Pedestal",
    "Piano Bench",
    "Picnic Table",
    "Pouf",
    "Queen Bed",
    "Recliner",
    "Rocking Chair",
    "Roll-top Desk",
    "Room Divider",
    "Safe",
    "Screen",
    "Seating Furniture",
    "Secretary Desk",
    "Sectional",
    "Serving Cart",
    "Settee",
    "Shelf",
    "Sideboard",
    "Side Table",
    "Single Bed",
    "Slipper Chair",
    "Sofa",
    "Sofa Bed",
    "Standing Desk",
    "Storage & Organization",
    "Stool",
    "Swivel Chair",
    "Tables",
    "Tallboy",
    "Task Chair",
    "Trolley",
    "Trunk",
    "TV Stand",
    "Twin Bed",
    "Umbrella Stand",
    "Vanity",
    "Wardrobe",
    "Wing Chair",
    "Writing Desk"
)

# Function to URL encode spaces in query names
function UrlEncode($text) {
    return [System.Uri]::EscapeDataString($text)
}

Write-Host "Starting scraping of all furniture queries..."
Write-Host "=============================================="

# Create results directory if it doesn't exist
$resultsDir = "furniture_queries_results"
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
    # - keyword=furniture (folder name)
    # - query=specific furniture query (subfolder name)
    curl "$apiBaseUrl`?fetchAllPages=true&keyword=furniture&query=$encodedQuery"
    
    # Don't wait after the last query
    if ($currentQuery -lt $totalQueries) {
        Write-Host "`nCompleted $query. Waiting 2 seconds before next request...`n"
        Start-Sleep -Seconds 2
    } else {
        Write-Host "`nCompleted $query (final query)`n"
    }
}

Write-Host "=============================================="
Write-Host "All furniture queries have been processed ($totalQueries total)." -ForegroundColor Green 