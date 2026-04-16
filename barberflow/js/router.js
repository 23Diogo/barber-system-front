import { pageTitles } from './constants.js';
import { state, setCurrentPage } from './state.js';
import { updateActiveNav } from './components/sidebar.js';
import { renderAgenda, initAgendaPage } from './modules/agenda.js';
import { renderClientes, initClientesPage } from './modules/clientes.js';
import { renderFinanceiro, initFinanceiroPage } from './modules/financeiro.js';
import { renderEstoque, initEstoquePage } from './modules/estoque.js';
import { renderServicos, initServicosPage } from './modules/servicos.js';
import { renderBarbeiros, initBarbeirosPage } from './modules/barbeiros.js';
import { renderWhatsApp } from './modules/whatsapp.js';
import { renderMarketing, initMarketingPage } from './modules/marketing.js';
import { renderFidelidade, initFidelidadePage } from './modules/fidelidade.js';
import { renderAvaliacoes, initAvaliacoesPage } from './modules/avaliacoes.js';
import { renderConfiguracoes, initConfiguracoesPage } from './modules/configuracoes.js';
import { renderPlanos, initPlanosPage } from './modules/planos.js';

const ADMIN_BASE_PATH = '/app';

const renderers = {
  agenda: renderAgenda,
  clientes: renderClientes,
  fin: renderFinanceiro,
  estoque: renderEstoque,
  servicos: renderServicos,
  barbeiros: renderBarbeiros,
  whats: renderWhatsApp,
  mkt: renderMarketing,
  fidel: renderFidelidade,
  aval: renderAvaliacoes,
  config: renderConfiguracoes,
  planos: renderPlanos,
};

const initializers = {
  agenda: initAgendaPage,
  clientes: initClientesPage,
  fin: initFinanceiroPage,
  estoque: initEstoquePage,
  servicos: initServicosPage,
  barbeiros: initBarbeirosPage,
  mkt: initMarketingPage,
  fidel: initFidelidadePage,
  aval: initAvaliacoesPage,
  config: initConfiguracoesPage,
  planos: initPlanosPage,
};

const validPages = new Set(['dash', ...Object.keys(renderers)]);

function isClientPath(pathname = window.location.pathname) {
  return pathname === '/client' || pathname.startsWith('/client/');
}

function normalizePath(pathname = '/') {
  const trimmed = String(pathname || '/').replace(/\/+$/, '');
  return trimmed || '/';
}

function getPathForPage(pageId) {
  if (pageId === 'dash') return ADMIN_BASE_PATH;
  return `${ADMIN_BASE_PATH}/${pageId}`;
}

function getPageFromPath(pathname = window.location.pathname) {
  const normalized = normalizePath(pathname);

  if (normalized === '/' || normalized === ADMIN_BASE_PATH) {
    return 'dash';
  }

  if (!normalized.startsWith(`${ADMIN_BASE_PATH}/`)) {
    return 'dash';
  }

  const pageId = normalized.slice(`${ADMIN_BASE_PATH}/`.length);
  return validPages.has(pageId) ? pageId : 'dash';
}

function shouldRedirectToAdmin(pathname = window.location.pathname) {
  if (isClientPath(pathname)) return false;

  const normalized = normalizePath(pathname);
  return normalized === '/' || !normalized.startsWith(ADMIN_BASE_PATH);
}

function renderPage(pageId) {
  const container = document.getElementById('pages');
  if (!container) return;

  const renderer = renderers[pageId];
  container.innerHTML = renderer ? `<div class="page active" id="page-${pageId}">${renderer()}</div>` : '';

  const initializer = initializers[pageId];
  if (initializer) queueMicrotask(() => initializer());
}

export function navigate(pageId, options = {}) {
  if (isClientPath()) return;

  const { replace = false, skipHistory = false } = options;
  const safePageId = validPages.has(pageId) ? pageId : 'dash';

  updateActiveNav(safePageId);

  const title = document.getElementById('pageTitle');
  if (title) title.textContent = pageTitles[safePageId] || safePageId.toUpperCase();

  setCurrentPage(safePageId);

  const nextPath = getPathForPage(safePageId);
  const currentPath = normalizePath(window.location.pathname);

  if (!skipHistory && currentPath !== nextPath) {
    const method = replace ? 'replaceState' : 'pushState';
    window.history[method]({ pageId: safePageId }, '', nextPath);
  }

  const hero = document.getElementById('hero');
  const pages = document.getElementById('pages');

  if (safePageId === 'dash') {
    if (hero) hero.style.display = 'block';
    if (pages) pages.style.display = 'none';
    return;
  }

  if (hero) hero.style.display = 'none';
  if (pages) {
    pages.style.display = 'block';
    renderPage(safePageId);
  }
}

export function initRouter() {
  if (isClientPath()) {
    return;
  }

  const initialPage = getPageFromPath(window.location.pathname);
  const replace = shouldRedirectToAdmin(window.location.pathname);

  navigate(initialPage, { replace });

  window.addEventListener('popstate', () => {
    if (isClientPath(window.location.pathname)) return;
    const pageFromUrl = getPageFromPath(window.location.pathname);
    navigate(pageFromUrl, { skipHistory: true });
  });
}

export function refreshCurrentPage() {
  if (state.currentPage !== 'dash') {
    renderPage(state.currentPage);
  }
}
