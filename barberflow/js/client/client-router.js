import { renderClientLogin, initClientLoginPage } from './modules/login.js';
import { renderClientRegister, initClientRegisterPage } from './modules/cadastro.js';
import { renderClientHome, initClientHomePage } from './modules/home.js';
import { renderClientForgotPassword, initClientForgotPasswordPage } from './modules/recuperar-senha.js';
import { renderClientNovaSenha, initClientNovaSenhaPage } from './modules/nova-senha.js';
import { getClientProfile, logoutClient } from '../services/client-auth.js';
import { renderClientAgendar, initClientAgendarPage } from './modules/agendar.js';
import { renderClientAgendamentos, initClientAgendamentosPage } from './modules/agendamentos.js';
import { renderClientPlanos, initClientPlanosPage } from './modules/planos.js';
import { renderClientAssinatura, initClientAssinaturaPage } from './modules/assinatura.js';
import { renderClientDados, initClientDadosPage } from './modules/dados.js';
import { renderClientPagamentos, initClientPagamentosPage } from './modules/pagamentos.js';
import { renderClientSuporte, initClientSuportePage } from './modules/suporte.js';
import { renderClientBarbearias, initClientBarbeariasPage } from './modules/barbearias.js';
import { renderClientLayout, initClientThemeToggle } from './client-layout.js';

const CLIENT_BASE = '/client';

function getActiveBarbershopName(profile) {
  const shops = Array.isArray(profile?.barbershops) ? profile.barbershops : [];
  const preferred = shops.find((item) => item?.is_active || item?.is_selected) || shops[0];
  return preferred?.name || 'Nenhuma barbearia selecionada';
}

const routes = {
  login: {
    path: '/client/login',
    render: renderClientLogin,
    init: (navigate) => initClientLoginPage({ navigate }),
    protected: false,
    layoutOptions: { variant: 'auth', title: 'Entrar', subtitle: 'Acesse sua conta' },
  },
  cadastro: {
    path: '/client/cadastro',
    render: renderClientRegister,
    init: (navigate) => initClientRegisterPage({ navigate }),
    protected: false,
    layoutOptions: { variant: 'auth', title: 'Criar conta', subtitle: 'Preencha seus dados para começar' },
  },
  'recuperar-senha': {
    path: '/client/recuperar-senha',
    render: renderClientForgotPassword,
    init: (navigate) => initClientForgotPasswordPage({ navigate }),
    protected: false,
    layoutOptions: { variant: 'auth', title: 'Recuperar senha', subtitle: 'Enviaremos as instruções para você', showBack: true },
  },
  'nova-senha': {
    path: '/client/nova-senha',
    render: renderClientNovaSenha,
    init: (navigate) => initClientNovaSenhaPage({ navigate }),
    protected: false,
    layoutOptions: { variant: 'auth', title: 'Nova senha', subtitle: 'Crie sua nova senha de acesso', showBack: true },
  },
  home: {
    path: '/client/home',
    render: renderClientHome,
    init: (navigate) => initClientHomePage({ navigate }),
    protected: true,
    layoutOptions: { variant: 'dashboard', title: 'INÍCIO', subtitle: 'Bem-vindo de volta' },
  },
  agendar: {
    path: '/client/agendar',
    render: renderClientAgendar,
    init: (navigate) => initClientAgendarPage({ navigate }),
    protected: true,
    layoutOptions: { variant: 'dashboard', title: 'AGENDAR HORÁRIO' },
  },
  agendamentos: {
    path: '/client/agendamentos',
    render: renderClientAgendamentos,
    init: () => initClientAgendamentosPage(),
    protected: true,
    layoutOptions: { variant: 'dashboard', title: 'MEUS AGENDAMENTOS' },
  },
  planos: {
    path: '/client/planos',
    render: renderClientPlanos,
    init: () => initClientPlanosPage(),
    protected: true,
    layoutOptions: { variant: 'dashboard', title: 'CONTRATAR PLANO' },
  },
  assinatura: {
    path: '/client/assinatura',
    render: renderClientAssinatura,
    init: () => initClientAssinaturaPage(),
    protected: true,
    layoutOptions: { variant: 'dashboard', title: 'MEU PLANO' },
  },
  barbearias: {
    path: '/client/barbearias',
    render: renderClientBarbearias,
    init: () => initClientBarbeariasPage(),
    protected: true,
    layoutOptions: { variant: 'dashboard', title: 'MINHAS BARBEARIAS' },
  },
  dados: {
    path: '/client/dados',
    render: renderClientDados,
    init: () => initClientDadosPage(),
    protected: true,
    layoutOptions: { variant: 'dashboard', title: 'MEUS DADOS' },
  },
  pagamentos: {
    path: '/client/pagamentos',
    render: renderClientPagamentos,
    init: () => initClientPagamentosPage(),
    protected: true,
    layoutOptions: { variant: 'dashboard', title: 'PAGAMENTOS' },
  },
  suporte: {
    path: '/client/suporte',
    render: renderClientSuporte,
    init: () => initClientSuportePage(),
    protected: true,
    layoutOptions: { variant: 'dashboard', title: 'SUPORTE' },
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

  if (normalized.startsWith(`${CLIENT_BASE}/cadastro`)) return 'cadastro';

  // Captura /client/:slug/nova-senha?token=... (link do e-mail de recuperação)
  if (normalized.match(/^\/client\/[^/]+\/nova-senha$/)) return 'nova-senha';

  const entry = Object.entries(routes).find(([, config]) => normalizePath(config.path) === normalized);
  return entry?.[0] || 'login';
}

function getPathForRoute(route) {
  return routes[route]?.path || `${CLIENT_BASE}/login`;
}

function setClientMenuState(isOpen) {
  const sidebar = document.getElementById('client-dashboard-sidebar');
  const openBtn = document.getElementById('client-mobile-menu-btn');

  if (!sidebar) return;

  document.body.classList.toggle('client-menu-open', Boolean(isOpen));
  sidebar.setAttribute('aria-hidden', isOpen ? 'false' : 'true');
  openBtn?.setAttribute('aria-expanded', isOpen ? 'true' : 'false');
}

function closeClientMenu() {
  setClientMenuState(false);
}

function bindClientDashboardMenu() {
  const openBtn = document.getElementById('client-mobile-menu-btn');
  const closeBtn = document.getElementById('client-sidebar-close-btn');
  const overlay = document.getElementById('client-sidebar-overlay');

  if (!openBtn) return;

  openBtn.addEventListener('click', () => {
    const isOpen = document.body.classList.contains('client-menu-open');
    setClientMenuState(!isOpen);
  });

  closeBtn?.addEventListener('click', closeClientMenu);
  overlay?.addEventListener('click', closeClientMenu);
}

// ─── Scroll hide topbar ────────────────────────────────────────────────────────
// Esconde o topbar ao rolar para baixo, mostra ao rolar para cima.
// Só ativa em mobile (≤ 980px). Limpa o listener ao trocar de página.

let _scrollCleanup = null;

function bindScrollHideTopbar() {
  // Remove listener anterior se existir
  if (_scrollCleanup) {
    _scrollCleanup();
    _scrollCleanup = null;
  }

  if (window.innerWidth > 980) return;

  const topbar = document.querySelector('.client-dashboard-topbar');
  if (!topbar) return;

  let lastScrollY = window.scrollY;
  let ticking = false;

  const onScroll = () => {
    if (ticking) return;
    ticking = true;
    requestAnimationFrame(() => {
      // Não esconde enquanto o menu lateral estiver aberto
      if (document.body.classList.contains('client-menu-open')) {
        topbar.classList.remove('topbar--hidden');
        lastScrollY = window.scrollY;
        ticking = false;
        return;
      }

      const currentScrollY = window.scrollY;
      const scrollingDown = currentScrollY > lastScrollY;
      const pastThreshold = currentScrollY > 80;

      if (scrollingDown && pastThreshold) {
        topbar.classList.add('topbar--hidden');
      } else {
        topbar.classList.remove('topbar--hidden');
      }

      lastScrollY = currentScrollY;
      ticking = false;
    });
  };

  window.addEventListener('scroll', onScroll, { passive: true });

  // Guarda cleanup para remover na próxima navegação
  _scrollCleanup = () => window.removeEventListener('scroll', onScroll);
}

function bindClientRouteTriggers(currentRoute) {
  document.querySelectorAll('[data-client-route]').forEach((element) => {
    const targetRoute = element.getAttribute('data-client-route');
    if (!targetRoute) return;

    if (targetRoute === currentRoute) element.classList.add('active');

    const onNavigate = () => {
      closeClientMenu();
      navigateClient(targetRoute);
    };

    element.addEventListener('click', onNavigate);
    element.addEventListener('keydown', (event) => {
      if (event.key === 'Enter' || event.key === ' ') {
        event.preventDefault();
        onNavigate();
      }
    });
  });
}

function bindClientGlobalActions() {
  document.getElementById('client-back-btn')?.addEventListener('click', () => {
    navigateClient('login');
  });

  const logoutHandler = () => {
    closeClientMenu();
    logoutClient();
    navigateClient('login', { replace: true });
  };

  document.getElementById('client-logout-btn')?.addEventListener('click', logoutHandler);
  document.getElementById('client-logout-btn')?.addEventListener('keydown', (event) => {
    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault();
      logoutHandler();
    }
  });
}

function renderClientPage(route) {
  let safeRoute = validRoutes.has(route) ? route : 'login';
  const profile = getClientProfile();

  if (routes[safeRoute]?.protected && !profile) {
    safeRoute = 'login';
  }

  const routeConfig = routes[safeRoute];
  const isDashboardVariant = routeConfig.layoutOptions?.variant === 'dashboard';

  const layoutOptions = {
    ...routeConfig.layoutOptions,
    currentRoute: safeRoute,
    customerName: isDashboardVariant ? profile?.name || '' : '',
    activeBarbershopName: isDashboardVariant
      ? getActiveBarbershopName(profile)
      : 'Nenhuma barbearia selecionada',
  };

  document.body.className = 'client-area';
  document.body.innerHTML = renderClientLayout(routeConfig.render(), layoutOptions);

  queueMicrotask(() => {
    routeConfig.init?.(navigateClient);
    bindClientRouteTriggers(safeRoute);
    bindClientGlobalActions();
    bindClientDashboardMenu();
    bindScrollHideTopbar();
    closeClientMenu();
    initClientThemeToggle();
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
  renderClientPage(initialRoute);

  window.addEventListener('popstate', () => {
    const route = getClientRouteFromPath(window.location.pathname);
    navigateClient(route, { skipHistory: true });
  });
}
