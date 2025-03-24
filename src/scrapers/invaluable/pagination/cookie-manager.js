/**
 * Módulo para gestionar cookies en el proceso de paginación
 */
const { detectCookieChanges } = require('../utils');

/**
 * Filtra y limpia las cookies para evitar problemas de serialización
 * @param {Array} cookies - Array de cookies a limpiar
 * @returns {Array} - Array de cookies filtradas y seguras
 */
function sanitizeCookies(cookies) {
  if (!cookies || !Array.isArray(cookies)) return [];
  
  return cookies.map(cookie => {
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
 * Convierte un array de cookies en un string para usar en headers
 * @param {Array} cookies - Array de cookies
 * @returns {string} - String de cookies formatedo para headers
 */
function cookiesToString(cookies) {
  if (!cookies || !cookies.length) return '';
  return cookies.map(c => `${c.name}=${c.value}`).join('; ');
}

/**
 * Actualiza las cookies después de una respuesta HTTP
 * @param {Object} page - Instancia de página para obtener cookies
 * @param {Array} currentCookies - Estado actual de cookies 
 * @param {number} pageNum - Número de página (para logging)
 * @returns {Promise<Array>} - Cookies actualizadas
 */
async function updateCookiesAfterRequest(page, currentCookies, pageNum) {
  try {
    const newCookies = await page.cookies();
    if (newCookies && newCookies.length > 0) {
      // Sanitizar las cookies antes de usarlas
      const newCookieState = sanitizeCookies(newCookies);
      
      const cookiesChanged = detectCookieChanges(currentCookies, newCookieState);
      if (cookiesChanged) {
        console.log(`Cookies actualizadas después de la página ${pageNum} (${newCookieState.length} cookies)`);
        return newCookieState;
      }
    }
  } catch (error) {
    console.error(`Error al actualizar cookies: ${error.message}`);
  }
  
  // Si no hay cambios o hay un error, devolver las cookies actuales
  return currentCookies;
}

module.exports = {
  sanitizeCookies,
  cookiesToString,
  updateCookiesAfterRequest
}; 