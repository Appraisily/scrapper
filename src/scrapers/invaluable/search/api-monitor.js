const { constants } = require('../utils');

class ApiMonitor {
  constructor() {
    this.responses = [];
    this.seenResponses = new Set();
    this.firstResponseCaptured = false;
  }

  setupRequestInterception(page) {
    console.log('Setting up request interception');
    
    page.on('request', request => {
      try {
        const url = request.url();
        if (url.includes('/catResults')) {
          console.log('  • Intercepting API request:', url);
          
          // Add required headers for the catResults API
          const headers = {
            'accept': 'application/json, text/plain, */*',
            'accept-language': 'en-US,en;q=0.9',
            'content-type': 'application/json',
            'sec-ch-ua': '"Not A(Brand";v="8", "Chromium";v="132", "Google Chrome";v="132"',
            'sec-ch-ua-mobile': '?0',
            'sec-ch-ua-platform': '"Windows"',
            'sec-fetch-dest': 'empty',
            'sec-fetch-mode': 'cors',
            'sec-fetch-site': 'same-origin'
          };

          request.continue({
            headers,
            method: 'POST',
            postData: JSON.stringify({
              requests: [{
                indexName: 'archive_prod',
                params: {
                  attributesToRetrieve: [
                    'watched', 'dateTimeUTCUnix', 'currencyCode', 'dateTimeLocal',
                    'lotTitle', 'lotNumber', 'lotRef', 'photoPath', 'houseName',
                    'currencySymbol', 'currencyCode', 'priceResult', 'saleType'
                  ],
                  clickAnalytics: true,
                  facets: [
                    'hasImage', 'supercategoryName', 'artistName', 'dateTimeUTCUnix',
                    'houseName', 'countryName', 'currencyCode', 'priceResult'
                  ],
                  filters: 'banned:false AND dateTimeUTCUnix<' + Math.floor(Date.now() / 1000) + ' AND onlineOnly:false AND channelIDs:1 AND closed:true',
                  highlightPostTag: '</ais-highlight-0000000000>',
                  highlightPreTag: '<ais-highlight-0000000000>',
                  hitsPerPage: 96,
                  maxValuesPerFacet: 50,
                  numericFilters: ['priceResult>=250'],
                  page: 0,
                  query: request.url().includes('query=') ? 
                    decodeURIComponent(request.url().split('query=')[1].split('&')[0]) : '',
                  ruleContexts: '',
                  tagFilters: ''
                }
              }]
            })
          });
        } else {
          request.continue();
        }
      } catch (error) {
        if (!error.message.includes('Request is already handled')) {
          console.error('Error intercepting request:', error);
        }
        request.continue();
      }
    });

    page.on('response', async (response) => {
      try {
        const url = response.url();
        if (url.includes('/catResults') && response.status() === 200) {
          console.log('  • Received API response:', url);
          response.text().then(responseData => {
            if (responseData.length < 1000) {
              console.log('    - Skipping small response:', responseData.length, 'bytes');
              return;
            }
            
            const responseHash = this.hashResponse(responseData);

            if (this.seenResponses.has(responseHash)) {
              console.log('    - Duplicate response detected');
              return;
            }

            this.seenResponses.add(responseHash);
            console.log('    - New unique response:', (responseData.length / 1024).toFixed(2), 'KB');
            
            if (!this.firstResponseCaptured) {
              try {
                // Parse and validate the response
                const parsedResponse = JSON.parse(responseData);
                if (parsedResponse && parsedResponse.results) {
                  this.responses.push(responseData);
                  console.log('    - Response validated and saved');
                } else {
                  console.log('    - Invalid response format');
                }
              } catch (parseError) {
                console.error('    - Error parsing response:', parseError.message);
              }
              console.log('    - Saved as first response');
              this.firstResponseCaptured = true;
            }
          }).catch(error => {
            console.error('    - Error reading response:', error.message);
          });
        }
      } catch (error) {
        if (!error.message.includes('Target closed')) {
          console.error('    - Error handling response:', error.message);
        }
      }
    });
  }
  
  hasFirstResponse() {
    return this.responses.length > 0;
  }

  getData() {
    return {
      responses: this.responses
    };
  }
}

module.exports = ApiMonitor;