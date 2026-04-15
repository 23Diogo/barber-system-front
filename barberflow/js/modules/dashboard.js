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
            <button aria-label="Fechar widget" class="widget-close" data-widget-close type="button">×</button>
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
            <button aria-label="Fechar widget" class="widget-close" data-widget-close type="button">×</button>
          </div>
        </div>
        <div id="dashboardAlertasContent"></div>
        <div class="widget-module">Módulo: Agenda</div>
      </div>
    `
  );
}

function formatCompactCurrencyFromCents(cents) {
  const amount = Number(cents || 0) / 100;
  if (amount >= 1000) return `R$${amount.toFixed(1)}k`;
  return `R$${amount.toFixed(0)}`;
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

  const failedInvoices = invoices.filter((invoice) => invoice?.status === 'failed');

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

  return {
    activeSubscriptionsCount: activeSubscriptions.length,
    pendingSubscriptionsCount: pendingSubscriptions.length,
    pastDueSubscriptionsCount: pastDueSubscriptions.length,
    recurringRevenueCents,
    dueTodayCount: dueTodayInvoices.length,
    overdueCount: overdueInvoices.length,
    appointmentsWithPlanTodayCount: appointmentsWithPlanToday.length,
    failedCount: failedInvoices.length,
    topPlans: groupTopPlans(subscriptions),
    updatedAtLabel: new Date().toLocaleTimeString('pt-BR', {
      hour: '2-digit',
      minute: '2-digit',
    }),
  };
}

function getBarHeight(value, maxValue) {
  if (maxValue <= 0) return 16;
  const minHeight = 18;
  const maxHeight = 52;
  return Math.round(minHeight + (value / maxValue) * (maxHeight - minHeight));
}

function renderBars(items) {
  const maxValue = Math.max(...items.map((item) => Number(item.value || 0)), 1);

  return `
    <div class="bar-chart">
      ${items
        .map(
          (item) => `
            <div
              class="bar-col"
              style="height:${getBarHeight(item.value, maxValue)}px;background:${item.color};"
              title="${item.label}: ${item.value}"
            ></div>
          `
        )
        .join('')}
    </div>
    <div class="data-nums">
      ${items.map((item) => `<span>${item.short}</span>`).join('')}
    </div>
  `;
}

function renderMetricRows(items) {
  const maxValue = Math.max(...items.map((item) => Number(item.value || 0)), 1);

  return items
    .map((item) => {
      const width = maxValue ? Math.max((Number(item.value || 0) / maxValue) * 100, item.value > 0 ? 12 : 0) : 0;

      return `
        <div class="data-row">
          <div class="data-name">${item.label}</div>
          <div class="data-bar">
            <div class="data-fill" style="width:${width}%;background:${item.fill || 'linear-gradient(90deg,#4fc3f7,#9c6fff)'}"></div>
          </div>
          <div class="data-val" style="${item.valueColor ? `color:${item.valueColor};` : ''}">
            ${item.displayValue ?? item.value}
          </div>
        </div>
      `;
    })
    .join('');
}

function renderTopPlanRows(topPlans) {
  if (!topPlans.length) {
    return `
      <div class="data-row">
        <div class="data-name" style="min-width:110px;">Top planos</div>
        <div class="data-bar">
          <div class="data-fill" style="width:18%;background:linear-gradient(90deg,#4fc3f7,#9c6fff)"></div>
        </div>
        <div class="data-val">—</div>
      </div>
    `;
  }

  return topPlans
    .map((item) => `
      <div class="data-row">
        <div class="data-name" style="min-width:110px;">${item.planName}</div>
        <div class="data-bar">
          <div class="data-fill" style="width:${Math.min(item.count * 22, 100)}%;background:linear-gradient(90deg,#4fc3f7,#9c6fff)"></div>
        </div>
        <div class="data-val">${item.count}</div>
      </div>
    `)
    .join('');
}

function renderLoadingCard(title) {
  return `
    <div class="ac-value">...</div>
    <div class="ac-sub">Carregando ${title.toLowerCase()}...</div>
    <div class="data-row">
      <div class="data-name">Aguarde</div>
      <div class="data-bar">
        <div class="data-fill" style="width:38%"></div>
      </div>
      <div class="data-val">•</div>
    </div>
  `;
}

function renderMessageCard(message, color = '#5a6888') {
  return `
    <div class="ac-value">—</div>
    <div class="ac-sub" style="color:${color}">${message}</div>
    <div class="data-row">
      <div class="data-name">Status</div>
      <div class="data-bar">
        <div class="data-fill" style="width:24%;background:linear-gradient(90deg,#4fc3f7,#9c6fff)"></div>
      </div>
      <div class="data-val">OK</div>
    </div>
  `;
}

function renderRecorrencia(snapshot) {
  const barItems = [
    { short: 'Atv', label: 'Ativas', value: snapshot.activeSubscriptionsCount, color: 'linear-gradient(180deg,#4fc3f7,#38bdf8)' },
    { short: 'Pnd', label: 'Pendentes', value: snapshot.pendingSubscriptionsCount, color: 'linear-gradient(180deg,#9c6fff,#7c3aed)' },
    { short: 'Ina', label: 'Inadimplentes', value: snapshot.pastDueSubscriptionsCount, color: 'linear-gradient(180deg,#ff6b7a,#ff1744)' },
    { short: 'R$', label: 'Receita', value: Math.max(Math.round(snapshot.recurringRevenueCents / 100), 0), color: 'linear-gradient(180deg,#00e676,#10b981)' },
  ];

  const metricRows = renderMetricRows([
    {
      label: 'Ativas',
      value: snapshot.activeSubscriptionsCount,
      fill: 'linear-gradient(90deg,#4fc3f7,#38bdf8)',
    },
    {
      label: 'Inadimpl.',
      value: snapshot.pastDueSubscriptionsCount,
      fill: 'linear-gradient(90deg,#ff6b7a,#ff1744)',
      valueColor: '#ff6b7a',
    },
    {
      label: 'Pendentes',
      value: snapshot.pendingSubscriptionsCount,
      fill: 'linear-gradient(90deg,#9c6fff,#7c3aed)',
    },
    {
      label: 'Previsto',
      value: Math.round(snapshot.recurringRevenueCents / 100),
      displayValue: formatCompactCurrencyFromCents(snapshot.recurringRevenueCents),
      fill: 'linear-gradient(90deg,#00e676,#10b981)',
      valueColor: '#00e676',
    },
  ]);

  return `
    <div class="ac-value">${formatCompactCurrencyFromCents(snapshot.recurringRevenueCents)}</div>
    <div class="ac-sub">${snapshot.activeSubscriptionsCount} ativas · ${snapshot.pendingSubscriptionsCount} pendentes</div>
    ${renderBars(barItems)}
    ${metricRows}
    ${renderTopPlanRows(snapshot.topPlans)}
    <div class="ac-title" style="margin-top:8px;">Atualizado às ${snapshot.updatedAtLabel}</div>
  `;
}

function renderAlertas(snapshot) {
  const barItems = [
    { short: 'Hoje', label: 'Vencem hoje', value: snapshot.dueTodayCount, color: 'linear-gradient(180deg,#f59e0b,#fb923c)' },
    { short: 'Venc', label: 'Vencidas', value: snapshot.overdueCount, color: 'linear-gradient(180deg,#ff6b7a,#ff1744)' },
    { short: 'Plano', label: 'Plano hoje', value: snapshot.appointmentsWithPlanTodayCount, color: 'linear-gradient(180deg,#4fc3f7,#38bdf8)' },
    { short: 'Falha', label: 'Falhas', value: snapshot.failedCount, color: 'linear-gradient(180deg,#9c6fff,#7c3aed)' },
  ];

  const metricRows = renderMetricRows([
    {
      label: 'Vencem hoje',
      value: snapshot.dueTodayCount,
      fill: 'linear-gradient(90deg,#f59e0b,#fb923c)',
      valueColor: '#f59e0b',
    },
    {
      label: 'Vencidas',
      value: snapshot.overdueCount,
      fill: 'linear-gradient(90deg,#ff6b7a,#ff1744)',
      valueColor: '#ff6b7a',
    },
    {
      label: 'Plano hoje',
      value: snapshot.appointmentsWithPlanTodayCount,
      fill: 'linear-gradient(90deg,#4fc3f7,#38bdf8)',
    },
    {
      label: 'Falhas',
      value: snapshot.failedCount,
      fill: 'linear-gradient(90deg,#9c6fff,#7c3aed)',
    },
  ]);

  return `
    <div class="ac-value">${snapshot.dueTodayCount}</div>
    <div class="ac-sub">${snapshot.overdueCount} vencidas · ${snapshot.appointmentsWithPlanTodayCount} com plano hoje</div>
    ${renderBars(barItems)}
    ${metricRows}
    <div class="ac-title" style="margin-top:8px;">Atualizado às ${snapshot.updatedAtLabel}</div>
  `;
}

function setDashboardWidgetsLoading() {
  const recorrencia = document.getElementById('dashboardRecorrenciaContent');
  const alertas = document.getElementById('dashboardAlertasContent');
  if (!recorrencia || !alertas) return;

  recorrencia.innerHTML = renderLoadingCard('recorrência');
  alertas.innerHTML = renderLoadingCard('alertas');
}

function setDashboardWidgetsMessage(message, tone = 'neutral') {
  const recorrencia = document.getElementById('dashboardRecorrenciaContent');
  const alertas = document.getElementById('dashboardAlertasContent');
  if (!recorrencia || !alertas) return;

  const color = tone === 'error' ? '#ff8a8a' : '#5a6888';
  recorrencia.innerHTML = renderMessageCard(message, color);
  alertas.innerHTML = renderMessageCard(message, color);
}

async function refreshDashboardWidgets() {
  ensureDashboardWidgets();

  const recorrencia = document.getElementById('dashboardRecorrenciaContent');
  const alertas = document.getElementById('dashboardAlertasContent');
  if (!recorrencia || !alertas) return;

  if (!hasApiConfig()) {
    setDashboardWidgetsMessage('Configure a API no login dev para exibir os indicadores reais.');
    return;
  }

  if (!hasAuthToken()) {
    setDashboardWidgetsMessage('Faça login dev para carregar recorrência e alertas.');
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
