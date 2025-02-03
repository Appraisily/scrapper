class ResultSaver {
  constructor(storage) {
    if (!storage) {
      throw new Error('Storage instance is required');
    }
    this.storage = storage;
  }

  async saveArtistResults(result, metadata) {
    try {
      const timestamp = metadata.timestamp;
      const baseFolder = 'Fine Art/artists';
      const artistId = result.artist.toLowerCase().replace(/[^a-z0-9]+/g, '-');
      const searchId = `${metadata.source}-${artistId}-${timestamp}`;

      console.log(`📁 Saving files for ${result.artist}`);
      
      // Save HTML files
      metadata.files = {};
      
      if (result.html.initial) {
        const filename = `${baseFolder}/${searchId}-initial.html`;
        await this.storage.saveFile(filename, result.html.initial);
        metadata.files.initial = filename;
      }
      
      if (result.html.protection) {
        const filename = `${baseFolder}/${searchId}-protection.html`;
        await this.storage.saveFile(filename, result.html.protection);
        metadata.files.protection = filename;
      }
      
      if (result.html.final) {
        const filename = `${baseFolder}/${searchId}-final.html`;
        await this.storage.saveFile(filename, result.html.final);
        metadata.files.final = filename;
      }
      
      // Save API responses
      if (result.apiData?.responses?.length > 0) {
        metadata.files.api = [];
        
        for (let i = 0; i < result.apiData.responses.length; i++) {
          const filename = `${baseFolder}/${searchId}-response${i + 1}.json`;
          await this.storage.saveFile(filename, result.apiData.responses[i]);
          metadata.files.api.push(filename);
        }
      }
      
      // Save metadata
      const metadataFilename = `${baseFolder}/${searchId}-metadata.json`;
      await this.storage.saveFile(metadataFilename, JSON.stringify(metadata, null, 2));
      
      console.log(`✅ Saved all files for ${result.artist}`);
      return { searchId, metadata };
    } catch (error) {
      console.error(`Error saving results for ${result.artist}:`, error.message);
      throw error;
    }
  }
}

module.exports = ResultSaver;