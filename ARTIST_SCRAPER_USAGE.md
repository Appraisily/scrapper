# Artist Scraper Orchestrator Usage Guide

This guide provides instructions on how to use the artist scraper orchestrator to scrape auction data for individual artists from Invaluable.

## Overview

The Artist Scraper Orchestrator reads artist information from the `artists.json` file and systematically scrapes data for each artist, saving the results in a structured format in Google Cloud Storage (GCS).

## Storage Structure

Results are saved with the following structure in GCS:

```
/invaluable-data/
  /artists/
    /[Artist Display Name]/
      /data/
        page_1.json
        page_2.json
        ...
      /images/
        [lot-number]_1.jpg
        [lot-number]_2.jpg
        ...
```

## Running the Orchestrator

### Prerequisites

1. Ensure you have Node.js installed (v14+)
2. Ensure the `artists.json` file is available in the project root or specify a custom path
3. GCS authentication should be properly configured:
   - In cloud environments: Service account credentials from environment
   - Locally: Authentication with gcloud CLI

### Using the JavaScript CLI

```bash
# Process all artists
node scrape-artists-orchestrator.js

# Process 10 artists starting from index 100
node scrape-artists-orchestrator.js --start 100 --max 10

# Process artists without downloading images
node scrape-artists-orchestrator.js --no-images

# Use a custom artists file
node scrape-artists-orchestrator.js --file path/to/custom-artists.json

# Run with minimal delay (not recommended, may trigger rate limits)
node scrape-artists-orchestrator.js --delay 1000
```

### Using the PowerShell Script (Windows)

```powershell
# Process all artists
.\scrape-artists-orchestrator.ps1

# Process 10 artists starting from index 100
.\scrape-artists-orchestrator.ps1 -start 100 -max 10

# Process artists without downloading images
.\scrape-artists-orchestrator.ps1 -noImages

# Use a custom artists file
.\scrape-artists-orchestrator.ps1 -file path/to/custom-artists.json

# Run with minimal delay (not recommended, may trigger rate limits)
.\scrape-artists-orchestrator.ps1 -delay 1000
```

## Command-Line Options

| Option | Description | Default |
|--------|-------------|---------|
| `--start`, `-s` | Starting index in the artists array | 0 |
| `--max`, `-m` | Maximum number of artists to process (0 for all) | 0 |
| `--delay`, `-d` | Delay between artists in milliseconds | 5000 |
| `--retries`, `-r` | Maximum number of retries per artist | 3 |
| `--no-images` | Disable image downloading | false |
| `--file`, `-f` | Path to artists.json file | artists.json |
| `--help`, `-h` | Show help | - |

## Implementation Details

The orchestrator:

1. Loads artists from the JSON file
2. Processes each artist sequentially:
   - Checks if the artist has already been processed
   - Uses the artist's display name as the search query
   - Automatically determines the total number of pages
   - Saves both JSON data and images (if enabled)
3. Includes retry logic for failures
4. Maintains detailed progress statistics

## Handling Large Artist Files

The `artists.json` file is very large. The current implementation reads the entire file at once. For extremely large files, consider:

1. Processing in batches using the `--start` and `--max` options
2. Splitting the file into smaller chunks
3. Further optimizing the code to use streaming JSON parsing

## Troubleshooting

### Common Issues

1. **Memory errors**: Try processing in smaller batches using the `--max` option
2. **Rate limiting**: Increase the delay between requests with `--delay`
3. **Network failures**: The orchestrator includes retry logic, but persistent failures may require manual intervention
4. **Authentication errors**: Ensure GCS authentication is properly configured

## Examples for Specific Use Cases

### Processing a Specific Range of Artists

To process artists from index 1000 to 1099:

```bash
node scrape-artists-orchestrator.js --start 1000 --max 100
```

### Running Multiple Instances in Parallel

You can run multiple instances of the orchestrator to process different ranges in parallel:

```bash
# Terminal 1
node scrape-artists-orchestrator.js --start 0 --max 1000

# Terminal 2
node scrape-artists-orchestrator.js --start 1000 --max 1000

# Terminal 3
node scrape-artists-orchestrator.js --start 2000 --max 1000
```

### Resuming a Failed or Interrupted Job

If a job was interrupted at artist index 532, you can resume from there:

```bash
node scrape-artists-orchestrator.js --start 532
```

The orchestrator will automatically skip artists that have already been processed.

## Performance Considerations

- **Memory usage**: The orchestrator loads the entire artists.json file in memory. For very large files, consider processing in batches.
- **Rate limiting**: The default delay of 5 seconds between artists helps avoid rate limiting. Adjust based on your needs.
- **Parallel processing**: The orchestrator processes artists sequentially. For faster processing, run multiple instances with different ranges.
- **Image downloading**: Downloading images increases processing time and storage usage. Use `--no-images` to disable if needed. 