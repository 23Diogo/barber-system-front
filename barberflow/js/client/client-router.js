import { renderLogin, initLoginPage } from './modules/login.js';
import { renderCadastro, initCadastroPage } from './modules/cadastro.js';
import { renderHome, initHomePage } from './modules/home.js';
import { renderRecuperarSenha, initRecuperarSenhaPage } from './modules/recuperar-senha.js';

const CLIENT_BASE = '/client';

const routes = {
  login: {
    path: '/client/login',
    render: renderLogin,
    init: initLoginPage,
  },
  cadastro: {
    path: '/client/cadastro',
    render: renderCadastro,
    init: initCadastroPage,
  },
  home: {
    path: '/client/home',
    render: renderHome,
    init: initHomePage,
  },
  'recuperar-senha': {
    path: '/client/recuperar-senha',
    render: renderRecuperarSenha,
    init: initRecuperarSenhaPage,
  },
};

const validRoutes = new Set(Object.keys(routes));

function normalizePath(pathname = '/') {
  const trimmed = String(pathname || '/').replace(/\/+$/, '');
  return trimmed || '/';
}

function getClientRouteFromPath(pathname = window.location.pathname) {
  const normalized = normalizePath(pathname);

  if (normalized === CLIENT_BASE || normalized === `${CLIENT_BASE}/login`) return 'login';
  if (normalized === `${CLIENT_BASE}/cadastro`) return 'cadastro';
  if (normalized === `${CLIENT_BASE}/home`) return 'home';
  if (normalized === `${CLIENT_BASE}/recuperar-senha`) return 'recuperar-senha';

  return 'login';
}

function getPathForRoute(route) {
  return routes[route]?.path || `${CLIENT_BASE}/login`;
}

function renderClientPage(route) {
  const safeRoute = validRoutes.has(route) ? route : 'login';
  const { render, init } = routes[safeRoute];

  document.body.className = 'client-area';
  document.body.innerHTML = render();

  if (init) queueMicrotask(() => init());
}

export function navigateClient(route, options = {}) {
  const { replace = false, skipHistory = false } = options;
  const safeRoute = validRoutes.has(route) ? route : 'login';
  const nextPath = getPathForRoute(safeRoute);

  if (!skipHistory && normalizePath(window.location.pathname) !== normalizePath(nextPath)) {
    const method = replace ? 'replaceState' : 'pushState';
    window.history[method]({ clientRoute: safeRoute }, '', nextPath);
  }

  renderClientPage(safeRoute);
}

export function initClientRouter() {
  const initialRoute = getClientRouteFromPath(window.location.pathname);
  navigateClient(initialRoute, { replace: false });

  window.addEventListener('popstate', () => {
    const route = getClientRouteFromPath(window.location.pathname);
    navigateClient(route, { skipHistory: true });
  });
}
