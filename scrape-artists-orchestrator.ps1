# PowerShell script to run the Artist Scraper Orchestrator
param (
    [int]$start = 0,
    [int]$max = 0,
    [int]$delay = 5000,
    [int]$retries = 3,
    [switch]$noImages,
    [string]$file = "artists.json"
)

$args = @()

if ($start -gt 0) {
    $args += "--start"
    $args += $start
}

if ($max -gt 0) {
    $args += "--max"
    $args += $max
}

if ($delay -ne 5000) {
    $args += "--delay"
    $args += $delay
}

if ($retries -ne 3) {
    $args += "--retries"
    $args += $retries
}

if ($noImages) {
    $args += "--no-images"
}

if ($file -ne "artists.json") {
    $args += "--file"
    $args += $file
}

Write-Host "Starting Artist Scraper Orchestrator with options:"
Write-Host "  Start Index: $start"
Write-Host "  Max Artists: $max"
Write-Host "  Delay: $delay ms"
Write-Host "  Retries: $retries"
Write-Host "  Save Images: $(-not $noImages)"
Write-Host "  Artists File: $file"

# Run the Node.js script with the arguments
node scrape-artists-orchestrator.js $args 