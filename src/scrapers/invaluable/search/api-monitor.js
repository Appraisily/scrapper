const { constants } = require('../utils');

class ApiMonitor {
  constructor() {
    this.apiEndpoint = null;
    this.apiResponse = null;
    this.apiRequests = [];
    this.loadMoreResponses = [];
    this.totalItemsLoaded = 0;
  }

  setupRequestInterception(page) {
    page.on('request', this.handleRequest.bind(this));
    page.on('response', this.handleResponse.bind(this));
  }

  async handleRequest(request) {
    if (this.isApiRequest(request.url())) {
      const requestData = await this.extractRequestData(request);
      this.apiRequests.push(requestData);
      this.apiEndpoint = request.url();
      
      console.log(`API Request to ${request.url()}:`, {
        method: requestData.method,
        operation: requestData.operation,
        variables: requestData.variables,
        queryParams: requestData.queryParams
      });
    }
    request.continue();
  }

  async handleResponse(response) {
    if (this.isApiRequest(response.url())) {
      try {
        const responseData = await this.extractResponseData(response);
        
        if (response.url().includes('load-more')) {
          this.loadMoreResponses.push(responseData);
          if (responseData.body.items) {
            this.totalItemsLoaded += responseData.body.items.length;
          }
        } else {
          this.apiResponse = responseData.body;
        }
        
        this.logResponseStats(response.url(), responseData.body);
      } catch (error) {
        console.error('Error handling API response:', error);
      }
    }
  }

  isApiRequest(url) {
    return url.includes('/api/search') || 
           url.includes('/api/lots') ||
           url.includes('/api/load-more') ||
           url.includes('/graphql');
  }

  async extractRequestData(request) {
    const requestData = {
      url: request.url(),
      method: request.method(),
      headers: request.headers(),
      timestamp: new Date().toISOString(),
      queryParams: new URL(request.url()).searchParams.toString()
    };

    try {
      if (request.postData()) {
        requestData.postData = JSON.parse(request.postData());
        requestData.operation = requestData.postData?.operationName || null;
        requestData.variables = requestData.postData?.variables || null;
      }
    } catch (error) {
      console.error('Error parsing request post data:', error);
    }

    return requestData;
  }

  async extractResponseData(response) {
    return {
      url: response.url(),
      status: response.status(),
      headers: response.headers(),
      timestamp: new Date().toISOString(),
      requestUrl: response.request().url(),
      requestHeaders: response.request().headers(),
      body: await response.json()
    };
  }

  logResponseStats(url, data) {
    console.log(`API Response from ${url}:`, {
      status: 200,
      itemCount: data.items?.length || 0,
      totalCount: data.totalCount || data.total || 0,
      hasMore: data.hasMore || false,
      pagination: data.pagination || null
    });
  }

  getStats() {
    return {
      totalRequests: this.apiRequests.length,
      uniqueEndpoints: [...new Set(this.apiRequests.map(r => r.url))],
      totalItemsLoaded: this.totalItemsLoaded,
      loadMoreBatches: this.loadMoreResponses.length,
      requestMethods: [...new Set(this.apiRequests.map(r => r.method))]
    };
  }

  getData() {
    return {
      apiEndpoint: this.apiEndpoint,
      apiResponse: this.apiResponse,
      apiRequests: this.apiRequests,
      loadMoreResponses: this.loadMoreResponses,
      stats: this.getStats()
    };
  }
}

module.exports = ApiMonitor;