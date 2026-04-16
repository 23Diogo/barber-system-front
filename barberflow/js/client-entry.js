import { initClientRouter } from './client/client-router.js';

window.addEventListener('DOMContentLoaded', () => {
  console.log('[CLIENT] client-entry carregado');
  initClientRouter();
});
