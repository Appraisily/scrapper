/**
 * Módulo para procesar los resultados obtenidos durante la paginación
 */

/**
 * Procesa los resultados de una página y los agrega a los resultados acumulados
 * @param {Object} pageResults - Resultados de la página actual
 * @param {Array} allResults - Array con todos los resultados acumulados
 * @param {Set} processedIds - Set con IDs de resultados ya procesados
 * @returns {Object} - Información sobre el procesamiento (nuevos, duplicados, total)
 */
function processPageResults(pageResults, allResults, processedIds) {
  if (!pageResults || !pageResults.hits || !Array.isArray(pageResults.hits)) {
    console.error('Formato de resultados inválido:', pageResults);
    return { newResults: 0, duplicates: 0, total: allResults.length };
  }
  
  const hits = pageResults.hits;
  let newResults = 0;
  let duplicates = 0;
  
  console.log(`Procesando ${hits.length} resultados...`);
  
  hits.forEach(item => {
    // Usar algún identificador único para el item (lotId, id, etc.)
    const itemId = item.lotId || item.id || JSON.stringify(item);
    
    // Verificar si este item ya fue procesado
    if (!processedIds.has(itemId)) {
      allResults.push(item);
      processedIds.add(itemId);
      newResults++;
    } else {
      duplicates++;
    }
  });
  
  console.log(`✅ Resultados agregados: ${newResults} nuevos, ${duplicates} duplicados, total acumulado: ${allResults.length}`);
  
  return { newResults, duplicates, total: allResults.length };
}

/**
 * Extrae metadatos de los resultados, como el total de elementos
 * @param {Object} pageResults - Resultados de la página
 * @returns {Object} - Metadatos extraídos
 */
function extractResultsMetadata(pageResults) {
  let totalItems = 0;
  let totalPages = 0;
  
  if (pageResults && pageResults.totalHits !== undefined) {
    totalItems = pageResults.totalHits;
    
    // Calcular páginas basado en tamaño de página
    const pageSize = pageResults.pageSize || (pageResults.hits && pageResults.hits.length) || 48;
    totalPages = Math.ceil(totalItems / pageSize);
    
    console.log(`Metadatos: ${totalItems} elementos en ${totalPages} páginas (tamaño de página: ${pageSize})`);
  } else {
    console.warn('No se encontraron metadatos de paginación en los resultados');
  }
  
  return { totalItems, totalPages };
}

/**
 * Verifica si los resultados de la página actual son diferentes a los anteriores
 * @param {Array} currentHits - Resultados de la página actual
 * @param {Set} processedIds - Set con IDs de resultados ya procesados
 * @returns {boolean} - true si hay resultados diferentes, false si todos son duplicados
 */
function checkIfDifferentResults(currentHits, processedIds) {
  if (!currentHits || !Array.isArray(currentHits) || currentHits.length === 0) {
    return false;
  }
  
  let newItemsFound = false;
  
  for (const item of currentHits) {
    const itemId = item.lotId || item.id || JSON.stringify(item);
    if (!processedIds.has(itemId)) {
      newItemsFound = true;
      break;
    }
  }
  
  return newItemsFound;
}

/**
 * Verifica si hay suficientes resultados para continuar o finalizar
 * @param {Array} allResults - Array con todos los resultados acumulados
 * @param {number} totalItems - Total de elementos según metadatos
 * @param {number} maxResults - Máximo de resultados a obtener
 * @returns {boolean} - true si se debe continuar, false si se debe finalizar
 */
function shouldContinueProcessing(allResults, totalItems, maxResults) {
  // Removed check for totalItems, respecting only maxResults
  
  // Si se alcanzó el máximo de resultados configurado, detener
  if (maxResults > 0 && allResults.length >= maxResults) {
    console.log(`Alcanzado el máximo de resultados configurado: ${allResults.length}/${maxResults}`);
    return false;
  }
  
  return true;
}

module.exports = {
  processPageResults,
  extractResultsMetadata,
  checkIfDifferentResults,
  shouldContinueProcessing
}; 