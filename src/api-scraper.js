const axios = require('axios');

class WorthpointApiScraper {
  constructor() {
    this.axios = axios.create({
      baseURL: 'https://www.worthpoint.com',
      withCredentials: true,
      headers: {
        'Accept': 'application/json',
        'Accept-Language': 'en-US,en;q=0.9',
        'Cache-Control': 'no-cache',
        'Connection': 'keep-alive',
        'DNT': '1',
        'Pragma': 'no-cache',
        'Sec-Fetch-Dest': 'empty',
        'Sec-Fetch-Mode': 'cors',
        'Sec-Fetch-Site': 'same-origin',
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'sec-ch-ua': '"Not_A Brand";v="8", "Chromium";v="120", "Google Chrome";v="120"',
        'sec-ch-ua-mobile': '?0',
        'sec-ch-ua-platform': '"Windows"'
      }
    });
    this.cookies = null;
    this.csrfToken = null;
  }

  async login(username, password) {
    try {
      console.log('Getting initial page to collect cookies...');
      const loginPageResponse = await this.axios.get('/', {
        maxRedirects: 5,
        validateStatus: status => status < 500
      });
      
      this.cookies = loginPageResponse.headers['set-cookie'] || [];
      
      // Check if we got a CAPTCHA challenge
      if (loginPageResponse.data.includes('Please verify you are a human')) {
        console.error('CAPTCHA challenge detected');
        throw new Error('CAPTCHA verification required');
      }
      
      // Get CSRF token
      console.log('Getting CSRF token...');
      const csrfResponse = await this.axios.get('/app/login/auth', {
        headers: {
          'Cookie': this.cookies.join('; '),
          'Referer': 'https://www.worthpoint.com/'
        }
      });
      
      const csrfMatch = csrfResponse.data.match(/<input[^>]*name="_csrf"[^>]*value="([^"]*)"[^>]*>/);
      if (!csrfMatch) {
        console.error('CSRF token not found in response');
        throw new Error('Could not find CSRF token');
      }
      this.csrfToken = csrfMatch[1];

      // Perform login
      const loginResponse = await this.axios.post('/app/login/auth', {
        j_username: username,
        j_password: password,
        _spring_security_remember_me: true,
        _csrf: this.csrfToken
      }, {
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
          'Cookie': this.cookies.join('; '),
          'Origin': 'https://www.worthpoint.com',
          'Referer': 'https://www.worthpoint.com/app/login/auth'
        }
      });

      // Check if login was successful by looking for redirect
      if (loginResponse.status === 302 || loginResponse.headers.location) {
        this.cookies = loginResponse.headers['set-cookie'] || this.cookies;
        return true;
      }

      throw new Error('Login failed');
    } catch (error) {
      console.error('Login error:', error.message);
      
      // Log detailed error information
      if (error.response) {
        console.error('Response status:', error.response.status);
        console.error('Response headers:', error.response.headers);
        if (typeof error.response.data === 'string' && error.response.data.includes('Please verify you are a human')) {
          console.error('CAPTCHA challenge detected in error response');
          throw new Error('CAPTCHA verification required');
        }
      }
      
      if (error.response?.status === 403) {
        console.error('Login forbidden - possible CSRF or security issue');
        // Log the actual response content for debugging
        if (error.response.data) {
          console.error('Response content:', 
            typeof error.response.data === 'string' 
              ? error.response.data.substring(0, 1000) 
              : JSON.stringify(error.response.data).substring(0, 1000)
          );
        }
      }
      throw error;
    }
  }

  async getCSRFToken() {
    try {
      const response = await this.axios.get('/app/login/auth');
      const html = response.data;
      
      // Extract CSRF token from the HTML
      const match = html.match(/<input[^>]*name="_csrf"[^>]*value="([^"]*)"[^>]*>/);
      if (match && match[1]) {
        return match[1];
      }
      
      throw new Error('CSRF token not found');
    } catch (error) {
      console.error('Error getting CSRF token:', error.message);
      throw error;
    }
  }

  async searchItems(params = {}) {
    try {
      if (!this.cookies) {
        throw new Error('Not logged in');
      }

      const defaultParams = {
        searchForm: 'search',
        ignoreSavedPreferences: true,
        max: 100,
        sort: 'SaleDate',
        img: true,
        noGreyList: true,
        categories: 'fine-art',
        rMin: 200,
        saleDate: 'ALL_TIME'
      };

      const searchParams = { ...defaultParams, ...params };
      const response = await this.axios.get('/api/v1/inventory/search', {
        params: searchParams,
        headers: { 
          'Cookie': this.cookies.join('; '),
          'X-Requested-With': 'XMLHttpRequest'
        }
      });

      return this.processSearchResults(response.data);
    } catch (error) {
      console.error('Search error:', error.message, error.response?.data);
      throw error;
    }
  }

  async getPriceDistribution(params = {}) {
    try {
      const response = await this.axios.get('/api/v1/inventory/price/distribution', {
        params: {
          'f.category': params.category || '9',
          'f.query': params.query || '',
          'f.restrictTo': params.restrictTo || '',
          'f.saleDate': params.saleDate || 'ALL_TIME',
          'f.img': params.img || true
        },
        headers: { 
          'X-Requested-With': 'XMLHttpRequest',
          'Cookie': this.cookies.join('; ')
        }
      });

      return response.data;
    } catch (error) {
      console.error('Price distribution error:', error.message);
      throw error;
    }
  }

  processSearchResults(data) {
    if (!data || !data.items) {
      return [];
    }

    return data.items.map(item => ({
      title: item.title,
      price: item.price,
      date: item.saleDate,
      source: item.source,
      image: item.imageUrl,
      id: item.id,
      category: item.category,
      description: item.description
    }));
  }

  async getItemDetails(itemId) {
    try {
      const response = await this.axios.get(`/api/v1/inventory/item/${itemId}`, {
        headers: {
          'Cookie': this.cookies.join('; ')
        }
      });

      return response.data;
    } catch (error) {
      console.error('Item details error:', error.message);
      throw error;
    }
  }
}

module.exports = WorthpointApiScraper;