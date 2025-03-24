/**
 * Módulo para extraer y gestionar parámetros de navegación para la paginación
 */

/**
 * Inspecciona un objeto para mostrar su estructura y valores clave
 * @param {Object} obj - Objeto a inspeccionar
 * @param {string} path - Ruta actual para el logging
 * @param {Array} foundKeys - Array para almacenar las claves encontradas
 * @returns {Array} - Información sobre claves importantes encontradas
 */
function inspectResponse(obj, path = '', foundKeys = []) {
  if (!obj || typeof obj !== 'object') return foundKeys;
  
  // Claves importantes que estamos buscando
  const importantKeys = ['refId', 'searchContext', 'searcher', 'session', 'pagination', 'searcherInfo'];

  Object.keys(obj).forEach(key => {
    const currentPath = path ? `${path}.${key}` : key;
    
    if (importantKeys.includes(key)) {
      const value = typeof obj[key] === 'object' 
        ? JSON.stringify(obj[key]).substring(0, 100) + '...' 
        : obj[key];
      foundKeys.push({ key, path: currentPath, value });
    }
    
    // Recursivamente inspeccionar objetos anidados
    if (obj[key] && typeof obj[key] === 'object') {
      inspectResponse(obj[key], currentPath, foundKeys);
    }
  });
  
  return foundKeys;
}

/**
 * Extrae parámetros de navegación de los resultados de la primera página
 * @param {Object} results - Resultados de la primera página
 * @returns {Object} - Parámetros de navegación
 */
function extractNavigationParams(results) {
  if (!results) return { refId: null, searchContext: null, searcher: null };
  
  // Debug para identificar dónde podría estar el refId
  console.log('Claves importantes encontradas en firstPageResults:', 
    Object.keys(results).filter(k => 
      typeof results[k] === 'string' && 
      ['id', 'ref', 'refId', 'requestId'].some(key => k.toLowerCase().includes(key))
    ).map(k => ({ key: k, value: results[k] }))
  );
  
  // Verificar si tiene refId directo en la raíz
  if (results.refId) {
    console.log(`✅ Encontrado refId directo: ${results.refId}`);
    return { 
      refId: results.refId,
      searchContext: results.searchContext || null,
      searcher: results.searcher || null
    };
  }
  
  // Verificar si hay un ID en el requestParameters
  if (results.requestParameters) {
    const requestParams = results.requestParameters;
    
    // Debug de los parámetros de solicitud
    console.log('Parámetros de solicitud disponibles:', 
      Object.keys(requestParams).filter(k => 
        typeof requestParams[k] === 'string' && 
        ['id', 'ref', 'refId', 'requestId'].some(key => k.toLowerCase().includes(key))
      ).map(k => ({ key: k, value: requestParams[k] }))
    );
    
    if (requestParams.refId) {
      console.log(`✅ Encontrado refId en requestParameters: ${requestParams.refId}`);
      return {
        refId: requestParams.refId,
        searchContext: requestParams.searchContext || null,
        searcher: requestParams.searcher || null
      };
    }
    
    if (requestParams.requestId) {
      console.log(`ℹ️ Usando requestId como refId: ${requestParams.requestId}`);
      return {
        refId: requestParams.requestId,
        searchContext: requestParams.searchContext || null,
        searcher: requestParams.searcher || null
      };
    }
  }
  
  // Buscar en results.results[0].meta
  if (results.results && results.results[0] && results.results[0].meta) {
    const meta = results.results[0].meta;
    
    // Debug de campos en meta
    console.log('Campos meta disponibles:', 
      Object.keys(meta).filter(k => 
        typeof meta[k] === 'string' && 
        ['id', 'ref', 'refId', 'requestId', 'sequence'].some(key => k.toLowerCase().includes(key))
      ).map(k => ({ key: k, value: meta[k] }))
    );
    
    if (meta.refId) {
      console.log(`✅ Encontrado refId en meta: ${meta.refId}`);
      return {
        refId: meta.refId,
        searchContext: meta.searchContext || results.searchContext || null,
        searcher: meta.searcher || results.searcher || null
      };
    }
    
    if (meta.requestId) {
      console.log(`ℹ️ Usando requestId de meta como refId: ${meta.requestId}`);
      return {
        refId: meta.requestId,
        searchContext: meta.searchContext || results.searchContext || null,
        searcher: meta.searcher || results.searcher || null
      };
    }
  }
  
  // Buscar en propiedades anidadas recursivamente
  const refIdFromNested = findValueInObject(results, 'refId');
  if (refIdFromNested) {
    console.log(`✅ Encontrado refId anidado: ${refIdFromNested}`);
    return {
      refId: refIdFromNested,
      searchContext: findValueInObject(results, 'searchContext'),
      searcher: findValueInObject(results, 'searcher')
    };
  }
  
  console.log('⚠️ No se encontró refId en la respuesta, la paginación podría no funcionar correctamente');
  return { refId: null, searchContext: null, searcher: null };
}

/**
 * Busca un valor en un objeto anidado
 * @param {Object} obj - Objeto en el que buscar
 * @param {string} key - Clave a buscar
 * @returns {*} - Valor encontrado o null
 */
function findValueInObject(obj, key) {
  if (!obj || typeof obj !== 'object') return null;
  
  // Si la clave existe directamente, devolverla
  if (obj[key] !== undefined) return obj[key];
  
  // Buscar en propiedades anidadas
  for (const prop in obj) {
    if (typeof obj[prop] === 'object') {
      const result = findValueInObject(obj[prop], key);
      if (result !== null) return result;
    }
  }
  
  return null;
}

/**
 * Extrae parámetros de navegación del estado inicial de la aplicación
 * @param {Object} page - Instancia de la página
 * @returns {Promise<Object>} - Parámetros extraídos del estado inicial
 */
async function extractFromInitialState(page) {
  try {
    console.log('Intentando extraer parámetros del estado inicial de la aplicación...');
    const initialState = await page.evaluate(() => {
      return window.__INITIAL_STATE__;
    });
    
    if (initialState) {
      console.log('Estado inicial capturado correctamente');
      
      // Inspeccionar el estado inicial para encontrar claves importantes
      const foundKeys = inspectResponse(initialState);
      console.log('Claves importantes encontradas en el estado inicial:', foundKeys);
      
      let refId = null;
      let searchContext = null;
      let searcher = null;
      
      // Extraer refId de posibles ubicaciones
      if (initialState.search && initialState.search.refId) {
        refId = initialState.search.refId;
      } else if (initialState.pagination && initialState.pagination.refId) {
        refId = initialState.pagination.refId;
      } else if (initialState.searcherInfo && initialState.searcherInfo.refId) {
        refId = initialState.searcherInfo.refId;
      }
      
      // Extraer searchContext
      if (initialState.search && initialState.search.searchContext) {
        searchContext = initialState.search.searchContext;
      } else if (initialState.searchContext) {
        searchContext = initialState.searchContext;
      }
      
      // Extraer searcher
      if (initialState.search && initialState.search.searcher) {
        searcher = initialState.search.searcher;
      } else if (initialState.searcher) {
        searcher = initialState.searcher;
      }
      
      if (refId) console.log(`✅ refId extraído del estado inicial: ${refId}`);
      if (searchContext) console.log(`✅ searchContext extraído del estado inicial: ${searchContext}`);
      if (searcher) console.log(`✅ searcher extraído del estado inicial: ${searcher}`);
      
      return { refId, searchContext, searcher };
    }
  } catch (error) {
    console.error(`Error al extraer estado inicial: ${error.message}`);
  }
  
  return { refId: null, searchContext: null, searcher: null };
}

/**
 * Extrae parámetros de navegación de una respuesta API
 * @param {Object} response - Respuesta de la API
 * @returns {Object} - Parámetros extraídos
 */
function extractFromApiResponse(response) {
  let result = { refId: null, searchContext: null, searcher: null };
  
  if (!response || typeof response !== 'object') return result;
  
  try {
    // Inspeccionar la respuesta para encontrar claves importantes
    const foundKeys = inspectResponse(response);
    
    // Solo registrar si se encontraron claves
    if (foundKeys.length > 0) {
      console.log('Claves importantes encontradas en la respuesta API:', foundKeys);
    }
    
    // Extraer refId del objeto raíz
    if (response.refId) {
      result.refId = response.refId;
      console.log(`✅ refId extraído de la respuesta API: ${result.refId}`);
    } else if (response.pagination && response.pagination.refId) {
      result.refId = response.pagination.refId;
      console.log(`✅ refId extraído de response.pagination: ${result.refId}`);
    } else if (response.searcherInfo && response.searcherInfo.refId) {
      result.refId = response.searcherInfo.refId;
      console.log(`✅ refId extraído de response.searcherInfo: ${result.refId}`);
    }
    
    // Si no se encontró en la raíz, buscar en results[0]
    if (!result.refId && response.results && response.results[0]) {
      const firstResult = response.results[0];
      if (firstResult.refId) {
        result.refId = firstResult.refId;
        console.log(`✅ refId extraído de response.results[0]: ${result.refId}`);
      } else if (firstResult.pagination && firstResult.pagination.refId) {
        result.refId = firstResult.pagination.refId;
        console.log(`✅ refId extraído de response.results[0].pagination: ${result.refId}`);
      } else if (firstResult.searcherInfo && firstResult.searcherInfo.refId) {
        result.refId = firstResult.searcherInfo.refId;
        console.log(`✅ refId extraído de response.results[0].searcherInfo: ${result.refId}`);
      }
    }
    
    // Extraer searchContext (primero del objeto raíz, luego de results[0])
    if (response.searchContext) {
      result.searchContext = response.searchContext;
      console.log(`✅ searchContext extraído de la respuesta API: ${result.searchContext}`);
    } else if (response.results && response.results[0] && response.results[0].searchContext) {
      result.searchContext = response.results[0].searchContext;
      console.log(`✅ searchContext extraído de response.results[0]: ${result.searchContext}`);
    }
    
    // Extraer searcher (primero del objeto raíz, luego de results[0])
    if (response.searcher) {
      result.searcher = response.searcher;
      console.log(`✅ searcher extraído de la respuesta API: ${result.searcher}`);
    } else if (response.results && response.results[0] && response.results[0].searcher) {
      result.searcher = response.results[0].searcher;
      console.log(`✅ searcher extraído de response.results[0]: ${result.searcher}`);
    }
  } catch (error) {
    console.error(`Error al extraer parámetros de la respuesta API: ${error.message}`);
  }
  
  return result;
}

module.exports = {
  inspectResponse,
  extractNavigationParams,
  extractFromInitialState,
  extractFromApiResponse
}; 