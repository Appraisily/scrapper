# PowerShell script to run the artist list scraper

Write-Host "Starting artist list scraper..." -ForegroundColor Green

# Change to the script directory
$scriptPath = Split-Path -Parent $MyInvocation.MyCommand.Definition
Set-Location -Path $scriptPath

# Make sure node_modules are installed
if (-not (Test-Path "node_modules")) {
    Write-Host "Installing dependencies..." -ForegroundColor Yellow
    npm install
}

# Create output directory if it doesn't exist
$outputDir = "src\scrapers\invaluable\artist-list\output"
if (-not (Test-Path $outputDir)) {
    Write-Host "Creating output directory..." -ForegroundColor Yellow
    New-Item -Path $outputDir -ItemType Directory -Force | Out-Null
}

# Run the scraper
Write-Host "Running scraper..." -ForegroundColor Green
node src/scrapers/invaluable/artist-list/run.js

Write-Host "Scraping process completed." -ForegroundColor Green 