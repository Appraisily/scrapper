const refreshService = require('../utils/refresh-service');

(async () => {
  try {
    // Read all keywords from KWs.txt
    const keywords = await refreshService.readKeywordsFile();
    if (!Array.isArray(keywords) || keywords.length === 0) {
      console.error('No keywords found to process.');
      process.exit(1);
    }

    console.log(`Starting refresh for ${keywords.length} keywords...`);
    const result = await refreshService.processKeywords(keywords);

    console.log('\n===== Refresh Complete =====');
    console.log(JSON.stringify(result, null, 2));
    process.exit(0);
  } catch (error) {
    console.error('Error running refresh-all script:', error);
    process.exit(1);
  }
})();