# PowerShell script to scrape all furniture subcategories from Invaluable
# This script will execute each curl command sequentially

$apiBaseUrl = "https://valuer-dev-856401495068.us-central1.run.app/api/furniture/scrape"

Write-Host "Starting scraping of all furniture subcategories..."
Write-Host "==============================================="

# Function to URL encode spaces in subcategory names
function UrlEncode($text) {
    return [System.Uri]::EscapeDataString($text)
}

# Tables, Stands & Consoles
$subcategory = UrlEncode("Tables, Stands & Consoles")
Write-Host "Scraping: Tables, Stands & Consoles"
curl "$apiBaseUrl/$subcategory`?fetchAllPages=true"
Write-Host "`nCompleted Tables, Stands & Consoles. Waiting 5 seconds before next request...`n"
Start-Sleep -Seconds 5

# Chairs
Write-Host "Scraping: Chairs"
curl "$apiBaseUrl/Chairs?fetchAllPages=true"
Write-Host "`nCompleted Chairs. Waiting 5 seconds before next request...`n"
Start-Sleep -Seconds 5

# Cabinets & Storage
$subcategory = UrlEncode("Cabinets & Storage")
Write-Host "Scraping: Cabinets & Storage"
curl "$apiBaseUrl/$subcategory`?fetchAllPages=true"
Write-Host "`nCompleted Cabinets & Storage. Waiting 5 seconds before next request...`n"
Start-Sleep -Seconds 5

# Desks, Secretaries & Bureaus
$subcategory = UrlEncode("Desks, Secretaries & Bureaus")
Write-Host "Scraping: Desks, Secretaries & Bureaus"
curl "$apiBaseUrl/$subcategory`?fetchAllPages=true"
Write-Host "`nCompleted Desks, Secretaries & Bureaus. Waiting 5 seconds before next request...`n"
Start-Sleep -Seconds 5

# Sofas & Settees
$subcategory = UrlEncode("Sofas & Settees")
Write-Host "Scraping: Sofas & Settees"
curl "$apiBaseUrl/$subcategory`?fetchAllPages=true"
Write-Host "`nCompleted Sofas & Settees. Waiting 5 seconds before next request...`n"
Start-Sleep -Seconds 5

# Stools & Benches
$subcategory = UrlEncode("Stools & Benches")
Write-Host "Scraping: Stools & Benches"
curl "$apiBaseUrl/$subcategory`?fetchAllPages=true"
Write-Host "`nCompleted Stools & Benches. Waiting 5 seconds before next request...`n"
Start-Sleep -Seconds 5

# Candelabra, Incense Burners & Lamps
$subcategory = UrlEncode("Candelabra, Incense Burners & Lamps")
Write-Host "Scraping: Candelabra, Incense Burners & Lamps"
curl "$apiBaseUrl/$subcategory`?fetchAllPages=true"
Write-Host "`nCompleted Candelabra, Incense Burners & Lamps. Waiting 5 seconds before next request...`n"
Start-Sleep -Seconds 5

# Mirrors & Looking Glasses
$subcategory = UrlEncode("Mirrors & Looking Glasses")
Write-Host "Scraping: Mirrors & Looking Glasses"
curl "$apiBaseUrl/$subcategory`?fetchAllPages=true"
Write-Host "`nCompleted Mirrors & Looking Glasses. Waiting 5 seconds before next request...`n"
Start-Sleep -Seconds 5

# Beds & Bedroom Sets
$subcategory = UrlEncode("Beds & Bedroom Sets")
Write-Host "Scraping: Beds & Bedroom Sets"
curl "$apiBaseUrl/$subcategory`?fetchAllPages=true"
Write-Host "`nCompleted Beds & Bedroom Sets. Waiting 5 seconds before next request...`n"
Start-Sleep -Seconds 5

# Carts, Bar & Tea trolleys
$subcategory = UrlEncode("Carts, Bar & Tea trolleys")
Write-Host "Scraping: Carts, Bar & Tea trolleys"
curl "$apiBaseUrl/$subcategory`?fetchAllPages=true"
Write-Host "`nCompleted Carts, Bar & Tea trolleys. Waiting 5 seconds before next request...`n"
Start-Sleep -Seconds 5

# Bookcases & Display Cases
$subcategory = UrlEncode("Bookcases & Display Cases")
Write-Host "Scraping: Bookcases & Display Cases"
curl "$apiBaseUrl/$subcategory`?fetchAllPages=true"
Write-Host "`nCompleted Bookcases & Display Cases. Waiting 5 seconds before next request...`n"
Start-Sleep -Seconds 5

# Buffets & Sideboards
$subcategory = UrlEncode("Buffets & Sideboards")
Write-Host "Scraping: Buffets & Sideboards"
curl "$apiBaseUrl/$subcategory`?fetchAllPages=true"
Write-Host "`nCompleted Buffets & Sideboards. Waiting 5 seconds before next request...`n"
Start-Sleep -Seconds 5

# Dry Bars & Wine Storage
$subcategory = UrlEncode("Dry Bars & Wine Storage")
Write-Host "Scraping: Dry Bars & Wine Storage"
curl "$apiBaseUrl/$subcategory`?fetchAllPages=true"
Write-Host "`nCompleted Dry Bars & Wine Storage. Waiting 5 seconds before next request...`n"
Start-Sleep -Seconds 5

# Vanities & Accessories
$subcategory = UrlEncode("Vanities & Accessories")
Write-Host "Scraping: Vanities & Accessories"
curl "$apiBaseUrl/$subcategory`?fetchAllPages=true"
Write-Host "`nCompleted Vanities & Accessories. Waiting 5 seconds before next request...`n"
Start-Sleep -Seconds 5

# Coat & Umbrella Stands
$subcategory = UrlEncode("Coat & Umbrella Stands")
Write-Host "Scraping: Coat & Umbrella Stands"
curl "$apiBaseUrl/$subcategory`?fetchAllPages=true"
Write-Host "`nCompleted Coat & Umbrella Stands. Waiting 5 seconds before next request...`n"
Start-Sleep -Seconds 5

# Other Furniture
$subcategory = UrlEncode("Other Furniture")
Write-Host "Scraping: Other Furniture"
curl "$apiBaseUrl/$subcategory`?fetchAllPages=true"
Write-Host "`nCompleted Other Furniture. Waiting 5 seconds before next request...`n"
Start-Sleep -Seconds 5

# Unknown
Write-Host "Scraping: Unknown"
curl "$apiBaseUrl/Unknown?fetchAllPages=true"
Write-Host "`nCompleted Unknown. Waiting 5 seconds before next request...`n"
Start-Sleep -Seconds 5

# Credenzas
Write-Host "Scraping: Credenzas"
curl "$apiBaseUrl/Credenzas?fetchAllPages=true"
Write-Host "`nCompleted Credenzas. Waiting 5 seconds before next request...`n"
Start-Sleep -Seconds 5

# Entertainment Centers
$subcategory = UrlEncode("Entertainment Centers")
Write-Host "Scraping: Entertainment Centers"
curl "$apiBaseUrl/$subcategory`?fetchAllPages=true"
Write-Host "`nCompleted Entertainment Centers. Waiting 5 seconds before next request...`n"
Start-Sleep -Seconds 5

# Fireplace Tools & Screens
$subcategory = UrlEncode("Fireplace Tools & Screens")
Write-Host "Scraping: Fireplace Tools & Screens"
curl "$apiBaseUrl/$subcategory`?fetchAllPages=true"
Write-Host "`nCompleted Fireplace Tools & Screens. Waiting 5 seconds before next request...`n"
Start-Sleep -Seconds 5

# Garment Racks & Clothes Valets
$subcategory = UrlEncode("Garment Racks & Clothes Valets")
Write-Host "Scraping: Garment Racks & Clothes Valets"
curl "$apiBaseUrl/$subcategory`?fetchAllPages=true"
Write-Host "`nCompleted Garment Racks & Clothes Valets. Waiting 5 seconds before next request...`n"
Start-Sleep -Seconds 5

# Beds
Write-Host "Scraping: Beds"
curl "$apiBaseUrl/Beds?fetchAllPages=true"
Write-Host "`nCompleted Beds. Waiting 5 seconds before next request...`n"
Start-Sleep -Seconds 5

# Wardrobes
Write-Host "Scraping: Wardrobes"
curl "$apiBaseUrl/Wardrobes?fetchAllPages=true"
Write-Host "`nCompleted Wardrobes`n"

Write-Host "==============================================="
Write-Host "All furniture subcategories have been scraped!" 