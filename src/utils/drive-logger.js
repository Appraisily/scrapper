const storage = require('./storage');

async function saveHtmlToFile(html, prefix) {
  try {
    const url = await storage.saveHtml(html, prefix);
    if (url) {
      console.log(`[Logger] Successfully saved ${prefix} HTML to: ${url}`);
      return url;
    }
    
    // Log the HTML to console as fallback
    console.log('\n[Logger] HTML Content (fallback):\n');
    console.log(html.substring(0, 1000));
    console.log('\n----------------------------------------\n');
    
    return null;
  } catch (error) {
    console.error('[Logger] Error saving HTML:', error);
    return null;
  }
}

module.exports = { saveHtmlToFile };