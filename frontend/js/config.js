/**
 * config.js
 * Configuración centralizada de URLs de la API para el frontend.
 * Los valores cambian automáticamente entre entorno local y producción.
 */

const _isLocal = ['localhost', '127.0.0.1'].includes(window.location.hostname);
const _base = _isLocal
  ? 'http://localhost/Gastro-Sys-Fusion'
  : 'https://tu-dominio-produccion.com';

/** URL raíz del proyecto (assets, imágenes) */
window.API_URL = _base + '/';

/** URL base legacy (backend PHP directo) */
window.API_URL_PHP = _base + '/backend/';

/** Endpoints del nuevo contrato de API */
window.API = {
  clima:      _base + '/api/clima.php',
  menu:       _base + '/api/menu.php',
  platos:     _base + '/api/platos.php',
  inventario: _base + '/api/inventario.php',
  mermas:     _base + '/api/mermas.php',
  agente:     _base + '/api/agente/query.php',
};

/** URL del agente Next.js */
window.AGENTE_URL = _isLocal
  ? 'http://localhost:3000/api/chat'
  : 'https://tu-dominio-produccion.com/api/chat';
