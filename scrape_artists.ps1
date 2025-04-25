# PowerShell script to scrape auction data for multiple artists

# Define parameters
param(
    [switch]$FirstOnly = $false
)

# Configuration
$API_URL = if ($env:API_URL) { $env:API_URL } else { "http://localhost:8080" }
$ENDPOINT = "/api/invaluable/scrape-artist"
$ARTISTS_FILE = if ($env:ARTISTS_FILE) { $env:ARTISTS_FILE } else { "artists.txt" }

Write-Host "Starting artist scraping script..."
Write-Host "Using API URL: $API_URL"
Write-Host "Using artist list: $ARTISTS_FILE"

if ($FirstOnly) {
    Write-Host "Mode: Testing (first artist only)" -ForegroundColor Yellow
} else {
    Write-Host "Mode: Full processing (all artists)" -ForegroundColor Green
}

# Check if the artists file exists
if (-not (Test-Path -Path $ARTISTS_FILE)) {
    Write-Host "Error: Artists file '$ARTISTS_FILE' not found." -ForegroundColor Red
    exit 1
}

# Process artists
$processedCount = 0

Get-Content $ARTISTS_FILE | ForEach-Object {
    $artist = $_
    
    # Skip empty lines and comments
    if ([string]::IsNullOrWhiteSpace($artist) -or $artist.StartsWith("#")) {
        return
    }
    
    # If we've already processed one artist and FirstOnly is true, skip
    if ($FirstOnly -and $processedCount -gt 0) {
        Write-Host "First artist processed. Skipping remaining artists due to -FirstOnly flag." -ForegroundColor Yellow
        return
    }
    
    Write-Host "---------------------------------------"
    Write-Host "Scraping artist: $artist" -ForegroundColor Cyan
    
    # Encode the artist name for URL
    $encoded_artist = [uri]::EscapeDataString($artist)
    
    # Make the API call
    Write-Host "Calling API: $API_URL$ENDPOINT`?artist=$encoded_artist"
    Invoke-RestMethod -Uri "$API_URL$ENDPOINT`?artist=$encoded_artist" | ConvertTo-Json
    
    Write-Host "Completed scraping for artist: $artist" -ForegroundColor Green
    
    $processedCount++
    
    # If FirstOnly is true, we're done after the first artist
    if ($FirstOnly) {
        Write-Host "First artist processed. Stopping due to -FirstOnly flag." -ForegroundColor Yellow
        break
    }
    
    Write-Host "Waiting before next artist..."
    Start-Sleep -Seconds 10
}

Write-Host "Artist scraping completed!" -ForegroundColor Green
Write-Host "Artists processed: $processedCount" 