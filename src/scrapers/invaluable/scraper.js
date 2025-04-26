const BrowserManager = require('./browser');
const { constructSearchUrl } = require('./url-builder');
const { formatCookies, extractMetadata } = require('./utils');
const { handleSearch } = require('./search-handler');
const { handlePagination } = require('./pagination/index');

class InvaluableScraper {
  constructor(options = {}) {
    this.keyword = options.keyword || 'global';
    this.browser = BrowserManager.getInstance(this.keyword);
    this.initialized = false;
    this.config = {
      NAVIGATION_TIMEOUT: 30000,
      DEFAULT_HITS_PER_PAGE: 96
    };
  }

  async initialize() {
    if (this.initialized) {
      console.log(`Scraper for keyword "${this.keyword}" already initialized`);
      return;
    }

    try {
      console.log(`Initializing browser for keyword "${this.keyword}"...`);
      await this.browser.initialize();
      this.initialized = true;
      console.log(`Browser for keyword "${this.keyword}" initialized successfully`);
    } catch (error) {
      console.error(`Error initializing browser for keyword "${this.keyword}":`, error);
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

  async searchAllPages(params = {}, cookies = [], maxPages = 999) { // Increased default max pages
    if (!this.initialized) {
      throw new Error('Scraper no inicializado. Llame a initialize() primero');
    }

    try {
      console.log('Iniciando búsqueda paginada para todos los resultados');
      console.log('Parámetros de búsqueda paginada:', {
        query: params.query,
        saveImages: params.saveImages,
        bucket: params.bucket,
        maxPages
      });
      
      // Obtener primera página
      const firstPageParams = { ...params, page: 1 };
      let firstPageResults = await this.search(firstPageParams, cookies);
      
      // Si no hay resultados válidos, terminar
      if (!firstPageResults || !firstPageResults.results || !firstPageResults.results[0] || !firstPageResults.results[0].hits) {
        console.log('No se encontraron resultados válidos en la primera página, finalizando la paginación');
        return firstPageResults;
      }
      
      // Configuración adicional para la paginación
      const paginationConfig = {
        ...this.config,
        // Pasar parámetros de imágenes
        saveImages: params.saveImages
      };
      
      // Procesar paginación completa
      let result = await handlePagination(
        this.browser,
        params,
        firstPageResults,
        cookies,
        maxPages,
        paginationConfig
      );
      
      // Check if we need to restart pagination from a specific page
      if (result && result.restartNeeded && result.startPage) {
        console.log(`⚠️ Se detectó una página vacía. Reiniciando desde la página ${result.startPage}...`);
        
        // Close and reinitialize the browser to clear any potential session issues
        console.log('Cerrando y reinicializando el navegador para resolver posibles problemas...');
        await this.close();
        await this.initialize();
        
        // Update params to start from the indicated page
        const restartParams = { ...params, page: result.startPage };
        
        // Get fresh cookies if needed
        let newCookies = [...cookies];
        if (result.finalCookies && result.finalCookies.length > 0) {
          console.log('Usando cookies actualizadas del intento anterior');
          newCookies = result.finalCookies;
        }
        
        // Keep results accumulated so far
        let accumulatedResults = null;
        if (result.currentResults && result.currentResults.results && 
            result.currentResults.results[0] && result.currentResults.results[0].hits) {
          accumulatedResults = result.currentResults;
          console.log(`Conservando ${result.currentResults.results[0].hits.length} resultados acumulados hasta ahora`);
        }
        
        // Make a new search request starting from the restart page
        console.log(`Realizando nueva búsqueda comenzando desde la página ${result.startPage}...`);
        const restartPageResults = await this.search(restartParams, newCookies);
        
        // If we got valid results, continue pagination from there
        if (restartPageResults && restartPageResults.results && 
            restartPageResults.results[0] && restartPageResults.results[0].hits) {
          
          console.log(`Obtenidos ${restartPageResults.results[0].hits.length} resultados en página de reinicio`);
          
          // Merge with accumulated results if available
          if (accumulatedResults) {
            console.log('Fusionando con resultados previos...');
            // Add unique items from restart page results to the accumulated results
            const currentIds = new Set();
            accumulatedResults.results[0].hits.forEach(item => {
              const itemId = item.lotId || item.id || JSON.stringify(item);
              currentIds.add(itemId);
            });
            
            // Add only new items
            let newItems = 0;
            restartPageResults.results[0].hits.forEach(item => {
              const itemId = item.lotId || item.id || JSON.stringify(item);
              if (!currentIds.has(itemId)) {
                accumulatedResults.results[0].hits.push(item);
                newItems++;
              }
            });
            
            console.log(`Añadidos ${newItems} nuevos elementos de la página de reinicio`);
            
            // Continue pagination from the next page
            const nextStartPage = result.startPage + 1;
            console.log(`Continuando paginación desde la página ${nextStartPage}...`);
            
            // Process remaining pages
            result = await handlePagination(
              this.browser,
              { ...params, page: nextStartPage },
              accumulatedResults,
              newCookies,
              maxPages,
              paginationConfig
            );
            
            // If we get another restart signal, don't recurse more than once
            if (result && result.restartNeeded) {
              console.log('⚠️ Se detectó otra señal de reinicio después del primer reinicio. Finalizando para evitar bucles.');
              return result.currentResults || accumulatedResults;
            }
            
            return result;
          } else {
            // No accumulated results - just continue pagination from the restart page results
            console.log('Continuando paginación con resultados de reinicio...');
            
            // Process remaining pages
            result = await handlePagination(
              this.browser,
              { ...params, page: result.startPage + 1 },
              restartPageResults,
              newCookies,
              maxPages,
              paginationConfig
            );
            
            // If we get another restart signal, don't recurse more than once
            if (result && result.restartNeeded) {
              console.log('⚠️ Se detectó otra señal de reinicio después del primer reinicio. Finalizando para evitar bucles.');
              return result.currentResults || restartPageResults;
            }
            
            return result;
          }
        } else {
          console.log('No se obtuvieron resultados válidos en la página de reinicio, retornando resultados acumulados hasta ahora');
          return accumulatedResults || result.currentResults || firstPageResults;
        }
      }
      
      return result;
    } catch (error) {
      console.error('Error durante la búsqueda paginada:', error);
      throw error;
    }
  }
}

module.exports = InvaluableScraper; 