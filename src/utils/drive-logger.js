const fs = require('fs');
const path = require('path');

function saveHtmlToFile(html, prefix) {
  try {
    // Create a timestamp for the filename
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const filename = `${prefix}-${timestamp}.html`;
    
    // Create logs directory if it doesn't exist
    const logsDir = path.join('/tmp', 'html-logs');
    if (!fs.existsSync(logsDir)) {
      fs.mkdirSync(logsDir, { recursive: true });
    }
    
    // Save the file
    const filePath = path.join(logsDir, filename);
    fs.writeFileSync(filePath, html);
    
    console.log(`[HTML Logger] Saved HTML to ${filePath}`);
    console.log(`[HTML Logger] View file at: https://drive.google.com/drive/folders/1lFoBmFm8eQlZsQb7iZLnaPG7Y5D5nFee?usp=sharing`);
    
    return filePath;
  } catch (error) {
    console.error('[HTML Logger] Error saving HTML:', error);
    return null;
  }
}

module.exports = { saveHtmlToFile };