const axios = require('axios');

class WorthpointApiScraper {
  constructor() {
    this.axios = axios.create({
      baseURL: 'https://www.worthpoint.com',
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
  }

  async login(username, password) {
    try {
      // First get the CSRF token and session cookies
      const loginPage = await this.axios.get('/login');
      const csrfToken = this.extractCsrfToken(loginPage.data);
      this.cookies = loginPage.headers['set-cookie'];

      // Perform login
      const loginResponse = await this.axios.post('/api/v1/auth/login', {
        email: username,
        password: password,
        _csrf: csrfToken
      }, {
        headers: {
          'Content-Type': 'application/json',
          'Cookie': this.cookies.join('; ')
        }
      });

      if (loginResponse.data.success) {
        // Update cookies with session token
        this.cookies = loginResponse.headers['set-cookie'] || this.cookies;
        return true;
      }

      throw new Error('Login failed');
    } catch (error) {
      console.error('Login error:', error.message);
      throw error;
    }
  }

  extractCsrfToken(html) {
    const match = html.match(/name="_csrf" value="([^"]+)"/);
    return match ? match[1] : null;
  }

  async searchItems(params = {}) {
    try {
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
          'Cookie': this.cookies.join('; ')
        }
      });

      return this.processSearchResults(response.data);
    } catch (error) {
      console.error('Search error:', error.message);
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