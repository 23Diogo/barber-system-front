import {
  getClientPortalSubscription,
  cancelClientPortalPendingSubscription,
} from '../../services/client-auth.js';

const state = {
  subscription: null,
  currentCycle: null,
  latestInvoice: null,
  returnFeedback: null,
};

function escapeHtml(value) {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

function formatCurrency(value) {
  return new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL',
  }).format(Number(value || 0));
}

function formatDate(value) {
  if (!value) return '-';

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) return '-';

  return date.toLocaleDateString('pt-BR', {
    timeZone: 'America/Sao_Paulo',
  });
}

function formatDateTime(value) {
  if (!value) return '-';

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) return '-';

  return date.toLocaleString('pt-BR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    timeZone: 'America/Sao_Paulo',
  });
}

function translateStatus(status) {
  const map = {
    active: 'Ativo',
    trialing: 'Em teste',
    pending_activation: 'Aguardando pagamento',
    pending: 'Pendente',
    past_due: 'Pagamento pendente',
    paused: 'Pausado',
    canceled: 'Cancelado',
    cancelled: 'Cancelado',
    expired: 'Expirado',
    paid: 'Pago',
    failed: 'Falhou',
    open: 'Aberta',
    created: 'Criada',
    authorized: 'Autorizado',
  };

  return map[String(status || '').toLowerCase()] || status || '-';
}

function getPlanPrice(plan) {
  if (plan?.price != null) return Number(plan.price || 0);
  if (plan?.price_cents != null) return Number(plan.price_cents || 0) / 100;
  return 0;
}

function getInvoiceAmount(invoice) {
  if (invoice?.amount_cents != null) return Number(invoice.amount_cents || 0) / 100;
  if (invoice?.total_cents != null) return Number(invoice.total_cents || 0) / 100;
  if (invoice?.amount != null) return Number(invoice.amount || 0);
  return 0;
}

function getInvoicePaymentUrl(invoice) {
  return (
    invoice?.payment_url ||
    invoice?.paymentUrl ||
    invoice?.checkout_url ||
    invoice?.checkoutUrl ||
    invoice?.init_point ||
    invoice?.initPoint ||
    ''
  );
}

function isPendingSubscriptionStatus(status) {
  return ['pending_activation', 'pending', 'past_due'].includes(String(status || '').toLowerCase());
}

function isPendingInvoiceStatus(status) {
  return ['pending', 'open', 'created', 'authorized', 'failed', 'past_due'].includes(String(status || '').toLowerCase());
}

function isPaidStatus(status) {
  return ['paid', 'active', 'approved', 'authorized'].includes(String(status || '').toLowerCase());
}

function getInvoices() {
  return Array.isArray(state.subscription?.subscription_invoices)
    ? [...state.subscription.subscription_invoices].sort((a, b) => {
      return new Date(b?.created_at || b?.due_at || 0).getTime() -
        new Date(a?.created_at || a?.due_at || 0).getTime();
    })
    : [];
}

function getPendingInvoice() {
  return getInvoices().find((invoice) => isPendingInvoiceStatus(invoice?.status)) || null;
}

function noCreditsUsed() {
  const cycle = state.currentCycle;

  if (!cycle) return true;

  const haircuts =
    Number(cycle.remaining_haircuts ?? 0) === Number(cycle.included_haircuts ?? 0) &&
    Number(cycle.reserved_haircuts ?? 0) === 0 &&
    Number(cycle.consumed_haircuts ?? 0) === 0;

  const beards =
    Number(cycle.remaining_beards ?? 0) === Number(cycle.included_beards ?? 0) &&
    Number(cycle.reserved_beards ?? 0) === 0 &&
    Number(cycle.consumed_beards ?? 0) === 0;

  const services = Array.isArray(cycle.subscription_cycle_service_balances)
    ? cycle.subscription_cycle_service_balances.every((balance) => {
      return (
        Number(balance.remaining_quantity ?? 0) === Number(balance.included_quantity ?? 0) &&
        Number(balance.reserved_quantity ?? 0) === 0 &&
        Number(balance.consumed_quantity ?? 0) === 0
      );
    })
    : true;

  return haircuts && beards && services;
}

function setFeedback(message, variant = 'neutral') {
  ['client-assinatura-feedback', 'client-assinatura-empty-feedback'].forEach((id) => {
    const el = document.getElementById(id);

    if (!el) return;

    el.textContent = message || '';
    el.className = `client-feedback ${
      variant === 'error'
        ? 'is-error'
        : variant === 'success'
          ? 'is-success'
          : ''
    }`;
  });
}

function goToClientRoute(route) {
  const path = `/client/${route}`;

  window.history.pushState({ clientRoute: route }, '', path);
  window.dispatchEvent(new PopStateEvent('popstate'));
}

function resolveReturnFeedback() {
  const params = new URLSearchParams(window.location.search);

  if (!params.toString()) return null;

  const collectionStatus = String(
    params.get('collection_status') ||
    params.get('status') ||
    params.get('preapproval_status') ||
    ''
  ).toLowerCase();

  const paymentId = String(
    params.get('payment_id') ||
    params.get('collection_id') ||
    params.get('preapproval_id') ||
    ''
  ).trim();

  const hasReturnParams =
    params.has('collection_status') ||
    params.has('collection_id') ||
    params.has('payment_id') ||
    params.has('preapproval_id') ||
    params.has('preapproval_status') ||
    params.has('status');

  window.history.replaceState({ clientRoute: 'assinatura' }, '', '/client/assinatura');

  if (!hasReturnParams) return null;

  if (['approved', 'authorized', 'active'].includes(collectionStatus)) {
    return {
      message: 'Pagamento aprovado. Confirmando seu plano...',
      variant: 'success',
      shouldPoll: true,
    };
  }

  if (['pending', 'in_process', 'pending_authorization'].includes(collectionStatus)) {
    return {
      message: 'Pagamento pendente de confirmação. Atualizando...',
      variant: 'neutral',
      shouldPoll: true,
    };
  }

  if (['rejected', 'cancelled', 'canceled', 'cancelled_by_user', 'failed'].includes(collectionStatus)) {
    return {
      message: 'Pagamento não concluído. Tente novamente ou cancele a contratação.',
      variant: 'error',
      shouldPoll: false,
    };
  }

  if (paymentId || collectionStatus === 'null' || !collectionStatus) {
    return {
      message: 'Pagamento ainda não concluído. Atualize o status em alguns instantes.',
      variant: 'neutral',
      shouldPoll: true,
    };
  }

  return null;
}

async function fetchSubscriptionState() {
  const payload = await getClientPortalSubscription();

  state.subscription = payload?.subscription || null;
  state.currentCycle = payload?.currentCycle || null;
  state.latestInvoice = payload?.latestInvoice || null;
}

function renderTopActions() {
  const container = document.getElementById('client-assinatura-actions');

  if (!container) return;

  const subscription = state.subscription;
  const pendingInvoice = getPendingInvoice();
  const paymentUrl = getInvoicePaymentUrl(pendingInvoice);
  const canCancel = isPendingSubscriptionStatus(subscription?.status) && noCreditsUsed();

  container.innerHTML = `
    <div style="display:flex;gap:12px;flex-wrap:wrap;justify-content:flex-end;">
      ${
        paymentUrl
          ? `
            <a
              href="${escapeHtml(paymentUrl)}"
              style="
                min-height:46px;
                padding:0 16px;
                border-radius:12px;
                border:0;
                background:linear-gradient(135deg,#5dc8ff 0%,#2f8cff 55%,#1468ff 100%);
                color:#fff;
                font:inherit;
                font-weight:800;
                text-decoration:none;
                display:inline-flex;
                align-items:center;
                justify-content:center;
              "
            >
              Pagar agora
            </a>
          `
          : ''
      }

      <button
        type="button"
        id="client-refresh-subscription-btn"
        style="
          min-height:46px;
          padding:0 16px;
          border-radius:12px;
          border:1px solid rgba(79,195,247,.20);
          background:rgba(79,195,247,.08);
          color:#7dd3fc;
          font:inherit;
          font-weight:800;
          cursor:pointer;
        "
      >
        Atualizar status
      </button>

      ${
        canCancel
          ? `
            <button
              type="button"
              id="client-cancel-pending-subscription-btn"
              style="
                min-height:46px;
                padding:0 16px;
                border-radius:12px;
                border:1px solid rgba(255,82,82,.20);
                background:rgba(255,82,82,.08);
                color:#ff8a80;
                font:inherit;
                font-weight:800;
                cursor:pointer;
              "
            >
              Cancelar contratação
            </button>
          `
          : ''
      }
    </div>
  `;
}

function renderHeader() {
  const container = document.getElementById('client-assinatura-header');

  if (!container) return;

  const subscription = state.subscription || {};
  const plan = subscription?.plans || {};

  container.innerHTML = `
    <div class="metric-card">
      <div class="metric-label">Plano</div>
      <div class="metric-value" style="font-size:18px;">${escapeHtml(plan?.name || 'Sem plano')}</div>
      <div class="metric-sub color-nt">Assinatura atual</div>
    </div>

    <div class="metric-card">
      <div class="metric-label">Status</div>
      <div class="metric-value" style="font-size:18px;">${escapeHtml(translateStatus(subscription?.status))}</div>
      <div class="metric-sub color-nt">Situação da assinatura</div>
    </div>

    <div class="metric-card">
      <div class="metric-label">Valor do plano</div>
      <div class="metric-value" style="font-size:18px;">${escapeHtml(formatCurrency(getPlanPrice(plan)))}</div>
      <div class="metric-sub color-nt">Cobrança recorrente</div>
    </div>
  `;

  const period = document.getElementById('client-assinatura-period');

  if (!period) return;

  period.innerHTML = `
    <div class="cfg-row">
      <div>
        <div class="cfg-label">Período atual</div>
        <div class="cfg-sub">${escapeHtml(formatDate(subscription?.current_period_start))} até ${escapeHtml(formatDate(subscription?.current_period_end))}</div>
      </div>
      <span class="pill">Período</span>
    </div>

    <div class="cfg-row">
      <div>
        <div class="cfg-label">Próxima cobrança</div>
        <div class="cfg-sub">${escapeHtml(formatDate(subscription?.next_billing_at || subscription?.next_charge_at))}</div>
      </div>
      <span class="pill">Cobrança</span>
    </div>

    ${
      state.latestInvoice
        ? `
          <div class="cfg-row">
            <div>
              <div class="cfg-label">Última fatura</div>
              <div class="cfg-sub">${escapeHtml(translateStatus(state.latestInvoice.status))} - ${escapeHtml(formatCurrency(getInvoiceAmount(state.latestInvoice)))}</div>
            </div>
            <span class="pill">Fatura</span>
          </div>
        `
        : ''
    }
  `;
}

function renderCreditBar(remaining, included, color) {
  const pct = included > 0
    ? Math.max(0, Math.min(100, (Number(remaining) / Number(included)) * 100))
    : 0;

  return `
    <div
      style="
        width:100%;
        height:8px;
        border-radius:999px;
        background:rgba(255,255,255,.08);
        overflow:hidden;
        margin-top:10px;
      "
    >
      <div
        style="
          width:${pct}%;
          height:100%;
          border-radius:999px;
          background:${color};
        "
      ></div>
    </div>
  `;
}

function renderBalances() {
  const container = document.getElementById('client-assinatura-balances');

  if (!container) return;

  const cycle = state.currentCycle;
  const serviceBalances = Array.isArray(cycle?.subscription_cycle_service_balances)
    ? cycle.subscription_cycle_service_balances
    : [];

  const remainingHaircuts = Number(cycle?.remaining_haircuts ?? 0);
  const includedHaircuts = Number(cycle?.included_haircuts ?? 0);
  const reservedHaircuts = Number(cycle?.reserved_haircuts ?? 0);
  const consumedHaircuts = Number(cycle?.consumed_haircuts ?? 0);

  const remainingBeards = Number(cycle?.remaining_beards ?? 0);
  const includedBeards = Number(cycle?.included_beards ?? 0);
  const reservedBeards = Number(cycle?.reserved_beards ?? 0);
  const consumedBeards = Number(cycle?.consumed_beards ?? 0);

  if (!cycle) {
    container.innerHTML = `
      <div class="cfg-row">
        <div>
          <div class="cfg-label">Nenhum ciclo encontrado</div>
          <div class="cfg-sub">Assim que o pagamento for confirmado, os créditos do plano aparecerão aqui.</div>
        </div>
        <span class="pill">Ciclo</span>
      </div>
    `;
    return;
  }

  container.innerHTML = `
    <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(240px,1fr));gap:14px;">
      <div class="metric-card">
        <div class="metric-label">Cortes restantes</div>
        <div class="metric-value">${escapeHtml(String(remainingHaircuts))}</div>
        <div class="metric-sub color-nt">de ${escapeHtml(String(includedHaircuts))} incluídos</div>
        ${renderCreditBar(remainingHaircuts, includedHaircuts, '#2f8cff')}
        <div class="metric-sub color-nt" style="margin-top:8px;">Reservados: ${escapeHtml(String(reservedHaircuts))} | Usados: ${escapeHtml(String(consumedHaircuts))}</div>
      </div>

      <div class="metric-card">
        <div class="metric-label">Barbas restantes</div>
        <div class="metric-value">${escapeHtml(String(remainingBeards))}</div>
        <div class="metric-sub color-nt">de ${escapeHtml(String(includedBeards))} incluídas</div>
        ${renderCreditBar(remainingBeards, includedBeards, '#f59e0b')}
        <div class="metric-sub color-nt" style="margin-top:8px;">Reservadas: ${escapeHtml(String(reservedBeards))} | Usadas: ${escapeHtml(String(consumedBeards))}</div>
      </div>
    </div>

    ${
      serviceBalances.length
        ? `
          <div style="display:grid;gap:10px;margin-top:12px;">
            ${serviceBalances.map((item) => {
              const service = Array.isArray(item?.services) ? item.services[0] : item?.services;
              const remaining = Number(item?.remaining_quantity ?? 0);
              const included = Number(item?.included_quantity ?? 0);
              const reserved = Number(item?.reserved_quantity ?? 0);
              const consumed = Number(item?.consumed_quantity ?? 0);

              return `
                <div class="cfg-row">
                  <div>
                    <div class="cfg-label">${escapeHtml(service?.name || 'Serviço')}</div>
                    <div class="cfg-sub">${escapeHtml(String(remaining))} restante(s) de ${escapeHtml(String(included))}. Reservados: ${escapeHtml(String(reserved))} | Usados: ${escapeHtml(String(consumed))}</div>
                    ${renderCreditBar(remaining, included, '#10b981')}
                  </div>
                  <span class="pill">Serviço</span>
                </div>
              `;
            }).join('')}
          </div>
        `
        : `
          <div class="cfg-row" style="margin-top:12px;">
            <div>
              <div class="cfg-label">Saldos por serviço</div>
              <div class="cfg-sub">Nenhum saldo específico por serviço neste ciclo.</div>
            </div>
            <span class="pill">Ciclo</span>
          </div>
        `
    }
  `;
}

function renderInvoices() {
  const container = document.getElementById('client-assinatura-invoices');

  if (!container) return;

  const invoices = getInvoices();

  if (!invoices.length) {
    container.innerHTML = `
      <div class="cfg-row">
        <div>
          <div class="cfg-label">Nenhuma cobrança encontrada</div>
          <div class="cfg-sub">Quando houver cobranças do plano, elas aparecerão aqui.</div>
        </div>
        <span class="pill">Financeiro</span>
      </div>
    `;
    return;
  }

  container.innerHTML = `
    <div style="display:grid;gap:12px;">
      ${invoices.map((invoice) => {
        const reason = invoice?.billing_reason === 'signup'
          ? 'Adesão ao plano'
          : invoice?.billing_reason === 'recurring'
            ? 'Mensalidade'
            : 'Cobrança do plano';

        const paymentUrl = getInvoicePaymentUrl(invoice);
        const invoiceStatus = String(invoice?.status || '').toLowerCase();

        return `
          <div style="border:1px solid rgba(79,195,247,.12);border-radius:16px;background:rgba(255,255,255,.03);padding:14px;display:grid;gap:10px;">
            <div style="display:flex;justify-content:space-between;gap:12px;align-items:flex-start;flex-wrap:wrap;">
              <div>
                <div style="font-size:15px;font-weight:800;color:#fff;">${escapeHtml(reason)}</div>
                <div style="margin-top:4px;color:#8fa3c7;">Vencimento: ${escapeHtml(formatDate(invoice?.due_at))}</div>
              </div>
              <span class="pill">${escapeHtml(translateStatus(invoice?.status))}</span>
            </div>

            <div class="cfg-row">
              <div>
                <div class="cfg-label">Valor</div>
                <div class="cfg-sub">${escapeHtml(formatCurrency(getInvoiceAmount(invoice)))}</div>
              </div>
              <span class="pill">Fatura</span>
            </div>

            ${
              invoice?.paid_at
                ? `
                  <div class="cfg-row">
                    <div>
                      <div class="cfg-label">Pagamento confirmado</div>
                      <div class="cfg-sub">${escapeHtml(formatDateTime(invoice.paid_at))}</div>
                    </div>
                    <span class="pill">Pago</span>
                  </div>
                `
                : ''
            }

            ${
              paymentUrl && isPendingInvoiceStatus(invoiceStatus)
                ? `
                  <div style="display:flex;justify-content:flex-end;">
                    <a
                      href="${escapeHtml(paymentUrl)}"
                      style="
                        min-height:42px;
                        padding:0 16px;
                        border-radius:12px;
                        background:linear-gradient(135deg,#5dc8ff,#1468ff);
                        color:#fff;
                        font:inherit;
                        font-weight:800;
                        text-decoration:none;
                        display:inline-flex;
                        align-items:center;
                      "
                    >
                      Pagar agora
                    </a>
                  </div>
                `
                : ''
            }

            ${
              ['canceled', 'cancelled'].includes(invoiceStatus)
                ? `
                  <div class="cfg-row">
                    <div>
                      <div class="cfg-label">Situação</div>
                      <div class="cfg-sub">Esta cobrança foi cancelada e permanece no histórico.</div>
                    </div>
                    <span class="pill">Histórico</span>
                  </div>
                `
                : ''
            }
          </div>
        `;
      }).join('')}
    </div>
  `;
}

function renderEmptyState() {
  const wrapper = document.getElementById('client-assinatura-empty');
  const content = document.getElementById('client-assinatura-content');

  if (!wrapper || !content) return;

  wrapper.style.display = 'block';
  content.style.display = 'none';

  wrapper.innerHTML = `
    <div class="card">
      <div class="card-header">
        <div class="card-title">Meu plano</div>
      </div>

      <div id="client-assinatura-empty-feedback" style="min-height:20px;margin-bottom:14px;color:#8fa3c7;"></div>

      <div class="cfg-row">
        <div>
          <div class="cfg-label">Nenhum plano ativo</div>
          <div class="cfg-sub">Você ainda não possui um plano ativo nesta barbearia.</div>
        </div>
        <span class="pill">Sem assinatura</span>
      </div>

      <div style="display:flex;justify-content:flex-end;margin-top:14px;">
        <button
          type="button"
          id="client-go-planos-btn"
          style="
            min-height:44px;
            padding:0 16px;
            border-radius:12px;
            border:0;
            background:linear-gradient(135deg,#5dc8ff,#1468ff);
            color:#fff;
            font:inherit;
            font-weight:800;
            cursor:pointer;
          "
        >
          Contratar plano
        </button>
      </div>
    </div>
  `;

  document.getElementById('client-go-planos-btn')?.addEventListener('click', () => {
    goToClientRoute('planos');
  });
}

function renderContent() {
  const wrapper = document.getElementById('client-assinatura-empty');
  const content = document.getElementById('client-assinatura-content');

  if (!wrapper || !content) return;

  wrapper.style.display = 'none';
  content.style.display = 'grid';

  renderHeader();
  renderTopActions();
  renderBalances();
  renderInvoices();
  bindActions();
}

async function loadSubscription({ preserveMessage = true } = {}) {
  await fetchSubscriptionState();

  if (!state.subscription) {
    renderEmptyState();

    if (!preserveMessage) {
      setFeedback('Nenhuma assinatura encontrada.', 'neutral');
    }

    return;
  }

  renderContent();

  if (!preserveMessage) {
    setFeedback('Sua assinatura foi carregada.', 'neutral');
  }
}

async function refreshSubscriptionStatusWithFeedback() {
  try {
    setFeedback('Atualizando status do pagamento...', 'neutral');
    await loadSubscription({ preserveMessage: true });
    setFeedback('Status atualizado.', 'success');
  } catch (error) {
    setFeedback(
      error instanceof Error ? error.message : 'Não foi possível atualizar o status.',
      'error'
    );
  }
}

async function pollAfterMercadoPagoReturn() {
  if (!state.returnFeedback?.shouldPoll) return;

  const maxAttempts = 15;
  const delayMs = 3000;

  for (let attempt = 0; attempt < maxAttempts; attempt += 1) {
    await loadSubscription({ preserveMessage: true });

    const subscriptionStatus = String(state.subscription?.status || '').toLowerCase();
    const invoice = state.latestInvoice || getInvoices()[0] || null;
    const invoiceStatus = String(invoice?.status || '').toLowerCase();

    if (
      ['active', 'trialing'].includes(subscriptionStatus) ||
      isPaidStatus(invoiceStatus)
    ) {
      setFeedback('Plano confirmado com sucesso.', 'success');
      return;
    }

    await new Promise((resolve) => setTimeout(resolve, delayMs));
  }

  setFeedback('Ainda estamos aguardando a confirmação do pagamento. Atualize novamente em alguns instantes.', 'neutral');
}

async function handleCancelPendingSubscription() {
  const confirmed = window.confirm(
    'Tem certeza que deseja cancelar esta contratação pendente? O histórico será mantido, mas o plano não ficará mais reservado.'
  );

  if (!confirmed) return;

  const reason = window.prompt(
    'Informe um motivo curto para o cancelamento (opcional):',
    'Contratação cancelada pelo cliente'
  );

  if (reason === null) return;

  try {
    const btn = document.getElementById('client-cancel-pending-subscription-btn');

    if (btn) btn.disabled = true;

    setFeedback('Cancelando contratação pendente...', 'neutral');

    await cancelClientPortalPendingSubscription(reason);

    state.subscription = null;
    state.currentCycle = null;
    state.latestInvoice = null;

    renderEmptyState();

    setFeedback('Contratação cancelada com sucesso. O histórico foi preservado.', 'success');
  } catch (error) {
    setFeedback(
      error instanceof Error ? error.message : 'Não foi possível cancelar a contratação.',
      'error'
    );

    const btn = document.getElementById('client-cancel-pending-subscription-btn');

    if (btn) btn.disabled = false;
  }
}

function bindActions() {
  document
    .getElementById('client-cancel-pending-subscription-btn')
    ?.addEventListener('click', handleCancelPendingSubscription);

  document
    .getElementById('client-refresh-subscription-btn')
    ?.addEventListener('click', refreshSubscriptionStatusWithFeedback);
}

export function renderClientAssinatura() {
  return `
    <div id="pages" style="display:block">
      <div class="page active">
        <div style="display:grid;gap:18px;">
          <div id="client-assinatura-empty" style="display:none;"></div>

          <div id="client-assinatura-content" style="display:none;gap:18px;">
            <div class="card">
              <div class="card-header">
                <div class="card-title">Meu plano</div>
                <div class="card-action" data-client-route="planos">Ver outros planos</div>
              </div>

              <div id="client-assinatura-feedback" style="min-height:20px;margin-bottom:14px;color:#8fa3c7;"></div>
              <div id="client-assinatura-actions" style="margin-bottom:14px;"></div>
              <div id="client-assinatura-header" class="grid-3"></div>
            </div>

            <div class="card">
              <div class="card-header">
                <div class="card-title">Período e cobrança</div>
              </div>
              <div id="client-assinatura-period" style="display:grid;gap:12px;"></div>
            </div>

            <div class="card">
              <div class="card-header">
                <div class="card-title">Seus créditos este mês</div>
              </div>
              <div id="client-assinatura-balances"></div>
            </div>

            <div class="card">
              <div class="card-header">
                <div class="card-title">Histórico de cobranças</div>
              </div>
              <div id="client-assinatura-invoices"></div>
            </div>
          </div>
        </div>
      </div>
    </div>
  `;
}

export function initClientAssinaturaPage() {
  state.returnFeedback = resolveReturnFeedback();

  (async () => {
    try {
      if (state.returnFeedback) {
        setFeedback(state.returnFeedback.message, state.returnFeedback.variant);
      } else {
        setFeedback('Carregando sua assinatura...', 'neutral');
      }

      await loadSubscription({ preserveMessage: Boolean(state.returnFeedback) });

      if (state.returnFeedback?.shouldPoll) {
        await pollAfterMercadoPagoReturn();
      } else if (!state.returnFeedback) {
        setFeedback('', 'neutral');
      }
    } catch (error) {
      setFeedback(
        error instanceof Error ? error.message : 'Não foi possível carregar sua assinatura.',
        'error'
      );
    }
  })();
}
