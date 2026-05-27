import {
  getClientPortalSubscription,
  getClientPortalContext,
} from '../../services/client-auth.js';

const state = {
  subscription: null,
  context: null,
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
    paid: 'Pago',
    pending: 'Pendente',
    open: 'Aberta',
    created: 'Criada',
    failed: 'Falhou',
    past_due: 'Vencida',
    canceled: 'Cancelado',
    cancelled: 'Cancelado',
    authorized: 'Autorizado',
  };

  return map[String(status || '').toLowerCase()] || status || '-';
}

function translateBillingReason(reason) {
  const map = {
    signup: 'Adesão ao plano',
    recurring: 'Mensalidade',
    manual: 'Cobrança manual',
    retry: 'Retentativa de cobrança',
  };

  return map[String(reason || '').toLowerCase()] || reason || 'Cobrança do plano';
}

function statusStyle(status) {
  const key = String(status || '').toLowerCase();

  if (key === 'paid') {
    return 'background:rgba(0,230,118,.10);color:#00e676;border:1px solid rgba(0,230,118,.18);';
  }

  if (['pending', 'open', 'created', 'authorized'].includes(key)) {
    return 'background:rgba(255,193,7,.10);color:#ffd166;border:1px solid rgba(255,193,7,.18);';
  }

  if (['failed', 'past_due'].includes(key)) {
    return 'background:rgba(255,82,82,.10);color:#ff8a80;border:1px solid rgba(255,82,82,.18);';
  }

  if (['canceled', 'cancelled'].includes(key)) {
    return 'background:rgba(120,120,120,.10);color:#aaa;border:1px solid rgba(120,120,120,.18);';
  }

  return 'background:rgba(79,195,247,.10);color:#7dd3fc;border:1px solid rgba(79,195,247,.18);';
}

function isPendingInvoiceStatus(status) {
  return ['pending', 'open', 'created', 'authorized', 'failed', 'past_due'].includes(String(status || '').toLowerCase());
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

function setFeedback(message, variant = 'neutral') {
  const el = document.getElementById('client-pagamentos-feedback');

  if (!el) return;

  el.textContent = message || '';
  el.style.color =
    variant === 'error'
      ? '#ff7b91'
      : variant === 'success'
        ? '#00e676'
        : '#8fa3c7';
}

function renderHeader() {
  const container = document.getElementById('client-pagamentos-header');

  if (!container) return;

  const invoices = Array.isArray(state.subscription?.subscription_invoices)
    ? state.subscription.subscription_invoices
    : [];

  const total = invoices.length;
  const paid = invoices.filter((invoice) => String(invoice?.status).toLowerCase() === 'paid').length;
  const pending = invoices.filter((invoice) => isPendingInvoiceStatus(invoice?.status)).length;

  container.innerHTML = `
    <div class="metric-card">
      <div class="metric-label">Total de cobranças</div>
      <div class="metric-value">${escapeHtml(String(total))}</div>
      <div class="metric-sub color-nt">Histórico completo</div>
    </div>

    <div class="metric-card">
      <div class="metric-label">Pagas</div>
      <div class="metric-value" style="color:#00e676;">${escapeHtml(String(paid))}</div>
      <div class="metric-sub color-nt">Confirmadas</div>
    </div>

    <div class="metric-card">
      <div class="metric-label">Pendentes</div>
      <div class="metric-value" style="color:#ffd166;">${escapeHtml(String(pending))}</div>
      <div class="metric-sub color-nt">Aguardando pagamento</div>
    </div>
  `;
}

function renderEmpty() {
  const container = document.getElementById('client-pagamentos-list');

  if (!container) return;

  container.innerHTML = `
    <div class="cfg-row">
      <div>
        <div class="cfg-label">Nenhuma cobrança encontrada</div>
        <div class="cfg-sub">Quando houver cobranças do seu plano, elas aparecerão aqui.</div>
      </div>
      <span class="pill">Vazio</span>
    </div>
  `;
}

function renderInvoices() {
  const container = document.getElementById('client-pagamentos-list');

  if (!container) return;

  const invoices = Array.isArray(state.subscription?.subscription_invoices)
    ? [...state.subscription.subscription_invoices].sort((a, b) => {
      return new Date(b?.created_at || b?.due_at || 0).getTime() -
        new Date(a?.created_at || a?.due_at || 0).getTime();
    })
    : [];

  const plan = state.subscription?.plans || {};

  if (!invoices.length) {
    renderEmpty();
    return;
  }

  container.innerHTML = `
    <div style="display:grid;gap:14px;">
      ${invoices.map((invoice) => {
        const amount = getInvoiceAmount(invoice);
        const paymentUrl = getInvoicePaymentUrl(invoice);
        const status = String(invoice?.status || '').toLowerCase();

        return `
          <div style="border:1px solid rgba(79,195,247,.12);border-radius:18px;background:rgba(255,255,255,.03);padding:16px;display:grid;gap:12px;">
            <div style="display:flex;justify-content:space-between;gap:12px;align-items:flex-start;flex-wrap:wrap;">
              <div>
                <div style="font-size:16px;font-weight:800;color:#fff;">
                  ${escapeHtml(plan?.name || 'Plano')} - ${escapeHtml(formatCurrency(amount))}
                </div>
                <div style="margin-top:4px;color:#8fa3c7;">
                  Vencimento: ${escapeHtml(formatDate(invoice?.due_at))}
                </div>
              </div>

              <span style="padding:6px 10px;border-radius:999px;font-size:12px;font-weight:800;${statusStyle(invoice?.status)}">
                ${escapeHtml(translateStatus(invoice?.status))}
              </span>
            </div>

            <div class="cfg-row">
              <div>
                <div class="cfg-label">Descrição</div>
                <div class="cfg-sub">${escapeHtml(translateBillingReason(invoice?.billing_reason))}</div>
              </div>
              <span class="pill">Cobrança</span>
            </div>

            ${
              invoice?.paid_at
                ? `
                  <div class="cfg-row">
                    <div>
                      <div class="cfg-label">Pago em</div>
                      <div class="cfg-sub">${escapeHtml(formatDateTime(invoice.paid_at))}</div>
                    </div>
                    <span class="pill" style="background:rgba(0,230,118,.10);color:#00e676;">Confirmado</span>
                  </div>
                `
                : ''
            }

            ${
              invoice?.payment_method
                ? `
                  <div class="cfg-row">
                    <div>
                      <div class="cfg-label">Forma de pagamento</div>
                      <div class="cfg-sub">${escapeHtml(invoice.payment_method)}</div>
                    </div>
                    <span class="pill">Pagamento</span>
                  </div>
                `
                : ''
            }

            ${
              paymentUrl && isPendingInvoiceStatus(status)
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
          </div>
        `;
      }).join('')}
    </div>
  `;
}

export function renderClientPagamentos() {
  return `
    <div id="pages" style="display:block">
      <div class="page active">
        <div style="display:grid;gap:18px;">
          <div class="card">
            <div class="card-header">
              <div class="card-title">Pagamentos</div>
              <div class="card-action" data-client-route="assinatura">Ver meu plano</div>
            </div>

            <div id="client-pagamentos-feedback" style="min-height:20px;margin-bottom:14px;color:#8fa3c7;"></div>
            <div id="client-pagamentos-header" class="grid-3"></div>
          </div>

          <div class="card">
            <div class="card-header">
              <div class="card-title">Histórico de cobranças</div>
            </div>

            <div id="client-pagamentos-list"></div>
          </div>
        </div>
      </div>
    </div>
  `;
}

export function initClientPagamentosPage() {
  (async () => {
    try {
      setFeedback('Carregando seus pagamentos...', 'neutral');

      const [subscriptionPayload, contextPayload] = await Promise.all([
        getClientPortalSubscription(),
        getClientPortalContext(),
      ]);

      state.subscription = subscriptionPayload?.subscription || null;
      state.context = contextPayload || null;

      renderHeader();
      renderInvoices();

      setFeedback('', 'neutral');
    } catch (error) {
      setFeedback(
        error instanceof Error ? error.message : 'Não foi possível carregar os pagamentos.',
        'error'
      );
    }
  })();
}
