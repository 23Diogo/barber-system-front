import { bindSidebar } from './components/sidebar.js';
import { initThemeToggle } from './components/theme-toggle.js';
import { initModal } from './components/modal.js';
import { initWidgets } from './components/widgets.js';
import { initDevAuth } from './components/dev-auth.js';
import { initDashboard } from './modules/dashboard.js';
import { navigate, initRouter } from './router.js';
import { initMobileSidebar } from './components/mobile-sidebar.js';



function initAdminApp() {
  bindSidebar(navigate);
  initMobileSidebar(); 
  initThemeToggle();
  initModal();
  initDashboard();
  initWidgets();
  initRouter();
  initDevAuth();
}

window.addEventListener('DOMContentLoaded', initAdminApp);
