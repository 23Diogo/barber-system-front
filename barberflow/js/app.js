import { bindSidebar } from './components/sidebar.js';
import { initThemeToggle } from './components/theme-toggle.js';
import { initModal } from './components/modal.js';
import { initWidgets } from './components/widgets.js';
import { initDevAuth } from './components/dev-auth.js';
import { initDashboard } from './modules/dashboard.js';
import { navigate } from './router.js';

function initApp() {
  bindSidebar(navigate);
  initThemeToggle();
  initModal();
  initDashboard();
  initWidgets();
  navigate('dash');
  initDevAuth();
}

window.addEventListener('DOMContentLoaded', initApp);
