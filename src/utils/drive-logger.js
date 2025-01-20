const { google } = require('googleapis');

class DriveLogger {
  constructor() {
    this.drive = null;
    this.folderId = '1lFoBmFm8eQlZsQb7iZLnaPG7Y5D5nFee';
    this.initialized = false;
  }

  async initialize() {
    if (this.initialized) return;

    try {
      // Initialize with default credentials (will use service account in production)
      const auth = new google.auth.GoogleAuth({
        scopes: ['https://www.googleapis.com/auth/drive.file']
      });

      const client = await auth.getClient();
      this.drive = google.drive({ version: 'v3', auth: client });
      this.initialized = true;
      
      console.log('[Drive Logger] Successfully initialized Google Drive client');
    } catch (error) {
      console.error('[Drive Logger] Error initializing Google Drive client:', error);
      throw error;
    }
  }

  async saveHtmlToFile(html, prefix) {
    try {
      if (!this.initialized) {
        await this.initialize();
      }

      const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
      const filename = `${prefix}-${timestamp}.html`;

      // Create file metadata
      const fileMetadata = {
        name: filename,
        parents: [this.folderId],
        mimeType: 'text/html'
      };

      // Create media
      const media = {
        mimeType: 'text/html',
        body: html
      };

      // Upload file
      const file = await this.drive.files.create({
        resource: fileMetadata,
        media: media,
        fields: 'id, webViewLink'
      });

      console.log(`[Drive Logger] Successfully saved ${filename}`);
      console.log(`[Drive Logger] File ID: ${file.data.id}`);
      console.log(`[Drive Logger] View Link: ${file.data.webViewLink}`);

      return file.data.webViewLink;
    } catch (error) {
      console.error('[Drive Logger] Error saving file:', error);
      
      // Log the HTML to console as fallback
      console.log('\n[Drive Logger] HTML Content (fallback):\n');
      console.log(html);
      console.log('\n----------------------------------------\n');
      
      return null;
    }
  }
}

// Export singleton instance
const driveLogger = new DriveLogger();
module.exports = { saveHtmlToFile: (html, prefix) => driveLogger.saveHtmlToFile(html, prefix) };