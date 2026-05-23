import {
  hasApiConfig,
  hasAuthToken,
  getPlans,
  createPlan,
  updatePlan,
  getSubscriptions,
  createSubscription,
  getClients,
  activateSubscription,
  pauseSubscription,
  reactivateSubscription,
  cancelSubscription,
  markInvoicePaid,
  markInvoiceFailed,
  cancelInvoice,
  getClubCommissionPeriods,
  getClubCommissionEntries,
  getClubCommissionConsumptions,
  markClubCommissionPeriodPaid,
  getClubCommissionSettings,
  updateClubCommissionSettings,
  getClubCommissionServicePoints,
  updateClubCommissionServicePoint,
  getClubCommissionPlanRules,
  updateClubCommissionPlanRule,
} from '../services/api.js';

const PLAN_NAME_MAX_LENGTH = 100;
const PLAN_DESCRIPTION_MAX_LENGTH = 500;
const PLANOS_ACTIVE_TAB_STORAGE_KEY = 'barberflow.planos.activeTab';
const PLANOS_TABS = ['planos', 'assinaturas', 'comissoes', 'regras'];

function getInitialActiveTab() {
  try {
    const stored = localStorage.getItem(PLANOS_ACTIVE_TAB_STORAGE_KEY);
    return PLANOS_TABS.includes(stored) ? stored : 'planos';
  } catch {
    return 'planos';
  }
}

function persistActiveTab(tab) {
  try {
    localStorage.setItem(PLANOS_ACTIVE_TAB_STORAGE_KEY, tab);
  } catch {
    // noop
  }
}

const planosState = {
  plans: [],
  subscriptions: [],
  clients: [],
  clubPeriods: [],
  clubEntries: [],
  clubConsumptions: [],
  clubSelectedPeriodId: null,
  clubIsLoading: false,
  clubError: '',
  clubSettings: null,
  clubServicePoints: [],
  clubPlanRules: [],
  rulesIsLoading: false,
  rulesError: '',
  rulesFeedback: '',
  isLoaded: false,
  isLoading: false,
  modalMode: 'closed',
  activeTab: getInitialActiveTab(),
  activePlanId: null,
  activeSubscriptionId: null,
};

function escapeHtml(value) {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}


function escapeSelector(value) {
  if (window.CSS?.escape) return CSS.escape(String(value));
  return String(value).replace(/["\\]/g, '\\$&');
}


function formatCurrencyFromCents(cents) {
  return new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL',
  }).format((Number(cents || 0)) / 100);
}

function formatCompactCurrencyFromCents(cents) {
  const value = Number(cents || 0) / 100;
  if (value >= 1000) return `R$${value.toFixed(1)}k`;
  return formatCurrencyFromCents(cents);
}

function formatCurrencyFromReais(value) {
  return new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL',
  }).format(Number(value || 0));
}

function formatNumber(value, fractionDigits = 2) {
  return new Intl.NumberFormat('pt-BR', {
    minimumFractionDigits: fractionDigits,
    maximumFractionDigits: fractionDigits,
  }).format(Number(value || 0));
}

function formatPercent(value) {
  return `${formatNumber(value, 2)}%`;
}

function formatPeriodLabel(period) {
  if (!period?.period_start || !period?.period_end) return 'Período não definido';
  return `${formatDateDisplay(period.period_start)} a ${formatDateDisplay(period.period_end)}`;
}

function getClubPeriodStatusMeta(status) {
  const map = {
    draft: { label: 'Prévia', className: 'planos-badge--info', tone: 'info' },
    closed: { label: 'Fechado', className: 'planos-badge--warning', tone: 'warning' },
    paid: { label: 'Pago', className: 'planos-badge--success', tone: 'success' },
    canceled: { label: 'Cancelado', className: 'planos-badge--muted', tone: 'muted' },
  };

  return map[status] || map.draft;
}

function getSelectedClubPeriod() {
  return planosState.clubPeriods.find((period) => period.id === planosState.clubSelectedPeriodId)
    || planosState.clubPeriods[0]
    || null;
}

function buildProgressBar(value, max, className = '') {
  const safeValue = Number(value || 0);
  const safeMax = Math.max(Number(max || 0), safeValue, 1);
  const pct = Math.max(0, Math.min(100, Math.round((safeValue / safeMax) * 100)));

  return `
    <div class="planos-progress ${escapeHtml(className)}">
      <span style="width:${pct}%"></span>
    </div>
  `;
}

function formatDateDisplay(value) {
  if (!value) return '—';

  const raw = String(value).trim();

  // Datas vindas do Postgres como DATE chegam no formato YYYY-MM-DD.
  // Usar new Date('YYYY-MM-DD') desloca para UTC e, no Brasil, mostra o dia anterior.
  // Por isso montamos a data local manualmente nesses casos.
  if (/^\d{4}-\d{2}-\d{2}$/.test(raw)) {
    const [year, month, day] = raw.split('-').map(Number);
    const localDate = new Date(year, month - 1, day);

    if (!Number.isNaN(localDate.getTime())) {
      return localDate.toLocaleDateString('pt-BR');
    }
  }

  const date = new Date(raw);
  if (Number.isNaN(date.getTime())) return raw;

  return date.toLocaleDateString('pt-BR');
}

function formatBillingInterval(interval, count) {
  const safeCount = Number(count || 1);

  if (interval === 'year') {
    return safeCount > 1 ? `A cada ${safeCount} anos` : 'Anual';
  }

  return safeCount > 1 ? `A cada ${safeCount} meses` : 'Mensal';
}

function getLatestCycle(subscription) {
  const cycles = Array.isArray(subscription?.subscription_cycles)
    ? [...subscription.subscription_cycles]
    : [];

  if (!cycles.length) return null;

  cycles.sort((a, b) => {
    const aCycle = Number(a?.cycle_number || 0);
    const bCycle = Number(b?.cycle_number || 0);
    return bCycle - aCycle;
  });

  return cycles[0] || null;
}

function getLatestInvoice(subscription) {
  const invoices = Array.isArray(subscription?.subscription_invoices)
    ? [...subscription.subscription_invoices]
    : [];

  if (!invoices.length) return null;

  invoices.sort((a, b) => {
    const aDate = new Date(a?.created_at || a?.due_at || 0).getTime();
    const bDate = new Date(b?.created_at || b?.due_at || 0).getTime();
    return bDate - aDate;
  });

  return invoices[0] || null;
}

function sanitizeMoneyInput(rawValue) {
  const allowedCharsOnly = String(rawValue ?? '').replace(/[^\d,]/g, '');
  const firstCommaIndex = allowedCharsOnly.indexOf(',');

  if (firstCommaIndex === -1) {
    return allowedCharsOnly;
  }

  const integerPart = allowedCharsOnly.slice(0, firstCommaIndex);
  const decimalPart = allowedCharsOnly
    .slice(firstCommaIndex + 1)
    .replace(/,/g, '')
    .slice(0, 2);

  return `${integerPart},${decimalPart}`;
}

function parseMoneyInput(rawValue) {
  const sanitized = sanitizeMoneyInput(rawValue);

  if (!sanitized) return null;

  const normalized = sanitized.replace(',', '.');
  const amount = Number(normalized);

  if (!Number.isFinite(amount) || amount < 0) return null;

  return {
    amount: Number(amount.toFixed(2)),
    formatted: amount.toFixed(2).replace('.', ','),
  };
}

function formatMoneyInputValue(value) {
  const amount = Number(value || 0);
  if (!Number.isFinite(amount)) return '0,00';
  return amount.toFixed(2).replace('.', ',');
}

function isNonNegativeInteger(value) {
  return Number.isInteger(Number(value)) && Number(value) >= 0;
}

function updateCounter(inputId, counterId, maxLength) {
  const input = document.getElementById(inputId);
  const counter = document.getElementById(counterId);
  if (!input || !counter) return;

  if (input.value.length > maxLength) {
    input.value = input.value.slice(0, maxLength);
  }

  counter.textContent = `${input.value.length} / ${maxLength}`;
}

function bindCounter(inputId, counterId, maxLength) {
  const input = document.getElementById(inputId);
  if (!input) return;

  const sync = () => updateCounter(inputId, counterId, maxLength);
  input.addEventListener('input', sync);
  sync();
}

function initPlanFormEnhancements() {
  bindCounter('planos-plan-name', 'planos-plan-name-counter', PLAN_NAME_MAX_LENGTH);
  bindCounter('planos-plan-description', 'planos-plan-description-counter', PLAN_DESCRIPTION_MAX_LENGTH);

  const priceInput = document.getElementById('planos-price');
  if (priceInput) {
    priceInput.addEventListener('input', () => {
      priceInput.value = sanitizeMoneyInput(priceInput.value);
    });

    priceInput.addEventListener('blur', () => {
      const parsed = parseMoneyInput(priceInput.value);
      if (parsed) {
        priceInput.value = parsed.formatted;
      }
    });
  }
}

function mapPlanFromApi(plan) {
  const numericPrice =
    plan.price != null && plan.price !== ''
      ? Number(plan.price)
      : null;

  const priceCents =
    numericPrice != null && Number.isFinite(numericPrice)
      ? Math.round(numericPrice * 100)
      : Number(plan.price_cents || 0);

  return {
    id: plan.id,
    name: plan.name || 'Plano sem nome',
    description: plan.description || 'Sem descrição.',
    price: numericPrice != null && Number.isFinite(numericPrice) ? numericPrice : priceCents / 100,
    priceCents,
    billingInterval: formatBillingInterval(plan.billing_interval || 'month', plan.billing_interval_count || 1),
    includedHaircuts: Number(plan.included_haircuts || 0),
    includedBeards: Number(plan.included_beards || 0),
    signupFeeCents: Number(plan.signup_fee_cents || 0),
    graceDays: Number(plan.grace_days || 0),
    planType: plan.plan_type || 'fixed_quantity',
    creditMode: plan.credit_mode || 'service_quantity',
    totalCredits: Number(plan.total_credits || 0),
    scheduleRestrictionEnabled: Boolean(plan.schedule_restriction_enabled),
    allowedWeekdays: normalizeAllowedWeekdays(plan.allowed_weekdays),
    allowedTimeStart: plan.allowed_time_start || '',
    allowedTimeEnd: plan.allowed_time_end || '',
    allowRollover: Boolean(plan.allow_rollover),
    rolloverDays: Number(plan.rollover_days || 0),
    overusePolicy: plan.overuse_policy || 'block',
    partialComboPolicy: plan.partial_combo_policy || 'block_partial',
    planRules: plan.plan_rules || {},
    isActive: Boolean(plan.is_active),
    subscribersCount: 0,
    raw: plan,
  };
}

function mapSubscriptionFromApi(subscription) {
  const latestCycle = getLatestCycle(subscription);
  const latestInvoice = getLatestInvoice(subscription);

  return {
    id: subscription.id,
    clientId: subscription.client_id || subscription.clients?.id || '',
    clientName: subscription.clients?.name || 'Cliente',
    planId: subscription.plan_id || subscription.plans?.id || '',
    planName: subscription.plans?.name || 'Plano',
    status: subscription.status || 'active',
    nextBillingAt: formatDateDisplay(subscription.next_billing_at || subscription.current_period_end),
    paymentMethod: subscription.payment_method_label || latestInvoice?.payment_method || '—',
    remainingHaircuts: Number(latestCycle?.remaining_haircuts || 0),
    remainingBeards: Number(latestCycle?.remaining_beards || 0),
    lastInvoiceStatus: latestInvoice?.status || 'pending',
    raw: subscription,
  };
}

function applySubscriberCounts(plans, subscriptions) {
  return plans.map((plan) => ({
    ...plan,
    subscribersCount: subscriptions.filter((subscription) => subscription.planId === plan.id).length,
  }));
}

function getPlanById(planId) {
  return planosState.plans.find((item) => item.id === planId) || null;
}

function getSubscriptionById(subscriptionId) {
  return planosState.subscriptions.find((item) => item.id === subscriptionId) || null;
}

function getSubscriptionStatusMeta(status) {
  const map = {
    active: {
      label: 'Ativa',
      color: '#00e676',
      bg: 'rgba(0,230,118,.1)',
      border: 'rgba(0,230,118,.18)',
    },
    past_due: {
      label: 'Inadimplente',
      color: '#ff1744',
      bg: 'rgba(255,23,68,.1)',
      border: 'rgba(255,23,68,.18)',
    },
    paused: {
      label: 'Pausada',
      color: '#f97316',
      bg: 'rgba(249,115,22,.1)',
      border: 'rgba(249,115,22,.18)',
    },
    canceled: {
      label: 'Cancelada',
      color: '#5a6888',
      bg: 'rgba(90,104,136,.12)',
      border: 'rgba(90,104,136,.18)',
    },
    pending_activation: {
      label: 'Pendente',
      color: '#4fc3f7',
      bg: 'rgba(79,195,247,.1)',
      border: 'rgba(79,195,247,.18)',
    },
    trialing: {
      label: 'Trial',
      color: '#9c6fff',
      bg: 'rgba(156,111,255,.1)',
      border: 'rgba(156,111,255,.18)',
    },
  };

  return map[status] || map.active;
}

function getInvoiceStatusMeta(status) {
  const map = {
    paid: { label: 'Pago', color: '#00e676' },
    failed: { label: 'Falhou', color: '#ff1744' },
    pending: { label: 'Pendente', color: '#f97316' },
    canceled: { label: 'Cancelado', color: '#5a6888' },
    refunded: { label: 'Estornado', color: '#9c6fff' },
    expired: { label: 'Expirado', color: '#f97316' },
  };

  return map[status] || map.pending;
}


const PLAN_TYPE_META = {
  fixed_quantity: {
    label: 'Quantidade fixa',
    shortLabel: 'Quantidade fixa',
    icon: '▦',
    hint: 'Ex.: 4 cortes por mês. Acabou o saldo, bloqueia ou cobra avulso.',
    creditMode: 'service_quantity',
    summary: 'Cliente usa a quantidade contratada no ciclo. Ao acabar o saldo, o sistema protege a barbearia.'
  },
  closed_combo: {
    label: 'Combo fechado',
    shortLabel: 'Combo',
    icon: '◈',
    hint: 'Ex.: corte + barba juntos. Evita consumo parcial sem regra clara.',
    creditMode: 'combo_unit',
    summary: 'O cliente consome o pacote como uma unidade combinada, ideal para combos completos.'
  },
  flexible_credits: {
    label: 'Flexível por créditos',
    shortLabel: 'Créditos',
    icon: '✦',
    hint: 'Ex.: créditos que podem ser usados entre corte, barba e pezinho.',
    creditMode: 'credit_balance',
    summary: 'O cliente usa créditos dentro do ciclo, com liberdade controlada para escolher serviços.'
  },
  economic: {
    label: 'Econômico por horários',
    shortLabel: 'Econômico',
    icon: '◷',
    hint: 'Ex.: plano mais barato para dias e horários de menor movimento.',
    creditMode: 'service_quantity',
    summary: 'Plano pensado para preencher horários ociosos sem sacrificar a agenda premium.'
  },
};

const WEEKDAY_OPTIONS = [
  { value: 0, label: 'Dom' },
  { value: 1, label: 'Seg' },
  { value: 2, label: 'Ter' },
  { value: 3, label: 'Qua' },
  { value: 4, label: 'Qui' },
  { value: 5, label: 'Sex' },
  { value: 6, label: 'Sáb' },
];

function getPlanTypeMeta(planType) {
  return PLAN_TYPE_META[planType] || PLAN_TYPE_META.fixed_quantity;
}

function normalizeAllowedWeekdays(value) {
  if (Array.isArray(value)) {
    const days = value.map(Number).filter((day) => Number.isInteger(day) && day >= 0 && day <= 6);
    return days.length ? [...new Set(days)].sort((a, b) => a - b) : [0, 1, 2, 3, 4, 5, 6];
  }

  if (typeof value === 'string' && value.trim()) {
    try {
      return normalizeAllowedWeekdays(JSON.parse(value));
    } catch {
      return [0, 1, 2, 3, 4, 5, 6];
    }
  }

  return [0, 1, 2, 3, 4, 5, 6];
}

function formatWeekdays(days) {
  const normalized = normalizeAllowedWeekdays(days);
  if (normalized.length === 7) return 'Todos os dias';
  return WEEKDAY_OPTIONS
    .filter((item) => normalized.includes(item.value))
    .map((item) => item.label)
    .join(', ');
}

function getOverusePolicyLabel(value) {
  const map = {
    block: 'Bloquear ao acabar o saldo',
    charge_extra: 'Permitir e cobrar como avulso',
    manual_approval: 'Exigir liberação manual do dono',
  };
  return map[value] || map.block;
}

function getPartialComboPolicyLabel(value) {
  const map = {
    block_partial: 'Bloquear uso parcial do combo',
    consume_full_combo: 'Consumir combo completo mesmo com uso parcial',
    charge_partial_extra: 'Cobrar parcial como avulso',
    manual_approval: 'Exigir liberação manual',
  };
  return map[value] || map.block_partial;
}

function renderWeekdayCheckboxes(days = []) {
  const selected = normalizeAllowedWeekdays(days);
  return WEEKDAY_OPTIONS.map((item) => `
    <label class="planos-weekday-pill ${selected.includes(item.value) ? 'is-selected' : ''}">
      <input type="checkbox" name="allowedWeekdays" value="${item.value}" ${selected.includes(item.value) ? 'checked' : ''} />
      <span>${escapeHtml(item.label)}</span>
    </label>
  `).join('');
}

function buildPlanHumanSummary(data) {
  const typeMeta = getPlanTypeMeta(data.planType);
  const serviceBits = [];
  if (Number(data.includedHaircuts || 0) > 0) serviceBits.push(`${Number(data.includedHaircuts)} corte(s)`);
  if (Number(data.includedBeards || 0) > 0) serviceBits.push(`${Number(data.includedBeards)} barba(s)`);
  if (Number(data.totalCredits || 0) > 0 && data.creditMode === 'credit_balance') serviceBits.push(`${formatNumber(data.totalCredits, 2)} crédito(s)`);

  const schedule = data.scheduleRestrictionEnabled
    ? `${formatWeekdays(data.allowedWeekdays)}${data.allowedTimeStart && data.allowedTimeEnd ? `, das ${data.allowedTimeStart} às ${data.allowedTimeEnd}` : ''}`
    : 'qualquer dia disponível na agenda';

  const rollover = data.allowRollover
    ? `saldo pode acumular por ${Number(data.rolloverDays || 0)} dia(s)`
    : 'saldo não acumula para o próximo ciclo';

  return `Plano ${typeMeta.shortLabel.toLowerCase()} com ${serviceBits.length ? serviceBits.join(' + ') : 'benefícios configuráveis'}. Pode ser usado em ${schedule}. ${rollover}. Ao acabar o saldo: ${getOverusePolicyLabel(data.overusePolicy).toLowerCase()}.`;
}

function collectPlanWizardPreviewData() {
  const form = document.getElementById('planos-form');
  if (!form) return null;

  const formData = new FormData(form);
  return {
    name: String(formData.get('name') || '').trim() || 'Novo plano',
    planType: String(formData.get('planType') || 'fixed_quantity'),
    creditMode: String(formData.get('creditMode') || getPlanTypeMeta(String(formData.get('planType') || 'fixed_quantity')).creditMode),
    includedHaircuts: Number(formData.get('includedHaircuts') || 0),
    includedBeards: Number(formData.get('includedBeards') || 0),
    totalCredits: Number(formData.get('totalCredits') || 0),
    scheduleRestrictionEnabled: String(formData.get('scheduleRestrictionEnabled') || 'false') === 'true',
    allowedWeekdays: formData.getAll('allowedWeekdays').map(Number),
    allowedTimeStart: String(formData.get('allowedTimeStart') || ''),
    allowedTimeEnd: String(formData.get('allowedTimeEnd') || ''),
    allowRollover: String(formData.get('allowRollover') || 'false') === 'true',
    rolloverDays: Number(formData.get('rolloverDays') || 0),
    overusePolicy: String(formData.get('overusePolicy') || 'block'),
    partialComboPolicy: String(formData.get('partialComboPolicy') || 'block_partial'),
  };
}

function updatePlanWizardSummary() {
  const data = collectPlanWizardPreviewData();
  if (!data) return;

  const typeMeta = getPlanTypeMeta(data.planType);
  const summaryEl = document.getElementById('planos-wizard-summary-text');
  const typeEl = document.getElementById('planos-wizard-summary-type');
  const scheduleEl = document.getElementById('planos-wizard-summary-schedule');
  const overuseEl = document.getElementById('planos-wizard-summary-overuse');

  if (summaryEl) summaryEl.textContent = buildPlanHumanSummary(data);
  if (typeEl) typeEl.textContent = typeMeta.label;
  if (scheduleEl) scheduleEl.textContent = data.scheduleRestrictionEnabled ? formatWeekdays(data.allowedWeekdays) : 'Todos os dias';
  if (overuseEl) overuseEl.textContent = getOverusePolicyLabel(data.overusePolicy);

  document.querySelectorAll('.planos-type-card').forEach((card) => {
    card.classList.toggle('is-selected', card.dataset.planTypeOption === data.planType);
  });

  document.querySelectorAll('.planos-weekday-pill').forEach((pill) => {
    const input = pill.querySelector('input');
    pill.classList.toggle('is-selected', Boolean(input?.checked));
  });
}

function getMetrics() {
  const activePlans = planosState.plans.filter((item) => item.isActive).length;
  const activeSubscriptions = planosState.subscriptions.filter((item) => item.status === 'active').length;
  const pastDue = planosState.subscriptions.filter((item) => item.status === 'past_due').length;

  const recurringRevenueCents = planosState.subscriptions
    .filter((item) => item.status === 'active')
    .reduce((sum, subscription) => {
      const plan = getPlanById(subscription.planId);
      return sum + Number(plan?.priceCents || 0);
    }, 0);

  return {
    activePlans,
    activeSubscriptions,
    recurringRevenueCents,
    pastDue,
  };
}

function renderMetrics() {
  const metrics = getMetrics();

  return `
    <div class="grid-4 planos-metrics-grid">
      <div class="metric-card">
        <div class="metric-label">Planos ativos</div>
        <div class="metric-value">${escapeHtml(metrics.activePlans)}</div>
        <div class="metric-sub color-up">Visão do dono</div>
      </div>

      <div class="metric-card">
        <div class="metric-label">Assinaturas ativas</div>
        <div class="metric-value">${escapeHtml(metrics.activeSubscriptions)}</div>
        <div class="metric-sub color-up">Recorrência mensal</div>
      </div>

      <div class="metric-card">
        <div class="metric-label">Receita recorrente</div>
        <div class="metric-value" style="color:#00e676">${escapeHtml(formatCompactCurrencyFromCents(metrics.recurringRevenueCents))}</div>
        <div class="metric-sub color-nt">Prevista no ciclo</div>
      </div>

      <div class="metric-card">
        <div class="metric-label">Inadimplentes</div>
        <div class="metric-value" style="color:#ff1744">${escapeHtml(metrics.pastDue)}</div>
        <div class="metric-sub color-dn">Exigem atenção</div>
      </div>
    </div>
  `;
}

function renderConfigHint(title, body, showAuthButton = false) {
  return `
    <div class="card">
      <div class="card-header"><div class="card-title">Planos</div></div>
      <div class="row-sub" style="padding:4px 4px 0;color:#c0cce8;font-size:11px;font-weight:600">${escapeHtml(title)}</div>
      <div class="row-sub" style="padding:8px 4px 4px;color:#5a6888;line-height:1.6">${escapeHtml(body)}</div>
      ${showAuthButton ? '<button class="dev-auth-inline-btn" type="button" data-open-auth-modal="true">Conectar API agora</button>' : ''}
    </div>
  `;
}

function renderLoadingState(title, body) {
  return `
    <div class="card">
      <div class="card-header"><div class="card-title">${escapeHtml(title)}</div></div>
      <div class="row-sub" style="padding:8px 4px;color:#5a6888;line-height:1.6">${escapeHtml(body)}</div>
    </div>
  `;
}

function renderEmptyState(title, body) {
  return `
    <div class="card">
      <div class="card-header"><div class="card-title">${escapeHtml(title)}</div></div>
      <div class="row-sub" style="padding:8px 4px;color:#5a6888;line-height:1.6">${escapeHtml(body)}</div>
    </div>
  `;
}

function renderPlanRow(plan) {
  const statusText = plan.isActive ? 'Ativo' : 'Inativo';
  const statusClass = plan.isActive ? 'planos-badge planos-badge--success' : 'planos-badge planos-badge--muted';

  return `
    <button
      type="button"
      class="planos-row-button"
      data-plan-id="${escapeHtml(plan.id)}"
      title="Ver detalhes de ${escapeHtml(plan.name)}"
    >
      <div class="planos-row">
        <div class="planos-row-main">
          <div class="planos-row-title">${escapeHtml(plan.name)}</div>
          <div class="planos-row-sub">${escapeHtml(plan.description)}</div>
          <div class="planos-row-sub">
            ${escapeHtml(`${plan.includedHaircuts} cortes · ${plan.includedBeards} barbas · ${plan.billingInterval}`)}
          </div>
        </div>

        <div class="planos-row-side">
          <div class="${statusClass}">${escapeHtml(statusText)}</div>
          <div class="planos-row-price">${escapeHtml(formatCurrencyFromCents(plan.priceCents))}</div>
        </div>
      </div>
    </button>
  `;
}

function renderSubscriptionRow(subscription) {
  const plan = getPlanById(subscription.planId);
  const statusMeta = getSubscriptionStatusMeta(subscription.status);
  const invoiceMeta = getInvoiceStatusMeta(subscription.lastInvoiceStatus);

  return `
    <button
      type="button"
      class="planos-row-button"
      data-subscription-id="${escapeHtml(subscription.id)}"
      title="Ver assinatura de ${escapeHtml(subscription.clientName)}"
    >
      <div class="planos-row">
        <div class="planos-row-main">
          <div class="planos-row-title">${escapeHtml(subscription.clientName)}</div>
          <div class="planos-row-sub">${escapeHtml(plan?.name || subscription.planName || 'Plano não encontrado')}</div>
          <div class="planos-row-sub">
            ${escapeHtml(`Próxima cobrança ${subscription.nextBillingAt} · ${subscription.paymentMethod}`)}
          </div>
        </div>

        <div class="planos-row-side">
          <div
            class="planos-badge"
            style="background:${statusMeta.bg};color:${statusMeta.color};border:1px solid ${statusMeta.border};"
          >
            ${escapeHtml(statusMeta.label)}
          </div>
          <div class="planos-row-sub" style="color:${invoiceMeta.color};font-weight:700;">
            ${escapeHtml(invoiceMeta.label)}
          </div>
        </div>
      </div>
    </button>
  `;
}

function renderPlanDetails(plan) {
  const statusClass = plan.isActive ? 'planos-badge planos-badge--success' : 'planos-badge planos-badge--muted';
  const typeMeta = getPlanTypeMeta(plan.planType);

  return `
    <div class="planos-modal-body">
      <div class="planos-plan-detail-hero">
        <div>
          <div class="planos-club-eyebrow">Plano profissional</div>
          <div class="modal-title" style="margin:0;">${escapeHtml(plan.name)}</div>
          <div class="modal-sub" style="margin-top:4px;">${escapeHtml(typeMeta.summary)}</div>
        </div>
        <div class="planos-plan-type-chip">
          <span>${escapeHtml(typeMeta.icon)}</span>
          <strong>${escapeHtml(typeMeta.label)}</strong>
        </div>
      </div>

      <div class="planos-modal-grid">
        <div class="mini-card">
          <div class="mini-lbl">Preço</div>
          <div class="mini-val" style="color:#4fc3f7">${escapeHtml(formatCurrencyFromCents(plan.priceCents))}</div>
        </div>
        <div class="mini-card">
          <div class="mini-lbl">Periodicidade</div>
          <div class="mini-val" style="font-size:15px;">${escapeHtml(plan.billingInterval)}</div>
        </div>
        <div class="mini-card">
          <div class="mini-lbl">Benefícios</div>
          <div class="mini-val" style="font-size:15px;color:#00e676">${escapeHtml(`${plan.includedHaircuts} cortes · ${plan.includedBeards} barbas`)}</div>
        </div>
        <div class="mini-card">
          <div class="mini-lbl">Créditos totais</div>
          <div class="mini-val" style="font-size:15px;color:#9c6fff">${escapeHtml(formatNumber(plan.totalCredits, 2))}</div>
        </div>
      </div>

      <div class="planos-modal-info">
        <div class="planos-modal-info-row">
          <strong>Status:</strong> <span class="${statusClass}">${escapeHtml(plan.isActive ? 'Ativo' : 'Inativo')}</span>
        </div>
        <div class="planos-modal-info-row">
          <strong>Regra de agenda:</strong> ${escapeHtml(plan.scheduleRestrictionEnabled ? `${formatWeekdays(plan.allowedWeekdays)}${plan.allowedTimeStart && plan.allowedTimeEnd ? `, das ${plan.allowedTimeStart} às ${plan.allowedTimeEnd}` : ''}` : 'Sem restrição de dias ou horários')}
        </div>
        <div class="planos-modal-info-row">
          <strong>Uso acima do saldo:</strong> ${escapeHtml(getOverusePolicyLabel(plan.overusePolicy))}
        </div>
        <div class="planos-modal-info-row">
          <strong>Acúmulo de saldo:</strong> ${escapeHtml(plan.allowRollover ? `Sim, por ${plan.rolloverDays} dia(s)` : 'Não acumula')}
        </div>
        <div class="planos-modal-info-row">
          <strong>Uso parcial de combo:</strong> ${escapeHtml(getPartialComboPolicyLabel(plan.partialComboPolicy))}
        </div>
        <div class="planos-modal-info-row">
          <strong>Resumo operacional:</strong> ${escapeHtml(buildPlanHumanSummary(plan))}
        </div>
        <div class="planos-modal-info-row">
          <strong>Descrição:</strong> ${escapeHtml(plan.description)}
        </div>
      </div>

      <div class="modal-buttons" style="margin-top:10px;">
        <button type="button" class="btn-cancel" id="planos-modal-close">Fechar</button>
        <button type="button" class="btn-save" id="planos-edit-button" data-plan-id="${escapeHtml(plan.id)}">
          Editar plano
        </button>
      </div>
    </div>
  `;
}

function renderPlanForm(mode, plan = null) {
  const isEdit = mode === 'editPlan';
  const safePlan = plan || {
    name: '',
    description: '',
    price: 0,
    priceCents: 0,
    billingInterval: 'Mensal',
    includedHaircuts: 4,
    includedBeards: 0,
    signupFeeCents: 0,
    graceDays: 0,
    planType: 'fixed_quantity',
    creditMode: 'service_quantity',
    totalCredits: 4,
    scheduleRestrictionEnabled: false,
    allowedWeekdays: [0, 1, 2, 3, 4, 5, 6],
    allowedTimeStart: '',
    allowedTimeEnd: '',
    allowRollover: false,
    rolloverDays: 0,
    overusePolicy: 'block',
    partialComboPolicy: 'block_partial',
    isActive: true,
  };

  const safePrice =
    safePlan.raw?.price != null
      ? Number(safePlan.raw.price)
      : safePlan.price != null
        ? Number(safePlan.price)
        : Number(safePlan.priceCents || 0) / 100;

  const safePlanType = safePlan.planType || 'fixed_quantity';
  const safeCreditMode = safePlan.creditMode || getPlanTypeMeta(safePlanType).creditMode;
  const safeAllowedWeekdays = normalizeAllowedWeekdays(safePlan.allowedWeekdays);
  const initialSummary = buildPlanHumanSummary({
    ...safePlan,
    planType: safePlanType,
    creditMode: safeCreditMode,
    allowedWeekdays: safeAllowedWeekdays,
  });

  return `
    <div class="planos-modal-body planos-wizard-modal">
      <div class="planos-wizard-hero">
        <div>
          <div class="planos-club-eyebrow">Construtor de plano</div>
          <div class="modal-title" style="margin:0;">${isEdit ? 'Editar plano profissional' : 'Novo plano profissional'}</div>
          <div class="modal-sub" style="margin-top:4px;">
            Monte a oferta, limite o uso e proteja a margem da barbearia antes de vender recorrência.
          </div>
        </div>
        <div class="planos-wizard-safe-badge">🛡️ Regra clara evita prejuízo</div>
      </div>

      <form id="planos-form" class="planos-form planos-wizard-form">
        <section class="planos-wizard-section">
          <div class="planos-wizard-section-head">
            <span>1</span>
            <div>
              <strong>Escolha o tipo do plano</strong>
              <small>O tipo define como o cliente consome o benefício.</small>
            </div>
          </div>

          <div class="planos-type-grid">
            ${Object.entries(PLAN_TYPE_META).map(([value, meta]) => `
              <label class="planos-type-card ${safePlanType === value ? 'is-selected' : ''}" data-plan-type-option="${escapeHtml(value)}">
                <input type="radio" name="planType" value="${escapeHtml(value)}" ${safePlanType === value ? 'checked' : ''} />
                <span>${escapeHtml(meta.icon)}</span>
                <strong>${escapeHtml(meta.label)}</strong>
                <small>${escapeHtml(meta.hint)}</small>
              </label>
            `).join('')}
          </div>
        </section>

        <section class="planos-wizard-section">
          <div class="planos-wizard-section-head">
            <span>2</span>
            <div>
              <strong>Oferta e benefícios</strong>
              <small>Defina o que o cliente compra e quanto pode consumir no ciclo.</small>
            </div>
          </div>

          <div class="planos-form-grid">
            <div>
              <div class="color-section-label">Nome</div>
              <input class="modal-input" id="planos-plan-name" name="name" type="text" value="${escapeHtml(safePlan.name)}" placeholder="Ex.: Combo 4 cortes" maxlength="${PLAN_NAME_MAX_LENGTH}" />
              <div style="display:flex;justify-content:flex-end;margin-top:6px;font-size:10px;color:#5a6888;">
                <span id="planos-plan-name-counter">0 / ${PLAN_NAME_MAX_LENGTH}</span>
              </div>
            </div>

            <div>
              <div class="color-section-label">Preço (formato: 69,90)</div>
              <input class="modal-input" id="planos-price" name="price" type="text" inputmode="decimal" value="${escapeHtml(formatMoneyInputValue(safePrice))}" placeholder="Ex.: 99,90" />
              <div style="display:flex;justify-content:space-between;gap:12px;margin-top:6px;font-size:10px;color:#5a6888;">
                <span>Valor cobrado no ciclo</span>
                <span>BRL</span>
              </div>
            </div>

            <div>
              <div class="color-section-label">Periodicidade</div>
              <select class="modal-input" name="billingInterval">
                <option value="Mensal" ${safePlan.billingInterval === 'Mensal' ? 'selected' : ''}>Mensal</option>
                <option value="Anual" ${safePlan.billingInterval === 'Anual' ? 'selected' : ''}>Anual</option>
              </select>
            </div>

            <div>
              <div class="color-section-label">Status</div>
              <select class="modal-input" name="isActive">
                <option value="true" ${safePlan.isActive ? 'selected' : ''}>Ativo</option>
                <option value="false" ${!safePlan.isActive ? 'selected' : ''}>Inativo</option>
              </select>
            </div>

            <div>
              <div class="color-section-label">Cortes incluídos</div>
              <input class="modal-input" name="includedHaircuts" type="number" min="0" step="1" value="${escapeHtml(safePlan.includedHaircuts)}" />
            </div>

            <div>
              <div class="color-section-label">Barbas incluídas</div>
              <input class="modal-input" name="includedBeards" type="number" min="0" step="1" value="${escapeHtml(safePlan.includedBeards)}" />
            </div>

            <div>
              <div class="color-section-label">Créditos totais</div>
              <input class="modal-input" name="totalCredits" type="number" min="0" step="0.01" value="${escapeHtml(safePlan.totalCredits || (Number(safePlan.includedHaircuts || 0) + Number(safePlan.includedBeards || 0)))}" />
              <div class="planos-field-help">Usado principalmente em planos flexíveis por créditos.</div>
            </div>

            <div>
              <div class="color-section-label">Modo de consumo</div>
              <select class="modal-input" name="creditMode">
                <option value="service_quantity" ${safeCreditMode === 'service_quantity' ? 'selected' : ''}>Quantidade por serviço</option>
                <option value="credit_balance" ${safeCreditMode === 'credit_balance' ? 'selected' : ''}>Saldo de créditos</option>
                <option value="combo_unit" ${safeCreditMode === 'combo_unit' ? 'selected' : ''}>Unidade de combo</option>
              </select>
            </div>
          </div>

          <div>
            <div class="color-section-label">Descrição</div>
            <textarea class="modal-input planos-textarea" id="planos-plan-description" name="description" placeholder="Explique o plano de forma simples para o dono e para o cliente." maxlength="${PLAN_DESCRIPTION_MAX_LENGTH}">${escapeHtml(safePlan.description)}</textarea>
            <div style="display:flex;justify-content:flex-end;margin-top:6px;font-size:10px;color:#5a6888;">
              <span id="planos-plan-description-counter">0 / ${PLAN_DESCRIPTION_MAX_LENGTH}</span>
            </div>
          </div>
        </section>

        <section class="planos-wizard-section">
          <div class="planos-wizard-section-head">
            <span>3</span>
            <div>
              <strong>Regras de uso</strong>
              <small>Controle agenda, sobra de saldo e consumo acima do contratado.</small>
            </div>
          </div>

          <div class="planos-form-grid">
            <div>
              <div class="color-section-label">Uso acima do saldo</div>
              <select class="modal-input" name="overusePolicy">
                <option value="block" ${safePlan.overusePolicy === 'block' ? 'selected' : ''}>Bloquear ao acabar o saldo</option>
                <option value="charge_extra" ${safePlan.overusePolicy === 'charge_extra' ? 'selected' : ''}>Permitir e cobrar como avulso</option>
                <option value="manual_approval" ${safePlan.overusePolicy === 'manual_approval' ? 'selected' : ''}>Exigir liberação manual</option>
              </select>
            </div>

            <div>
              <div class="color-section-label">Uso parcial de combo</div>
              <select class="modal-input" name="partialComboPolicy">
                <option value="block_partial" ${safePlan.partialComboPolicy === 'block_partial' ? 'selected' : ''}>Bloquear uso parcial</option>
                <option value="consume_full_combo" ${safePlan.partialComboPolicy === 'consume_full_combo' ? 'selected' : ''}>Consumir combo completo</option>
                <option value="charge_partial_extra" ${safePlan.partialComboPolicy === 'charge_partial_extra' ? 'selected' : ''}>Cobrar parcial como avulso</option>
                <option value="manual_approval" ${safePlan.partialComboPolicy === 'manual_approval' ? 'selected' : ''}>Exigir liberação manual</option>
              </select>
            </div>

            <div>
              <div class="color-section-label">Acumular saldo não usado?</div>
              <select class="modal-input" name="allowRollover">
                <option value="false" ${!safePlan.allowRollover ? 'selected' : ''}>Não, expira no fim do ciclo</option>
                <option value="true" ${safePlan.allowRollover ? 'selected' : ''}>Sim, acumular por alguns dias</option>
              </select>
            </div>

            <div>
              <div class="color-section-label">Dias para acumular</div>
              <input class="modal-input" name="rolloverDays" type="number" min="0" step="1" value="${escapeHtml(safePlan.rolloverDays)}" />
            </div>

            <div>
              <div class="color-section-label">Taxa de adesão (centavos)</div>
              <input class="modal-input" name="signupFeeCents" type="number" min="0" step="1" value="${escapeHtml(safePlan.signupFeeCents)}" />
            </div>

            <div>
              <div class="color-section-label">Carência para uso/cobrança (dias)</div>
              <input class="modal-input" name="graceDays" type="number" min="0" step="1" value="${escapeHtml(safePlan.graceDays)}" />
            </div>
          </div>

          <div class="planos-rule-switch">
            <div>
              <strong>Restringir dias e horários?</strong>
              <small>Ideal para planos econômicos que ocupam horários de menor movimento.</small>
            </div>
            <select class="modal-input" name="scheduleRestrictionEnabled">
              <option value="false" ${!safePlan.scheduleRestrictionEnabled ? 'selected' : ''}>Não</option>
              <option value="true" ${safePlan.scheduleRestrictionEnabled ? 'selected' : ''}>Sim</option>
            </select>
          </div>

          <div class="planos-schedule-box">
            <div class="planos-weekdays-grid">
              ${renderWeekdayCheckboxes(safeAllowedWeekdays)}
            </div>
            <div class="planos-form-grid">
              <div>
                <div class="color-section-label">Horário inicial</div>
                <input class="modal-input" name="allowedTimeStart" type="time" value="${escapeHtml(safePlan.allowedTimeStart)}" />
              </div>
              <div>
                <div class="color-section-label">Horário final</div>
                <input class="modal-input" name="allowedTimeEnd" type="time" value="${escapeHtml(safePlan.allowedTimeEnd)}" />
              </div>
            </div>
          </div>
        </section>

        <section class="planos-wizard-section planos-wizard-summary-box">
          <div class="planos-wizard-section-head">
            <span>4</span>
            <div>
              <strong>Resumo para o dono entender</strong>
              <small>Esta é a regra operacional que o sistema vai aplicar.</small>
            </div>
          </div>

          <div class="planos-summary-grid">
            <div><small>Tipo</small><strong id="planos-wizard-summary-type">${escapeHtml(getPlanTypeMeta(safePlanType).label)}</strong></div>
            <div><small>Agenda</small><strong id="planos-wizard-summary-schedule">${escapeHtml(safePlan.scheduleRestrictionEnabled ? formatWeekdays(safeAllowedWeekdays) : 'Todos os dias')}</strong></div>
            <div><small>Excedente</small><strong id="planos-wizard-summary-overuse">${escapeHtml(getOverusePolicyLabel(safePlan.overusePolicy))}</strong></div>
          </div>

          <div class="planos-human-summary" id="planos-wizard-summary-text">${escapeHtml(initialSummary)}</div>
        </section>

        <div id="planos-form-feedback" class="planos-form-feedback"></div>

        <div class="modal-buttons planos-wizard-actions" style="margin-top:10px;">
          <button type="button" class="btn-cancel" id="${isEdit ? 'planos-form-back' : 'planos-form-cancel'}">
            ${isEdit ? 'Voltar' : 'Cancelar'}
          </button>
          <button type="submit" class="btn-save">
            ${isEdit ? 'Salvar plano profissional' : 'Criar plano profissional'}
          </button>
        </div>
      </form>
    </div>
  `;
}

function getSubscriptionActionButtons(subscription) {
  const buttons = [];

  if (subscription.status === 'pending_activation') {
    buttons.push({ action: 'activate', label: 'Ativar assinatura' });
    buttons.push({ action: 'cancel', label: 'Cancelar assinatura' });
  }

  if (subscription.status === 'active' || subscription.status === 'trialing') {
    buttons.push({ action: 'pause', label: 'Pausar assinatura' });
    buttons.push({ action: 'cancel', label: 'Cancelar assinatura' });
  }

  if (subscription.status === 'paused') {
    buttons.push({ action: 'reactivate', label: 'Reativar assinatura' });
    buttons.push({ action: 'cancel', label: 'Cancelar assinatura' });
  }

  if (subscription.status === 'past_due') {
    buttons.push({ action: 'activate', label: 'Marcar como ativa' });
    buttons.push({ action: 'pause', label: 'Pausar assinatura' });
    buttons.push({ action: 'cancel', label: 'Cancelar assinatura' });
  }

  return buttons;
}

function getInvoiceActionButtons(invoice) {
  const buttons = [];

  if (invoice.status === 'pending') {
    buttons.push({ action: 'markPaid', label: 'Marcar paga' });
    buttons.push({ action: 'markFailed', label: 'Marcar falha' });
    buttons.push({ action: 'cancel', label: 'Cancelar' });
  }

  if (invoice.status === 'failed') {
    buttons.push({ action: 'markPaid', label: 'Marcar paga' });
    buttons.push({ action: 'cancel', label: 'Cancelar' });
  }

  return buttons;
}

function renderInvoicesList(subscription) {
  const invoices = Array.isArray(subscription?.raw?.subscription_invoices)
    ? [...subscription.raw.subscription_invoices]
    : [];

  invoices.sort((a, b) => {
    const aTime = new Date(a?.created_at || a?.due_at || 0).getTime();
    const bTime = new Date(b?.created_at || b?.due_at || 0).getTime();
    return bTime - aTime;
  });

  if (!invoices.length) {
    return `
      <div class="planos-modal-info-row">
        Nenhuma cobrança encontrada para esta assinatura.
      </div>
    `;
  }

  return `
    <div class="planos-invoice-list">
      ${invoices.map((invoice) => {
        const invoiceMeta = getInvoiceStatusMeta(invoice.status);
        const actionButtons = getInvoiceActionButtons(invoice);

        return `
          <div class="planos-invoice-row">
            <div class="planos-invoice-main">
              <div class="planos-invoice-title">
                ${escapeHtml(formatCurrencyFromCents(invoice.amount_cents || 0))}
              </div>
              <div class="planos-invoice-sub">
                Vencimento: ${escapeHtml(formatDateDisplay(invoice.due_at))}
                · Motivo: ${escapeHtml(invoice.billing_reason || '—')}
                · Gateway: ${escapeHtml(invoice.gateway_provider || '—')}
              </div>
              ${actionButtons.length ? `
                <div class="planos-invoice-actions">
                  ${actionButtons.map((button) => `
                    <button
                      type="button"
                      class="planos-action-btn planos-invoice-action"
                      data-invoice-id="${escapeHtml(invoice.id)}"
                      data-subscription-id="${escapeHtml(subscription.id)}"
                      data-action="${escapeHtml(button.action)}"
                    >
                      ${escapeHtml(button.label)}
                    </button>
                  `).join('')}
                </div>
              ` : ''}
            </div>

            <div class="planos-invoice-side">
              <div
                class="planos-badge"
                style="background:rgba(255,255,255,.04);color:${invoiceMeta.color};border:1px solid rgba(255,255,255,.08);"
              >
                ${escapeHtml(invoiceMeta.label)}
              </div>
            </div>
          </div>
        `;
      }).join('')}
    </div>
  `;
}

function renderSubscriptionDetails(subscription) {
  const plan = getPlanById(subscription.planId);
  const statusMeta = getSubscriptionStatusMeta(subscription.status);
  const invoiceMeta = getInvoiceStatusMeta(subscription.lastInvoiceStatus);
  const actionButtons = getSubscriptionActionButtons(subscription);

  return `
    <div class="planos-modal-body">
      <div>
        <div class="modal-title" style="margin:0;">${escapeHtml(subscription.clientName)}</div>
        <div class="modal-sub" style="margin-top:4px;">Detalhes da assinatura</div>
      </div>

      <div class="planos-modal-grid">
        <div class="mini-card">
          <div class="mini-lbl">Plano</div>
          <div class="mini-val" style="font-size:15px;">${escapeHtml(plan?.name || subscription.planName || '—')}</div>
        </div>
        <div class="mini-card">
          <div class="mini-lbl">Status</div>
          <div class="mini-val" style="font-size:15px;color:${statusMeta.color}">
            ${escapeHtml(statusMeta.label)}
          </div>
        </div>
        <div class="mini-card">
          <div class="mini-lbl">Próxima cobrança</div>
          <div class="mini-val" style="font-size:15px;">${escapeHtml(subscription.nextBillingAt)}</div>
        </div>
        <div class="mini-card">
          <div class="mini-lbl">Pagamento</div>
          <div class="mini-val" style="font-size:15px;">${escapeHtml(subscription.paymentMethod)}</div>
        </div>
      </div>

      <div class="planos-modal-info">
        <div class="planos-modal-info-row">
          <strong>Saldo de cortes:</strong> ${escapeHtml(String(subscription.remainingHaircuts))}
        </div>
        <div class="planos-modal-info-row">
          <strong>Saldo de barbas:</strong> ${escapeHtml(String(subscription.remainingBeards))}
        </div>
        <div class="planos-modal-info-row">
          <strong>Última cobrança:</strong>
          <span style="color:${invoiceMeta.color};font-weight:700;">${escapeHtml(invoiceMeta.label)}</span>
        </div>
      </div>

      <div>
        <div class="planos-section-title">Ações da assinatura</div>
        ${
          actionButtons.length
            ? `
              <div class="planos-actions-grid">
                ${actionButtons.map((button) => `
                  <button
                    type="button"
                    class="planos-action-btn planos-subscription-action"
                    data-subscription-id="${escapeHtml(subscription.id)}"
                    data-action="${escapeHtml(button.action)}"
                  >
                    ${escapeHtml(button.label)}
                  </button>
                `).join('')}
              </div>
            `
            : `
              <div class="planos-modal-info-row">
                Nenhuma ação disponível para o status atual.
              </div>
            `
        }
      </div>

      <div>
        <div class="planos-section-title">Cobranças</div>
        ${renderInvoicesList(subscription)}
      </div>

      <div id="planos-details-feedback" class="planos-detail-feedback"></div>

      <div class="modal-buttons" style="margin-top:10px;">
        <button type="button" class="btn-cancel" id="planos-modal-close">Fechar</button>
      </div>
    </div>
  `;
}

function renderSubscriptionForm() {
  return `
    <div class="planos-modal-body">
      <div>
        <div class="modal-title" style="margin:0;">Nova assinatura</div>
        <div class="modal-sub" style="margin-top:4px;">Preencha os dados para criar uma assinatura real no painel do dono.</div>
      </div>

      <form id="planos-subscription-form" class="planos-form">
        <div class="planos-form-grid">
          <div>
            <div class="color-section-label">Cliente</div>
            <select class="modal-input" name="clientId">
              <option value="">Selecione o cliente</option>
              ${planosState.clients.map((client) => `<option value="${escapeHtml(client.id)}">${escapeHtml(client.name || 'Cliente')}</option>`).join('')}
            </select>
          </div>

          <div>
            <div class="color-section-label">Plano</div>
            <select class="modal-input" name="planId">
              <option value="">Selecione o plano</option>
              ${planosState.plans.map((plan) => `<option value="${escapeHtml(plan.id)}">${escapeHtml(plan.name)}</option>`).join('')}
            </select>
          </div>

          <div>
            <div class="color-section-label">Gateway</div>
            <select class="modal-input" name="gatewayProvider">
              <option value="asaas">Asaas</option>
              <option value="mercadopago">Mercado Pago</option>
              <option value="stripe">Stripe</option>
              <option value="gateway">Gateway</option>
            </select>
          </div>

          <div>
            <div class="color-section-label">Pagamento</div>
            <select class="modal-input" name="paymentMethod">
              <option value="Pix">Pix</option>
              <option value="Cartão">Cartão</option>
              <option value="Boleto">Boleto</option>
            </select>
          </div>

          <div>
            <div class="color-section-label">Vencimento</div>
            <input class="modal-input" name="dueAt" type="date" />
          </div>
        </div>

        <div id="planos-subscription-feedback" class="planos-form-feedback"></div>

        <div class="modal-buttons" style="margin-top:10px;">
          <button type="button" class="btn-cancel" id="planos-subscription-cancel">Cancelar</button>
          <button type="submit" class="btn-save">Criar assinatura</button>
        </div>
      </form>
    </div>
  `;
}


function renderPlanosTabs() {
  const tabs = [
    { id: 'planos', label: 'Planos', hint: 'Produtos recorrentes' },
    { id: 'assinaturas', label: 'Assinaturas', hint: 'Clientes do clube' },
    { id: 'comissoes', label: 'Comissões do Clube', hint: 'Pontos e rateio' },
    { id: 'regras', label: 'Regras do Clube', hint: 'Comissões e fatores' },
  ];

  return `
    <div class="planos-tabs" role="tablist" aria-label="Planos e assinaturas">
      ${tabs.map((tab) => `
        <button
          type="button"
          class="planos-tab ${planosState.activeTab === tab.id ? 'is-active' : ''}"
          data-planos-tab="${escapeHtml(tab.id)}"
          role="tab"
          aria-selected="${planosState.activeTab === tab.id ? 'true' : 'false'}"
        >
          <span>${escapeHtml(tab.label)}</span>
          <small>${escapeHtml(tab.hint)}</small>
        </button>
      `).join('')}
    </div>
  `;
}

function renderClubPeriodSelector() {
  if (!planosState.clubPeriods.length) return '';

  const selected = getSelectedClubPeriod();

  return `
    <div class="planos-club-selector">
      <div>
        <div class="planos-section-title">Competência</div>
        <select class="modal-input" id="planos-club-period-select">
          ${planosState.clubPeriods.map((period) => `
            <option value="${escapeHtml(period.id)}" ${selected?.id === period.id ? 'selected' : ''}>
              ${escapeHtml(formatPeriodLabel(period))} · ${escapeHtml(getClubPeriodStatusMeta(period.status).label)}
            </option>
          `).join('')}
        </select>
      </div>

      <button type="button" class="planos-action-btn" id="planos-club-refresh-button">
        Atualizar dados
      </button>
    </div>
  `;
}

function renderClubSummary(period) {
  if (!period) return '';

  const statusMeta = getClubPeriodStatusMeta(period.status);
  const hasPoints = Number(period.total_commission_points || 0) > 0;

  return `
    <div class="planos-club-hero">
      <div class="planos-club-hero-main">
        <div class="planos-club-eyebrow">Divisão inteligente do Clube</div>
        <h3>Comissões por pontos, sem cálculo escondido.</h3>
        <p>
          O sistema soma as mensalidades pagas, separa a parte da barbearia e divide o valor do time conforme os pontos gerados pelos atendimentos finalizados.
        </p>
      </div>
      <div class="planos-club-status">
        <span class="planos-badge ${statusMeta.className}">${escapeHtml(statusMeta.label)}</span>
        <strong>${escapeHtml(formatPeriodLabel(period))}</strong>
        <small>${hasPoints ? `${escapeHtml(formatNumber(period.total_commission_points, 2))} ponto(s) no período` : 'Nenhum ponto finalizado neste período'}</small>
      </div>
    </div>

    <div class="planos-club-flow">
      <div class="planos-club-step">
        <span>1</span>
        <small>Entrou no Clube</small>
        <strong>${escapeHtml(formatCurrencyFromReais(period.gross_revenue))}</strong>
      </div>
      <div class="planos-club-step">
        <span>2</span>
        <small>Fica para a barbearia</small>
        <strong>${escapeHtml(formatCurrencyFromReais(period.barbershop_share))}</strong>
        <em>${escapeHtml(formatPercent(period.barbershop_share_pct))}</em>
      </div>
      <div class="planos-club-step">
        <span>3</span>
        <small>Vai para o time</small>
        <strong>${escapeHtml(formatCurrencyFromReais(period.team_pool))}</strong>
        <em>${escapeHtml(formatPercent(period.team_share_pct))}</em>
      </div>
      <div class="planos-club-step">
        <span>4</span>
        <small>Valor do ponto</small>
        <strong>${escapeHtml(formatCurrencyFromReais(period.point_value))}</strong>
        <em>${escapeHtml(`${formatNumber(period.total_commission_points, 2)} pts`)}</em>
      </div>
    </div>
  `;
}

function renderClubEntries() {
  if (!planosState.clubEntries.length) {
    return `
      <div class="planos-modal-info-row">
        Nenhuma comissão de barbeiro encontrada para esta competência.
      </div>
    `;
  }

  const maxAmount = Math.max(...planosState.clubEntries.map((entry) => Number(entry.commission_amount_cents || 0)), 1);

  return `
    <div class="planos-club-list">
      ${planosState.clubEntries.map((entry) => {
        const amount = Number(entry.commission_amount || 0);
        return `
          <div class="planos-club-entry-row">
            <div class="planos-club-avatar">${escapeHtml(String(entry.barber_name || 'B').slice(0, 2).toUpperCase())}</div>
            <div class="planos-club-entry-main">
              <div class="planos-row-title">${escapeHtml(entry.barber_name || 'Barbeiro')}</div>
              <div class="planos-row-sub">
                ${escapeHtml(`${formatNumber(entry.total_points, 2)} ponto(s) · ${entry.consumptions_count || 0} atendimento(s) finalizado(s)`)}
              </div>
              ${buildProgressBar(entry.commission_amount_cents, maxAmount, 'planos-progress--money')}
            </div>
            <div class="planos-club-entry-side">
              <strong>${escapeHtml(formatCurrencyFromReais(amount))}</strong>
              <span class="planos-badge ${getClubPeriodStatusMeta(entry.status).className}">${escapeHtml(getClubPeriodStatusMeta(entry.status).label)}</span>
            </div>
          </div>
        `;
      }).join('')}
    </div>
  `;
}

function renderClubConsumptions() {
  if (!planosState.clubConsumptions.length) {
    return `
      <div class="planos-modal-info-row">
        Nenhum atendimento finalizado com pontos nesta competência.
      </div>
    `;
  }

  return `
    <div class="planos-club-consumptions">
      ${planosState.clubConsumptions.map((item) => `
        <div class="planos-club-consumption-row">
          <div>
            <div class="planos-row-title">${escapeHtml(item.client_name || 'Cliente')}</div>
            <div class="planos-row-sub">
              ${escapeHtml(item.service_name || 'Serviço')} · ${escapeHtml(item.barber_name || 'Barbeiro')} · ${escapeHtml(formatDateDisplay(item.scheduled_at))}
            </div>
          </div>
          <div class="planos-club-consumption-side">
            <strong>${escapeHtml(`${formatNumber(item.commission_points, 2)} pts`)}</strong>
            <span>${escapeHtml(formatCurrencyFromReais(item.commission_amount))}</span>
          </div>
        </div>
      `).join('')}
    </div>
  `;
}

function renderClubCommissions() {
  if (planosState.clubIsLoading) {
    return renderLoadingState('Comissões do Clube', 'Carregando fechamentos e pontos de comissão...');
  }

  if (planosState.clubError) {
    return `
      <div class="card planos-club-card">
        <div class="card-header">
          <div class="card-title">Comissões do Clube</div>
          <button type="button" class="btn-primary-gradient" id="planos-club-refresh-button">Tentar novamente</button>
        </div>
        <div class="planos-modal-info-row">${escapeHtml(planosState.clubError)}</div>
      </div>
    `;
  }

  if (!planosState.clubPeriods.length) {
    return `
      <div class="card planos-club-card">
        <div class="card-header">
          <div>
            <div class="card-title">Comissões do Clube</div>
            <div class="row-sub" style="margin-top:4px;">Ainda não há competências geradas.</div>
          </div>
        </div>
        <div class="planos-club-empty">
          <strong>Nenhum fechamento encontrado</strong>
          <span>Quando uma competência for gerada, o BBarberFlow mostrará quanto entrou no Clube, quanto ficou para a barbearia e quanto cada barbeiro recebe por pontos.</span>
        </div>
      </div>
    `;
  }

  const period = getSelectedClubPeriod();
  const canMarkPaid = period?.status === 'closed';

  return `
    <div class="card planos-club-card">
      <div class="card-header planos-club-header">
        <div>
          <div class="card-title">Comissões do Clube</div>
          <div class="row-sub" style="margin-top:4px;">Rateio por pontos de comissão, pronto para o dono entender sem planilha.</div>
        </div>
        ${canMarkPaid ? `
          <button type="button" class="btn-primary-gradient" id="planos-club-mark-paid-button">
            Marcar como pago
          </button>
        ` : ''}
      </div>

      ${renderClubPeriodSelector()}
      ${renderClubSummary(period)}

      <div class="planos-club-grid">
        <div class="planos-club-panel">
          <div class="planos-section-title">Quanto cada barbeiro recebe</div>
          ${renderClubEntries()}
        </div>
        <div class="planos-club-panel">
          <div class="planos-section-title">Atendimentos que geraram pontos</div>
          ${renderClubConsumptions()}
        </div>
      </div>
    </div>
  `;
}


function getClubSettingsOrDefault() {
  return planosState.clubSettings || {
    barbershop_share_pct: 50,
    team_share_pct: 50,
    deduct_gateway_fees: true,
    allow_manual_adjustments: true,
    default_plan_point_multiplier_pct: 100,
    notes: '',
  };
}

function getPrimaryServicePoint() {
  const active = planosState.clubServicePoints.find((item) => item.is_active) || planosState.clubServicePoints[0] || null;

  return {
    name: active?.service_name || 'Corte simples',
    points: Number(active?.points ?? 1),
  };
}

function getPrimaryPlanRule() {
  const active = planosState.clubPlanRules.find((item) => item.is_active) || planosState.clubPlanRules[0] || null;

  return {
    name: active?.plan_name || 'Plano padrão',
    multiplier: Number(active?.point_multiplier_pct ?? getClubSettingsOrDefault().default_plan_point_multiplier_pct ?? 100),
    model: active?.commission_model || 'points_pool',
  };
}

function getRulesGeneratedPoints() {
  const servicePoint = getPrimaryServicePoint();
  const planRule = getPrimaryPlanRule();

  if (planRule.model === 'none') return 0;

  return Number((servicePoint.points * (planRule.multiplier / 100)).toFixed(2));
}

function getRulesPresetMeta(preset) {
  const presets = {
    balanced: {
      label: 'Equilíbrio clássico',
      description: '50% barbearia e 50% time. Bom ponto de partida para clubes recorrentes.',
      barbershop: 50,
      team: 50,
      defaultMultiplier: 100,
      icon: '⚖️',
      action: 'Aplicar 50/50',
    },
    growth: {
      label: 'Time motivado',
      description: '40% barbearia e 60% time. Bom para incentivar adesão dos barbeiros ao Clube.',
      barbershop: 40,
      team: 60,
      defaultMultiplier: 100,
      icon: '🚀',
      action: 'Aplicar 40/60',
    },
    margin: {
      label: 'Margem protegida',
      description: '60% barbearia e 40% time. Bom para planos econômicos ou mensalidades agressivas.',
      barbershop: 60,
      team: 40,
      defaultMultiplier: 90,
      icon: '🛡️',
      action: 'Aplicar 60/40',
    },
  };

  return presets[preset] || presets.balanced;
}

function getActiveRulesPreset() {
  const settings = getClubSettingsOrDefault();
  const barbershop = Number(settings.barbershop_share_pct || 0);
  const team = Number(settings.team_share_pct || 0);

  if (Math.abs(barbershop - 40) < 0.01 && Math.abs(team - 60) < 0.01) return 'growth';
  if (Math.abs(barbershop - 60) < 0.01 && Math.abs(team - 40) < 0.01) return 'margin';
  if (Math.abs(barbershop - 50) < 0.01 && Math.abs(team - 50) < 0.01) return 'balanced';

  return '';
}

function renderRulesFeedback() {
  if (!planosState.rulesFeedback) return '';

  return `
    <div class="planos-rules-feedback">
      ${escapeHtml(planosState.rulesFeedback)}
    </div>
  `;
}

function renderRulesQuickNav() {
  const items = [
    { target: 'planos-rules-step-split', label: 'Divisão', hint: 'dinheiro' },
    { target: 'planos-rules-step-services', label: 'Serviços', hint: 'pontos' },
    { target: 'planos-rules-step-plans', label: 'Planos', hint: 'fatores' },
  ];

  return `
    <div class="planos-rules-quicknav" aria-label="Navegação rápida das regras">
      <div class="planos-rules-quicknav-title">
        <span>Mapa da configuração</span>
        <small>Altere apenas o que fizer sentido para sua operação.</small>
      </div>
      <div class="planos-rules-quicknav-actions">
        ${items.map((item) => `
          <button type="button" class="planos-rules-nav-chip" data-rules-jump="${escapeHtml(item.target)}">
            <strong>${escapeHtml(item.label)}</strong>
            <small>${escapeHtml(item.hint)}</small>
          </button>
        `).join('')}
      </div>
      <div class="planos-rules-security-pill" title="Fechamentos já encerrados não são recalculados automaticamente.">
        <span>🔒</span>
        <strong>Vale para os próximos fechamentos</strong>
      </div>
    </div>
  `;
}

function renderRulesCockpit() {
  const settings = getClubSettingsOrDefault();
  const servicePoint = getPrimaryServicePoint();
  const planRule = getPrimaryPlanRule();
  const generatedPoints = getRulesGeneratedPoints();

  return `
    <div class="planos-rules-cockpit">
      <div class="planos-rules-cockpit-main">
        <div class="planos-club-eyebrow">Central inteligente de regras</div>
        <h3>Configure uma vez. O BarberFlow protege o caixa e explica a comissão.</h3>
        <p>
          Esta tela controla como o dinheiro do Clube é dividido, quanto cada serviço vale e se algum plano deve gerar menos pontos.
        </p>
        <div class="planos-rules-trust-row">
          <span>🔒 Fechamentos já fechados ficam protegidos</span>
          <span>📌 Mudanças valem para os próximos cálculos</span>
          <span>🧾 Tudo fica auditável por atendimento</span>
        </div>
      </div>

      <div class="planos-rules-cockpit-card">
        <span>Regra atual</span>
        <strong>${escapeHtml(formatPercent(settings.barbershop_share_pct))} barbearia · ${escapeHtml(formatPercent(settings.team_share_pct))} time</strong>
        <small>${escapeHtml(servicePoint.name)} = ${escapeHtml(formatNumber(servicePoint.points, 2))} pt · ${escapeHtml(planRule.name)} = ${escapeHtml(formatNumber(planRule.multiplier, 2))}%</small>
      </div>

      <div class="planos-rules-cockpit-card planos-rules-cockpit-card--result">
        <span>Exemplo prático</span>
        <strong>${escapeHtml(formatNumber(generatedPoints, 2))} ponto(s)</strong>
        <small>${escapeHtml(servicePoint.name)} × fator do plano</small>
      </div>
    </div>
  `;
}

function renderRulesGuide() {
  const settings = getClubSettingsOrDefault();
  const servicePoint = getPrimaryServicePoint();
  const planRule = getPrimaryPlanRule();
  const generatedPoints = getRulesGeneratedPoints();

  return `
    <div class="planos-rules-guide">
      <div class="planos-rules-guide-card">
        <span>1</span>
        <small>Dinheiro</small>
        <strong>R$ 100 vira ${escapeHtml(formatCurrencyFromReais(settings.team_share_pct))} para o time</strong>
      </div>
      <div class="planos-rules-guide-card">
        <span>2</span>
        <small>Serviço</small>
        <strong>${escapeHtml(servicePoint.name)} vale ${escapeHtml(formatNumber(servicePoint.points, 2))} pt</strong>
      </div>
      <div class="planos-rules-guide-card">
        <span>3</span>
        <small>Plano</small>
        <strong>${escapeHtml(planRule.name)} aplica ${escapeHtml(formatNumber(planRule.multiplier, 2))}%</strong>
      </div>
      <div class="planos-rules-guide-card planos-rules-guide-card--glow">
        <span>✓</span>
        <small>Resultado</small>
        <strong>Atendimento gera ${escapeHtml(formatNumber(generatedPoints, 2))} pt</strong>
      </div>
    </div>
  `;
}

function renderRulesPresetCards() {
  const activePreset = getActiveRulesPreset();

  return `
    <div class="planos-rules-presets">
      ${['balanced', 'growth', 'margin'].map((preset) => {
        const meta = getRulesPresetMeta(preset);
        const isActive = activePreset === preset;
        return `
          <button
            type="button"
            class="planos-rules-preset ${isActive ? 'is-active' : ''}"
            data-rules-preset="${escapeHtml(preset)}"
            aria-label="${escapeHtml(meta.action)}"
          >
            <div class="planos-rules-preset-top">
              <span>${escapeHtml(meta.icon)} ${escapeHtml(meta.label)}</span>
              ${isActive ? '<em>Atual</em>' : '<em>Aplicar</em>'}
            </div>
            <strong>${escapeHtml(`${meta.barbershop}% / ${meta.team}%`)}</strong>
            <small>${escapeHtml(meta.description)}</small>
            <div class="planos-rules-preset-action">${escapeHtml(meta.action)} →</div>
          </button>
        `;
      }).join('')}
    </div>
  `;
}

function renderClubRulesRevenueSplit() {
  const settings = getClubSettingsOrDefault();

  return `
    <div class="planos-rules-panel planos-rules-panel--split" id="planos-rules-step-split">
      <div class="planos-rules-panel-head planos-rules-panel-head--premium">
        <div>
          <div class="planos-section-title">Etapa 1 · Divisão da receita</div>
          <h3>De cada R$ 100 recebidos no Clube, quem fica com quanto?</h3>
          <p>Essa é a regra-mãe. Ela define quanto fica para a barbearia e quanto vira o pool de comissão do time.</p>
        </div>

        <div class="planos-rules-money-flow" aria-label="Prévia da divisão de R$ 100">
          <div>
            <small>Entrada</small>
            <strong>R$ 100,00</strong>
          </div>
          <div>
            <small>Barbearia</small>
            <strong id="planos-rules-barbershop-result">${escapeHtml(formatCurrencyFromReais(Number(settings.barbershop_share_pct || 0)))}</strong>
          </div>
          <div>
            <small>Time</small>
            <strong id="planos-rules-team-result">${escapeHtml(formatCurrencyFromReais(Number(settings.team_share_pct || 0)))}</strong>
          </div>
        </div>
      </div>

      ${renderRulesPresetCards()}

      <form id="planos-rules-settings-form" class="planos-rules-form">
        <div class="planos-rules-form-grid">
          <div class="planos-rules-input-shell">
            <div class="color-section-label">Parte da barbearia (%)</div>
            <input id="planos-rules-barbershop-share" class="modal-input" name="barbershopSharePct" type="number" min="0" max="100" step="0.01" value="${escapeHtml(settings.barbershop_share_pct)}" />
            <small>Fica no caixa da barbearia.</small>
          </div>

          <div class="planos-rules-input-shell">
            <div class="color-section-label">Parte do time (%)</div>
            <input id="planos-rules-team-share" class="modal-input" name="teamSharePct" type="number" min="0" max="100" step="0.01" value="${escapeHtml(settings.team_share_pct)}" />
            <small>Será dividido entre barbeiros por pontos.</small>
          </div>

          <div class="planos-rules-input-shell">
            <div class="color-section-label">Fator padrão de novos planos (%)</div>
            <input id="planos-rules-default-multiplier" class="modal-input" name="defaultPlanMultiplierPct" type="number" min="0" step="0.01" value="${escapeHtml(settings.default_plan_point_multiplier_pct)}" />
            <small>Usado como sugestão quando um novo plano for criado.</small>
          </div>

          <div class="planos-rules-switches">
            <label class="planos-rules-check planos-rules-check--switch">
              <input type="checkbox" name="deductGatewayFees" ${settings.deduct_gateway_fees ? 'checked' : ''} />
              <span>
                <strong>Descontar taxas antes do rateio</strong>
                <small>Mais fiel ao lucro real do Clube.</small>
              </span>
            </label>

            <label class="planos-rules-check planos-rules-check--switch">
              <input type="checkbox" name="allowManualAdjustments" ${settings.allow_manual_adjustments ? 'checked' : ''} />
              <span>
                <strong>Permitir ajustes manuais no fechamento</strong>
                <small>Útil para bônus, correções e combinados internos.</small>
              </span>
            </label>
          </div>
        </div>

        <div class="planos-rules-explain planos-rules-explain--story">
          <strong>Como o dono deve ler isso:</strong> se entrarem R$ 10.000 e a regra for 50% / 50%, R$ 5.000 ficam para a barbearia e R$ 5.000 viram o valor que será dividido entre os barbeiros conforme os pontos realizados.
        </div>

        <div class="planos-rules-action-row">
          <span>Alterou algum percentual? Salve para aplicar nos próximos fechamentos. Os fechamentos já encerrados continuam travados.</span>
          <div class="planos-rules-action-buttons">
            <button type="button" class="planos-rules-ghost-btn" id="planos-rules-reset-default">Restaurar 50/50</button>
            <button type="submit" class="btn-save planos-rules-save-btn">Salvar divisão</button>
          </div>
        </div>
      </form>
    </div>
  `;
}

function renderClubRulesServicePoints() {
  if (!planosState.clubServicePoints.length) {
    return `
      <div class="planos-rules-panel">
        <div class="planos-section-title">Etapa 2 · Pontos por serviço</div>
        <div class="planos-modal-info-row">
          Nenhum serviço encontrado para parametrizar pontos.
        </div>
      </div>
    `;
  }

  return `
    <div class="planos-rules-panel planos-rules-panel--services" id="planos-rules-step-services">
      <div class="planos-rules-panel-head">
        <div>
          <div class="planos-section-title">Etapa 2 · Pontos por serviço</div>
          <h3>Quanto cada serviço vale para o barbeiro?</h3>
          <p>Serviços mais demorados ou mais valiosos podem gerar mais pontos. Só atendimento finalizado entra no cálculo.</p>
        </div>
        <div class="planos-rules-mini-legend">
          <span>30 min ≈ 1 ponto</span>
          <span>45 min ≈ 1,5 ponto</span>
          <span>60 min ≈ 2 pontos</span>
        </div>
      </div>

      <div class="planos-rules-list planos-rules-list--services">
        ${planosState.clubServicePoints.map((item) => {
          const points = Number(item.points || 0);
          return `
            <div class="planos-rules-row planos-rules-row--service" data-service-rule-row="${escapeHtml(item.id)}">
              <div class="planos-rules-row-main">
                <div class="planos-rules-service-name">
                  <span class="planos-rules-service-dot"></span>
                  <div>
                    <div class="planos-row-title">${escapeHtml(item.service_name || 'Serviço')}</div>
                    <div class="planos-row-sub">
                      ${escapeHtml(item.service_duration_min ? `${item.service_duration_min} min` : 'Duração não informada')}
                      · ${escapeHtml(item.calculation_hint || 'Pontos definidos manualmente')}
                    </div>
                  </div>
                </div>
                <div class="planos-rules-formula-line">
                  Hoje este serviço gera <strong>${escapeHtml(formatNumber(points, 2))} ponto(s)</strong> antes do fator do plano.
                </div>
              </div>

              <div class="planos-rules-row-controls planos-rules-row-controls--premium">
                <label class="planos-rules-field-mini">
                  <small>Pontos</small>
                  <input class="modal-input planos-rules-number" data-service-points-input="${escapeHtml(item.id)}" type="number" min="0" step="0.01" value="${escapeHtml(item.points)}" />
                </label>
                <label class="planos-rules-mini-check">
                  <input type="checkbox" data-service-active-input="${escapeHtml(item.id)}" ${item.is_active ? 'checked' : ''} />
                  <span>Ativo</span>
                </label>
                <button type="button" class="planos-action-btn planos-rule-service-save" data-service-point-id="${escapeHtml(item.id)}">
                  Salvar
                </button>
              </div>
            </div>
          `;
        }).join('')}
      </div>
    </div>
  `;
}

function renderClubRulesPlanRules() {
  if (!planosState.clubPlanRules.length) {
    return `
      <div class="planos-rules-panel">
        <div class="planos-section-title">Etapa 3 · Peso de comissão por plano</div>
        <div class="planos-modal-info-row">
          Nenhum plano encontrado para parametrizar fator.
        </div>
      </div>
    `;
  }

  const servicePoint = getPrimaryServicePoint();

  return `
    <div class="planos-rules-panel planos-rules-panel--plans" id="planos-rules-step-plans">
      <div class="planos-rules-panel-head">
        <div>
          <div class="planos-section-title">Etapa 3 · Peso de comissão por plano</div>
          <h3>Defina se cada plano gera pontuação cheia, reduzida ou nenhuma comissão.</h3>
          <p>Use 100% para plano normal, 80% para econômico, 70% para promocional e 0% para cortesia. Isso protege a margem sem esconder a regra do barbeiro.</p>
        </div>
        <div class="planos-rules-factor-strip">
          <span><strong>100%</strong> normal</span>
          <span><strong>80%</strong> econômico</span>
          <span><strong>70%</strong> promocional</span>
          <span><strong>0%</strong> cortesia</span>
        </div>
      </div>

      <div class="planos-rules-list planos-rules-list--plans">
        ${planosState.clubPlanRules.map((item) => {
          const multiplier = Number(item.point_multiplier_pct || 0);
          const generated = item.commission_model === 'none' ? 0 : Number((servicePoint.points * (multiplier / 100)).toFixed(2));

          return `
            <div class="planos-rules-row planos-rules-row--plan" data-plan-rule-row="${escapeHtml(item.id)}">
              <div class="planos-rules-row-main">
                <div class="planos-row-title">${escapeHtml(item.plan_name || 'Plano')}</div>
                <div class="planos-row-sub">
                  ${escapeHtml(item.commission_model === 'none' ? 'Sem comissão por pontos' : 'Rateio por pontos')}
                  · ${escapeHtml(item.notes || 'Ajuste o fator conforme a estratégia do plano')}
                </div>
                <div class="planos-rules-formula-line">
                  Exemplo com ${escapeHtml(servicePoint.name)}: ${escapeHtml(formatNumber(servicePoint.points, 2))} pt × ${escapeHtml(formatNumber(multiplier, 2))}% = <strong>${escapeHtml(formatNumber(generated, 2))} pt</strong>
                </div>
              </div>

              <div class="planos-rules-row-controls planos-rules-row-controls--premium">
                <label class="planos-rules-field-mini planos-rules-field-mini--wide">
                  <small>Modelo</small>
                  <select class="modal-input planos-rules-select" data-plan-model-input="${escapeHtml(item.id)}">
                    <option value="points_pool" ${item.commission_model === 'points_pool' ? 'selected' : ''}>Rateio por pontos</option>
                    <option value="none" ${item.commission_model === 'none' ? 'selected' : ''}>Sem comissão</option>
                  </select>
                </label>
                <label class="planos-rules-field-mini">
                  <small>Fator %</small>
                  <input class="modal-input planos-rules-number" data-plan-multiplier-input="${escapeHtml(item.id)}" type="number" min="0" step="0.01" value="${escapeHtml(item.point_multiplier_pct)}" />
                </label>
                <label class="planos-rules-mini-check">
                  <input type="checkbox" data-plan-active-input="${escapeHtml(item.id)}" ${item.is_active ? 'checked' : ''} />
                  <span>Ativo</span>
                </label>
                <button type="button" class="planos-action-btn planos-rule-plan-save" data-plan-rule-id="${escapeHtml(item.id)}">
                  Salvar
                </button>
              </div>
            </div>
          `;
        }).join('')}
      </div>

      <div class="planos-rules-explain planos-rules-explain--story">
        <strong>Fórmula transparente:</strong> pontos do serviço × fator do plano. Exemplo: corte simples 1,00 ponto em plano econômico 80% gera 0,80 ponto para o barbeiro.
      </div>
    </div>
  `;
}

function renderClubRules() {
  if (planosState.rulesIsLoading) {
    return renderLoadingState('Regras do Clube', 'Carregando parametrizações de comissão...');
  }

  if (planosState.rulesError) {
    return `
      <div class="card planos-club-card">
        <div class="card-header">
          <div class="card-title">Regras do Clube</div>
          <button type="button" class="btn-primary-gradient" id="planos-rules-refresh-button">Tentar novamente</button>
        </div>
        <div class="planos-modal-info-row">${escapeHtml(planosState.rulesError)}</div>
      </div>
    `;
  }

  return `
    <div class="card planos-club-card planos-rules-card planos-rules-card--ux200">
      <div class="card-header planos-club-header planos-rules-header-premium">
        <div>
          <div class="card-title">Regras do Clube</div>
          <div class="row-sub" style="margin-top:4px;">Parametrize a divisão da receita, os pontos por serviço e o fator por plano.</div>
        </div>
        <button type="button" class="planos-action-btn" id="planos-rules-refresh-button">Atualizar regras</button>
      </div>

      ${renderRulesFeedback()}
      ${renderRulesCockpit()}
      ${renderRulesQuickNav()}
      ${renderRulesGuide()}

      <div class="planos-rules-stack planos-rules-stack--premium">
        ${renderClubRulesRevenueSplit()}
        ${renderClubRulesServicePoints()}
        ${renderClubRulesPlanRules()}
      </div>
    </div>
  `;
}

function applyRulesPreset(preset) {
  const meta = getRulesPresetMeta(preset);
  const barbershopInput = document.getElementById('planos-rules-barbershop-share');
  const teamInput = document.getElementById('planos-rules-team-share');
  const defaultMultiplierInput = document.getElementById('planos-rules-default-multiplier');

  if (barbershopInput) barbershopInput.value = String(meta.barbershop);
  if (teamInput) teamInput.value = String(meta.team);
  if (defaultMultiplierInput) defaultMultiplierInput.value = String(meta.defaultMultiplier);

  syncRulesRevenuePreview();
  setRulesFeedback(`${meta.label} aplicado na tela. Clique em Salvar divisão para gravar.`, 'neutral');
}

function syncRulesRevenuePreview() {
  const barbershopInput = document.getElementById('planos-rules-barbershop-share');
  const teamInput = document.getElementById('planos-rules-team-share');
  const barbershopResult = document.getElementById('planos-rules-barbershop-result');
  const teamResult = document.getElementById('planos-rules-team-result');

  const barbershop = Number(barbershopInput?.value || 0);
  const team = Number(teamInput?.value || 0);

  if (barbershopResult) barbershopResult.textContent = formatCurrencyFromReais(barbershop);
  if (teamResult) teamResult.textContent = formatCurrencyFromReais(team);
}


function setPlanFormFeedback(message, variant = 'neutral') {
  const el = document.getElementById('planos-form-feedback');
  if (!el) return;

  el.textContent = message || '';
  el.style.color =
    variant === 'error' ? '#ff8a8a' :
    variant === 'success' ? '#00e676' :
    '#5a6888';
}

function setSubscriptionFormFeedback(message, variant = 'neutral') {
  const el = document.getElementById('planos-subscription-feedback');
  if (!el) return;

  el.textContent = message || '';
  el.style.color =
    variant === 'error' ? '#ff8a8a' :
    variant === 'success' ? '#00e676' :
    '#5a6888';
}

function setSubscriptionDetailsFeedback(message, variant = 'neutral') {
  const el = document.getElementById('planos-details-feedback');
  if (!el) return;

  el.textContent = message || '';
  el.style.color =
    variant === 'error' ? '#ff8a8a' :
    variant === 'success' ? '#00e676' :
    '#5a6888';
}

function setRulesFeedback(message, variant = 'neutral') {
  planosState.rulesFeedback = message || '';

  if (variant === 'error' && message) {
    planosState.rulesError = message;
  } else if (variant !== 'error') {
    planosState.rulesError = '';
  }
}


async function ensureClientsLoaded() {
  if (Array.isArray(planosState.clients) && planosState.clients.length > 0) return;

  const clients = await getClients();
  planosState.clients = Array.isArray(clients) ? clients : [];
}


async function loadClubCommissionsData({ render = true } = {}) {
  if (!hasApiConfig() || !hasAuthToken()) return;

  planosState.clubIsLoading = true;
  planosState.clubError = '';

  if (render) rerenderPlanos();

  try {
    const periodsPayload = await getClubCommissionPeriods();
    planosState.clubPeriods = Array.isArray(periodsPayload) ? periodsPayload : [];

    const selectedStillExists = planosState.clubPeriods.some((period) => period.id === planosState.clubSelectedPeriodId);
    planosState.clubSelectedPeriodId = selectedStillExists
      ? planosState.clubSelectedPeriodId
      : planosState.clubPeriods[0]?.id || null;

    if (!planosState.clubSelectedPeriodId) {
      planosState.clubEntries = [];
      planosState.clubConsumptions = [];
      return;
    }

    const [entriesPayload, consumptionsPayload] = await Promise.all([
      getClubCommissionEntries(planosState.clubSelectedPeriodId),
      getClubCommissionConsumptions(planosState.clubSelectedPeriodId),
    ]);

    planosState.clubEntries = Array.isArray(entriesPayload) ? entriesPayload : [];
    planosState.clubConsumptions = Array.isArray(consumptionsPayload) ? consumptionsPayload : [];
  } catch (error) {
    planosState.clubPeriods = [];
    planosState.clubEntries = [];
    planosState.clubConsumptions = [];
    planosState.clubError = error instanceof Error
      ? error.message
      : 'Não foi possível carregar as comissões do clube.';
  } finally {
    planosState.clubIsLoading = false;
    if (render) rerenderPlanos();
  }
}


async function loadClubRulesData({ render = true } = {}) {
  if (!hasApiConfig() || !hasAuthToken()) return;

  planosState.rulesIsLoading = true;
  planosState.rulesError = '';

  if (render) rerenderPlanos();

  try {
    const [settingsPayload, servicePointsPayload, planRulesPayload] = await Promise.all([
      getClubCommissionSettings(),
      getClubCommissionServicePoints(),
      getClubCommissionPlanRules(),
    ]);

    planosState.clubSettings = settingsPayload || null;
    planosState.clubServicePoints = Array.isArray(servicePointsPayload) ? servicePointsPayload : [];
    planosState.clubPlanRules = Array.isArray(planRulesPayload) ? planRulesPayload : [];
  } catch (error) {
    planosState.clubSettings = null;
    planosState.clubServicePoints = [];
    planosState.clubPlanRules = [];
    planosState.rulesError = error instanceof Error
      ? error.message
      : 'Não foi possível carregar as regras do clube.';
  } finally {
    planosState.rulesIsLoading = false;
    if (render) rerenderPlanos();
  }
}


async function loadPlanosData() {
  const metricsEl = document.getElementById('planos-metrics');
  const plansListEl = document.getElementById('planos-list');
  const subscriptionsListEl = document.getElementById('planos-subscriptions-list');
  const clubCommissionsEl = document.getElementById('planos-club-commissions');
  const clubRulesEl = document.getElementById('planos-club-rules');

  if (!metricsEl || !plansListEl || !subscriptionsListEl || !clubCommissionsEl || !clubRulesEl) return;

  if (!hasApiConfig()) {
    planosState.isLoaded = false;
    metricsEl.innerHTML = '';
    plansListEl.innerHTML = renderConfigHint(
      'API não configurada',
      'Abra o login dev e informe a URL pública do backend para carregar os planos reais.',
      true,
    );
    subscriptionsListEl.innerHTML = renderEmptyState(
      'Assinaturas',
      'Aguardando configuração da API para exibir as assinaturas.',
    );
    clubCommissionsEl.innerHTML = renderEmptyState(
      'Comissões do Clube',
      'Aguardando configuração da API para exibir os fechamentos.',
    );
    clubRulesEl.innerHTML = renderEmptyState(
      'Regras do Clube',
      'Aguardando configuração da API para exibir as regras.',
    );
    return;
  }

  if (!hasAuthToken()) {
    planosState.isLoaded = false;
    metricsEl.innerHTML = '';
    plansListEl.innerHTML = renderConfigHint(
      'Login de desenvolvimento pendente',
      'Faça o login dev com um usuário válido para liberar os módulos protegidos.',
      true,
    );
    subscriptionsListEl.innerHTML = renderEmptyState(
      'Assinaturas',
      'Aguardando autenticação para exibir as assinaturas.',
    );
    clubCommissionsEl.innerHTML = renderEmptyState(
      'Comissões do Clube',
      'Aguardando autenticação para exibir os fechamentos.',
    );
    clubRulesEl.innerHTML = renderEmptyState(
      'Regras do Clube',
      'Aguardando autenticação para exibir as regras.',
    );
    return;
  }

  planosState.isLoading = true;
  metricsEl.innerHTML = '';
  plansListEl.innerHTML = renderLoadingState('Planos', 'Carregando planos...');
  subscriptionsListEl.innerHTML = renderLoadingState('Assinaturas', 'Carregando assinaturas...');
  clubCommissionsEl.innerHTML = renderLoadingState('Comissões do Clube', 'Carregando comissões por pontos...');
  clubRulesEl.innerHTML = renderLoadingState('Regras do Clube', 'Carregando parametrizações...');

  try {
    const [plansPayload, subscriptionsPayload] = await Promise.all([
      getPlans(),
      getSubscriptions(),
    ]);

    const mappedPlans = Array.isArray(plansPayload) ? plansPayload.map(mapPlanFromApi) : [];
    const mappedSubscriptions = Array.isArray(subscriptionsPayload)
      ? subscriptionsPayload.map(mapSubscriptionFromApi)
      : [];

    planosState.plans = applySubscriberCounts(mappedPlans, mappedSubscriptions);
    planosState.subscriptions = mappedSubscriptions;

    await Promise.all([
      loadClubCommissionsData({ render: false }),
      loadClubRulesData({ render: false }),
    ]);

    planosState.isLoaded = true;

    rerenderPlanos();
  } catch (error) {
    planosState.isLoaded = false;
    const message = error instanceof Error ? error.message : 'Não foi possível carregar os dados de planos.';
    metricsEl.innerHTML = '';
    plansListEl.innerHTML = renderConfigHint('Erro ao carregar planos', message, true);
    subscriptionsListEl.innerHTML = renderEmptyState(
      'Assinaturas',
      'Sem dados por causa do erro de integração.',
    );
    clubCommissionsEl.innerHTML = renderEmptyState(
      'Comissões do Clube',
      'Sem dados por causa do erro de integração.',
    );
    clubRulesEl.innerHTML = renderEmptyState(
      'Regras do Clube',
      'Sem dados por causa do erro de integração.',
    );
  } finally {
    planosState.isLoading = false;
  }
}

function openPlanModal(planId) {
  planosState.activePlanId = planId;
  planosState.activeSubscriptionId = null;
  planosState.modalMode = 'viewPlan';
  renderPlanosModal();
}

function openEditPlanModal(planId) {
  planosState.activePlanId = planId;
  planosState.activeSubscriptionId = null;
  planosState.modalMode = 'editPlan';
  renderPlanosModal();
}

function openCreatePlanModal() {
  planosState.activePlanId = null;
  planosState.activeSubscriptionId = null;
  planosState.modalMode = 'createPlan';
  renderPlanosModal();
}

function openSubscriptionModal(subscriptionId) {
  planosState.activeSubscriptionId = subscriptionId;
  planosState.activePlanId = null;
  planosState.modalMode = 'viewSubscription';
  renderPlanosModal();
}

async function openCreateSubscriptionModal() {
  try {
    await ensureClientsLoaded();
    planosState.activeSubscriptionId = null;
    planosState.activePlanId = null;
    planosState.modalMode = 'createSubscription';
    renderPlanosModal();
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Não foi possível carregar os clientes.';
    alert(message);
  }
}

function closePlanosModal() {
  const modal = document.getElementById('planos-details-modal');
  const content = document.getElementById('planos-details-content');
  if (!modal) return;

  planosState.modalMode = 'closed';
  planosState.activePlanId = null;
  planosState.activeSubscriptionId = null;
  modal.classList.remove('open');
  modal.style.display = 'none';

  if (content) content.innerHTML = '';
}

function collectPlanFormData() {
  const form = document.getElementById('planos-form');
  const formData = new FormData(form);
  const planType = String(formData.get('planType') || 'fixed_quantity');
  const defaultCreditMode = getPlanTypeMeta(planType).creditMode;

  return {
    name: String(formData.get('name') || '').trim(),
    description: String(formData.get('description') || '').trim(),
    priceInput: String(formData.get('price') || '').trim(),
    billingInterval: String(formData.get('billingInterval') || 'Mensal').trim(),
    includedHaircuts: Number(formData.get('includedHaircuts') || 0),
    includedBeards: Number(formData.get('includedBeards') || 0),
    signupFeeCents: Number(formData.get('signupFeeCents') || 0),
    graceDays: Number(formData.get('graceDays') || 0),
    planType,
    creditMode: String(formData.get('creditMode') || defaultCreditMode),
    totalCredits: Number(formData.get('totalCredits') || 0),
    scheduleRestrictionEnabled: String(formData.get('scheduleRestrictionEnabled') || 'false') === 'true',
    allowedWeekdays: normalizeAllowedWeekdays(formData.getAll('allowedWeekdays').map(Number)),
    allowedTimeStart: String(formData.get('allowedTimeStart') || '').trim() || null,
    allowedTimeEnd: String(formData.get('allowedTimeEnd') || '').trim() || null,
    allowRollover: String(formData.get('allowRollover') || 'false') === 'true',
    rolloverDays: Number(formData.get('rolloverDays') || 0),
    overusePolicy: String(formData.get('overusePolicy') || 'block'),
    partialComboPolicy: String(formData.get('partialComboPolicy') || 'block_partial'),
    isActive: String(formData.get('isActive') || 'true') === 'true',
  };
}

async function handlePlanFormSubmit(event) {
  event.preventDefault();

  const data = collectPlanFormData();
  const parsedPrice = parseMoneyInput(data.priceInput);

  if (!data.name) {
    setPlanFormFeedback('Informe o nome do plano.', 'error');
    return;
  }

  if (data.name.length > PLAN_NAME_MAX_LENGTH) {
    setPlanFormFeedback(`O nome deve ter no máximo ${PLAN_NAME_MAX_LENGTH} caracteres.`, 'error');
    return;
  }

  if (data.description.length > PLAN_DESCRIPTION_MAX_LENGTH) {
    setPlanFormFeedback(`A descrição deve ter no máximo ${PLAN_DESCRIPTION_MAX_LENGTH} caracteres.`, 'error');
    return;
  }

  if (!parsedPrice) {
    setPlanFormFeedback('Informe o preço no formato 69,90.', 'error');
    return;
  }

  if (!isNonNegativeInteger(data.includedHaircuts)) {
    setPlanFormFeedback('Cortes incluídos deve ser um número inteiro maior ou igual a zero.', 'error');
    return;
  }

  if (!isNonNegativeInteger(data.includedBeards)) {
    setPlanFormFeedback('Barbas incluídas deve ser um número inteiro maior ou igual a zero.', 'error');
    return;
  }

  if (!isNonNegativeInteger(data.signupFeeCents)) {
    setPlanFormFeedback('Taxa de adesão deve ser informada em centavos inteiros.', 'error');
    return;
  }

  if (!isNonNegativeInteger(data.graceDays)) {
    setPlanFormFeedback('Carência deve ser um número inteiro maior ou igual a zero.', 'error');
    return;
  }

  if (!Number.isFinite(data.totalCredits) || data.totalCredits < 0) {
    setPlanFormFeedback('Créditos totais deve ser maior ou igual a zero.', 'error');
    return;
  }

  if (!isNonNegativeInteger(data.rolloverDays)) {
    setPlanFormFeedback('Dias para acumular deve ser um número inteiro maior ou igual a zero.', 'error');
    return;
  }

  if (data.scheduleRestrictionEnabled && !data.allowedWeekdays.length) {
    setPlanFormFeedback('Selecione pelo menos um dia permitido para o plano.', 'error');
    return;
  }

  if (
    data.scheduleRestrictionEnabled &&
    data.allowedTimeStart &&
    data.allowedTimeEnd &&
    data.allowedTimeEnd <= data.allowedTimeStart
  ) {
    setPlanFormFeedback('O horário final precisa ser maior que o horário inicial.', 'error');
    return;
  }

  const humanSummary = buildPlanHumanSummary(data);

  const payload = {
    name: data.name,
    description: data.description,
    price: parsedPrice.amount,
    currency: 'BRL',
    billing_interval: data.billingInterval === 'Anual' ? 'year' : 'month',
    billing_interval_count: 1,
    included_haircuts: data.includedHaircuts,
    included_beards: data.includedBeards,
    signup_fee_cents: data.signupFeeCents,
    grace_days: data.graceDays,
    is_active: data.isActive,
    plan_type: data.planType,
    credit_mode: data.creditMode,
    total_credits: data.totalCredits,
    schedule_restriction_enabled: data.scheduleRestrictionEnabled,
    allowed_weekdays: data.allowedWeekdays,
    allowed_time_start: data.scheduleRestrictionEnabled ? data.allowedTimeStart : null,
    allowed_time_end: data.scheduleRestrictionEnabled ? data.allowedTimeEnd : null,
    allow_rollover: data.allowRollover,
    rollover_days: data.allowRollover ? data.rolloverDays : 0,
    overuse_policy: data.overusePolicy,
    partial_combo_policy: data.partialComboPolicy,
    plan_rules: {
      label: getPlanTypeMeta(data.planType).label,
      summary: humanSummary,
      schedule: data.scheduleRestrictionEnabled
        ? {
            allowed_weekdays: data.allowedWeekdays,
            allowed_time_start: data.allowedTimeStart,
            allowed_time_end: data.allowedTimeEnd,
          }
        : null,
      overuse_policy_label: getOverusePolicyLabel(data.overusePolicy),
      partial_combo_policy_label: getPartialComboPolicyLabel(data.partialComboPolicy),
      updated_from_ui: true,
    },
    service_entitlements: [],
  };

  try {
    setPlanFormFeedback(planosState.modalMode === 'editPlan' ? 'Salvando alterações...' : 'Criando plano...');

    if (planosState.modalMode === 'createPlan') {
      const createdPlan = await createPlan(payload);
      await loadPlanosData();
      const createdId = createdPlan?.id || null;
      if (createdId) {
        openPlanModal(createdId);
      } else {
        closePlanosModal();
      }
      return;
    }

    if (planosState.modalMode === 'editPlan' && planosState.activePlanId) {
      await updatePlan(planosState.activePlanId, payload);
      await loadPlanosData();
      openPlanModal(planosState.activePlanId);
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Não foi possível salvar o plano.';
    setPlanFormFeedback(message, 'error');
  }
}

function collectSubscriptionFormData() {
  const form = document.getElementById('planos-subscription-form');
  const formData = new FormData(form);

  return {
    clientId: String(formData.get('clientId') || '').trim(),
    planId: String(formData.get('planId') || '').trim(),
    gatewayProvider: String(formData.get('gatewayProvider') || 'asaas').trim(),
    paymentMethod: String(formData.get('paymentMethod') || 'Pix').trim(),
    dueAt: String(formData.get('dueAt') || '').trim(),
  };
}

async function handleSubscriptionFormSubmit(event) {
  event.preventDefault();

  const data = collectSubscriptionFormData();

  if (!data.clientId) {
    setSubscriptionFormFeedback('Selecione o cliente.', 'error');
    return;
  }

  if (!data.planId) {
    setSubscriptionFormFeedback('Selecione um plano.', 'error');
    return;
  }

  if (!data.dueAt) {
    setSubscriptionFormFeedback('Informe a data de vencimento.', 'error');
    return;
  }

  try {
    setSubscriptionFormFeedback('Criando assinatura...');

    const payload = {
      client_id: data.clientId,
      plan_id: data.planId,
      gateway_provider: data.gatewayProvider,
      payment_method: data.paymentMethod,
      due_at: new Date(`${data.dueAt}T12:00:00`).toISOString(),
    };

    const createdSubscription = await createSubscription(payload);
    await loadPlanosData();

    const createdId = createdSubscription?.id || (Array.isArray(createdSubscription) ? createdSubscription[0]?.id : null);

    if (createdId) {
      openSubscriptionModal(createdId);
    } else {
      closePlanosModal();
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Não foi possível criar a assinatura.';
    setSubscriptionFormFeedback(message, 'error');
  }
}

async function handleSubscriptionAction(subscriptionId, action) {
  const buttons = document.querySelectorAll('.planos-subscription-action');

  try {
    buttons.forEach((button) => button.setAttribute('disabled', 'disabled'));
    setSubscriptionDetailsFeedback('Executando ação na assinatura...', 'neutral');

    if (action === 'activate') {
      await activateSubscription(subscriptionId);
    }

    if (action === 'pause') {
      await pauseSubscription(subscriptionId);
    }

    if (action === 'reactivate') {
      await reactivateSubscription(subscriptionId);
    }

    if (action === 'cancel') {
      await cancelSubscription(subscriptionId);
    }

    await loadPlanosData();
    openSubscriptionModal(subscriptionId);
    setTimeout(() => {
      setSubscriptionDetailsFeedback('Assinatura atualizada com sucesso.', 'success');
    }, 0);
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Não foi possível atualizar a assinatura.';
    setSubscriptionDetailsFeedback(message, 'error');
  } finally {
    buttons.forEach((button) => button.removeAttribute('disabled'));
  }
}

async function handleInvoiceAction(invoiceId, subscriptionId, action) {
  const buttons = document.querySelectorAll('.planos-invoice-action');

  try {
    buttons.forEach((button) => button.setAttribute('disabled', 'disabled'));
    setSubscriptionDetailsFeedback('Executando ação na cobrança...', 'neutral');

    if (action === 'markPaid') {
      await markInvoicePaid(invoiceId);
    }

    if (action === 'markFailed') {
      await markInvoiceFailed(invoiceId);
    }

    if (action === 'cancel') {
      await cancelInvoice(invoiceId);
    }

    await loadPlanosData();
    openSubscriptionModal(subscriptionId);
    setTimeout(() => {
      setSubscriptionDetailsFeedback('Cobrança atualizada com sucesso.', 'success');
    }, 0);
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Não foi possível atualizar a cobrança.';
    setSubscriptionDetailsFeedback(message, 'error');
  } finally {
    buttons.forEach((button) => button.removeAttribute('disabled'));
  }
}


async function handleClubPeriodChange(periodId) {
  if (!periodId) return;
  planosState.clubSelectedPeriodId = periodId;
  await loadClubCommissionsData({ render: true });
}

async function handleMarkClubPeriodPaid() {
  const period = getSelectedClubPeriod();
  if (!period || period.status !== 'closed') return;

  const ok = window.confirm('Deseja marcar este fechamento do Clube como pago? Essa ação muda o status das comissões para pago.');
  if (!ok) return;

  try {
    planosState.clubIsLoading = true;
    rerenderPlanos();
    await markClubCommissionPeriodPaid(period.id);
    await Promise.all([
      loadClubCommissionsData({ render: false }),
      loadClubRulesData({ render: false }),
    ]);
    rerenderPlanos();
  } catch (error) {
    planosState.clubError = error instanceof Error
      ? error.message
      : 'Não foi possível marcar o fechamento como pago.';
    planosState.clubIsLoading = false;
    rerenderPlanos();
  }
}


async function handleRulesSettingsSubmit(event) {
  event.preventDefault();

  const form = event.currentTarget;
  const formData = new FormData(form);

  const barbershopSharePct = Number(formData.get('barbershopSharePct') || 0);
  const teamSharePct = Number(formData.get('teamSharePct') || 0);
  const defaultPlanMultiplierPct = Number(formData.get('defaultPlanMultiplierPct') || 0);

  if (!Number.isFinite(barbershopSharePct) || !Number.isFinite(teamSharePct)) {
    setRulesFeedback('Informe percentuais válidos.', 'error');
    rerenderPlanos();
    return;
  }

  if (Math.abs((barbershopSharePct + teamSharePct) - 100) > 0.01) {
    setRulesFeedback('A soma da parte da barbearia e da parte do time precisa ser 100%.', 'error');
    rerenderPlanos();
    return;
  }

  try {
    planosState.rulesIsLoading = true;
    setRulesFeedback('Salvando divisão da receita...');
    rerenderPlanos();

    await updateClubCommissionSettings({
      barbershop_share_pct: barbershopSharePct,
      team_share_pct: teamSharePct,
      default_plan_point_multiplier_pct: defaultPlanMultiplierPct,
      deduct_gateway_fees: Boolean(formData.get('deductGatewayFees')),
      allow_manual_adjustments: Boolean(formData.get('allowManualAdjustments')),
    });

    await loadClubRulesData({ render: false });
    planosState.rulesIsLoading = false;
    setRulesFeedback('Regras de divisão salvas com sucesso.', 'success');
    rerenderPlanos();
  } catch (error) {
    planosState.rulesIsLoading = false;
    setRulesFeedback(error instanceof Error ? error.message : 'Não foi possível salvar a divisão.', 'error');
    rerenderPlanos();
  }
}

async function handleSaveServicePoint(pointId) {
  const pointsInput = document.querySelector(`[data-service-points-input="${escapeSelector(pointId)}"]`);
  const activeInput = document.querySelector(`[data-service-active-input="${escapeSelector(pointId)}"]`);
  const points = Number(pointsInput?.value || 0);

  if (!Number.isFinite(points) || points < 0) {
    setRulesFeedback('Informe uma pontuação válida para o serviço.', 'error');
    rerenderPlanos();
    return;
  }

  try {
    planosState.rulesIsLoading = true;
    setRulesFeedback('Salvando pontos do serviço...');
    rerenderPlanos();

    await updateClubCommissionServicePoint(pointId, {
      points,
      is_active: Boolean(activeInput?.checked),
      calculation_hint: 'Ajustado manualmente pelo dono da barbearia',
    });

    await loadClubRulesData({ render: false });
    planosState.rulesIsLoading = false;
    setRulesFeedback('Pontos do serviço salvos com sucesso.', 'success');
    rerenderPlanos();
  } catch (error) {
    planosState.rulesIsLoading = false;
    setRulesFeedback(error instanceof Error ? error.message : 'Não foi possível salvar os pontos do serviço.', 'error');
    rerenderPlanos();
  }
}

async function handleSavePlanRule(ruleId) {
  const multiplierInput = document.querySelector(`[data-plan-multiplier-input="${escapeSelector(ruleId)}"]`);
  const modelInput = document.querySelector(`[data-plan-model-input="${escapeSelector(ruleId)}"]`);
  const activeInput = document.querySelector(`[data-plan-active-input="${escapeSelector(ruleId)}"]`);
  const pointMultiplierPct = Number(multiplierInput?.value || 0);

  if (!Number.isFinite(pointMultiplierPct) || pointMultiplierPct < 0) {
    setRulesFeedback('Informe um fator válido para o plano.', 'error');
    rerenderPlanos();
    return;
  }

  try {
    planosState.rulesIsLoading = true;
    setRulesFeedback('Salvando fator do plano...');
    rerenderPlanos();

    await updateClubCommissionPlanRule(ruleId, {
      commission_model: modelInput?.value || 'points_pool',
      point_multiplier_pct: pointMultiplierPct,
      is_active: Boolean(activeInput?.checked),
    });

    await loadClubRulesData({ render: false });
    planosState.rulesIsLoading = false;
    setRulesFeedback('Fator do plano salvo com sucesso.', 'success');
    rerenderPlanos();
  } catch (error) {
    planosState.rulesIsLoading = false;
    setRulesFeedback(error instanceof Error ? error.message : 'Não foi possível salvar o fator do plano.', 'error');
    rerenderPlanos();
  }
}


function renderPlanosModal() {
  const modal = document.getElementById('planos-details-modal');
  const content = document.getElementById('planos-details-content');
  if (!modal || !content) return;

  if (planosState.modalMode === 'closed') {
    modal.classList.remove('open');
    modal.style.display = 'none';
    content.innerHTML = '';
    return;
  }

  const plan = planosState.activePlanId ? getPlanById(planosState.activePlanId) : null;
  const subscription = planosState.activeSubscriptionId ? getSubscriptionById(planosState.activeSubscriptionId) : null;

  if (planosState.modalMode === 'viewPlan' && !plan) {
    closePlanosModal();
    return;
  }

  if (planosState.modalMode === 'editPlan' && !plan) {
    closePlanosModal();
    return;
  }

  if (planosState.modalMode === 'viewSubscription' && !subscription) {
    closePlanosModal();
    return;
  }

  if (planosState.modalMode === 'viewPlan') {
    content.innerHTML = renderPlanDetails(plan);
  }

  if (planosState.modalMode === 'editPlan') {
    content.innerHTML = renderPlanForm('editPlan', plan);
  }

  if (planosState.modalMode === 'createPlan') {
    content.innerHTML = renderPlanForm('createPlan');
  }

  if (planosState.modalMode === 'viewSubscription') {
    content.innerHTML = renderSubscriptionDetails(subscription);
  }

  if (planosState.modalMode === 'createSubscription') {
    content.innerHTML = renderSubscriptionForm();
  }

  modal.style.display = 'flex';
  modal.classList.add('open');

  bindPlanosModalEvents();
  initPlanFormEnhancements();
}

function bindPlanEvents() {
  document.querySelectorAll('.planos-row-button[data-plan-id]').forEach((button) => {
    button.addEventListener('click', () => {
      openPlanModal(button.dataset.planId);
    });
  });
}

function bindSubscriptionEvents() {
  document.querySelectorAll('.planos-row-button[data-subscription-id]').forEach((button) => {
    button.addEventListener('click', () => {
      openSubscriptionModal(button.dataset.subscriptionId);
    });
  });
}

function bindPlanosModalEvents() {
  document.getElementById('planos-modal-close')?.addEventListener('click', closePlanosModal);

  document.getElementById('planos-edit-button')?.addEventListener('click', () => {
    const button = document.getElementById('planos-edit-button');
    if (!button?.dataset.planId) return;
    openEditPlanModal(button.dataset.planId);
  });

  document.getElementById('planos-form-back')?.addEventListener('click', () => {
    if (!planosState.activePlanId) return;
    openPlanModal(planosState.activePlanId);
  });

  document.getElementById('planos-form-cancel')?.addEventListener('click', closePlanosModal);
  document.getElementById('planos-form')?.addEventListener('submit', handlePlanFormSubmit);

  const planForm = document.getElementById('planos-form');
  if (planForm) {
    planForm.querySelectorAll('input, select, textarea').forEach((field) => {
      field.addEventListener('input', updatePlanWizardSummary);
      field.addEventListener('change', updatePlanWizardSummary);
    });

    planForm.querySelectorAll('.planos-type-card').forEach((card) => {
      card.addEventListener('click', () => {
        const radio = card.querySelector('input[type="radio"]');
        if (radio) {
          radio.checked = true;
          const meta = getPlanTypeMeta(radio.value);
          const creditMode = planForm.querySelector('[name="creditMode"]');
          if (creditMode && !planosState.activePlanId) creditMode.value = meta.creditMode;
          updatePlanWizardSummary();
        }
      });
    });

    updatePlanWizardSummary();
  }

  document.getElementById('planos-subscription-cancel')?.addEventListener('click', closePlanosModal);
  document.getElementById('planos-subscription-form')?.addEventListener('submit', handleSubscriptionFormSubmit);

  document.querySelectorAll('.planos-subscription-action').forEach((button) => {
    button.addEventListener('click', () => {
      const subscriptionId = button.dataset.subscriptionId;
      const action = button.dataset.action;
      if (!subscriptionId || !action) return;
      handleSubscriptionAction(subscriptionId, action);
    });
  });

  document.querySelectorAll('.planos-invoice-action').forEach((button) => {
    button.addEventListener('click', () => {
      const invoiceId = button.dataset.invoiceId;
      const subscriptionId = button.dataset.subscriptionId;
      const action = button.dataset.action;
      if (!invoiceId || !subscriptionId || !action) return;
      handleInvoiceAction(invoiceId, subscriptionId, action);
    });
  });
}


function bindPlanosTabsEvents() {
  document.querySelectorAll('[data-planos-tab]').forEach((button) => {
    button.addEventListener('click', () => {
      const tab = button.dataset.planosTab;
      if (!PLANOS_TABS.includes(tab)) return;
      planosState.activeTab = tab;
      persistActiveTab(tab);
      rerenderPlanos();
    });
  });
}

function bindClubCommissionEvents() {
  document.getElementById('planos-club-period-select')?.addEventListener('change', (event) => {
    handleClubPeriodChange(event.target.value);
  });

  document.getElementById('planos-club-refresh-button')?.addEventListener('click', () => {
    loadClubCommissionsData({ render: true });
  });

  document.getElementById('planos-club-mark-paid-button')?.addEventListener('click', () => {
    handleMarkClubPeriodPaid();
  });
}


function bindClubRulesEvents() {
  document.getElementById('planos-rules-refresh-button')?.addEventListener('click', () => {
    loadClubRulesData({ render: true });
  });

  document.getElementById('planos-rules-settings-form')?.addEventListener('submit', handleRulesSettingsSubmit);

  document.querySelectorAll('[data-rules-preset]').forEach((button) => {
    button.addEventListener('click', () => {
      applyRulesPreset(button.dataset.rulesPreset || 'balanced');
    });
  });

  document.querySelectorAll('[data-rules-jump]').forEach((button) => {
    button.addEventListener('click', () => {
      const targetId = button.dataset.rulesJump;
      const target = targetId ? document.getElementById(targetId) : null;
      if (!target) return;
      target.scrollIntoView({ behavior: 'smooth', block: 'start' });
    });
  });

  document.getElementById('planos-rules-reset-default')?.addEventListener('click', () => {
    applyRulesPreset('balanced');
  });

  document.getElementById('planos-rules-barbershop-share')?.addEventListener('input', syncRulesRevenuePreview);
  document.getElementById('planos-rules-team-share')?.addEventListener('input', syncRulesRevenuePreview);

  document.querySelectorAll('.planos-rule-service-save').forEach((button) => {
    button.addEventListener('click', () => {
      const pointId = button.dataset.servicePointId;
      if (!pointId) return;
      handleSaveServicePoint(pointId);
    });
  });

  document.querySelectorAll('.planos-rule-plan-save').forEach((button) => {
    button.addEventListener('click', () => {
      const ruleId = button.dataset.planRuleId;
      if (!ruleId) return;
      handleSavePlanRule(ruleId);
    });
  });
}


function bindPlanosStaticEvents() {
  document.getElementById('planos-new-plan-button')?.addEventListener('click', () => {
    openCreatePlanModal();
  });

  document.getElementById('planos-new-subscription-button')?.addEventListener('click', () => {
    openCreateSubscriptionModal();
  });

  document.getElementById('planos-details-modal')?.addEventListener('click', (event) => {
    if (event.target?.id === 'planos-details-modal') {
      closePlanosModal();
    }
  });
}

function rerenderPlanos() {
  const metrics = document.getElementById('planos-metrics');
  const tabs = document.getElementById('planos-tabs-wrap');
  const plansList = document.getElementById('planos-list');
  const subscriptionsList = document.getElementById('planos-subscriptions-list');
  const clubCommissions = document.getElementById('planos-club-commissions');
  const clubRules = document.getElementById('planos-club-rules');

  if (metrics) metrics.innerHTML = renderMetrics();
  if (tabs) tabs.innerHTML = renderPlanosTabs();

  document.querySelectorAll('.planos-tab-panel').forEach((panel) => {
    const isActive = panel.dataset.planosPanel === planosState.activeTab;
    panel.hidden = !isActive;
  });

  if (plansList) {
    plansList.innerHTML = planosState.plans.length
      ? planosState.plans.map(renderPlanRow).join('')
      : renderEmptyState('Planos', 'Nenhum plano cadastrado até o momento.');
  }

  if (subscriptionsList) {
    subscriptionsList.innerHTML = planosState.subscriptions.length
      ? planosState.subscriptions.map(renderSubscriptionRow).join('')
      : renderEmptyState('Assinaturas', 'Nenhuma assinatura encontrada até o momento.');
  }

  if (clubCommissions) {
    clubCommissions.innerHTML = renderClubCommissions();
  }

  if (clubRules) {
    clubRules.innerHTML = renderClubRules();
  }

  bindPlanosTabsEvents();
  bindPlanEvents();
  bindSubscriptionEvents();
  bindClubCommissionEvents();
  bindClubRulesEvents();
}

export function renderPlanos() {
  return /* html */ `
<section class="page-shell page--planos">
  <div id="planos-metrics">
    ${renderMetrics()}
  </div>

  <div id="planos-tabs-wrap">
    ${renderPlanosTabs()}
  </div>

  <div class="planos-tab-panels">
    <div class="planos-tab-panel" data-planos-panel="planos" ${planosState.activeTab === 'planos' ? '' : 'hidden'}>
      <div class="card">
        <div class="card-header">
          <div>
            <div class="card-title">Planos</div>
            <div class="row-sub" style="margin-top:4px;">Cadastre pacotes recorrentes, limites de uso e benefícios vendidos pela barbearia.</div>
          </div>
          <button type="button" class="btn-primary-gradient" id="planos-new-plan-button">+ Novo plano</button>
        </div>

        <div id="planos-list">
          ${renderLoadingState('Planos', 'Carregando planos...')}
        </div>
      </div>
    </div>

    <div class="planos-tab-panel" data-planos-panel="assinaturas" ${planosState.activeTab === 'assinaturas' ? '' : 'hidden'}>
      <div class="card">
        <div class="card-header">
          <div>
            <div class="card-title">Assinaturas</div>
            <div class="row-sub" style="margin-top:4px;">Controle clientes ativos, cobranças, saldo de cortes e situação da recorrência.</div>
          </div>
          <button type="button" class="btn-primary-gradient" id="planos-new-subscription-button">+ Nova assinatura</button>
        </div>

        <div id="planos-subscriptions-list">
          ${renderLoadingState('Assinaturas', 'Carregando assinaturas...')}
        </div>
      </div>
    </div>

    <div class="planos-tab-panel" data-planos-panel="comissoes" ${planosState.activeTab === 'comissoes' ? '' : 'hidden'}>
      <div id="planos-club-commissions">
        ${renderLoadingState('Comissões do Clube', 'Carregando comissões por pontos...')}
      </div>
    </div>

    <div class="planos-tab-panel" data-planos-panel="regras" ${planosState.activeTab === 'regras' ? '' : 'hidden'}>
      <div id="planos-club-rules">
        ${renderLoadingState('Regras do Clube', 'Carregando parametrizações...')}
      </div>
    </div>
  </div>

  <div id="planos-details-modal" class="modal-overlay" style="display:none;">
    <div class="modal" style="width:min(92vw, 760px);">
      <div id="planos-details-content"></div>
    </div>
  </div>
</section>
  `;
}

export function initPlanosPage() {
  bindPlanosStaticEvents();
  bindPlanosTabsEvents();
  bindPlanEvents();
  bindSubscriptionEvents();
  bindClubCommissionEvents();
  bindClubRulesEvents();
  loadPlanosData();
}
