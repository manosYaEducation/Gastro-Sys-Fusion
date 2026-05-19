window.API_URL = (window.location.hostname === 'localhost' ||
  window.location.hostname === '127.0.0.1')
? 'http://localhost/Gastro-Sys-Fusion/'
: 'https://tu-dominio-produccion.com';

window.API_URL_PHP = (window.location.hostname === 'localhost' ||
  window.location.hostname === '127.0.0.1')
? 'http://localhost/Gastro-Sys-Fusion/backend/'
: 'https://tu-dominio-produccion.com/backend/';
