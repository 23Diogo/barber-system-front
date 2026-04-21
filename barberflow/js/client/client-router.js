import { renderClientLogin, initClientLoginPage } from './modules/login.js';
import { renderClientRegister, initClientRegisterPage } from './modules/cadastro.js';
import { renderClientHome, initClientHomePage } from './modules/home.js';
import { renderClientForgotPassword, initClientForgotPasswordPage } from './modules/recuperar-senha.js';
import { renderClientLayout } from './client-layout.js';
import { getClientProfile, logoutClient } from '../services/client-auth.js';
import { renderClientAgendar, initClientAgendarPage } from './modules/agendar.js';
import { renderClientAgendamentos, initClientAgendamentosPage } from './modules/agendamentos.js';
import { renderClientPlanos, initClientPlanosPage } from './modules/planos.js';
import { renderClientAssinatura, initClientAssinaturaPage } from './modules/assinatura.js';
import { renderClientDados, initClientDadosPage } from './modules/dados.js';
import { renderClientPagamentos, initClientPagamentosPage } from './modules/pagamentos.js';
import { renderClientSuporte, initClientSuportePage } from './modules/suporte.js';

const CLIENT_BASE = '/client';

function escapeHtml(value) {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

function getActiveBarbershopName(profile) {
  const shops = Array.isArray(profile?.barbershops) ? profile.barbershops : [];

  const preferred =
    shops.find((item) => item?.is_active || item?.is_selected) ||
    shops[0];

  return preferred?.name || 'Nenhuma barbearia selecionada';
}

function renderMetricCard(label, value, sub = '') {
  return `
    <div class="metric-card">
      <div class="metric-label">${escapeHtml(label)}</div>
      <div class="metric-value">${escapeHtml(value)}</div>
      <div class="metric-sub color-nt">${escapeHtml(sub)}</div>
    </div>
  `;
}

function renderCfgRow(label, subtitle, pillText, pillStyle = '') {
  return `
    <div class="cfg-row">
      <div>
        <div class="cfg-label">${escapeHtml(label)}</div>
        <div class="cfg-sub">${escapeHtml(subtitle)}</div>
      </div>
      <span class="pill" style="${pillStyle}">${escapeHtml(pillText)}</span>
    </div>
  `;
}

function renderSimplePortalPage({ title, description, metrics = [], body = '' }) {
  return `
    <div id="pages" style="display:block">
      <div class="page active">
        <div class="card">
          <div class="card-header">
            <div class="card-title">${escapeHtml(title)}</div>
            <div class="card-action" data-client-route="home">Voltar ao início</div>
          </div>

          <div class="review-text" style="margin-bottom:14px;">
            ${escapeHtml(description)}
          </div>

          ${metrics.length ? `<div class="grid-3">${metrics.join('')}</div>` : ''}

          ${body}
        </div>
      </div>
    </div>
  `;
}

function renderAgendarPage() {
  return renderSimplePortalPage({
    title: 'Agendar horário',
    description: 'Aqui ficará o fluxo de seleção de unidade, serviço, barbeiro, data e horário.',
    metrics: [
      renderMetricCard('Status', 'Em breve', 'Fluxo visual preparado'),
      renderMetricCard('Próximo passo', 'API', 'Ligar horários reais'),
      renderMetricCard('Meta', 'Conversão', 'Agendamento simples e rápido'),
    ],
    body: `
      <div class="card">
        <div class="card-header">
          <div class="card-title">Etapas previstas</div>
        </div>

        ${renderCfgRow('Escolher barbearia', 'Suporte para múltiplas barbearias parceiras.', 'Multi')}
        ${renderCfgRow('Escolher serviço', 'Corte, barba, combo e futuros adicionais.', 'Serviços')}
        ${renderCfgRow('Escolher profissional', 'Lista por disponibilidade real.', 'Agenda')}
        ${renderCfgRow('Confirmar horário', 'Com validação e feedback visual.', 'Confirmação')}
      </div>
    `,
  });
}

function renderAgendamentosPage() {
  return renderSimplePortalPage({
    title: 'Meus agendamentos',
    description: 'Aqui ficarão os próximos horários, histórico, cancelamento e reagendamento.',
    metrics: [
      renderMetricCard('Próximos', '0', 'Aguardando integração'),
      renderMetricCard('Histórico', '0', 'Aguardando integração'),
      renderMetricCard('Reagendar', 'Pronto', 'Fluxo previsto'),
    ],
    body: `
      <div class="card">
        <div class="card-header">
          <div class="card-title">Estrutura prevista</div>
        </div>

        ${renderCfgRow('Próximos agendamentos', 'Com status confirmado, pendente ou cancelado.', 'Status')}
        ${renderCfgRow('Histórico', 'Separado por data e por barbearia.', 'Histórico')}
        ${renderCfgRow('Reagendamento', 'Reaproveitando preferências do cliente.', 'Rápido')}
        ${renderCfgRow('Cancelamento', 'Com regra configurável pela barbearia.', 'Regra')}
      </div>
    `,
  });
}

function renderPlanosPage() {
  return renderSimplePortalPage({
    title: 'Contratar plano',
    description: 'Aqui o cliente verá os planos disponíveis da barbearia atual.',
    metrics: [
      renderMetricCard('Planos', '0', 'Aguardando cadastro real'),
      renderMetricCard('Checkout', 'Pronto', 'Estrutura prevista'),
      renderMetricCard('Foco', 'Clareza', 'Oferta simples e direta'),
    ],
    body: `
      <div class="card">
        <div class="card-header">
          <div class="card-title">O que será exibido</div>
        </div>

        ${renderCfgRow('Nome do plano', 'Exibição clara e premium.', 'Oferta')}
        ${renderCfgRow('Benefícios', 'O que inclui e como usar.', 'Benefícios')}
        ${renderCfgRow('Periodicidade', 'Mensal, recorrente ou outro modelo.', 'Cobrança')}
        ${renderCfgRow('Botão de contratação', 'Pronto para integrar com pagamento.', 'CTA')}
      </div>
    `,
  });
}

function renderAssinaturaPage(profile) {
  const planName =
    profile?.subscription?.plan_name ||
    profile?.plan?.name ||
    'Nenhum plano ativo';

  const planStatus =
    profile?.subscription?.status ||
    profile?.plan?.status ||
    'Sem assinatura';

  return renderSimplePortalPage({
    title: 'Meu plano',
    description: 'Aqui o cliente acompanha assinatura, benefícios, uso e status da cobrança.',
    metrics: [
      renderMetricCard('Plano atual', planName, 'Nome do plano'),
      renderMetricCard('Status', planStatus, 'Situação da assinatura'),
      renderMetricCard('Consumo', '0', 'Aguardando regra real'),
    ],
    body: `
      <div class="card">
        <div class="card-header">
          <div class="card-title">Visão prevista</div>
        </div>

        ${renderCfgRow('Benefícios do plano', 'Corte, barba, bônus e regras de uso.', 'Benefícios')}
        ${renderCfgRow('Consumo do mês', 'Separado da contratação para dar clareza.', 'Uso')}
        ${renderCfgRow('Próxima cobrança', 'Quando houver recorrência ativa.', 'Financeiro')}
        ${renderCfgRow('Upgrade / downgrade', 'Fluxo futuro para troca de plano.', 'Evolução')}
      </div>
    `,
  });
}

function renderBarbeariasPage(profile) {
  const shops = Array.isArray(profile?.barbershops) ? profile.barbershops : [];

  const rows = shops.length
    ? shops
        .map(
          (shop) => `
            <div class="row-item">
              <div class="row-avatar" style="background:rgba(79,195,247,.12);color:#4fc3f7;">BF</div>
              <div class="row-info">
                <div class="row-name">${escapeHtml(shop?.name || 'Barbearia')}</div>
                <div class="row-sub">${escapeHtml(shop?.city || 'Barbearia parceira vinculada')}</div>
              </div>
              <div class="row-value">${shop?.is_active || shop?.is_selected ? 'Atual' : 'Vínculo'}</div>
            </div>
          `
        )
        .join('')
    : `
      <div class="alert-row" style="border-color:rgba(79,195,247,.12);background:rgba(79,195,247,.04);">
        <div class="alert-icon">ℹ️</div>
        <div>
          <span class="alert-title">Nenhuma barbearia vinculada por enquanto</span>
          <div class="alert-body">A estrutura já está pronta para suportar um cliente em várias barbearias parceiras.</div>
        </div>
      </div>
    `;

  return renderSimplePortalPage({
    title: 'Minhas barbearias',
    description: 'O mesmo cliente poderá frequentar mais de uma barbearia parceira usando a mesma conta.',
    metrics: [
      renderMetricCard('Barbearias', String(shops.length), 'Vínculos encontrados'),
      renderMetricCard('Conta', 'Única', 'Mesmo login para tudo'),
      renderMetricCard('Troca', 'Pronta', 'Contexto por barbearia'),
    ],
    body: `
      <div class="card">
        <div class="card-header">
          <div class="card-title">Barbearias vinculadas</div>
        </div>
        ${rows}
      </div>
    `,
  });
}

function renderDadosPage(profile) {
  return renderSimplePortalPage({
    title: 'Meus dados',
    description: 'Telefone pode ser alterado. E-mail deve permanecer protegido como identificador principal da conta.',
    metrics: [
      renderMetricCard('Nome', profile?.name || 'Cliente', 'Cadastro atual'),
      renderMetricCard('Telefone', profile?.whatsapp || '-', 'Editável'),
      renderMetricCard('E-mail', profile?.email || '-', 'Protegido'),
    ],
    body: `
      <div class="card">
        <div class="card-header">
          <div class="card-title">Regras recomendadas</div>
        </div>

        ${renderCfgRow(
          'Telefone',
          'Pode ser atualizado pelo cliente para manter contato e operação.',
          'Editável',
          'background:rgba(0,230,118,.1);color:#00e676;'
        )}

        ${renderCfgRow(
          'E-mail',
          'Deve ficar protegido e ser alterado apenas por fluxo seguro com validação.',
          'Protegido',
          'background:rgba(79,195,247,.1);color:#4fc3f7;'
        )}

        ${renderCfgRow(
          'Senha',
          'Mantém recuperação por token e fluxo seguro.',
          'Seguro',
          'background:rgba(156,111,255,.12);color:#c4b5fd;'
        )}
      </div>
    `,
  });
}

function renderPagamentosPage() {
  return renderSimplePortalPage({
    title: 'Pagamentos',
    description: 'Aqui ficarão cobranças do plano, pagamentos avulsos e histórico financeiro do cliente.',
    metrics: [
      renderMetricCard('Cobranças', '0', 'Aguardando integração'),
      renderMetricCard('Recibos', '0', 'Aguardando integração'),
      renderMetricCard('Status', 'Preparado', 'Fluxo visual'),
    ],
    body: `
      <div class="card">
        <div class="card-header">
          <div class="card-title">Itens previstos</div>
        </div>

        ${renderCfgRow('Cobranças do plano', 'Mensalidades e status de aprovação.', 'Plano')}
        ${renderCfgRow('Pagamentos avulsos', 'Serviços fora do plano ou complementos.', 'Avulso')}
        ${renderCfgRow('Histórico', 'Linha do tempo financeira do cliente.', 'Histórico')}
      </div>
    `,
  });
}

function renderSuportePage() {
  return renderSimplePortalPage({
    title: 'Suporte',
    description: 'Canal para dúvidas, ajuda, regras de cancelamento e contato com a barbearia.',
    metrics: [
      renderMetricCard('Canal', 'WhatsApp', 'Atendimento direto'),
      renderMetricCard('Ajuda', 'FAQ', 'Dúvidas frequentes'),
      renderMetricCard('Status', 'Preparado', 'Estrutura visual pronta'),
    ],
    body: `
      <div class="card">
        <div class="card-header">
          <div class="card-title">Estrutura prevista</div>
        </div>

        ${renderCfgRow('Contato da barbearia', 'WhatsApp ou outro canal principal.', 'Contato')}
        ${renderCfgRow('FAQ', 'Perguntas frequentes para reduzir suporte manual.', 'Ajuda')}
        ${renderCfgRow('Políticas', 'Cancelamento, atrasos e regras de uso.', 'Regras')}
      </div>
    `,
  });
}

const routes = {
  login: {
    path: '/client/login',
    render: renderClientLogin,
    init: (navigate) => initClientLoginPage({ navigate }),
    protected: false,
    layoutOptions: {
      variant: 'auth',
      title: 'Entrar',
      subtitle: 'Acesse sua conta',
    },
  },
  cadastro: {
    path: '/client/cadastro',
    render: renderClientRegister,
    init: (navigate) => initClientRegisterPage({ navigate }),
    protected: false,
    layoutOptions: {
      variant: 'auth',
      title: 'Criar conta',
      subtitle: 'Preencha seus dados para começar',
    },
  },
  'recuperar-senha': {
    path: '/client/recuperar-senha',
    render: renderClientForgotPassword,
    init: (navigate) => initClientForgotPasswordPage({ navigate }),
    protected: false,
    layoutOptions: {
      variant: 'auth',
      title: 'Recuperar senha',
      subtitle: 'Enviaremos as instruções para você',
      showBack: true,
    },
  },
  home: {
    path: '/client/home',
    render: renderClientHome,
    init: (navigate) => initClientHomePage({ navigate }),
    protected: true,
    layoutOptions: {
      variant: 'dashboard',
      title: 'INÍCIO',
      subtitle: 'Bem-vindo de volta',
    },
  },
  agendar: {
    path: '/client/agendar',
    render: renderClientAgendar,
    init: (navigate) => initClientAgendarPage({ navigate }),
    protected: true,
    layoutOptions: {
      variant: 'dashboard',
      title: 'AGENDAR HORÁRIO',
    },
  },
  agendamentos: {
    path: '/client/agendamentos',
    render: renderClientAgendamentos,
    init: () => initClientAgendamentosPage(),
    protected: true,
    layoutOptions: {
      variant: 'dashboard',
      title: 'MEUS AGENDAMENTOS',
    },
  },
  planos: {
    path: '/client/planos',
    render: renderClientPlanos,
    init: () => initClientPlanosPage(),
    protected: true,
    layoutOptions: {
      variant: 'dashboard',
      title: 'CONTRATAR PLANO',
    },
  },
  assinatura: {
    path: '/client/assinatura',
    render: renderClientAssinatura,
    init: () => initClientAssinaturaPage(),
    protected: true,
    layoutOptions: {
      variant: 'dashboard',
      title: 'MEU PLANO',
    },
  },
  barbearias: {
    path: '/client/barbearias',
    render: () => renderBarbeariasPage(getClientProfile()),
    protected: true,
    layoutOptions: {
      variant: 'dashboard',
      title: 'MINHAS BARBEARIAS',
    },
  },
  dados: {
    path: '/client/dados',
    render: renderClientDados,
    init: () => initClientDadosPage(),
    protected: true,
    layoutOptions: {
      variant: 'dashboard',
      title: 'MEUS DADOS',
    },
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

  const entry = Object.entries(routes).find(([, config]) => normalizePath(config.path) === normalized);
  return entry?.[0] || 'login';
}

function getPathForRoute(route) {
  return routes[route]?.path || `${CLIENT_BASE}/login`;
}

function bindClientRouteTriggers(currentRoute) {
  const triggers = document.querySelectorAll('[data-client-route]');

  triggers.forEach((element) => {
    const targetRoute = element.getAttribute('data-client-route');
    if (!targetRoute) return;

    if (targetRoute === currentRoute) {
      element.classList.add('active');
    }

    const onNavigate = () => navigateClient(targetRoute);

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
