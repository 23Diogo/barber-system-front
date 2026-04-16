import { renderClientLayout } from './client-layout.js';
import { renderClientLogin, initClientLoginPage } from './modules/login.js';
import { renderClientRegister, initClientRegisterPage } from './modules/cadastro.js';
import { renderClientForgotPassword, initClientForgotPasswordPage } from './modules/recuperar-senha.js';
import { renderClientHome, initClientHomePage } from './modules/home.js';
import {
  hasClientToken,
  logoutClient,
  getClientProfile,
} from '../services/client-auth.js';

const CLIENT_BASE_PATH = '/client';

const renderers = {
  login: renderClientLogin,
  cadastro: renderClientRegister,
  'recuperar-senha': renderClientForgotPassword,
  home: renderClientHome,
};

const initializers = {
  login: initClientLoginPage,
  cadastro: initClientRegisterPage,
  'recuperar-senha': initClientForgotPasswordPage,
  home: initClientHomePage,
};

const publicRoutes = new Set(['login', 'cadastro', 'recuperar-senha']);

function normalizePath(pathname = '/') {
  const trimmed = String(pathname || '/').replace(/\/+$/, '');
  return trimmed || '/';
}

function getClientRouteFromPath(pathname = window.location.pathname) {
  const normalized = normalizePath(pathname);

  if (normalized === CLIENT_BASE_PATH) return 'home';
  if (normalized === `${CLIENT_BASE_PATH}/login`) return 'login';
  if (normalized === `${CLIENT_BASE_PATH}/cadastro`) return 'cadastro';
  if (normalized === `${CLIENT_BASE_PATH}/recuperar-senha`) return 'recuperar-senha';

  return 'login';
}

function getPathForClientRoute(routeName) {
  if (routeName === 'home') return CLIENT_BASE_PATH;
  return `${CLIENT_BASE_PATH}/${routeName}`;
}

function isPublicRoute(routeName) {
  return publicRoutes.has(routeName);
}

export function navigateClient(routeName, options = {}) {
  const { replace = false, skipHistory = false } = options;

  const safeRoute = renderers[routeName] ? routeName : 'login';
  const authenticated = hasClientToken();
  const finalRoute = !authenticated && !isPublicRoute(safeRoute) ? 'login' : safeRoute;

  const profile = getClientProfile();
  const content = renderers[finalRoute]();

  const layout = renderClientLayout(content, {
    title:
      finalRoute === 'login'
        ? 'Entrar'
        : finalRoute === 'cadastro'
        ? 'Criar conta'
        : finalRoute === 'recuperar-senha'
        ? 'Recuperar senha'
        : 'Minha área',
    subtitle:
      finalRoute === 'home'
        ? 'Acesse seus agendamentos, plano e pagamentos'
        : 'Use seus dados para continuar',
    showBack: finalRoute !== 'home',
    showLogout: authenticated && finalRoute === 'home',
    customerName: authenticated ? profile?.name || '' : '',
  });

  document.body.classList.add('client-area');
  document.body.innerHTML = layout;

  const nextPath = getPathForClientRoute(finalRoute);
  const currentPath = normalizePath(window.location.pathname);

  if (!skipHistory && currentPath !== nextPath) {
    const method = replace ? 'replaceState' : 'pushState';
    window.history[method]({ clientRoute: finalRoute }, '', nextPath);
  }

  document.getElementById('client-back-btn')?.addEventListener('click', () => {
    window.history.back();
  });

  document.getElementById('client-logout-btn')?.addEventListener('click', () => {
    logoutClient();
    navigateClient('login', { replace: true });
  });

  const initializer = initializers[finalRoute];
  if (initializer) queueMicrotask(() => initializer({ navigate: navigateClient }));
}

export function initClientRouter() {
  const initialRoute = getClientRouteFromPath(window.location.pathname);

  if (!hasClientToken() && initialRoute === 'home') {
    navigateClient('login', { replace: true });
  } else {
    navigateClient(initialRoute, { replace: false });
  }

  window.addEventListener('popstate', () => {
    const route = getClientRouteFromPath(window.location.pathname);
    navigateClient(route, { skipHistory: true });
  });
}
