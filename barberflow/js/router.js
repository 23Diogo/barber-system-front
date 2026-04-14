import { pageTitles } from './constants.js';
import { state, setCurrentPage } from './state.js';
import { updateActiveNav } from './components/sidebar.js';
import { renderAgenda, initAgendaPage } from './modules/agenda.js';
import { renderClientes } from './modules/clientes.js';
import { renderFinanceiro } from './modules/financeiro.js';
import { renderEstoque } from './modules/estoque.js';
import { renderServicos, initServicosPage } from './modules/servicos.js';
import { renderBarbeiros, initBarbeirosPage } from './modules/barbeiros.js';
import { renderWhatsApp } from './modules/whatsapp.js';
import { renderMarketing } from './modules/marketing.js';
import { renderFidelidade } from './modules/fidelidade.js';
import { renderAvaliacoes } from './modules/avaliacoes.js';
import { renderConfiguracoes } from './modules/configuracoes.js';



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
};

const initializers = {
  agenda: initAgendaPage,
  servicos: initServicosPage,
  barbeiros: initBarbeirosPage,
};

function renderPage(pageId) {
  const container = document.getElementById('pages');
  if (!container) return;

  const renderer = renderers[pageId];
  container.innerHTML = renderer ? `<div class="page active" id="page-${pageId}">${renderer()}</div>` : '';

  const initializer = initializers[pageId];
  if (initializer) queueMicrotask(() => initializer());
}

export function navigate(pageId) {
  updateActiveNav(pageId);

  const title = document.getElementById('pageTitle');
  if (title) title.textContent = pageTitles[pageId] || pageId.toUpperCase();

  setCurrentPage(pageId);

  const hero = document.getElementById('hero');
  const pages = document.getElementById('pages');

  if (pageId === 'dash') {
    if (hero) hero.style.display = 'block';
    if (pages) pages.style.display = 'none';
    return;
  }

  if (hero) hero.style.display = 'none';
  if (pages) {
    pages.style.display = 'block';
    renderPage(pageId);
  }
}

export function refreshCurrentPage() {
  if (state.currentPage !== 'dash') {
    renderPage(state.currentPage);
  }
}
