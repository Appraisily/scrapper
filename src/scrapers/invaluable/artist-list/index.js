const { constants } = require('../utils');
const fetch = require('node-fetch');

class ArtistListScraper {
  constructor(browserManager, storage) {
    if (!storage) throw new Error('Storage instance is required');
    
    this.storage = storage;
    this.progressFile = 'artists/progress.json';
    this.algoliaConfig = {
      applicationId: '0HJBNDV358',
      indexName: 'artists_alpha_prod',
      url: 'https://algolia.invaluable.com/1/indexes/*/queries'
    };
  }

  async close() {
    // No browser to close
  }

  async loadProgress() {
    try {
      const { content } = await this.storage.getFile(this.progressFile);
      return JSON.parse(content);
    } catch (error) {
      // If file doesn't exist or other error, start fresh
      return {
        lastProcessedIndex: -1,
        totalSubindexes: 0,
        completedSubindexes: [],
        lastUpdate: null
      };
    }
  }

  async saveProgress(progress) {
    await this.storage.saveFile(this.progressFile, JSON.stringify(progress, null, 2));
  }

  async fetchArtistList(subindex) {
    try {
      const { url, applicationId, indexName } = this.algoliaConfig;
      console.log('🔍 Fetching from Algolia API');
      console.log(`  • Application ID: ${applicationId}`);
      console.log(`  • Index: ${indexName}`);

      const facetFilter = subindex ? 
        `alpha.lvl1:A > ${subindex}` : 
        'alpha.lvl0:A';
      console.log(`  • Filter: ${facetFilter}`);

      const requestBody = {
        requests: [{
          indexName,
          params: new URLSearchParams({
            facetFilters: `[["${facetFilter}"]]`,
            facets: '["alpha.lvl0","alpha.lvl1"]',
            hitsPerPage: '100',
            page: '0'
          }).toString()
        }]
      };
      console.log('  • Request body:', JSON.stringify(requestBody, null, 2));

      const response = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
          'x-algolia-api-key': 'NO_KEY',
          'x-algolia-application-id': applicationId
        },
        credentials: 'include',
        body: JSON.stringify(requestBody)
      });

      if (!response.ok) {
        throw new Error(`API request failed: ${response.status} ${response.statusText}`);
      }

      console.log('  • Response status:', response.status);
      const data = await response.json();
      return data;
    } catch (error) {
      console.error('Error fetching from Algolia API:', error);
      throw error;
    }
  }

  async extractArtistList() {
    try {
      console.log('🔄 Starting A section artist list extraction');
      console.log('📊 Loading progress data');
      const progress = await this.loadProgress();

      // First, get all subindexes
      console.log('📑 Fetching subindexes');
      const { results } = await this.fetchArtistList();
      const subindexes = results[1].facets['alpha.lvl1'];
      const subindexList = Object.keys(subindexes)
        .filter(key => key.startsWith('A > A'))
        .map(key => key.split(' > ')[1]);

      // Update progress with total subindexes if needed
      if (progress.totalSubindexes === 0) {
        progress.totalSubindexes = subindexList.length;
      }

      // Determine next subindex to process
      const nextIndex = progress.lastProcessedIndex + 1;
      if (nextIndex >= subindexList.length) {
        return {
          success: true,
          message: 'All subindexes have been processed',
          progress: {
            completed: progress.completedSubindexes.length,
            total: subindexList.length,
            percentage: 100
          }
        };
      }

      const subindexToProcess = subindexList[nextIndex];
      console.log(`🎯 Processing subindex ${nextIndex + 1}/${subindexList.length}: ${subindexToProcess}`);

      // Fetch artists for this subindex
      const { results: [artistResults] } = await this.fetchArtistList(subindexToProcess);
      const artists = artistResults.hits.map(hit => ({
        name: `${hit.firstName} ${hit.lastName}`.trim(),
        count: hit.totalCount,
        url: `https://www.invaluable.com/artist/${hit.artistRef}`,
        subindex: subindexToProcess
      }));

      // Update progress
      progress.lastProcessedIndex = nextIndex;
      progress.completedSubindexes.push(subindexToProcess);
      progress.lastUpdate = new Date().toISOString();
      await this.saveProgress(progress);

      // Save the API response
      const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
      const filename = `artists/api/${subindexToProcess.toLowerCase()}-${timestamp}.json`;
      await this.storage.saveJsonFile(filename, artistResults);

      return {
        success: true,
        artists,
        timestamp: new Date().toISOString(),
        source: 'invaluable',
        section: 'A',
        currentSubindex: subindexToProcess,
        progress: {
          completed: progress.completedSubindexes.length,
          total: subindexList.length,
          percentage: Math.round((progress.completedSubindexes.length / subindexList.length) * 100)
        },
        totalFound: artists.length
      };

    } catch (error) {
      console.error('Error getting artist list:', error);
      throw error;
    }
  }
}

module.exports = ArtistListScraper;