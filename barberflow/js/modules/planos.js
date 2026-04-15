const planosState = {
  plans: [
    {
      id: 'black-mensal',
      name: 'Plano Black Mensal',
      description: '4 cortes por mês com prioridade no agendamento.',
      priceCents: 8990,
      billingInterval: 'Mensal',
      includedHaircuts: 4,
      includedBeards: 0,
      signupFeeCents: 0,
      graceDays: 3,
      isActive: true,
      subscribersCount: 12,
    },
    {
      id: 'premium-completo',
      name: 'Plano Premium Completo',
      description: '4 cortes + 2 barbas por mês.',
      priceCents: 12990,
      billingInterval: 'Mensal',
      includedHaircuts: 4,
      includedBeards: 2,
      signupFeeCents: 1990,
      graceDays: 5,
      isActive: true,
      subscribersCount: 7,
    },
    {
      id: 'essencial',
      name: 'Plano Essencial',
      description: '2 cortes por mês para clientes recorrentes.',
      priceCents: 4990,
      billingInterval: 'Mensal',
      includedHaircuts: 2,
      includedBeards: 0,
      signupFeeCents: 0,
      graceDays: 2,
      isActive: false,
      subscribersCount: 3,
    },
  ],
  subscriptions: [
    {
      id: 'sub-rafael',
      clientName: 'Rafael Souza',
      planId: 'black-mensal',
      status: 'active',
      nextBillingAt: '20/04/2026',
      paymentMethod: 'Pix',
      remainingHaircuts: 3,
      remainingBeards: 0,
      lastInvoiceStatus: 'paid',
    },
    {
      id: 'sub-carlos',
      clientName: 'Carlos Mendes',
      planId: 'premium-completo',
      status: 'past_due',
      nextBillingAt: '18/04/2026',
      paymentMethod: 'Cartão',
      remainingHaircuts: 1,
      remainingBeards: 1,
      lastInvoiceStatus: 'failed',
    },
    {
      id: 'sub-bruno',
      clientName: 'Bruno Alves',
      planId: 'black-mensal',
      status: 'active',
      nextBillingAt: '25/04/2026',
      paymentMethod: 'Pix',
      remainingHaircuts: 2,
      remainingBeards: 0,
      lastInvoiceStatus: 'paid',
    },
  ],
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

function getPlanById(planId) {
  return planosState.plans.find((item) => item.id === planId) || null;
}

function getSubscriptionById(subscriptionId) {
  return planosState.subscriptions.find((item) => item.id === subscriptionId) || null;
}

function normalizeId(value) {
  const base = String(value || 'novo-plano')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '') || 'novo-plano';

  let candidate = base;
  let counter = 2;

  while (
    planosState.plans.some((item) => item.id === candidate) ||
    planosState.subscriptions.some((item) => item.id === candidate)
  ) {
    candidate = `${base}-${counter}`;
    counter += 1;
  }

  return candidate;
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
  };

  return map[status] || map.active;
}

function getInvoiceStatusMeta(status) {
  const map = {
    paid: { label: 'Pago', color: '#00e676' },
    failed: { label: 'Falhou', color: '#ff1744' },
    pending: { label: 'Pendente', color: '#f97316' },
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
        </div>

        <div class="planos-row-side">
          <div class="${statusClass}">${statusText}</div>
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
          <div class="planos-row-sub">
            ${escapeHtml(plan?.name || 'Plano não encontrado')} · Próxima cobrança ${escapeHtml(subscription.nextBillingAt)}
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
        <button type="button" class="btn-save" id="planos-edit-button" data-plan-id="${escapeHtml(plan.id)}">Editar plano</button>
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
          <div class="mini-val" style="font-size:15px;">${escapeHtml(plan?.name || '—')}</div>
        </div>
        <div class="mini-card">
          <div class="mini-lbl">Status</div>
          <div class="mini-val" style="font-size:15px;color:${statusMeta.color}">${escapeHtml(statusMeta.label)}</div>
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
          <strong>Última cobrança:</strong> <span style="color:${invoiceMeta.color};font-weight:700;">${escapeHtml(invoiceMeta.label)}</span>
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
        <div class="modal-sub" style="margin-top:4px;">Preencha os dados para criar uma assinatura no painel do dono.</div>
      </div>

      <form id="planos-subscription-form" class="planos-form">
        <div class="planos-form-grid">
          <div>
            <div class="color-section-label">Cliente</div>
            <input class="modal-input" name="clientName" type="text" placeholder="Nome do cliente" />
          </div>

          <div>
            <div class="color-section-label">Plano</div>
            <select class="modal-input" name="planId">
              ${planosState.plans.map((plan) => `<option value="${escapeHtml(plan.id)}">${escapeHtml(plan.name)}</option>`).join('')}
            </select>
          </div>

          <div>
            <div class="color-section-label">Status</div>
            <select class="modal-input" name="status">
              <option value="active">Ativa</option>
              <option value="past_due">Inadimplente</option>
              <option value="paused">Pausada</option>
              <option value="canceled">Cancelada</option>
            </select>
          </div>

          <div>
            <div class="color-section-label">Próxima cobrança</div>
            <input class="modal-input" name="nextBillingAt" type="text" placeholder="Ex.: 20/04/2026" />
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
            <div class="color-section-label">Saldo de cortes</div>
            <input class="modal-input" name="remainingHaircuts" type="number" min="0" value="0" />
          </div>

          <div>
            <div class="color-section-label">Saldo de barbas</div>
            <input class="modal-input" name="remainingBeards" type="number" min="0" value="0" />
          </div>

          <div>
            <div class="color-section-label">Última cobrança</div>
            <select class="modal-input" name="lastInvoiceStatus">
              <option value="paid">Pago</option>
              <option value="pending">Pendente</option>
              <option value="failed">Falhou</option>
            </select>
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

function openCreateSubscriptionModal() {
  planosState.activeSubscriptionId = null;
  planosState.activePlanId = null;
  planosState.modalMode = 'createSubscription';
  renderPlanosModal();
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

function handlePlanFormSubmit(event) {
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

  if (planosState.modalMode === 'createPlan') {
    const newPlan = {
      id: normalizeId(data.name),
      ...data,
      subscribersCount: 0,
    };

    planosState.plans = [newPlan, ...planosState.plans];
    rerenderPlanos();
    openPlanModal(newPlan.id);
    return;
  }

  if (planosState.modalMode === 'editPlan' && planosState.activePlanId) {
    planosState.plans = planosState.plans.map((item) => {
      if (item.id !== planosState.activePlanId) return item;
      return { ...item, ...data };
    });

    rerenderPlanos();
    openPlanModal(planosState.activePlanId);
  }
}

function collectSubscriptionFormData() {
  const form = document.getElementById('planos-subscription-form');
  const formData = new FormData(form);

  return {
    clientName: String(formData.get('clientName') || '').trim(),
    planId: String(formData.get('planId') || '').trim(),
    status: String(formData.get('status') || 'active').trim(),
    nextBillingAt: String(formData.get('nextBillingAt') || '').trim(),
    paymentMethod: String(formData.get('paymentMethod') || 'Pix').trim(),
    remainingHaircuts: Number(formData.get('remainingHaircuts') || 0),
    remainingBeards: Number(formData.get('remainingBeards') || 0),
    lastInvoiceStatus: String(formData.get('lastInvoiceStatus') || 'paid').trim(),
  };
}

function handleSubscriptionFormSubmit(event) {
  event.preventDefault();

  const data = collectSubscriptionFormData();

  if (!data.clientName) {
    setSubscriptionFormFeedback('Informe o nome do cliente.', 'error');
    return;
  }

  if (!data.planId) {
    setSubscriptionFormFeedback('Selecione um plano.', 'error');
    return;
  }

  if (!data.nextBillingAt) {
    setSubscriptionFormFeedback('Informe a próxima cobrança.', 'error');
    return;
  }

  const newSubscription = {
    id: normalizeId(`${data.clientName}-${data.planId}`),
    ...data,
  };

  planosState.subscriptions = [newSubscription, ...planosState.subscriptions];
  planosState.plans = planosState.plans.map((plan) => {
    if (plan.id !== data.planId) return plan;
    return { ...plan, subscribersCount: plan.subscribersCount + 1 };
  });

  rerenderPlanos();
  openSubscriptionModal(newSubscription.id);
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
  document.getElementById('planos-new-plan-button')?.addEventListener('click', openCreatePlanModal);
  document.getElementById('planos-new-subscription-button')?.addEventListener('click', openCreateSubscriptionModal);

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
  if (plansList) plansList.innerHTML = planosState.plans.map(renderPlanRow).join('');
  if (subscriptionsList) subscriptionsList.innerHTML = planosState.subscriptions.map(renderSubscriptionRow).join('');

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
        ${planosState.plans.map(renderPlanRow).join('')}
      </div>
    </div>

    <div class="card">
      <div class="card-header">
        <div class="card-title">Assinaturas</div>
        <button type="button" class="btn-primary-gradient" id="planos-new-subscription-button">+ Nova assinatura</button>
      </div>

      <div id="planos-subscriptions-list">
        ${planosState.subscriptions.map(renderSubscriptionRow).join('')}
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
}
