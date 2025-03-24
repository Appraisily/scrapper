/**
 * Módulo para manejar las búsquedas en Invaluable
 * Enfocado en API directa para evitar bloqueos de Cloudflare
 */
const { formatCookies, detectCookieChanges, randomWait } = require('./utils');

/**
 * Maneja una solicitud de búsqueda completa usando API directa
 * @param {Object} browser - Instancia del gestor de navegador
 * @param {string} url - URL de búsqueda
 * @param {Object} params - Parámetros de búsqueda
 * @param {Array} cookies - Cookies iniciales
 * @param {Object} config - Configuración
 * @returns {Object} Resultados de la búsqueda
 */
async function handleSearch(browser, url, params = {}, cookies = [], config = {}) {
  console.log('Iniciando búsqueda directa a API...');
  console.log('URL de contexto:', url);
  
  const page = await browser.createTab('search');
  let catResults = null;
  let updatedCookies = [];
  
  try {
    // Configurar interceptación avanzada para evitar detección
    await page.setRequestInterception(true);
    
    // Formatear las cookies para asegurar que tenemos lo necesario
    const formattedCookies = formatCookies(cookies, params);
    console.log(`Cookies iniciales formateadas: ${formattedCookies.length}`);
    
    // Control de seguimiento de resultados
    let foundResults = false;
    let maxAttempts = 3;
    let attempts = 0;
    
    // Almacenar todas las respuestas de catResults para usar la última
    let allCatResults = [];
    
    // Configurar listeners para interceptar respuestas de API
    page.on('response', async response => {
      const responseUrl = response.url();
      
      // Capturar los resultados de catResults
      if (responseUrl.includes('catResults') && response.status() === 200) {
        console.log('✅ Interceptada respuesta de API catResults');
        try {
          const text = await response.text();
          const result = JSON.parse(text);
          if (result && result.results && result.results[0] && result.results[0].hits) {
            const hits = result.results[0].hits;
            console.log(`Encontrados ${hits.length} resultados en la respuesta`);
            // Añadir resultado a la lista de respuestas
            allCatResults.push(result);
            foundResults = true;
          }
        } catch (error) {
          console.error('Error al parsear respuesta:', error.message);
        }
      }
      
      // Capturar información de sesión
      if (responseUrl.includes('/session-info') && response.status() === 200) {
        console.log('Interceptada respuesta de session-info');
      }
    });
    
    // Optimizar manejo de solicitudes
    page.on('request', request => {
      try {
        const reqUrl = request.url();
        const method = request.method();
        
        // Permitir solicitudes específicas y agregar headers optimizados
        if (reqUrl.includes('invaluable.com')) {
          const headers = {
            ...request.headers(),
            'Accept-Language': 'en-US,en;q=0.9',
            'Pragma': 'no-cache',
            'Cache-Control': 'no-cache',
            'DNT': '1'
          };
          
          // Añadir cookies a todos los requests
          if (formattedCookies && formattedCookies.length > 0) {
            headers['Cookie'] = formattedCookies.map(c => `${c.name}=${c.value}`).join('; ');
          }
          
          // Headers especiales para llamadas API
          if (reqUrl.includes('catResults') || reqUrl.includes('/api/v2/')) {
            headers['Accept'] = 'application/json';
            headers['Content-Type'] = 'application/json';
            headers['X-Requested-With'] = 'XMLHttpRequest';
          }
          
          // Bloquear recursos innecesarios que podrían causar detecciones
          if (request.resourceType() === 'image' || 
              request.resourceType() === 'stylesheet' || 
              request.resourceType() === 'font' ||
              request.resourceType() === 'media' ||
              reqUrl.includes('google') ||
              reqUrl.includes('analytics') ||
              reqUrl.includes('facebook') ||
              reqUrl.includes('ads') ||
              reqUrl.includes('track')) {
            request.abort();
            return;
          }
          
          request.continue({ headers });
        } else {
          request.abort();
        }
      } catch (error) {
        if (!error.message.includes('Request is already handled')) {
          console.error('Error en manejo de solicitud:', error);
        }
        request.continue();
      }
    });

    // Establecer cookies iniciales
    if (formattedCookies && formattedCookies.length > 0) {
      await page.setCookie(...formattedCookies);
    }
    
    // Estrategia para obtener resultados:
    // 1. Establecer contexto navegando a la URL principal
    // 2. Obtener información de sesión para cookies
    // 3. Hacer solicitud directa a la API
    
    while (attempts < maxAttempts && !foundResults) {
      attempts++;
      console.log(`\n----- Intento de búsqueda ${attempts} de ${maxAttempts} -----`);
      
      try {
        // 1. Establecer contexto navegando a la URL de búsqueda
        console.log('Estableciendo contexto de navegación...');
        await page.goto(url, {
          waitUntil: 'networkidle2', 
          timeout: config.NAVIGATION_TIMEOUT || 30000
        });
        
        // Verificar y manejar protección Cloudflare
        const protectionHandled = await browser.handleProtection();
        if (protectionHandled) {
          console.log('✅ Protección manejada correctamente');
        }
        
        // Esperar un momento para que se estabilice la página
        await randomWait(1000, 2000);
        
        // 2. Obtener información de sesión para cookies
        console.log('Obteniendo información de sesión...');
        try {
          const sessionInfo = await page.evaluate(async () => {
            try {
              const response = await fetch('/boulder/session-info', {
                method: 'GET',
                headers: {
                  'Accept': 'application/json'
                },
                credentials: 'include'
              });
              
              if (!response.ok) {
                return { error: response.status };
              }
              
              return await response.json();
            } catch (error) {
              return { error: error.message };
            }
          });
          
          if (sessionInfo && !sessionInfo.error) {
            console.log('✅ Información de sesión obtenida correctamente');
          } else {
            console.log('⚠️ Error al obtener sesión:', sessionInfo?.error);
          }
        } catch (error) {
          console.error('Error en solicitud de información de sesión:', error.message);
        }
        
        // Actualizar cookies después de obtener la info de sesión
        updatedCookies = await page.cookies();
        if (updatedCookies && updatedCookies.length > 0) {
          console.log(`Cookies actualizadas: ${updatedCookies.length}`);
          // Actualizar las cookies para solicitudes futuras
          await page.setCookie(...updatedCookies);
        }
        
        // Si ya tenemos resultados de la navegación inicial, no hacemos la solicitud directa
        if (foundResults) {
          console.log('Ya se obtuvieron resultados durante la navegación inicial');
          break;
        }
        
        // 3. Hacer solicitud directa a la API con los parámetros de búsqueda
        console.log('Realizando solicitud directa a API catResults...');
        
        // Construir payload optimizado para la solicitud
        const searchParams = { ...params };
        delete searchParams.cookies;
        
        const payload = {
          params: searchParams,
          timestamp: Date.now(),
          requestId: `req_${Date.now()}_${Math.floor(Math.random() * 1000)}`,
          clientType: 'web'
        };
        
        // Realizar solicitud directa a la API
        const results = await page.evaluate(async (payload) => {
          try {
            console.log('Enviando solicitud a /catResults...');
            
            const response = await fetch('/catResults', {
              method: 'POST',
              headers: {
                'Accept': 'application/json',
                'Content-Type': 'application/json',
                'X-Requested-With': 'XMLHttpRequest'
              },
              body: JSON.stringify(payload),
              credentials: 'include'
            });
            
            if (!response.ok) {
              throw new Error(`Error HTTP: ${response.status}`);
            }
            
            const data = await response.json();
            console.log('Respuesta recibida de catResults');
            return data;
          } catch (error) {
            console.error('Error en solicitud API:', error.message);
            return null;
          }
        }, payload);
        
        // Verificar resultados de la solicitud directa
        if (results && results.results && results.results[0] && results.results[0].hits) {
          // Añadir también los resultados directos a la lista de resultados
          allCatResults.push(results);
          const hits = results.results[0].hits;
          console.log(`✅ Solicitud API exitosa: ${hits.length} resultados encontrados`);
          foundResults = true;
        } else if (!foundResults) {
          console.log('⚠️ No se obtuvieron resultados válidos en la solicitud API directa');
          
          // Intentar un enfoque alternativo con otra URL API
          console.log('Probando enfoque alternativo...');
          const alternativeResults = await page.evaluate(async (params) => {
            try {
              // Construir URL de API alternativa
              const queryParams = new URLSearchParams();
              for (const [key, value] of Object.entries(params)) {
                if (value !== undefined && value !== null && typeof value !== 'object') {
                  queryParams.append(key, value);
                }
              }
              
              const apiUrl = `/api/v2/search/lots?${queryParams.toString()}`;
              console.log('Solicitando:', apiUrl);
              
              const response = await fetch(apiUrl, {
                method: 'GET',
                headers: {
                  'Accept': 'application/json'
                },
                credentials: 'include'
              });
              
              if (!response.ok) {
                throw new Error(`Error HTTP: ${response.status}`);
              }
              
              return await response.json();
            } catch (error) {
              console.error('Error en solicitud alternativa:', error.message);
              return null;
            }
          }, params);
          
          if (alternativeResults && alternativeResults.hits) {
            console.log(`✅ Enfoque alternativo exitoso: ${alternativeResults.hits.length} resultados`);
            
            // Convertir al formato esperado
            const formattedResults = {
              results: [{
                hits: alternativeResults.hits,
                meta: {
                  totalHits: alternativeResults.totalHits || alternativeResults.hits.length,
                  hitsPerPage: alternativeResults.hitsPerPage || alternativeResults.hits.length
                }
              }]
            };
            
            // Añadir también estos resultados a la lista
            allCatResults.push(formattedResults);
            foundResults = true;
          }
        }
        
        // Si encontramos resultados, terminamos los intentos
        if (foundResults) break;
        
        // Esperar antes de volver a intentar
        if (attempts < maxAttempts) {
          console.log(`Esperando antes de intento ${attempts + 1}...`);
          await randomWait(3000, 5000);
        }
        
      } catch (error) {
        console.error(`El intento de búsqueda ${attempts} falló:`, error.message);
        await randomWait(2000, 3000);
      }
    }
    
    // Capturar las cookies finales
    updatedCookies = await page.cookies();
    
    // Verificar si las cookies cambiaron
    const cookiesChanged = detectCookieChanges(formattedCookies, updatedCookies);
    
    // Usar la última respuesta de catResults si tenemos múltiples
    if (allCatResults.length > 0) {
      console.log(`Se interceptaron ${allCatResults.length} respuestas de catResults`);
      // Usar la última respuesta, que debería tener los filtros aplicados correctamente
      catResults = allCatResults[allCatResults.length - 1];
      console.log(`Usando la respuesta #${allCatResults.length} (última) con ${catResults.results[0].hits.length} resultados`);
    }
    
    // Añadir las cookies actualizadas a los resultados
    if (catResults) {
      catResults.cookies = updatedCookies;
    }
    
    if (!foundResults) {
      console.error('⚠️ No se pudieron obtener resultados después de todos los intentos');
      // Retornar un objeto vacío estructurado para evitar errores
      return {
        results: [{
          hits: [],
          meta: { totalHits: 0, hitsPerPage: config.DEFAULT_HITS_PER_PAGE || 96 }
        }],
        cookies: updatedCookies
      };
    }
    
    return catResults;
    
  } finally {
    await browser.closeTab('search');
  }
}

module.exports = {
  handleSearch
}; 