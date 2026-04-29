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
  const amount = Number(value || 0);
  return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(amount);
}

function formatDateTime(value) {
  if (!value) return '-';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '-';
  return date.toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' });
}

function formatDate(value) {
  if (!value) return '-';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '-';
  return date.toLocaleDateString('pt-BR');
}

function translateStatus(status) {
  const map = {
    active: 'Ativo', pending_activation: 'Aguardando pagamento', pending: 'Pendente',
    past_due: 'Pagamento pendente', paused: 'Pausado', trialing: 'Em teste',
    canceled: 'Cancelado', cancelled: 'Cancelado', expired: 'Expirado',
    paid: 'Pago', failed: 'Falhou', open: 'Aberta', created: 'Criada', authorized: 'Autorizado',
  };
  return map[String(status || '').toLowerCase()] || status || '-';
}

function isPendingSubscriptionStatus(status) {
  return ['pending_activation', 'pending', 'past_due'].includes(String(status || '').toLowerCase());
}

function isPendingInvoiceStatus(status) {
  return ['pending', 'open', 'created', 'authorized'].includes(String(status || '').toLowerCase());
}

function noCreditsUsed() {
  const cycle = state.currentCycle;
  if (!cycle) return true;
  const haircuts = Number(cycle.remaining_haircuts ?? 0) === Number(cycle.included_haircuts ?? 0);
  const beards = Number(cycle.remaining_beards ?? 0) === Number(cycle.included_beards ?? 0);
  const services = Array.isArray(cycle.subscription_cycle_service_balances)
    ? cycle.subscription_cycle_service_balances.every(b => Number(b.remaining_quantity ?? 0) === Number(b.included_quantity ?? 0))
    : true;
  return haircuts && beards && services;
}

function setFeedback(message, variant = 'neutral') {
  ['client-assinatura-feedback', 'client-assinatura-empty-feedback'].forEach((id) => {
    const el = document.getElementById(id);
    if (!el) return;
    el.textContent = message || '';
    el.className = `client-feedback ${variant === 'error' ? 'is-error' : variant === 'success' ? 'is-success' : ''}`;
  });
}

function getInvoices() {
  return Array.isArray(state.subscription?.subscription_invoices)
    ? state.subscription.subscription_invoices : [];
}

function getPendingInvoice() {
  return [...getInvoices()]
    .sort((a, b) => new Date(b?.due_at || b?.created_at || 0) - new Date(a?.due_at || a?.created_at || 0))
    .find((inv) => isPendingInvoiceStatus(inv?.status)) || null;
}

function resolveReturnFeedback() {
  const params = new URLSearchParams(window.location.search);
  if (!params.toString()) return null;

  const collectionStatus = String(params.get('collection_status') || params.get('status') || '').toLowerCase();
  const paymentId = String(params.get('payment_id') || params.get('collection_id') || '').trim();
  const hasReturnParams = params.has('collection_status') || params.has('collection_id') || params.has('payment_id') || params.has('status');

  window.history.replaceState({ clientRoute: 'assinatura' }, '', '/client/assinatura');
  if (!hasReturnParams) return null;

  if (collectionStatus === 'approved') return { message: 'Pagamento aprovado. Confirmando seu plano...', variant: 'success', shouldPoll: true };
  if (['pending', 'in_process', 'authorized'].includes(collectionStatus)) return { message: 'Pagamento pendente de confirmação. Atualizando...', variant: 'neutral', shouldPoll: true };
  if (['rejected', 'cancelled', 'cancelled_by_user', 'failed'].includes(collectionStatus)) return { message: 'Pagamento não concluído. Tente novamente ou cancele a contratação.', variant: 'error', shouldPoll: false };
  if (paymentId || collectionStatus === 'null' || !collectionStatus) return { message: 'Pagamento ainda não concluído. Tente novamente ou cancele.', variant: 'error', shouldPoll: false };
  return null;
}

async function fetchSubscriptionState() {
  const payload = await getClientPortalSubscription();
  state.subscription = payload?.subscription || null;
  state.currentCycle = payload?.currentCycle || null;
  state.latestInvoice = payload?.latestInvoice || null;
}

// ─── Render sections ─────────────────────────────────────────────────────────

function renderTopActions() {
  const container = document.getElementById('client-assinatura-actions');
  if (!container) return;

  const subscription = state.subscription;
  const pendingInvoice = getPendingInvoice();
  const canCancel = isPendingSubscriptionStatus(subscription?.status) && noCreditsUsed();

  container.innerHTML = `
    <div style="display:flex;gap:12px;flex-wrap:wrap;justify-content:flex-end;">
      ${pendingInvoice?.payment_url ? `
        <a href="${escapeHtml(pendingInvoice.payment_url)}"
          style="min-height:46px;padding:0 16px;border-radius:12px;border:0;background:linear-gradient(135deg,#5dc8ff 0%,#2f8cff 55%,#1468ff 100%);color:#fff;font:inherit;font-weight:800;text-decoration:none;display:inline-flex;align-items:center;justify-content:center;">
          Pagar agora
        </a>
      ` : ''}
      <button type="button" id="client-refresh-subscription-btn"
        style="min-height:46px;padding:0 16px;border-radius:12px;border:1px solid rgba(79,195,247,.20);background:rgba(79,195,247,.08);color:#7dd3fc;font:inherit;font-weight:800;cursor:pointer;">
        Atualizar status
      </button>
      ${canCancel ? `
        <button type="button" id="client-cancel-pending-subscription-btn"
          style="min-height:46px;padding:0 16px;border-radius:12px;border:1px solid rgba(255,82,82,.20);background:rgba(255,82,82,.08);color:#ff8a80;font:inherit;font-weight:800;cursor:pointer;">
          Cancelar contratação
        </button>
      ` : ''}
    </div>
  `;
}

function renderHeader() {
  const container = document.getElementById('client-assinatura-header');
  if (!container) return;

  const subscription = state.subscription;
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
      <div class="metric-value" style="font-size:18px;">${escapeHtml(formatCurrency(plan?.price))}</div>
      <div class="metric-sub color-nt">Cobrança recorrente</div>
    </div>
  `;

  const period = document.getElementById('client-assinatura-period');
  if (period) {
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
          <div class="cfg-sub">${escapeHtml(formatDate(subscription?.next_billing_at))}</div>
        </div>
        <span class="pill">Cobrança</span>
      </div>
    `;
  }
}

function renderCreditBar(remaining, included, color) {
  const pct = included > 0 ? Math.max(0, Math.min(100, (Number(remaining) / Number(included)) * 100)) : 0;
  return `
    <div class="assinatura-credit-bar">
      <div class="assinatura-credit-bar-fill" style="width:${pct}%;background:${color}"></div>
    </div>
  `;
}

function renderBalances() {
  const container = document.getElementById('client-assinatura-balances');
  if (!container) return;

  const cycle = state.currentCycle;
  const serviceBalances = Array.isArray(cycle?.subscription_cycle_service_balances)
    ? cycle.subscription_cycle_service_balances : [];

  const remaining_haircuts = Number(cycle?.remaining_haircuts ?? 0);
  const included_haircuts = Number(cycle?.included_haircuts ?? 0);
  const remaining_beards = Number(cycle?.remaining_beards ?? 0);
  const included_beards = Number(cycle?.included_beards ?? 0);

  container.innerHTML = `
    <div class="assinatura-credits-grid">
      <div class="metric-card">
        <div class="metric-label">✂ Cortes restantes</div>
        <div class="metric-value">${remaining_haircuts}</div>
        <div class="metric-sub color-nt">de ${included_haircuts} incluídos</div>
        ${renderCreditBar(remaining_haircuts, included_haircuts, '#2f8cff')}
        ${remaining_haircuts === 0 ? `<div style="font-size:12px;color:#ff8a80;margin-top:6px;">Saldo esgotado</div>` : ''}
      </div>

      <div class="metric-card">
        <div class="metric-label">〜 Barbas restantes</div>
        <div class="metric-value">${remaining_beards}</div>
        <div class="metric-sub color-nt">de ${included_beards} incluídas</div>
        ${renderCreditBar(remaining_beards, included_beards, '#f59e0b')}
        ${remaining_beards === 0 ? `<div style="font-size:12px;color:#ff8a80;margin-top:6px;">Saldo esgotado</div>` : ''}
      </div>
    </div>

    ${serviceBalances.length ? `
      <div style="display:grid;gap:10px;margin-top:12px;">
        ${serviceBalances.map((item) => {
          const service = Array.isArray(item?.services) ? item.services[0] : item?.services;
          const rem = Number(item?.remaining_quantity ?? 0);
          const inc = Number(item?.included_quantity ?? 0);
          return `
            <div class="cfg-row">
              <div>
                <div class="cfg-label">${escapeHtml(service?.name || 'Serviço')}</div>
                <div class="cfg-sub">${rem} restante(s) de ${inc}</div>
                ${renderCreditBar(rem, inc, '#10b981')}
              </div>
              <span class="pill">Serviço</span>
            </div>
          `;
        }).join('')}
      </div>
    ` : `
      <div class="cfg-row" style="margin-top:12px;">
        <div>
          <div class="cfg-label">Saldos por serviço</div>
          <div class="cfg-sub">Nenhum saldo específico por serviço neste ciclo.</div>
        </div>
        <span class="pill">Ciclo</span>
      </div>
    `}
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
        const reason = invoice?.billing_reason === 'signup' ? 'Adesão ao plano'
          : invoice?.billing_reason === 'recurring' ? 'Mensalidade'
          : 'Cobrança do plano';

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
                <div class="cfg-sub">${escapeHtml(formatCurrency(Number(invoice?.amount_cents || 0) / 100))}</div>
              </div>
              <span class="pill">Fatura</span>
            </div>

            ${invoice?.paid_at ? `
              <div class="cfg-row">
                <div>
                  <div class="cfg-label">Pagamento confirmado</div>
                  <div class="cfg-sub">${escapeHtml(formatDateTime(invoice.paid_at))}</div>
                </div>
                <span class="pill">Pago</span>
              </div>
            ` : ''}

            ${['canceled', 'cancelled'].includes(String(invoice?.status || '').toLowerCase()) ? `
              <div class="cfg-row">
                <div>
                  <div class="cfg-label">Situação</div>
                  <div class="cfg-sub">Esta cobrança foi cancelada e permanece no histórico.</div>
                </div>
                <span class="pill">Histórico</span>
              </div>
            ` : ''}
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
        <div class="card-action" data-client-route="planos">Contratar agora</div>
      </div>
      <div id="client-assinatura-empty-feedback" style="min-height:20px;margin-bottom:14px;color:#8fa3c7;"></div>
      <div class="cfg-row">
        <div>
          <div class="cfg-label">Nenhum plano ativo</div>
          <div class="cfg-sub">Você ainda não possui um plano ativo nesta barbearia.</div>
        </div>
        <span class="pill">Sem assinatura</span>
      </div>
    </div>
  `;
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
}

async function loadSubscription({ preserveMessage = true } = {}) {
  await fetchSubscriptionState();
  if (!state.subscription) {
    renderEmptyState();
    if (!preserveMessage) setFeedback('Nenhuma assinatura encontrada.', 'neutral');
    return;
  }
  renderContent();
  if (!preserveMessage) setFeedback('Sua assinatura foi carregada.', 'neutral');
  bindActions();
}

async function refreshSubscriptionStatusWithFeedback() {
  try {
    setFeedback('Atualizando status do pagamento...', 'neutral');
    await loadSubscription();
    setFeedback('Status atualizado.', 'success');
  } catch (error) {
    setFeedback(error instanceof Error ? error.message : 'Não foi possível atualizar o status.', 'error');
  }
}

async function pollAfterMercadoPagoReturn() {
  if (!state.returnFeedback?.shouldPoll) return;
  const maxAttempts = 15;
  const delayMs = 3000;

  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    await loadSubscription();
    const subStatus = String(state.subscription?.status || '').toLowerCase();
    const latestStatus = String(state.latestInvoice?.status || '').toLowerCase();

    if (subStatus === 'active' || latestStatus === 'paid') {
      setFeedback('Pagamento confirmado e plano ativado com sucesso.', 'success');
      return;
    }
    if (['failed', 'canceled', 'cancelled'].includes(latestStatus) || subStatus === 'canceled') {
      setFeedback('O pagamento não foi concluído. Você pode tentar novamente ou cancelar a contratação.', 'error');
      return;
    }
    if (attempt < maxAttempts - 1) {
      setFeedback('Aguardando confirmação do pagamento...', 'neutral');
      await new Promise(resolve => setTimeout(resolve, delayMs));
    }
  }
  setFeedback('Ainda aguardando confirmação. Você pode atualizar o status manualmente em instantes.', 'neutral');
}

async function handleCancelPendingSubscription() {
  const confirmed = window.confirm('Tem certeza que deseja cancelar esta contratação pendente? O histórico será mantido, mas o plano não ficará mais reservado.');
  if (!confirmed) return;

  const reason = window.prompt('Informe um motivo curto para o cancelamento (opcional):', 'Contratação cancelada pelo cliente');
  if (reason === null) return;

  try {
    const btn = document.getElementById('client-cancel-pending-subscription-btn');
    if (btn) btn.disabled = true;
    setFeedback('Cancelando contratação pendente...', 'neutral');
    await cancelClientPortalPendingSubscription(reason);
    renderEmptyState();
    setFeedback('Contratação cancelada com sucesso. O histórico foi preservado.', 'success');
  } catch (error) {
    setFeedback(error instanceof Error ? error.message : 'Não foi possível cancelar a contratação.', 'error');
    const btn = document.getElementById('client-cancel-pending-subscription-btn');
    if (btn) btn.disabled = false;
  }
}

function bindActions() {
  document.getElementById('client-cancel-pending-subscription-btn')?.addEventListener('click', handleCancelPendingSubscription);
  document.getElementById('client-refresh-subscription-btn')?.addEventListener('click', refreshSubscriptionStatusWithFeedback);
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

      await loadSubscription();

      if (state.returnFeedback?.shouldPoll) {
        await pollAfterMercadoPagoReturn();
      } else if (!state.returnFeedback) {
        setFeedback('Sua assinatura foi carregada.', 'neutral');
      }
    } catch (error) {
      renderEmptyState();
      setFeedback(error instanceof Error ? error.message : 'Não foi possível carregar sua assinatura.', 'error');
    }
  })();
}
