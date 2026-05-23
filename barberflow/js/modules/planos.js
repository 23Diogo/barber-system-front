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
} from '../services/api.js';

const PLAN_NAME_MAX_LENGTH = 100;
const PLAN_DESCRIPTION_MAX_LENGTH = 500;
const PLANOS_ACTIVE_TAB_STORAGE_KEY = 'barberflow.planos.activeTab';
const PLANOS_TABS = ['planos', 'assinaturas', 'comissoes'];

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

  return `
    <div class="planos-modal-body">
      <div>
        <div class="modal-title" style="margin:0;">${escapeHtml(plan.name)}</div>
        <div class="modal-sub" style="margin-top:4px;">Detalhes do plano</div>
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
          <div class="mini-lbl">Cortes</div>
          <div class="mini-val" style="color:#00e676">${escapeHtml(plan.includedHaircuts)}</div>
        </div>
        <div class="mini-card">
          <div class="mini-lbl">Barbas</div>
          <div class="mini-val" style="color:#9c6fff">${escapeHtml(plan.includedBeards)}</div>
        </div>
      </div>

      <div class="planos-modal-info">
        <div class="planos-modal-info-row">
          <strong>Status:</strong> <span class="${statusClass}">${escapeHtml(plan.isActive ? 'Ativo' : 'Inativo')}</span>
        </div>
        <div class="planos-modal-info-row">
          <strong>Taxa de adesão:</strong> ${escapeHtml(formatCurrencyFromCents(plan.signupFeeCents))}
        </div>
        <div class="planos-modal-info-row">
          <strong>Carência:</strong> ${escapeHtml(`${plan.graceDays} dias`)}
        </div>
        <div class="planos-modal-info-row">
          <strong>Assinantes:</strong> ${escapeHtml(String(plan.subscribersCount))}
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
    includedHaircuts: 2,
    includedBeards: 0,
    signupFeeCents: 0,
    graceDays: 0,
    isActive: true,
  };

  const safePrice =
    safePlan.raw?.price != null
      ? Number(safePlan.raw.price)
      : safePlan.price != null
        ? Number(safePlan.price)
        : Number(safePlan.priceCents || 0) / 100;

  return `
    <div class="planos-modal-body">
      <div>
        <div class="modal-title" style="margin:0;">${isEdit ? 'Editar plano' : 'Novo plano'}</div>
        <div class="modal-sub" style="margin-top:4px;">
          ${isEdit ? 'Atualize os dados do plano.' : 'Preencha os dados para criar um novo plano.'}
        </div>
      </div>

      <form id="planos-form" class="planos-form">
        <div class="planos-form-grid">
          <div>
            <div class="color-section-label">Nome</div>
            <input
              class="modal-input"
              id="planos-plan-name"
              name="name"
              type="text"
              value="${escapeHtml(safePlan.name)}"
              placeholder="Nome do plano"
              maxlength="${PLAN_NAME_MAX_LENGTH}"
            />
            <div style="display:flex;justify-content:flex-end;margin-top:6px;font-size:10px;color:#5a6888;">
              <span id="planos-plan-name-counter">0 / ${PLAN_NAME_MAX_LENGTH}</span>
            </div>
          </div>

          <div>
            <div class="color-section-label">Preço (formato: 69,90)</div>
            <input
              class="modal-input"
              id="planos-price"
              name="price"
              type="text"
              inputmode="decimal"
              value="${escapeHtml(formatMoneyInputValue(safePrice))}"
              placeholder="Ex.: 69,90"
            />
            <div style="display:flex;justify-content:space-between;gap:12px;margin-top:6px;font-size:10px;color:#5a6888;">
              <span>Aceita apenas números e vírgula</span>
              <span>numeric</span>
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
            <div class="color-section-label">Cortes incluídos</div>
            <input class="modal-input" name="includedHaircuts" type="number" min="0" step="1" value="${escapeHtml(safePlan.includedHaircuts)}" />
          </div>

          <div>
            <div class="color-section-label">Barbas incluídas</div>
            <input class="modal-input" name="includedBeards" type="number" min="0" step="1" value="${escapeHtml(safePlan.includedBeards)}" />
          </div>

          <div>
            <div class="color-section-label">Taxa de adesão (centavos inteiros)</div>
            <input class="modal-input" name="signupFeeCents" type="number" min="0" step="1" value="${escapeHtml(safePlan.signupFeeCents)}" />
          </div>

          <div>
            <div class="color-section-label">Carência (dias)</div>
            <input class="modal-input" name="graceDays" type="number" min="0" step="1" value="${escapeHtml(safePlan.graceDays)}" />
          </div>

          <div>
            <div class="color-section-label">Status</div>
            <select class="modal-input" name="isActive">
              <option value="true" ${safePlan.isActive ? 'selected' : ''}>Ativo</option>
              <option value="false" ${!safePlan.isActive ? 'selected' : ''}>Inativo</option>
            </select>
          </div>
        </div>

        <div>
          <div class="color-section-label">Descrição</div>
          <textarea
            class="modal-input planos-textarea"
            id="planos-plan-description"
            name="description"
            placeholder="Descrição do plano"
            maxlength="${PLAN_DESCRIPTION_MAX_LENGTH}"
          >${escapeHtml(safePlan.description)}</textarea>
          <div style="display:flex;justify-content:flex-end;margin-top:6px;font-size:10px;color:#5a6888;">
            <span id="planos-plan-description-counter">0 / ${PLAN_DESCRIPTION_MAX_LENGTH}</span>
          </div>
        </div>

        <div id="planos-form-feedback" class="planos-form-feedback"></div>

        <div class="modal-buttons" style="margin-top:10px;">
          <button type="button" class="btn-cancel" id="${isEdit ? 'planos-form-back' : 'planos-form-cancel'}">
            ${isEdit ? 'Voltar' : 'Cancelar'}
          </button>
          <button type="submit" class="btn-save">
            ${isEdit ? 'Salvar alterações' : 'Criar plano'}
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

async function loadPlanosData() {
  const metricsEl = document.getElementById('planos-metrics');
  const plansListEl = document.getElementById('planos-list');
  const subscriptionsListEl = document.getElementById('planos-subscriptions-list');
  const clubCommissionsEl = document.getElementById('planos-club-commissions');

  if (!metricsEl || !plansListEl || !subscriptionsListEl || !clubCommissionsEl) return;

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
    return;
  }

  planosState.isLoading = true;
  metricsEl.innerHTML = '';
  plansListEl.innerHTML = renderLoadingState('Planos', 'Carregando planos...');
  subscriptionsListEl.innerHTML = renderLoadingState('Assinaturas', 'Carregando assinaturas...');
  clubCommissionsEl.innerHTML = renderLoadingState('Comissões do Clube', 'Carregando comissões por pontos...');

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

    await loadClubCommissionsData({ render: false });

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

  return {
    name: String(formData.get('name') || '').trim(),
    description: String(formData.get('description') || '').trim(),
    priceInput: String(formData.get('price') || '').trim(),
    billingInterval: String(formData.get('billingInterval') || 'Mensal').trim(),
    includedHaircuts: Number(formData.get('includedHaircuts') || 0),
    includedBeards: Number(formData.get('includedBeards') || 0),
    signupFeeCents: Number(formData.get('signupFeeCents') || 0),
    graceDays: Number(formData.get('graceDays') || 0),
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
    await loadClubCommissionsData({ render: false });
    rerenderPlanos();
  } catch (error) {
    planosState.clubError = error instanceof Error
      ? error.message
      : 'Não foi possível marcar o fechamento como pago.';
    planosState.clubIsLoading = false;
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

  bindPlanosTabsEvents();
  bindPlanEvents();
  bindSubscriptionEvents();
  bindClubCommissionEvents();
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
  loadPlanosData();
}
