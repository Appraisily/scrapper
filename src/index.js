const WorthpointScraper = require('./scraper');
const { getCredentials } = require('./secrets');

async function main() {
  const scraper = new WorthpointScraper();
  
  try {
    await scraper.initialize();
    const credentials = await getCredentials();
    
    // Login using environment variables
    console.log('Logging in to Worthpoint...');
    await scraper.login(credentials.username, credentials.password);

    // Scrape search results for fine art
    console.log('Starting search results scraping...');
    const searchUrl = 'https://www.worthpoint.com/inventory/search?searchForm=search&ignoreSavedPreferences=true&max=100&sort=SaleDate&_img=false&img=true&_noGreyList=false&noGreyList=true&categories=fine-art&rMin=200&saleDate=ALL_TIME';
    const searchResults = await scraper.scrapeSearchResults(searchUrl);
    
    console.log(`Found ${searchResults.length} total items`);
    console.log('\nFirst three items:');
    searchResults.slice(0, 3).forEach((item, index) => {
      console.log(`\nItem ${index + 1}:`);
      console.log('Title:', item.title);
      console.log('Price:', item.price);
      console.log('Date:', item.date);
      console.log('Source:', item.source);
      console.log('Image URL:', item.image);
      console.log('------------------------');
    });

  } catch (error) {
    console.error('Error:', error);
  } finally {
    await scraper.close();
  }
}

main();