/**
 * Módulo de manejo de paginación para Invaluable
 * 
 * Este módulo ha sido refactorizado para mejorar la modularidad y mantenibilidad.
 * La implementación actual se basa en el refId para la paginación.
 */

// Importamos el módulo principal de paginación
const { handlePagination } = require('./pagination');

/**
 * @function handlePagination
 * @description Maneja la paginación para recuperar todas las páginas de resultados de una búsqueda
 * @param {Object} browser - Instancia del navegador Puppeteer
 * @param {Object} params - Parámetros de búsqueda
 * @param {Object} firstPageResults - Resultados de la primera página
 * @param {Array} initialCookies - Cookies iniciales de la sesión
 * @param {number} maxPages - Número máximo de páginas a recuperar
 * @param {Object} config - Configuración adicional
 * @returns {Promise<Array>} - Array con todos los resultados combinados
 */
module.exports = { handlePagination }; 