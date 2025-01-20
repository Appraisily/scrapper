const axios = require('axios');
const { saveHtmlToFile } = require('./utils/drive-logger');

class WorthpointApiScraper {
  constructor() {
    this.axios = axios.create({
      baseURL: 'https://www.worthpoint.com',
      withCredentials: true,
      maxRedirects: 5,
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
      console.log('[API Login] Step 1: Checking for protection...');
      
      // Add required headers for initial request
      const headers = {
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8',
        'Accept-Language': 'en-US,en;q=0.9',
        'Cache-Control': 'no-cache',
        'Connection': 'keep-alive',
        'DNT': '1',
        'Connection': 'keep-alive',
        'Pragma': 'no-cache',
        'Sec-Ch-Ua': '"Not_A Brand";v="8", "Chromium";v="120", "Google Chrome";v="120"',
        'Sec-Ch-Ua-Mobile': '?0',
        'Sec-Ch-Ua-Platform': '"Windows"',
        'Sec-Fetch-Dest': 'document',
        'Sec-Fetch-Mode': 'navigate',
        'Sec-Fetch-Site': 'none',
        'Sec-Fetch-User': '?1',
        'Upgrade-Insecure-Requests': '1',
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
      };

      const loginPageResponse = await this.axios.get('https://www.worthpoint.com/app/login/auth', {
        maxRedirects: 5,
        validateStatus: status => status < 500,
        headers
      });
      
      // Save the response HTML for debugging
      let html = loginPageResponse.data;
      saveHtmlToFile(html, 'worthpoint-api-login');
      
      // Check for protection page
      if (html.includes('Access to this page has been denied')) {
        console.log('[API Login] Protection page detected, handling challenge...');
        await this.handleProtectionChallenge();
        
        // Retry the login page request after handling protection
        console.log('[API Login] Retrying login page request...');
        const retryResponse = await this.axios.get('/app/login/auth', { headers });
        this.cookies = retryResponse.headers['set-cookie'] || [];
        html = retryResponse.data;
        saveHtmlToFile(html, 'worthpoint-api-login-retry');
      }
      
      console.log('[API Login] Step 2: Checking response status:', loginPageResponse.status);
      console.log('[API Login] Step 3: Checking response headers:', JSON.stringify(loginPageResponse.headers, null, 2));
      
      this.cookies = loginPageResponse.headers['set-cookie'] || [];
      console.log('[API Login] Step 4: Cookies received:', this.cookies.length);
      
      // Check if we got a CAPTCHA challenge
      if (html.includes('Please verify you are a human')) {
        console.error('[API Login] Step 5a: CAPTCHA challenge detected');
        throw new Error('CAPTCHA verification required');
      }
      
      console.log('[API Login] Step 5: Looking for CSRF token in HTML');
      
      // Get CSRF token
      const csrfMatch = html.match(/name="_csrf"\s+value="([^"]+)"/);
      if (!csrfMatch) {
        console.error('[API Login] Step 6a: CSRF token not found in response');
        console.log('[API Login] Step 6b: First 1000 chars of HTML:', html.substring(0, 1000));
        throw new Error('Could not find CSRF token');
      }
      this.csrfToken = csrfMatch[1];
      console.log('[API Login] Step 6: CSRF token found:', this.csrfToken);

      console.log('[API Login] Step 7: Preparing login request');
      const formData = new URLSearchParams();
      formData.append('j_username', username);
      formData.append('j_password', password);
      formData.append('_spring_security_remember_me', 'true');
      formData.append('_csrf', this.csrfToken);

      // Perform login
      console.log('[API Login] Step 8: Sending login request');
      const loginResponse = await this.axios.post('/app/login/auth', formData, {
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
          'Cookie': this.cookies.join('; '),
          'Origin': 'https://www.worthpoint.com',
          'Referer': 'https://www.worthpoint.com/app/login/auth'
        }
      });

      console.log('[API Login] Step 9: Login response status:', loginResponse.status);
      
      // Check if login was successful by looking for redirect
      if (loginResponse.status === 302 || loginResponse.headers.location) {
        this.cookies = loginResponse.headers['set-cookie'] || this.cookies;
        console.log('[API Login] Step 10: Login successful, received new cookies');
        return true;
      }

      console.log('[API Login] Step 10a: Login failed - no redirect received');
      throw new Error('Login failed');
    } catch (error) {
      console.error('[API Login] Error:', error.message);
      
      // Log detailed error information
      if (error.response) {
        console.error('[API Login] Error response status:', error.response.status);
        console.error('[API Login] Error response headers:', error.response.headers);
        
        // Save error response HTML
        if (error.response.data) {
          saveHtmlToFile(
            typeof error.response.data === 'string' 
              ? error.response.data 
              : JSON.stringify(error.response.data),
            'worthpoint-api-login-error'
          );
        }
        
        if (typeof error.response.data === 'string' && error.response.data.includes('Please verify you are a human')) {
          console.error('[API Login] CAPTCHA challenge detected in error response');
          throw new Error('CAPTCHA verification required');
        }
      }
      
      if (error.response?.status === 403) {
        console.error('[API Login] Login forbidden - possible CSRF or security issue');
        // Log the actual response content for debugging
        if (error.response.data) {
          console.error('[API Login] Response content:', 
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

  async handleProtectionChallenge() {
    try {
      console.log('[Protection] Step 1: Analyzing protection page...');

      // First request to get the challenge
      const response = await this.axios.get('/app/login/auth', {
        headers: {
          'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8',
          'Accept-Language': 'en-US,en;q=0.9',
          'Cache-Control': 'no-cache',
          'Sec-Ch-Ua': '"Not_A Brand";v="8", "Chromium";v="120", "Google Chrome";v="120"',
          'Sec-Ch-Ua-Mobile': '?0',
          'Sec-Ch-Ua-Platform': '"Windows"',
          'Sec-Fetch-Dest': 'document',
          'Sec-Fetch-Mode': 'navigate',
          'Sec-Fetch-Site': 'none',
          'Sec-Fetch-User': '?1',
          'Upgrade-Insecure-Requests': '1'
        }
      });
      
      const html = response.data;
      const cookies = response.headers['set-cookie'] || [];
      
      // Extract PX parameters
      const pxAppIdMatch = html.match(/PX([a-zA-Z0-9]+)/);
      const pxAppId = pxAppIdMatch ? pxAppIdMatch[1] : null;
      
      if (!pxAppId) {
        throw new Error('Could not find PX App ID');
      }
      
      console.log('[Protection] Step 2: Found PX App ID:', pxAppId);
      
      // Generate client-specific data
      const clientData = {
        uuid: Math.random().toString(36).substring(2),
        userAgent: this.axios.defaults.headers['User-Agent'],
        timeStamp: Date.now(),
        screenRes: '1920x1080',
        devicePixelRatio: 1,
        language: 'en-US',
        platform: 'Win32',
        touch: false
      };
      
      // Send client data
      const challengeResponse = await this.axios.post(
        `/lIUjcOwl/api/v1/collector`,
        {
          appId: pxAppId,
          tag: 'v8.0.2',
          uuid: clientData.uuid,
          cs: this.generateClientScore(clientData),
          ...clientData
        },
        {
          headers: {
            'Content-Type': 'application/json',
            'Cookie': cookies.join('; ')
          }
        }
      );
      
      console.log('[Protection] Step 3: Challenge response:', challengeResponse.status);
      
      // Store cookies for future requests
      this.cookies = challengeResponse.headers['set-cookie'] || cookies;
      
      return true;
    } catch (error) {
      console.error('[Protection] Error handling protection:', error);
      throw error;
    }
  }
  
  generateClientScore(data) {
    // Generate a client score based on provided data
    // This is a simplified version - actual implementation would be more complex
    const components = [
      data.uuid,
      data.userAgent,
      data.timeStamp,
      data.screenRes,
      data.language
    ];
    
    return components.join('').split('').reduce((acc, char) => {
      return (acc << 5) - acc + char.charCodeAt(0) >>> 0;
    }, 0).toString(16);
  }

  async getProtectionScriptUrl() {
    // Extract the protection script URL from the page
    const response = await this.axios.get('/app/login/auth');
    const html = response.data;
    const match = html.match(/src="([^"]+init\.js)"/);
    return match ? match[1] : null;
  }

  async getProtectionParams() {
    // Extract challenge parameters from the page
    const response = await this.axios.get('/app/login/auth');
    const html = response.data;
    saveHtmlToFile(html, 'worthpoint-protection-params');
    return {
      // Add extracted parameters here
    };
  }

  async solveProtectionChallenge(params) {
    // Implement protection challenge solution
    // This will need to be customized based on the actual protection mechanism
    return null;
  }
}

module.exports = WorthpointApiScraper;