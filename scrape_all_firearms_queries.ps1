# PowerShell script to scrape all firearms categories and subcategories from Invaluable
# This script calls the API endpoint for each firearms query

# API base URL - using the generic endpoint
$apiBaseUrl = "https://valuer-dev-856401495068.us-central1.run.app/api/invaluable/scrape"

# Define all firearms categories and subcategories to search for
$queries = @(
    # Main category
    "Rifles",
    # Rifle subcategories
    "Bolt-Action Rifles",
    "Lever-Action Rifles",
    "Pump-Action Rifles",
    "Semi-Automatic Rifles",
    "Single-Shot Rifles",
    "Break-Action Rifles",
    "Carbines",
    "Muzzleloading Rifles",
    "Antique Rifles",
    
    # Main category
    "Shotguns",
    # Shotgun subcategories
    "Pump-Action Shotguns",
    "Semi-Automatic Shotguns",
    "Double-Barrel Shotguns",
    "Side-by-Side Shotguns",
    "Over-Under Shotguns",
    "Single-Shot Shotguns",
    "Bolt-Action Shotguns",
    "Lever-Action Shotguns",
    "Antique Shotguns",
    
    # Main category
    "Handguns",
    # Handgun subcategories
    "Pistols",
    "Semi-Automatic Pistols",
    "Single-Shot Pistols",
    "Muzzleloading Pistols",
    "Revolvers",
    "Derringers",
    
    # Pistols subcategories (if treated separately)
    "Semi-Automatic Pistols",
    "Antique Black Powder Pistols",
    
    # Main category
    "Antique Firearms",
    # Antique Firearms subcategories
    "Flintlock Firearms",
    "Percussion Firearms",
    "Pre-1899 Firearms",
    "Military Surplus Firearms",
    "Curios and Relics",
    
    # Main category
    "Black Powder Firearms",
    # Black Powder subcategories
    "Black Powder Rifles",
    "Black Powder Shotguns",
    "Black Powder Handguns",
    
    # Main category
    "Machine Guns",
    # Machine Gun subcategories
    "Submachine Guns",
    "Light Machine Guns",
    "Belt-Fed Machine Guns",
    "General-Purpose Machine Guns",
    
    # Main category
    "Air Guns",
    # Air Gun subcategories
    "Air Rifles",
    "Air Pistols",
    "BB Guns",
    "Pellet Guns",
    
    # Main category
    "NFA or Class III Firearms",
    # NFA subcategories
    "Suppressors",
    "Short-Barreled Rifles",
    "Short-Barreled Shotguns",
    "Any Other Weapon",
    
    # Main category
    "Inert and Deactivated Firearms",
    # Subcategories
    "Display Models",
    "Demilled or Inert Ordnance",
    
    # Main category
    "Parts and Accessories",
    # Parts subcategories
    "Barrels",
    "Stocks and Grips",
    "Actions and Receivers",
    "Slides and Frames",
    "Cylinders",
    "Magazines and Clips",
    "Bolts and Bolt Components",
    "Triggers and Trigger Groups",
    "Sights and Optics",
    "Holsters and Slings",
    "Cases and Storage",
    "Cleaning Kits and Tools",
    
    # Main category
    "Ammunition",
    # Ammunition subcategories
    "Rifle Ammunition",
    "Shotgun Shells",
    "Handgun Ammunition",
    "Black Powder and Components",
    "Antique or Obsolete Calibers",
    "Reloading Supplies",
    
    # Main category
    "Surplus Firearms",
    # Surplus subcategories
    "Military Surplus Rifles",
    "Military Surplus Handguns",
    "Police Surplus Guns",
    
    # General category
    "General",
    # General subcategories
    "Mixed Lots",
    "Unidentified or Custom Builds",
    "Other Firearms",
    "Miscellaneous Firearms"
)

# Function to URL encode spaces in query names
function UrlEncode($text) {
    return [System.Uri]::EscapeDataString($text)
}

Write-Host "Starting scraping of all firearms categories..."
Write-Host "=============================================="

# Create results directory if it doesn't exist
$resultsDir = "firearms_queries_results"
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
    # - keyword=firearms (folder name)
    # - query=specific firearms category/subcategory (subfolder name)
    curl "$apiBaseUrl`?fetchAllPages=true&keyword=firearms&query=$encodedQuery"
    
    # Don't wait after the last query
    if ($currentQuery -lt $totalQueries) {
        Write-Host "`nCompleted $query. Waiting 2 seconds before next request...`n"
        Start-Sleep -Seconds 2
    } else {
        Write-Host "`nCompleted $query (final query)`n"
    }
}

Write-Host "=============================================="
Write-Host "All firearms queries have been processed ($totalQueries total)." -ForegroundColor Green 