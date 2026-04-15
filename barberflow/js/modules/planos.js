import {
  hasApiConfig,
  hasAuthToken,
  getPlans,
  createPlan,
  updatePlan,
  getSubscriptions,
  createSubscription,
  getClients,
} from '../services/api.js';

const planosState = {
  plans: [],
  subscriptions: [],
  clients: [],
  isLoaded: false,
  isLoading: false,
  modalMode: 'closed', // closed | viewPlan | editPlan | createPlan | viewSubscription | createSubscription
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

function formatDateDisplay(value) {
  if (!value) return '—';

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return String(value);

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

function mapPlanFromApi(plan) {
  return {
    id: plan.id,
    name: plan.name || 'Plano sem nome',
    description: plan.description || 'Sem descrição.',
    priceCents: Number(plan.price_cents || 0),
    billingInterval: formatBillingInterval(plan.billing_interval, plan.billing_interval_count),
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

function getClientById(clientId) {
  return planosState.clients.find((item) => item.id === clientId) || null;
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
    priceCents: 4990,
    billingInterval: 'Mensal',
    includedHaircuts: 2,
    includedBeards: 0,
    signupFeeCents: 0,
    graceDays: 0,
    isActive: true,
  };

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
            <input class="modal-input" name="name" type="text" value="${escapeHtml(safePlan.name)}" placeholder="Nome do plano" />
          </div>

          <div>
            <div class="color-section-label">Preço (centavos)</div>
            <input class="modal-input" name="priceCents" type="number" min="0" value="${escapeHtml(safePlan.priceCents)}" />
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
            <input class="modal-input" name="includedHaircuts" type="number" min="0" value="${escapeHtml(safePlan.includedHaircuts)}" />
          </div>

          <div>
            <div class="color-section-label">Barbas incluídas</div>
            <input class="modal-input" name="includedBeards" type="number" min="0" value="${escapeHtml(safePlan.includedBeards)}" />
          </div>

          <div>
            <div class="color-section-label">Taxa de adesão (centavos)</div>
            <input class="modal-input" name="signupFeeCents" type="number" min="0" value="${escapeHtml(safePlan.signupFeeCents)}" />
          </div>

          <div>
            <div class="color-section-label">Carência (dias)</div>
            <input class="modal-input" name="graceDays" type="number" min="0" value="${escapeHtml(safePlan.graceDays)}" />
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
          <textarea class="modal-input planos-textarea" name="description" placeholder="Descrição do plano">${escapeHtml(safePlan.description)}</textarea>
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

function renderSubscriptionDetails(subscription) {
  const plan = getPlanById(subscription.planId);
  const statusMeta = getSubscriptionStatusMeta(subscription.status);
  const invoiceMeta = getInvoiceStatusMeta(subscription.lastInvoiceStatus);

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

async function ensureClientsLoaded() {
  if (Array.isArray(planosState.clients) && planosState.clients.length > 0) return;

  const clients = await getClients();
  planosState.clients = Array.isArray(clients) ? clients : [];
}

async function loadPlanosData() {
  const metricsEl = document.getElementById('planos-metrics');
  const plansListEl = document.getElementById('planos-list');
  const subscriptionsListEl = document.getElementById('planos-subscriptions-list');

  if (!metricsEl || !plansListEl || !subscriptionsListEl) return;

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
    return;
  }

  planosState.isLoading = true;
  metricsEl.innerHTML = '';
  plansListEl.innerHTML = renderLoadingState('Planos', 'Carregando planos...');
  subscriptionsListEl.innerHTML = renderLoadingState('Assinaturas', 'Carregando assinaturas...');

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
    priceCents: Number(formData.get('priceCents') || 0),
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

  if (!data.name) {
    setPlanFormFeedback('Informe o nome do plano.', 'error');
    return;
  }

  if (data.priceCents < 0) {
    setPlanFormFeedback('Informe um preço válido.', 'error');
    return;
  }

  const payload = {
    name: data.name,
    description: data.description,
    price_cents: data.priceCents,
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
  const plansList = document.getElementById('planos-list');
  const subscriptionsList = document.getElementById('planos-subscriptions-list');

  if (metrics) metrics.innerHTML = renderMetrics();

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

  bindPlanEvents();
  bindSubscriptionEvents();
}

export function renderPlanos() {
  return /* html */ `
<section class="page-shell page--planos">
  <div id="planos-metrics">
    ${renderMetrics()}
  </div>

  <div class="grid-2">
    <div class="card">
      <div class="card-header">
        <div class="card-title">Planos</div>
        <button type="button" class="btn-primary-gradient" id="planos-new-plan-button">+ Novo plano</button>
      </div>

      <div id="planos-list">
        ${renderLoadingState('Planos', 'Carregando planos...')}
      </div>
    </div>

    <div class="card">
      <div class="card-header">
        <div class="card-title">Assinaturas</div>
        <button type="button" class="btn-primary-gradient" id="planos-new-subscription-button">+ Nova assinatura</button>
      </div>

      <div id="planos-subscriptions-list">
        ${renderLoadingState('Assinaturas', 'Carregando assinaturas...')}
      </div>
    </div>
  </div>

  <div id="planos-details-modal" class="modal-overlay" style="display:none;">
    <div class="modal" style="width:min(92vw, 680px);">
      <div id="planos-details-content"></div>
    </div>
  </div>
</section>
  `;
}

export function initPlanosPage() {
  bindPlanosStaticEvents();
  bindPlanEvents();
  bindSubscriptionEvents();
  loadPlanosData();
}
