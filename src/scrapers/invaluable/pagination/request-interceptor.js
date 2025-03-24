/**
 * Módulo para manejar la interceptación de solicitudes HTTP durante la paginación
 */
const { extractFromApiResponse } = require('./navigation-params');

// Constantes para URLs
const API_BASE_URL = 'https://www.invaluable.com';
const CAT_RESULTS_ENDPOINT = '/catResults';
const SESSION_INFO_ENDPOINT = '/boulder/session-info';

// Headers comunes para las solicitudes
const COMMON_HEADERS = {
  'Accept': 'application/json',
  'Accept-Language': 'en-US,en;q=0.9',
  'Origin': 'https://www.invaluable.com',
  'Referer': 'https://www.invaluable.com/search',
  'X-Requested-With': 'XMLHttpRequest',
  'Sec-Fetch-Dest': 'empty',
  'Sec-Fetch-Mode': 'cors',
  'Sec-Fetch-Site': 'same-origin',
  'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36'
};

/**
 * Configura la interceptación de solicitudes para la paginación
 * @param {Object} page - Instancia de la página
 * @param {Object} navState - Estado de navegación actual
 * @param {number} pageNum - Número de página actual
 * @param {Function} onApiResponse - Callback para manejar respuestas API
 * @returns {Promise<void>}
 */
async function setupRequestInterception(page, navState, pageNum, onApiResponse) {
  await page.setRequestInterception(true);
  
  page.on('request', async (req) => {
    const url = req.url();
    
    // Solo interceptar solicitudes a invaluable.com
    if (url.includes('invaluable.com')) {
      // Para solicitudes a la API, modificar o ajustar según sea necesario
      if (url.includes(CAT_RESULTS_ENDPOINT) || url.includes(SESSION_INFO_ENDPOINT)) {
        console.log(`📤 Solicitud interceptada a ${url}`);
        
        // Si tenemos cookies, añadirlas a la solicitud
        if (navState.cookies && navState.cookies.length > 0) {
          const headers = {
            ...req.headers(),
            'Cookie': navState.cookies.map(c => `${c.name}=${c.value}`).join('; ')
          };
          
          // Continuar con los headers modificados
          req.continue({ headers });
        } else {
          // Continuar normalmente
          req.continue();
        }
      } else if (url.includes('/dist/') || url.includes('/static/')) {
        // Bloquear recursos estáticos para mejorar rendimiento
        req.abort();
      } else {
        // Otras solicitudes a invaluable.com continúan normalmente
        req.continue();
      }
    } else {
      // Todas las solicitudes que no son a invaluable.com
      req.continue();
    }
  });
  
  // Capturar las respuestas
  page.on('response', async (response) => {
    const url = response.url();
    const status = response.status();
    const headers = response.headers();
    const contentType = headers['content-type'] || '';
    
    // Solo procesar respuestas JSON de invaluable.com
    if (url.includes('invaluable.com') && contentType.includes('application/json')) {
      try {
        const text = await response.text();
        
        // Intenta parsear la respuesta como JSON
        try {
          const json = JSON.parse(text);
          console.log(`📥 Respuesta JSON de ${url} (${status})`);
          
          // Si es una respuesta de los endpoints que nos interesan
          if (url.includes(CAT_RESULTS_ENDPOINT)) {
            console.log(`Respuesta de catResults para página ${pageNum} recibida (${status})`);
            
            if (status === 200) {
              // Extraer parámetros de navegación de la respuesta
              const extractedParams = extractFromApiResponse(json);
              
              // Actualizar el estado de navegación con los parámetros extraídos
              if (extractedParams.refId) navState.refId = extractedParams.refId;
              if (extractedParams.searchContext) navState.searchContext = extractedParams.searchContext;
              if (extractedParams.searcher) navState.searcher = extractedParams.searcher;
              
              // Llamar al callback con la respuesta JSON
              if (onApiResponse) {
                onApiResponse(json, status);
              }
            } else {
              console.error(`Error al obtener resultados (${status}): ${text}`);
            }
          } else if (url.includes(SESSION_INFO_ENDPOINT)) {
            console.log(`Respuesta de session-info para página ${pageNum} recibida (${status})`);
            
            if (status === 200) {
              // Intentar extraer refId y searchContext de la respuesta
              const extractedParams = extractFromApiResponse(json);
              
              // Actualizar el estado de navegación con los parámetros extraídos
              if (extractedParams.refId && !navState.refId) navState.refId = extractedParams.refId;
              if (extractedParams.searchContext && !navState.searchContext) navState.searchContext = extractedParams.searchContext;
            }
          }
        } catch (error) {
          console.error(`Error al parsear respuesta JSON: ${error.message}`);
        }
      } catch (err) {
        console.error(`Error al leer respuesta: ${err.message}`);
      }
    }
  });
}

/**
 * Construye los headers para una solicitud
 * @param {Array} cookies - Cookies actuales
 * @param {string} [referer='https://www.invaluable.com/search'] - URL de referencia
 * @returns {Object} - Headers para la solicitud
 */
function buildRequestHeaders(cookies, referer = 'https://www.invaluable.com/search') {
  const headers = { 
    ...COMMON_HEADERS,
    'Referer': referer
  };
  
  if (cookies && cookies.length > 0) {
    headers['Cookie'] = cookies.map(c => `${c.name}=${c.value}`).join('; ');
  }
  
  return headers;
}

/**
 * Construye el payload para una solicitud de resultados
 * @param {Object} params - Parámetros para la solicitud
 * @param {number} pageNum - Número de página
 * @param {Object} navState - Estado de navegación actual
 * @returns {Object} - Payload para la solicitud
 */
function buildResultsPayload(params, pageNum, navState) {
  // Convertir a formato basado en índice 0 (0 = primera página)
  const algoliaPage = pageNum - 1;
  
  console.log(`Construyendo payload para página ${pageNum} (índice ${algoliaPage})`);
  
  // Construir el payload en formato Algolia
  const payload = {
    requests: [{
      indexName: "archive_prod",
      params: {
        // Atributos a recuperar (todos los campos necesarios)
        attributesToRetrieve: [
          "watched",
          "dateTimeUTCUnix",
          "currencyCode",
          "dateTimeLocal",
          "lotTitle",
          "lotNumber",
          "lotRef",
          "photoPath",
          "houseName",
          "currencySymbol",
          "currencyCode",
          "priceResult",
          "saleType"
        ],
        // Analíticas y configuración de facetas
        clickAnalytics: true,
        getRankingInfo: true,
        
        // Configuración de resultados por página
        hitsPerPage: 96,
        maxValuesPerFacet: 50,
        
        // Configuración de resaltado
        highlightPostTag: "</ais-highlight-0000000000>",
        highlightPreTag: "<ais-highlight-0000000000>",
        
        // Parámetros de paginación y búsqueda
        page: algoliaPage,
        query: params.query || "",
        
        // Filtros
        filters: params.filters || "banned:false AND dateTimeUTCUnix<1740561842 AND onlineOnly:false AND channelIDs:1 AND closed:true",
        
        // Contextos y etiquetas
        ruleContexts: "",
        tagFilters: "",
        
        // Token de usuario (usar el proporcionado o un valor por defecto)
        userToken: params.userToken || navState.userToken || "9166383",
        
        // Facetas a incluir
        facets: [
          "hasImage",
          "supercategoryName",
          "artistName",
          "dateTimeUTCUnix",
          "houseName",
          "countryName",
          "currencyCode",
          "priceResult"
        ]
      }
    }]
  };
  
  // Si es página 2 o posterior, añadir facetas adicionales (como se ve en la solicitud real)
  if (pageNum > 1) {
    payload.requests[0].params.facets = [
      ...payload.requests[0].params.facets,
      "Furniture",
      "Fine Art",
      "Collectibles",
      "Decorative Art",
      "Firearms",
      "Asian Art & Antiques",
      "Dolls%2C Bears & Toys",
      "Wines & Spirits",
      "Jewelry",
      "Commercial & Industrial"
    ];
  }
  
  // Si tenemos refId de Algolia, añadirlo
  if (navState.refId) {
    // Nota: En Algolia, esto podría ir como un parámetro adicional
    // Pero basado en las solicitudes observadas, no parece usarse
    console.log(`Tenemos refId disponible: ${navState.refId}, pero no se incluye en formato Algolia`);
  } else {
    console.log(`Sin refId disponible, usando formato Algolia estándar con page=${algoliaPage}`);
  }
  
  return payload;
}

/**
 * Genera un hash consistente basado en los parámetros de consulta
 * Útil para mantener identificación consistente para la misma consulta
 * @param {Object} params - Parámetros de búsqueda
 * @returns {string} - Hash de consulta
 */
function generateQueryHash(params) {
  // Crear una cadena ordenada con los parámetros clave
  const keyParams = [
    params.query || '',
    params.keyword || '',
    params.priceResult?.min || '',
    params.priceResult?.max || '',
    params.sort || '',
    params.categories || ''
  ].join('_');
  
  // Crear un hash simple
  let hash = 0;
  for (let i = 0; i < keyParams.length; i++) {
    hash = ((hash << 5) - hash) + keyParams.charCodeAt(i);
    hash |= 0; // Convertir a entero de 32 bits
  }
  
  // Convertir a string positivo y añadir timestamp del día (para que sea consistente durante una sesión)
  const dayTimestamp = Math.floor(Date.now() / (1000 * 60 * 60 * 24));
  return `q${Math.abs(hash)}_${dayTimestamp}`;
}

module.exports = {
  API_BASE_URL,
  CAT_RESULTS_ENDPOINT,
  SESSION_INFO_ENDPOINT,
  COMMON_HEADERS,
  setupRequestInterception,
  buildRequestHeaders,
  buildResultsPayload
}; 