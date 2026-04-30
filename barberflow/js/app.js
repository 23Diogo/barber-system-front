import { bindSidebar }       from './components/sidebar.js';
import { initThemeToggle }   from './components/theme-toggle.js';
import { initModal }         from './components/modal.js';
import { initWidgets }       from './components/widgets.js';
import { initDevAuth }       from './components/dev-auth.js';
import { initDashboard }     from './modules/dashboard.js';
import { navigate, initRouter } from './router.js';
import { initMobileSidebar } from './components/mobile-sidebar.js';
import { initNavBadges }     from './components/nav-badges.js';
import { initPWABanner }     from './pwa-install.js';

function initAdminApp() {
  bindSidebar(navigate);
  initMobileSidebar();
  initThemeToggle();
  initModal();
  initDashboard();
  initWidgets();
  initRouter();       // só prossegue se hasAuthToken() for true
  initDevAuth();
  initNavBadges();
  initPWABanner();    // só exibe se mobile + não instalado + não dispensado recentemente
}

window.addEventListener('DOMContentLoaded', initAdminApp);
