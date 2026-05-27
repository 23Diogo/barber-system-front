import {
  hasApiConfig,
  hasAuthToken,
  apiFetch,
  getSubscriptions,
  getAppointmentsByDate,
  formatDateForApi,
} from '../services/api.js';

const DASHBOARD_REFRESH_INTERVAL_MS = 60000;
const DASHBOARD_WIDGET_PREFS_STORAGE_KEY = 'barberflow.dashboard.widgetPrefs.v23';
const DASHBOARD_WIDGET_DEFAULT_HEIGHT = 380;

const DASHBOARD_WIDGETS = {
  'widget-fin': { contentId: 'dashboardFinContent', label: 'Financeiro', defaultChart: 'bar', target: 'fin' },
  'widget-agenda': { contentId: 'dashboardAgendaContent', label: 'Agenda', defaultChart: 'pie', target: 'agenda' },
  'widget-recorrencia': { contentId: 'dashboardRecorrenciaContent', label: 'Recorrência', defaultChart: 'bar', target: 'planos' },
  'widget-alertas': { contentId: 'dashboardAlertasContent', label: 'Alertas', defaultChart: 'bar', target: 'agenda' },
  'widget-aval': { contentId: 'dashboardAvalContent', label: 'Avaliações', defaultChart: 'bar', target: 'aval' },
  'widget-servicos': { contentId: 'dashboardServicosContent', label: 'Serviços', defaultChart: 'bar', target: 'servicos' },
};

const DASHBOARD_WIDGET_ORDER = [
  'widget-fin',
  'widget-agenda',
  'widget-recorrencia',
  'widget-alertas',
  'widget-aval',
  'widget-servicos',
];

const DASHBOARD_WIDGET_HEIGHT_PRESETS = {
  m: 380,
  g: 470,
  gg: 560,
};

let dashboardBootstrapped = false;
let dashboardRefreshTimer = null;
let dashboardAuthRefreshTimer = null;
let dashboardWidgetControlsBound = false;
let dashboardLastPayload = null;

// ─── Helpers ──────────────────────────────────────────────────────────────────

function toNumber(value, fallback = 0) {
  const n = Number(value);
  return Number.isFinite(n) ? n : fallback;
}

function clamp(value, min, max) {
  return Math.min(Math.max(value, min), max);
}

function formatCurrency(value, options = {}) {
  const n = toNumber(value);
  return new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL',
    minimumFractionDigits: options.minimumFractionDigits ?? 0,
    maximumFractionDigits: options.maximumFractionDigits ?? 0,
  }).format(n);
}

function formatCompactCurrency(value) {
  const n = toNumber(value);
  if (Math.abs(n) >= 1000000) return `R$ ${(n / 1000000).toFixed(1).replace('.', ',')} mi`;
  if (Math.abs(n) >= 1000) return `R$ ${(n / 1000).toFixed(1).replace('.', ',')}k`;
  return formatCurrency(n);
}

function formatCompactCurrencyFromCents(cents) {
  return formatCompactCurrency(toNumber(cents) / 100);
}

function formatPercent(value) {
  return `${Math.round(toNumber(value))}%`;
}

function formatTime(value) {
  if (!value) return '--:--';
  return new Date(value).toLocaleTimeString('pt-BR', {
    hour: '2-digit',
    minute: '2-digit',
    timeZone: 'America/Sao_Paulo',
  });
}

function escapeHtml(v) {
  return String(v ?? '')
    .replace(/&/g,'&amp;')
    .replace(/</g,'&lt;')
    .replace(/>/g,'&gt;')
    .replace(/"/g,'&quot;')
    .replace(/'/g,'&#039;');
}

function getDateKey(value) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '';
  return `${date.getFullYear()}-${String(date.getMonth()+1).padStart(2,'0')}-${String(date.getDate()).padStart(2,'0')}`;
}

function isBeforeToday(value) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return false;
  const today = new Date();
  today.setHours(0,0,0,0);
  date.setHours(0,0,0,0);
  return date.getTime() < today.getTime();
}

function getSubscriptionPriceCents(sub) {
  const plan = sub?.plans || {};
  const cents = toNumber(plan.price_cents);
  if (cents > 0) return cents;
  const price = toNumber(plan.price);
  if (price > 0) return Math.round(price * 100);
  return 0;
}

function resolveAction(target) {
  if (!target) return;

  const nav = document.querySelector(`[data-nav-target="${CSS.escape(target)}"]`);
  if (nav instanceof HTMLElement) {
    nav.click();
  }
}

function actionButton(label, target, tone = 'info') {
  return `<button type="button" class="widget-action-btn is-${tone}" data-dashboard-action="${escapeHtml(target)}">${escapeHtml(label)}</button>`;
}

function statCard(label, value, tone = 'info', caption = '') {
  return `
    <div class="dashboard-widget-stat dashboard-widget-stat--${tone}">
      <div class="dashboard-widget-stat-label">${escapeHtml(label)}</div>
      <div class="dashboard-widget-stat-value is-${tone}">${escapeHtml(value)}</div>
      ${caption ? `<div class="dashboard-widget-stat-caption">${escapeHtml(caption)}</div>` : ''}
    </div>
  `;
}

function progressRow({ label, value, max, display, tone = 'info', fill }) {
  const pct = max > 0 ? clamp((toNumber(value) / max) * 100, value > 0 ? 9 : 0, 100) : 0;
  const fillStyle = fill || `var(--dash-${tone}-gradient)`;

  return `<div class="data-row data-row--pro">
    <div class="data-name">${escapeHtml(label)}</div>
    <div class="data-bar"><div class="data-fill" style="width:${pct}%;background:${fillStyle}"></div></div>
    <div class="data-val data-val--${tone}">${escapeHtml(display ?? value)}</div>
  </div>`;
}

function simpleEmpty(title, text, icon = '◇') {
  return `
    <div class="dashboard-widget-empty dashboard-widget-empty--pro">
      <div class="empty-orb">${escapeHtml(icon)}</div>
      <div>
        <strong>${escapeHtml(title)}</strong>
        <span>${escapeHtml(text)}</span>
      </div>
    </div>
  `;
}

function getAptStatusMeta(status) {
  const map = {
    completed:   { label: 'Concluído',  tone: 'success', color: '#00e676' },
    in_progress: { label: 'Em atendimento', tone: 'info', color: '#4fc3f7' },
    confirmed:   { label: 'Confirmado', tone: 'purple', color: '#9c6fff' },
    pending:     { label: 'Pendente',   tone: 'warning', color: '#f59e0b' },
    scheduled:   { label: 'Agendado',   tone: 'info', color: '#4fc3f7' },
    cancelled:   { label: 'Cancelado',  tone: 'danger', color: '#ff6b7a' },
    no_show:     { label: 'Ausente',    tone: 'danger', color: '#f97316' },
  };
  return map[status] || map.pending;
}

function getDashboardSummary(data) {
  const revenue = data?.revenue || {};
  const appointments = data?.appointments || {};
  const grossIncome = toNumber(revenue.gross_income);
  const totalExpenses = toNumber(revenue.total_expenses);
  const netProfit = toNumber(revenue.net_profit);
  const completed = toNumber(appointments.completed);
  const total = toNumber(appointments.total);
  const pending = toNumber(appointments.pending);
  const cancelled = toNumber(appointments.cancelled);
  const occupancy = toNumber(appointments.occupancy_pct);
  const ticketAvg = completed > 0 ? grossIncome / completed : 0;
  const lowStock = Array.isArray(data?.low_stock) ? data.low_stock : [];
  const todaySchedule = Array.isArray(data?.today_schedule) ? data.today_schedule : [];
  const barberRanking = Array.isArray(data?.barber_ranking) ? data.barber_ranking : [];

  return {
    grossIncome,
    totalExpenses,
    netProfit,
    completed,
    total,
    pending,
    cancelled,
    occupancy,
    ticketAvg,
    lowStock,
    todaySchedule,
    barberRanking,
  };
}

// ─── Widget: Financeiro ───────────────────────────────────────────────────────

function renderFinWidget(data) {
  const summary = getDashboardSummary(data);
  const maxVal = Math.max(summary.grossIncome, summary.totalExpenses, Math.abs(summary.netProfit), 1);
  const healthTone = summary.netProfit < 0 ? 'danger' : summary.grossIncome > 0 ? 'success' : 'info';
  const healthText = summary.grossIncome > 0
    ? `${summary.completed} finalizados · ticket ${formatCompactCurrency(summary.ticketAvg)}`
    : 'Aguardando primeiras movimentações';

  return `
    <div class="widget-hero-line">
      <div>
        <div class="ac-value">${escapeHtml(formatCompactCurrency(summary.grossIncome))}</div>
        <div class="ac-sub ac-sub--${healthTone}">${escapeHtml(healthText)}</div>
      </div>
      <div class="widget-status-pill is-${healthTone}">
        ${summary.netProfit < 0 ? 'Atenção' : summary.grossIncome > 0 ? 'Saudável' : 'Hoje'}
      </div>
    </div>

    <div class="dashboard-widget-grid dashboard-widget-grid--compact">
      ${statCard('Receita', formatCompactCurrency(summary.grossIncome), 'info')}
      ${statCard('Lucro', formatCompactCurrency(summary.netProfit), summary.netProfit < 0 ? 'danger' : 'success')}
      ${statCard('Despesas', formatCompactCurrency(summary.totalExpenses), summary.totalExpenses > 0 ? 'danger' : 'muted')}
      ${statCard('Ocupação', formatPercent(summary.occupancy), summary.occupancy >= 70 ? 'success' : summary.occupancy > 0 ? 'warning' : 'muted')}
    </div>

    <div class="dashboard-widget-section-title">Leitura operacional</div>
    ${[
      { label: 'Receita bruta', value: summary.grossIncome, max: maxVal, display: formatCompactCurrency(summary.grossIncome), tone: 'info', fill: 'linear-gradient(90deg,#4fc3f7,#38bdf8)' },
      { label: 'Lucro líquido', value: Math.max(summary.netProfit, 0), max: maxVal, display: formatCompactCurrency(summary.netProfit), tone: summary.netProfit < 0 ? 'danger' : 'success', fill: summary.netProfit < 0 ? 'linear-gradient(90deg,#ff6b7a,#ff1744)' : 'linear-gradient(90deg,#00e676,#10b981)' },
      { label: 'Atendimentos', value: summary.completed, max: Math.max(summary.total, 1), display: `${summary.completed}/${summary.total}`, tone: 'purple', fill: 'linear-gradient(90deg,#9c6fff,#7c3aed)' },
    ].map(progressRow).join('')}

    <div class="widget-action-row">
      ${actionButton('Abrir financeiro', 'fin', 'info')}
      ${actionButton('Ver agenda', 'agenda', 'purple')}
    </div>
  `;
}

// ─── Widget: Avaliações ───────────────────────────────────────────────────────

function renderAvalWidget(reviews) {
  const list = Array.isArray(reviews) ? reviews : [];

  if (!list.length) {
    return `
      ${simpleEmpty('Reputação ainda sem dados', 'Quando chegarem avaliações, o dono vê satisfação, média e distribuição por nota.', '★')}
      <div class="widget-action-row">
        ${actionButton('Abrir avaliações', 'aval', 'purple')}
      </div>
    `;
  }

  const total = list.length;
  const avgRating = list.reduce((s, r) => s + toNumber(r.rating), 0) / total;
  const positive = list.filter(r => toNumber(r.rating) >= 4).length;
  const satisfaction = Math.round((positive / total) * 100);
  const tone = satisfaction >= 85 ? 'success' : satisfaction >= 60 ? 'warning' : 'danger';

  const dist = [5,4,3,2,1].map(star => {
    const count = list.filter(r => toNumber(r.rating) === star).length;
    const pct = total > 0 ? Math.round((count / total) * 100) : 0;
    const rowTone = star >= 4 ? 'purple' : star === 3 ? 'warning' : 'danger';
    return progressRow({
      label: `${star}★`,
      value: pct,
      max: 100,
      display: count,
      tone: rowTone,
      fill: star >= 4 ? 'linear-gradient(90deg,#9c6fff,#7c3aed)' : star === 3 ? 'linear-gradient(90deg,#f59e0b,#fb923c)' : 'linear-gradient(90deg,#ff6b7a,#ff1744)',
    });
  }).join('');

  return `
    <div class="widget-hero-line">
      <div>
        <div class="ac-value ac-value--purple">${satisfaction}%</div>
        <div class="ac-sub ac-sub--purple">${total} avaliação${total === 1 ? '' : 'ões'} · média ${avgRating.toFixed(1)}★</div>
      </div>
      <div class="widget-status-pill is-${tone}">
        ${tone === 'success' ? 'Excelente' : tone === 'warning' ? 'Monitorar' : 'Crítico'}
      </div>
    </div>

    <div class="dashboard-widget-section-title">Distribuição por nota</div>
    ${dist}

    <div class="widget-action-row">
      ${actionButton('Ver avaliações', 'aval', 'purple')}
      ${actionButton('Fidelizar', 'fidel', 'success')}
    </div>
  `;
}

// ─── Widget: Agenda ───────────────────────────────────────────────────────────

function renderAgendaWidget(data) {
  const summary = getDashboardSummary(data);
  const schedule = summary.todaySchedule;
  const next = schedule.find(apt => !['completed','cancelled','no_show'].includes(apt?.status)) || schedule[0];

  const statusCounts = schedule.reduce((acc, apt) => {
    const status = apt?.status || 'pending';
    acc[status] = (acc[status] || 0) + 1;
    return acc;
  }, {});

  const nextHtml = next ? (() => {
    const meta = getAptStatusMeta(next.status);
    const clientName = next?.clients?.name || 'Cliente';
    const serviceName = next?.services?.name || 'Serviço';
    return `
      <div class="dashboard-widget-feature-row">
        <div class="feature-time">${escapeHtml(formatTime(next.scheduled_at))}</div>
        <div class="feature-main">
          <strong>${escapeHtml(clientName)}</strong>
          <span>${escapeHtml(serviceName)} · ${escapeHtml(meta.label)}</span>
        </div>
        <div class="dashboard-widget-chip is-${meta.tone}">Próximo</div>
      </div>
    `;
  })() : simpleEmpty('Agenda livre hoje', 'Nenhum horário movimentando a operação até agora.', '📅');

  const rows = [
    { label: 'Confirmados', value: toNumber(statusCounts.confirmed) + toNumber(statusCounts.scheduled), max: Math.max(schedule.length, 1), tone: 'purple' },
    { label: 'Pendentes', value: toNumber(statusCounts.pending), max: Math.max(schedule.length, 1), tone: 'warning' },
    { label: 'Concluídos', value: toNumber(statusCounts.completed), max: Math.max(schedule.length, 1), tone: 'success' },
  ].map(item => progressRow({
    ...item,
    display: item.value,
    fill: item.tone === 'success'
      ? 'linear-gradient(90deg,#00e676,#10b981)'
      : item.tone === 'warning'
        ? 'linear-gradient(90deg,#f59e0b,#fb923c)'
        : 'linear-gradient(90deg,#9c6fff,#7c3aed)',
  })).join('');

  return `
    <div class="widget-hero-line">
      <div>
        <div class="ac-value">${schedule.length}</div>
        <div class="ac-sub ac-sub--info">${summary.completed} concluídos · ${summary.occupancy}% ocupação</div>
      </div>
      <div class="widget-status-pill is-info">Hoje</div>
    </div>

    ${nextHtml}

    <div class="dashboard-widget-section-title">Ritmo da agenda</div>
    ${rows}

    <div class="widget-action-row">
      ${actionButton('Abrir agenda', 'agenda', 'info')}
      ${actionButton('Clientes', 'clientes', 'purple')}
    </div>
  `;
}

// ─── Widget: Serviços ─────────────────────────────────────────────────────────

function renderServicosWidget(data) {
  const schedule = getDashboardSummary(data).todaySchedule;

  const counts = {};
  schedule.forEach(apt => {
    const name = apt?.services?.name || 'Serviço';
    counts[name] = (counts[name] || 0) + 1;
  });

  const sorted = Object.entries(counts)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 4);

  if (!sorted.length) {
    return `
      ${simpleEmpty('Sem serviços executados hoje', 'Quando a agenda movimentar, os serviços mais fortes aparecem aqui.', '✂️')}
      <div class="widget-action-row">
        ${actionButton('Abrir serviços', 'servicos', 'info')}
        ${actionButton('Nova agenda', 'agenda', 'purple')}
      </div>
    `;
  }

  const maxCount = Math.max(...sorted.map(([,c]) => c), 1);
  const barCols = sorted.map(([, count], index) => {
    const h = Math.max(Math.round((count / maxCount) * 64), 16);
    const gradients = [
      'linear-gradient(180deg,#4fc3f7,#0066ff)',
      'linear-gradient(180deg,#9c6fff,#7c3aed)',
      'linear-gradient(180deg,#00e676,#10b981)',
      'linear-gradient(180deg,#f59e0b,#fb923c)',
    ];
    return `<div class="bar-col bar-col--pro" style="height:${h}px;background:${gradients[index % gradients.length]}"></div>`;
  }).join('');

  const barNums = sorted.map(([name]) => `<span>${escapeHtml(String(name).slice(0, 8))}</span>`).join('');

  const rows = sorted.map(([name, count]) => progressRow({
    label: name,
    value: count,
    max: maxCount,
    display: count,
    tone: 'info',
    fill: 'linear-gradient(90deg,#4fc3f7,#9c6fff)',
  })).join('');

  return `
    <div class="widget-hero-line">
      <div>
        <div class="ac-value">${sorted[0]?.[1] || 0}</div>
        <div class="ac-sub ac-sub--info">Serviço mais movimentado: ${escapeHtml(sorted[0]?.[0] || '—')}</div>
      </div>
      <div class="widget-status-pill is-info">Hoje</div>
    </div>

    <div class="bar-chart bar-chart--pro">${barCols}</div>
    <div class="data-nums data-nums--pro">${barNums}</div>

    <div class="dashboard-widget-section-title">Ranking de serviços</div>
    ${rows}

    <div class="widget-action-row">
      ${actionButton('Abrir serviços', 'servicos', 'info')}
    </div>
  `;
}

// ─── Widgets dinâmicos: Recorrência / Alertas ─────────────────────────────────

function ensureDashboardWidgets() {
  const hero = document.getElementById('hero');
  if (!hero) return;

  if (!document.getElementById('dashboardWidgetRecorrencia')) {
    hero.insertAdjacentHTML('beforeend', `
    <div id="dashboardWidgetRecorrencia"
      class="analytics-card pos-ml dashboard-widget dashboard-widget--recurrence"
      data-widget-target="planos" data-widget-id="widget-recorrencia">
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

    <div id="dashboardWidgetAlertas"
      class="analytics-card pos-mr dashboard-widget dashboard-widget--alerts"
      data-widget-target="agenda" data-widget-id="widget-alertas">
      <div class="widget-topbar">
        <div class="ac-title">Atenção necessária</div>
        <div class="widget-actions">
          <span class="widget-open">abrir ↗</span>
          <button aria-label="Fechar widget" class="widget-close" data-widget-close type="button">×</button>
        </div>
      </div>
      <div id="dashboardAlertasContent"></div>
      <div class="widget-module">Módulo: Operação</div>
    </div>
  `);
  }

  ensureDashboardWidgetLayer();
  enhanceDashboardWidgets();
}

function flattenInvoices(subscriptions) {
  const invoices = [];
  subscriptions.forEach(sub => {
    (Array.isArray(sub?.subscription_invoices) ? sub.subscription_invoices : [])
      .forEach(inv => invoices.push({
        ...inv,
        __clientName: sub?.clients?.name || 'Cliente',
        __planName: sub?.plans?.name || 'Plano',
      }));
  });
  return invoices;
}

function groupTopPlans(subscriptions) {
  const groups = new Map();
  subscriptions
    .filter(s => ['active','trialing'].includes(s?.status))
    .forEach(s => {
      const name = s?.plans?.name || 'Plano';
      const cur = groups.get(name) || { planName: name, count: 0 };
      cur.count += 1;
      groups.set(name, cur);
    });
  return [...groups.values()].sort((a,b) => b.count - a.count).slice(0,3);
}

function buildOperationalSnapshot(subscriptions, appointments, dashData) {
  const subs = Array.isArray(subscriptions) ? subscriptions : [];
  const apts = Array.isArray(appointments) ? appointments : [];
  const invoices = flattenInvoices(subs);
  const dashboard = dashData || {};

  const active = subs.filter(s => ['active','trialing'].includes(s?.status));
  const pending = subs.filter(s => s?.status === 'pending_activation');
  const pastDue = subs.filter(s => s?.status === 'past_due');

  const revCents = active.reduce((sum, s) => sum + getSubscriptionPriceCents(s), 0);
  const todayKey = formatDateForApi(new Date());

  const dueToday = invoices.filter(i => i?.status === 'pending' && getDateKey(i?.due_at) === todayKey);
  const overdue = invoices.filter(i => i?.status === 'pending' && i?.due_at && isBeforeToday(i.due_at));
  const failed = invoices.filter(i => i?.status === 'failed');

  const subscribedIds = new Set(
    subs
      .filter(s => ['active','trialing','pending_activation','past_due','paused'].includes(s?.status) && s?.client_id)
      .map(s => String(s.client_id))
  );

  const aptsWithPlan = apts.filter(a =>
    a?.client_id &&
    !['cancelled','no_show'].includes(a?.status) &&
    subscribedIds.has(String(a.client_id))
  );

  const lowStock = Array.isArray(dashboard?.low_stock) ? dashboard.low_stock : [];
  const criticalStock = lowStock.filter(item => toNumber(item.current_stock) <= 0 || toNumber(item.stock_diff) <= -10);
  const agendaPending = Array.isArray(dashboard?.today_schedule)
    ? dashboard.today_schedule.filter(a => ['pending','scheduled'].includes(a?.status)).length
    : 0;

  return {
    activeCount: active.length,
    pendingCount: pending.length,
    pastDueCount: pastDue.length,
    revCents,
    dueTodayCount: dueToday.length,
    overdueCount: overdue.length,
    aptsWithPlanCount: aptsWithPlan.length,
    failedCount: failed.length,
    topPlans: groupTopPlans(subs),
    lowStockCount: lowStock.length,
    criticalStockCount: criticalStock.length,
    agendaPending,
    mostCriticalStock: lowStock[0] || null,
    updatedAt: new Date().toLocaleTimeString('pt-BR', { hour:'2-digit', minute:'2-digit' }),
  };
}

function renderBars(items) {
  const maxVal = Math.max(...items.map(i => toNumber(i.value)), 1);
  const minH = 18;
  const maxH = 64;

  return `
    <div class="bar-chart bar-chart--pro">
      ${items.map(i => {
        const h = Math.round(minH + (toNumber(i.value) / maxVal) * (maxH - minH));
        return `<div class="bar-col bar-col--pro" style="height:${h}px;background:${i.color}" title="${escapeHtml(i.label)}: ${escapeHtml(i.value)}"></div>`;
      }).join('')}
    </div>
    <div class="data-nums data-nums--pro">${items.map(i => `<span>${escapeHtml(i.short)}</span>`).join('')}</div>
  `;
}

function renderMetricRows(items) {
  const maxVal = Math.max(...items.map(i => toNumber(i.value)), 1);
  return items.map(i => progressRow({
    label: i.label,
    value: i.value,
    max: maxVal,
    display: i.displayValue ?? i.value,
    tone: i.tone || 'info',
    fill: i.fill,
  })).join('');
}

function renderTopPlanRows(topPlans) {
  if (!topPlans.length) {
    return simpleEmpty('Nenhum plano ativo ainda', 'Crie planos para gerar receita recorrente e fidelizar clientes.', '♻');
  }

  const maxCount = Math.max(...topPlans.map(p => p.count), 1);
  return topPlans.map(p => progressRow({
    label: p.planName,
    value: p.count,
    max: maxCount,
    display: p.count,
    tone: 'purple',
    fill: 'linear-gradient(90deg,#9c6fff,#7c3aed)',
  })).join('');
}

function renderRecorrencia(snap) {
  const tone = snap.pastDueCount > 0 ? 'danger' : snap.pendingCount > 0 ? 'warning' : snap.activeCount > 0 ? 'success' : 'info';

  return `
    <div class="widget-hero-line">
      <div>
        <div class="ac-value">${formatCompactCurrencyFromCents(snap.revCents)}</div>
        <div class="ac-sub ac-sub--${tone}">${snap.activeCount} ativas · ${snap.pendingCount} pendentes · ${snap.pastDueCount} inadimpl.</div>
      </div>
      <div class="widget-status-pill is-${tone}">
        ${snap.pastDueCount > 0 ? 'Cobrar' : snap.activeCount > 0 ? 'Recorrente' : 'Criar'}
      </div>
    </div>

    ${renderBars([
      { short:'Atv', label:'Ativas', value:snap.activeCount, color:'linear-gradient(180deg,#4fc3f7,#38bdf8)' },
      { short:'Pnd', label:'Pendentes', value:snap.pendingCount, color:'linear-gradient(180deg,#9c6fff,#7c3aed)' },
      { short:'Ina', label:'Inadimplentes', value:snap.pastDueCount, color:'linear-gradient(180deg,#ff6b7a,#ff1744)' },
      { short:'R$', label:'Receita prevista', value:Math.round(snap.revCents / 100), color:'linear-gradient(180deg,#00e676,#10b981)' },
    ])}

    <div class="dashboard-widget-section-title">Planos que puxam receita</div>
    ${renderTopPlanRows(snap.topPlans)}

    <div class="widget-action-row">
      ${actionButton('Abrir planos', 'planos', 'purple')}
      ${actionButton('Clientes', 'clientes', 'info')}
    </div>
  `;
}

function renderAlertas(snap) {
  const totalCritical = snap.overdueCount + snap.failedCount + snap.criticalStockCount + snap.pastDueCount;
  const totalAttention = totalCritical + snap.dueTodayCount + snap.lowStockCount + snap.agendaPending;
  const tone = totalCritical > 0 ? 'danger' : totalAttention > 0 ? 'warning' : 'success';

  const stockText = snap.mostCriticalStock
    ? `${snap.mostCriticalStock.name || 'Produto'}: ${toNumber(snap.mostCriticalStock.current_stock)} em estoque`
    : 'Nenhum item crítico informado';

  return `
    <div class="widget-hero-line">
      <div>
        <div class="ac-value">${totalAttention}</div>
        <div class="ac-sub ac-sub--${tone}">
          ${totalCritical} crítico${totalCritical === 1 ? '' : 's'} · ${snap.lowStockCount} estoque · ${snap.overdueCount} vencida${snap.overdueCount === 1 ? '' : 's'}
        </div>
      </div>
      <div class="widget-status-pill is-${tone}">
        ${tone === 'success' ? 'Tudo ok' : tone === 'warning' ? 'Atenção' : 'Crítico'}
      </div>
    </div>

    <div class="dashboard-widget-grid dashboard-widget-grid--compact">
      ${statCard('Vencidas', String(snap.overdueCount), snap.overdueCount > 0 ? 'danger' : 'muted')}
      ${statCard('Falhas', String(snap.failedCount), snap.failedCount > 0 ? 'danger' : 'muted')}
      ${statCard('Estoque', String(snap.lowStockCount), snap.lowStockCount > 0 ? 'warning' : 'success')}
      ${statCard('Agenda', String(snap.agendaPending), snap.agendaPending > 0 ? 'warning' : 'success')}
    </div>

    <div class="dashboard-widget-feature-row dashboard-widget-feature-row--alert">
      <div class="feature-time">!</div>
      <div class="feature-main">
        <strong>${snap.lowStockCount > 0 ? 'Estoque pedindo atenção' : 'Operação sem ruptura crítica'}</strong>
        <span>${escapeHtml(stockText)}</span>
      </div>
      <div class="dashboard-widget-chip is-${snap.lowStockCount > 0 ? 'warning' : 'success'}">${snap.lowStockCount}</div>
    </div>

    ${renderMetricRows([
      { label:'Vencem hoje', value:snap.dueTodayCount, fill:'linear-gradient(90deg,#f59e0b,#fb923c)', tone:'warning' },
      { label:'Inadimpl.', value:snap.pastDueCount, fill:'linear-gradient(90deg,#ff6b7a,#ff1744)', tone:'danger' },
      { label:'Com plano hoje', value:snap.aptsWithPlanCount, fill:'linear-gradient(90deg,#4fc3f7,#38bdf8)', tone:'info' },
    ])}

    <div class="widget-action-row">
      ${actionButton('Resolver alertas', 'estoque', 'warning')}
      ${actionButton('Abrir agenda', 'agenda', 'info')}
    </div>
  `;
}


// ─── Widget preferences, charts and resize ───────────────────────────────────

function readDashboardWidgetPrefs() {
  try {
    const parsed = JSON.parse(localStorage.getItem(DASHBOARD_WIDGET_PREFS_STORAGE_KEY) || '{}');
    return parsed && typeof parsed === 'object' ? parsed : {};
  } catch {
    return {};
  }
}

function writeDashboardWidgetPrefs(prefs) {
  try {
    localStorage.setItem(DASHBOARD_WIDGET_PREFS_STORAGE_KEY, JSON.stringify(prefs || {}));
  } catch {
    // noop
  }
}

function getWidgetPrefs(widgetId) {
  const all = readDashboardWidgetPrefs();
  const meta = DASHBOARD_WIDGETS[widgetId] || {};
  return {
    mode: all?.[widgetId]?.mode || 'summary',
    chart: all?.[widgetId]?.chart || meta.defaultChart || 'bar',
    size: all?.[widgetId]?.size || 'm',
    height: toNumber(all?.[widgetId]?.height, DASHBOARD_WIDGET_DEFAULT_HEIGHT),
    span: toNumber(all?.[widgetId]?.span, 1),
    hidden: Boolean(all?.[widgetId]?.hidden),
  };
}

function updateWidgetPrefs(widgetId, patch = {}) {
  const all = readDashboardWidgetPrefs();
  const current = getWidgetPrefs(widgetId);
  all[widgetId] = { ...current, ...patch };
  writeDashboardWidgetPrefs(all);
  return all[widgetId];
}

function resetDashboardWidgetPrefs() {
  try {
    localStorage.removeItem(DASHBOARD_WIDGET_PREFS_STORAGE_KEY);
  } catch {
    // noop
  }
}

function ensureDashboardWidgetLayer() {
  const hero = document.getElementById('hero');
  if (!hero) return null;

  let layer = document.getElementById('dashboardWidgetLayer');
  if (!layer) {
    layer = document.createElement('div');
    layer.id = 'dashboardWidgetLayer';
    layer.className = 'dashboard-widget-layer';
    hero.appendChild(layer);
  }

  DASHBOARD_WIDGET_ORDER.forEach(widgetId => {
    const widget = hero.querySelector(`[data-widget-id="${widgetId}"]`);
    if (widget && widget.parentElement !== layer) {
      layer.appendChild(widget);
    }
  });

  return layer;
}

function widgetContentElement(widgetId) {
  const contentId = DASHBOARD_WIDGETS[widgetId]?.contentId;
  return contentId ? document.getElementById(contentId) : null;
}

function getWidgetElement(widgetId) {
  return document.querySelector(`[data-widget-id="${CSS.escape(widgetId)}"]`);
}

function getWidgetModuleTarget(widgetId) {
  const widget = getWidgetElement(widgetId);
  const meta = DASHBOARD_WIDGETS[widgetId] || {};
  return String(
    widget?.dataset?.widgetTarget ||
    widget?.dataset?.target ||
    meta.target ||
    ''
  ).trim();
}

function normalizeDashboardWidgetNavigationTargets() {
  document.querySelectorAll('.dashboard-widget[data-widget-id]').forEach(widget => {
    if (!(widget instanceof HTMLElement)) return;

    const widgetId = widget.dataset.widgetId || '';
    const moduleTarget = getWidgetModuleTarget(widgetId);

    if (moduleTarget) {
      widget.dataset.widgetTarget = moduleTarget;
    }

    // Importante: o widget inteiro não deve navegar ao módulo.
    // A navegação deve acontecer somente pelos botões explícitos do widget.
    widget.removeAttribute('data-target');
    widget.removeAttribute('title');

    const label = DASHBOARD_WIDGETS[widgetId]?.label || 'Widget';
    widget.setAttribute('aria-label', `${label}. Use os botões internos para abrir o módulo.`);
  });
}

function updateRestoreWidgetsButtonState() {
  const restoreButton = document.getElementById('restoreWidgetsBtn');
  if (!(restoreButton instanceof HTMLButtonElement)) return;

  const hasHiddenWidgets = DASHBOARD_WIDGET_ORDER.some(widgetId => getWidgetPrefs(widgetId).hidden);

  restoreButton.disabled = !hasHiddenWidgets;
  restoreButton.textContent = hasHiddenWidgets ? 'Restaurar widgets' : 'Widgets ativos';
}

function updateWidgetChrome(widget) {
  if (!(widget instanceof HTMLElement)) return;
  const widgetId = widget.dataset.widgetId;
  if (!widgetId) return;

  const prefs = getWidgetPrefs(widgetId);
  widget.dataset.widgetMode = prefs.mode;
  widget.dataset.widgetChart = prefs.chart;
  widget.dataset.widgetSize = prefs.size;

  widget.classList.toggle('widget-hidden', prefs.hidden === true);
  widget.setAttribute('aria-hidden', prefs.hidden === true ? 'true' : 'false');

  widget.classList.toggle('widget-span-2', prefs.span === 2);

  const height = clamp(toNumber(prefs.height, DASHBOARD_WIDGET_DEFAULT_HEIGHT), 300, 760);
  widget.style.setProperty('--widget-custom-height', `${height}px`);

  widget.querySelectorAll('[data-widget-mode]').forEach(btn => {
    btn.classList.toggle('is-active', btn.dataset.widgetMode === prefs.mode);
  });

  widget.querySelectorAll('[data-widget-chart]').forEach(btn => {
    btn.classList.toggle('is-active', btn.dataset.widgetChart === prefs.chart);
  });

  widget.querySelectorAll('[data-widget-size]').forEach(btn => {
    const key = btn.dataset.widgetSize;
    const active = key === prefs.size || (key === 'wide' && prefs.span === 2);
    btn.classList.toggle('is-active', active);
  });

  updateRestoreWidgetsButtonState();
}

function enhanceDashboardWidgets() {
  ensureDashboardWidgetLayer();
  normalizeDashboardWidgetNavigationTargets();

  document.querySelectorAll('.dashboard-widget[data-widget-id]').forEach(widget => {
    if (!(widget instanceof HTMLElement)) return;

    const widgetId = widget.dataset.widgetId;
    const topbar = widget.querySelector('.widget-topbar');
    const actions = widget.querySelector('.widget-actions');

    if (!widgetId || !topbar || !actions) return;

    if (!actions.querySelector('[data-widget-close]')) {
      actions.insertAdjacentHTML(
        'beforeend',
        '<button aria-label="Fechar widget" class="widget-close" data-widget-close type="button">×</button>'
      );
    }

    if (!actions.querySelector('[data-widget-tools]')) {
      actions.insertAdjacentHTML('afterbegin', `
        <div class="widget-view-tools" data-widget-tools>
          <button type="button" class="widget-tool-btn" data-widget-mode="summary" title="Ver resumo operacional">Resumo</button>
          <button type="button" class="widget-tool-btn" data-widget-mode="chart" title="Ver como gráfico">Gráfico</button>
          <span class="widget-tool-sep"></span>
          <button type="button" class="widget-tool-btn widget-tool-btn--icon" data-widget-chart="bar" title="Gráfico de barras">▥</button>
          <button type="button" class="widget-tool-btn widget-tool-btn--icon" data-widget-chart="pie" title="Gráfico de pizza/donut">◔</button>
          <button type="button" class="widget-tool-btn widget-tool-btn--icon" data-widget-chart="trend" title="Linha de tendência">⌁</button>
          <span class="widget-tool-sep"></span>
          <button type="button" class="widget-tool-btn widget-tool-btn--icon" data-widget-size="m" title="Altura média">M</button>
          <button type="button" class="widget-tool-btn widget-tool-btn--icon" data-widget-size="g" title="Altura grande">G</button>
          <button type="button" class="widget-tool-btn widget-tool-btn--icon" data-widget-size="gg" title="Altura extra grande">GG</button>
          <button type="button" class="widget-tool-btn widget-tool-btn--icon" data-widget-size="wide" title="Ocupar 2 colunas">↔</button>
        </div>
      `);
    }

    if (!widget.querySelector('[data-widget-resize-handle]')) {
      widget.insertAdjacentHTML('beforeend', `
        <button type="button" class="widget-resize-edge" data-widget-resize-edge aria-label="Ajustar altura do widget" title="Arraste para ajustar a altura"></button>
        <button type="button" class="widget-resize-handle" data-widget-resize-handle aria-label="Redimensionar widget" title="Arraste para redimensionar"></button>
      `);
    }

    updateWidgetChrome(widget);
  });
}

function renderDashboardWidgetContent(widgetId) {
  const prefs = getWidgetPrefs(widgetId);
  const state = dashboardLastPayload || {};

  if (prefs.mode === 'chart') {
    return renderWidgetChart(widgetId, prefs.chart, state);
  }

  switch (widgetId) {
    case 'widget-fin': return renderFinWidget(state.dashData);
    case 'widget-agenda': return renderAgendaWidget(state.dashData);
    case 'widget-recorrencia': return renderRecorrencia(state.snap || buildOperationalSnapshot(state.subscriptions, state.todayApts, state.dashData));
    case 'widget-alertas': return renderAlertas(state.snap || buildOperationalSnapshot(state.subscriptions, state.todayApts, state.dashData));
    case 'widget-aval': return renderAvalWidget(state.reviews);
    case 'widget-servicos': return renderServicosWidget(state.dashData);
    default: return simpleEmpty('Widget sem configuração', 'Não foi possível montar este card.', '◇');
  }
}

function renderAllDashboardWidgets() {
  enhanceDashboardWidgets();

  DASHBOARD_WIDGET_ORDER.forEach(widgetId => {
    const content = widgetContentElement(widgetId);
    if (content) content.innerHTML = renderDashboardWidgetContent(widgetId);
    const widget = getWidgetElement(widgetId);
    if (widget instanceof HTMLElement) updateWidgetChrome(widget);
  });
}

function chartItem(label, value, tone = 'info') {
  return { label, value: Math.max(0, toNumber(value)), tone };
}

function getServiceChartItems(data) {
  const schedule = getDashboardSummary(data).todaySchedule;
  const counts = {};
  schedule.forEach(apt => {
    const name = apt?.services?.name || 'Serviço';
    counts[name] = (counts[name] || 0) + 1;
  });
  return Object.entries(counts)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 6)
    .map(([label, value]) => chartItem(label, value, 'info'));
}

function getReviewChartItems(reviews) {
  const list = Array.isArray(reviews) ? reviews : [];
  return [5,4,3,2,1].map(star => {
    const value = list.filter(r => toNumber(r.rating) === star).length;
    return chartItem(`${star}★`, value, star >= 4 ? 'purple' : star === 3 ? 'warning' : 'danger');
  });
}

function getTrendFromRevenueChart(revenueChart) {
  const rows = Array.isArray(revenueChart) ? revenueChart : [];
  return rows.slice(-12).map((row, index) => ({
    label: row?.day ? String(row.day).slice(5) : `D${index + 1}`,
    value: toNumber(row?.gross_income ?? row?.revenue ?? row?.income ?? row?.total ?? row?.amount),
    tone: 'info',
  })).filter(item => item.value > 0 || rows.length > 0);
}

function getWidgetChartItems(widgetId, state = dashboardLastPayload || {}) {
  const dash = state.dashData || {};
  const summary = getDashboardSummary(dash);
  const snap = state.snap || buildOperationalSnapshot(state.subscriptions, state.todayApts, dash);
  const appointments = dash?.appointments || {};
  const today = dash?.today || {};

  if (widgetId === 'widget-fin') {
    return [
      chartItem('Receita', summary.grossIncome, 'info'),
      chartItem('Lucro', Math.max(summary.netProfit, 0), 'success'),
      chartItem('Despesas', summary.totalExpenses, 'danger'),
      chartItem('Ticket', summary.ticketAvg, 'purple'),
    ];
  }

  if (widgetId === 'widget-agenda') {
    return [
      chartItem('Confirmados', toNumber(appointments.confirmed) + toNumber(today.confirmed), 'purple'),
      chartItem('Pendentes', toNumber(appointments.pending) + toNumber(today.pending), 'warning'),
      chartItem('Concluídos', toNumber(appointments.completed) + toNumber(today.completed), 'success'),
      chartItem('Ausentes', toNumber(appointments.no_show), 'danger'),
    ];
  }

  if (widgetId === 'widget-recorrencia') {
    return [
      chartItem('Ativas', snap.activeCount, 'info'),
      chartItem('Pendentes', snap.pendingCount, 'purple'),
      chartItem('Inadimpl.', snap.pastDueCount, 'danger'),
      chartItem('Receita', Math.round(snap.revCents / 100), 'success'),
    ];
  }

  if (widgetId === 'widget-alertas') {
    return [
      chartItem('Vencidas', snap.overdueCount, 'danger'),
      chartItem('Falhas', snap.failedCount, 'danger'),
      chartItem('Estoque', snap.lowStockCount, 'warning'),
      chartItem('Agenda', snap.agendaPending, 'success'),
    ];
  }

  if (widgetId === 'widget-aval') return getReviewChartItems(state.reviews);
  if (widgetId === 'widget-servicos') return getServiceChartItems(dash);

  return [];
}

function getTrendItems(widgetId, state = dashboardLastPayload || {}) {
  if (widgetId === 'widget-fin') {
    const revenueTrend = getTrendFromRevenueChart(state.revenueChart);
    if (revenueTrend.length) return revenueTrend;
  }

  const base = getWidgetChartItems(widgetId, state);
  if (!base.length) return [];

  return base.map((item, index) => ({
    ...item,
    label: item.label,
    value: item.value + index,
  }));
}

function chartToneColor(tone) {
  const map = {
    info: '#4fc3f7',
    success: '#00e676',
    warning: '#f59e0b',
    danger: '#ff6b7a',
    purple: '#9c6fff',
    muted: '#5a6888',
  };
  return map[tone] || map.info;
}

function chartToneGradient(tone) {
  const map = {
    info: 'linear-gradient(180deg,#4fc3f7,#0066ff)',
    success: 'linear-gradient(180deg,#00e676,#10b981)',
    warning: 'linear-gradient(180deg,#f59e0b,#fb923c)',
    danger: 'linear-gradient(180deg,#ff6b7a,#ff1744)',
    purple: 'linear-gradient(180deg,#9c6fff,#7c3aed)',
    muted: 'linear-gradient(180deg,#5a6888,#343868)',
  };
  return map[tone] || map.info;
}

function renderChartBars(items) {
  const max = Math.max(...items.map(i => toNumber(i.value)), 1);

  return `
    <div class="widget-chart-bars">
      ${items.map(item => {
        const height = Math.round(24 + (toNumber(item.value) / max) * 120);
        return `
          <div class="widget-chart-bar-item" title="${escapeHtml(item.label)}: ${escapeHtml(item.value)}">
            <div class="widget-chart-bar-value">${escapeHtml(item.value)}</div>
            <div class="widget-chart-bar" style="height:${height}px;background:${chartToneGradient(item.tone)}"></div>
            <div class="widget-chart-label">${escapeHtml(String(item.label).slice(0, 14))}</div>
          </div>
        `;
      }).join('')}
    </div>
  `;
}

function renderChartPie(items) {
  const safeItems = items.filter(i => toNumber(i.value) > 0);
  const total = safeItems.reduce((sum, item) => sum + toNumber(item.value), 0);

  if (!safeItems.length || total <= 0) {
    return simpleEmpty('Sem composição para gráfico', 'Quando houver dados, a distribuição aparece em pizza/donut.', '◔');
  }

  let acc = 0;
  const segments = safeItems.map(item => {
    const start = (acc / total) * 360;
    acc += toNumber(item.value);
    const end = (acc / total) * 360;
    return `${chartToneColor(item.tone)} ${start.toFixed(1)}deg ${end.toFixed(1)}deg`;
  }).join(', ');

  return `
    <div class="widget-chart-pie-wrap">
      <div class="widget-chart-donut" style="background:conic-gradient(${segments})">
        <div class="widget-chart-donut-core">
          <strong>${escapeHtml(total)}</strong>
          <span>Total</span>
        </div>
      </div>
      <div class="widget-chart-legend">
        ${safeItems.map(item => `
          <div class="widget-chart-legend-row">
            <span class="legend-dot" style="background:${chartToneColor(item.tone)}"></span>
            <span>${escapeHtml(item.label)}</span>
            <strong>${escapeHtml(item.value)}</strong>
          </div>
        `).join('')}
      </div>
    </div>
  `;
}

function renderChartTrend(items) {
  const safeItems = items.length ? items : [];
  const max = Math.max(...safeItems.map(i => toNumber(i.value)), 1);
  const min = Math.min(...safeItems.map(i => toNumber(i.value)), 0);
  const range = Math.max(max - min, 1);
  const width = 520;
  const height = 180;
  const pad = 18;
  const points = safeItems.map((item, index) => {
    const x = safeItems.length <= 1 ? width / 2 : pad + (index / (safeItems.length - 1)) * (width - pad * 2);
    const y = height - pad - ((toNumber(item.value) - min) / range) * (height - pad * 2);
    return `${x.toFixed(1)},${y.toFixed(1)}`;
  }).join(' ');

  if (!safeItems.length) {
    return simpleEmpty('Sem tendência calculada', 'A linha aparece quando houver série ou categorias suficientes.', '⌁');
  }

  return `
    <div class="widget-chart-trend">
      <svg viewBox="0 0 ${width} ${height}" preserveAspectRatio="none" role="img" aria-label="Linha de tendência">
        <defs>
          <linearGradient id="trendGradient" x1="0" x2="1" y1="0" y2="0">
            <stop offset="0%" stop-color="#4fc3f7" />
            <stop offset="50%" stop-color="#9c6fff" />
            <stop offset="100%" stop-color="#00e676" />
          </linearGradient>
        </defs>
        <polyline points="${points}" fill="none" stroke="url(#trendGradient)" stroke-width="5" stroke-linecap="round" stroke-linejoin="round" />
        ${safeItems.map((item, index) => {
          const [x, y] = points.split(' ')[index].split(',');
          return `<circle cx="${x}" cy="${y}" r="5" fill="${chartToneColor(item.tone)}"></circle>`;
        }).join('')}
      </svg>
      <div class="widget-chart-trend-labels">
        ${safeItems.map(item => `<span>${escapeHtml(String(item.label).slice(0, 10))}</span>`).join('')}
      </div>
    </div>
  `;
}

function renderWidgetChart(widgetId, chartType, state = dashboardLastPayload || {}) {
  const meta = DASHBOARD_WIDGETS[widgetId] || {};
  const items = chartType === 'trend'
    ? getTrendItems(widgetId, state)
    : getWidgetChartItems(widgetId, state);

  const total = items.reduce((sum, item) => sum + toNumber(item.value), 0);
  const title = meta.label || 'Widget';
  const subtitle = chartType === 'pie'
    ? 'Distribuição dos indicadores'
    : chartType === 'trend'
      ? 'Leitura em linha de tendência'
      : 'Comparativo operacional';

  return `
    <div class="widget-chart-shell">
      <div class="widget-chart-head">
        <div>
          <div class="dashboard-widget-section-title">${escapeHtml(title)} em gráfico</div>
          <div class="widget-chart-subtitle">${escapeHtml(subtitle)}</div>
        </div>
        <div class="widget-chart-total">${escapeHtml(total)}</div>
      </div>
      ${chartType === 'pie'
        ? renderChartPie(items)
        : chartType === 'trend'
          ? renderChartTrend(items)
          : renderChartBars(items)}
      <div class="widget-action-row widget-action-row--chart">
        ${actionButton('Voltar ao módulo', getWidgetModuleTarget(widgetId), 'info')}
      </div>
    </div>
  `;
}

function bindWidgetResizeStart(event, widget, mode = 'corner') {
  if (!(widget instanceof HTMLElement)) return;

  event.preventDefault();
  event.stopPropagation();

  const widgetId = widget.dataset.widgetId;
  if (!widgetId) return;

  const prefs = getWidgetPrefs(widgetId);
  const startX = event.clientX;
  const startY = event.clientY;
  const startHeight = widget.getBoundingClientRect().height;
  const startSpan = prefs.span === 2 ? 2 : 1;

  widget.classList.add('widget-resizing');
  widget.setPointerCapture?.(event.pointerId);

  const onMove = moveEvent => {
    const nextHeight = clamp(startHeight + (moveEvent.clientY - startY), 300, 760);
    const deltaX = moveEvent.clientX - startX;
    const nextSpan = mode === 'corner'
      ? (deltaX > 120 ? 2 : deltaX < -120 ? 1 : startSpan)
      : startSpan;

    updateWidgetPrefs(widgetId, {
      size: 'custom',
      height: Math.round(nextHeight),
      span: nextSpan,
    });

    updateWidgetChrome(widget);
  };

  const onUp = upEvent => {
    widget.classList.remove('widget-resizing');
    widget.releasePointerCapture?.(upEvent.pointerId);
    window.removeEventListener('pointermove', onMove);
    window.removeEventListener('pointerup', onUp);
  };

  window.addEventListener('pointermove', onMove);
  window.addEventListener('pointerup', onUp);
}

function bindDashboardWidgetControls() {
  if (dashboardWidgetControlsBound) return;
  dashboardWidgetControlsBound = true;

  document.addEventListener('click', event => {
    const target = event.target;
    if (!(target instanceof Element)) return;

    const closeButton = target.closest('[data-widget-close]');
    if (!(closeButton instanceof HTMLElement)) return;

    const widget = closeButton.closest('.dashboard-widget');
    if (!(widget instanceof HTMLElement)) return;

    const widgetId = widget.dataset.widgetId;
    if (!widgetId) return;

    event.preventDefault();
    event.stopPropagation();

    updateWidgetPrefs(widgetId, { hidden: true });
    updateWidgetChrome(widget);
  });

  document.addEventListener('click', event => {
    const target = event.target;
    if (!(target instanceof Element)) return;

    const control = target.closest('[data-widget-mode], [data-widget-chart], [data-widget-size]');
    if (!(control instanceof HTMLElement)) return;

    const widget = control.closest('.dashboard-widget');
    if (!(widget instanceof HTMLElement)) return;

    const widgetId = widget.dataset.widgetId;
    if (!widgetId) return;

    event.preventDefault();
    event.stopPropagation();

    if (control.dataset.widgetMode) {
      updateWidgetPrefs(widgetId, { mode: control.dataset.widgetMode });
    }

    if (control.dataset.widgetChart) {
      updateWidgetPrefs(widgetId, {
        mode: 'chart',
        chart: control.dataset.widgetChart,
      });
    }

    if (control.dataset.widgetSize) {
      const size = control.dataset.widgetSize;
      if (size === 'wide') {
        const current = getWidgetPrefs(widgetId);
        updateWidgetPrefs(widgetId, { span: current.span === 2 ? 1 : 2 });
      } else {
        updateWidgetPrefs(widgetId, {
          size,
          height: DASHBOARD_WIDGET_HEIGHT_PRESETS[size] || DASHBOARD_WIDGET_DEFAULT_HEIGHT,
        });
      }
    }

    updateWidgetChrome(widget);
    const content = widgetContentElement(widgetId);
    if (content) content.innerHTML = renderDashboardWidgetContent(widgetId);
  });

  document.addEventListener('pointerdown', event => {
    const target = event.target;
    if (!(target instanceof Element)) return;

    const corner = target.closest('[data-widget-resize-handle]');
    const edge = target.closest('[data-widget-resize-edge]');
    const handle = corner || edge;

    if (!(handle instanceof HTMLElement)) return;

    const widget = handle.closest('.dashboard-widget');
    if (!(widget instanceof HTMLElement)) return;

    bindWidgetResizeStart(event, widget, corner ? 'corner' : 'edge');
  });

  const restoreButton = document.getElementById('restoreWidgetsBtn');
  if (restoreButton) {
    restoreButton.addEventListener('click', () => {
      resetDashboardWidgetPrefs();
      document.querySelectorAll('.dashboard-widget[data-widget-id]').forEach(widget => {
        if (widget instanceof HTMLElement) {
          widget.style.removeProperty('--widget-custom-height');
          widget.classList.remove('widget-span-2', 'widget-hidden');
          widget.setAttribute('aria-hidden', 'false');
        }
      });
      renderAllDashboardWidgets();
      updateRestoreWidgetsButtonState();
    });
  }
}

// ─── Loading / Error states ───────────────────────────────────────────────────

const DASHBOARD_CONTENT_IDS = [
  'dashboardFinContent',
  'dashboardAvalContent',
  'dashboardAgendaContent',
  'dashboardServicosContent',
  'dashboardRecorrenciaContent',
  'dashboardAlertasContent',
];

function setAllWidgetsLoading() {
  DASHBOARD_CONTENT_IDS.forEach(id => {
    const el = document.getElementById(id);
    if (el) {
      el.innerHTML = `
        <div class="dashboard-widget-skeleton">
          <div></div><div></div><div></div>
        </div>
      `;
    }
  });
}

function setAllWidgetsMessage(message, color = '#5a6888') {
  DASHBOARD_CONTENT_IDS.forEach(id => {
    const el = document.getElementById(id);
    if (el) {
      el.innerHTML = `
        <div class="dashboard-widget-note dashboard-widget-note--error">
          ${escapeHtml(message)}
        </div>
      `;
    }
  });
}

// ─── Main refresh ─────────────────────────────────────────────────────────────

async function refreshDashboardWidgets() {
  ensureDashboardWidgets();

  if (!hasApiConfig()) {
    setAllWidgetsMessage('Configure a API para exibir indicadores reais.');
    return;
  }

  if (!hasAuthToken()) {
    setAllWidgetsMessage('Faça login para carregar os indicadores.');
    return;
  }

  setAllWidgetsLoading();

  try {
    const today = formatDateForApi(new Date());

    const [subscriptions, todayApts, dashData, reviews, revenueChart] = await Promise.all([
      getSubscriptions().catch(() => []),
      getAppointmentsByDate(today).catch(() => []),
      apiFetch('/api/dashboard').catch(() => null),
      apiFetch('/api/reviews').catch(() => []),
      apiFetch('/api/dashboard/revenue').catch(() => []),
    ]);

    const snap = buildOperationalSnapshot(subscriptions, todayApts, dashData);

    dashboardLastPayload = {
      subscriptions,
      todayApts,
      dashData,
      reviews,
      revenueChart,
      snap,
    };

    renderAllDashboardWidgets();
  } catch (error) {
    const msg = error instanceof Error ? error.message : 'Não foi possível carregar os widgets.';
    setAllWidgetsMessage(msg, '#ff8a8a');
  }
}

function scheduleAuthRefresh() {
  window.clearTimeout(dashboardAuthRefreshTimer);
  dashboardAuthRefreshTimer = window.setTimeout(refreshDashboardWidgets, 1200);
}

function bindDashboardActions() {
  document.addEventListener('click', event => {
    const target = event.target;
    if (!(target instanceof Element)) return;

    const button = target.closest('[data-dashboard-action]');
    if (!(button instanceof HTMLElement)) return;

    event.preventDefault();
    event.stopPropagation();

    resolveAction(button.dataset.dashboardAction);
  });
}

// ─── Export ───────────────────────────────────────────────────────────────────

export function initDashboard() {
  ensureDashboardWidgets();

  if (!dashboardBootstrapped) {
    document.addEventListener('visibilitychange', () => {
      if (!document.hidden) refreshDashboardWidgets();
    });

    document.addEventListener('click', event => {
      const t = event.target;
      if (!(t instanceof Element)) return;
      if (t.closest('#authConnectBtn') || t.closest('#authDisconnectBtn') || t.closest('[data-open-auth-modal="true"]')) {
        scheduleAuthRefresh();
      }
    });

    bindDashboardActions();
    bindDashboardWidgetControls();

    window.addEventListener('storage', refreshDashboardWidgets);

    dashboardRefreshTimer = window.setInterval(refreshDashboardWidgets, DASHBOARD_REFRESH_INTERVAL_MS);
    dashboardBootstrapped = true;
  }

  refreshDashboardWidgets();
  return true;
}
