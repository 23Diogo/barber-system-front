\import { apiFetch } from '../services/api.js';

// ══════════════════════════════════════════════════════════════════════════════
// STATE
// ══════════════════════════════════════════════════════════════════════════════

const financeiroState = {
  bills:        [],
  transactions: [],
  commissions:  [],
  ownerMetrics: null,
  cash:         { register: null, movements: [], summary: null },
  teamCommissions: {
    summary: null,
    sources: [],
    adjustments: [],
    payments: [],
    periodStart: new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString().split('T')[0],
    periodEnd: new Date(new Date().getFullYear(), new Date().getMonth() + 1, 0).toISOString().split('T')[0],
    selectedBarberId: null,
    suggestedPeriod: null,
    isLoading: false,
  },
  activeTab:    'caixa',   // caixa | contas | transacoes | comissoes
  isLoading:    false,
  isLoaded:     false,
  modalMode:    'closed',
  activeEntryId: null,
  activeSection: null,
  cashDate:     new Date().toISOString().split('T')[0],
};

// ══════════════════════════════════════════════════════════════════════════════
// PALETA & CONSTANTES
// ══════════════════════════════════════════════════════════════════════════════

const PAYMENT_METHODS = {
  pix:        { label: 'Pix',          color: '#00e676', icon: '⚡' },
  dinheiro:   { label: 'Dinheiro',     color: '#ffd700', icon: '💵' },
  debito:     { label: 'Débito',       color: '#4fc3f7', icon: '💳' },
  credito:    { label: 'Crédito',      color: '#9c6fff', icon: '💎' },
  pix_cartao: { label: 'Pix+Cartão',  color: '#f97316', icon: '🔀' },
  cortesia:   { label: 'Cortesia',     color: '#5a6888', icon: '🎁' },
};

const MOVEMENT_TYPES = {
  income:        { label: 'Entrada',  color: '#00e676', bg: 'rgba(0,230,118,.1)',  icon: '↑', sign: +1 },
  service:       { label: 'Serviço',  color: '#00e676', bg: 'rgba(0,230,118,.08)', icon: '✂', sign: +1 },
  expense:       { label: 'Saída',    color: '#ff1744', bg: 'rgba(255,23,68,.1)',   icon: '↓', sign: -1 },
  withdrawal:    { label: 'Sangria',  color: '#f97316', bg: 'rgba(249,115,22,.1)', icon: '⬇', sign: -1 },
  reinforcement: { label: 'Reforço',  color: '#4fc3f7', bg: 'rgba(79,195,247,.1)', icon: '⬆', sign: +1 },
};

// ══════════════════════════════════════════════════════════════════════════════
// HELPERS
// ══════════════════════════════════════════════════════════════════════════════

const esc = (v) =>
  String(v ?? '')
    .replace(/&/g, '&amp;').replace(/</g, '&lt;')
    .replace(/>/g, '&gt;').replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');

const fmt = (v) =>
  new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(Number(v || 0));

const fmtCompact = (v) => {
  const raw = Number(v || 0);
  const n = Math.abs(raw);
  const sign = raw < 0 ? '-' : '';
  return n >= 1_000_000 ? `${sign}R$${(n / 1_000_000).toFixed(1)}M`
       : n >= 1_000     ? `${sign}R$${(n / 1_000).toFixed(1)}k`
       : fmt(raw);
};

const fmtDate = (v) => {
  if (!v) return '—';
  const d = new Date(v);
  return isNaN(d.getTime()) ? String(v) : d.toLocaleDateString('pt-BR');
};

const fmtTime = (v) => {
  if (!v) return '—';
  const d = new Date(v);
  return isNaN(d.getTime()) ? String(v)
    : d.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
};

const setFeedback = (id, msg, variant = 'neutral') => {
  const el = document.getElementById(id);
  if (!el) return;
  el.textContent = msg || '';
  el.style.color = variant === 'error' ? '#ff8a8a'
                 : variant === 'success' ? '#00e676'
                 : '#5a6888';
};

const fmtCents = (v) => fmt(Number(v || 0) / 100);

const centsToAmount = (v) => Number(v || 0) / 100;

const getMonthRangeFromInput = (value) => {
  const raw = String(value || '').trim();
  const match = raw.match(/^(\d{4})-(\d{2})$/);
  const now = new Date();

  const year = match ? Number(match[1]) : now.getFullYear();
  const monthIndex = match ? Number(match[2]) - 1 : now.getMonth();

  const start = new Date(year, monthIndex, 1);
  const end = new Date(year, monthIndex + 1, 0);

  return {
    periodStart: start.toISOString().split('T')[0],
    periodEnd: end.toISOString().split('T')[0],
    monthValue: `${year}-${String(monthIndex + 1).padStart(2, '0')}`,
  };
};

const getMonthValueFromPeriod = (periodStart) => {
  if (!periodStart) return getMonthRangeFromInput().monthValue;
  return String(periodStart).slice(0, 7);
};

const getMonthLabelFromPeriod = (periodStart) => {
  const raw = String(periodStart || '').slice(0, 7);
  const match = raw.match(/^(\d{4})-(\d{2})$/);
  if (!match) return 'competência anterior';

  const year = Number(match[1]);
  const monthIndex = Number(match[2]) - 1;
  const label = new Date(year, monthIndex, 1)
    .toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' });

  return label.charAt(0).toUpperCase() + label.slice(1);
};

const hasTeamCommissionData = (summary) => {
  const totals = summary?.totals || {};
  const items = Array.isArray(summary?.items) ? summary.items : [];
  return items.length > 0 || Number(totals.totalGeneratedCents || 0) > 0 || Number(totals.pendingCents || 0) > 0;
};

const startOfCurrentMonthBR = () => {
  const now = new Date();
  return new Date(now.getFullYear(), now.getMonth(), 1).toISOString().split('T')[0];
};

const endOfCurrentMonthBR = () => {
  const now = new Date();
  return new Date(now.getFullYear(), now.getMonth() + 1, 0).toISOString().split('T')[0];
};

const isBillPaid = (bill) => String(bill?.status || '').toLowerCase() === 'paid';
const isBillCancelled = (bill) => String(bill?.status || '').toLowerCase() === 'cancelled';
const isBillOpen = (bill) => !isBillPaid(bill) && !isBillCancelled(bill);
const isBillOverdue = (bill) => isBillOpen(bill) && bill?.due_date && new Date(`${bill.due_date}T23:59:59`) < new Date();
const isBillDueSoon = (bill) => {
  if (!isBillOpen(bill) || !bill?.due_date || isBillOverdue(bill)) return false;
  const due = new Date(`${bill.due_date}T23:59:59`);
  const diff = Math.ceil((due - new Date()) / 86400000);
  return diff >= 0 && diff <= 3;
};

const sumAmount = (items, field = 'amount') =>
  (items || []).reduce((sum, item) => sum + Number(item?.[field] || 0), 0);

const getBillCockpit = () => {
  const bills = financeiroState.bills || [];
  const open = bills.filter(isBillOpen);
  const overdue = open.filter(isBillOverdue);
  const dueSoon = open.filter(isBillDueSoon);
  const paid = bills.filter(isBillPaid);

  return {
    totalCount: bills.length,
    open,
    overdue,
    dueSoon,
    paid,
    openAmount: sumAmount(open),
    overdueAmount: sumAmount(overdue),
    dueSoonAmount: sumAmount(dueSoon),
    paidAmount: sumAmount(paid),
  };
};

const getTransactionCockpit = () => {
  const transactions = financeiroState.transactions || [];
  const income = transactions.filter(t => t.type === 'income');
  const expense = transactions.filter(t => t.type === 'expense');
  const byMethod = {};
  const byCategory = {};

  for (const t of transactions) {
    if (t.payment_method) byMethod[t.payment_method] = (byMethod[t.payment_method] || 0) + Number(t.amount || 0);
    if (t.category) byCategory[t.category] = (byCategory[t.category] || 0) + Number(t.amount || 0);
  }

  return {
    total: transactions.length,
    income,
    expense,
    incomeAmount: sumAmount(income),
    expenseAmount: sumAmount(expense),
    byMethod,
    byCategory,
  };
};

const getFinanceHealth = (metrics) => {
  const revenue = Number(metrics.revenue || 0);
  const obligations = Number(metrics.expenses || 0) + Number(metrics.openBillsAmount || 0) + Number(metrics.commissions || 0);
  const coverage = obligations > 0 ? Math.round((revenue / obligations) * 100) : revenue > 0 ? 100 : 0;

  if (coverage >= 120) return { label: 'Saúde boa', color: '#00e676', icon: '🟢', coverage };
  if (coverage >= 80) return { label: 'Atenção', color: '#f97316', icon: '🟠', coverage };
  return { label: 'Pressão no caixa', color: '#ff5c74', icon: '🔴', coverage };
};

const num = (value, fallback = 0) => {
  const n = Number(value);
  return Number.isFinite(n) ? n : fallback;
};

function getOwnerFinancialSummary(ownerMetrics, fallback = {}) {
  const revenue = ownerMetrics?.revenue || {};
  const results = ownerMetrics?.results || {};
  const commissions = ownerMetrics?.commissions || {};
  const expenses = ownerMetrics?.expenses || {};
  const display = ownerMetrics?.display || {};

  const grossRevenue = revenue.grossCents !== undefined
    ? centsToAmount(revenue.grossCents)
    : num(display.grossRevenue, num(fallback.revenue));

  const netRevenue = revenue.netCents !== undefined
    ? centsToAmount(revenue.netCents)
    : num(display.netRevenue, grossRevenue);

  const managerialResult = results.managerialResultCents !== undefined
    ? centsToAmount(results.managerialResultCents)
    : num(display.managerialResult, num(fallback.profit));

  const forecastResult = results.forecastResultCents !== undefined
    ? centsToAmount(results.forecastResultCents)
    : num(display.forecastResult, num(fallback.projectedProfit, managerialResult));

  const availableAfterObligations = results.availableAfterObligationsCents !== undefined
    ? centsToAmount(results.availableAfterObligationsCents)
    : num(display.availableAfterObligations, forecastResult);

  const commissionsGenerated = commissions.generatedCents !== undefined
    ? centsToAmount(commissions.generatedCents)
    : num(display.commissionsGenerated, num(fallback.commissions));

  const commissionsPaid = commissions.paidCents !== undefined
    ? centsToAmount(commissions.paidCents)
    : num(display.commissionsPaid, 0);

  const commissionsPending = commissions.pendingCents !== undefined
    ? centsToAmount(commissions.pendingCents)
    : num(display.commissionsPending, Math.max(commissionsGenerated - commissionsPaid, 0));

  const expensesPaid = expenses.paidCents !== undefined
    ? centsToAmount(expenses.paidCents)
    : num(display.expensesPaid, num(fallback.expenses));

  const billsOpen = expenses.openCents !== undefined
    ? centsToAmount(expenses.openCents)
    : num(display.billsOpen, num(fallback.openBillsAmount));

  const billsOverdue = expenses.overdueCents !== undefined
    ? centsToAmount(expenses.overdueCents)
    : num(display.billsOverdue, num(fallback.overdueBillsAmount));

  const cashResult = results.cashResultCents !== undefined
    ? centsToAmount(results.cashResultCents)
    : num(display.cashResult, num(fallback.cashResult, num(fallback.profit)));

  const avgTicket = revenue.avgTicketCents !== undefined
    ? centsToAmount(revenue.avgTicketCents)
    : num(display.avgTicket, 0);

  const ordersCount = num(revenue.ordersCount, num(fallback.transactionsCount));
  const marginPct = num(results.grossMarginPct, num(fallback.margin));

  return {
    grossRevenue,
    netRevenue,
    managerialResult,
    forecastResult,
    availableAfterObligations,
    commissionsGenerated,
    commissionsPaid,
    commissionsPending,
    expensesPaid,
    billsOpen,
    billsOverdue,
    cashResult,
    avgTicket,
    ordersCount,
    marginPct,
    hasOwnerMetrics: Boolean(ownerMetrics),
  };
}


const getPreviousMonthRange = (periodStart, offset = 1) => {
  const monthValue = getMonthValueFromPeriod(periodStart);
  const [yearRaw, monthRaw] = monthValue.split('-');
  const baseYear = Number(yearRaw) || new Date().getFullYear();
  const baseMonthIndex = (Number(monthRaw) || (new Date().getMonth() + 1)) - 1;
  const date = new Date(baseYear, baseMonthIndex - offset, 1);
  return getMonthRangeFromInput(`${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`);
};

async function safeApiFetch(url, fallback) {
  try {
    return await apiFetch(url);
  } catch (error) {
    console.warn('Falha ao carregar recurso opcional:', url, error);
    return fallback;
  }
}

const TEAM_SOURCE_META = {
  service: {
    label: 'Serviços avulsos',
    short: 'Serviços',
    icon: '✂️',
    color: '#4fc3f7',
    bg: 'rgba(79,195,247,.10)',
  },
  product: {
    label: 'Produtos',
    short: 'Produtos',
    icon: '🧴',
    color: '#9c6fff',
    bg: 'rgba(156,111,255,.10)',
  },
  club: {
    label: 'Comissões do Clube',
    short: 'Clube',
    icon: '💎',
    color: '#ffd700',
    bg: 'rgba(255,215,0,.10)',
  },
  bonus: {
    label: 'Bonificação',
    short: 'Bônus',
    icon: '🎁',
    color: '#00e676',
    bg: 'rgba(0,230,118,.10)',
  },
  vale: {
    label: 'Vale / adiantamento',
    short: 'Vale',
    icon: '🧾',
    color: '#f97316',
    bg: 'rgba(249,115,22,.10)',
  },
  discount: {
    label: 'Desconto',
    short: 'Desconto',
    icon: '−',
    color: '#ff5c74',
    bg: 'rgba(255,92,116,.10)',
  },
  manual_adjustment: {
    label: 'Ajuste manual',
    short: 'Ajuste',
    icon: '⚙️',
    color: '#c0cce8',
    bg: 'rgba(192,204,232,.10)',
  },
  correction: {
    label: 'Correção',
    short: 'Correção',
    icon: '🛠️',
    color: '#4fc3f7',
    bg: 'rgba(79,195,247,.10)',
  },
};

const getTeamSourceMeta = (type) => TEAM_SOURCE_META[type] || TEAM_SOURCE_META.manual_adjustment;


// ══════════════════════════════════════════════════════════════════════════════
// SVG CHARTS
// ══════════════════════════════════════════════════════════════════════════════

function renderDonutChart(segments, size = 120, strokeWidth = 18) {
  if (!segments.length) return '';
  const r = (size / 2) - strokeWidth;
  const cx = size / 2, cy = size / 2;
  const circumference = 2 * Math.PI * r;
  const total = segments.reduce((s, seg) => s + seg.value, 0);
  if (!total) return '';

  let offset = 0;
  const paths = segments.map((seg) => {
    const frac = seg.value / total;
    const dash = frac * circumference;
    const gap  = circumference - dash;
    const el = `
      <circle
        cx="${cx}" cy="${cy}" r="${r}"
        fill="none"
        stroke="${seg.color}"
        stroke-width="${strokeWidth}"
        stroke-dasharray="${dash.toFixed(2)} ${gap.toFixed(2)}"
        stroke-dashoffset="${(-offset * circumference).toFixed(2)}"
        transform="rotate(-90 ${cx} ${cy})"
        stroke-linecap="round"
        style="transition:stroke-dasharray .6s ease;"
      />`;
    offset += frac;
    return el;
  });

  return `
    <svg width="${size}" height="${size}" viewBox="0 0 ${size} ${size}" style="flex-shrink:0;">
      <circle cx="${cx}" cy="${cy}" r="${r}" fill="none" stroke="#1e2345" stroke-width="${strokeWidth}"/>
      ${paths.join('')}
    </svg>`;
}

function renderBarChart(bars, maxVal, height = 60) {
  if (!bars.length || !maxVal) return '';
  const barW  = 28;
  const gap   = 8;
  const width = bars.length * (barW + gap) - gap + 10;

  const rects = bars.map((b, i) => {
    const pct = maxVal > 0 ? b.value / maxVal : 0;
    const bh  = Math.max(pct * height, 2);
    const x   = i * (barW + gap);
    const y   = height - bh;
    return `
      <rect x="${x}" y="${y.toFixed(1)}" width="${barW}" height="${bh.toFixed(1)}"
        rx="5" fill="${b.color}" opacity="0.85"
        style="transition:height .5s ease,y .5s ease;"/>
      <text x="${x + barW / 2}" y="${height + 14}" text-anchor="middle"
        fill="#5a6888" font-size="9" font-family="inherit">${esc(b.label)}</text>`;
  });

  return `
    <svg width="${width}" height="${height + 20}" viewBox="0 0 ${width} ${height + 20}" style="overflow:visible;">
      ${rects.join('')}
    </svg>`;
}

// ══════════════════════════════════════════════════════════════════════════════
// CAIXA — RENDER
// ══════════════════════════════════════════════════════════════════════════════

function renderCashHero() {
  const { register, summary, movements } = financeiroState.cash;
  const isOpen = register?.status === 'open';
  const isClosed = register?.status === 'closed';
  const noRegister = !register;

  const statusColor = isOpen ? '#00e676' : isClosed ? '#5a6888' : '#f97316';
  const statusLabel = isOpen ? 'Caixa aberto' : isClosed ? 'Caixa fechado' : 'Não iniciado';
  const balance = summary?.expectedBalance ?? 0;
  const totalIn = (summary?.totalIncome ?? 0) + (summary?.totalReinforcement ?? 0);
  const totalOut = (summary?.totalExpense ?? 0) + (summary?.totalWithdrawal ?? 0);
  const opening = summary?.openingBalance ?? 0;

  const byMethod = summary?.byMethod || {};
  const methodSegments = Object.entries(byMethod)
    .filter(([, v]) => Number(v) > 0)
    .map(([key, value]) => ({
      label: PAYMENT_METHODS[key]?.label || key,
      value: Number(value),
      color: PAYMENT_METHODS[key]?.color || '#4fc3f7',
    }))
    .sort((a, b) => b.value - a.value);

  const donut = renderDonutChart(methodSegments, 120, 16);

  const typeAgg = { income: 0, expense: 0, withdrawal: 0, reinforcement: 0 };
  for (const m of movements) {
    if (m.type in typeAgg) typeAgg[m.type] += Number(m.amount || 0);
  }
  const barMax = Math.max(...Object.values(typeAgg), 1);
  const bars = [
    { label: 'Entrada', value: typeAgg.income, color: '#00e676' },
    { label: 'Saída', value: typeAgg.expense, color: '#ff5c74' },
    { label: 'Sangria', value: typeAgg.withdrawal, color: '#f97316' },
    { label: 'Reforço', value: typeAgg.reinforcement, color: '#4fc3f7' },
  ];
  const barChart = renderBarChart(bars, barMax, 64);

  const dayChecklist = [
    { label: 'Caixa aberto', done: isOpen || isClosed },
    { label: 'Movimentos registrados', done: movements.length > 0 },
    { label: 'Fechamento conferido', done: isClosed },
  ];

  return `
    <section class="cash-v2-hero" style="--cash-status:${statusColor}">
      <div class="cash-v2-glow"></div>

      <div class="cash-v2-head">
        <div>
          <div class="finance-kicker">CAIXA DIÁRIO</div>
          <h2>Torre de controle do dia</h2>
          <p>Abra, acompanhe, movimente e feche o caixa com leitura visual de entradas, saídas e diferença.</p>
        </div>
        <div class="cash-v2-datebox">
          <label for="cash-date-picker">Data do caixa</label>
          <div>
            <input type="date" id="cash-date-picker" value="${financeiroState.cashDate}">
            <button type="button" id="cash-load-date-btn">Carregar</button>
          </div>
        </div>
      </div>

      <div class="cash-v2-grid">
        <div class="cash-v2-main">
          <div class="cash-v2-status"><span></span>${esc(statusLabel)}</div>
          <small>${isOpen ? `Aberto às ${fmtTime(register?.opened_at)}` : isClosed ? `Fechado às ${fmtTime(register?.closed_at)}` : 'Abra o caixa para iniciar os lançamentos do dia'}</small>
          <strong class="${balance >= 0 ? 'is-positive' : 'is-negative'}">${fmt(isClosed ? register.closing_balance : balance)}</strong>
          <em>${isClosed && register.difference !== null ? `Diferença no fechamento: ${fmt(register.difference)}` : 'Saldo projetado considerando movimentos do dia'}</em>
        </div>

        <div class="cash-v2-metrics">
          ${[
            ['Abertura', opening, '#c0cce8', 'Fundo inicial'],
            ['Entradas', totalIn, '#00e676', 'Receitas + reforços'],
            ['Saídas', totalOut, '#ff5c74', 'Despesas + sangrias'],
            ['Movimentos', movements.length, '#4fc3f7', 'Lançamentos', true],
          ].map(([label, value, color, hint, isCount]) => `
            <div class="cash-v2-chip" style="--accent:${color}">
              <span>${esc(label)}</span>
              <strong>${isCount ? value : fmtCompact(value)}</strong>
              <small>${esc(hint)}</small>
            </div>
          `).join('')}
        </div>
      </div>

      <div class="cash-v2-insights">
        <div class="cash-v2-chart-card">
          <div class="finance-kicker">FORMAS DE PAGAMENTO</div>
          ${methodSegments.length ? `
            <div class="cash-v2-donut">
              <div>${donut}</div>
              <div class="cash-v2-methods">
                ${methodSegments.slice(0, 5).map(s => `
                  <p><i style="background:${s.color}"></i><span>${esc(s.label)}</span><b>${fmtCompact(s.value)}</b></p>
                `).join('')}
              </div>
            </div>` : `<div class="finance-empty-soft">Sem entradas por método ainda.</div>`}
        </div>
        <div class="cash-v2-chart-card">
          <div class="finance-kicker">MOVIMENTOS POR TIPO</div>
          <div class="cash-v2-bars">${barChart || '<div class="finance-empty-soft">Sem movimentos.</div>'}</div>
        </div>
        <div class="cash-v2-check-card">
          <div class="finance-kicker">CHECKLIST DO DIA</div>
          ${dayChecklist.map(item => `
            <div class="cash-v2-check ${item.done ? 'is-done' : ''}">
              <span>${item.done ? '✓' : '○'}</span>
              <b>${esc(item.label)}</b>
            </div>
          `).join('')}
        </div>
      </div>

      <div class="cash-v2-actions">
        ${noRegister ? `<button type="button" id="cash-open-btn" class="cash-action-btn cash-action-btn--primary">🔓 Abrir caixa</button>` : ''}
        ${isOpen ? `
          <button type="button" id="cash-withdrawal-btn" class="cash-action-btn cash-action-btn--warning">⬇ Sangria</button>
          <button type="button" id="cash-reinforcement-btn" class="cash-action-btn cash-action-btn--info">⬆ Reforço</button>
          <button type="button" id="cash-income-btn" class="cash-action-btn cash-action-btn--success">+ Entrada</button>
          <button type="button" id="cash-expense-btn" class="cash-action-btn cash-action-btn--danger">− Saída</button>
          <div class="cash-v2-spacer"></div>
          <button type="button" id="cash-close-btn" class="cash-action-btn cash-action-btn--close">🔒 Fechar caixa</button>
        ` : ''}
      </div>
    </section>

    ${renderMovementsList()}
  `;
}



function renderMovementsList() {
  const { movements } = financeiroState.cash;

  const header = `
    <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:12px;flex-wrap:wrap;gap:8px;">
      <div style="font-size:13px;font-weight:700;color:#e8f0fe;">
        Movimentações
        <span style="font-size:10px;color:#5a6888;margin-left:6px;">(${movements.length})</span>
      </div>
    </div>
  `;

  if (!movements.length) {
    return `
      <div class="card" style="text-align:center;padding:28px 16px;">
        ${header}
        <div style="font-size:32px;margin-bottom:8px;">📭</div>
        <div style="color:#5a6888;font-size:12px;">Nenhuma movimentação registrada.</div>
      </div>`;
  }

  const rows = movements.map((m) => {
    const meta = MOVEMENT_TYPES[m.type] || MOVEMENT_TYPES.income;
    const pmeta = m.payment_method ? (PAYMENT_METHODS[m.payment_method] || {}) : {};
    const isPositive = meta.sign > 0;

    return `
      <div style="
        display:flex;align-items:center;gap:12px;
        padding:12px 14px;border-radius:12px;margin-bottom:6px;
        background:rgba(255,255,255,.02);border:1px solid #1a2040;
        transition:background .15s;
      " onmouseover="this.style.background='rgba(79,195,247,.04)'"
         onmouseout="this.style.background='rgba(255,255,255,.02)'">

        <!-- Ícone do tipo -->
        <div style="
          width:36px;height:36px;border-radius:10px;flex-shrink:0;
          background:${meta.bg};border:1px solid ${meta.color}33;
          display:flex;align-items:center;justify-content:center;
          font-size:14px;
        ">${meta.icon}</div>

        <!-- Info -->
        <div style="flex:1;min-width:0;">
          <div style="font-size:12px;font-weight:700;color:#e8f0fe;
                      white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">
            ${esc(m.description)}
          </div>
          <div style="display:flex;align-items:center;gap:6px;margin-top:3px;flex-wrap:wrap;">
            <span style="font-size:9px;font-weight:700;padding:2px 7px;border-radius:999px;
                         background:${meta.bg};color:${meta.color};">
              ${meta.label}
            </span>
            ${pmeta.label ? `
              <span style="font-size:9px;color:#5a6888;">
                ${pmeta.icon || ''} ${esc(pmeta.label)}
              </span>` : ''}
            <span style="font-size:9px;color:#3a4568;">${fmtTime(m.created_at)}</span>
          </div>
        </div>

        <!-- Valor -->
        <div style="
          font-family:'Orbitron',monospace;font-size:14px;font-weight:800;
          color:${isPositive ? '#00e676' : '#ff5c74'};
          white-space:nowrap;flex-shrink:0;
        ">
          ${isPositive ? '+' : '−'}${fmt(m.amount)}
        </div>
      </div>
    `;
  });

  return `
    <div class="card" style="padding:16px;">
      ${header}
      ${rows.join('')}
    </div>`;
}

// ══════════════════════════════════════════════════════════════════════════════
// FINANCEIRO — MÉTRICAS GERAIS
// ══════════════════════════════════════════════════════════════════════════════

function getMetrics() {
  const tx = getTransactionCockpit();
  const bills = getBillCockpit();

  const legacyCommissions = financeiroState.commissions
    .reduce((s, c) => s + Number(c.commission_amount || 0), 0);

  const teamCommissionGenerated = centsToAmount(
    financeiroState.teamCommissions.summary?.totals?.totalGeneratedCents || 0
  );

  const localCommissions = Math.max(legacyCommissions, teamCommissionGenerated);
  const realizedProfit = tx.incomeAmount - tx.expenseAmount - localCommissions;
  const projectedProfit = tx.incomeAmount - tx.expenseAmount - bills.openAmount - localCommissions;
  const margin = tx.incomeAmount > 0 ? Math.round((realizedProfit / tx.incomeAmount) * 100) : 0;

  const localMetrics = {
    revenue: tx.incomeAmount,
    expenses: tx.expenseAmount,
    openBillsAmount: bills.openAmount,
    overdueBillsAmount: bills.overdueAmount,
    dueSoonBillsAmount: bills.dueSoonAmount,
    openBillsCount: bills.open.length,
    overdueBillsCount: bills.overdue.length,
    dueSoonBillsCount: bills.dueSoon.length,
    paidBillsAmount: bills.paidAmount,
    paidBillsCount: bills.paid.length,
    profit: realizedProfit,
    projectedProfit,
    availableAfterObligations: projectedProfit,
    cashResult: realizedProfit,
    commissions: localCommissions,
    commissionsPaid: 0,
    commissionsPending: localCommissions,
    margin,
    transactionsCount: tx.total,
    avgTicket: 0,
    hasOwnerMetrics: false,
  };

  const owner = getOwnerFinancialSummary(financeiroState.ownerMetrics, localMetrics);

  if (!owner.hasOwnerMetrics) return localMetrics;

  return {
    ...localMetrics,
    revenue: owner.grossRevenue,
    netRevenue: owner.netRevenue,
    expenses: owner.expensesPaid,
    openBillsAmount: owner.billsOpen,
    overdueBillsAmount: owner.billsOverdue,
    profit: owner.managerialResult,
    projectedProfit: owner.forecastResult,
    availableAfterObligations: owner.availableAfterObligations,
    cashResult: owner.cashResult,
    commissions: owner.commissionsGenerated,
    commissionsPaid: owner.commissionsPaid,
    commissionsPending: owner.commissionsPending,
    margin: owner.marginPct,
    avgTicket: owner.avgTicket,
    ordersCount: owner.ordersCount,
    hasOwnerMetrics: true,
  };
}


function renderMetricsBar() {
  const m = getMetrics();
  const health = getFinanceHealth(m);
  const totalObligations = m.expenses + m.openBillsAmount + Math.max(m.commissionsPending ?? m.commissions, 0);
  const maxM = Math.max(m.revenue, totalObligations, Math.abs(m.profit), Math.abs(m.availableAfterObligations), 1);
  const revW = Math.round((m.revenue / maxM) * 100);
  const obligationsW = Math.round((totalObligations / maxM) * 100);
  const resultW = Math.round((Math.abs(m.availableAfterObligations) / maxM) * 100);
  const monthLabel = new Date().toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' }).toUpperCase();
  const sourceLabel = m.hasOwnerMetrics ? 'DADOS CONSOLIDADOS DO DONO' : 'MODO COMPATIBILIDADE';

  const cards = [
    {
      label: 'Receita recebida',
      value: m.revenue,
      color: '#4fc3f7',
      sub: m.ordersCount ? `${m.ordersCount} comanda(s) · ticket ${fmtCompact(m.avgTicket)}` : 'Entradas realizadas no mês',
      icon: '↗',
    },
    {
      label: 'Despesas pagas',
      value: m.expenses,
      color: '#ff5c74',
      sub: 'Só o que já virou saída',
      icon: '↘',
    },
    {
      label: 'Comissões do time',
      value: m.commissions,
      color: '#ffd700',
      sub: m.commissionsPending > 0 ? `Pendente ${fmtCompact(m.commissionsPending)}` : 'Time, Clube e baixas',
      icon: '✦',
    },
    {
      label: 'Contas em aberto',
      value: m.openBillsAmount,
      color: '#f97316',
      sub: `${m.openBillsCount} pendente(s)${m.overdueBillsCount ? ` · ${m.overdueBillsCount} vencida(s)` : ''}`,
      icon: '⌁',
    },
    {
      label: 'Disponível gerencial',
      value: m.availableAfterObligations,
      color: m.availableAfterObligations >= 0 ? '#00e676' : '#ff5c74',
      sub: `Resultado ${fmtCompact(m.profit)}`,
      icon: '◇',
    },
  ];

  return `
    <section class="finance-command-center">
      <div class="finance-command-glow"></div>
      <div class="finance-command-head">
        <div>
          <div class="finance-kicker">CENTRAL FINANCEIRA · ${esc(monthLabel)} · ${esc(sourceLabel)}</div>
          <h2>Dinheiro claro, decisão rápida.</h2>
          <p>
            A mesma leitura gerencial do dashboard: <strong>receita recebida</strong>,
            <strong>despesa paga</strong>, <strong>comissão do time</strong>,
            <strong>contas em aberto</strong> e <strong>disponível gerencial</strong>.
          </p>
        </div>
        <div class="finance-health-pill" style="--health:${health.color}">
          <span>${health.icon}</span>
          <strong>${esc(health.label)}</strong>
          <small>${health.coverage}% de cobertura</small>
        </div>
      </div>

      <div class="finance-command-grid">
        ${cards.map((c) => `
          <article class="finance-command-card" style="--accent:${c.color}">
            <div class="finance-command-card__icon">${c.icon}</div>
            <span>${esc(c.label)}</span>
            <strong>${fmtCompact(c.value)}</strong>
            <small>${esc(c.sub)}</small>
          </article>
        `).join('')}
      </div>

      <div class="finance-flow-board">
        <div class="finance-flow-line">
          <span>Receita recebida</span>
          <div><i style="width:${revW}%"></i></div>
          <b>${fmtCompact(m.revenue)}</b>
        </div>
        <div class="finance-flow-line is-obligation">
          <span>Obrigações</span>
          <div><i style="width:${obligationsW}%"></i></div>
          <b>${fmtCompact(totalObligations)}</b>
        </div>
        <div class="finance-flow-line is-result">
          <span>Disponível gerencial</span>
          <div><i style="width:${resultW}%"></i></div>
          <b>${fmtCompact(m.availableAfterObligations)}</b>
        </div>
      </div>

      <div class="finance-clarity-strip">
        <span>🧾 Aberto continua previsão: entra em <b>Contas em aberto</b>.</span>
        <span>✅ Pago vira <b>Despesa paga</b>.</span>
        <span>💈 Comissão fica visível como obrigação do time.</span>
      </div>
    </section>
  `;
}



// ══════════════════════════════════════════════════════════════════════════════
// BILLS
// ══════════════════════════════════════════════════════════════════════════════

function getBillMeta(bill) {
  if (bill.status === 'paid')      return { color: '#00e676', border: '#00e676', label: 'Pago' };
  if (bill.status === 'cancelled') return { color: '#5a6888', border: '#5a6888', label: 'Cancelado' };
  const due  = new Date(bill.due_date);
  const diff = Math.ceil((due - new Date()) / 86400000);
  if (diff < 0)  return { color: '#ff1744', border: '#ff1744', label: 'Vencido' };
  if (diff <= 3) return { color: '#f97316', border: '#f97316', label: `Vence em ${diff}d` };
  return { color: '#4fc3f7', border: '#4fc3f7', label: fmtDate(bill.due_date) };
}

function renderBillRow(bill) {
  const meta = getBillMeta(bill);
  return `
    <button type="button" class="finance-row-button"
      data-entry-id="${esc(bill.id)}" data-entry-section="bills">
      <div class="fin-row" style="border-left:3px solid ${meta.border};">
        <div style="
          width:36px;height:36px;border-radius:10px;flex-shrink:0;
          background:rgba(255,23,68,.08);border:1px solid rgba(255,23,68,.2);
          display:flex;align-items:center;justify-content:center;font-size:16px;
        ">💸</div>
        <div class="fin-info">
          <div class="fin-title">${esc(bill.description)}</div>
          <div class="fin-date">
            ${esc(meta.label)}
            ${bill.category ? ` · ${esc(bill.category)}` : ''}
          </div>
        </div>
        <div style="text-align:right;flex-shrink:0;">
          <div style="font-family:'Orbitron',monospace;font-size:15px;font-weight:800;color:${meta.color};">
            ${fmt(bill.amount)}
          </div>
        </div>
      </div>
    </button>`;
}

function renderBillsSection() {
  const cockpit = getBillCockpit();
  const bills = financeiroState.bills || [];

  const groups = [
    ['Vencidas', cockpit.overdue, '#ff5c74', 'pedem ação agora'],
    ['Vencem em breve', cockpit.dueSoon, '#f97316', 'próximos 3 dias'],
    ['Em aberto', cockpit.open.filter(b => !isBillOverdue(b) && !isBillDueSoon(b)), '#4fc3f7', 'dentro do prazo'],
    ['Pagas', cockpit.paid, '#00e676', 'já viraram despesa paga'],
  ];

  return `
    <div class="bills-v2-cockpit">
      <div class="bills-v2-head">
        <div>
          <div class="finance-kicker">CONTAS A PAGAR</div>
          <h3>Compromissos separados do que já saiu do caixa</h3>
          <p>Conta em aberto é previsão. Despesa paga é saída realizada.</p>
        </div>
        <div class="bills-v2-total">
          <span>Em aberto</span>
          <strong>${fmt(cockpit.openAmount)}</strong>
        </div>
      </div>
      <div class="bills-v2-grid">
        <div style="--accent:#ff5c74"><span>Vencidas</span><strong>${fmt(cockpit.overdueAmount)}</strong><small>${cockpit.overdue.length} conta(s)</small></div>
        <div style="--accent:#f97316"><span>Próximas</span><strong>${fmt(cockpit.dueSoonAmount)}</strong><small>até 3 dias</small></div>
        <div style="--accent:#00e676"><span>Pagas</span><strong>${fmt(cockpit.paidAmount)}</strong><small>${cockpit.paid.length} baixa(s)</small></div>
        <div style="--accent:#4fc3f7"><span>Total cadastrado</span><strong>${bills.length}</strong><small>registros</small></div>
      </div>
    </div>

    ${bills.length ? groups.map(([title, list, color, hint]) => list.length ? `
      <section class="finance-v2-group">
        <div class="finance-v2-group__head">
          <h4 style="color:${color}">${esc(title)}</h4>
          <span>${list.length} · ${esc(hint)}</span>
        </div>
        ${list.map(renderBillRow).join('')}
      </section>
    ` : '').join('') : `<div class="finance-empty">Nenhuma conta a pagar cadastrada.</div>`}
  `;
}



// ══════════════════════════════════════════════════════════════════════════════
// TRANSACTIONS
// ══════════════════════════════════════════════════════════════════════════════

function renderTransactionRow(t) {
  const isIncome = t.type === 'income';
  const color    = isIncome ? '#00e676' : '#ff1744';
  const pm       = PAYMENT_METHODS[t.payment_method];
  return `
    <button type="button" class="finance-row-button"
      data-entry-id="${esc(t.id)}" data-entry-section="transactions">
      <div class="fin-row" style="border-left:3px solid ${color};">
        <div style="
          width:36px;height:36px;border-radius:10px;flex-shrink:0;
          background:${isIncome ? 'rgba(0,230,118,.08)' : 'rgba(255,23,68,.08)'};
          border:1px solid ${color}33;
          display:flex;align-items:center;justify-content:center;font-size:16px;
        ">${isIncome ? (pm?.icon || '💇') : '🧴'}</div>
        <div class="fin-info">
          <div class="fin-title">${esc(t.description)}</div>
          <div class="fin-date">
            ${esc(fmtDate(t.transaction_date))}
            ${pm ? ` · ${esc(pm.label)}` : ''}
          </div>
        </div>
        <div style="text-align:right;flex-shrink:0;">
          <div style="font-family:'Orbitron',monospace;font-size:15px;font-weight:800;color:${color};">
            ${isIncome ? '+' : '−'}${fmt(t.amount)}
          </div>
        </div>
      </div>
    </button>`;
}

function renderTransactionsSection() {
  const tx = getTransactionCockpit();
  const recent = [...financeiroState.transactions].slice(0, 40);
  const methodRows = Object.entries(tx.byMethod)
    .sort((a, b) => Number(b[1]) - Number(a[1]))
    .slice(0, 5);

  return `
    <div class="transactions-v2-cockpit">
      <div>
        <div class="finance-kicker">TRANSAÇÕES</div>
        <h3>Extrato do mês sem neblina</h3>
        <p>Entradas e saídas realizadas, já refletidas nas métricas do financeiro.</p>
      </div>
      <div class="transactions-v2-grid">
        <div style="--accent:#00e676"><span>Entradas</span><strong>${fmt(tx.incomeAmount)}</strong><small>${tx.income.length} lançamento(s)</small></div>
        <div style="--accent:#ff5c74"><span>Saídas</span><strong>${fmt(tx.expenseAmount)}</strong><small>${tx.expense.length} lançamento(s)</small></div>
        <div style="--accent:#ffd700"><span>Saldo realizado</span><strong>${fmt(tx.incomeAmount - tx.expenseAmount)}</strong><small>antes das comissões</small></div>
      </div>
      ${methodRows.length ? `
        <div class="transactions-v2-methods">
          ${methodRows.map(([key, value]) => {
            const meta = PAYMENT_METHODS[key] || { label: key, icon: '•', color: '#4fc3f7' };
            return `<span style="--accent:${meta.color}">${meta.icon} ${esc(meta.label)} <b>${fmtCompact(value)}</b></span>`;
          }).join('')}
        </div>` : ''}
    </div>
    ${recent.length ? recent.map(renderTransactionRow).join('') : `<div class="finance-empty">Nenhuma transação registrada.</div>`}
  `;
}




// ══════════════════════════════════════════════════════════════════════════════
// COMISSÕES DO TIME — PREMIUM
// ══════════════════════════════════════════════════════════════════════════════

function getTeamCommissionSummaryItems() {
  return financeiroState.teamCommissions.summary?.items || [];
}

function getTeamCommissionTotals() {
  return financeiroState.teamCommissions.summary?.totals || {};
}

function getTeamCommissionPeriod() {
  const tc = financeiroState.teamCommissions;
  return {
    periodStart: tc.periodStart,
    periodEnd: tc.periodEnd,
    monthValue: getMonthValueFromPeriod(tc.periodStart),
  };
}

function buildTeamQuery(extra = {}) {
  const { periodStart, periodEnd } = getTeamCommissionPeriod();
  const params = new URLSearchParams({
    periodStart,
    periodEnd,
    ...extra,
  });

  return params.toString();
}

function renderTeamCommissionHero() {
  const totals = getTeamCommissionTotals();
  const items = getTeamCommissionSummaryItems();
  const period = getTeamCommissionPeriod();

  const pending = Number(totals.pendingCents || 0);
  const generated = Number(totals.totalGeneratedCents || 0);
  const paid = Number(totals.paidCents || 0);

  const paidPct = generated > 0 ? Math.min(100, Math.round((paid / generated) * 100)) : 0;

  return `
    <div class="team-commissions-hero">
      <div class="team-commissions-hero__glow"></div>

      <div class="team-commissions-hero__top">
        <div>
          <div class="team-kicker">COMISSÕES DO TIME</div>
          <h2 class="team-title">Folha inteligente dos barbeiros</h2>
          <p class="team-subtitle">
            Serviços avulsos, Clube, bonificações, vales e baixas em uma visão única, sem conta escondida.
          </p>
        </div>

        <div class="team-period-card">
          <label for="team-commissions-month">Competência</label>
          <input type="month" id="team-commissions-month" value="${esc(period.monthValue)}">
          <button type="button" id="team-commissions-load-month">Atualizar</button>
        </div>
      </div>

      <div class="team-hero-grid">
        <div class="team-hero-main">
          <div class="team-metric-label">Total pendente a pagar</div>
          <div class="team-metric-value ${pending > 0 ? 'is-warning' : 'is-ok'}">${fmtCents(pending)}</div>
          <div class="team-metric-caption">
            ${items.length
              ? `${items.length} profissional(is) com comissão na competência`
              : 'Nenhuma comissão encontrada nesta competência'}
          </div>

          <div class="team-payment-progress">
            <div class="team-payment-progress__bar">
              <span style="width:${paidPct}%"></span>
            </div>
            <div class="team-payment-progress__text">
              ${paidPct}% baixado · ${fmtCents(paid)} pago de ${fmtCents(generated)}
            </div>
          </div>
        </div>

        <div class="team-hero-side">
          ${[
            ['Gerado', totals.totalGeneratedCents, '#4fc3f7', 'Tudo que virou comissão'],
            ['Pago', totals.paidCents, '#00e676', 'Baixas registradas'],
            ['Clube', totals.clubCommissionCents, '#ffd700', 'Assinaturas e pontos'],
            ['Vales', totals.discountCents, '#ff5c74', 'Descontos/adiantamentos'],
          ].map(([label, value, color, hint]) => `
            <div class="team-mini-metric">
              <span>${esc(label)}</span>
              <strong style="color:${color}">${fmtCents(value)}</strong>
              <small>${esc(hint)}</small>
            </div>
          `).join('')}
        </div>
      </div>

      <div class="team-legend-strip">
        <span>Fluxo do fechamento:</span>
        <b>serviços</b>
        <i>+</i>
        <b>Clube</b>
        <i>+</i>
        <b>bônus</b>
        <i>−</i>
        <b>vales</b>
        <i>=</i>
        <b>total a pagar</b>
      </div>
    </div>
  `;
}

function renderTeamCommissionBreakdown() {
  const totals = getTeamCommissionTotals();
  const max = Math.max(
    Number(totals.serviceCommissionCents || 0),
    Number(totals.productCommissionCents || 0),
    Number(totals.clubCommissionCents || 0),
    Number(totals.bonusCents || 0),
    Number(totals.discountCents || 0),
    1
  );

  const rows = [
    ['service', totals.serviceCommissionCents || 0],
    ['product', totals.productCommissionCents || 0],
    ['club', totals.clubCommissionCents || 0],
    ['bonus', totals.bonusCents || 0],
    ['vale', totals.discountCents || 0],
  ];

  return `
    <div class="team-breakdown-card">
      <div class="team-card-head">
        <div>
          <div class="team-kicker">ORIGENS</div>
          <h3>De onde veio a comissão?</h3>
        </div>
      </div>

      <div class="team-breakdown-list">
        ${rows.map(([type, value]) => {
          const meta = getTeamSourceMeta(type);
          const width = Math.max(4, Math.round((Number(value || 0) / max) * 100));
          return `
            <div class="team-breakdown-row">
              <div class="team-breakdown-icon" style="background:${meta.bg};color:${meta.color};border-color:${meta.color}33">${meta.icon}</div>
              <div class="team-breakdown-body">
                <div class="team-breakdown-label">
                  <span>${esc(meta.label)}</span>
                  <strong>${fmtCents(value)}</strong>
                </div>
                <div class="team-breakdown-bar"><span style="width:${width}%;background:${meta.color}"></span></div>
              </div>
            </div>
          `;
        }).join('')}
      </div>
    </div>
  `;
}

function renderTeamCommissionBarberCard(row) {
  const paymentStatus = String(row.payment_status || 'pending');
  const statusLabel = paymentStatus === 'paid' ? 'Pago'
    : paymentStatus === 'partial' ? 'Parcial'
    : 'Pendente';

  const statusClass = paymentStatus === 'paid' ? 'is-paid'
    : paymentStatus === 'partial' ? 'is-partial'
    : 'is-pending';

  const pending = Number(row.pending_cents || 0);

  return `
    <article class="team-barber-card" data-barber-id="${esc(row.barber_id)}">
      <div class="team-barber-card__header">
        <div class="team-avatar">${esc(String(row.barber_name || 'B').slice(0, 1).toUpperCase())}</div>
        <div class="team-barber-info">
          <h3>${esc(row.barber_name || 'Profissional')}</h3>
          <p>${esc(row.barber_email || 'Sem e-mail')}</p>
        </div>
        <div class="team-status-pill ${statusClass}">${statusLabel}</div>
      </div>

      <div class="team-barber-total">
        <span>Total pendente</span>
        <strong>${fmtCents(row.pending_cents)}</strong>
      </div>

      <div class="team-barber-grid">
        <div><span>Serviços</span><strong>${fmtCents(row.service_commission_cents)}</strong></div>
        <div><span>Produtos</span><strong>${fmtCents(row.product_commission_cents)}</strong></div>
        <div><span>Clube</span><strong>${fmtCents(row.club_commission_cents)}</strong></div>
        <div><span>Bônus</span><strong>${fmtCents(row.bonus_cents)}</strong></div>
        <div><span>Vales</span><strong class="danger">−${fmtCents(row.discount_cents)}</strong></div>
        <div><span>Pago</span><strong class="success">${fmtCents(row.paid_cents)}</strong></div>
      </div>

      <div class="team-barber-actions">
        <button type="button" data-team-action="details" data-barber-id="${esc(row.barber_id)}">Ver detalhes</button>
        <button type="button" data-team-action="bonus" data-barber-id="${esc(row.barber_id)}">Bonificação</button>
        <button type="button" data-team-action="vale" data-barber-id="${esc(row.barber_id)}">Vale</button>
        <button type="button" data-team-action="pay" data-barber-id="${esc(row.barber_id)}" ${pending <= 0 ? 'disabled' : ''}>
          Baixar comissão
        </button>
      </div>
    </article>
  `;
}

function renderTeamPeriodSuggestion() {
  const suggestion = financeiroState.teamCommissions.suggestedPeriod;
  if (!suggestion) return '';

  return `
    <div class="team-smart-suggestion">
      <div>
        <span>Competência encontrada</span>
        <strong>${esc(getMonthLabelFromPeriod(suggestion.periodStart))}</strong>
        <small>${esc(suggestion.itemsCount || 0)} profissional(is) · ${fmtCents(suggestion.pendingCents || suggestion.totalGeneratedCents || 0)} pendente</small>
      </div>
      <button type="button"
        data-team-jump-period="${esc(suggestion.monthValue)}"
        data-period-start="${esc(suggestion.periodStart)}"
        data-period-end="${esc(suggestion.periodEnd)}">
        Ver ${esc(getMonthLabelFromPeriod(suggestion.periodStart))}
      </button>
    </div>
  `;
}

function renderTeamCommissionSmartBanner() {
  const items = getTeamCommissionSummaryItems();
  const suggestion = financeiroState.teamCommissions.suggestedPeriod;
  if (items.length || !suggestion) return '';

  return `
    <div class="team-smart-banner">
      <div class="team-smart-banner__icon">🧭</div>
      <div class="team-smart-banner__body">
        <strong>Este mês ainda não tem comissão, mas encontrei o último fechamento com valores.</strong>
        <span>Você pode abrir ${esc(getMonthLabelFromPeriod(suggestion.periodStart))} para conferir barbeiros, origens e pendências.</span>
      </div>
      <button type="button"
        data-team-jump-period="${esc(suggestion.monthValue)}"
        data-period-start="${esc(suggestion.periodStart)}"
        data-period-end="${esc(suggestion.periodEnd)}">
        Abrir período encontrado
      </button>
    </div>
  `;
}

function renderTeamCommissionList() {
  const items = getTeamCommissionSummaryItems();

  if (!items.length) {
    return `
      <div class="team-empty-state">
        <div>🧾</div>
        <h3>Nenhuma comissão nesta competência</h3>
        <p>Quando serviços, Clube, bonificações ou vales entrarem no período, o resumo do time aparecerá aqui.</p>
        ${renderTeamPeriodSuggestion()}
      </div>
    `;
  }

  return `
    <div class="team-list-head">
      <div>
        <div class="team-kicker">PROFISSIONAIS</div>
        <h3>Quanto pagar para cada barbeiro</h3>
      </div>
      <span>${items.length} registro(s)</span>
    </div>

    <div class="team-barber-grid-list">
      ${items.map(renderTeamCommissionBarberCard).join('')}
    </div>
  `;
}

function renderTeamCommissionSourcesCompact() {
  const sources = financeiroState.teamCommissions.sources || [];

  if (!sources.length) {
    return `
      <div class="team-sources-card">
        <div class="team-card-head">
          <div>
            <div class="team-kicker">RASTREIO</div>
            <h3>Últimas origens</h3>
          </div>
        </div>
        <div class="team-empty-line">Sem detalhes para o período.</div>
      </div>
    `;
  }

  return `
    <div class="team-sources-card">
      <div class="team-card-head">
        <div>
          <div class="team-kicker">RASTREIO</div>
          <h3>Últimas origens</h3>
        </div>
        <small>${sources.length} item(ns)</small>
      </div>

      <div class="team-source-list">
        ${sources.slice(0, 8).map((source) => {
          const meta = getTeamSourceMeta(source.source_type);
          const isNegative = Number(source.commission_cents || 0) < 0;
          return `
            <div class="team-source-row">
              <div class="team-source-icon" style="background:${meta.bg};color:${meta.color};border-color:${meta.color}33">${meta.icon}</div>
              <div class="team-source-main">
                <strong>${esc(source.description || meta.label)}</strong>
                <span>${esc(meta.short)} · ${esc(fmtDate(source.source_date))}</span>
              </div>
              <div class="team-source-value ${isNegative ? 'danger' : ''}">
                ${isNegative ? '−' : ''}${fmtCents(Math.abs(Number(source.commission_cents || 0)))}
              </div>
            </div>
          `;
        }).join('')}
      </div>
    </div>
  `;
}

function renderTeamCommissionsSection() {
  const tc = financeiroState.teamCommissions;

  if (tc.isLoading) {
    return `
      <div class="team-loading">
        <div>⟳</div>
        <span>Carregando comissões do time...</span>
      </div>
    `;
  }

  return `
    ${renderTeamCommissionHero()}
    ${renderTeamCommissionSmartBanner()}

    <div class="team-commission-layout">
      <div class="team-commission-main">
        ${renderTeamCommissionList()}
      </div>
      <aside class="team-commission-side">
        ${renderTeamCommissionBreakdown()}
        ${renderTeamCommissionSourcesCompact()}
      </aside>
    </div>
  `;
}

function getTeamRowByBarberId(barberId) {
  return getTeamCommissionSummaryItems().find((row) => row.barber_id === barberId) || null;
}

function getTeamSourcesByBarberId(barberId) {
  return (financeiroState.teamCommissions.sources || []).filter((source) => source.barber_id === barberId);
}

function renderTeamCommissionDetails(row) {
  const sources = getTeamSourcesByBarberId(row.barber_id);

  return `
    <div class="finance-modal-body team-modal-body">
      <div>
        <div class="modal-title" style="margin:0;">${esc(row.barber_name || 'Profissional')}</div>
        <div class="modal-sub" style="margin-top:4px;">Extrato de comissão da competência</div>
      </div>

      <div class="team-modal-summary">
        <div><span>Total gerado</span><strong>${fmtCents(row.total_generated_cents)}</strong></div>
        <div><span>Pago</span><strong>${fmtCents(row.paid_cents)}</strong></div>
        <div><span>Pendente</span><strong>${fmtCents(row.pending_cents)}</strong></div>
      </div>

      <div class="team-modal-source-list">
        ${sources.length ? sources.map((source) => {
          const meta = getTeamSourceMeta(source.source_type);
          const isNegative = Number(source.commission_cents || 0) < 0;
          return `
            <div class="team-modal-source">
              <div class="team-source-icon" style="background:${meta.bg};color:${meta.color};border-color:${meta.color}33">${meta.icon}</div>
              <div>
                <strong>${esc(source.description || meta.label)}</strong>
                <span>${esc(meta.label)} · ${esc(fmtDate(source.source_date))} · status ${esc(source.status || '—')}</span>
              </div>
              <b class="${isNegative ? 'danger' : ''}">${isNegative ? '−' : ''}${fmtCents(Math.abs(Number(source.commission_cents || 0)))}</b>
            </div>
          `;
        }).join('') : `<div class="team-empty-line">Nenhuma origem encontrada.</div>`}
      </div>

      <div class="modal-buttons" style="margin-top:10px;">
        <button type="button" class="btn-cancel" id="finance-form-cancel">Fechar</button>
      </div>
    </div>
  `;
}

function renderTeamAdjustmentForm(kind, barberId) {
  const row = getTeamRowByBarberId(barberId);
  const period = getTeamCommissionPeriod();

  const isVale = kind === 'vale';
  const title = isVale ? 'Adicionar vale / desconto' : 'Adicionar bonificação';
  const type = isVale ? 'vale' : 'bonus';
  const direction = isVale ? 'subtract' : 'add';
  const color = isVale ? '#f97316' : '#00e676';

  return `
    <div class="finance-modal-body team-modal-body">
      <div>
        <div class="modal-title" style="margin:0;color:${color};">${esc(title)}</div>
        <div class="modal-sub" style="margin-top:4px;">
          ${esc(row?.barber_name || 'Profissional')} · ${esc(fmtDate(period.periodStart))} a ${esc(fmtDate(period.periodEnd))}
        </div>
      </div>

      <form id="team-adjustment-form" class="finance-form" data-type="${type}" data-direction="${direction}" data-barber-id="${esc(barberId)}">
        <div>
          <div class="color-section-label">Valor (R$)</div>
          <input class="modal-input" name="amount" type="number" min="0.01" step="0.01" placeholder="0,00">
        </div>
        <div>
          <div class="color-section-label">Motivo</div>
          <textarea class="modal-input" name="reason" rows="3" placeholder="${isVale ? 'Ex: Vale solicitado pelo barbeiro' : 'Ex: Bônus por meta batida'}"></textarea>
        </div>

        <div id="team-adjustment-feedback" class="finance-form-feedback"></div>

        <div class="modal-buttons" style="margin-top:10px;">
          <button type="button" class="btn-cancel" id="finance-form-cancel">Cancelar</button>
          <button type="submit" class="btn-save" style="background:${color};color:#07111f;font-weight:900;">
            Confirmar
          </button>
        </div>
      </form>
    </div>
  `;
}

function renderTeamPaymentForm(barberId) {
  const row = getTeamRowByBarberId(barberId);
  const period = getTeamCommissionPeriod();
  const pending = centsToAmount(row?.pending_cents || 0);

  return `
    <div class="finance-modal-body team-modal-body">
      <div>
        <div class="modal-title" style="margin:0;color:#00e676;">Baixar comissão</div>
        <div class="modal-sub" style="margin-top:4px;">
          ${esc(row?.barber_name || 'Profissional')} · pendente ${fmt(pending)}
        </div>
      </div>

      <form id="team-payment-form" class="finance-form" data-barber-id="${esc(barberId)}">
        <div>
          <div class="color-section-label">Valor pago (R$)</div>
          <input class="modal-input" name="amount" type="number" min="0.01" step="0.01" value="${pending.toFixed(2)}">
        </div>
        <div>
          <div class="color-section-label">Forma de pagamento</div>
          <select class="modal-input" name="payment_method">
            <option value="pix">Pix</option>
            <option value="dinheiro">Dinheiro</option>
            <option value="transferencia">Transferência</option>
            <option value="outro">Outro</option>
          </select>
        </div>
        <div>
          <div class="color-section-label">Observações</div>
          <textarea class="modal-input" name="notes" rows="3" placeholder="Opcional"></textarea>
        </div>

        <div class="team-payment-warning">
          Essa baixa fica registrada no histórico. O cálculo de origem continua auditável.
        </div>

        <div id="team-payment-feedback" class="finance-form-feedback"></div>

        <div class="modal-buttons" style="margin-top:10px;">
          <button type="button" class="btn-cancel" id="finance-form-cancel">Cancelar</button>
          <button type="submit" class="btn-save" style="background:#00e676;color:#07111f;font-weight:900;">
            Baixar comissão
          </button>
        </div>
      </form>
    </div>
  `;
}

// ══════════════════════════════════════════════════════════════════════════════
// MODALS
// ══════════════════════════════════════════════════════════════════════════════

function renderBillDetails(bill) {
  const meta = getBillMeta(bill);
  return `
    <div class="finance-modal-body">
      <div>
        <div class="modal-title" style="margin:0;">${esc(bill.description)}</div>
        <div class="modal-sub" style="margin-top:4px;">Conta a pagar</div>
      </div>
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:10px;">
        <div class="mini-card">
          <div class="mini-lbl">Valor</div>
          <div class="mini-val" style="color:${meta.color};font-family:'Orbitron',monospace;">${fmt(bill.amount)}</div>
        </div>
        <div class="mini-card">
          <div class="mini-lbl">Status</div>
          <div class="mini-val" style="font-size:14px;color:${meta.color};">${esc(meta.label)}</div>
        </div>
      </div>
      <div style="display:grid;gap:8px;">
        ${[
          ['Vencimento', fmtDate(bill.due_date)],
          ['Categoria',  bill.category || '—'],
          ['Fornecedor', bill.supplier  || '—'],
          ['Observações',bill.notes     || '—'],
        ].map(([k,v]) => `
          <div style="padding:10px 12px;border:1px solid #1e2345;border-radius:10px;background:#0a0c1a;color:#c0cce8;font-size:11px;">
            <strong>${esc(k)}:</strong> ${esc(v)}
          </div>`).join('')}
      </div>
      <div id="finance-modal-feedback" style="min-height:18px;font-size:10px;color:#5a6888;"></div>
      <div class="modal-buttons" style="margin-top:10px;">
        <button type="button" class="btn-cancel" id="finance-modal-close">Fechar</button>
        ${bill.status !== 'paid' && bill.status !== 'cancelled' ? `
          <button type="button" class="btn-save" id="finance-pay-bill-btn" data-bill-id="${esc(bill.id)}">
            ✓ Marcar como paga
          </button>` : ''}
      </div>
    </div>`;
}

function renderBillForm() {
  return `
    <div class="finance-modal-body">
      <div class="modal-title" style="margin:0;">Nova conta a pagar</div>
      <form id="finance-bill-form" class="finance-form">
        <div style="display:grid;grid-template-columns:1fr 1fr;gap:10px;">
          <div style="grid-column:1/-1;">
            <div class="color-section-label">Descrição *</div>
            <input class="modal-input" name="description" type="text" placeholder="Ex: Aluguel"/>
          </div>
          <div>
            <div class="color-section-label">Valor (R$) *</div>
            <input class="modal-input" name="amount" type="number" min="0" step="0.01" placeholder="0,00"/>
          </div>
          <div>
            <div class="color-section-label">Vencimento *</div>
            <input class="modal-input" name="due_date" type="date"/>
          </div>
          <div>
            <div class="color-section-label">Categoria</div>
            <input class="modal-input" name="category" type="text" placeholder="Ex: Aluguel, Energia"/>
          </div>
          <div>
            <div class="color-section-label">Fornecedor</div>
            <input class="modal-input" name="supplier" type="text" placeholder="Nome do fornecedor"/>
          </div>
        </div>
        <div>
          <div class="color-section-label">Observações</div>
          <textarea class="modal-input" name="notes" rows="3" style="resize:vertical;" placeholder="Observações"></textarea>
        </div>
        <div id="finance-form-feedback" style="min-height:18px;font-size:10px;color:#5a6888;"></div>
        <div class="modal-buttons" style="margin-top:10px;">
          <button type="button" class="btn-cancel" id="finance-form-cancel">Cancelar</button>
          <button type="submit" class="btn-save">Salvar conta</button>
        </div>
      </form>
    </div>`;
}

function renderTransactionForm() {
  return `
    <div class="finance-modal-body">
      <div class="modal-title" style="margin:0;">Nova transação</div>
      <form id="finance-transaction-form" class="finance-form">
        <div style="display:grid;grid-template-columns:1fr 1fr;gap:10px;">
          <div>
            <div class="color-section-label">Tipo</div>
            <select class="modal-input" name="type">
              <option value="income">Entrada</option>
              <option value="expense">Saída</option>
            </select>
          </div>
          <div>
            <div class="color-section-label">Forma de pagamento</div>
            <select class="modal-input" name="payment_method">
              ${Object.entries(PAYMENT_METHODS).map(([k,v]) =>
                `<option value="${esc(k)}">${esc(v.icon)} ${esc(v.label)}</option>`).join('')}
            </select>
          </div>
          <div style="grid-column:1/-1;">
            <div class="color-section-label">Descrição *</div>
            <input class="modal-input" name="description" type="text" placeholder="Ex: Corte — Rafael"/>
          </div>
          <div>
            <div class="color-section-label">Valor (R$) *</div>
            <input class="modal-input" name="amount" type="number" min="0" step="0.01" placeholder="0,00"/>
          </div>
          <div>
            <div class="color-section-label">Data</div>
            <input class="modal-input" name="transaction_date" type="date" value="${new Date().toISOString().split('T')[0]}"/>
          </div>
          <div>
            <div class="color-section-label">Categoria</div>
            <input class="modal-input" name="category" type="text" placeholder="Ex: Serviço, Produto"/>
          </div>
        </div>
        <div id="finance-form-feedback" style="min-height:18px;font-size:10px;color:#5a6888;"></div>
        <div class="modal-buttons" style="margin-top:10px;">
          <button type="button" class="btn-cancel" id="finance-form-cancel">Cancelar</button>
          <button type="submit" class="btn-save">Salvar transação</button>
        </div>
      </form>
    </div>`;
}

// ── Modal: abrir caixa ─────────────────────────────────────────────────────────
function renderOpenCashForm() {
  return `
    <div class="finance-modal-body">
      <div>
        <div class="modal-title" style="margin:0;">🔓 Abrir Caixa</div>
        <div class="modal-sub" style="margin-top:4px;">Informe o troco / fundo de caixa inicial.</div>
      </div>
      <form id="cash-open-form" class="finance-form">
        <div>
          <div class="color-section-label">Saldo inicial (R$)</div>
          <input class="modal-input" name="opening_balance" type="number" min="0" step="0.01"
            placeholder="0,00" value="0"/>
        </div>
        <div>
          <div class="color-section-label">Observações</div>
          <textarea class="modal-input" name="notes" rows="2" style="resize:vertical;"
            placeholder="Ex: Troco do dia anterior"></textarea>
        </div>
        <div id="cash-open-feedback" style="min-height:18px;font-size:10px;color:#5a6888;"></div>
        <div class="modal-buttons" style="margin-top:10px;">
          <button type="button" class="btn-cancel" id="finance-form-cancel">Cancelar</button>
          <button type="submit" class="btn-save" style="background:linear-gradient(135deg,#00e676,#00b4ff);color:#000;">
            🔓 Abrir caixa
          </button>
        </div>
      </form>
    </div>`;
}

// ── Modal: fechar caixa ────────────────────────────────────────────────────────
function renderCloseCashForm() {
  const { summary } = financeiroState.cash;
  const expected = summary?.expectedBalance ?? 0;
  return `
    <div class="finance-modal-body">
      <div>
        <div class="modal-title" style="margin:0;">🔒 Fechar Caixa</div>
        <div class="modal-sub" style="margin-top:4px;">Confirme o valor físico em caixa.</div>
      </div>
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:10px;margin-bottom:4px;">
        <div class="mini-card">
          <div class="mini-lbl">Saldo projetado</div>
          <div class="mini-val" style="font-family:'Orbitron',monospace;font-size:16px;color:#4fc3f7;">${fmt(expected)}</div>
        </div>
        <div class="mini-card">
          <div class="mini-lbl">Diferença</div>
          <div class="mini-val" style="font-size:16px;color:#5a6888;" id="cash-close-diff">R$ 0,00</div>
        </div>
      </div>
      <form id="cash-close-form" class="finance-form">
        <div>
          <div class="color-section-label">Valor físico em caixa (R$)</div>
          <input class="modal-input" name="closing_balance" type="number" min="0" step="0.01"
            placeholder="${expected.toFixed(2)}" value="${expected.toFixed(2)}"
            data-expected="${expected}"/>
        </div>
        <div>
          <div class="color-section-label">Observações</div>
          <textarea class="modal-input" name="notes" rows="2" style="resize:vertical;"
            placeholder="Observações do fechamento"></textarea>
        </div>
        <div id="cash-close-feedback" style="min-height:18px;font-size:10px;color:#5a6888;"></div>
        <div class="modal-buttons" style="margin-top:10px;">
          <button type="button" class="btn-cancel" id="finance-form-cancel">Cancelar</button>
          <button type="submit" class="btn-save" style="background:linear-gradient(135deg,#5a6888,#3a4568);color:#fff;">
            🔒 Confirmar fechamento
          </button>
        </div>
      </form>
    </div>`;
}

// ── Modal: movimentação manual (sangria/reforço/entrada/saída) ─────────────────
function renderMovementForm(type) {
  const meta = MOVEMENT_TYPES[type];
  const labels = {
    withdrawal:    { title: '⬇ Sangria', desc: 'Retirada de dinheiro do caixa.', pm: false },
    reinforcement: { title: '⬆ Reforço', desc: 'Depósito de dinheiro no caixa.', pm: false },
    income:        { title: '+ Entrada manual', desc: 'Entrada avulsa não vinculada a serviço.', pm: true },
    expense:       { title: '− Saída manual', desc: 'Saída avulsa (compra, despesa rápida etc.).', pm: true },
  };
  const lbl = labels[type];

  return `
    <div class="finance-modal-body">
      <div>
        <div class="modal-title" style="margin:0;color:${meta.color};">${lbl.title}</div>
        <div class="modal-sub" style="margin-top:4px;">${lbl.desc}</div>
      </div>
      <form id="cash-movement-form" class="finance-form" data-type="${type}">
        <div>
          <div class="color-section-label">Descrição *</div>
          <input class="modal-input" name="description" type="text"
            placeholder="Ex: ${type === 'withdrawal' ? 'Retirada do responsável' : type === 'reinforcement' ? 'Troco adicional' : 'Venda avulsa'}"/>
        </div>
        <div>
          <div class="color-section-label">Valor (R$) *</div>
          <input class="modal-input" name="amount" type="number" min="0.01" step="0.01" placeholder="0,00"/>
        </div>
        ${lbl.pm ? `
          <div>
            <div class="color-section-label">Forma de pagamento</div>
            <select class="modal-input" name="payment_method">
              ${Object.entries(PAYMENT_METHODS).map(([k,v]) =>
                `<option value="${esc(k)}">${esc(v.icon)} ${esc(v.label)}</option>`).join('')}
            </select>
          </div>` : ''}
        <div>
          <div class="color-section-label">Observações</div>
          <textarea class="modal-input" name="notes" rows="2" style="resize:vertical;" placeholder="Opcional"></textarea>
        </div>
        <div id="cash-movement-feedback" style="min-height:18px;font-size:10px;color:#5a6888;"></div>
        <div class="modal-buttons" style="margin-top:10px;">
          <button type="button" class="btn-cancel" id="finance-form-cancel">Cancelar</button>
          <button type="submit" class="btn-save" style="background:${meta.color};color:#000;font-weight:800;">
            Confirmar
          </button>
        </div>
      </form>
    </div>`;
}

// ══════════════════════════════════════════════════════════════════════════════
// MODAL CONTROL
// ══════════════════════════════════════════════════════════════════════════════

function openModal(mode, section = null, entryId = null) {
  financeiroState.modalMode    = mode;
  financeiroState.activeSection = section;
  financeiroState.activeEntryId = entryId;
  renderFinanceModal();
}

function closeFinanceModal() {
  const modal   = document.getElementById('finance-details-modal');
  const content = document.getElementById('finance-details-content');
  if (!modal) return;
  financeiroState.modalMode     = 'closed';
  financeiroState.activeSection = null;
  financeiroState.activeEntryId = null;
  modal.classList.remove('open');
  modal.style.display = 'none';
  if (content) content.innerHTML = '';
}

function renderFinanceModal() {
  const modal   = document.getElementById('finance-details-modal');
  const content = document.getElementById('finance-details-content');
  if (!modal || !content) return;

  const mode = financeiroState.modalMode;
  if (mode === 'closed') { closeFinanceModal(); return; }

  if (mode === 'viewBill') {
    const bill = financeiroState.bills.find(b => b.id === financeiroState.activeEntryId);
    if (!bill) { closeFinanceModal(); return; }
    content.innerHTML = renderBillDetails(bill);
  }
  else if (mode === 'createBill')        content.innerHTML = renderBillForm();
  else if (mode === 'createTransaction') content.innerHTML = renderTransactionForm();
  else if (mode === 'openCash')          content.innerHTML = renderOpenCashForm();
  else if (mode === 'closeCash')         content.innerHTML = renderCloseCashForm();
  else if (mode === 'viewTeamCommission') {
    const row = getTeamRowByBarberId(financeiroState.activeEntryId);
    if (!row) { closeFinanceModal(); return; }
    content.innerHTML = renderTeamCommissionDetails(row);
  }
  else if (mode === 'teamBonus' || mode === 'teamVale') {
    content.innerHTML = renderTeamAdjustmentForm(mode === 'teamVale' ? 'vale' : 'bonus', financeiroState.activeEntryId);
  }
  else if (mode === 'teamPayment') {
    content.innerHTML = renderTeamPaymentForm(financeiroState.activeEntryId);
  }
  else if (['withdrawal','reinforcement','income','expense'].includes(mode))
    content.innerHTML = renderMovementForm(mode);

  modal.style.display = 'flex';
  modal.classList.add('open');
  bindModalEvents();
}

// ══════════════════════════════════════════════════════════════════════════════
// API CALLS
// ══════════════════════════════════════════════════════════════════════════════

async function loadFinanceiroData() {
  financeiroState.isLoading = true;
  rerenderFinanceiro();

  try {
    const now   = new Date();
    const start = new Date(now.getFullYear(), now.getMonth(), 1).toISOString().split('T')[0];
    const end   = new Date(now.getFullYear(), now.getMonth() + 1, 0).toISOString().split('T')[0];

    const teamQuery = buildTeamQuery();

    const [bills, transactions, commissions, cashData, teamSummary, teamSources, ownerMetrics] = await Promise.all([
      apiFetch('/api/financial/bills'),
      apiFetch(`/api/financial/transactions?start=${start}&end=${end}`),
      apiFetch('/api/financial/commissions'),
      apiFetch(`/api/financial/cash?date=${financeiroState.cashDate}`),
      safeApiFetch(`/api/team-commissions/summary?${teamQuery}`, { items: [], totals: {} }),
      safeApiFetch(`/api/team-commissions/sources?${teamQuery}`, { items: [] }),
      safeApiFetch('/api/financial/owner-metrics?period=month', null),
    ]);

    financeiroState.bills         = Array.isArray(bills)        ? bills        : [];
    financeiroState.transactions  = Array.isArray(transactions) ? transactions : [];
    financeiroState.commissions   = Array.isArray(commissions)  ? commissions  : [];
    financeiroState.ownerMetrics  = ownerMetrics && typeof ownerMetrics === 'object' ? ownerMetrics : null;
    financeiroState.cash          = cashData && typeof cashData === 'object'
      ? { register: cashData.register || null, movements: cashData.movements || [], summary: cashData.summary || null }
      : { register: null, movements: [], summary: null };
    financeiroState.teamCommissions.summary = teamSummary || { items: [], totals: {} };
    financeiroState.teamCommissions.sources = Array.isArray(teamSources?.items) ? teamSources.items : [];
    financeiroState.teamCommissions.suggestedPeriod = hasTeamCommissionData(financeiroState.teamCommissions.summary)
      ? null
      : await findLatestTeamCommissionPeriod();
    financeiroState.isLoaded = true;
  } catch (error) {
    console.error('Erro ao carregar financeiro:', error);
  } finally {
    financeiroState.isLoading = false;
    rerenderFinanceiro();
  }
}

async function loadCashForDate(date) {
  financeiroState.cashDate = date;
  try {
    const cashData = await apiFetch(`/api/financial/cash?date=${date}`);
    financeiroState.cash = cashData && typeof cashData === 'object'
      ? { register: cashData.register || null, movements: cashData.movements || [], summary: cashData.summary || null }
      : { register: null, movements: [], summary: null };
  } catch (e) {
    console.error(e);
  }
  const cashContainer = document.getElementById('finance-cash-container');
  if (cashContainer) cashContainer.innerHTML = renderCashHero();
  bindCashEvents();
}

async function findLatestTeamCommissionPeriod(maxMonthsBack = 12) {
  const tc = financeiroState.teamCommissions;

  for (let offset = 1; offset <= maxMonthsBack; offset += 1) {
    const range = getPreviousMonthRange(tc.periodStart, offset);
    const query = new URLSearchParams({
      periodStart: range.periodStart,
      periodEnd: range.periodEnd,
    }).toString();

    const summary = await safeApiFetch(`/api/team-commissions/summary?${query}`, null);
    if (hasTeamCommissionData(summary)) {
      const totals = summary?.totals || {};
      const items = Array.isArray(summary?.items) ? summary.items : [];
      return {
        ...range,
        itemsCount: items.length,
        totalGeneratedCents: Number(totals.totalGeneratedCents || 0),
        pendingCents: Number(totals.pendingCents || 0),
      };
    }
  }

  return null;
}

async function loadTeamCommissionsData({ rerender = false } = {}) {
  const tc = financeiroState.teamCommissions;
  const query = buildTeamQuery();

  if (rerender) {
    tc.isLoading = true;
    const root = document.getElementById('finance-root');
    if (root && financeiroState.activeTab === 'comissoes') rerenderFinanceiro();
  }

  try {
    const [summary, sources, adjustments, payments] = await Promise.all([
      apiFetch(`/api/team-commissions/summary?${query}`),
      apiFetch(`/api/team-commissions/sources?${query}`),
      safeApiFetch(`/api/team-commissions/adjustments?${query}`, { items: [] }),
      safeApiFetch(`/api/team-commissions/payments?${query}`, { items: [] }),
    ]);

    tc.summary = summary || { items: [], totals: {} };
    tc.sources = Array.isArray(sources?.items) ? sources.items : [];
    tc.adjustments = Array.isArray(adjustments?.items) ? adjustments.items : [];
    tc.payments = Array.isArray(payments?.items) ? payments.items : [];
    tc.suggestedPeriod = hasTeamCommissionData(tc.summary) ? null : await findLatestTeamCommissionPeriod();
  } catch (error) {
    console.error('Erro ao carregar comissões do time:', error);
    tc.summary = { items: [], totals: {} };
    tc.sources = [];
  } finally {
    tc.isLoading = false;
    if (rerender && financeiroState.activeTab === 'comissoes') rerenderFinanceiro();
  }
}

async function handleTeamPeriodChange() {
  const input = document.getElementById('team-commissions-month');
  const range = getMonthRangeFromInput(input?.value);

  financeiroState.teamCommissions.periodStart = range.periodStart;
  financeiroState.teamCommissions.periodEnd = range.periodEnd;
  financeiroState.teamCommissions.suggestedPeriod = null;

  await loadTeamCommissionsData({ rerender: true });
}

async function handleTeamJumpToSuggestedPeriod(event) {
  const btn = event.currentTarget;
  const periodStart = btn.dataset.periodStart;
  const periodEnd = btn.dataset.periodEnd;

  if (!periodStart || !periodEnd) return;

  financeiroState.teamCommissions.periodStart = periodStart;
  financeiroState.teamCommissions.periodEnd = periodEnd;
  financeiroState.teamCommissions.suggestedPeriod = null;

  await loadTeamCommissionsData({ rerender: true });
}

async function handleCreateTeamAdjustment(event) {
  event.preventDefault();

  const form = document.getElementById('team-adjustment-form');
  const formData = new FormData(form);
  const btn = form.querySelector('button[type="submit"]');
  const period = getTeamCommissionPeriod();

  const amount = Number(formData.get('amount') || 0);
  const reason = String(formData.get('reason') || '').trim();
  const barberId = form.dataset.barberId;
  const adjustmentType = form.dataset.type;
  const direction = form.dataset.direction;

  if (!amount || amount <= 0) {
    setFeedback('team-adjustment-feedback', 'Informe um valor válido.', 'error');
    return;
  }

  if (!reason) {
    setFeedback('team-adjustment-feedback', 'Informe o motivo.', 'error');
    return;
  }

  try {
    if (btn) btn.disabled = true;
    setFeedback('team-adjustment-feedback', 'Registrando ajuste...', 'neutral');

    await apiFetch('/api/team-commissions/adjustments', {
      method: 'POST',
      body: JSON.stringify({
        barberId,
        periodStart: period.periodStart,
        periodEnd: period.periodEnd,
        adjustmentType,
        direction,
        amount,
        reason,
      }),
    });

    closeFinanceModal();
    await loadTeamCommissionsData({ rerender: true });
  } catch (error) {
    setFeedback('team-adjustment-feedback', error instanceof Error ? error.message : 'Erro ao registrar ajuste.', 'error');
    if (btn) btn.disabled = false;
  }
}

async function handleCreateTeamPayment(event) {
  event.preventDefault();

  const form = document.getElementById('team-payment-form');
  const formData = new FormData(form);
  const btn = form.querySelector('button[type="submit"]');
  const period = getTeamCommissionPeriod();

  const amount = Number(formData.get('amount') || 0);
  const barberId = form.dataset.barberId;

  if (!amount || amount <= 0) {
    setFeedback('team-payment-feedback', 'Informe um valor válido.', 'error');
    return;
  }

  try {
    if (btn) btn.disabled = true;
    setFeedback('team-payment-feedback', 'Baixando comissão...', 'neutral');

    await apiFetch('/api/team-commissions/payments', {
      method: 'POST',
      body: JSON.stringify({
        barberId,
        periodStart: period.periodStart,
        periodEnd: period.periodEnd,
        amount,
        paymentMethod: String(formData.get('payment_method') || 'pix'),
        notes: String(formData.get('notes') || '').trim() || null,
      }),
    });

    closeFinanceModal();
    await loadTeamCommissionsData({ rerender: true });
  } catch (error) {
    setFeedback('team-payment-feedback', error instanceof Error ? error.message : 'Erro ao baixar comissão.', 'error');
    if (btn) btn.disabled = false;
  }
}


async function handleCreateBill(event) {
  event.preventDefault();
  const form     = document.getElementById('finance-bill-form');
  const formData = new FormData(form);
  const btn      = form.querySelector('button[type="submit"]');
  const desc     = String(formData.get('description') || '').trim();
  const amount   = Number(formData.get('amount') || 0);
  const due_date = String(formData.get('due_date') || '').trim();

  if (!desc)             { setFeedback('finance-form-feedback', 'Informe a descrição.', 'error');     return; }
  if (!amount || amount <= 0) { setFeedback('finance-form-feedback', 'Informe um valor válido.', 'error'); return; }
  if (!due_date)         { setFeedback('finance-form-feedback', 'Informe o vencimento.', 'error');    return; }

  try {
    if (btn) btn.disabled = true;
    setFeedback('finance-form-feedback', 'Salvando...', 'neutral');
    await apiFetch('/api/financial/bills', {
      method: 'POST',
      body: JSON.stringify({
        description: desc, amount, due_date,
        category: String(formData.get('category') || '').trim() || null,
        supplier:  String(formData.get('supplier') || '').trim() || null,
        notes:     String(formData.get('notes') || '').trim()    || null,
        status: 'pending',
      }),
    });
    closeFinanceModal();
    await loadFinanceiroData();
  } catch (error) {
    setFeedback('finance-form-feedback', error instanceof Error ? error.message : 'Erro ao salvar.', 'error');
    if (btn) btn.disabled = false;
  }
}

async function handleCreateTransaction(event) {
  event.preventDefault();
  const form     = document.getElementById('finance-transaction-form');
  const formData = new FormData(form);
  const btn      = form.querySelector('button[type="submit"]');
  const desc     = String(formData.get('description') || '').trim();
  const amount   = Number(formData.get('amount') || 0);

  if (!desc)             { setFeedback('finance-form-feedback', 'Informe a descrição.', 'error');     return; }
  if (!amount || amount <= 0) { setFeedback('finance-form-feedback', 'Informe um valor válido.', 'error'); return; }

  try {
    if (btn) btn.disabled = true;
    setFeedback('finance-form-feedback', 'Salvando...', 'neutral');
    await apiFetch('/api/financial/transactions', {
      method: 'POST',
      body: JSON.stringify({
        type:             String(formData.get('type') || 'income'),
        description:      desc,
        amount,
        transaction_date: String(formData.get('transaction_date') || new Date().toISOString().split('T')[0]),
        category:         String(formData.get('category') || '').trim() || null,
        payment_method:   String(formData.get('payment_method') || 'pix'),
        notes:            String(formData.get('notes') || '').trim() || null,
      }),
    });
    closeFinanceModal();
    await loadFinanceiroData();
  } catch (error) {
    setFeedback('finance-form-feedback', error instanceof Error ? error.message : 'Erro ao salvar.', 'error');
    if (btn) btn.disabled = false;
  }
}

async function handlePayBill(billId) {
  try {
    setFeedback('finance-modal-feedback', 'Registrando pagamento...', 'neutral');
    await apiFetch(`/api/financial/bills/${billId}/pay`, {
      method: 'PATCH',
      body: JSON.stringify({ paymentMethod: 'pix' }),
    });
    closeFinanceModal();
    await loadFinanceiroData();
  } catch (error) {
    setFeedback('finance-modal-feedback', error instanceof Error ? error.message : 'Erro ao pagar.', 'error');
  }
}

async function handleOpenCash(event) {
  event.preventDefault();
  const form     = document.getElementById('cash-open-form');
  const formData = new FormData(form);
  const btn      = form.querySelector('button[type="submit"]');
  try {
    if (btn) btn.disabled = true;
    setFeedback('cash-open-feedback', 'Abrindo caixa...', 'neutral');
    await apiFetch('/api/financial/cash/open', {
      method: 'POST',
      body: JSON.stringify({
        opening_balance: Number(formData.get('opening_balance') || 0),
        notes:           String(formData.get('notes') || '').trim() || null,
      }),
    });
    closeFinanceModal();
    await loadCashForDate(financeiroState.cashDate);
  } catch (error) {
    setFeedback('cash-open-feedback', error instanceof Error ? error.message : 'Erro ao abrir caixa.', 'error');
    if (btn) btn.disabled = false;
  }
}

async function handleCloseCash(event) {
  event.preventDefault();
  const form     = document.getElementById('cash-close-form');
  const formData = new FormData(form);
  const btn      = form.querySelector('button[type="submit"]');
  const reg      = financeiroState.cash.register;
  if (!reg) return;
  try {
    if (btn) btn.disabled = true;
    setFeedback('cash-close-feedback', 'Fechando caixa...', 'neutral');
    await apiFetch(`/api/financial/cash/${reg.id}/close`, {
      method: 'POST',
      body: JSON.stringify({
        closing_balance: Number(formData.get('closing_balance') || 0),
        notes:           String(formData.get('notes') || '').trim() || null,
      }),
    });
    closeFinanceModal();
    await loadCashForDate(financeiroState.cashDate);
  } catch (error) {
    setFeedback('cash-close-feedback', error instanceof Error ? error.message : 'Erro ao fechar caixa.', 'error');
    if (btn) btn.disabled = false;
  }
}

async function handleAddMovement(event) {
  event.preventDefault();
  const form     = document.getElementById('cash-movement-form');
  const formData = new FormData(form);
  const btn      = form.querySelector('button[type="submit"]');
  const type     = form.dataset.type;
  const reg      = financeiroState.cash.register;
  const desc     = String(formData.get('description') || '').trim();
  const amount   = Number(formData.get('amount') || 0);

  if (!desc)             { setFeedback('cash-movement-feedback', 'Informe a descrição.', 'error');     return; }
  if (!amount || amount <= 0) { setFeedback('cash-movement-feedback', 'Informe um valor válido.', 'error'); return; }
  if (!reg)              { setFeedback('cash-movement-feedback', 'Nenhum caixa aberto.', 'error');     return; }

  try {
    if (btn) btn.disabled = true;
    setFeedback('cash-movement-feedback', 'Registrando...', 'neutral');
    await apiFetch(`/api/financial/cash/${reg.id}/movement`, {
      method: 'POST',
      body: JSON.stringify({
        type,
        description:    desc,
        amount,
        payment_method: String(formData.get('payment_method') || '').trim() || null,
        notes:          String(formData.get('notes') || '').trim() || null,
      }),
    });
    closeFinanceModal();
    await loadCashForDate(financeiroState.cashDate);
  } catch (error) {
    setFeedback('cash-movement-feedback', error instanceof Error ? error.message : 'Erro ao registrar.', 'error');
    if (btn) btn.disabled = false;
  }
}

// ══════════════════════════════════════════════════════════════════════════════
// EVENTS
// ══════════════════════════════════════════════════════════════════════════════

function bindModalEvents() {
  document.getElementById('finance-modal-close')?.addEventListener('click', closeFinanceModal);
  document.getElementById('finance-form-cancel')?.addEventListener('click', closeFinanceModal);

  document.getElementById('finance-pay-bill-btn')?.addEventListener('click', (e) => {
    handlePayBill(e.currentTarget.dataset.billId);
  });

  document.getElementById('finance-bill-form')?.addEventListener('submit', handleCreateBill);
  document.getElementById('finance-transaction-form')?.addEventListener('submit', handleCreateTransaction);
  document.getElementById('cash-open-form')?.addEventListener('submit', handleOpenCash);
  document.getElementById('cash-close-form')?.addEventListener('submit', handleCloseCash);
  document.getElementById('cash-movement-form')?.addEventListener('submit', handleAddMovement);
  document.getElementById('team-adjustment-form')?.addEventListener('submit', handleCreateTeamAdjustment);
  document.getElementById('team-payment-form')?.addEventListener('submit', handleCreateTeamPayment);

  // Calcula diferença em tempo real no modal de fechar caixa
  const closingInput = document.querySelector('#cash-close-form [name="closing_balance"]');
  const diffDisplay  = document.getElementById('cash-close-diff');
  if (closingInput && diffDisplay) {
    closingInput.addEventListener('input', () => {
      const exp  = parseFloat(closingInput.dataset.expected || '0');
      const val  = parseFloat(closingInput.value || '0');
      const diff = val - exp;
      diffDisplay.textContent = fmt(diff);
      diffDisplay.style.color = Math.abs(diff) < 0.01 ? '#00e676' : diff > 0 ? '#4fc3f7' : '#ff1744';
    });
  }
}

function bindRowEvents() {
  document.querySelectorAll('.finance-row-button[data-entry-id]').forEach((btn) => {
    btn.addEventListener('click', () => {
      if (btn.dataset.entrySection === 'bills')
        openModal('viewBill', 'bills', btn.dataset.entryId);
    });
  });
}

function bindTabEvents() {
  document.querySelectorAll('[data-fin-tab]').forEach((btn) => {
    btn.addEventListener('click', () => {
      financeiroState.activeTab = btn.dataset.finTab;
      if (financeiroState.activeTab === 'comissoes') {
        loadTeamCommissionsData({ rerender: true });
        return;
      }
      rerenderFinanceiro();
    });
  });
}

function bindCashEvents() {
  document.getElementById('cash-open-btn')?. addEventListener('click', () => openModal('openCash'));
  document.getElementById('cash-close-btn')?.addEventListener('click', () => openModal('closeCash'));
  document.getElementById('cash-withdrawal-btn')?.addEventListener('click', () => openModal('withdrawal'));
  document.getElementById('cash-reinforcement-btn')?.addEventListener('click', () => openModal('reinforcement'));
  document.getElementById('cash-income-btn')?.addEventListener('click', () => openModal('income'));
  document.getElementById('cash-expense-btn')?.addEventListener('click', () => openModal('expense'));

  document.getElementById('cash-load-date-btn')?.addEventListener('click', () => {
    const val = document.getElementById('cash-date-picker')?.value;
    if (val) loadCashForDate(val);
  });

  document.getElementById('cash-date-picker')?.addEventListener('change', (e) => {
    if (e.target.value) loadCashForDate(e.target.value);
  });
}


function bindTeamCommissionEvents() {
  document.getElementById('team-commissions-load-month')?.addEventListener('click', handleTeamPeriodChange);
  document.getElementById('team-commissions-month')?.addEventListener('change', handleTeamPeriodChange);

  document.querySelectorAll('[data-team-jump-period]').forEach((btn) => {
    btn.addEventListener('click', handleTeamJumpToSuggestedPeriod);
  });

  document.querySelectorAll('[data-team-action]').forEach((btn) => {
    btn.addEventListener('click', () => {
      const action = btn.dataset.teamAction;
      const barberId = btn.dataset.barberId;
      if (!barberId) return;

      if (action === 'details') openModal('viewTeamCommission', 'teamCommissions', barberId);
      if (action === 'bonus')   openModal('teamBonus', 'teamCommissions', barberId);
      if (action === 'vale')    openModal('teamVale', 'teamCommissions', barberId);
      if (action === 'pay')     openModal('teamPayment', 'teamCommissions', barberId);
    });
  });
}

function bindStaticEvents() {
  document.getElementById('finance-new-bill-btn')?.addEventListener('click',        () => openModal('createBill'));
  document.getElementById('finance-new-transaction-btn')?.addEventListener('click', () => openModal('createTransaction'));
  document.getElementById('finance-details-modal')?.addEventListener('click', (e) => {
    if (e.target?.id === 'finance-details-modal') closeFinanceModal();
  });
  bindTabEvents();
}

// ══════════════════════════════════════════════════════════════════════════════
// RENDER PRINCIPAL
// ══════════════════════════════════════════════════════════════════════════════

function renderTabBar() {
  const cockpit = getBillCockpit();
  const teamPending = Number(financeiroState.teamCommissions.summary?.totals?.pendingCents || 0);
  const cashStatus = financeiroState.cash?.register?.status || 'none';

  const tabs = [
    { id: 'caixa', label: 'Caixa', icon: '▣', badge: cashStatus === 'open' ? 'Aberto' : cashStatus === 'closed' ? 'Fechado' : 'Hoje' },
    { id: 'comissoes', label: 'Comissões do Time', icon: '✦', badge: teamPending > 0 ? fmtCents(teamPending) : '' },
    { id: 'contas', label: 'Contas a Pagar', icon: '⌁', badge: cockpit.open.length ? String(cockpit.open.length) : '' },
    { id: 'transacoes', label: 'Transações', icon: '↕', badge: financeiroState.transactions.length ? String(financeiroState.transactions.length) : '' },
  ];

  return `
    <nav class="finance-v2-tabs" aria-label="Navegação do financeiro">
      ${tabs.map(t => `
        <button type="button" data-fin-tab="${t.id}" class="${financeiroState.activeTab === t.id ? 'is-active' : ''}">
          <span>${t.icon}</span>
          <b>${esc(t.label)}</b>
          ${t.badge ? `<small>${esc(t.badge)}</small>` : ''}
        </button>
      `).join('')}
    </nav>`;
}



function rerenderFinanceiro() {
  const root = document.getElementById('finance-root');
  if (!root) return;

  if (financeiroState.isLoading) {
    root.innerHTML = `
      <div style="display:flex;align-items:center;justify-content:center;min-height:200px;">
        <div style="text-align:center;">
          <div style="font-size:32px;margin-bottom:8px;animation:spin 1s linear infinite;">⟳</div>
          <div style="color:#5a6888;font-size:12px;">Carregando financeiro...</div>
        </div>
      </div>`;
    return;
  }

  const tab = financeiroState.activeTab;

  let content = '';

  if (tab === 'caixa') {
    content = `
      <div id="finance-cash-container">
        ${renderCashHero()}
      </div>`;
  }
  else if (tab === 'comissoes') {
    content = renderTeamCommissionsSection();
  }
  else if (tab === 'contas') {
    content = `
      ${renderMetricsBar()}
      <div class="card">
        <div class="card-header">
          <div class="card-title">💸 Contas a Pagar</div>
          <button type="button" class="btn-primary-gradient" id="finance-new-bill-btn">+ Adicionar</button>
        </div>
        <div id="finance-payables-list">${renderBillsSection()}</div>
      </div>`;
  }
  else if (tab === 'transacoes') {
    content = `
      ${renderMetricsBar()}
      <div class="card">
        <div class="card-header">
          <div class="card-title">📊 Transações do Mês</div>
          <button type="button" class="btn-primary-gradient" id="finance-new-transaction-btn">+ Registrar</button>
        </div>
        <div id="finance-transactions-list">${renderTransactionsSection()}</div>
      </div>`;
  }

  root.innerHTML = `
    ${renderTabBar()}
    ${content}
  `;

  bindStaticEvents();
  bindRowEvents();
  if (tab === 'caixa') bindCashEvents();
  if (tab === 'comissoes') bindTeamCommissionEvents();
}

// ══════════════════════════════════════════════════════════════════════════════
// EXPORT
// ══════════════════════════════════════════════════════════════════════════════

export function renderFinanceiro() {
  return /* html */ `
<section class="page-shell page--financeiro">

  <style>
    /* ── Caixa action buttons ──────────────────────────────────────────────── */
    .cash-action-btn {
      padding: 9px 16px;
      border-radius: 10px;
      border: 1px solid transparent;
      font: inherit;
      font-size: 12px;
      font-weight: 700;
      cursor: pointer;
      transition: opacity .15s, transform .1s;
      white-space: nowrap;
    }
    .cash-action-btn:hover   { opacity: .85; transform: translateY(-1px); }
    .cash-action-btn:active  { transform: scale(.97); }
    .cash-action-btn--primary {
      background: linear-gradient(135deg,#00e676,#00b4ff);
      color: #000;
      border-color: transparent;
    }
    .cash-action-btn--warning {
      background: rgba(249,115,22,.12);
      color: #f97316;
      border-color: rgba(249,115,22,.3);
    }
    .cash-action-btn--info {
      background: rgba(79,195,247,.12);
      color: #4fc3f7;
      border-color: rgba(79,195,247,.3);
    }
    .cash-action-btn--success {
      background: rgba(0,230,118,.12);
      color: #00e676;
      border-color: rgba(0,230,118,.3);
    }
    .cash-action-btn--danger {
      background: rgba(255,23,68,.12);
      color: #ff5c74;
      border-color: rgba(255,23,68,.3);
    }
    .cash-action-btn--close {
      background: rgba(90,104,136,.15);
      color: #94a3b8;
      border-color: rgba(90,104,136,.3);
    }

    @keyframes spin { to { transform: rotate(360deg); } }

    /* ── Fin rows ─────────────────────────────────────────────────────────── */
    .finance-row-button {
      display: block; width: 100%; padding: 0;
      border: 0; background: transparent;
      text-align: inherit; cursor: pointer;
    }
    .fin-row {
      display: grid;
      grid-template-columns: auto 1fr auto;
      gap: 12px;
      align-items: center;
      padding: 12px 10px;
      border-left: 3px solid transparent;
      border-radius: 12px;
      transition: background .18s;
    }
    .finance-row-button:hover .fin-row { background: rgba(79,195,247,.04); }
    .fin-info { min-width: 0; }
    .fin-title { font-size: 13px; font-weight: 700; color: #e8f0fe; }
    .fin-date  { font-size: 10px; color: #5a6888; margin-top: 3px; }
    .finance-empty {
      padding: 20px 14px; color: #5a6888;
      font-size: 12px; text-align: center;
    }
    .finance-modal-body { display: grid; gap: 12px; }
    .finance-form       { display: grid; gap: 12px; }


    /* ── Comissões do Time premium ────────────────────────────────────────── */
    .team-commissions-hero {
      position: relative;
      overflow: hidden;
      border: 1px solid #1e2345;
      border-radius: 24px;
      padding: 24px;
      margin-bottom: 16px;
      background:
        radial-gradient(circle at 12% 20%, rgba(255, 215, 0, .11), transparent 28%),
        radial-gradient(circle at 88% 12%, rgba(79, 195, 247, .14), transparent 34%),
        linear-gradient(135deg, #08091a 0%, #0d1030 54%, #091827 100%);
      box-shadow: 0 24px 90px rgba(0, 0, 0, .24);
    }
    .team-commissions-hero__glow {
      position: absolute;
      inset: auto -120px -160px auto;
      width: 300px;
      height: 300px;
      border-radius: 999px;
      background: radial-gradient(circle, rgba(255, 215, 0, .18), transparent 70%);
      pointer-events: none;
    }
    .team-commissions-hero__top,
    .team-hero-grid,
    .team-commission-layout,
    .team-card-head,
    .team-list-head,
    .team-barber-card__header,
    .team-barber-actions,
    .team-source-row,
    .team-modal-source {
      display: flex;
    }
    .team-commissions-hero__top {
      justify-content: space-between;
      align-items: flex-start;
      gap: 16px;
      position: relative;
      z-index: 1;
      flex-wrap: wrap;
      margin-bottom: 20px;
    }
    .team-kicker {
      font-size: 10px;
      font-weight: 900;
      letter-spacing: .16em;
      text-transform: uppercase;
      color: #5a6888;
      margin-bottom: 6px;
    }
    .team-title {
      margin: 0;
      color: #e8f0fe;
      font-size: clamp(22px, 3vw, 34px);
      line-height: 1;
      letter-spacing: -.04em;
    }
    .team-subtitle {
      max-width: 680px;
      margin: 10px 0 0;
      color: #8ea1c7;
      font-size: 13px;
      line-height: 1.55;
    }
    .team-period-card {
      display: grid;
      gap: 7px;
      min-width: 230px;
      padding: 12px;
      border: 1px solid rgba(79,195,247,.20);
      border-radius: 16px;
      background: rgba(7, 9, 25, .72);
      backdrop-filter: blur(10px);
    }
    .team-period-card label {
      color: #5a6888;
      font-size: 9px;
      font-weight: 900;
      text-transform: uppercase;
      letter-spacing: .12em;
    }
    .team-period-card input,
    .team-period-card button {
      min-height: 34px;
      border-radius: 10px;
      border: 1px solid #1e2345;
      background: #0a0c1a;
      color: #e8f0fe;
      font: inherit;
      font-size: 12px;
      padding: 0 10px;
    }
    .team-period-card button {
      cursor: pointer;
      font-weight: 900;
      background: linear-gradient(135deg, rgba(79,195,247,.16), rgba(108,63,255,.16));
      border-color: rgba(79,195,247,.25);
    }
    .team-hero-grid {
      position: relative;
      z-index: 1;
      gap: 16px;
      align-items: stretch;
    }
    .team-hero-main {
      flex: 1.1;
      min-width: 260px;
      padding: 20px;
      border-radius: 20px;
      border: 1px solid rgba(255, 215, 0, .17);
      background: rgba(255,255,255,.035);
    }
    .team-metric-label {
      color: #8ea1c7;
      font-size: 11px;
      font-weight: 800;
      text-transform: uppercase;
      letter-spacing: .1em;
      margin-bottom: 8px;
    }
    .team-metric-value {
      font-family: 'Orbitron', monospace;
      font-size: clamp(30px, 5vw, 48px);
      line-height: 1;
      font-weight: 900;
    }
    .team-metric-value.is-warning { color: #ffd700; }
    .team-metric-value.is-ok { color: #00e676; }
    .team-metric-caption {
      margin-top: 8px;
      color: #5a6888;
      font-size: 12px;
    }
    .team-payment-progress {
      margin-top: 18px;
      display: grid;
      gap: 8px;
    }
    .team-payment-progress__bar {
      height: 8px;
      border-radius: 999px;
      overflow: hidden;
      background: #1e2345;
    }
    .team-payment-progress__bar span {
      display: block;
      height: 100%;
      border-radius: inherit;
      background: linear-gradient(90deg, #00e676, #4fc3f7);
    }
    .team-payment-progress__text {
      color: #8ea1c7;
      font-size: 11px;
    }
    .team-hero-side {
      flex: .9;
      min-width: 260px;
      display: grid;
      grid-template-columns: repeat(2, minmax(0, 1fr));
      gap: 10px;
    }
    .team-mini-metric {
      padding: 14px;
      border-radius: 16px;
      border: 1px solid #1e2345;
      background: rgba(255,255,255,.03);
    }
    .team-mini-metric span,
    .team-mini-metric small {
      display: block;
      color: #5a6888;
      font-size: 10px;
      font-weight: 800;
      text-transform: uppercase;
      letter-spacing: .08em;
    }
    .team-mini-metric strong {
      display: block;
      margin: 6px 0 4px;
      font-family: 'Orbitron', monospace;
      font-size: 18px;
      line-height: 1;
    }
    .team-mini-metric small {
      text-transform: none;
      letter-spacing: 0;
      font-weight: 600;
    }
    .team-legend-strip {
      position: relative;
      z-index: 1;
      display: flex;
      flex-wrap: wrap;
      gap: 9px;
      align-items: center;
      margin-top: 16px;
      padding: 12px 14px;
      border-radius: 14px;
      border: 1px solid rgba(79,195,247,.13);
      background: rgba(10, 12, 26, .70);
      color: #8ea1c7;
      font-size: 11px;
    }
    .team-legend-strip b { color: #e8f0fe; }
    .team-legend-strip i { color: #ffd700; font-style: normal; }
    .team-commission-layout {
      align-items: flex-start;
      gap: 16px;
    }
    .team-commission-main {
      flex: 1;
      min-width: 0;
    }
    .team-commission-side {
      width: min(360px, 100%);
      display: grid;
      gap: 14px;
      flex-shrink: 0;
    }
    .team-list-head,
    .team-card-head {
      justify-content: space-between;
      align-items: flex-start;
      gap: 12px;
      margin-bottom: 12px;
    }
    .team-list-head h3,
    .team-card-head h3 {
      margin: 0;
      color: #e8f0fe;
      font-size: 17px;
    }
    .team-list-head span,
    .team-card-head small {
      color: #5a6888;
      font-size: 11px;
      font-weight: 700;
    }
    .team-barber-grid-list {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(280px, 1fr));
      gap: 12px;
    }
    .team-barber-card,
    .team-breakdown-card,
    .team-sources-card,
    .team-empty-state {
      border: 1px solid #1e2345;
      border-radius: 20px;
      background: linear-gradient(180deg, rgba(255,255,255,.035), rgba(255,255,255,.018));
      padding: 16px;
    }
    .team-barber-card {
      position: relative;
      overflow: hidden;
      transition: transform .16s ease, border-color .16s ease, background .16s ease;
    }
    .team-barber-card:hover {
      transform: translateY(-2px);
      border-color: rgba(79,195,247,.24);
      background: linear-gradient(180deg, rgba(79,195,247,.06), rgba(255,255,255,.018));
    }
    .team-barber-card__header {
      align-items: center;
      gap: 12px;
      margin-bottom: 14px;
    }
    .team-avatar {
      width: 44px;
      height: 44px;
      border-radius: 14px;
      display: grid;
      place-items: center;
      background: linear-gradient(135deg, rgba(255,215,0,.18), rgba(79,195,247,.18));
      border: 1px solid rgba(255,215,0,.26);
      color: #ffd700;
      font-weight: 900;
      font-size: 18px;
    }
    .team-barber-info { min-width: 0; flex: 1; }
    .team-barber-info h3 {
      margin: 0;
      color: #e8f0fe;
      font-size: 15px;
    }
    .team-barber-info p {
      margin: 4px 0 0;
      color: #5a6888;
      font-size: 11px;
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
    }
    .team-status-pill {
      padding: 5px 10px;
      border-radius: 999px;
      font-size: 10px;
      font-weight: 900;
      white-space: nowrap;
    }
    .team-status-pill.is-pending {
      background: rgba(255,215,0,.10);
      color: #ffd700;
      border: 1px solid rgba(255,215,0,.20);
    }
    .team-status-pill.is-partial {
      background: rgba(79,195,247,.10);
      color: #4fc3f7;
      border: 1px solid rgba(79,195,247,.20);
    }
    .team-status-pill.is-paid {
      background: rgba(0,230,118,.10);
      color: #00e676;
      border: 1px solid rgba(0,230,118,.20);
    }
    .team-barber-total {
      display: flex;
      align-items: flex-end;
      justify-content: space-between;
      gap: 10px;
      padding: 14px;
      border-radius: 16px;
      background: #0a0c1a;
      border: 1px solid #1e2345;
      margin-bottom: 12px;
    }
    .team-barber-total span {
      color: #8ea1c7;
      font-size: 11px;
      font-weight: 800;
    }
    .team-barber-total strong {
      color: #ffd700;
      font-family: 'Orbitron', monospace;
      font-size: 22px;
      line-height: 1;
    }
    .team-barber-grid {
      display: grid;
      grid-template-columns: repeat(2, minmax(0, 1fr));
      gap: 8px;
      margin-bottom: 14px;
    }
    .team-barber-grid div {
      padding: 10px;
      border-radius: 12px;
      background: rgba(255,255,255,.025);
      border: 1px solid #1a2040;
    }
    .team-barber-grid span {
      display: block;
      color: #5a6888;
      font-size: 9px;
      font-weight: 800;
      text-transform: uppercase;
      letter-spacing: .08em;
      margin-bottom: 4px;
    }
    .team-barber-grid strong {
      color: #c0cce8;
      font-family: 'Orbitron', monospace;
      font-size: 13px;
    }
    .team-barber-grid strong.danger { color: #ff5c74; }
    .team-barber-grid strong.success { color: #00e676; }
    .team-barber-actions {
      gap: 7px;
      flex-wrap: wrap;
    }
    .team-barber-actions button {
      flex: 1;
      min-width: max-content;
      border: 1px solid #1e2345;
      background: rgba(255,255,255,.03);
      color: #c0cce8;
      border-radius: 10px;
      padding: 8px 10px;
      font: inherit;
      font-size: 11px;
      font-weight: 800;
      cursor: pointer;
    }
    .team-barber-actions button:hover {
      border-color: rgba(79,195,247,.25);
      color: #e8f0fe;
      background: rgba(79,195,247,.06);
    }
    .team-barber-actions button:disabled {
      opacity: .45;
      cursor: not-allowed;
    }
    .team-breakdown-list {
      display: grid;
      gap: 10px;
    }
    .team-breakdown-row {
      display: flex;
      gap: 10px;
      align-items: center;
    }
    .team-breakdown-icon,
    .team-source-icon {
      width: 34px;
      height: 34px;
      border-radius: 11px;
      display: grid;
      place-items: center;
      border: 1px solid transparent;
      flex-shrink: 0;
    }
    .team-breakdown-body { flex: 1; min-width: 0; }
    .team-breakdown-label {
      display: flex;
      justify-content: space-between;
      gap: 8px;
      font-size: 11px;
      color: #c0cce8;
      margin-bottom: 5px;
    }
    .team-breakdown-label strong {
      font-family: 'Orbitron', monospace;
      color: #e8f0fe;
      white-space: nowrap;
    }
    .team-breakdown-bar {
      height: 7px;
      border-radius: 999px;
      background: #1e2345;
      overflow: hidden;
    }
    .team-breakdown-bar span {
      display: block;
      height: 100%;
      border-radius: inherit;
    }
    .team-source-list,
    .team-modal-source-list {
      display: grid;
      gap: 8px;
    }
    .team-source-row {
      align-items: center;
      gap: 10px;
      padding: 10px;
      border: 1px solid #1a2040;
      border-radius: 14px;
      background: rgba(255,255,255,.02);
    }
    .team-source-main {
      flex: 1;
      min-width: 0;
    }
    .team-source-main strong,
    .team-modal-source strong {
      display: block;
      color: #e8f0fe;
      font-size: 12px;
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
    }
    .team-source-main span,
    .team-modal-source span {
      display: block;
      color: #5a6888;
      font-size: 10px;
      margin-top: 3px;
    }
    .team-source-value,
    .team-modal-source b {
      font-family: 'Orbitron', monospace;
      font-size: 12px;
      color: #00e676;
      white-space: nowrap;
    }
    .team-source-value.danger,
    .team-modal-source b.danger {
      color: #ff5c74;
    }
    .team-empty-state {
      text-align: center;
      padding: 34px 18px;
      color: #5a6888;
    }
    .team-empty-state div {
      font-size: 34px;
      margin-bottom: 10px;
    }
    .team-empty-state h3 {
      margin: 0 0 6px;
      color: #e8f0fe;
    }
    .team-empty-state p {
      margin: 0 auto;
      max-width: 420px;
      font-size: 12px;
      line-height: 1.55;
    }
    .team-empty-line {
      padding: 16px;
      border: 1px dashed #1e2345;
      border-radius: 14px;
      color: #5a6888;
      font-size: 12px;
      text-align: center;
    }
    .team-loading {
      min-height: 220px;
      display: grid;
      place-items: center;
      color: #5a6888;
      font-size: 12px;
    }
    .team-loading div {
      font-size: 34px;
      animation: spin 1s linear infinite;
      margin-bottom: 8px;
    }
    .team-modal-summary {
      display: grid;
      grid-template-columns: repeat(3, 1fr);
      gap: 8px;
    }
    .team-modal-summary div {
      padding: 12px;
      border: 1px solid #1e2345;
      border-radius: 14px;
      background: #0a0c1a;
    }
    .team-modal-summary span {
      display: block;
      color: #5a6888;
      font-size: 9px;
      font-weight: 800;
      text-transform: uppercase;
      letter-spacing: .08em;
      margin-bottom: 5px;
    }
    .team-modal-summary strong {
      color: #e8f0fe;
      font-family: 'Orbitron', monospace;
      font-size: 14px;
    }
    .team-modal-source {
      align-items: center;
      gap: 10px;
      padding: 12px;
      border: 1px solid #1a2040;
      border-radius: 14px;
      background: rgba(255,255,255,.025);
    }
    .team-modal-source > div:nth-child(2) {
      flex: 1;
      min-width: 0;
    }
    .team-payment-warning {
      padding: 10px 12px;
      border-radius: 12px;
      border: 1px solid rgba(255,215,0,.20);
      background: rgba(255,215,0,.08);
      color: #ffd700;
      font-size: 11px;
      line-height: 1.45;
    }

    @media (max-width: 900px) {
      .team-commission-layout,
      .team-hero-grid {
        flex-direction: column;
      }
      .team-commission-side {
        width: 100%;
      }
      .team-period-card {
        width: 100%;
      }
    }

    @media (max-width: 600px) {
      .cash-hero { padding: 16px !important; }
      .team-commissions-hero {
        padding: 16px;
        border-radius: 18px;
      }
      .team-hero-side,
      .team-barber-grid,
      .team-modal-summary {
        grid-template-columns: 1fr;
      }
      .team-title {
        font-size: 24px;
      }
      .team-barber-actions button {
        flex-basis: 48%;
      }
    }
  </style>

  <div id="finance-root">
    <div style="display:flex;align-items:center;justify-content:center;min-height:200px;">
      <div style="color:#5a6888;font-size:12px;">Iniciando financeiro...</div>
    </div>
  </div>

  <!-- Modal global -->
  <div id="finance-details-modal" class="modal-overlay" style="display:none;">
    <div class="modal" style="width:min(92vw,560px);max-height:90vh;overflow-y:auto;">
      <div id="finance-details-content"></div>
    </div>
  </div>
</section>
  `;
}

export function initFinanceiroPage() {
  loadFinanceiroData();
}
