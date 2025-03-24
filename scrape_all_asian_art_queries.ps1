# PowerShell script to scrape all Asian Art & Antiques categories and subcategories from Invaluable
# This script calls the API endpoint for each Asian art query

# API base URL - using the generic endpoint
$apiBaseUrl = "https://valuer-dev-856401495068.us-central1.run.app/api/invaluable/scrape"

# Define all Asian Art & Antiques categories and subcategories to search for
$queries = @(
    # Chinese main category
    "Chinese",
    
    # Chinese subcategories
    "Chinese Ceramics and Porcelain",
    "Tang and Earlier",
    "Song",
    "Ming",
    "Qing",
    "Republic Period and Modern",
    
    "Chinese Bronzes and Metalwork",
    "Ritual Bronzes",
    "Incense Burners",
    "Censers",
    "Mirrors",
    "Weaponry",
    
    "Stone and Jade Carvings",
    "Jade",
    "Nephrite",
    "Jadeite", 
    "Hardstone Carvings",
    
    "Cloisonné and Enamels",
    "Lacquerware",
    "Chinese Paintings and Calligraphy",
    "Scrolls",
    "Fan Paintings",
    
    "Chinese Furniture",
    "Yoke-back Chairs",
    "Armchairs",
    "Chinese Tables",
    "Cabinets",
    "Screens",
    
    "Snuff Bottles and Miniatures",
    "Chinese Textiles and Embroidery",
    "Seals",
    "Scholar's Objects",
    "Brush Pots",
    "Water Droppers",
    "Rubbings",
    
    # Japanese main category
    "Japanese",
    
    "Japanese Ceramics",
    "Satsuma",
    "Imari",
    "Arita",
    "Kutani",
    "Raku",
    
    "Japanese Porcelain and Earthenware",
    "Japanese Paintings and Prints",
    "Ukiyo-e Woodblock Prints",
    "Nihonga Paintings",
    "Scroll Paintings",
    
    "Samurai and Military",
    "Japanese Swords",
    "Katana",
    "Wakizashi",
    "Tanto",
    "Sword Fittings",
    "Tsuba",
    "Fuchi-Kashira",
    "Armor",
    "Helmets",
    
    "Japanese Metalwork and Bronzes",
    "Japanese Lacquerware",
    "Maki-e",
    "Inro",
    "Netsuke and Ojime",
    
    "Japanese Traditional Textiles",
    "Kimono",
    "Obi",
    "Haori",
    
    "Japanese Furniture",
    "Tansu",
    "Low Tables",
    "Byobu",
    
    "Tea Ceremony Items",
    "Chawan",
    "Tea Caddies",
    "Bamboo Tools",
    
    # Korean main category
    "Korean",
    
    "Korean Ceramics",
    "Goryeo Celadon",
    "Joseon White Porcelain",
    "Buncheong Ware",
    
    "Korean Paintings and Calligraphy",
    "Korean Furniture",
    "Bandaji",
    "Korean Metalwork and Bronzes",
    "Korean Lacquer and Inlay",
    "Mother-of-Pearl Inlaid Lacquerware",
    
    # Indian and South Asian main category
    "Indian and South Asian",
    
    "Indian Sculpture",
    "Hindu Bronzes",
    "Jain Sculptures",
    "Buddhist Sculptures",
    "Chola Bronzes",
    "Gandharan Sculptures",
    
    "Miniature Paintings",
    "Mughal Paintings",
    "Rajasthani Paintings",
    "Pahari Paintings",
    "Deccan Paintings",
    
    "Indian Textiles and Carpets",
    "Saris",
    "Shawls",
    "Block Prints",
    
    "Indian Metalwork",
    "Bidriware",
    "Brass",
    "Copper",
    "Silver",
    
    "Indian Jewelry",
    "Kundan",
    "Meenakari",
    
    "Indian Furniture and Architectural Pieces",
    "Carved Doors",
    "Jali",
    "Columns",
    
    "Indian Manuscripts",
    "Scrolls",
    "Temple Art",
    
    # Himalayan and Tibetan main category
    "Himalayan and Tibetan",
    
    "Bronzes and Ritual Items",
    "Buddhist Deities",
    "Tara",
    "Padmapani",
    "Ritual Bowls",
    "Vajra",
    
    "Thangka Paintings",
    "Tibetan Scroll Paintings",
    "Mask and Folk Art",
    "Shamanic Masks",
    "Festival Masks",
    
    "Himalayan Jewelry and Accessories",
    "Turquoise",
    "Coral",
    "Silver",
    
    "Nepalese Artifacts",
    "Bhutanese Artifacts",
    "Sikkimese Artifacts",
    
    # Southeast Asian main category
    "Southeast Asian",
    
    "Thai",
    "Gilt Bronze Buddhas",
    "Bencharong Porcelain",
    
    "Burmese",
    "Myanmar",
    "Burmese Lacquerware",
    "Bronze Figures",
    "Wooden Carvings",
    
    "Cambodian",
    "Khmer",
    "Khmer Sculptures",
    "Cambodian Bronzes",
    "Cambodian Ceramics",
    
    "Indonesian",
    "Tribal Carvings",
    "Batik",
    "Ikat",
    "Kris",
    
    "Vietnamese",
    "Annamese Ceramics",
    "Blue-and-White Ceramics",
    "Lacquer Paintings",
    
    "Filipino",
    "Tribal Art",
    "Spanish Colonial Influences",
    
    # Central and West Asian main category
    "Central and West Asian",
    
    "Persian Art",
    "Iranian Art and Antiques",
    "Turkish Art",
    "Ottoman Art",
    "Central Asian Textiles",
    "Uzbek Textiles",
    "Kazakh Textiles",
    
    "Islamic Calligraphy",
    "Islamic Manuscripts",
    "Damascene",
    "Inlaid Brass",
    
    "Persian Carpets",
    "Caucasian Rugs",
    "Turkoman Rugs"
)

# Function to URL encode spaces in query names
function UrlEncode($text) {
    return [System.Uri]::EscapeDataString($text)
}

Write-Host "Starting scraping of all Asian Art & Antiques categories..."
Write-Host "============================================================"

# Create results directory if it doesn't exist
$resultsDir = "asian_art_queries_results"
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
    # - keyword=asian-art-antiques (folder name)
    # - query=specific category/subcategory (subfolder name)
    curl "$apiBaseUrl`?fetchAllPages=true&keyword=asian-art-antiques&query=$encodedQuery"
    
    # Don't wait after the last query
    if ($currentQuery -lt $totalQueries) {
        Write-Host "`nCompleted $query. Waiting 2 seconds before next request...`n"
        Start-Sleep -Seconds 2
    } else {
        Write-Host "`nCompleted $query (final query)`n"
    }
}

Write-Host "============================================================"
Write-Host "All Asian Art & Antiques queries have been processed ($totalQueries total)." -ForegroundColor Green 