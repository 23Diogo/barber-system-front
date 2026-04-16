import { renderClientLogin, initClientLoginPage } from './modules/login.js';
import { renderClientRegister, initClientRegisterPage } from './modules/cadastro.js';
import { renderClientHome, initClientHomePage } from './modules/home.js';
import { renderClientForgotPassword, initClientForgotPasswordPage } from './modules/recuperar-senha.js';
import { renderClientLayout } from './client-layout.js';

const CLIENT_BASE = '/client';

const routes = {
  login: {
    path: '/client/login',
    render: renderClientLogin,
    init: (nav) => initClientLoginPage({ navigate: nav }),
    layoutOptions: { title: 'Entrar', subtitle: 'Acesse sua conta' },
  },
  cadastro: {
    path: '/client/cadastro',
    render: renderClientRegister,
    init: (nav) => initClientRegisterPage({ navigate: nav }),
    layoutOptions: { title: 'Criar conta', subtitle: 'Preencha seus dados para começar' },
  },
  home: {
    path: '/client/home',
    render: renderClientHome,
    init: () => initClientHomePage(),
    layoutOptions: { title: 'Minha área', subtitle: 'Bem-vindo de volta', showLogout: true },
  },
  'recuperar-senha': {
    path: '/client/recuperar-senha',
    render: renderClientForgotPassword,
    init: (nav) => initClientForgotPasswordPage({ navigate: nav }),
    layoutOptions: { title: 'Recuperar senha', subtitle: 'Enviaremos as instruções para você', showBack: true },
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
  const { render, init, layoutOptions } = routes[safeRoute];

  document.body.className = 'client-area';
  document.body.innerHTML = renderClientLayout(render(), layoutOptions);

  if (init) queueMicrotask(() => init(navigateClient));

  // botão Voltar do layout
  document.getElementById('client-back-btn')?.addEventListener('click', () => {
    navigateClient('login');
  });

  // botão Sair do layout
  document.getElementById('client-logout-btn')?.addEventListener('click', () => {
    // limpar token/sessão aqui quando tiver auth
    navigateClient('login');
  });
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
