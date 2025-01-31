// Simple file logger that writes to disk instead of Google Drive
const fs = require('fs');
const path = require('path');

function saveHtmlToFile(html, prefix) {
  try {
    // Create logs directory if it doesn't exist
    const logsDir = path.join(process.cwd(), 'logs');
    if (!fs.existsSync(logsDir)) {
      fs.mkdirSync(logsDir, { recursive: true });
    }

    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const filename = `${prefix}-${timestamp}.html`;
    const filePath = path.join(logsDir, filename);

    // Write the file
    fs.writeFileSync(filePath, html);
    console.log(`[Logger] Successfully saved ${filename}`);
    return filePath;
  } catch (error) {
    console.error('[Logger] Error saving file:', error);
    
    // Log the HTML to console as fallback
    console.log('\n[Logger] HTML Content (fallback):\n');
    console.log(html);
    console.log('\n----------------------------------------\n');
    
    return null;
  }
}

module.exports = { saveHtmlToFile };