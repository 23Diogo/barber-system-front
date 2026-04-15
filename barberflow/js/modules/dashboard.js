import {
  hasApiConfig,
  hasAuthToken,
  getSubscriptions,
  getAppointmentsByDate,
  formatDateForApi,
} from '../services/api.js';

const DASHBOARD_REFRESH_INTERVAL_MS = 60000;

let dashboardBootstrapped = false;
let dashboardRefreshTimer = null;
let dashboardAuthRefreshTimer = null;

function ensureDashboardWidgets() {
  const hero = document.getElementById('hero');
  if (!hero) return;

  if (document.getElementById('dashboardWidgetRecorrencia')) return;

  hero.insertAdjacentHTML(
    'beforeend',
    `
      <div
        id="dashboardWidgetRecorrencia"
        class="analytics-card pos-ml dashboard-widget dashboard-widget--recurrence"
        data-target="planos"
        data-widget-id="widget-recorrencia"
        title="Abrir Planos"
      >
        <div class="widget-topbar">
          <div class="ac-title">Recorrência</div>
          <div class="widget-actions">
            <span class="widget-open">abrir ↗</span>
            <button aria-label="Fechar widget" class="widget-close" data-widget-close="" type="button">×</button>
          </div>
        </div>
        <div id="dashboardRecorrenciaContent"></div>
        <div class="widget-module">Módulo: Planos</div>
      </div>

      <div
        id="dashboardWidgetAlertas"
        class="analytics-card pos-mr dashboard-widget dashboard-widget--alerts"
        data-target="agenda"
        data-widget-id="widget-alertas"
        title="Abrir Agenda"
      >
        <div class="widget-topbar">
          <div class="ac-title">Alertas operacionais</div>
          <div class="widget-actions">
            <span class="widget-open">abrir ↗</span>
            <button aria-label="Fechar widget" class="widget-close" data-widget-close="" type="button">×</button>
          </div>
        </div>
        <div id="dashboardAlertasContent"></div>
        <div class="widget-module">Módulo: Agenda</div>
      </div>
    `
  );
}

function formatCurrencyFromCents(cents) {
  const amount = Number(cents || 0) / 100;
  return new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL',
    maximumFractionDigits: 0,
  }).format(amount);
}

function formatCompactCurrencyFromCents(cents) {
  const amount = Number(cents || 0) / 100;
  if (amount >= 1000) return `R$${amount.toFixed(1)}k`;
  return formatCurrencyFromCents(cents);
}

function getDateKey(value) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '';

  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function getTodayStart() {
  const now = new Date();
  now.setHours(0, 0, 0, 0);
  return now;
}

function isBeforeToday(value) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return false;

  date.setHours(0, 0, 0, 0);
  return date.getTime() < getTodayStart().getTime();
}

function getSubscriptionPriceCents(subscription) {
  const plan = subscription?.plans || {};

  const cents = Number(plan.price_cents);
  if (Number.isFinite(cents) && cents > 0) return cents;

  const price = Number(plan.price);
  if (Number.isFinite(price) && price > 0) return Math.round(price * 100);

  return 0;
}

function flattenInvoices(subscriptions) {
  const invoices = [];

  subscriptions.forEach((subscription) => {
    const nestedInvoices = Array.isArray(subscription?.subscription_invoices)
      ? subscription.subscription_invoices
      : [];

    nestedInvoices.forEach((invoice) => {
      invoices.push({
        ...invoice,
        __clientName: subscription?.clients?.name || 'Cliente',
        __planName: subscription?.plans?.name || 'Plano',
        __subscriptionStatus: subscription?.status || '',
      });
    });
  });

  return invoices;
}

function groupTopPlans(subscriptions) {
  const groups = new Map();

  subscriptions
    .filter((subscription) => ['active', 'trialing'].includes(subscription?.status))
    .forEach((subscription) => {
      const planName = subscription?.plans?.name || 'Plano';
      const current = groups.get(planName) || { planName, count: 0 };
      current.count += 1;
      groups.set(planName, current);
    });

  return [...groups.values()]
    .sort((a, b) => b.count - a.count)
    .slice(0, 3);
}

function buildDashboardSnapshot(subscriptionsPayload, appointmentsPayload) {
  const subscriptions = Array.isArray(subscriptionsPayload) ? subscriptionsPayload : [];
  const appointments = Array.isArray(appointmentsPayload) ? appointmentsPayload : [];
  const invoices = flattenInvoices(subscriptions);

  const activeSubscriptions = subscriptions.filter((item) =>
    ['active', 'trialing'].includes(item?.status)
  );
  const pendingSubscriptions = subscriptions.filter(
    (item) => item?.status === 'pending_activation'
  );
  const pastDueSubscriptions = subscriptions.filter((item) => item?.status === 'past_due');

  const recurringRevenueCents = activeSubscriptions.reduce(
    (sum, subscription) => sum + getSubscriptionPriceCents(subscription),
    0
  );

  const todayKey = formatDateForApi(new Date());

  const dueTodayInvoices = invoices.filter(
    (invoice) => invoice?.status === 'pending' && getDateKey(invoice?.due_at) === todayKey
  );

  const overdueInvoices = invoices.filter(
    (invoice) => invoice?.status === 'pending' && invoice?.due_at && isBeforeToday(invoice.due_at)
  );

  const failedInvoices = invoices
    .filter((invoice) => invoice?.status === 'failed')
    .sort((a, b) => {
      const aTime = new Date(a?.updated_at || a?.created_at || a?.due_at || 0).getTime();
      const bTime = new Date(b?.updated_at || b?.created_at || b?.due_at || 0).getTime();
      return bTime - aTime;
    });

  const validSubscriptionStatuses = new Set([
    'active',
    'trialing',
    'pending_activation',
    'past_due',
    'paused',
  ]);

  const subscribedClientIds = new Set(
    subscriptions
      .filter(
        (subscription) =>
          validSubscriptionStatuses.has(subscription?.status) && subscription?.client_id
      )
      .map((subscription) => String(subscription.client_id))
  );

  const appointmentsWithPlanToday = appointments.filter(
    (appointment) =>
      appointment?.client_id &&
      !['cancelled', 'no_show'].includes(appointment?.status) &&
      subscribedClientIds.has(String(appointment.client_id))
  );

  const topPlans = groupTopPlans(subscriptions);

  return {
    activeSubscriptionsCount: activeSubscriptions.length,
    pendingSubscriptionsCount: pendingSubscriptions.length,
    pastDueSubscriptionsCount: pastDueSubscriptions.length,
    recurringRevenueCents,
    dueTodayCount: dueTodayInvoices.length,
    overdueCount: overdueInvoices.length,
    appointmentsWithPlanTodayCount: appointmentsWithPlanToday.length,
    failedCount: failedInvoices.length,
    dueTodayInvoices: dueTodayInvoices.slice(0, 3),
    failedInvoices: failedInvoices.slice(0, 3),
    planAppointments: appointmentsWithPlanToday.slice(0, 3),
    topPlans,
    updatedAtLabel: new Date().toLocaleTimeString('pt-BR', {
      hour: '2-digit',
      minute: '2-digit',
    }),
  };
}

function renderWidgetState(message, tone = 'neutral') {
  return `
    <div class="dashboard-widget-note dashboard-widget-note--${tone}">
      ${message}
    </div>
  `;
}

function renderRecorrencia(snapshot) {
  const topPlansMarkup = snapshot.topPlans.length
    ? snapshot.topPlans
        .map(
          (item) => `
            <div class="dashboard-widget-row">
              <div class="dashboard-widget-row-main">
                <div class="dashboard-widget-row-title">${item.planName}</div>
                <div class="dashboard-widget-row-sub">Plano com mais assinaturas ativas</div>
              </div>
              <div class="dashboard-widget-chip">${item.count}</div>
            </div>
          `
        )
        .join('')
    : `<div class="dashboard-widget-empty">Ainda não há planos ativos suficientes para montar o ranking.</div>`;

  return `
    <div class="ac-value">${formatCompactCurrencyFromCents(snapshot.recurringRevenueCents)}</div>
    <div class="ac-sub">${snapshot.activeSubscriptionsCount} ativas · ${snapshot.pendingSubscriptionsCount} pendentes</div>

    <div class="dashboard-widget-grid">
      <div class="dashboard-widget-stat">
        <div class="dashboard-widget-stat-label">Ativas</div>
        <div class="dashboard-widget-stat-value">${snapshot.activeSubscriptionsCount}</div>
      </div>
      <div class="dashboard-widget-stat">
        <div class="dashboard-widget-stat-label">Inadimplentes</div>
        <div class="dashboard-widget-stat-value is-danger">${snapshot.pastDueSubscriptionsCount}</div>
      </div>
      <div class="dashboard-widget-stat">
        <div class="dashboard-widget-stat-label">Pendentes</div>
        <div class="dashboard-widget-stat-value is-info">${snapshot.pendingSubscriptionsCount}</div>
      </div>
      <div class="dashboard-widget-stat">
        <div class="dashboard-widget-stat-label">Previsto</div>
        <div class="dashboard-widget-stat-value is-success">${formatCompactCurrencyFromCents(snapshot.recurringRevenueCents)}</div>
      </div>
    </div>

    <div class="dashboard-widget-section-title">Top planos ativos</div>
    <div class="dashboard-widget-list">
      ${topPlansMarkup}
    </div>

    <div class="dashboard-widget-footnote">Atualizado às ${snapshot.updatedAtLabel}</div>
  `;
}

function renderAlertas(snapshot) {
  const priorityRows = [];

  if (snapshot.dueTodayInvoices.length) {
    snapshot.dueTodayInvoices.forEach((invoice) => {
      priorityRows.push(`
        <div class="dashboard-widget-row">
          <div class="dashboard-widget-row-main">
            <div class="dashboard-widget-row-title">${invoice.__clientName}</div>
            <div class="dashboard-widget-row-sub">Cobrança vence hoje · ${invoice.__planName}</div>
          </div>
          <div class="dashboard-widget-chip is-warning">Hoje</div>
        </div>
      `);
    });
  }

  if (!priorityRows.length && snapshot.failedInvoices.length) {
    snapshot.failedInvoices.forEach((invoice) => {
      priorityRows.push(`
        <div class="dashboard-widget-row">
          <div class="dashboard-widget-row-main">
            <div class="dashboard-widget-row-title">${invoice.__clientName}</div>
            <div class="dashboard-widget-row-sub">Falha recente · ${invoice.__planName}</div>
          </div>
          <div class="dashboard-widget-chip is-danger">Falha</div>
        </div>
      `);
    });
  }

  if (!priorityRows.length && snapshot.planAppointments.length) {
    snapshot.planAppointments.forEach((appointment) => {
      const clientName = appointment?.clients?.name || 'Cliente';
      priorityRows.push(`
        <div class="dashboard-widget-row">
          <div class="dashboard-widget-row-main">
            <div class="dashboard-widget-row-title">${clientName}</div>
            <div class="dashboard-widget-row-sub">Atendimento hoje com plano</div>
          </div>
          <div class="dashboard-widget-chip is-info">Agenda</div>
        </div>
      `);
    });
  }

  const listMarkup = priorityRows.length
    ? priorityRows.join('')
    : `<div class="dashboard-widget-empty">Nenhum alerta operacional crítico neste momento.</div>`;

  return `
    <div class="ac-value">${snapshot.dueTodayCount}</div>
    <div class="ac-sub">${snapshot.overdueCount} vencidas · ${snapshot.appointmentsWithPlanTodayCount} com plano hoje</div>

    <div class="dashboard-widget-grid">
      <div class="dashboard-widget-stat">
        <div class="dashboard-widget-stat-label">Vencem hoje</div>
        <div class="dashboard-widget-stat-value is-warning">${snapshot.dueTodayCount}</div>
      </div>
      <div class="dashboard-widget-stat">
        <div class="dashboard-widget-stat-label">Vencidas</div>
        <div class="dashboard-widget-stat-value is-danger">${snapshot.overdueCount}</div>
      </div>
      <div class="dashboard-widget-stat">
        <div class="dashboard-widget-stat-label">Plano hoje</div>
        <div class="dashboard-widget-stat-value is-info">${snapshot.appointmentsWithPlanTodayCount}</div>
      </div>
      <div class="dashboard-widget-stat">
        <div class="dashboard-widget-stat-label">Falhas</div>
        <div class="dashboard-widget-stat-value">${snapshot.failedCount}</div>
      </div>
    </div>

    <div class="dashboard-widget-section-title">Prioridades do momento</div>
    <div class="dashboard-widget-list">
      ${listMarkup}
    </div>

    <div class="dashboard-widget-footnote">Atualizado às ${snapshot.updatedAtLabel}</div>
  `;
}

function setDashboardWidgetsLoading() {
  const recorrencia = document.getElementById('dashboardRecorrenciaContent');
  const alertas = document.getElementById('dashboardAlertasContent');
  if (!recorrencia || !alertas) return;

  recorrencia.innerHTML = renderWidgetState('Carregando indicadores de recorrência...', 'neutral');
  alertas.innerHTML = renderWidgetState('Carregando alertas operacionais...', 'neutral');
}

function setDashboardWidgetsMessage(message, tone = 'neutral') {
  const recorrencia = document.getElementById('dashboardRecorrenciaContent');
  const alertas = document.getElementById('dashboardAlertasContent');
  if (!recorrencia || !alertas) return;

  recorrencia.innerHTML = renderWidgetState(message, tone);
  alertas.innerHTML = renderWidgetState(message, tone);
}

async function refreshDashboardWidgets() {
  ensureDashboardWidgets();

  const recorrencia = document.getElementById('dashboardRecorrenciaContent');
  const alertas = document.getElementById('dashboardAlertasContent');
  if (!recorrencia || !alertas) return;

  if (!hasApiConfig()) {
    setDashboardWidgetsMessage('Configure a URL da API no login dev para exibir os indicadores reais.', 'neutral');
    return;
  }

  if (!hasAuthToken()) {
    setDashboardWidgetsMessage('Faça login dev para carregar os indicadores de recorrência e alertas.', 'neutral');
    return;
  }

  setDashboardWidgetsLoading();

  try {
    const today = formatDateForApi(new Date());

    const [subscriptionsPayload, appointmentsPayload] = await Promise.all([
      getSubscriptions(),
      getAppointmentsByDate(today),
    ]);

    const snapshot = buildDashboardSnapshot(subscriptionsPayload, appointmentsPayload);

    recorrencia.innerHTML = renderRecorrencia(snapshot);
    alertas.innerHTML = renderAlertas(snapshot);
  } catch (error) {
    const message =
      error instanceof Error
        ? error.message
        : 'Não foi possível carregar os widgets de recorrência.';
    setDashboardWidgetsMessage(message, 'error');
  }
}

function scheduleAuthRefresh() {
  window.clearTimeout(dashboardAuthRefreshTimer);
  dashboardAuthRefreshTimer = window.setTimeout(() => {
    refreshDashboardWidgets();
  }, 1200);
}

export function initDashboard() {
  ensureDashboardWidgets();

  if (!dashboardBootstrapped) {
    document.addEventListener('visibilitychange', () => {
      if (!document.hidden) {
        refreshDashboardWidgets();
      }
    });

    document.addEventListener('click', (event) => {
      const target = event.target;
      if (!(target instanceof Element)) return;

      if (
        target.closest('#authConnectBtn') ||
        target.closest('#authDisconnectBtn') ||
        target.closest('[data-open-auth-modal="true"]')
      ) {
        scheduleAuthRefresh();
      }
    });

    window.addEventListener('storage', () => {
      refreshDashboardWidgets();
    });

    dashboardRefreshTimer = window.setInterval(() => {
      refreshDashboardWidgets();
    }, DASHBOARD_REFRESH_INTERVAL_MS);

    dashboardBootstrapped = true;
  }

  refreshDashboardWidgets();
  return true;
}
