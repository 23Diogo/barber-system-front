import {
  hasApiConfig,
  hasAuthToken,
  apiFetch,
  getClients,
  getClientById,
  createClient,
  updateClient,
  getSubscriptions,
  getSubscriptionById,
  activateSubscription,
  pauseSubscription,
  reactivateSubscription,
  cancelSubscription,
  createManualInvoice,
  createMercadoPagoPreference,
  markInvoicePaid,
  markInvoiceFailed,
  cancelInvoice,
} from '../services/api.js';

const CLIENT_NAME_MAX_LENGTH     = 100;
const CLIENT_PHONE_MAX_LENGTH    = 20;
const CLIENT_WHATSAPP_MAX_LENGTH = 20;
const CLIENT_NOTES_MAX_LENGTH    = 500;

const clientesState = {
  items: [],
  searchTerm: '',
  isLoading: false,
  isLoaded: false,
  modalMode: 'closed',
  activeClientId: null,
  detailClient: null,
  detailSubscription: null,
  isDetailLoading: false,
};

// ─── Helpers ──────────────────────────────────────────────────────────────────

function escapeHtml(value) {
  return String(value ?? '')
    .replace(/&/g, '&amp;').replace(/</g, '&lt;')
    .replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#039;');
}

function formatCurrency(value) {
  return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(Number(value || 0));
}

function formatCompactCurrency(value) {
  const amount = Number(value || 0);
  if (amount >= 1000) return `R$${amount.toFixed(1)}k`;
  return formatCurrency(amount);
}

function formatDateDisplay(value) {
  if (!value) return '—';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return String(value);
  return date.toLocaleDateString('pt-BR');
}

function formatDateTimeDisplay(value) {
  if (!value) return '—';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return String(value);
  return date.toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' });
}

function normalizeClientStatusFromApi(client) {
  if (client?.is_vip) return 'vip';
  if (client?.is_active === false) return 'inactive';
  return 'active';
}

function getSubscriptionStatusMeta(status) {
  const map = {
    active:             { label: 'Ativa',        color: '#00e676', bg: 'rgba(0,230,118,.1)',    border: 'rgba(0,230,118,.18)' },
    past_due:           { label: 'Inadimplente', color: '#ff1744', bg: 'rgba(255,23,68,.1)',    border: 'rgba(255,23,68,.18)' },
    paused:             { label: 'Pausada',       color: '#f97316', bg: 'rgba(249,115,22,.1)',  border: 'rgba(249,115,22,.18)' },
    canceled:           { label: 'Cancelada',     color: '#5a6888', bg: 'rgba(90,104,136,.12)', border: 'rgba(90,104,136,.18)' },
    pending_activation: { label: 'Pendente',      color: '#4fc3f7', bg: 'rgba(79,195,247,.1)',  border: 'rgba(79,195,247,.18)' },
    trialing:           { label: 'Trial',         color: '#9c6fff', bg: 'rgba(156,111,255,.1)', border: 'rgba(156,111,255,.18)' },
  };
  return map[status] || map.active;
}

function getInvoiceStatusMeta(status) {
  const map = {
    paid:     { label: 'Pago',      color: '#00e676' },
    failed:   { label: 'Falhou',    color: '#ff1744' },
    pending:  { label: 'Pendente',  color: '#f97316' },
    canceled: { label: 'Cancelado', color: '#5a6888' },
    refunded: { label: 'Estornado', color: '#9c6fff' },
    expired:  { label: 'Expirado',  color: '#f97316' },
  };
  return map[status] || map.pending;
}

function getAppointmentStatusMeta(status) {
  const map = {
    completed:   { label: 'Feito',        color: '#00e676', bg: 'rgba(0,230,118,.1)' },
    in_progress: { label: 'Em andamento', color: '#4fc3f7', bg: 'rgba(79,195,247,.1)' },
    confirmed:   { label: 'Confirmado',   color: '#9c6fff', bg: 'rgba(156,111,255,.1)' },
    pending:     { label: 'Agendado',     color: '#c0cce8', bg: 'rgba(255,255,255,.04)' },
    cancelled:   { label: 'Cancelado',    color: '#ff1744', bg: 'rgba(255,23,68,.1)' },
    no_show:     { label: 'No-show',      color: '#f97316', bg: 'rgba(249,115,22,.1)' },
  };
  return map[status] || map.pending;
}

function getClientStatusMeta(status) {
  const map = {
    vip:      { label: '✦ VIP', text: '#ffd700', bg: 'rgba(255,215,0,.1)' },
    active:   { label: 'Ativo',  text: '#00e676', bg: 'rgba(0,230,118,.1)' },
    inactive: { label: 'Inativo',text: '#f97316', bg: 'rgba(249,115,22,.1)' },
  };
  return map[status] || map.active;
}

function getLatestCycle(subscription) {
  const cycles = Array.isArray(subscription?.subscription_cycles) ? [...subscription.subscription_cycles] : [];
  if (!cycles.length) return null;
  cycles.sort((a, b) => Number(b?.cycle_number || 0) - Number(a?.cycle_number || 0));
  return cycles[0] || null;
}

function getLatestInvoice(subscription) {
  const invoices = Array.isArray(subscription?.subscription_invoices) ? [...subscription.subscription_invoices] : [];
  if (!invoices.length) return null;
  invoices.sort((a, b) => new Date(b?.created_at || b?.due_at || 0).getTime() - new Date(a?.created_at || a?.due_at || 0).getTime());
  return invoices[0] || null;
}

function getLatestAppointment(appointments = []) {
  const safe = Array.isArray(appointments) ? [...appointments] : [];
  if (!safe.length) return null;
  safe.sort((a, b) => new Date(b?.scheduled_at || 0).getTime() - new Date(a?.scheduled_at || 0).getTime());
  return safe[0] || null;
}

function getAppointmentBarberName(appointment) {
  const nested = appointment?.barber_profiles?.users;
  if (Array.isArray(nested)) return nested[0]?.name || 'Barbeiro';
  if (nested?.name) return nested.name;
  return 'Barbeiro';
}

function getAppointmentServiceName(appointment) {
  return appointment?.services?.name || appointment?.service_name || 'Serviço';
}

function getInvoicePaymentUrl(invoice) {
  return invoice?.payment_url || invoice?.checkout_url || invoice?.external_url ||
    invoice?.gateway_checkout_url || invoice?.gateway_payment_url || invoice?.hosted_url ||
    invoice?.metadata?.payment_url || invoice?.metadata?.checkout_url ||
    invoice?.metadata?.init_point || invoice?.metadata?.mercadopago_init_point || '';
}

function getInvoiceGatewayReference(invoice) {
  return invoice?.external_invoice_id || invoice?.gateway_reference || invoice?.gateway_external_id ||
    invoice?.external_reference || invoice?.payment_reference ||
    invoice?.metadata?.external_reference || invoice?.metadata?.preference_id || '';
}

function getSubscriptionAmountCents(subscription) {
  const raw = subscription?.raw || {};
  const possibleValues = [
    raw.amount_cents, raw.plan_price_cents, raw.price_cents, raw.monthly_amount_cents,
    raw.plans?.amount_cents, raw.plans?.price_cents,
    Number(raw.plans?.price || 0) * 100,
    Number(raw.plans?.monthly_price || 0) * 100,
  ];
  const found = possibleValues.find(v => Number.isFinite(Number(v)) && Number(v) > 0);
  return Math.round(Number(found || 0));
}

function getSubscriptionDueDateIso(subscription) {
  const latestInvoice = getLatestInvoice(subscription?.raw);
  const rawValue = subscription?.raw?.next_billing_at || subscription?.raw?.current_period_end ||
    latestInvoice?.due_at || latestInvoice?.created_at;
  if (rawValue) {
    const parsed = new Date(rawValue);
    if (!Number.isNaN(parsed.getTime())) return parsed.toISOString();
  }
  return new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString();
}

function buildMercadoPagoInvoicePayloadVariants(subscription, preference, externalReference) {
  const amountCents = getSubscriptionAmountCents(subscription);
  const dueAt = getSubscriptionDueDateIso(subscription);
  const basePayload = {
    subscription_id: subscription.id, due_at: dueAt,
    billing_reason: 'manual_charge', gateway_provider: 'mercadopago',
    status: 'pending', gateway_reference: externalReference,
    external_invoice_id: externalReference, payment_url: preference.initPoint,
    sandbox_payment_url: preference.sandboxInitPoint,
    metadata: {
      provider: 'mercadopago', preference_id: preference.preferenceId,
      external_reference: externalReference, init_point: preference.initPoint,
      sandbox_init_point: preference.sandboxInitPoint,
    },
  };
  return [
    { ...basePayload, amount_cents: amountCents },
    { ...basePayload, amount: Number((amountCents / 100).toFixed(2)) },
    { ...basePayload, amount_cents: amountCents, checkout_url: preference.initPoint },
  ];
}

async function createMercadoPagoInvoice(subscription, preference, externalReference) {
  const variants = buildMercadoPagoInvoicePayloadVariants(subscription, preference, externalReference);
  let lastError = null;
  for (const payload of variants) {
    try { return await createManualInvoice(payload); }
    catch (error) { lastError = error; }
  }
  throw lastError || new Error('Não foi possível registrar a cobrança do Mercado Pago.');
}

async function copyTextToClipboard(text) {
  const safeText = String(text || '').trim();
  if (!safeText) throw new Error('Não há link disponível para copiar.');
  if (navigator.clipboard?.writeText) { await navigator.clipboard.writeText(safeText); return; }
  const textarea = document.createElement('textarea');
  textarea.value = safeText;
  textarea.setAttribute('readonly', 'readonly');
  textarea.style.position = 'absolute';
  textarea.style.left = '-9999px';
  document.body.appendChild(textarea);
  textarea.select();
  document.execCommand('copy');
  document.body.removeChild(textarea);
}

// ─── Convite de cliente ────────────────────────────────────────────────────────

let _inviteShopData = null;
let _inviteChannel  = 'link'; // 'link' | 'whatsapp' | 'qr'

async function loadInviteShopData() {
  if (_inviteShopData) return _inviteShopData;
  try {
    const data = await apiFetch('/api/auth/me');
    _inviteShopData = data?.barbershop || data?.barbershops || null;
  } catch { _inviteShopData = null; }
  return _inviteShopData;
}

function buildInviteLink(slug) {
  return `https://bbarberflow.com.br/client/cadastro/${encodeURIComponent(slug)}`;
}

function getDefaultInviteMessage(shopName, link) {
  return `Olá! Temos uma novidade para você 🎉\n\nAgora você pode agendar seus horários na ${shopName} direto pelo celular, de forma fácil e rápida.\n\nCrie sua conta gratuitamente pelo link abaixo e já garanta seu próximo agendamento:\n\n👉 ${link}\n\nEstamos te esperando! 💈`;
}

function buildWhatsAppUrl(message) {
  return `https://wa.me/?text=${encodeURIComponent(message)}`;
}

function buildQrImageUrl(text) {
  return `https://api.qrserver.com/v1/create-qr-code/?size=180x180&data=${encodeURIComponent(text)}&color=9c6fff&bgcolor=080b18&format=png&margin=2`;
}

async function loadInviteStats(barbershopId) {
  try {
    const data = await apiFetch(`/api/barbershops/${barbershopId}/invites/stats`);
    return {
      sent:      data?.sent      ?? '—',
      converted: data?.converted ?? '—',
      rate:      data?.rate != null ? `${Math.round(data.rate)}%` : '—',
    };
  } catch {
    return { sent: '—', converted: '—', rate: '—' };
  }
}

function setInviteStats(stats) {
  const s = document.getElementById('invite-stat-sent');
  const c = document.getElementById('invite-stat-converted');
  const r = document.getElementById('invite-stat-rate');
  if (s) s.textContent = stats.sent;
  if (c) c.textContent = stats.converted;
  if (r) r.textContent = stats.rate;
}

// SVG icons inline
const _iCopy = `<svg width="13" height="13" viewBox="0 0 13 13" fill="none"><rect x="4" y="4" width="8" height="8" rx="1.5" stroke="currentColor" stroke-width="1.5"/><path d="M9 4V2.5A1.5 1.5 0 007.5 1h-5A1.5 1.5 0 001 2.5v5A1.5 1.5 0 002.5 9H4" stroke="currentColor" stroke-width="1.5"/></svg>`;
const _iCheck = `<svg width="13" height="13" viewBox="0 0 13 13" fill="none"><path d="M2 7l3 3 6-6" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/></svg>`;
const _iWa = `<svg width="16" height="16" viewBox="0 0 16 16" fill="none"><path d="M8 1.5A6.5 6.5 0 001.5 8c0 1.15.3 2.24.82 3.18L1.5 14.5l3.42-.8A6.5 6.5 0 108 1.5z" stroke="currentColor" stroke-width="1.5"/><path d="M6 6.5c0-.28.22-.5.5-.5h.5a.5.5 0 01.5.5v.5c0 .83.5 1.5 1 2s1.17 1 2 1h.5a.5.5 0 01.5.5v.5a.5.5 0 01-.5.5h-.5c-1.1 0-2.18-.5-3-1.32A4.6 4.6 0 016 7v-.5z" fill="currentColor"/></svg>`;
const _iDown = `<svg width="14" height="14" viewBox="0 0 14 14" fill="none"><path d="M7 1v8M4 6l3 3 3-3" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"/><path d="M2 10v1a1 1 0 001 1h8a1 1 0 001-1v-1" stroke="currentColor" stroke-width="1.6" stroke-linecap="round"/></svg>`;

function _renderInviteHtml(link, message) {
  const ch = _inviteChannel;
  return `
    <div class="invite-modal-header">
      <div class="invite-modal-icon">
        <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
          <path d="M10 2C5.58 2 2 5.58 2 10s3.58 8 8 8 8-3.58 8-8-3.58-8-8-8zm1 11H9v-2h2v2zm0-4H9V7h2v2z" fill="#4fc3f7"/>
        </svg>
      </div>
      <div class="invite-modal-title-block">
        <div class="invite-modal-title">Convidar cliente</div>
        <div class="invite-modal-sub">Escolha como compartilhar o cadastro</div>
      </div>
      <button type="button" class="invite-modal-close" id="invite-modal-x">
        <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
          <path d="M1 1l12 12M13 1L1 13" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/>
        </svg>
      </button>
    </div>

    <div class="invite-channels">
      <div class="invite-ch ${ch === 'link'     ? 'active' : ''}" data-channel="link">
        <div class="invite-ch-icon" style="background:#0e1e38">
          <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
            <path d="M6.5 9.5a3.5 3.5 0 004.95 0l2-2a3.5 3.5 0 00-4.95-4.95l-1 1" stroke="#4fc3f7" stroke-width="1.6" stroke-linecap="round"/>
            <path d="M9.5 6.5a3.5 3.5 0 00-4.95 0l-2 2a3.5 3.5 0 004.95 4.95l1-1" stroke="#4fc3f7" stroke-width="1.6" stroke-linecap="round"/>
          </svg>
        </div>
        <div class="invite-ch-label">Link</div>
      </div>
      <div class="invite-ch ${ch === 'whatsapp' ? 'active' : ''}" data-channel="whatsapp">
        <div class="invite-ch-icon" style="background:#062018">
          <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
            <path d="M8 1.5A6.5 6.5 0 001.5 8c0 1.15.3 2.24.82 3.18L1.5 14.5l3.42-.8A6.5 6.5 0 108 1.5z" stroke="#25D366" stroke-width="1.5"/>
            <path d="M6 6.5c0-.28.22-.5.5-.5h.5a.5.5 0 01.5.5v.5c0 .83.5 1.5 1 2s1.17 1 2 1h.5a.5.5 0 01.5.5v.5a.5.5 0 01-.5.5h-.5c-1.1 0-2.18-.5-3-1.32A4.6 4.6 0 016 7v-.5z" fill="#25D366"/>
          </svg>
        </div>
        <div class="invite-ch-label">WhatsApp</div>
      </div>
      <div class="invite-ch ${ch === 'qr'       ? 'active' : ''}" data-channel="qr">
        <div class="invite-ch-icon" style="background:#1a1030">
          <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
            <rect x="1" y="1" width="5" height="5" rx="1" stroke="#9c6fff" stroke-width="1.5"/>
            <rect x="10" y="1" width="5" height="5" rx="1" stroke="#9c6fff" stroke-width="1.5"/>
            <rect x="1" y="10" width="5" height="5" rx="1" stroke="#9c6fff" stroke-width="1.5"/>
            <rect x="3" y="3" width="1" height="1" fill="#9c6fff"/>
            <rect x="12" y="3" width="1" height="1" fill="#9c6fff"/>
            <rect x="3" y="12" width="1" height="1" fill="#9c6fff"/>
            <rect x="10" y="10" width="1.5" height="1.5" fill="#9c6fff"/>
            <rect x="12.5" y="10" width="1.5" height="1.5" fill="#9c6fff"/>
            <rect x="10" y="12.5" width="1.5" height="1.5" fill="#9c6fff"/>
            <rect x="12.5" y="12.5" width="1.5" height="1.5" fill="#9c6fff"/>
          </svg>
        </div>
        <div class="invite-ch-label">QR Code</div>
      </div>
    </div>

    <!-- PAINEL LINK -->
    <div class="invite-panel" id="invite-panel-link" style="display:${ch === 'link' ? 'flex' : 'none'}">
      <div>
        <div class="invite-field-label">Link de cadastro</div>
        <div class="invite-link-row">
          <input class="invite-link-input" id="invite-link-value" type="text" readonly value="${escapeHtml(link)}"/>
          <button type="button" class="invite-copy-link-btn" id="invite-copy-link-btn">
            ${_iCopy} Copiar
          </button>
        </div>
        <div id="invite-link-feedback" class="invite-feedback"></div>
      </div>
      <div>
        <div class="invite-field-label">Mensagem de convite</div>
        <textarea class="invite-msg-textarea" id="invite-link-msg" maxlength="1000">${escapeHtml(message)}</textarea>
        <div class="invite-char-row"><span id="invite-link-char">${message.length} caracteres</span></div>
      </div>
      <div class="invite-actions">
        <button type="button" class="invite-btn-ghost invite-close-trigger">Fechar</button>
        <button type="button" class="invite-btn-secondary" id="invite-copy-msg-btn">
          ${_iCopy} Copiar mensagem
        </button>
      </div>
      <div id="invite-msg-feedback" class="invite-feedback"></div>
    </div>

    <!-- PAINEL WHATSAPP -->
    <div class="invite-panel" id="invite-panel-whatsapp" style="display:${ch === 'whatsapp' ? 'flex' : 'none'}">
      <div>
        <div class="invite-field-label">Mensagem de convite</div>
        <textarea class="invite-msg-textarea" id="invite-wa-msg" maxlength="1000">${escapeHtml(message)}</textarea>
        <div class="invite-char-row"><span id="invite-wa-char">${message.length} caracteres</span></div>
      </div>
      <div class="invite-actions">
        <button type="button" class="invite-btn-ghost invite-close-trigger">Fechar</button>
        <a class="invite-btn-whatsapp" id="invite-wa-link"
           href="${escapeHtml(buildWhatsAppUrl(message))}" target="_blank" rel="noopener">
          ${_iWa} Abrir WhatsApp
        </a>
      </div>
    </div>

    <!-- PAINEL QR -->
    <div class="invite-panel" id="invite-panel-qr" style="display:${ch === 'qr' ? 'flex' : 'none'}">
      <div class="invite-qr-wrap">
        <div class="invite-qr-box">
          <img src="${escapeHtml(buildQrImageUrl(link))}"
               width="180" height="180" alt="QR Code de cadastro"
               style="display:block;border-radius:8px;"/>
        </div>
        <div class="invite-qr-hint">
          Aponte a câmera do celular para o código<br>
          O cliente será direcionado ao cadastro
        </div>
      </div>
      <div class="invite-actions">
        <button type="button" class="invite-btn-ghost invite-close-trigger">Fechar</button>
        <a class="invite-btn-qr-download"
           href="${escapeHtml(buildQrImageUrl(link))}" download="convite-qrcode.png" target="_blank">
          ${_iDown} Baixar QR Code
        </a>
      </div>
    </div>

    <div class="invite-divider"></div>
    <div class="invite-stats-row">
      <div class="invite-stat">
        <div class="invite-stat-val" id="invite-stat-sent">—</div>
        <div class="invite-stat-lbl">Convites enviados</div>
      </div>
      <div class="invite-stat">
        <div class="invite-stat-val" id="invite-stat-converted">—</div>
        <div class="invite-stat-lbl">Cadastros realizados</div>
      </div>
      <div class="invite-stat">
        <div class="invite-stat-val" id="invite-stat-rate">—</div>
        <div class="invite-stat-lbl">Taxa de conversão</div>
      </div>
    </div>
  `;
}

function openInviteModal() {
  _inviteChannel = 'link';

  let overlay = document.getElementById('client-invite-modal');
  if (!overlay) {
    overlay = document.createElement('div');
    overlay.id = 'client-invite-modal';
    overlay.className = 'modal-overlay invite-modal-overlay';
    overlay.innerHTML = `<div class="modal invite-modal-box" id="client-invite-inner"></div>`;
    overlay.addEventListener('click', e => { if (e.target === overlay) closeInviteModal(); });
    document.body.appendChild(overlay);
  }

  document.getElementById('client-invite-inner').innerHTML =
    `<div class="invite-loading">Carregando dados da barbearia...</div>`;
  overlay.style.display = 'flex';

  _loadAndRenderInvite();
}

async function _loadAndRenderInvite() {
  const inner = document.getElementById('client-invite-inner');
  if (!inner) return;

  const shop = await loadInviteShopData();

  if (!shop?.slug) {
    inner.innerHTML = `
      <div class="invite-modal-header">
        <div class="invite-modal-title-block">
          <div class="invite-modal-title">Convidar cliente</div>
          <div class="invite-modal-sub" style="color:#ff8a8a">
            Não foi possível carregar os dados da barbearia.
          </div>
        </div>
        <button type="button" class="invite-modal-close" id="invite-modal-x">
          <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
            <path d="M1 1l12 12M13 1L1 13" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/>
          </svg>
        </button>
      </div>
      <div class="invite-panel" style="display:flex">
        <div class="invite-actions">
          <button type="button" class="invite-btn-ghost invite-close-trigger">Fechar</button>
        </div>
      </div>`;
    _bindInviteEvents(null, null, null);
    return;
  }

  const link    = buildInviteLink(shop.slug);
  const message = shop.invite_message || getDefaultInviteMessage(shop.name || 'nossa barbearia', link);

  inner.innerHTML = _renderInviteHtml(link, message);
  _bindInviteEvents(link, message, shop.id);

  loadInviteStats(shop.id).then(setInviteStats);
}

function closeInviteModal() {
  const overlay = document.getElementById('client-invite-modal');
  if (overlay) overlay.style.display = 'none';
}

function _switchInviteChannel(channel) {
  _inviteChannel = channel;
  ['link', 'whatsapp', 'qr'].forEach(ch => {
    const panel = document.getElementById(`invite-panel-${ch}`);
    const btn   = document.querySelector(`.invite-ch[data-channel="${ch}"]`);
    if (panel) panel.style.display = ch === channel ? 'flex' : 'none';
    if (btn)   btn.classList.toggle('active', ch === channel);
  });
}

async function _inviteCopy(text, btnEl, feedbackEl, okMsg) {
  try {
    await copyTextToClipboard(text);
    if (feedbackEl) { feedbackEl.textContent = okMsg; feedbackEl.style.color = '#00e676'; }
    if (btnEl) {
      const orig = btnEl.innerHTML;
      const origBg  = btnEl.style.background;
      const origBdr = btnEl.style.borderColor;
      const origClr = btnEl.style.color;
      btnEl.innerHTML       = `${_iCheck} Copiado!`;
      btnEl.style.background  = '#063020';
      btnEl.style.borderColor = '#0f6e56';
      btnEl.style.color       = '#5DCAA5';
      setTimeout(() => {
        btnEl.innerHTML         = orig;
        btnEl.style.background  = origBg;
        btnEl.style.borderColor = origBdr;
        btnEl.style.color       = origClr;
      }, 2000);
    }
  } catch {
    if (feedbackEl) { feedbackEl.textContent = 'Não foi possível copiar.'; feedbackEl.style.color = '#ff8a8a'; }
  }
}

// registra o envio no backend (fire-and-forget)
async function _trackInviteSent(barbershopId, channel) {
  try {
    await apiFetch(`/api/barbershops/${barbershopId}/invites`, {
      method: 'POST',
      body: JSON.stringify({ channel }),
    });
  } catch { /* silencioso */ }
}

function _bindInviteEvents(link, message, shopId) {
  document.getElementById('invite-modal-x')?.addEventListener('click', closeInviteModal);
  document.querySelectorAll('.invite-close-trigger').forEach(el =>
    el.addEventListener('click', closeInviteModal)
  );

  document.querySelectorAll('.invite-ch[data-channel]').forEach(el =>
    el.addEventListener('click', () => _switchInviteChannel(el.dataset.channel))
  );

  if (!link) return;

  // copiar link
  document.getElementById('invite-copy-link-btn')?.addEventListener('click', async () => {
    await _inviteCopy(
      link,
      document.getElementById('invite-copy-link-btn'),
      document.getElementById('invite-link-feedback'),
      '✓ Link copiado!'
    );
    if (shopId) _trackInviteSent(shopId, 'link');
  });

  // copiar mensagem
  document.getElementById('invite-copy-msg-btn')?.addEventListener('click', async () => {
    const msg = document.getElementById('invite-link-msg')?.value || message;
    await _inviteCopy(
      msg,
      document.getElementById('invite-copy-msg-btn'),
      document.getElementById('invite-msg-feedback'),
      '✓ Mensagem copiada!'
    );
    if (shopId) _trackInviteSent(shopId, 'link');
  });

  // contador painel link
  document.getElementById('invite-link-msg')?.addEventListener('input', e => {
    const el = document.getElementById('invite-link-char');
    if (el) el.textContent = `${e.target.value.length} caracteres`;
  });

  // painel whatsapp — atualiza href e contador ao editar
  document.getElementById('invite-wa-msg')?.addEventListener('input', e => {
    const waLink  = document.getElementById('invite-wa-link');
    const counter = document.getElementById('invite-wa-char');
    if (waLink)  waLink.href       = buildWhatsAppUrl(e.target.value);
    if (counter) counter.textContent = `${e.target.value.length} caracteres`;
  });

  // tracking ao clicar em Abrir WhatsApp
  document.getElementById('invite-wa-link')?.addEventListener('click', () => {
    if (shopId) _trackInviteSent(shopId, 'whatsapp');
  });

  // tracking ao baixar QR
  document.querySelector('.invite-btn-qr-download')?.addEventListener('click', () => {
    if (shopId) _trackInviteSent(shopId, 'qr');
  });
}

// ─── Mappers ──────────────────────────────────────────────────────────────────

function mapClientSummaryFromApi(client) {
  return {
    id: client.id,
    name: client.name || 'Cliente',
    phone: client.phone || '',
    whatsapp: client.whatsapp || client.phone || '',
    lastService: client.last_service_name || client.lastService || '—',
    lastCut: client.last_visit_at ? formatDateDisplay(client.last_visit_at) : client.lastCut || '—',
    visits: Number(client.visits || client.total_visits || client.completed_appointments_count || 0),
    totalSpent: Number(client.total_spent || client.totalSpent || 0),
    status: normalizeClientStatusFromApi(client),
    notes: client.notes || '',
    raw: client,
  };
}

function mapClientDetailFromApi(client) {
  const appointments = Array.isArray(client?.appointments) ? [...client.appointments] : [];
  appointments.sort((a, b) => new Date(b?.scheduled_at || 0).getTime() - new Date(a?.scheduled_at || 0).getTime());
  const completedAppointments = appointments.filter(item => item.status === 'completed');
  const latestAppointment = getLatestAppointment(appointments);
  const visits = completedAppointments.length || Number(client.visits || client.total_visits || 0);
  const totalSpent = completedAppointments.reduce((sum, item) => sum + Number(item.final_price || 0), 0) || Number(client.total_spent || 0);
  return {
    id: client.id,
    name: client.name || 'Cliente',
    phone: client.phone || '',
    whatsapp: client.whatsapp || client.phone || '',
    status: normalizeClientStatusFromApi(client),
    notes: client.notes || '',
    lastService: latestAppointment ? getAppointmentServiceName(latestAppointment) : '—',
    lastCut: latestAppointment ? formatDateTimeDisplay(latestAppointment.scheduled_at) : '—',
    visits,
    totalSpent,
    appointments,
    raw: client,
  };
}

function mapSubscriptionDetail(subscription) {
  const latestCycle   = getLatestCycle(subscription);
  const latestInvoice = getLatestInvoice(subscription);
  return {
    id: subscription.id,
    planName: subscription?.plans?.name || 'Plano',
    status: subscription.status || 'pending_activation',
    nextBillingAt: formatDateDisplay(subscription.next_billing_at || subscription.current_period_end),
    paymentMethod: subscription.payment_method_label || latestInvoice?.payment_method || '—',
    remainingHaircuts: Number(latestCycle?.remaining_haircuts || 0),
    remainingBeards: Number(latestCycle?.remaining_beards || 0),
    lastInvoiceStatus: latestInvoice?.status || 'pending',
    raw: subscription,
  };
}

function getClientSummaryById(clientId) {
  return clientesState.items.find(item => item.id === clientId) || null;
}

function getFilteredClients() {
  const term = clientesState.searchTerm.trim().toLowerCase();
  if (!term) return clientesState.items;
  return clientesState.items.filter(client =>
    [client.name, client.phone, client.whatsapp, client.lastService, client.lastCut, getClientStatusMeta(client.status).label]
      .join(' ').toLowerCase().includes(term)
  );
}

function getSubscriptionActionButtons(subscription) {
  const buttons = [];
  if (subscription.status === 'pending_activation') {
    buttons.push({ action: 'activate', label: 'Ativar assinatura' });
    buttons.push({ action: 'cancel',   label: 'Cancelar assinatura' });
  }
  if (subscription.status === 'active' || subscription.status === 'trialing') {
    buttons.push({ action: 'pause',  label: 'Pausar assinatura' });
    buttons.push({ action: 'cancel', label: 'Cancelar assinatura' });
  }
  if (subscription.status === 'paused') {
    buttons.push({ action: 'reactivate', label: 'Reativar assinatura' });
    buttons.push({ action: 'cancel',     label: 'Cancelar assinatura' });
  }
  if (subscription.status === 'past_due') {
    buttons.push({ action: 'activate', label: 'Marcar como ativa' });
    buttons.push({ action: 'pause',    label: 'Pausar assinatura' });
    buttons.push({ action: 'cancel',   label: 'Cancelar assinatura' });
  }
  return buttons;
}

function getInvoiceActionButtons(invoice) {
  const buttons = [];
  if (invoice.status === 'pending') {
    buttons.push({ action: 'markPaid',   label: 'Marcar paga' });
    buttons.push({ action: 'markFailed', label: 'Marcar falha' });
    buttons.push({ action: 'cancel',     label: 'Cancelar' });
  }
  if (invoice.status === 'failed') {
    buttons.push({ action: 'markPaid', label: 'Marcar paga' });
    buttons.push({ action: 'cancel',   label: 'Cancelar' });
  }
  return buttons;
}

// ─── Render ───────────────────────────────────────────────────────────────────

function renderClientStatusPill(status) {
  const meta = getClientStatusMeta(status);
  return `<span class="pill" style="background:${meta.bg};color:${meta.text}">${meta.label}</span>`;
}

function renderClientRow(client) {
  return `
    <tr class="client-row" data-client-id="${escapeHtml(client.id)}" tabindex="0" role="button" title="Ver detalhes de ${escapeHtml(client.name)}">
      <td>
        <div class="client-name">${escapeHtml(client.name)}</div>
        <div class="client-service">${escapeHtml(client.lastService)}</div>
      </td>
      <td class="client-muted">${escapeHtml(client.whatsapp || client.phone || '—')}</td>
      <td>${escapeHtml(client.lastCut)}</td>
      <td>${escapeHtml(client.visits)}</td>
      <td class="client-spent ${client.status === 'vip' ? 'is-vip' : client.status === 'active' ? 'is-active' : 'is-inactive'}">
        ${escapeHtml(formatCurrency(client.totalSpent))}
      </td>
      <td>${renderClientStatusPill(client.status)}</td>
    </tr>
  `;
}

function renderClientsTableBody() {
  const clients = getFilteredClients();
  if (!clients.length) return `<tr><td colspan="6" class="clients-empty">Nenhum cliente encontrado para a busca informada.</td></tr>`;
  return clients.map(renderClientRow).join('');
}

function renderClientAppointments(detailClient) {
  const appointments = Array.isArray(detailClient?.appointments) ? detailClient.appointments.slice(0, 6) : [];
  if (!appointments.length) return `<div class="clients-modal-info-row">Nenhum atendimento encontrado para este cliente.</div>`;
  return `
    <div class="clients-history-list">
      ${appointments.map(appointment => {
        const meta = getAppointmentStatusMeta(appointment.status);
        return `
          <div class="clients-history-row">
            <div class="clients-history-main">
              <div class="clients-history-title">${escapeHtml(getAppointmentServiceName(appointment))}</div>
              <div class="clients-history-sub">
                ${escapeHtml(formatDateTimeDisplay(appointment.scheduled_at))}
                · ${escapeHtml(getAppointmentBarberName(appointment))}
                · ${escapeHtml(formatCurrency(appointment.final_price || 0))}
              </div>
            </div>
            <div class="clients-history-side">
              <span class="clients-status-chip" style="background:${meta.bg};color:${meta.color};">${escapeHtml(meta.label)}</span>
            </div>
          </div>`;
      }).join('')}
    </div>`;
}

function renderClientConsumptions(subscription) {
  const consumptions = Array.isArray(subscription?.raw?.subscription_consumptions)
    ? [...subscription.raw.subscription_consumptions] : [];
  consumptions.sort((a, b) => new Date(b?.created_at || 0).getTime() - new Date(a?.created_at || 0).getTime());
  if (!consumptions.length) return `<div class="clients-modal-info-row">Nenhum consumo registrado para esta assinatura.</div>`;
  return `
    <div class="clients-history-list">
      ${consumptions.slice(0, 6).map(c => `
        <div class="clients-history-row">
          <div class="clients-history-main">
            <div class="clients-history-title">${escapeHtml(c?.services?.name || c.consumed_type || 'Consumo')}</div>
            <div class="clients-history-sub">
              ${escapeHtml(formatDateTimeDisplay(c.created_at))}
              · Quantidade: ${escapeHtml(c.quantity || 1)}
              · ${escapeHtml(c.notes || 'Sem observações')}
            </div>
          </div>
        </div>`).join('')}
    </div>`;
}

function renderClientInvoices(subscription) {
  if (!subscription) return `<div class="clients-modal-info-row">Nenhuma cobrança encontrada para esta assinatura.</div>`;
  const invoices = Array.isArray(subscription?.raw?.subscription_invoices)
    ? [...subscription.raw.subscription_invoices] : [];
  invoices.sort((a, b) => new Date(b?.created_at || b?.due_at || 0).getTime() - new Date(a?.created_at || a?.due_at || 0).getTime());
  return `
    <div class="clients-billing-toolbar">
      <button type="button" class="clients-action-btn clients-action-btn--primary clients-generate-charge-action"
        data-subscription-id="${escapeHtml(subscription.id)}">
        Gerar cobrança MP
      </button>
    </div>
    ${invoices.length ? `
      <div class="clients-invoice-list">
        ${invoices.map(invoice => {
          const invoiceMeta = getInvoiceStatusMeta(invoice.status);
          const actionButtons = getInvoiceActionButtons(invoice);
          const paymentUrl = getInvoicePaymentUrl(invoice);
          const gatewayReference = getInvoiceGatewayReference(invoice);
          return `
            <div class="clients-invoice-row">
              <div class="clients-invoice-main">
                <div class="clients-invoice-title">${escapeHtml(formatCurrency((invoice.amount_cents || 0) / 100))}</div>
                <div class="clients-invoice-sub">
                  Vencimento: ${escapeHtml(formatDateDisplay(invoice.due_at))}
                  · Motivo: ${escapeHtml(invoice.billing_reason || '—')}
                  · Gateway: ${escapeHtml(invoice.gateway_provider || '—')}
                  ${gatewayReference ? `· Ref: ${escapeHtml(gatewayReference)}` : ''}
                </div>
                ${paymentUrl ? `
                  <div class="clients-link-box">
                    <div class="clients-link-text">${escapeHtml(paymentUrl)}</div>
                    <button type="button" class="clients-action-btn clients-invoice-copy-link"
                      data-payment-url="${escapeHtml(paymentUrl)}">
                      Copiar link
                    </button>
                  </div>` : ''}
                ${actionButtons.length ? `
                  <div class="clients-action-grid clients-action-grid--nested">
                    ${actionButtons.map(btn => `
                      <button type="button" class="clients-action-btn clients-invoice-action"
                        data-invoice-id="${escapeHtml(invoice.id)}" data-action="${escapeHtml(btn.action)}">
                        ${escapeHtml(btn.label)}
                      </button>`).join('')}
                  </div>` : ''}
              </div>
              <div class="clients-invoice-side">
                <span class="clients-status-chip" style="background:rgba(255,255,255,.04);color:${invoiceMeta.color};">
                  ${escapeHtml(invoiceMeta.label)}
                </span>
              </div>
            </div>`;
        }).join('')}
      </div>` : `<div class="clients-modal-info-row">Nenhuma cobrança encontrada para esta assinatura.</div>`}`;
}

function renderClientSubscription(subscription) {
  if (!subscription) return `<div class="clients-modal-info-row">Este cliente não possui assinatura cadastrada no momento.</div>`;
  const statusMeta  = getSubscriptionStatusMeta(subscription.status);
  const invoiceMeta = getInvoiceStatusMeta(subscription.lastInvoiceStatus);
  const actionButtons = getSubscriptionActionButtons(subscription);
  return `
    <div class="clients-subscription-box">
      <div class="clients-subscription-header">
        <div>
          <div class="clients-subscription-title">${escapeHtml(subscription.planName)}</div>
          <div class="clients-subscription-sub">
            Próxima cobrança: ${escapeHtml(subscription.nextBillingAt)}
            · Pagamento: ${escapeHtml(subscription.paymentMethod)}
          </div>
        </div>
        <span class="clients-status-chip" style="background:${statusMeta.bg};color:${statusMeta.color};border:1px solid ${statusMeta.border};">
          ${escapeHtml(statusMeta.label)}
        </span>
      </div>
      <div class="clients-subscription-grid">
        <div class="mini-card">
          <div class="mini-lbl">Saldo de cortes</div>
          <div class="mini-val" style="font-size:16px;color:#00e676">${escapeHtml(subscription.remainingHaircuts)}</div>
        </div>
        <div class="mini-card">
          <div class="mini-lbl">Saldo de barbas</div>
          <div class="mini-val" style="font-size:16px;color:#9c6fff">${escapeHtml(subscription.remainingBeards)}</div>
        </div>
      </div>
      <div class="clients-modal-info-row">
        <strong>Última cobrança:</strong>
        <span style="color:${invoiceMeta.color};font-weight:700;">${escapeHtml(invoiceMeta.label)}</span>
      </div>
      <div>
        <div class="clients-section-title">Ações da assinatura</div>
        ${actionButtons.length ? `
          <div class="clients-action-grid">
            ${actionButtons.map(btn => `
              <button type="button" class="clients-action-btn clients-subscription-action"
                data-subscription-id="${escapeHtml(subscription.id)}" data-action="${escapeHtml(btn.action)}">
                ${escapeHtml(btn.label)}
              </button>`).join('')}
          </div>` : `<div class="clients-modal-info-row">Nenhuma ação disponível para o status atual.</div>`}
      </div>
    </div>`;
}

function renderClientDetails(detailClient, subscription) {
  const statusMeta = getClientStatusMeta(detailClient.status);
  return `
    <div class="clients-modal-body">
      <div>
        <div class="modal-title" style="margin:0;">${escapeHtml(detailClient.name)}</div>
        <div class="modal-sub" style="margin-top:4px;">Ficha do cliente</div>
      </div>
      <div class="clients-modal-grid">
        <div class="mini-card"><div class="mini-lbl">Visitas</div><div class="mini-val" style="color:#4fc3f7">${escapeHtml(detailClient.visits)}</div></div>
        <div class="mini-card"><div class="mini-lbl">Total gasto</div><div class="mini-val" style="color:#ffd700">${escapeHtml(formatCompactCurrency(detailClient.totalSpent))}</div></div>
        <div class="mini-card"><div class="mini-lbl">Último atendimento</div><div class="mini-val" style="font-size:15px;">${escapeHtml(detailClient.lastCut)}</div></div>
        <div class="mini-card"><div class="mini-lbl">Status do cliente</div><div class="mini-val" style="font-size:15px;color:${statusMeta.text}">${escapeHtml(statusMeta.label)}</div></div>
      </div>
      <div class="clients-modal-info">
        <div class="clients-modal-info-row"><strong>WhatsApp:</strong> ${escapeHtml(detailClient.whatsapp || '—')}</div>
        <div class="clients-modal-info-row"><strong>Telefone:</strong> ${escapeHtml(detailClient.phone || '—')}</div>
        <div class="clients-modal-info-row"><strong>Serviço mais recente:</strong> ${escapeHtml(detailClient.lastService)}</div>
        <div class="clients-modal-info-row"><strong>Observações:</strong> ${escapeHtml(detailClient.notes || '—')}</div>
      </div>
      <div><div class="clients-section-title">Assinatura</div>${renderClientSubscription(subscription)}</div>
      <div><div class="clients-section-title">Cobranças</div>${renderClientInvoices(subscription)}</div>
      <div><div class="clients-section-title">Consumos da assinatura</div>${renderClientConsumptions(subscription)}</div>
      <div><div class="clients-section-title">Histórico de atendimentos</div>${renderClientAppointments(detailClient)}</div>
      <div id="client-detail-feedback" class="clients-form-feedback"></div>
      <div class="modal-buttons" style="margin-top:10px;">
        <button type="button" class="btn-cancel" id="client-modal-close">Fechar</button>
        <button type="button" class="btn-save" id="client-edit-button" data-client-id="${escapeHtml(detailClient.id)}">Editar informações</button>
      </div>
    </div>`;
}

function renderClientForm(mode, client = null) {
  const isEdit = mode === 'edit';
  const safeClient = client || { name: '', phone: '', whatsapp: '', status: 'active', notes: '' };
  return `
    <div class="clients-modal-body">
      <div>
        <div class="modal-title" style="margin:0;">${isEdit ? 'Editar cliente' : 'Novo cliente'}</div>
        <div class="modal-sub" style="margin-top:4px;">${isEdit ? 'Atualize os dados principais do cliente.' : 'Preencha os dados para cadastrar um novo cliente.'}</div>
      </div>
      <form id="client-form" class="clients-form">
        <div class="clients-form-grid">
          <div>
            <div class="color-section-label">Nome</div>
            <input class="modal-input" id="client-name-input" name="name" type="text" maxlength="${CLIENT_NAME_MAX_LENGTH}" value="${escapeHtml(safeClient.name)}" placeholder="Nome do cliente"/>
            <div class="clients-field-counter-wrap"><span id="client-name-counter">0 / ${CLIENT_NAME_MAX_LENGTH}</span></div>
          </div>
          <div>
            <div class="color-section-label">WhatsApp</div>
            <input class="modal-input" id="client-whatsapp-input" name="whatsapp" type="text" maxlength="${CLIENT_WHATSAPP_MAX_LENGTH}" value="${escapeHtml(safeClient.whatsapp)}" placeholder="(11) 99999-9999"/>
            <div class="clients-field-counter-wrap"><span id="client-whatsapp-counter">0 / ${CLIENT_WHATSAPP_MAX_LENGTH}</span></div>
          </div>
          <div>
            <div class="color-section-label">Telefone</div>
            <input class="modal-input" id="client-phone-input" name="phone" type="text" maxlength="${CLIENT_PHONE_MAX_LENGTH}" value="${escapeHtml(safeClient.phone)}" placeholder="(11) 99999-9999"/>
            <div class="clients-field-counter-wrap"><span id="client-phone-counter">0 / ${CLIENT_PHONE_MAX_LENGTH}</span></div>
          </div>
          <div>
            <div class="color-section-label">Status</div>
            <select class="modal-input" name="status">
              <option value="vip"      ${safeClient.status === 'vip'      ? 'selected' : ''}>VIP</option>
              <option value="active"   ${safeClient.status === 'active'   ? 'selected' : ''}>Ativo</option>
              <option value="inactive" ${safeClient.status === 'inactive' ? 'selected' : ''}>Inativo</option>
            </select>
          </div>
        </div>
        <div>
          <div class="color-section-label">Observações</div>
          <textarea class="modal-input clients-textarea" id="client-notes-input" name="notes" maxlength="${CLIENT_NOTES_MAX_LENGTH}" placeholder="Observações do cliente">${escapeHtml(safeClient.notes)}</textarea>
          <div class="clients-field-counter-wrap"><span id="client-notes-counter">0 / ${CLIENT_NOTES_MAX_LENGTH}</span></div>
        </div>
        <div id="client-form-feedback" class="clients-form-feedback"></div>
        <div class="modal-buttons" style="margin-top:10px;">
          <button type="button" class="btn-cancel" id="${isEdit ? 'client-form-back' : 'client-form-cancel'}">
            ${isEdit ? 'Voltar' : 'Cancelar'}
          </button>
          <button type="submit" class="btn-save">${isEdit ? 'Salvar alterações' : 'Cadastrar cliente'}</button>
        </div>
      </form>
    </div>`;
}

function renderClientModalLoading() {
  return `
    <div class="clients-modal-body">
      <div>
        <div class="modal-title" style="margin:0;">Carregando cliente...</div>
        <div class="modal-sub" style="margin-top:4px;">Buscando ficha completa e assinatura.</div>
      </div>
      <div class="clients-modal-grid">
        <div class="mini-card"><div class="mini-lbl">Visitas</div><div class="mini-val">—</div></div>
        <div class="mini-card"><div class="mini-lbl">Total gasto</div><div class="mini-val">—</div></div>
        <div class="mini-card"><div class="mini-lbl">Último atendimento</div><div class="mini-val">—</div></div>
        <div class="mini-card"><div class="mini-lbl">Status do cliente</div><div class="mini-val">—</div></div>
      </div>
      <div class="clients-modal-info">
        <div class="clients-modal-info-row">Carregando dados do cliente...</div>
        <div class="clients-modal-info-row">Carregando assinatura e cobranças...</div>
      </div>
    </div>`;
}

// ─── Feedback ─────────────────────────────────────────────────────────────────

function setClientFormFeedback(message, variant = 'neutral') {
  const el = document.getElementById('client-form-feedback');
  if (!el) return;
  el.textContent = message || '';
  el.style.color = variant === 'error' ? '#ff8a8a' : variant === 'success' ? '#00e676' : '#5a6888';
}

function setClientDetailFeedback(message, variant = 'neutral') {
  const el = document.getElementById('client-detail-feedback');
  if (!el) return;
  el.textContent = message || '';
  el.style.color = variant === 'error' ? '#ff8a8a' : variant === 'success' ? '#00e676' : '#5a6888';
}

// ─── Counters ─────────────────────────────────────────────────────────────────

function updateCounter(inputId, counterId, maxLength) {
  const input   = document.getElementById(inputId);
  const counter = document.getElementById(counterId);
  if (!input || !counter) return;
  if (input.value.length > maxLength) input.value = input.value.slice(0, maxLength);
  counter.textContent = `${input.value.length} / ${maxLength}`;
}

function bindCounter(inputId, counterId, maxLength) {
  const input = document.getElementById(inputId);
  if (!input) return;
  const sync = () => updateCounter(inputId, counterId, maxLength);
  input.addEventListener('input', sync);
  sync();
}

function initClientFormEnhancements() {
  bindCounter('client-name-input',     'client-name-counter',     CLIENT_NAME_MAX_LENGTH);
  bindCounter('client-phone-input',    'client-phone-counter',    CLIENT_PHONE_MAX_LENGTH);
  bindCounter('client-whatsapp-input', 'client-whatsapp-counter', CLIENT_WHATSAPP_MAX_LENGTH);
  bindCounter('client-notes-input',    'client-notes-counter',    CLIENT_NOTES_MAX_LENGTH);
}

// ─── Load data ────────────────────────────────────────────────────────────────

async function loadClientsData() {
  const tbody = document.getElementById('clients-table-body');
  if (!tbody) return;

  if (!hasApiConfig()) {
    clientesState.items = []; clientesState.isLoaded = false;
    tbody.innerHTML = `<tr><td colspan="6" class="clients-empty">API não configurada. Abra o login dev para conectar o backend.</td></tr>`;
    return;
  }

  if (!hasAuthToken()) {
    clientesState.items = []; clientesState.isLoaded = false;
    tbody.innerHTML = `<tr><td colspan="6" class="clients-empty">Login pendente. Faça a autenticação para carregar os clientes reais.</td></tr>`;
    return;
  }

  clientesState.isLoading = true;
  tbody.innerHTML = `<tr><td colspan="6" class="clients-empty">Carregando clientes...</td></tr>`;

  try {
    const payload = await getClients();
    clientesState.items = Array.isArray(payload) ? payload.map(mapClientSummaryFromApi) : [];
    clientesState.isLoaded = true;
    rerenderClientesTable();
  } catch (error) {
    tbody.innerHTML = `<tr><td colspan="6" class="clients-empty">${escapeHtml(error instanceof Error ? error.message : 'Não foi possível carregar os clientes.')}</td></tr>`;
  } finally {
    clientesState.isLoading = false;
  }
}

async function loadClientDetails(clientId) {
  try {
    const [clientPayload, subscriptionsPayload] = await Promise.all([
      getClientById(clientId),
      getSubscriptions({ client_id: clientId }),
    ]);
    const detailClient = mapClientDetailFromApi(clientPayload);
    let detailSubscription = null;
    if (Array.isArray(subscriptionsPayload) && subscriptionsPayload.length) {
      const subscriptionPayload = await getSubscriptionById(subscriptionsPayload[0].id);
      detailSubscription = mapSubscriptionDetail(subscriptionPayload);
    }
    if (clientesState.activeClientId !== clientId) return;
    clientesState.detailClient      = detailClient;
    clientesState.detailSubscription = detailSubscription;
    clientesState.isDetailLoading   = false;
    renderClientModal();
  } catch (error) {
    if (clientesState.activeClientId !== clientId) return;
    const fallback = getClientSummaryById(clientId);
    clientesState.detailClient      = fallback ? { ...fallback, appointments: [], raw: fallback.raw || {} } : null;
    clientesState.detailSubscription = null;
    clientesState.isDetailLoading   = false;
    renderClientModal();
    setTimeout(() => setClientDetailFeedback(error instanceof Error ? error.message : 'Não foi possível carregar a ficha do cliente.', 'error'), 0);
  }
}

// ─── Modal control ────────────────────────────────────────────────────────────

function openClientModal(clientId) {
  clientesState.activeClientId    = clientId;
  clientesState.detailClient      = null;
  clientesState.detailSubscription = null;
  clientesState.isDetailLoading   = true;
  clientesState.modalMode         = 'view';
  renderClientModal();
  loadClientDetails(clientId);
}

function openCreateClientModal() {
  clientesState.activeClientId    = null;
  clientesState.detailClient      = null;
  clientesState.detailSubscription = null;
  clientesState.isDetailLoading   = false;
  clientesState.modalMode         = 'create';
  renderClientModal();
}

function openEditClientModal(clientId) {
  clientesState.activeClientId  = clientId;
  clientesState.isDetailLoading = false;
  clientesState.modalMode       = 'edit';
  renderClientModal();
}

function closeClientModal() {
  const modal   = document.getElementById('client-details-modal');
  const content = document.getElementById('client-details-content');
  if (!modal) return;
  clientesState.modalMode         = 'closed';
  clientesState.activeClientId    = null;
  clientesState.detailClient      = null;
  clientesState.detailSubscription = null;
  clientesState.isDetailLoading   = false;
  modal.classList.remove('open');
  modal.style.display = 'none';
  if (content) content.innerHTML = '';
}

function collectClientFormData() {
  const form = document.getElementById('client-form');
  const formData = new FormData(form);
  return {
    name:     String(formData.get('name')     || '').trim(),
    phone:    String(formData.get('phone')    || '').trim(),
    whatsapp: String(formData.get('whatsapp') || '').trim(),
    status:   String(formData.get('status')   || 'active').trim(),
    notes:    String(formData.get('notes')    || '').trim(),
  };
}

async function handleClientFormSubmit(event) {
  event.preventDefault();
  const data = collectClientFormData();
  if (!data.name) { setClientFormFeedback('Informe o nome do cliente.', 'error'); return; }
  if (data.name.length     > CLIENT_NAME_MAX_LENGTH)     { setClientFormFeedback(`O nome deve ter no máximo ${CLIENT_NAME_MAX_LENGTH} caracteres.`, 'error'); return; }
  if (data.whatsapp.length > CLIENT_WHATSAPP_MAX_LENGTH) { setClientFormFeedback(`O WhatsApp deve ter no máximo ${CLIENT_WHATSAPP_MAX_LENGTH} caracteres.`, 'error'); return; }
  if (data.phone.length    > CLIENT_PHONE_MAX_LENGTH)    { setClientFormFeedback(`O telefone deve ter no máximo ${CLIENT_PHONE_MAX_LENGTH} caracteres.`, 'error'); return; }
  if (data.notes.length    > CLIENT_NOTES_MAX_LENGTH)    { setClientFormFeedback(`As observações devem ter no máximo ${CLIENT_NOTES_MAX_LENGTH} caracteres.`, 'error'); return; }

  const payload = {
    name: data.name, phone: data.phone || null,
    whatsapp: data.whatsapp || null, notes: data.notes || null,
    is_active: data.status !== 'inactive', is_vip: data.status === 'vip',
  };

  try {
    setClientFormFeedback(clientesState.modalMode === 'edit' ? 'Salvando alterações...' : 'Criando cliente...', 'neutral');
    if (clientesState.modalMode === 'create') {
      const created = await createClient(payload);
      await loadClientsData();
      openClientModal(created.id);
      return;
    }
    if (clientesState.modalMode === 'edit' && clientesState.activeClientId) {
      await updateClient(clientesState.activeClientId, payload);
      await loadClientsData();
      openClientModal(clientesState.activeClientId);
    }
  } catch (error) {
    setClientFormFeedback(error instanceof Error ? error.message : 'Não foi possível salvar o cliente.', 'error');
  }
}

// ─── Actions ──────────────────────────────────────────────────────────────────

async function handleSubscriptionAction(subscriptionId, action) {
  const buttons = document.querySelectorAll('.clients-subscription-action');
  try {
    buttons.forEach(b => b.setAttribute('disabled', 'disabled'));
    setClientDetailFeedback('Executando ação na assinatura...', 'neutral');
    if (action === 'activate')   await activateSubscription(subscriptionId);
    if (action === 'pause')      await pauseSubscription(subscriptionId);
    if (action === 'reactivate') await reactivateSubscription(subscriptionId);
    if (action === 'cancel')     await cancelSubscription(subscriptionId);
    if (!clientesState.activeClientId) return;
    clientesState.isDetailLoading = true;
    renderClientModal();
    await loadClientsData();
    await loadClientDetails(clientesState.activeClientId);
    setTimeout(() => setClientDetailFeedback('Assinatura atualizada com sucesso.', 'success'), 0);
  } catch (error) {
    clientesState.isDetailLoading = false;
    renderClientModal();
    setClientDetailFeedback(error instanceof Error ? error.message : 'Não foi possível atualizar a assinatura.', 'error');
  } finally {
    buttons.forEach(b => b.removeAttribute('disabled'));
  }
}

async function handleInvoiceAction(invoiceId, action) {
  const buttons = document.querySelectorAll('.clients-invoice-action');
  try {
    buttons.forEach(b => b.setAttribute('disabled', 'disabled'));
    setClientDetailFeedback('Executando ação na cobrança...', 'neutral');
    if (action === 'markPaid')   await markInvoicePaid(invoiceId);
    if (action === 'markFailed') await markInvoiceFailed(invoiceId);
    if (action === 'cancel')     await cancelInvoice(invoiceId);
    if (!clientesState.activeClientId) return;
    clientesState.isDetailLoading = true;
    renderClientModal();
    await loadClientsData();
    await loadClientDetails(clientesState.activeClientId);
    setTimeout(() => setClientDetailFeedback('Cobrança atualizada com sucesso.', 'success'), 0);
  } catch (error) {
    clientesState.isDetailLoading = false;
    renderClientModal();
    setClientDetailFeedback(error instanceof Error ? error.message : 'Não foi possível atualizar a cobrança.', 'error');
  } finally {
    buttons.forEach(b => b.removeAttribute('disabled'));
  }
}

async function handleGenerateMercadoPagoCharge(subscriptionId) {
  const triggerButtons = document.querySelectorAll('.clients-generate-charge-action, .clients-invoice-action, .clients-invoice-copy-link');
  try {
    triggerButtons.forEach(b => b.setAttribute('disabled', 'disabled'));
    setClientDetailFeedback('Gerando cobrança Mercado Pago...', 'neutral');
    if (!clientesState.detailSubscription || clientesState.detailSubscription.id !== subscriptionId)
      throw new Error('Assinatura não encontrada para gerar a cobrança.');
    const subscription = clientesState.detailSubscription;
    const amountCents = getSubscriptionAmountCents(subscription);
    if (!amountCents) throw new Error('Não foi possível identificar o valor do plano para gerar a cobrança.');
    const customerName      = clientesState.detailClient?.name || 'Cliente';
    const externalReference = `sub_${subscription.id}_${Date.now()}`;
    const preference = await createMercadoPagoPreference({
      title: `${subscription.planName} - ${customerName}`,
      quantity: 1,
      unitPrice: Number((amountCents / 100).toFixed(2)),
      externalReference,
    });
    await createMercadoPagoInvoice(subscription, preference, externalReference);
    if (!clientesState.activeClientId) return;
    clientesState.isDetailLoading = true;
    renderClientModal();
    await loadClientsData();
    await loadClientDetails(clientesState.activeClientId);
    setTimeout(() => setClientDetailFeedback('Cobrança Mercado Pago gerada com sucesso.', 'success'), 0);
  } catch (error) {
    clientesState.isDetailLoading = false;
    renderClientModal();
    setClientDetailFeedback(error instanceof Error ? error.message : 'Não foi possível gerar a cobrança Mercado Pago.', 'error');
  } finally {
    triggerButtons.forEach(b => b.removeAttribute('disabled'));
  }
}

async function handleCopyInvoiceLink(paymentUrl) {
  try {
    await copyTextToClipboard(paymentUrl);
    setClientDetailFeedback('Link de pagamento copiado com sucesso.', 'success');
  } catch (error) {
    setClientDetailFeedback(error instanceof Error ? error.message : 'Não foi possível copiar o link de pagamento.', 'error');
  }
}

// ─── Modal render ─────────────────────────────────────────────────────────────

function renderClientModal() {
  const modal   = document.getElementById('client-details-modal');
  const content = document.getElementById('client-details-content');
  if (!modal || !content) return;

  if (clientesState.modalMode === 'closed') {
    modal.classList.remove('open');
    modal.style.display = 'none';
    content.innerHTML = '';
    return;
  }

  const summaryClient = clientesState.activeClientId ? getClientSummaryById(clientesState.activeClientId) : null;
  const detailClient  = clientesState.detailClient || summaryClient;

  if (clientesState.modalMode === 'view') {
    content.innerHTML = (clientesState.isDetailLoading || !detailClient)
      ? renderClientModalLoading()
      : renderClientDetails(detailClient, clientesState.detailSubscription);
  }
  if (clientesState.modalMode === 'edit')   content.innerHTML = renderClientForm('edit', detailClient);
  if (clientesState.modalMode === 'create') content.innerHTML = renderClientForm('create');

  modal.style.display = 'flex';
  modal.classList.add('open');
  bindClientModalEvents();
  initClientFormEnhancements();
}

// ─── Event binding ────────────────────────────────────────────────────────────

function bindClientsRowsEvents() {
  document.querySelectorAll('.client-row[data-client-id]').forEach(row => {
    row.addEventListener('click', () => openClientModal(row.dataset.clientId));
    row.addEventListener('keydown', event => {
      if (event.key === 'Enter' || event.key === ' ') { event.preventDefault(); openClientModal(row.dataset.clientId); }
    });
  });
}

function bindClientModalEvents() {
  document.getElementById('client-modal-close')?.addEventListener('click', closeClientModal);
  document.getElementById('client-edit-button')?.addEventListener('click', () => {
    if (!clientesState.activeClientId) return;
    openEditClientModal(clientesState.activeClientId);
  });
  document.getElementById('client-form-back')?.addEventListener('click', () => {
    if (!clientesState.activeClientId) return;
    openClientModal(clientesState.activeClientId);
  });
  document.getElementById('client-form-cancel')?.addEventListener('click', closeClientModal);
  document.getElementById('client-form')?.addEventListener('submit', handleClientFormSubmit);

  document.querySelectorAll('.clients-subscription-action').forEach(btn => {
    btn.addEventListener('click', () => handleSubscriptionAction(btn.dataset.subscriptionId, btn.dataset.action));
  });
  document.querySelectorAll('.clients-invoice-action').forEach(btn => {
    btn.addEventListener('click', () => handleInvoiceAction(btn.dataset.invoiceId, btn.dataset.action));
  });
  document.querySelectorAll('.clients-generate-charge-action').forEach(btn => {
    btn.addEventListener('click', () => handleGenerateMercadoPagoCharge(btn.dataset.subscriptionId));
  });
  document.querySelectorAll('.clients-invoice-copy-link').forEach(btn => {
    btn.addEventListener('click', () => handleCopyInvoiceLink(btn.dataset.paymentUrl));
  });
}

function bindClientesStaticEvents() {
  document.getElementById('client-new-button')?.addEventListener('click', openCreateClientModal);
  document.getElementById('client-invite-button')?.addEventListener('click', openInviteModal);

  document.getElementById('client-search-input')?.addEventListener('input', event => {
    clientesState.searchTerm = event.target.value || '';
    rerenderClientesTable();
  });

  document.getElementById('client-details-modal')?.addEventListener('click', event => {
    if (event.target?.id === 'client-details-modal') closeClientModal();
  });
}

function rerenderClientesTable() {
  const tbody = document.getElementById('clients-table-body');
  if (!tbody) return;
  tbody.innerHTML = renderClientsTableBody();
  bindClientsRowsEvents();
}

// ─── Export ───────────────────────────────────────────────────────────────────

export function renderClientes() {
  return /* html */ `
<section class="page-shell page--clientes">
  <div class="clients-toolbar">
    <div class="clients-search-wrap">
      <span class="clients-search-icon">🔍</span>
      <input
        id="client-search-input"
        class="clients-search-input"
        type="text"
        placeholder="Buscar por nome, telefone ou WhatsApp..."
        value="${escapeHtml(clientesState.searchTerm)}"
      />
    </div>
    <button type="button" class="clients-invite-btn" id="client-invite-button">
      📨 Convidar cliente
    </button>
    <button type="button" class="btn-primary-gradient" id="client-new-button">
      + Novo cliente
    </button>
  </div>

  <div class="card">
    <table class="data-table clients-table">
      <thead>
        <tr>
          <th>Cliente</th>
          <th>WhatsApp</th>
          <th>Último corte</th>
          <th>Visitas</th>
          <th>Total gasto</th>
          <th>Status</th>
        </tr>
      </thead>
      <tbody id="clients-table-body">
        <tr><td colspan="6" class="clients-empty">Carregando clientes...</td></tr>
      </tbody>
    </table>
  </div>

  <div id="client-details-modal" class="modal-overlay" style="display:none;">
    <div class="modal" style="width:min(92vw, 820px);">
      <div id="client-details-content"></div>
    </div>
  </div>
</section>
  `;
}

export function initClientesPage() {
  bindClientesStaticEvents();
  bindClientsRowsEvents();
  loadClientsData();
}
