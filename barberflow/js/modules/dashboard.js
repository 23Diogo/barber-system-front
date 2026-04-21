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

function formatCompactCurrency(value) {
  const n = Number(value || 0);
  if (n >= 1000) return `R$${(n / 1000).toFixed(1)}k`;
  return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL', maximumFractionDigits: 0 }).format(n);
}

function formatCompactCurrencyFromCents(cents) {
  return formatCompactCurrency(Number(cents || 0) / 100);
}

function formatTime(value) {
  if (!value) return '--:--';
  return new Date(value).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit', timeZone: 'America/Sao_Paulo' });
}

function escapeHtml(v) {
  return String(v ?? '').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
}

function getDateKey(value) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '';
  return `${date.getFullYear()}-${String(date.getMonth()+1).padStart(2,'0')}-${String(date.getDate()).padStart(2,'0')}`;
}

function isBeforeToday(value) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return false;
  const today = new Date(); today.setHours(0,0,0,0);
  date.setHours(0,0,0,0);
  return date.getTime() < today.getTime();
}

function getSubscriptionPriceCents(sub) {
  const plan = sub?.plans || {};
  const cents = Number(plan.price_cents);
  if (Number.isFinite(cents) && cents > 0) return cents;
  const price = Number(plan.price);
  if (Number.isFinite(price) && price > 0) return Math.round(price * 100);
  return 0;
}

// ─── Widget: Financeiro ───────────────────────────────────────────────────────

function renderFinWidget(data) {
  const revenue      = data?.revenue      || {};
  const appointments = data?.appointments || {};
  const grossIncome  = Number(revenue.gross_income  || 0);
  const netProfit    = Number(revenue.net_profit    || 0);
  const totalExpenses= Number(revenue.total_expenses|| 0);
  const completed    = Number(appointments.completed || 0);
  const total        = Number(appointments.total     || 0);
  const occupancy    = Number(appointments.occupancy_pct || 0);

  const maxVal = Math.max(grossIncome, netProfit, totalExpenses, 1);

  const rows = [
    { label: 'Receita bruta', value: grossIncome,   display: formatCompactCurrency(grossIncome),   fill: 'linear-gradient(90deg,#4fc3f7,#38bdf8)', color: '#4fc3f7' },
    { label: 'Despesas',      value: totalExpenses,  display: formatCompactCurrency(totalExpenses),  fill: 'linear-gradient(90deg,#ff6b7a,#ff1744)', color: '#ff6b7a' },
    { label: 'Lucro líquido', value: Math.max(netProfit, 0), display: formatCompactCurrency(netProfit), fill: 'linear-gradient(90deg,#00e676,#10b981)', color: '#00e676' },
  ].map(r => {
    const w = maxVal > 0 ? Math.max((r.value / maxVal) * 100, r.value > 0 ? 10 : 0) : 0;
    return `<div class="data-row">
      <div class="data-name">${r.label}</div>
      <div class="data-bar"><div class="data-fill" style="width:${w}%;background:${r.fill}"></div></div>
      <div class="data-val" style="color:${r.color}">${r.display}</div>
    </div>`;
  }).join('');

  return `
    <div class="ac-value">${escapeHtml(formatCompactCurrency(grossIncome))}</div>
    <div class="ac-sub">${completed} concluídos · ${occupancy}% ocupação</div>
    ${rows}
    <div class="data-row" style="margin-top:4px;">
      <div class="data-name">Atendimentos</div>
      <div class="data-bar"><div class="data-fill" style="width:${total > 0 ? Math.round((completed/total)*100) : 0}%"></div></div>
      <div class="data-val">${completed}/${total}</div>
    </div>
  `;
}

// ─── Widget: Avaliações ───────────────────────────────────────────────────────

function renderAvalWidget(reviews) {
  const list = Array.isArray(reviews) ? reviews : [];

  if (!list.length) {
    return `
      <div class="ac-value" style="color:#5a6888">—</div>
      <div class="ac-sub" style="color:#5a6888">Sem avaliações cadastradas</div>
      <div class="data-row"><div class="data-name">Total</div><div class="data-bar"><div class="data-fill" style="width:0%"></div></div><div class="data-val">0</div></div>
    `;
  }

  const total      = list.length;
  const avgRating  = list.reduce((s, r) => s + Number(r.rating || 0), 0) / total;
  const positive   = list.filter(r => Number(r.rating || 0) >= 4).length;
  const satisfaction = Math.round((positive / total) * 100);

  const dist = [5,4,3,2,1].map(star => {
    const count = list.filter(r => Number(r.rating) === star).length;
    const pct   = total > 0 ? Math.round((count / total) * 100) : 0;
    const color = star >= 4 ? '#9c6fff' : star === 3 ? '#f59e0b' : '#ff6b7a';
    return `<div class="data-row">
      <div class="data-name">${star}★</div>
      <div class="data-bar"><div class="data-fill" style="width:${pct}%;background:${color}"></div></div>
      <div class="data-val" style="color:${color}">${count}</div>
    </div>`;
  }).join('');

  return `
    <div class="ac-value" style="color:#9c6fff">${satisfaction}%</div>
    <div class="ac-sub" style="color:#9c6fff">${total} aval. · média ${avgRating.toFixed(1)}★</div>
    ${dist}
  `;
}

// ─── Widget: Agenda ───────────────────────────────────────────────────────────

function getAptStatusMeta(status) {
  const map = {
    completed:   { label: 'Concluído', color: '#00e676' },
    in_progress: { label: 'Agora',     color: '#4fc3f7' },
    confirmed:   { label: 'Confirmado',color: '#9c6fff' },
    pending:     { label: 'Pendente',  color: '#c0cce8' },
    cancelled:   { label: 'Cancelado', color: '#ff6b7a' },
    no_show:     { label: 'No-show',   color: '#f97316' },
  };
  return map[status] || map.pending;
}

function renderAgendaWidget(data) {
  const schedule = data?.today_schedule || [];
  const barbers  = data?.barber_ranking || [];

  const aptRows = schedule.slice(0, 3).map(apt => {
    const clientName = apt?.clients?.name || 'Cliente';
    const time       = formatTime(apt.scheduled_at);
    const meta       = getAptStatusMeta(apt.status);
    return `<div class="data-nums">
      <span style="color:#343868">${escapeHtml(time)}</span>
      <span>${escapeHtml(clientName)}</span>
      <span style="color:${meta.color}">${meta.label}</span>
    </div>`;
  }).join('') || `<div class="data-nums"><span style="color:#5a6888;font-size:9px;">Sem agendamentos hoje</span></div>`;

  const maxApts = Math.max(...barbers.map(b => Number(b.total_appointments || 0)), 1);
  const barberRows = barbers.slice(0, 3).map(b => {
    const name = b.barber_name || 'Barbeiro';
    const pct  = Math.round((Number(b.total_appointments || 0) / maxApts) * 100);
    return `<div class="data-row">
      <span class="data-name">${escapeHtml(name.split(' ')[0])}</span>
      <div class="data-bar"><div class="data-fill" style="width:${pct}%"></div></div>
      <span class="data-val">${pct}%</span>
    </div>`;
  }).join('') || `<div class="data-row"><span style="color:#5a6888;font-size:9px;">Sem dados de barbeiros</span></div>`;

  return `
    ${aptRows}
    <div class="ac-title" style="margin-top:8px;margin-bottom:4px;">Ocupação <span>Hoje</span></div>
    ${barberRows}
  `;
}

// ─── Widget: Serviços ─────────────────────────────────────────────────────────

function renderServicosWidget(data) {
  const schedule = data?.today_schedule || [];

  // Agrupa por serviço
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
      <div class="ac-value" style="color:#5a6888">—</div>
      <div class="ac-sub" style="color:#5a6888">Sem atendimentos hoje</div>
      <div class="data-row"><div class="data-name">Hoje</div><div class="data-bar"><div class="data-fill" style="width:0%"></div></div><div class="data-val">0</div></div>
    `;
  }

  const maxCount = Math.max(...sorted.map(([,c]) => c), 1);

  const barCols = sorted.map(([, count]) => {
    const h = Math.max(Math.round((count / maxCount) * 52), 10);
    return `<div class="bar-col" style="height:${h}px;background:linear-gradient(180deg,#4fc3f7,#0066ff)"></div>`;
  }).join('');

  const barNums = sorted.map(([name]) =>
    `<span>${escapeHtml(name.slice(0, 7))}</span>`
  ).join('');

  const rows = sorted.map(([name, count]) => {
    const pct = Math.round((count / maxCount) * 100);
    return `<div class="data-row">
      <span class="data-name">${escapeHtml(name)}</span>
      <div class="data-bar"><div class="data-fill" style="width:${pct}%"></div></div>
      <span class="data-val">${count}</span>
    </div>`;
  }).join('');

  return `
    <div class="bar-chart">${barCols}</div>
    <div class="data-nums">${barNums}</div>
    <div class="ac-title" style="margin:6px 0 4px;">Resumo por serviço <span>Hoje</span></div>
    ${rows}
  `;
}

// ─── Recorrência / Alertas (mantidos) ────────────────────────────────────────

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
        <div class="ac-title">Alertas operacionais</div>
        <div class="widget-actions">
          <span class="widget-open">abrir ↗</span>
          <button aria-label="Fechar widget" class="widget-close" data-widget-close type="button">×</button>
        </div>
      </div>
      <div id="dashboardAlertasContent"></div>
      <div class="widget-module">Módulo: Agenda</div>
    </div>
  `);
}

function flattenInvoices(subscriptions) {
  const invoices = [];
  subscriptions.forEach(sub => {
    (Array.isArray(sub?.subscription_invoices) ? sub.subscription_invoices : [])
      .forEach(inv => invoices.push({ ...inv, __clientName: sub?.clients?.name || 'Cliente', __planName: sub?.plans?.name || 'Plano' }));
  });
  return invoices;
}

function groupTopPlans(subscriptions) {
  const groups = new Map();
  subscriptions
    .filter(s => ['active','trialing'].includes(s?.status))
    .forEach(s => {
      const name = s?.plans?.name || 'Plano';
      const cur  = groups.get(name) || { planName: name, count: 0 };
      cur.count += 1;
      groups.set(name, cur);
    });
  return [...groups.values()].sort((a,b) => b.count - a.count).slice(0,3);
}

function buildRecorrenciaSnapshot(subscriptions, appointments) {
  const subs    = Array.isArray(subscriptions) ? subscriptions : [];
  const apts    = Array.isArray(appointments)  ? appointments  : [];
  const invoices = flattenInvoices(subs);

  const active  = subs.filter(s => ['active','trialing'].includes(s?.status));
  const pending = subs.filter(s => s?.status === 'pending_activation');
  const pastDue = subs.filter(s => s?.status === 'past_due');

  const revCents = active.reduce((sum, s) => sum + getSubscriptionPriceCents(s), 0);
  const todayKey = formatDateForApi(new Date());

  const dueToday = invoices.filter(i => i?.status === 'pending' && getDateKey(i?.due_at) === todayKey);
  const overdue  = invoices.filter(i => i?.status === 'pending' && i?.due_at && isBeforeToday(i.due_at));
  const failed   = invoices.filter(i => i?.status === 'failed');

  const subscribedIds = new Set(
    subs.filter(s => ['active','trialing','pending_activation','past_due','paused'].includes(s?.status) && s?.client_id)
        .map(s => String(s.client_id))
  );

  const aptsWithPlan = apts.filter(a => a?.client_id && !['cancelled','no_show'].includes(a?.status) && subscribedIds.has(String(a.client_id)));

  return {
    activeCount:   active.length,
    pendingCount:  pending.length,
    pastDueCount:  pastDue.length,
    revCents,
    dueTodayCount: dueToday.length,
    overdueCount:  overdue.length,
    aptsWithPlanCount: aptsWithPlan.length,
    failedCount:   failed.length,
    topPlans:      groupTopPlans(subs),
    updatedAt:     new Date().toLocaleTimeString('pt-BR', { hour:'2-digit', minute:'2-digit' }),
  };
}

function renderBars(items) {
  const maxVal = Math.max(...items.map(i => Number(i.value||0)), 1);
  const minH = 18, maxH = 52;
  return `
    <div class="bar-chart">
      ${items.map(i => {
        const h = Math.round(minH + (Number(i.value||0)/maxVal)*(maxH-minH));
        return `<div class="bar-col" style="height:${h}px;background:${i.color}" title="${i.label}: ${i.value}"></div>`;
      }).join('')}
    </div>
    <div class="data-nums">${items.map(i => `<span>${i.short}</span>`).join('')}</div>
  `;
}

function renderMetricRows(items) {
  const maxVal = Math.max(...items.map(i => Number(i.value||0)), 1);
  return items.map(i => {
    const w = maxVal ? Math.max((Number(i.value||0)/maxVal)*100, i.value>0?12:0) : 0;
    return `<div class="data-row">
      <div class="data-name">${i.label}</div>
      <div class="data-bar"><div class="data-fill" style="width:${w}%;background:${i.fill||'linear-gradient(90deg,#4fc3f7,#9c6fff)'}"></div></div>
      <div class="data-val" style="${i.valueColor?`color:${i.valueColor};`:''}">${i.displayValue??i.value}</div>
    </div>`;
  }).join('');
}

function renderTopPlanRows(topPlans) {
  if (!topPlans.length) return `<div class="data-row"><div class="data-name" style="min-width:110px;">Top planos</div><div class="data-bar"><div class="data-fill" style="width:18%"></div></div><div class="data-val">—</div></div>`;
  return topPlans.map(p => `<div class="data-row">
    <div class="data-name" style="min-width:110px;">${escapeHtml(p.planName)}</div>
    <div class="data-bar"><div class="data-fill" style="width:${Math.min(p.count*22,100)}%"></div></div>
    <div class="data-val">${p.count}</div>
  </div>`).join('');
}

function renderRecorrencia(snap) {
  return `
    <div class="ac-value">${formatCompactCurrencyFromCents(snap.revCents)}</div>
    <div class="ac-sub">${snap.activeCount} ativas · ${snap.pendingCount} pendentes</div>
    ${renderBars([
      { short:'Atv',  label:'Ativas',         value:snap.activeCount,  color:'linear-gradient(180deg,#4fc3f7,#38bdf8)' },
      { short:'Pnd',  label:'Pendentes',       value:snap.pendingCount, color:'linear-gradient(180deg,#9c6fff,#7c3aed)' },
      { short:'Ina',  label:'Inadimplentes',   value:snap.pastDueCount, color:'linear-gradient(180deg,#ff6b7a,#ff1744)' },
      { short:'R$',   label:'Receita',         value:Math.round(snap.revCents/100), color:'linear-gradient(180deg,#00e676,#10b981)' },
    ])}
    ${renderMetricRows([
      { label:'Ativas',    value:snap.activeCount,  fill:'linear-gradient(90deg,#4fc3f7,#38bdf8)' },
      { label:'Inadimpl.', value:snap.pastDueCount, fill:'linear-gradient(90deg,#ff6b7a,#ff1744)', valueColor:'#ff6b7a' },
      { label:'Pendentes', value:snap.pendingCount, fill:'linear-gradient(90deg,#9c6fff,#7c3aed)' },
      { label:'Previsto',  value:Math.round(snap.revCents/100), displayValue:formatCompactCurrencyFromCents(snap.revCents), fill:'linear-gradient(90deg,#00e676,#10b981)', valueColor:'#00e676' },
    ])}
    ${renderTopPlanRows(snap.topPlans)}
    <div class="ac-title" style="margin-top:8px;">Atualizado às ${snap.updatedAt}</div>
  `;
}

function renderAlertas(snap) {
  return `
    <div class="ac-value">${snap.dueTodayCount}</div>
    <div class="ac-sub">${snap.overdueCount} vencidas · ${snap.aptsWithPlanCount} com plano hoje</div>
    ${renderBars([
      { short:'Hoje',  label:'Vencem hoje', value:snap.dueTodayCount,      color:'linear-gradient(180deg,#f59e0b,#fb923c)' },
      { short:'Venc',  label:'Vencidas',    value:snap.overdueCount,        color:'linear-gradient(180deg,#ff6b7a,#ff1744)' },
      { short:'Plano', label:'Plano hoje',  value:snap.aptsWithPlanCount,   color:'linear-gradient(180deg,#4fc3f7,#38bdf8)' },
      { short:'Falha', label:'Falhas',      value:snap.failedCount,         color:'linear-gradient(180deg,#9c6fff,#7c3aed)' },
    ])}
    ${renderMetricRows([
      { label:'Vencem hoje', value:snap.dueTodayCount,    fill:'linear-gradient(90deg,#f59e0b,#fb923c)', valueColor:'#f59e0b' },
      { label:'Vencidas',    value:snap.overdueCount,      fill:'linear-gradient(90deg,#ff6b7a,#ff1744)', valueColor:'#ff6b7a' },
      { label:'Plano hoje',  value:snap.aptsWithPlanCount, fill:'linear-gradient(90deg,#4fc3f7,#38bdf8)' },
      { label:'Falhas',      value:snap.failedCount,       fill:'linear-gradient(90deg,#9c6fff,#7c3aed)' },
    ])}
    <div class="ac-title" style="margin-top:8px;">Atualizado às ${snap.updatedAt}</div>
  `;
}

// ─── Loading / Error states ───────────────────────────────────────────────────

function setAllWidgetsLoading() {
  const ids = ['dashboardFinContent','dashboardAvalContent','dashboardAgendaContent','dashboardServicosContent','dashboardRecorrenciaContent','dashboardAlertasContent'];
  ids.forEach(id => {
    const el = document.getElementById(id);
    if (el) el.innerHTML = `<div class="ac-value" style="color:#5a6888">...</div><div class="ac-sub">Carregando...</div>`;
  });
}

function setAllWidgetsMessage(message, color = '#5a6888') {
  const ids = ['dashboardFinContent','dashboardAvalContent','dashboardAgendaContent','dashboardServicosContent','dashboardRecorrenciaContent','dashboardAlertasContent'];
  ids.forEach(id => {
    const el = document.getElementById(id);
    if (el) el.innerHTML = `<div class="ac-value">—</div><div class="ac-sub" style="color:${color}">${message}</div>`;
  });
}

// ─── Main refresh ─────────────────────────────────────────────────────────────

async function refreshDashboardWidgets() {
  ensureDashboardWidgets();

  if (!hasApiConfig()) {
    setAllWidgetsMessage('Configure a API no login dev para exibir os indicadores reais.');
    return;
  }

  if (!hasAuthToken()) {
    setAllWidgetsMessage('Faça login dev para carregar os indicadores.');
    return;
  }

  setAllWidgetsLoading();

  try {
    const today = formatDateForApi(new Date());

    const [subscriptions, todayApts, dashData, reviews] = await Promise.all([
      getSubscriptions(),
      getAppointmentsByDate(today),
      apiFetch('/api/dashboard').catch(() => null),
      apiFetch('/api/reviews').catch(() => []),
    ]);

    // ── 4 widgets estáticos ──
    const fin  = document.getElementById('dashboardFinContent');
    const aval = document.getElementById('dashboardAvalContent');
    const agenda = document.getElementById('dashboardAgendaContent');
    const svc  = document.getElementById('dashboardServicosContent');

    if (fin)    fin.innerHTML    = renderFinWidget(dashData);
    if (aval)   aval.innerHTML   = renderAvalWidget(reviews);
    if (agenda) agenda.innerHTML = renderAgendaWidget(dashData);
    if (svc)    svc.innerHTML    = renderServicosWidget(dashData);

    // ── Recorrência e Alertas ──
    const snap = buildRecorrenciaSnapshot(subscriptions, todayApts);

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

    window.addEventListener('storage', refreshDashboardWidgets);

    dashboardRefreshTimer = window.setInterval(refreshDashboardWidgets, DASHBOARD_REFRESH_INTERVAL_MS);
    dashboardBootstrapped = true;
  }

  refreshDashboardWidgets();
  return true;
}
