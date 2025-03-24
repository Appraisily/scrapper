/**
 * Utilidades para el scraper de Invaluable
 */

/**
 * Valida y formatea las cookies para que estén listas para usar
 * @param {Array|string} cookies - Cookies en formato array u objeto JSON
 * @param {Object} params - Parámetros que pueden contener valores por defecto
 * @returns {Array} Cookies formateadas
 */
function formatCookies(cookies, params = {}) {
  let formattedCookies = [];
  
  // Validar y formatear las cookies
  if (cookies && Array.isArray(cookies)) {
    // Usar las cookies proporcionadas si son un array válido
    formattedCookies = cookies.filter(c => c && c.name && c.value);
    console.log(`Usando ${formattedCookies.length} cookies proporcionadas`);
  } else if (cookies && typeof cookies === 'string') {
    // Intentar parsear si es una cadena JSON
    try {
      const parsedCookies = JSON.parse(cookies);
      if (Array.isArray(parsedCookies)) {
        formattedCookies = parsedCookies.filter(c => c && c.name && c.value);
      }
      console.log(`Parseadas ${formattedCookies.length} cookies desde string`);
    } catch (e) {
      console.warn('Error al parsear string de cookies:', e.message);
    }
  }
  
  // Asegurarse de que tenemos las cookies críticas
  const hasCfClearance = formattedCookies.some(c => c.name === 'cf_clearance');
  const hasAZToken = formattedCookies.some(c => c.name === 'AZTOKEN-PROD');
  
  if (!hasCfClearance || !hasAZToken) {
    console.warn('Faltan cookies críticas. Usando valores predeterminados.');
    // Añadir cookies predeterminadas si faltan
    if (!hasCfClearance) {
      formattedCookies.push({
        name: 'cf_clearance',
        value: params.cf_clearance || 'Yq4QHU.y14z93vU3CmLCK80CU7Pq6pgupmW0eM8k548-1738320515-1.2.1.1-ZFXBFgIPHghfvwwfhRbZx27.6zPihqfQ4vGP0VY1v66mKc.wwAOVRiRJhK6ouVt_.wMB30bkeY0r9NK.KUTU4gu7GzZxbyh0EH_gE36kcnHDvGATrI_vFs9y1XHq3PgtlHmBUflqgjcS6x9MC5YpXoeELPYiT0k59IPMn..1cHED7zV6T78hILKinjM6hZ.ZeQwetIN6SPmuvXb7V2z2ddJa64Vg_zUi.euce0SjjJr5ti7tHWoFsTV1DO1MkFwDfUpy1yTCdESho.EwyRgfdfRAlx6njkTmlWNkp1aXcXU',
        domain: '.invaluable.com',
        path: '/'
      });
    }
    if (!hasAZToken) {
      formattedCookies.push({
        name: 'AZTOKEN-PROD',
        value: params.aztoken || '60E0351A-C64E-4D9F-AA6C-5967BBBF859B',
        domain: '.invaluable.com',
        path: '/'
      });
    }
  }
  
  // Sanitizar las cookies para evitar problemas con partitionKey y otras propiedades problemáticas
  return formattedCookies.map(cookie => {
    // Crear una nueva cookie con solo las propiedades necesarias
    return {
      name: cookie.name,
      value: cookie.value,
      domain: cookie.domain || '.invaluable.com',
      path: cookie.path || '/',
      expires: cookie.expires || -1,
      httpOnly: !!cookie.httpOnly,
      secure: !!cookie.secure,
      session: !!cookie.session
    };
  });
}

/**
 * Extrae metadatos de los resultados de búsqueda para calcular totales
 * @param {Object} results - Resultados de la búsqueda
 * @param {number} maxPages - Número máximo de páginas a recuperar
 * @param {number} defaultHitsPerPage - Número predeterminado de resultados por página
 * @returns {Object} Metadatos extraídos incluyendo totalHits y totalPages
 */
function extractMetadata(results, maxPages = 10, defaultHitsPerPage = 96) {
  let totalHits = null;
  let hitsPerPage = defaultHitsPerPage;
  
  // Intentar extraer totalHits de diferentes lugares posibles
  if (results.results && results.results[0]) {
    if (results.results[0].meta && results.results[0].meta.totalHits) {
      totalHits = results.results[0].meta.totalHits;
      console.log(`Total de hits desde meta: ${totalHits}`);
    } else if (results.results[0].nbHits) {
      totalHits = results.results[0].nbHits;
      console.log(`Total de hits desde nbHits: ${totalHits}`);
    }
    
    // Intentar extraer hitsPerPage
    if (results.results[0].hitsPerPage) {
      hitsPerPage = results.results[0].hitsPerPage;
    }
  } else if (results.nbHits) {
    totalHits = results.nbHits;
    console.log(`Total de hits desde raíz nbHits: ${totalHits}`);
  }
  
  // Calcular el número total de páginas
  let totalPages = 1;
  if (totalHits) {
    totalPages = Math.ceil(totalHits / hitsPerPage);
    console.log(`Total de hits reportados: ${totalHits}, total estimado de páginas: ${totalPages}`);
    totalPages = Math.min(totalPages, maxPages);
    console.log(`Limitando a ${totalPages} páginas según configuración maxPages: ${maxPages}`);
  } else {
    console.log('No se encontraron metadatos de totalHits, usando maxPages como límite');
    totalPages = maxPages;
  }
  
  return {
    totalHits,
    totalPages,
    hitsPerPage
  };
}

/**
 * Genera una espera aleatoria para simular comportamiento humano
 * @param {number} min - Tiempo mínimo en ms
 * @param {number} max - Tiempo máximo en ms
 * @returns {Promise} Promesa que se resuelve después del tiempo aleatorio
 */
function randomWait(min = 1000, max = 3000) {
  const waitTime = min + Math.floor(Math.random() * (max - min));
  console.log(`Esperando ${waitTime}ms...`);
  return new Promise(resolve => setTimeout(resolve, waitTime));
}

/**
 * Comprueba si hay cambios en las cookies y registra información relevante
 * @param {Array} oldCookies - Estado anterior de cookies
 * @param {Array} newCookies - Estado nuevo de cookies
 * @returns {boolean} True si hubo cambios en las cookies
 */
function detectCookieChanges(oldCookies, newCookies) {
  const hasCookiesChanged = JSON.stringify(oldCookies) !== JSON.stringify(newCookies);
  
  if (hasCookiesChanged) {
    console.log('Las cookies han sido actualizadas');
    
    // Identificar las cookies críticas actualizadas
    const newCfClearance = newCookies.find(c => c.name === 'cf_clearance');
    if (newCfClearance) {
      console.log('Nueva cookie cf_clearance encontrada');
    }
    
    const newAZToken = newCookies.find(c => c.name === 'AZTOKEN-PROD');
    if (newAZToken) {
      console.log('Nueva cookie AZTOKEN-PROD encontrada');
    }
  } else {
    console.log('No se detectaron cambios en las cookies');
  }
  
  return hasCookiesChanged;
}

// Exportamos las funciones de utilidad
module.exports = {
  formatCookies,
  extractMetadata,
  randomWait,
  detectCookieChanges,
  
  // Reexportamos funciones existentes si las hay
  ...require('./utils')
};

exports.selectors = {
  loginForm: '#login-form',
  emailInput: 'input[name="emailLogin"]',
  passwordInput: 'input[name="password"]',
  submitButton: '#signInBtn',
  cookieConsent: 'iframe[id^="CybotCookiebotDialog"]',
  cookieAccept: '#CybotCookiebotDialogBodyButtonAccept',
  searchResults: '.lot-search-result',
  loadingIndicator: '.loading-indicator',
  protectionPage: '[id^="px-captcha"], .px-block'
};

exports.constants = {
  defaultTimeout: 30000,
  navigationTimeout: 60000,
  typingDelay: 150,
  scrollDelay: 100,
  scrollDistance: 100
};

exports.browserConfig = {
  args: [
    '--no-sandbox',
    '--disable-dev-shm-usage',
    '--disable-setuid-sandbox',
    '--disable-infobars',
    '--window-position=0,0',
    '--ignore-certifcate-errors',
    '--ignore-certifcate-errors-spki-list',
    '--font-render-hinting=medium',
    '--enable-features=NetworkService',
    '--disable-web-security',
    '--disable-features=IsolateOrigins,site-per-process',
    '--allow-running-insecure-content',
    '--disable-notifications',
    '--disable-popup-blocking'
  ],
  userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/121.0.0.0 Safari/537.36',
  headers: {
    'Accept-Language': 'en-US,en;q=0.9',
    'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,image/apng,*/*;q=0.8,application/signed-exchange;v=b3;q=0.7',
    'Cache-Control': 'no-cache',
    'Connection': 'keep-alive',
    'DNT': '1',
    'Pragma': 'no-cache',
    'Sec-Ch-Ua': '"Not A(Brand";v="99", "Google Chrome";v="121", "Chromium";v="121"',
    'Sec-Ch-Ua-Mobile': '?0',
    'Sec-Ch-Ua-Platform': '"Windows"',
    'Sec-Fetch-Dest': 'document',
    'Sec-Fetch-Mode': 'navigate',
    'Sec-Fetch-Site': 'none',
    'Sec-Fetch-User': '?1',
    'Upgrade-Insecure-Requests': '1'
  }
};