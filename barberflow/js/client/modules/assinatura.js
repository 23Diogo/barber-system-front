import { getClientPortalSubscription } from '../../services/client-auth.js';

const state = {
  subscription: null,
  currentCycle: null,
  latestInvoice: null,
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
  return new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL',
  }).format(amount);
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
  });
}

function formatDate(value) {
  if (!value) return '-';

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '-';

  return date.toLocaleDateString('pt-BR');
}

function formatStatus(status) {
  const key = String(status || '').toLowerCase();

  const map = {
    active: 'Ativo',
    pending_activation: 'Pendente de ativação',
    past_due: 'Em atraso',
    paused: 'Pausado',
    trialing: 'Em período de teste',
    canceled: 'Cancelado',
    expired: 'Expirado',
  };

  return map[key] || status || '-';
}

function setFeedback(message, variant = 'neutral') {
  const el = document.getElementById('client-assinatura-feedback');
  if (!el) return;

  el.textContent = message || '';
  el.style.color =
    variant === 'error'
      ? '#ff7b91'
      : variant === 'success'
        ? '#00e676'
        : '#8fa3c7';
}

function renderBalances() {
  const container = document.getElementById('client-assinatura-balances');
  if (!container) return;

  const cycle = state.currentCycle;
  const serviceBalances = Array.isArray(cycle?.subscription_cycle_service_balances)
    ? cycle.subscription_cycle_service_balances
    : [];

  container.innerHTML = `
    <div class="cfg-row">
      <div>
        <div class="cfg-label">Cortes restantes</div>
        <div class="cfg-sub">${escapeHtml(String(cycle?.remaining_haircuts ?? '-'))}</div>
      </div>
      <span class="pill">Haircut</span>
    </div>

    <div class="cfg-row">
      <div>
        <div class="cfg-label">Barbas restantes</div>
        <div class="cfg-sub">${escapeHtml(String(cycle?.remaining_beards ?? '-'))}</div>
      </div>
      <span class="pill">Beard</span>
    </div>

    ${
      serviceBalances.length
        ? `
          <div style="display:grid;gap:10px;">
            ${serviceBalances.map((item) => {
              const service = Array.isArray(item?.services) ? item.services[0] : item?.services;

              return `
                <div class="cfg-row">
                  <div>
                    <div class="cfg-label">${escapeHtml(service?.name || 'Serviço')}</div>
                    <div class="cfg-sub">
                      ${escapeHtml(String(item?.remaining_quantity ?? 0))} restante(s) de ${escapeHtml(String(item?.included_quantity ?? 0))}
                    </div>
                  </div>
                  <span class="pill">Serviço</span>
                </div>
              `;
            }).join('')}
          </div>
        `
        : `
          <div class="cfg-row">
            <div>
              <div class="cfg-label">Serviços com saldo</div>
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

  const invoices = Array.isArray(state.subscription?.subscription_invoices)
    ? state.subscription.subscription_invoices
    : [];

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
      ${invoices.map((invoice) => `
        <div
          style="
            border:1px solid rgba(79,195,247,.12);
            border-radius:16px;
            background:rgba(255,255,255,.03);
            padding:14px;
            display:grid;
            gap:10px;
          "
        >
          <div style="display:flex;justify-content:space-between;gap:12px;align-items:flex-start;flex-wrap:wrap;">
            <div>
              <div style="font-size:15px;font-weight:800;color:#fff;">
                ${escapeHtml(invoice?.billing_reason || 'Cobrança')}
              </div>
              <div style="margin-top:4px;color:#8fa3c7;">
                Vencimento: ${escapeHtml(formatDate(invoice?.due_at))}
              </div>
            </div>

            <span class="pill">${escapeHtml(formatStatus(invoice?.status))}</span>
          </div>

          <div class="cfg-row">
            <div>
              <div class="cfg-label">Valor</div>
              <div class="cfg-sub">${escapeHtml(formatCurrency(Number(invoice?.amount_cents || 0) / 100))}</div>
            </div>
            <span class="pill">Fatura</span>
          </div>

          ${
            invoice?.paid_at
              ? `
                <div class="cfg-row">
                  <div>
                    <div class="cfg-label">Pagamento</div>
                    <div class="cfg-sub">${escapeHtml(formatDateTime(invoice.paid_at))}</div>
                  </div>
                  <span class="pill">Pago</span>
                </div>
              `
              : ''
          }

          ${
            invoice?.payment_url
              ? `
                <div style="display:flex;justify-content:flex-end;">
                  <a
                    href="${escapeHtml(invoice.payment_url)}"
                    style="
                      min-height:42px;
                      padding:10px 14px;
                      border-radius:12px;
                      border:0;
                      background:linear-gradient(135deg,#5dc8ff 0%,#2f8cff 55%,#1468ff 100%);
                      color:#fff;
                      font-weight:800;
                      text-decoration:none;
                      display:inline-flex;
                      align-items:center;
                    "
                  >
                    Ir para pagamento
                  </a>
                </div>
              `
              : ''
          }
        </div>
      `).join('')}
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
      <div class="metric-value" style="font-size:18px;">${escapeHtml(formatStatus(subscription?.status))}</div>
      <div class="metric-sub color-nt">Situação da assinatura</div>
    </div>

    <div class="metric-card">
      <div class="metric-label">Valor</div>
      <div class="metric-value" style="font-size:18px;">${escapeHtml(formatCurrency(plan?.price))}</div>
      <div class="metric-sub color-nt">Plano contratado</div>
    </div>
  `;

  document.getElementById('client-assinatura-period')?.replaceChildren();
  const period = document.getElementById('client-assinatura-period');

  if (period) {
    period.innerHTML = `
      <div class="cfg-row">
        <div>
          <div class="cfg-label">Período atual</div>
          <div class="cfg-sub">
            ${escapeHtml(formatDate(subscription?.current_period_start))} até ${escapeHtml(formatDate(subscription?.current_period_end))}
          </div>
        </div>
        <span class="pill">Período</span>
      </div>

      <div class="cfg-row">
        <div>
          <div class="cfg-label">Próxima cobrança</div>
          <div class="cfg-sub">${escapeHtml(formatDate(subscription?.next_billing_at))}</div>
        </div>
        <span class="pill">Billing</span>
      </div>
    `;
  }
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
  renderBalances();
  renderInvoices();
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
                <div class="card-title">Saldos do ciclo</div>
              </div>

              <div id="client-assinatura-balances" style="display:grid;gap:12px;"></div>
            </div>

            <div class="card">
              <div class="card-header">
                <div class="card-title">Cobranças</div>
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
  (async () => {
    try {
      setFeedback('Carregando sua assinatura...', 'neutral');

      const payload = await getClientPortalSubscription();

      state.subscription = payload?.subscription || null;
      state.currentCycle = payload?.currentCycle || null;
      state.latestInvoice = payload?.latestInvoice || null;

      if (!state.subscription) {
        renderEmptyState();
        return;
      }

      renderContent();
      setFeedback('Sua assinatura foi carregada.', 'neutral');
    } catch (error) {
      setFeedback(
        error instanceof Error ? error.message : 'Não foi possível carregar sua assinatura.',
        'error'
      );
    }
  })();
}
