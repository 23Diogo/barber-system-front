import {
  hasApiConfig,
  hasAuthToken,
  apiFetch,
  getSubscriptions,
  getAppointmentsByDate,
  formatDateForApi,
} from '../services/api.js';

const DASHBOARD_REFRESH_INTERVAL_MS = 60000;

let dashboardBootstrapped = false;
let dashboardRefreshTimer = null;
let dashboardAuthRefreshTimer = null;

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
    return;
  }

  const widget = document.querySelector(`[data-target="${CSS.escape(target)}"]`);
  if (widget instanceof HTMLElement) {
    widget.click();
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
  if (!hero || document.getElementById('dashboardWidgetRecorrencia')) return;

  hero.insertAdjacentHTML('beforeend', `
    <div id="dashboardWidgetRecorrencia"
      class="analytics-card pos-ml dashboard-widget dashboard-widget--recurrence"
      data-target="planos" data-widget-id="widget-recorrencia" title="Abrir Planos">
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
      data-target="agenda" data-widget-id="widget-alertas" title="Abrir Agenda">
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

    const [subscriptions, todayApts, dashData, reviews] = await Promise.all([
      getSubscriptions().catch(() => []),
      getAppointmentsByDate(today).catch(() => []),
      apiFetch('/api/dashboard').catch(() => null),
      apiFetch('/api/reviews').catch(() => []),
    ]);

    const fin = document.getElementById('dashboardFinContent');
    const aval = document.getElementById('dashboardAvalContent');
    const agenda = document.getElementById('dashboardAgendaContent');
    const svc = document.getElementById('dashboardServicosContent');

    if (fin) fin.innerHTML = renderFinWidget(dashData);
    if (aval) aval.innerHTML = renderAvalWidget(reviews);
    if (agenda) agenda.innerHTML = renderAgendaWidget(dashData);
    if (svc) svc.innerHTML = renderServicosWidget(dashData);

    const snap = buildOperationalSnapshot(subscriptions, todayApts, dashData);

    const recContent = document.getElementById('dashboardRecorrenciaContent');
    const altContent = document.getElementById('dashboardAlertasContent');

    if (recContent) recContent.innerHTML = renderRecorrencia(snap);
    if (altContent) altContent.innerHTML = renderAlertas(snap);
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

    window.addEventListener('storage', refreshDashboardWidgets);

    dashboardRefreshTimer = window.setInterval(refreshDashboardWidgets, DASHBOARD_REFRESH_INTERVAL_MS);
    dashboardBootstrapped = true;
  }

  refreshDashboardWidgets();
  return true;
}
