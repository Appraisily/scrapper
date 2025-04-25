/**
 * Módulo para construir URLs para el scraper de Invaluable
 */

/**
 * Construye una URL de búsqueda basada en los parámetros proporcionados
 * @param {Object} params - Parámetros de búsqueda
 * @returns {string} URL completa para la búsqueda
 */
function constructSearchUrl(params = {}) {
  // Determine if this is an artist search or regular search
  const isArtistSearch = !!params.artistName;
  
  // Use appropriate base URL depending on search type
  const baseUrl = isArtistSearch 
    ? 'https://www.invaluable.com/artist/search'
    : 'https://www.invaluable.com/search';
    
  // Creamos un objeto de parámetros personalizado en lugar de URLSearchParams
  // para poder controlar exactamente cómo se codifican los espacios
  const searchParamsObj = {};

  // Usar el orden de parámetros observado en las redirecciones de Invaluable
  // Primero currentBid, luego upcoming, luego query y keyword
  
  // Check if this is an artist search, handle differently
  if (isArtistSearch) {
    // For artist search, add the artist name as the main query parameter
    searchParamsObj['query'] = params.artistName;
    
    // Add standard parameters for sold items
    searchParamsObj['sold'] = 'true';
    searchParamsObj['upcoming'] = 'false';
  } else {
    // Regular search flow
    // Usar currentBid en lugar de priceResult para el rango de precios
    searchParamsObj['currentBid[min]'] = params.currentBid_min || params.priceResult_min || '250';
    if (params.currentBid_max || (params.priceResult && params.priceResult.max)) {
      searchParamsObj['currentBid[max]'] = params.currentBid_max || (params.priceResult && params.priceResult.max);
    }
    
    // Añadir upcoming=false que es necesario para la URL correcta
    searchParamsObj['upcoming'] = 'false';
    
    // Procesar el query reemplazando guiones por espacios
    let queryValue = params.query || 'furniture';
    queryValue = queryValue.replace(/-/g, ' ');
    
    // Añadir parámetros de búsqueda requeridos
    searchParamsObj['query'] = queryValue;
    searchParamsObj['keyword'] = queryValue;
  }
  
  // Manejar parámetros de paginación - solo añadir si no es página 1 (default)
  if (params.page && !isNaN(params.page) && params.page > 1) {
    searchParamsObj['page'] = params.page;
  }
  
  // Manejar el parámetro de subcategoría de muebles si está presente
  if (params.furnitureSubcategory) {
    // Este es un parámetro especial que mapea a la estructura de URL de Invaluable para subcategorías de muebles
    searchParamsObj['Furniture'] = params.furnitureSubcategory;
  }
  
  // Añadir solo parámetros relevantes para Invaluable (excluyendo parámetros de almacenamiento)
  Object.entries(params).forEach(([key, value]) => {
    // Omitir parámetros específicos de nuestra aplicación o ya configurados
    if (value !== undefined && value !== null && 
        ![
          // Parámetros ya configurados
          'upcoming', 'query', 'keyword', 'priceResult', 'priceResult_min', 
          'currentBid_min', 'currentBid_max', 'page', 'furnitureSubcategory',
          'artistName', 'sold',
          // Parámetros específicos de nuestra aplicación de almacenamiento
          'saveToGcs', 'saveImages', 'bucket', 'fetchAllPages'
        ].includes(key)) {
      searchParamsObj[key] = value;
    }
  });

  // Construir la URL manualmente para asegurarnos de codificar correctamente los espacios
  const queryString = Object.entries(searchParamsObj)
    .map(([key, value]) => {
      // Codificar el key
      const encodedKey = encodeURIComponent(key);
      
      // Si es query o keyword, usamos %20 para espacios en lugar de +
      let encodedValue;
      if (key === 'query' || key === 'keyword') {
        // Asegurar que los espacios sean %20 para query y keyword
        encodedValue = encodeURIComponent(value);
      } else {
        encodedValue = encodeURIComponent(value);
      }
      
      return `${encodedKey}=${encodedValue}`;
    })
    .join('&');

  return `${baseUrl}?${queryString}`;
}

/**
 * Procesa y codifica una subcategoría de muebles para su uso en una URL
 * @param {string} subcategory - Nombre de la subcategoría (por ejemplo, "Tables, Stands & Consoles")
 * @returns {string} Subcategoría codificada para URL
 */
function encodeFurnitureSubcategory(subcategory) {
  if (!subcategory) return '';
  
  // Primero codificar la subcategoría como URI component
  let encoded = encodeURIComponent(subcategory);
  
  // Luego codificar de nuevo los caracteres especiales (doble codificación para Invaluable)
  encoded = encoded.replace(/%/g, '%25')
                  .replace(/&/g, '%2526')
                  .replace(/,/g, '%252C')
                  .replace(/=/g, '%253D')
                  .replace(/\+/g, '%252B')
                  .replace(/\//g, '%252F')
                  .replace(/\s/g, '%2520');
  
  return encoded;
}

module.exports = {
  constructSearchUrl,
  encodeFurnitureSubcategory
}; 