/**
 * Artist HTML Parser
 * Extracts artist information from downloaded Invaluable HTML files
 * 
 * Usage: node parse-artists.js [--input-dir=artist_directory] [--output-file=artists.json]
 */

const fs = require('fs').promises;
const path = require('path');
const { existsSync } = require('fs');

// Parse command-line arguments
const args = process.argv.slice(2);
const options = {
  inputDir: 'artist_directory',
  outputFile: 'artists.json'
};

// Process arguments
args.forEach(arg => {
  if (arg.startsWith('--input-dir=')) {
    options.inputDir = arg.split('=')[1];
  } else if (arg.startsWith('--output-file=')) {
    options.outputFile = arg.split('=')[1];
  }
});

// Main function
async function parseArtistFiles() {
  try {
    console.log(`Starting to parse HTML files from ${options.inputDir}`);
    
    // Check if directory exists
    if (!existsSync(options.inputDir)) {
      console.error(`Error: Directory ${options.inputDir} does not exist`);
      process.exit(1);
    }
    
    // Get all letter directories
    const letterDirs = await fs.readdir(options.inputDir);
    console.log(`Found ${letterDirs.length} letter directories`);
    
    // Store all artists
    const allArtists = [];
    let errorCount = 0;
    let successCount = 0;
    
    // Process each letter directory
    for (const letterDir of letterDirs) {
      const letterPath = path.join(options.inputDir, letterDir);
      
      // Skip if not a directory
      const dirStat = await fs.stat(letterPath);
      if (!dirStat.isDirectory()) continue;
      
      console.log(`Processing directory: ${letterDir}`);
      
      // Get HTML files in the letter directory
      const htmlFiles = (await fs.readdir(letterPath))
        .filter(file => file.endsWith('.html'));
      
      console.log(`Found ${htmlFiles.length} HTML files in ${letterDir}`);
      
      // Process each HTML file
      for (const htmlFile of htmlFiles) {
        const filePath = path.join(letterPath, htmlFile);
        console.log(`Parsing ${filePath}...`);
        
        try {
          // Read HTML content
          const htmlContent = await fs.readFile(filePath, 'utf8');
          
          // Extract JSON data
          const artists = extractArtistsFromHtml(htmlContent, htmlFile);
          
          if (artists && artists.length > 0) {
            console.log(`Found ${artists.length} artists in ${htmlFile}`);
            allArtists.push(...artists);
            successCount++;
          } else {
            console.log(`No artists found in ${htmlFile}`);
            errorCount++;
          }
        } catch (fileError) {
          console.error(`Error processing file ${htmlFile}:`, fileError.message);
          errorCount++;
        }
      }
    }
    
    // Remove duplicates by artistRef
    const uniqueArtists = removeDuplicates(allArtists, 'artistRef');
    console.log(`Total unique artists found: ${uniqueArtists.length}`);
    console.log(`Successful files: ${successCount}, Failed files: ${errorCount}`);
    
    // Save to JSON file
    await fs.writeFile(options.outputFile, JSON.stringify(uniqueArtists, null, 2));
    console.log(`Artists data saved to ${options.outputFile}`);
    
    return uniqueArtists;
  } catch (error) {
    console.error('Error parsing artist files:', error);
    process.exit(1);
  }
}

/**
 * Extract artist information from HTML content
 */
function extractArtistsFromHtml(htmlContent, filename) {
  try {
    // Look for window.__APP_INITIAL_STATE__ assignment
    const stateMatch = htmlContent.match(/window\.__APP_INITIAL_STATE__\s*=\s*(\{[\s\S]*?\});\s*window\.__APP_/);
    
    if (!stateMatch || !stateMatch[1]) {
      // Try alternate pattern
      const altMatch = htmlContent.match(/window\.__APP_INITIAL_STATE__\s*=\s*(\{[\s\S]*?\});/);
      if (!altMatch || !altMatch[1]) {
        return [];
      }
      
      const jsonStr = altMatch[1];
      return parseArtistsFromJson(jsonStr, filename);
    }
    
    const jsonStr = stateMatch[1];
    return parseArtistsFromJson(jsonStr, filename);
  } catch (error) {
    console.error(`Error extracting artists from HTML in ${filename}:`, error.message);
    return [];
  }
}

/**
 * Parse artists from JSON string
 */
function parseArtistsFromJson(jsonStr, filename) {
  try {
    // Initial cleanup to fix common JSON issues
    let cleanedJsonStr = jsonStr
      .replace(/undefined/g, 'null')
      .replace(/NaN/g, 'null')
      .replace(/Infinity/g, '"Infinity"')
      .replace(/-Infinity/g, '"-Infinity"');
    
    // Try to parse the JSON directly first
    let jsonData;
    try {
      jsonData = JSON.parse(cleanedJsonStr);
    } catch (initialError) {
      // If that fails, try more aggressive cleaning
      cleanedJsonStr = cleanedJsonStr
        .replace(/([{,]\s*)(\w+)(\s*:)/g, '$1"$2"$3') // Ensure property names are quoted
        .replace(/','/g, '","')  // Fix improperly quoted strings
        .replace(/'/g, '"')      // Replace single quotes with double quotes
        .replace(/\\x(\w{2})/g, '') // Remove hex escape sequences
        .replace(/\\u0000/g, '')  // Remove null bytes
        .replace(/\r?\n|\r/g, '') // Remove newlines
        .replace(/,\s*}/g, '}')  // Fix trailing commas in objects
        .replace(/,\s*\]/g, ']'); // Fix trailing commas in arrays
      
      try {
        jsonData = JSON.parse(cleanedJsonStr);
      } catch (secondError) {
        // Still failed - try to extract just the hits array
        const hitsMatch = jsonStr.match(/"hits"\s*:\s*(\[[\s\S]*?\]\s*),\s*"n/);
        if (hitsMatch && hitsMatch[1]) {
          try {
            // Create a minimal valid JSON with just the hits array
            const hitsArray = JSON.parse(hitsMatch[1]);
            jsonData = { resultsState: { rawResults: [{ hits: hitsArray }] } };
          } catch (hitsError) {
            console.error(`Error parsing hits array in ${filename}:`, hitsError.message);
            // Final fallback - save the problematic JSON for debugging
            const debugDir = 'debug_json';
            if (!existsSync(debugDir)) {
              require('fs').mkdirSync(debugDir, { recursive: true });
            }
            require('fs').writeFileSync(path.join(debugDir, `${filename}.json`), jsonStr);
            throw new Error(`JSON parsing failed for ${filename}, saved debug file`);
          }
        } else {
          throw new Error(`Failed to extract hits array from ${filename}`);
        }
      }
    }
    
    // Look for artists in the results structure
    if (jsonData?.resultsState?.rawResults?.[0]?.hits) {
      const artists = jsonData.resultsState.rawResults[0].hits;
      
      // Map to a cleaner structure
      return artists.map(artist => ({
        artistRef: artist.artistRef || '',
        firstName: artist.firstName || '',
        lastName: artist.lastName || '',
        displayName: artist.displayName || '',
        aliasList: artist.aliasList || [],
        photoPath: artist.photoPath || '',
        totalCount: artist.totalCount || 0,
        upcomingCount: artist.upcomingCount || 0,
        pastCount: artist.pastCount || 0,
        followerCount: artist.followerCount || 0,
        genres: artist.genres || [],
        alphaSortOrder: artist.alphaSortOrder || '',
        alphaCategory: artist.alpha?.lvl0 || '',
        alphaSubcategory: artist.alpha?.lvl1 || '',
        birthYear: artist.birthYear || '',
        deathYear: artist.deathYear || '',
        nationality: artist.nationality || ''
      }));
    }
    
    return [];
  } catch (error) {
    console.error(`Error parsing JSON data in ${filename}:`, error.message);
    return [];
  }
}

/**
 * Remove duplicate objects from array based on a key
 */
function removeDuplicates(array, key) {
  const seen = new Set();
  return array.filter(item => {
    const value = item[key];
    if (value && !seen.has(value)) {
      seen.add(value);
      return true;
    }
    return false;
  });
}

// Create a debug directory for problematic files
const debugDir = 'debug_json';
if (!existsSync(debugDir) && require.main === module) {
  require('fs').mkdirSync(debugDir, { recursive: true });
}

// Run the main function
if (require.main === module) {
  parseArtistFiles();
}

module.exports = { parseArtistFiles }; 