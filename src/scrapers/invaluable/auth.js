const { selectors, constants } = require('./utils');

class AuthManager {
  constructor(browserManager) {
    this.browserManager = browserManager;
    this.isLoggedIn = false;
  }

  async login(email, password) {
    try {
      const page = this.browserManager.getPage();
      
      if (this.isLoggedIn) {
        console.log('Already logged in, skipping login process');
        return true;
      }

      console.log('Navigating to login page');
      await page.goto('https://www.invaluable.com/login', { 
        waitUntil: ['networkidle0', 'domcontentloaded'],
        timeout: constants.navigationTimeout
      });

      // Handle cookie consent if present
      try {
        const cookieConsentFrame = await page.$('iframe[id^="CybotCookiebotDialog"]');
        if (cookieConsentFrame) {
          const frame = await cookieConsentFrame.contentFrame();
          await frame.click('#CybotCookiebotDialogBodyButtonAccept');
        }
      } catch (error) {
        console.log('No cookie consent dialog found or already accepted');
      }

      // Wait for login form elements
      await page.waitForFunction(() => {
        const form = document.querySelector('#login-form');
        if (!form || window.getComputedStyle(form).display === 'none') return false;
        
        const emailInput = form.querySelector('input[name="emailLogin"]');
        const passwordInput = form.querySelector('input[name="password"]');
        const submitButton = form.querySelector('#signInBtn');
        
        return emailInput && passwordInput && submitButton &&
               window.getComputedStyle(emailInput).display !== 'none' &&
               window.getComputedStyle(submitButton).display !== 'none';
      }, { timeout: constants.defaultTimeout });

      // Clear existing form values
      await page.evaluate(() => {
        const form = document.querySelector('#login-form');
        const emailInput = form.querySelector('input[name="emailLogin"]');
        const passwordInput = form.querySelector('input[name="password"]');
        if (emailInput) emailInput.value = '';
        if (passwordInput) passwordInput.value = '';
      });

      // Type credentials with human-like delays
      await page.type('input[name="emailLogin"]', email, { delay: 150 });
      await page.evaluate(() => new Promise(r => setTimeout(r, 500)));
      await page.type('input[name="password"]', password, { delay: 150 });
      await page.evaluate(() => new Promise(r => setTimeout(r, 1000)));

      // Submit form
      const form = await page.$('#login-form');
      const submitButton = await form.$('#signInBtn');
      
      if (!submitButton) {
        throw new Error('Login submit button not found');
      }

      try {
        await Promise.all([
          page.waitForNavigation({
            waitUntil: ['domcontentloaded', 'networkidle0'],
            timeout: constants.defaultTimeout
          }),
          form.evaluate(form => form.submit())
        ]);
      } catch (error) {
        console.log('Navigation error:', error.message);
        
        // Try clicking the button as fallback
        await submitButton.click();
        await page.waitForNavigation({
          waitUntil: ['domcontentloaded', 'networkidle0'],
          timeout: constants.defaultTimeout
        });
      }

      // Verify login success
      const isLoggedIn = await page.evaluate(() => {
        return !document.querySelector('.error-message') && 
               !document.querySelector('#loginError') &&
               (document.querySelector('.account-menu') !== null ||
                document.querySelector('.user-profile') !== null ||
                document.querySelector('.logout-link') !== null);
      });

      if (!isLoggedIn) {
        const errorMessage = await page.evaluate(() => {
          const errorEl = document.querySelector('.error-message, #loginError, .alert-danger');
          return errorEl ? errorEl.textContent.trim() : 'Login verification failed';
        });
        throw new Error(errorMessage);
      }
      
      this.isLoggedIn = true;
      return true;

    } catch (error) {
      console.error('Error during login process:', error.message);
      throw error;
    }
  }

  async injectCookies(cookies) {
    const page = this.browserManager.getPage();
    await page.setCookie(...cookies);
  }
}

module.exports = AuthManager;