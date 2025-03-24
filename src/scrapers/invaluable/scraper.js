const BrowserManager = require('./browser');
const { constructSearchUrl } = require('./url-builder');
const { formatCookies, extractMetadata } = require('./utils');
const { handleSearch } = require('./search-handler');
const { handlePagination } = require('./pagination-handler');

class InvaluableScraper {
  constructor() {
    this.browser = new BrowserManager();
    this.initialized = false;
    this.config = {
      NAVIGATION_TIMEOUT: 30000,
      DEFAULT_HITS_PER_PAGE: 96
    };
  }

  async initialize() {
    if (this.initialized) {
      console.log('Scraper ya inicializado');
      return;
    }

    try {
      console.log('Inicializando navegador...');
      await this.browser.initialize();
      this.initialized = true;
      console.log('Navegador inicializado correctamente');
    } catch (error) {
      console.error('Error al inicializar el navegador:', error);
      throw error;
    }
  }

  async close() {
    if (this.initialized) {
      try {
        await this.browser.close();
        this.initialized = false;
        console.log('Navegador cerrado correctamente');
      } catch (error) {
        console.error('Error al cerrar el navegador:', error);
        throw error;
      }
    }
  }

  async search(params = {}, cookies = []) {
    if (!this.initialized) {
      throw new Error('Scraper no inicializado. Llame a initialize() primero');
    }

    try {
      console.log('Iniciando búsqueda en Invaluable');
      const url = constructSearchUrl(params);
      return await handleSearch(this.browser, url, params, cookies, this.config);
    } catch (error) {
      console.error('Error de búsqueda:', error);
      throw error;
    }
  }

  async searchAllPages(params = {}, cookies = [], maxPages = 10) {
    if (!this.initialized) {
      throw new Error('Scraper no inicializado. Llame a initialize() primero');
    }

    try {
      console.log('Iniciando búsqueda paginada para todos los resultados');
      
      // Obtener primera página
      const firstPageParams = { ...params, page: 1 };
      const firstPageResults = await this.search(firstPageParams, cookies);
      
      // Si no hay resultados válidos, terminar
      if (!firstPageResults || !firstPageResults.results || !firstPageResults.results[0] || !firstPageResults.results[0].hits) {
        console.log('No se encontraron resultados válidos en la primera página, finalizando la paginación');
        return firstPageResults;
      }
      
      // Procesar paginación completa
      return await handlePagination(
        this.browser,
        params,
        firstPageResults,
        cookies,
        maxPages,
        this.config
      );
      
    } catch (error) {
      console.error('Error durante la búsqueda paginada:', error);
      throw error;
    }
  }
}

module.exports = InvaluableScraper; 