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
  const haircuts = (cycle.remaining_haircuts ?? 0) === (cycle.included_haircuts ?? 0);
  const beards = (cycle.remaining_beards ?? 0) === (cycle.included_beards ?? 0);
  const services = Array.isArray(cycle.subscription_cycle_service_balances)
    ? cycle.subscription_cycle_service_balances.every(b => (b.remaining_quantity ?? 0) === (b.included_quantity ?? 0))
    : true;
  return haircuts && beards && services;
}

function setFeedback(message, variant = 'neutral') {
  ['client-assinatura-feedback', 'client-assinatura-empty-feedback'].forEach((id) => {
    const el = document.getElementById(id);
    if (!el) return;
    el.textContent = message || '';
    el.className = `assinatura-feedback assinatura-feedback--${variant}`;
  });
}

function getInvoices() {
  return Array.isArray(state.subscription?.subscription_invoices)
    ? state.subscription.subscription_invoices
    : [];
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

// ─── Render helpers ──────────────────────────────────────────────────────────

function renderStatusBadge(status) {
  const s = String(status || '').toLowerCase();
  const configs = {
    active: { bg: '#EAF3DE', color: '#3B6D11', dot: '#639922', label: 'Ativo' },
    pending_activation: { bg: '#FAEEDA', color: '#854F0B', dot: '#BA7517', label: 'Aguardando pagamento' },
    pending: { bg: '#FAEEDA', color: '#854F0B', dot: '#BA7517', label: 'Pendente' },
    past_due: { bg: '#FCEBEB', color: '#A32D2D', dot: '#E24B4A', label: 'Pagamento pendente' },
    canceled: { bg: '#F1EFE8', color: '#5F5E5A', dot: '#888780', label: 'Cancelado' },
    cancelled: { bg: '#F1EFE8', color: '#5F5E5A', dot: '#888780', label: 'Cancelado' },
    expired: { bg: '#F1EFE8', color: '#5F5E5A', dot: '#888780', label: 'Expirado' },
    paid: { bg: '#EAF3DE', color: '#3B6D11', dot: '#639922', label: 'Pago' },
    failed: { bg: '#FCEBEB', color: '#A32D2D', dot: '#E24B4A', label: 'Falhou' },
  };
  const cfg = configs[s] || { bg: '#F1EFE8', color: '#5F5E5A', dot: '#888780', label: translateStatus(status) };
  return `<span style="display:inline-flex;align-items:center;gap:5px;font-size:12px;font-weight:500;padding:3px 10px;border-radius:20px;background:${cfg.bg};color:${cfg.color}"><span style="width:6px;height:6px;border-radius:50%;background:${cfg.dot};flex-shrink:0"></span>${escapeHtml(cfg.label)}</span>`;
}

function renderProgressBar(remaining, included, color) {
  const pct = included > 0 ? Math.max(0, Math.min(100, (remaining / included) * 100)) : 0;
  const isEmpty = remaining === 0;
  return `
    <div style="height:4px;background:var(--color-background-secondary);border-radius:2px;overflow:hidden;margin-top:10px">
      <div style="height:100%;width:${pct}%;background:${color};border-radius:2px;transition:width .6s ease"></div>
    </div>
    ${isEmpty ? `<div style="font-size:12px;color:#A32D2D;margin-top:4px">Saldo esgotado</div>` : ''}
  `;
}

function renderCreditCard(label, icon, remaining, included, color) {
  const rem = Number(remaining ?? 0);
  const inc = Number(included ?? 0);
  return `
    <div style="background:var(--color-background-primary);border:0.5px solid var(--color-border-tertiary);border-radius:var(--border-radius-lg);padding:1rem">
      <div style="display:flex;align-items:center;gap:6px;font-size:13px;color:var(--color-text-secondary);margin-bottom:8px">
        <span style="font-size:14px">${icon}</span>${escapeHtml(label)}
      </div>
      <div style="font-size:28px;font-weight:500;line-height:1">${rem}</div>
      <div style="font-size:12px;color:var(--color-text-tertiary);margin-top:2px">de ${inc} incluídos</div>
      ${renderProgressBar(rem, inc, color)}
    </div>
  `;
}

function renderBillingRow(label, value) {
  return `
    <div style="display:flex;justify-content:space-between;align-items:center;padding:.6rem 0;border-bottom:0.5px solid var(--color-border-tertiary)">
      <span style="font-size:14px;color:var(--color-text-secondary)">${escapeHtml(label)}</span>
      <span style="font-size:14px;font-weight:500">${escapeHtml(value)}</span>
    </div>
  `;
}

function renderInvoiceItem(invoice) {
  const isPaid = String(invoice?.status || '').toLowerCase() === 'paid';
  const isCanceled = ['canceled', 'cancelled'].includes(String(invoice?.status || '').toLowerCase());
  const dotColor = isPaid ? '#639922' : isCanceled ? '#888780' : '#BA7517';
  const reason = invoice?.billing_reason === 'signup' ? 'Adesão ao plano' : invoice?.billing_reason === 'recurring' ? 'Mensalidade' : 'Cobrança do plano';
  const amount = formatCurrency(Number(invoice?.amount_cents || 0) / 100);

  return `
    <div style="display:flex;justify-content:space-between;align-items:center;padding:.875rem 1rem;border-bottom:0.5px solid var(--color-border-tertiary)">
      <div style="display:flex;align-items:center;gap:10px">
        <div style="width:8px;height:8px;border-radius:50%;background:${dotColor};flex-shrink:0"></div>
        <div>
          <div style="font-size:14px">${escapeHtml(reason)}</div>
          <div style="font-size:12px;color:var(--color-text-tertiary);margin-top:1px">
            Vencimento: ${escapeHtml(formatDate(invoice?.due_at))}
            ${invoice?.paid_at ? ` · Pago em: ${escapeHtml(formatDateTime(invoice.paid_at))}` : ''}
          </div>
        </div>
      </div>
      <div style="text-align:right;flex-shrink:0">
        <div style="font-size:14px;font-weight:500">${escapeHtml(amount)}</div>
        <div style="margin-top:2px">${renderStatusBadge(invoice?.status)}</div>
      </div>
    </div>
  `;
}

// ─── Render sections ─────────────────────────────────────────────────────────

function renderHero() {
  const sub = state.subscription;
  const plan = sub?.plans || {};
  const canCancel = isPendingSubscriptionStatus(sub?.status) && noCreditsUsed();
  const pendingInvoice = getPendingInvoice();

  const heroEl = document.getElementById('client-assinatura-hero');
  if (!heroEl) return;

  heroEl.innerHTML = `
    <div style="background:var(--color-background-primary);border:0.5px solid var(--color-border-tertiary);border-radius:var(--border-radius-lg);padding:1.5rem;margin-bottom:1rem;position:relative;overflow:hidden">
      <div style="position:absolute;top:-40px;right:-40px;width:140px;height:140px;border-radius:50%;background:var(--color-background-secondary);opacity:0.5;pointer-events:none"></div>
      <div style="margin-bottom:.75rem">${renderStatusBadge(sub?.status)}</div>
      <div style="font-size:22px;font-weight:500;margin-bottom:4px">${escapeHtml(plan?.name || 'Sem plano')}</div>
      <div style="font-size:14px;color:var(--color-text-secondary)">
        Cobrança recorrente de <strong style="font-weight:500;color:var(--color-text-primary)">${escapeHtml(formatCurrency(plan?.price))}/mês</strong>
      </div>
      <div style="font-size:13px;color:var(--color-text-tertiary);margin-top:4px">
        Período: ${escapeHtml(formatDate(sub?.current_period_start))} até ${escapeHtml(formatDate(sub?.current_period_end))}
      </div>

      ${pendingInvoice?.payment_url ? `
        <div style="margin-top:1rem">
          <a href="${escapeHtml(pendingInvoice.payment_url)}" style="display:inline-flex;align-items:center;padding:.6rem 1.25rem;border-radius:var(--border-radius-md);background:#378ADD;color:#fff;font-size:14px;font-weight:500;text-decoration:none">
            Pagar agora
          </a>
        </div>
      ` : ''}

      <div style="display:flex;gap:.5rem;flex-wrap:wrap;margin-top:.75rem">
        <button id="client-refresh-subscription-btn" style="font-size:13px;padding:.4rem .9rem;border-radius:var(--border-radius-md);border:0.5px solid var(--color-border-secondary);background:transparent;color:var(--color-text-secondary);cursor:pointer;font-family:var(--font-sans)">
          Atualizar status
        </button>
        ${canCancel ? `
          <button id="client-cancel-pending-subscription-btn" style="font-size:13px;padding:.4rem .9rem;border-radius:var(--border-radius-md);border:0.5px solid #F0997B;background:transparent;color:#993C1D;cursor:pointer;font-family:var(--font-sans)">
            Cancelar contratação
          </button>
        ` : ''}
      </div>
    </div>
  `;
}

function renderCredits() {
  const cycle = state.currentCycle;
  const serviceBalances = Array.isArray(cycle?.subscription_cycle_service_balances)
    ? cycle.subscription_cycle_service_balances : [];

  const el = document.getElementById('client-assinatura-credits');
  if (!el) return;

  el.innerHTML = `
    <div style="font-size:13px;font-weight:500;color:var(--color-text-secondary);letter-spacing:.05em;text-transform:uppercase;margin-bottom:.75rem">Seus créditos este mês</div>
    <div style="display:grid;grid-template-columns:1fr 1fr;gap:.75rem;margin-bottom:1rem">
      ${renderCreditCard('Cortes', '✂', cycle?.remaining_haircuts, cycle?.included_haircuts, '#378ADD')}
      ${renderCreditCard('Barbas', '~', cycle?.remaining_beards, cycle?.included_beards, '#BA7517')}
    </div>
    ${serviceBalances.length ? `
      <div style="display:grid;gap:.5rem">
        ${serviceBalances.map(item => {
          const svc = Array.isArray(item?.services) ? item.services[0] : item?.services;
          return renderCreditCard(svc?.name || 'Serviço', '◆', item?.remaining_quantity, item?.included_quantity, '#1D9E75');
        }).join('')}
      </div>
    ` : ''}
  `;
}

function renderBilling() {
  const sub = state.subscription;
  const el = document.getElementById('client-assinatura-billing');
  if (!el) return;

  el.innerHTML = `
    <div style="font-size:13px;font-weight:500;color:var(--color-text-secondary);letter-spacing:.05em;text-transform:uppercase;margin-bottom:.75rem">Cobrança</div>
    <div style="background:var(--color-background-primary);border:0.5px solid var(--color-border-tertiary);border-radius:var(--border-radius-lg);padding:0 1rem">
      ${renderBillingRow('Período atual', `${formatDate(sub?.current_period_start)} – ${formatDate(sub?.current_period_end)}`)}
      ${renderBillingRow('Próxima cobrança', formatDate(sub?.next_billing_at))}
      <div style="display:flex;justify-content:space-between;align-items:center;padding:.6rem 0">
        <span style="font-size:14px;color:var(--color-text-secondary)">Valor</span>
        <span style="font-size:14px;font-weight:500">${escapeHtml(formatCurrency(sub?.plans?.price))}</span>
      </div>
    </div>
  `;
}

function renderHistory() {
  const invoices = getInvoices();
  const el = document.getElementById('client-assinatura-history');
  if (!el) return;

  el.innerHTML = `
    <div style="font-size:13px;font-weight:500;color:var(--color-text-secondary);letter-spacing:.05em;text-transform:uppercase;margin-bottom:.75rem">Histórico de pagamentos</div>
    <div style="background:var(--color-background-primary);border:0.5px solid var(--color-border-tertiary);border-radius:var(--border-radius-lg);overflow:hidden">
      ${invoices.length
        ? invoices.map(inv => renderInvoiceItem(inv)).join('').replace(/border-bottom[^"]*"[^>]*>(?=[^<]*<\/div>\s*<\/div>\s*$)/, '')
        : `<div style="padding:1rem;color:var(--color-text-secondary);font-size:14px">Nenhum pagamento encontrado.</div>`
      }
    </div>
  `;
}

function renderFeedback() {
  return `<div id="client-assinatura-feedback" class="assinatura-feedback" style="min-height:20px;margin-bottom:.5rem;font-size:13px"></div>`;
}

// ─── State management ────────────────────────────────────────────────────────

function renderContent() {
  const empty = document.getElementById('client-assinatura-empty');
  const content = document.getElementById('client-assinatura-content');
  if (!empty || !content) return;
  empty.style.display = 'none';
  content.style.display = 'grid';
  renderHero();
  renderCredits();
  renderBilling();
  renderHistory();
  bindActions();
}

function renderEmptyState() {
  const empty = document.getElementById('client-assinatura-empty');
  const content = document.getElementById('client-assinatura-content');
  if (!empty || !content) return;
  content.style.display = 'none';
  empty.style.display = 'block';
  empty.innerHTML = `
    <div class="card">
      <div class="card-header">
        <div class="card-title">Meu plano</div>
        <div class="card-action" data-client-route="planos">Contratar agora</div>
      </div>
      <div id="client-assinatura-empty-feedback" class="assinatura-feedback" style="min-height:20px;margin-bottom:14px;font-size:13px"></div>
      <div style="padding:1.5rem 0;text-align:center;color:var(--color-text-secondary);font-size:14px">
        Você ainda não possui um plano ativo nesta barbearia.
      </div>
    </div>
  `;
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
}

async function refreshSubscriptionStatusWithFeedback() {
  try {
    setFeedback('Atualizando...', 'neutral');
    await loadSubscription();
    setFeedback('Status atualizado.', 'success');
  } catch (error) {
    setFeedback(error instanceof Error ? error.message : 'Não foi possível atualizar.', 'error');
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
      setFeedback('O pagamento não foi concluído. Tente novamente ou cancele a contratação.', 'error');
      return;
    }
    if (attempt < maxAttempts - 1) {
      setFeedback('Aguardando confirmação do pagamento...', 'neutral');
      await new Promise(resolve => setTimeout(resolve, delayMs));
    }
  }

  setFeedback('Ainda aguardando confirmação. Você pode atualizar o status manualmente.', 'neutral');
}

async function handleCancelPendingSubscription() {
  const confirmed = window.confirm('Tem certeza que deseja cancelar esta contratação? O histórico será mantido.');
  if (!confirmed) return;

  const reason = window.prompt('Motivo do cancelamento (opcional):', 'Contratação cancelada pelo cliente');
  if (reason === null) return;

  try {
    const btn = document.getElementById('client-cancel-pending-subscription-btn');
    if (btn) btn.disabled = true;
    setFeedback('Cancelando contratação...', 'neutral');
    await cancelClientPortalPendingSubscription(reason);
    renderEmptyState();
    setFeedback('Contratação cancelada. O histórico foi preservado.', 'success');
  } catch (error) {
    setFeedback(error instanceof Error ? error.message : 'Não foi possível cancelar.', 'error');
    const btn = document.getElementById('client-cancel-pending-subscription-btn');
    if (btn) btn.disabled = false;
  }
}

function bindActions() {
  document.getElementById('client-cancel-pending-subscription-btn')?.addEventListener('click', handleCancelPendingSubscription);
  document.getElementById('client-refresh-subscription-btn')?.addEventListener('click', refreshSubscriptionStatusWithFeedback);
}

// ─── Public exports ──────────────────────────────────────────────────────────

export function renderClientAssinatura() {
  return `
    <style>
      .assinatura-feedback--error { color: #A32D2D }
      .assinatura-feedback--success { color: #3B6D11 }
      .assinatura-feedback--neutral { color: var(--color-text-secondary) }
    </style>

    <div style="display:grid;gap:0">
      <div id="client-assinatura-empty" style="display:none"></div>

      <div id="client-assinatura-content" style="display:none;gap:0">
        <div style="margin-bottom:.5rem">
          ${renderFeedback()}
        </div>
        <div id="client-assinatura-hero"></div>
        <div id="client-assinatura-credits"></div>
        <div id="client-assinatura-billing" style="margin-bottom:1rem"></div>
        <div id="client-assinatura-history"></div>

        <div style="margin-top:1rem;text-align:right">
          <a data-client-route="planos" style="font-size:13px;color:var(--color-text-secondary);cursor:pointer;text-decoration:underline">
            Ver outros planos
          </a>
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
