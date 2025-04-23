# Invaluable Artist List Scraper

This module scrapes artist data from [Invaluable.com](https://www.invaluable.com/artists/) to create a comprehensive list of artists, organized alphabetically.

## Overview

The scraper navigates through the alphabetical listing of artists on Invaluable's website, collecting artist names and their corresponding URLs. It processes all artists from A to C.

## Features

- Scrapes artist names and URLs from letters A to C
- Processes all sub-letter pages (Aa, Ab, Ac, etc.)
- Saves progress after each letter in case of interruption
- Creates multiple output formats:
  - JSON file with full artist data
  - TXT file with artist names only
  - TXT file with artist names and URLs

## Output Files

All output files are stored in the `output` directory:

- `artists_A_to_C.json` - Complete JSON data with names and URLs
- `artists_A_to_C_names.txt` - Plain text file with artist names only
- `artists_A_to_C_with_urls.txt` - Tab-separated file with artist names and URLs
- `artists_X_progress.json` - Progress files saved after each letter (where X is the letter)

## Requirements

- Node.js 14 or higher
- Puppeteer

## Usage

### Running from the command line

1. From the project root, run one of the following scripts:

   **On Linux/Mac:**
   ```
   ./scrape_artists.sh
   ```

   **On Windows:**
   ```
   .\scrape_artists.ps1
   ```

### Running programmatically

```javascript
const { ArtistListScraper } = require('./src/scrapers/invaluable/artist-list');

async function run() {
  const scraper = new ArtistListScraper();
  
  try {
    await scraper.initialize();
    await scraper.scrapeAllArtists();
  } finally {
    await scraper.close();
  }
}

run().catch(console.error);
```

## How It Works

1. The scraper first navigates to the main page for each letter (A, B, C)
2. It collects all sub-letter links (Aa, Ab, Ac, etc.)
3. For each sub-letter, it navigates to the appropriate page and collects all artist data
4. It saves progress after each letter to prevent data loss in case of interruption
5. Finally, it saves the complete results in multiple formats

## Configuration

By default, the scraper is configured to run in non-headless mode so you can see the browser in action. If you want to run it in headless mode, modify the `initialize` method in `scraper.js`:

```javascript
this.browser = await puppeteer.launch({
  headless: true,  // Change to true
  args: ['--no-sandbox', '--disable-setuid-sandbox']
});
```

## Extending

To scrape additional letters beyond C:

1. Modify the `getLettersToScrape` method in `scraper.js` to include more letters:

```javascript
getLettersToScrape() {
  return ['A', 'B', 'C', 'D', 'E', /* ... */];
}
```

2. Update the output filenames in the `saveResults` method to reflect the new range. 