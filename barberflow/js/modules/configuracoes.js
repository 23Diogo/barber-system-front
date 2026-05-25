import { apiFetch } from '../services/api.js';

// ─── State ────────────────────────────────────────────────────────────────────

const ACTIVE_TAB_KEY = 'barberflow.config.activeTab';

const configState = {
  shop: null,
  overview: null,
  whatsappStatus: null,
  inviteStats: null,
  settings: null,
  workingHours: null,
  activeTab: getInitialTab(),
  isLoading: false,
  isSaving: false,
  isConnectingMeta: false,
};

const TABS = [
  { id: 'overview', label: 'Comando', icon: '⚙️' },
  { id: 'business', label: 'Meu negócio', icon: '🏪' },
  { id: 'agenda', label: 'Agenda', icon: '📅' },
  { id: 'whatsapp', label: 'WhatsApp', icon: '💬' },
  { id: 'notifications', label: 'Notificações', icon: '🔔' },
  { id: 'links', label: 'Links', icon: '🔗' },
  { id: 'tests', label: 'Diagnóstico', icon: '🧪' },
];

const DAY_LABELS = {
  monday: 'Segunda-feira',
  tuesday: 'Terça-feira',
  wednesday: 'Quarta-feira',
  thursday: 'Quinta-feira',
  friday: 'Sexta-feira',
  saturday: 'Sábado',
  sunday: 'Domingo',
};

const DAY_KEYS = ['monday','tuesday','wednesday','thursday','friday','saturday','sunday'];

const REACTIVATION_DEFAULT_MSG =
  `Olá, {nome}! Sentimos sua falta na barbearia 💈\n\n` +
  `Já faz {dias} dias desde sua última visita. Que tal agendar um horário para renovar o visual?\n\n` +
  `Agende aqui: {link}`;

const NOTIF_DEFAULTS = {
  appointment_confirmed: true,
  appointment_cancelled: true,
  appointment_reminder_1h: true,

  bills_reminder_enabled: true,
  bills_reminder_days: [5, 3, 1, 0],
  bills_reminder_hour: 9,

  subscription_reminder_enabled: true,
  subscription_reminder_days: [5, 3, 1, 0],
  subscription_reminder_hour: 9,

  stock_alert_enabled: true,
  stock_alert_hour: 8,

  reactivation_enabled: true,
  reactivation_hour: 10,
  reactivation_message: '',

  new_client_alert: true,
};

function getInitialTab() {
  try {
    return localStorage.getItem(ACTIVE_TAB_KEY) || 'overview';
  } catch {
    return 'overview';
  }
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function escapeHtml(value) {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

function formatNumber(value) {
  return new Intl.NumberFormat('pt-BR').format(Number(value || 0));
}

function formatDate(value) {
  if (!value) return '—';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '—';
  return date.toLocaleDateString('pt-BR');
}

function setFeedback(id, message, variant = 'neutral') {
  const el = document.getElementById(id);
  if (!el) return;
  el.textContent = message || '';
  el.style.color = variant === 'error' ? '#ff8a8a' : variant === 'success' ? '#00e676' : '#5a6888';
}

function getToastContainer() {
  let container = document.getElementById('cfg-toast-container');

  if (!container) {
    container = document.createElement('div');
    container.id = 'cfg-toast-container';
    container.className = 'cfg-toast-container';
    container.setAttribute('aria-live', 'polite');
    container.setAttribute('aria-atomic', 'false');
    document.body.appendChild(container);
  }

  return container;
}

function getToastIcon(variant) {
  const map = {
    success: '✓',
    error: '!',
    warning: '!',
    info: 'i',
    neutral: '•',
  };

  return map[variant] || map.neutral;
}

function showToast(message, variant = 'neutral') {
  const old = document.getElementById('cfg-toast');
  if (old) old.remove();

  const palette = {
    success: {
      icon: '✓',
      title: 'Sucesso',
      bg: 'rgba(0, 230, 118, 0.12)',
      border: 'rgba(0, 230, 118, 0.35)',
      color: '#00e676',
      shadow: 'rgba(0, 230, 118, 0.18)',
    },
    error: {
      icon: '!',
      title: 'Erro',
      bg: 'rgba(255, 23, 68, 0.12)',
      border: 'rgba(255, 23, 68, 0.35)',
      color: '#ff7b91',
      shadow: 'rgba(255, 23, 68, 0.18)',
    },
    warning: {
      icon: '!',
      title: 'Atenção',
      bg: 'rgba(249, 115, 22, 0.12)',
      border: 'rgba(249, 115, 22, 0.35)',
      color: '#f97316',
      shadow: 'rgba(249, 115, 22, 0.18)',
    },
    neutral: {
      icon: 'i',
      title: 'Informação',
      bg: 'rgba(79, 195, 247, 0.12)',
      border: 'rgba(79, 195, 247, 0.32)',
      color: '#4fc3f7',
      shadow: 'rgba(79, 195, 247, 0.16)',
    },
  };

  const theme = palette[variant] || palette.neutral;

  const toast = document.createElement('div');
  toast.id = 'cfg-toast';
  toast.setAttribute('role', 'status');
  toast.setAttribute('aria-live', 'polite');

  toast.style.cssText = `
    position: fixed;
    top: 22px;
    right: 22px;
    z-index: 999999;
    width: min(380px, calc(100vw - 28px));
    display: grid;
    grid-template-columns: 34px minmax(0, 1fr) auto;
    gap: 12px;
    align-items: center;
    padding: 13px 14px;
    border-radius: 16px;
    border: 1px solid ${theme.border};
    background:
      radial-gradient(circle at top left, ${theme.bg}, transparent 42%),
      rgba(10, 12, 26, 0.96);
    color: #e8f0fe;
    box-shadow: 0 18px 44px rgba(0,0,0,.35), 0 0 28px ${theme.shadow};
    backdrop-filter: blur(14px);
    font-family: 'DM Sans', sans-serif;
    transform: translateY(-8px);
    opacity: 0;
    transition: transform .22s ease, opacity .22s ease;
  `;

  toast.innerHTML = `
    <div style="
      width:34px;
      height:34px;
      display:grid;
      place-items:center;
      border-radius:12px;
      border:1px solid ${theme.border};
      background:${theme.bg};
      color:${theme.color};
      font-weight:900;
      flex-shrink:0;
    ">${theme.icon}</div>

    <div style="min-width:0;">
      <div style="
        color:${theme.color};
        font-size:10px;
        font-weight:900;
        letter-spacing:.10em;
        text-transform:uppercase;
        margin-bottom:3px;
      ">${theme.title}</div>
      <div style="
        color:#e8f0fe;
        font-size:12px;
        font-weight:700;
        line-height:1.4;
        overflow-wrap:anywhere;
      ">${String(message || '')}</div>
    </div>

    <button type="button" aria-label="Fechar aviso" style="
      width:28px;
      height:28px;
      border:0;
      border-radius:10px;
      background:rgba(255,255,255,.05);
      color:#8ea0c2;
      cursor:pointer;
      font-size:16px;
      line-height:1;
    ">×</button>
  `;

  toast.querySelector('button')?.addEventListener('click', () => toast.remove());

  document.body.appendChild(toast);

  requestAnimationFrame(() => {
    toast.style.transform = 'translateY(0)';
    toast.style.opacity = '1';
  });

  window.setTimeout(() => {
    toast.style.transform = 'translateY(-8px)';
    toast.style.opacity = '0';
    window.setTimeout(() => toast.remove(), 240);
  }, 4200);

  window.__cfgToastTest = () => showToast('Toast funcionando.', 'success');
}

function normalizeApiErrorMessage(error) {
  const raw = String(error?.message || error || '').trim();

  if (!raw) return 'Não foi possível salvar. Verifique os campos e tente novamente.';

  const lower = raw.toLowerCase();

  if (
    lower.includes('null value in column "name"') ||
    lower.includes("null value in column 'name'") ||
    lower.includes('barbershops_name') ||
    lower.includes('violates not-null constraint')
  ) {
    return 'Informe o nome da barbearia.';
  }

  if (lower.includes('invalid input syntax')) {
    return 'Algum campo está em formato inválido. Revise as informações e tente novamente.';
  }

  if (lower.includes('duplicate key') || lower.includes('unique constraint')) {
    return 'Já existe um cadastro com essas informações.';
  }

  if (lower.includes('failed to fetch') || lower.includes('network')) {
    return 'Não foi possível conectar ao servidor. Verifique sua internet e tente novamente.';
  }

  return raw;
}

function getFieldElement(form, fieldName) {
  if (!form) return null;
  const field = form.elements?.[fieldName];
  if (!field) return null;

  if (field instanceof RadioNodeList) {
    return field[0] || null;
  }

  return field;
}

function clearFormValidation(form) {
  if (!form) return;

  form.querySelectorAll('.is-invalid').forEach((el) => {
    el.classList.remove('is-invalid');
    el.removeAttribute('aria-invalid');
  });

  form.querySelectorAll('.cfg-field--invalid').forEach((el) => {
    el.classList.remove('cfg-field--invalid');
  });

  form.querySelectorAll('.cfg-field-error').forEach((el) => el.remove());
}

function setFieldError(form, fieldName, message) {
  const field = getFieldElement(form, fieldName);
  if (!field) return;

  field.classList.add('is-invalid');
  field.setAttribute('aria-invalid', 'true');

  const wrapper = field.closest('label') || field.parentElement;
  if (wrapper) {
    wrapper.classList.add('cfg-field--invalid');

    const error = document.createElement('div');
    error.className = 'cfg-field-error';
    error.dataset.field = fieldName;
    error.textContent = message;

    wrapper.appendChild(error);
  }
}

function focusFirstInvalidField(form) {
  const first = form?.querySelector?.('.is-invalid');
  if (!first) return;

  first.scrollIntoView({ behavior: 'smooth', block: 'center' });

  window.setTimeout(() => {
    try {
      first.focus({ preventScroll: true });
    } catch {
      first.focus();
    }
  }, 280);
}

function digitsOnly(value) {
  return String(value || '').replace(/\D/g, '');
}

function isValidHttpUrl(value) {
  const raw = String(value || '').trim();
  if (!raw) return true;

  try {
    const url = new URL(raw);
    return ['http:', 'https:'].includes(url.protocol);
  } catch {
    return false;
  }
}

function validatePhoneIfFilled(value) {
  const digits = digitsOnly(value);
  if (!digits) return true;

  return digits.length >= 10 && digits.length <= 13;
}

function validateBusinessForm(form, data) {
  clearFormValidation(form);

  const errors = [];

  const name = String(data.get('name') || '').trim();
  const phone = String(data.get('phone') || '').trim();
  const whatsapp = String(data.get('whatsapp') || '').trim();
  const state = String(data.get('state') || '').trim();
  const zipCode = String(data.get('zip_code') || '').trim();
  const logoUrl = String(data.get('logo_url') || '').trim();
  const coverUrl = String(data.get('cover_url') || '').trim();
  const timezone = String(data.get('timezone') || '').trim();

  if (!name) {
    errors.push(['name', 'Informe o nome da barbearia.']);
  }

  if (phone && !validatePhoneIfFilled(phone)) {
    errors.push(['phone', 'Informe um telefone válido com DDD.']);
  }

  if (whatsapp && !validatePhoneIfFilled(whatsapp)) {
    errors.push(['whatsapp', 'Informe um WhatsApp válido com DDD.']);
  }

  if (state && !/^[a-zA-Z]{2}$/.test(state)) {
    errors.push(['state', 'Informe o estado com 2 letras. Ex: SP.']);
  }

  if (zipCode) {
    const zipDigits = digitsOnly(zipCode);
    if (zipDigits.length !== 8) {
      errors.push(['zip_code', 'Informe um CEP válido com 8 números.']);
    }
  }

  if (logoUrl && !isValidHttpUrl(logoUrl)) {
    errors.push(['logo_url', 'Informe uma URL válida para a logo.']);
  }

  if (coverUrl && !isValidHttpUrl(coverUrl)) {
    errors.push(['cover_url', 'Informe uma URL válida para a capa.']);
  }

  if (!timezone) {
    errors.push(['timezone', 'Informe o fuso horário.']);
  }

  errors.forEach(([field, message]) => setFieldError(form, field, message));

  if (errors.length) {
    const firstMessage = errors[0][1];

    setFeedback('cfg-business-feedback', firstMessage, 'error');
    showToast('Revise os campos obrigatórios antes de salvar.', 'warning');
    focusFirstInvalidField(form);

    return false;
  }

  return true;
}

function getSettings() {
  return { ...NOTIF_DEFAULTS, ...(configState.settings || {}) };
}

function getDefaultHours() {
  return {
    monday:    { active: true,  open: '08:00', close: '19:00' },
    tuesday:   { active: true,  open: '08:00', close: '19:00' },
    wednesday: { active: true,  open: '08:00', close: '19:00' },
    thursday:  { active: true,  open: '08:00', close: '19:00' },
    friday:    { active: true,  open: '08:00', close: '19:00' },
    saturday:  { active: true,  open: '08:00', close: '17:00' },
    sunday:    { active: false, open: '08:00', close: '12:00' },
  };
}

function parseWorkingHours(raw) {
  const defaults = getDefaultHours();
  if (!raw || typeof raw !== 'object') return defaults;

  const result = { ...defaults };
  DAY_KEYS.forEach((key) => {
    const day = raw[key] || {};
    result[key] = {
      active: day.active !== undefined ? Boolean(day.active) : defaults[key].active,
      open: day.open || defaults[key].open,
      close: day.close || defaults[key].close,
    };
  });

  return result;
}

function buildInviteLink(slug) {
  return slug ? `https://bbarberflow.com.br/client/cadastro/${encodeURIComponent(slug)}` : '';
}

function buildClientAgendaLink(slug) {
  return slug ? `https://bbarberflow.com.br/client/cadastro/${encodeURIComponent(slug)}` : 'https://bbarberflow.com.br/client';
}

function normalizePhone(value) {
  return String(value || '').replace(/\D/g, '');
}

function maskSecret(value) {
  if (!value) return 'Não configurado';
  const raw = String(value);
  if (raw.length <= 12) return '••••••';
  return `${raw.slice(0, 6)}••••••${raw.slice(-4)}`;
}

function getReadiness() {
  return configState.overview?.readiness || {
    score: 0,
    completed: 0,
    total: 0,
    checklist: {},
  };
}

function readinessLabel(score) {
  if (score >= 90) return 'Pronta para vender';
  if (score >= 70) return 'Quase pronta';
  if (score >= 45) return 'Em configuração';
  return 'Precisa de atenção';
}

function statusChip(label, ok) {
  return `<span class="cfg-chip ${ok ? 'cfg-chip--success' : 'cfg-chip--warning'}">${ok ? '✓' : '!'} ${escapeHtml(label)}</span>`;
}

function safeCount(value) {
  return value === null || value === undefined ? '—' : formatNumber(value);
}

function setActiveTab(tab) {
  configState.activeTab = TABS.some((item) => item.id === tab) ? tab : 'overview';
  try { localStorage.setItem(ACTIVE_TAB_KEY, configState.activeTab); } catch {}
  rerenderConfig();
}

async function copyToClipboard(value, feedbackId = null) {
  try {
    if (navigator.clipboard?.writeText) await navigator.clipboard.writeText(value);
    else {
      const ta = document.createElement('textarea');
      ta.value = value;
      ta.style.position = 'fixed';
      ta.style.left = '-9999px';
      document.body.appendChild(ta);
      ta.select();
      document.execCommand('copy');
      ta.remove();
    }
    if (feedbackId) setFeedback(feedbackId, 'Link copiado.', 'success');
    showToast('Link copiado com sucesso.', 'success');
  } catch {
    if (feedbackId) setFeedback(feedbackId, 'Não foi possível copiar.', 'error');
    showToast('Não foi possível copiar.', 'error');
  }
}

function renderLoadingCard(title = 'Carregando...') {
  return `<div class="cfg-card"><div class="cfg-card-title">${escapeHtml(title)}</div><div class="cfg-skeleton"></div></div>`;
}

// ─── API ──────────────────────────────────────────────────────────────────────

async function safeApi(path, fallback = null) {
  try {
    return await apiFetch(path);
  } catch (error) {
    console.warn(`Config fetch fallback ${path}:`, error);
    return fallback;
  }
}

async function loadConfigData() {
  configState.isLoading = true;
  rerenderConfig();

  try {
    const [me, overview, whatsappStatus, inviteStats] = await Promise.all([
      safeApi('/api/auth/me', null),
      safeApi('/api/barbershops/config/overview', null),
      safeApi('/api/whatsapp/status', null),
      safeApi('/api/barbershops/invites/stats', null),
    ]);

    configState.shop = me?.barbershop || me?.barbershops || overview?.shop || null;
    configState.overview = overview;
    configState.whatsappStatus = whatsappStatus;
    configState.inviteStats = inviteStats;
    configState.settings = configState.shop?.notification_settings || null;
    configState.workingHours = configState.shop?.working_hours || null;
  } finally {
    configState.isLoading = false;
    rerenderConfig();
  }
}

async function patchShopSettings(payload, feedbackId, successMessage = 'Configuração salva.') {
  if (configState.isSaving) {
    showToast('Já existe um salvamento em andamento.', 'warning');
    return null;
  }

  configState.isSaving = true;
  setFeedback(feedbackId, 'Salvando...', 'neutral');

  try {
    const data = await apiFetch('/api/barbershops/settings', {
      method: 'PATCH',
      body: JSON.stringify(payload),
    });

    configState.shop = data || configState.shop;
    configState.settings = data?.notification_settings || configState.settings;
    configState.workingHours = data?.working_hours || configState.workingHours;

    setFeedback(feedbackId, successMessage, 'success');
    showToast(successMessage, 'success');

    await loadConfigData();
    return data;
  } catch (error) {
    const message = normalizeApiErrorMessage(error);

    setFeedback(feedbackId, message, 'error');
    showToast(message, 'error');

    return null;
  } finally {
    configState.isSaving = false;
  }
}

async function connectWithMeta() {
  if (configState.isConnectingMeta) return;
  configState.isConnectingMeta = true;
  setFeedback('cfg-wa-feedback', 'Redirecionando para conexão com a Meta...', 'neutral');

  try {
    const data = await apiFetch('/api/auth/meta/connect', { method: 'POST' });
    if (!data?.url) throw new Error('URL de autorização não retornada.');
    window.location.href = data.url;
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Erro ao conectar.';
    setFeedback('cfg-wa-feedback', message, 'error');
    showToast(message, 'error');
    configState.isConnectingMeta = false;
  }
}

function checkMetaStatusFromUrl() {
  const params = new URLSearchParams(window.location.search);
  const status = params.get('meta_status');
  if (!status) return;

  window.history.replaceState({}, '', window.location.pathname);

  if (status === 'success') showToast('WhatsApp Business conectado com sucesso.', 'success');
  else showToast('Erro ao conectar com a Meta.', 'error');
}

async function saveBusinessForm(event) {
  event.preventDefault();

  const form = document.getElementById('cfg-business-form');
  if (!form) return;

  const data = new FormData(form);

  if (!validateBusinessForm(form, data)) {
    return;
  }

  await patchShopSettings({
    name: String(data.get('name') || '').trim(),
    phone: normalizePhone(data.get('phone')),
    whatsapp: normalizePhone(data.get('whatsapp')),
    address: String(data.get('address') || '').trim(),
    city: String(data.get('city') || '').trim(),
    state: String(data.get('state') || '').trim().toUpperCase(),
    zip_code: digitsOnly(data.get('zip_code')),
    logo_url: String(data.get('logo_url') || '').trim(),
    cover_url: String(data.get('cover_url') || '').trim(),
    timezone: String(data.get('timezone') || 'America/Sao_Paulo').trim(),
    is_active: String(data.get('is_active')) === 'true',
    absence_message: String(data.get('absence_message') || '').trim(),
  }, 'cfg-business-feedback', 'Dados do negócio salvos.');
}

async function saveAgendaForm(event) {
  event.preventDefault();
  const form = document.getElementById('cfg-agenda-form');
  const data = new FormData(form);

  await patchShopSettings({
    booking_advance_days: Number(data.get('booking_advance_days') || 30),
    cancellation_hours: Number(data.get('cancellation_hours') || 2),
    absence_message: String(data.get('absence_message') || '').trim(),
  }, 'cfg-agenda-feedback', 'Regras de agenda salvas.');
}

async function saveWorkingHours(event) {
  event?.preventDefault?.();
  const hours = parseWorkingHours(configState.workingHours);

  document.querySelectorAll('[data-wh-day][data-wh-field]').forEach((el) => {
    const day = el.dataset.whDay;
    const field = el.dataset.whField;
    if (!hours[day]) return;

    if (field === 'active') hours[day].active = el.checked;
    else hours[day][field] = el.value || hours[day][field];
  });

  await patchShopSettings({ working_hours: hours }, 'cfg-hours-feedback', 'Horários salvos.');
}

function collectNotificationSettings() {
  const result = { ...getSettings() };

  document.querySelectorAll('[data-setting]').forEach((el) => {
    const key = el.dataset.setting;

    if (el.type === 'checkbox') {
      result[key] = el.checked;
      return;
    }

    if (['bills_reminder_days', 'subscription_reminder_days'].includes(key)) {
      result[key] = String(el.value || '')
        .split(',')
        .map((item) => parseInt(item.trim(), 10))
        .filter((item) => Number.isFinite(item) && item >= 0);
      return;
    }

    if (key.includes('_hour')) {
      const h = parseInt(el.value, 10);
      result[key] = Number.isFinite(h) ? Math.min(23, Math.max(0, h)) : 9;
      return;
    }

    result[key] = String(el.value || '');
  });

  return result;
}

async function saveNotifications(event) {
  event.preventDefault();
  await patchShopSettings({
    notification_settings: collectNotificationSettings(),
  }, 'cfg-notifications-feedback', 'Notificações salvas.');
}

async function saveReactivationMessage(event) {
  event.preventDefault();
  const textarea = document.getElementById('cfg-reactivation-message');
  const settings = { ...getSettings(), reactivation_message: textarea?.value || '' };

  await patchShopSettings({
    notification_settings: settings,
  }, 'cfg-reactivation-feedback', 'Mensagem de reativação salva.');
}

async function saveWhatsAppManual(event) {
  event.preventDefault();

  const form = document.getElementById('cfg-whatsapp-form');
  const data = new FormData(form);
  const phoneNumberId = String(data.get('phone_number_id') || '').trim();
  const accessToken = String(data.get('access_token') || '').trim();
  const displayPhone = normalizePhone(data.get('display_phone'));

  if (!phoneNumberId || !accessToken) {
    const message = 'Informe Phone Number ID e Access Token.';
    setFeedback('cfg-wa-feedback', message, 'error');
    showToast(message, 'warning');
    return;
  }

  setFeedback('cfg-wa-feedback', 'Validando com a Meta...', 'neutral');

  try {
    await apiFetch('/api/whatsapp/connect/manual', {
      method: 'POST',
      body: JSON.stringify({
        phone_number_id: phoneNumberId,
        access_token: accessToken,
        display_phone: displayPhone || configState.shop?.whatsapp || null,
      }),
    });

    setFeedback('cfg-wa-feedback', 'WhatsApp conectado.', 'success');
    showToast('WhatsApp conectado com sucesso.', 'success');
    await loadConfigData();
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Erro ao conectar WhatsApp.';
    setFeedback('cfg-wa-feedback', message, 'error');
    showToast(message, 'error');
  }
}

async function disconnectWhatsApp() {
  const ok = window.confirm('Desconectar o WhatsApp Business desta barbearia?');
  if (!ok) return;

  setFeedback('cfg-wa-feedback', 'Desconectando...', 'neutral');

  try {
    await apiFetch('/api/whatsapp/disconnect', { method: 'DELETE' });
    setFeedback('cfg-wa-feedback', 'WhatsApp desconectado.', 'success');
    showToast('WhatsApp desconectado com sucesso.', 'success');
    await loadConfigData();
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Erro ao desconectar.';
    setFeedback('cfg-wa-feedback', message, 'error');
    showToast(message, 'error');
  }
}

async function registerInvite(channel) {
  try {
    await apiFetch('/api/barbershops/invites', {
      method: 'POST',
      body: JSON.stringify({ channel }),
    });
    await loadConfigData();
  } catch (error) {
    console.warn('Não foi possível registrar convite:', error);
  }
}

async function runNotificationTest(endpoint, btn) {
  const status = btn.querySelector('.cfg-test-status');
  if (status) status.textContent = 'enviando...';
  btn.disabled = true;
  setFeedback('cfg-test-feedback', 'Enviando teste...', 'neutral');

  try {
    await apiFetch(endpoint, { method: 'POST', body: JSON.stringify({}) });
    if (status) status.textContent = 'ok';
    setFeedback('cfg-test-feedback', 'Mensagem de teste enviada.', 'success');
    showToast('Mensagem de teste enviada com sucesso.', 'success');
  } catch (error) {
    if (status) status.textContent = 'erro';
    const message = error instanceof Error ? error.message : 'Erro ao testar.';
    setFeedback('cfg-test-feedback', message, 'error');
    showToast(message, 'error');
  } finally {
    btn.disabled = false;
    setTimeout(() => { if (status) status.textContent = ''; }, 4000);
  }
}

// ─── Render primitives ────────────────────────────────────────────────────────

function renderHero() {
  const shop = configState.shop || {};
  const readiness = getReadiness();
  const connected = Boolean(configState.whatsappStatus?.connected || shop.meta_phone_id && shop.meta_access_token);

  return `
    <div class="cfg-hero">
      <div>
        <div class="cfg-section-title">Central de comando</div>
        <h1>Configurações</h1>
        <p>Ajuste dados do negócio, agenda, WhatsApp, notificações e links públicos em uma tela de controle limpa, rastreável e pronta para operação.</p>
        <div class="cfg-chip-row">
          ${statusChip(`Licença ${shop.plan_status || '—'}`, shop.plan_status === 'active')}
          ${statusChip(connected ? 'WhatsApp conectado' : 'WhatsApp pendente', connected)}
          ${statusChip(`${readiness.score || 0}% configurado`, (readiness.score || 0) >= 70)}
        </div>
      </div>
      <div class="cfg-hero-score">
        <strong>${escapeHtml(readiness.score || 0)}%</strong>
        <span>${escapeHtml(readinessLabel(readiness.score || 0))}</span>
      </div>
    </div>
  `;
}

function renderTabs() {
  return `
    <div class="cfg-tabs" role="tablist">
      ${TABS.map((tab) => `
        <button type="button" class="cfg-tab ${configState.activeTab === tab.id ? 'is-active' : ''}" data-cfg-tab="${escapeHtml(tab.id)}">
          <span>${tab.icon}</span>
          ${escapeHtml(tab.label)}
        </button>
      `).join('')}
    </div>
  `;
}

function renderMetric(label, value, hint, tone = 'info') {
  return `
    <div class="cfg-metric cfg-metric--${escapeHtml(tone)}">
      <div class="cfg-metric-label">${escapeHtml(label)}</div>
      <div class="cfg-metric-value">${escapeHtml(value)}</div>
      <div class="cfg-metric-sub">${escapeHtml(hint)}</div>
    </div>
  `;
}

function renderToggle(key, label, hint) {
  const s = getSettings();
  return `
    <div class="cfg-setting-row">
      <div>
        <strong>${escapeHtml(label)}</strong>
        <span>${escapeHtml(hint)}</span>
      </div>
      <label class="cfg-toggle">
        <input type="checkbox" data-setting="${escapeHtml(key)}" ${s[key] ? 'checked' : ''} />
        <span></span>
      </label>
    </div>
  `;
}

function renderToggleWithHour(enabledKey, hourKey, label, hint) {
  const s = getSettings();
  return `
    <div class="cfg-setting-row cfg-setting-row--wrap">
      <div>
        <strong>${escapeHtml(label)}</strong>
        <span>${escapeHtml(hint)}</span>
      </div>
      <div class="cfg-inline-controls">
        <label class="cfg-small-label">Hora
          <input class="modal-input cfg-hour-input" type="number" min="0" max="23" data-setting="${escapeHtml(hourKey)}" value="${escapeHtml(s[hourKey] ?? 9)}" />
        </label>
        <label class="cfg-toggle">
          <input type="checkbox" data-setting="${escapeHtml(enabledKey)}" ${s[enabledKey] ? 'checked' : ''} />
          <span></span>
        </label>
      </div>
    </div>
  `;
}

function renderDaysWithHour(daysKey, hourKey, enabledKey, label, hint) {
  const s = getSettings();
  const days = Array.isArray(s[daysKey]) ? s[daysKey].join(', ') : '';

  return `
    <div class="cfg-notification-box">
      <div class="cfg-setting-row cfg-setting-row--wrap">
        <div>
          <strong>${escapeHtml(label)}</strong>
          <span>${escapeHtml(hint)}</span>
        </div>
        <label class="cfg-toggle">
          <input type="checkbox" data-setting="${escapeHtml(enabledKey)}" ${s[enabledKey] ? 'checked' : ''} />
          <span></span>
        </label>
      </div>
      <div class="cfg-form-grid cfg-form-grid--compact">
        <label>Dias antes
          <input class="modal-input" data-setting="${escapeHtml(daysKey)}" value="${escapeHtml(days)}" placeholder="5, 3, 1, 0" />
        </label>
        <label>Hora
          <input class="modal-input" data-setting="${escapeHtml(hourKey)}" type="number" min="0" max="23" value="${escapeHtml(s[hourKey] ?? 9)}" />
        </label>
      </div>
    </div>
  `;
}

function renderSectionShell(content) {
  if (configState.isLoading && !configState.shop) {
    return `
      <div class="cfg-grid">
        ${renderLoadingCard('Carregando dados')}
        ${renderLoadingCard('Carregando diagnóstico')}
      </div>
    `;
  }

  return content;
}

// ─── Sections ─────────────────────────────────────────────────────────────────

function renderOverview() {
  const overview = configState.overview || {};
  const counters = overview.counters || {};
  const readiness = getReadiness();
  const checklist = readiness.checklist || {};
  const shop = configState.shop || {};
  const connected = Boolean(configState.whatsappStatus?.connected || shop.meta_phone_id && shop.meta_access_token);
  const invite = configState.inviteStats || {};

  const checks = [
    ['Dados básicos', checklist.business_data],
    ['Endereço', checklist.address],
    ['Agenda', checklist.schedule],
    ['WhatsApp', checklist.whatsapp || connected],
    ['Notificações', checklist.notifications],
    ['Serviços', checklist.services],
    ['Barbeiros', checklist.barbers],
    ['Planos', checklist.plans],
    ['Marca visual', checklist.branding],
  ];

  return renderSectionShell(`
    <div class="cfg-metrics-grid">
      ${renderMetric('Prontidão', `${readiness.score || 0}%`, readinessLabel(readiness.score || 0), 'gold')}
      ${renderMetric('Clientes', safeCount(counters.clients), 'base ativa', 'info')}
      ${renderMetric('Serviços', safeCount(counters.services), 'catálogo publicado', 'success')}
      ${renderMetric('WhatsApp', connected ? 'On' : 'Off', connected ? 'automação ativa' : 'configure para avisos', connected ? 'success' : 'danger')}
    </div>

    <div class="cfg-layout">
      <main class="cfg-main">
        <section class="cfg-card">
          <div class="cfg-card-head">
            <div>
              <div class="cfg-section-title">Checklist de operação</div>
              <h2>Pronto para agendar, vender e avisar?</h2>
            </div>
            ${statusChip(`${readiness.completed || 0}/${readiness.total || 0}`, (readiness.score || 0) >= 70)}
          </div>

          <div class="cfg-checklist">
            ${checks.map(([label, ok]) => `
              <div class="cfg-check-item ${ok ? 'is-ok' : 'is-pending'}">
                <span>${ok ? '✓' : '!'}</span>
                <strong>${escapeHtml(label)}</strong>
              </div>
            `).join('')}
          </div>
        </section>

        <section class="cfg-card">
          <div class="cfg-card-head">
            <div>
              <div class="cfg-section-title">Mapa do sistema</div>
              <h2>Resumo dos módulos</h2>
            </div>
          </div>

          <div class="cfg-module-grid">
            ${[
              ['Clientes', counters.clients, '👥'],
              ['Barbeiros', counters.barbers, '💈'],
              ['Serviços', counters.services, '✂️'],
              ['Planos', counters.plans, '🏷️'],
              ['Agenda', counters.appointments, '📅'],
              ['Estoque', counters.products, '📦'],
              ['Marketing', counters.campaigns, '📣'],
              ['Avaliações', counters.reviews, '⭐'],
            ].map(([label, value, icon]) => `
              <div class="cfg-module-card">
                <span>${icon}</span>
                <strong>${safeCount(value)}</strong>
                <small>${escapeHtml(label)}</small>
              </div>
            `).join('')}
          </div>
        </section>
      </main>

      <aside class="cfg-side">
        <section class="cfg-card cfg-card--spotlight">
          <div class="cfg-section-title">Link público</div>
          <p>Use o link da barbearia para cadastro e agendamento de clientes.</p>
          ${shop.slug ? `
            <div class="cfg-copy-box">
              <code>${escapeHtml(buildInviteLink(shop.slug))}</code>
              <button type="button" class="cfg-action-btn" data-copy-link="${escapeHtml(buildInviteLink(shop.slug))}" data-copy-channel="link">Copiar</button>
            </div>
          ` : `<div class="cfg-empty">Slug não configurado.</div>`}
        </section>

        <section class="cfg-card">
          <div class="cfg-section-title">Convites</div>
          <div class="cfg-invite-stats">
            <div><strong>${safeCount(invite.sent)}</strong><span>enviados</span></div>
            <div><strong>${safeCount(invite.converted)}</strong><span>convertidos</span></div>
            <div><strong>${safeCount(invite.rate)}%</strong><span>taxa</span></div>
          </div>
        </section>
      </aside>
    </div>
  `);
}

function renderBusiness() {
  const shop = configState.shop || {};

  return renderSectionShell(`
    <div class="cfg-layout">
      <main class="cfg-main">
        <section class="cfg-card">
          <div class="cfg-card-head">
            <div>
              <div class="cfg-section-title">Identidade do negócio</div>
              <h2>Dados da barbearia</h2>
            </div>
          </div>

          <form id="cfg-business-form" class="cfg-form">
            <div class="cfg-form-grid">
              <label data-field-name="name">Nome da barbearia <span class="cfg-required">*</span>
                <input class="modal-input" name="name" value="${escapeHtml(shop.name || '')}" required aria-required="true" />
              </label>
              <label>Status operacional
                <select class="modal-input" name="is_active">
                  <option value="true" ${shop.is_active !== false ? 'selected' : ''}>Ativa</option>
                  <option value="false" ${shop.is_active === false ? 'selected' : ''}>Indisponível</option>
                </select>
              </label>
              <label>Telefone
                <input class="modal-input" name="phone" value="${escapeHtml(shop.phone || '')}" placeholder="5511999990000" />
              </label>
              <label>WhatsApp da barbearia
                <input class="modal-input" name="whatsapp" value="${escapeHtml(shop.whatsapp || '')}" placeholder="5511999990000" />
              </label>
              <label>Cidade
                <input class="modal-input" name="city" value="${escapeHtml(shop.city || '')}" />
              </label>
              <label>Estado
                <input class="modal-input" name="state" value="${escapeHtml(shop.state || '')}" maxlength="2" placeholder="SP" />
              </label>
              <label>CEP
                <input class="modal-input" name="zip_code" value="${escapeHtml(shop.zip_code || '')}" />
              </label>
              <label>Fuso horário
                <input class="modal-input" name="timezone" value="${escapeHtml(shop.timezone || 'America/Sao_Paulo')}" />
              </label>
            </div>

            <label>Endereço
              <input class="modal-input" name="address" value="${escapeHtml(shop.address || '')}" />
            </label>

            <div class="cfg-form-grid">
              <label>Logo URL
                <input class="modal-input" name="logo_url" value="${escapeHtml(shop.logo_url || '')}" placeholder="https://..." />
              </label>
              <label>Capa URL
                <input class="modal-input" name="cover_url" value="${escapeHtml(shop.cover_url || '')}" placeholder="https://..." />
              </label>
            </div>

            <label>Mensagem de ausência
              <textarea class="modal-input cfg-textarea" name="absence_message">${escapeHtml(shop.absence_message || '')}</textarea>
            </label>

            <div id="cfg-business-feedback" class="cfg-feedback"></div>

            <div class="cfg-form-actions">
              <button class="btn-save" type="submit">Salvar dados</button>
            </div>
          </form>
        </section>
      </main>

      <aside class="cfg-side">
        <section class="cfg-brand-preview">
          <div class="cfg-cover-preview" style="${shop.cover_url ? `background-image:url('${escapeHtml(shop.cover_url)}')` : ''}"></div>
          <div class="cfg-logo-preview">
            ${shop.logo_url ? `<img src="${escapeHtml(shop.logo_url)}" alt="Logo" />` : escapeHtml(String(shop.name || 'B').charAt(0).toUpperCase())}
          </div>
          <strong>${escapeHtml(shop.name || 'Barbearia')}</strong>
          <span>${escapeHtml(shop.city || 'Cidade não informada')} ${shop.state ? `· ${escapeHtml(shop.state)}` : ''}</span>
        </section>

        <section class="cfg-card">
          <div class="cfg-section-title">Licença</div>
          <div class="cfg-info-list">
            <div><span>Status</span><strong>${escapeHtml(shop.plan_status || '—')}</strong></div>
            <div><span>Vigência</span><strong>${escapeHtml(formatDate(shop.subscription_end))}</strong></div>
            <div><span>Slug</span><strong>${escapeHtml(shop.slug || '—')}</strong></div>
          </div>
        </section>
      </aside>
    </div>
  `);
}

function renderAgenda() {
  const shop = configState.shop || {};
  const hours = parseWorkingHours(configState.workingHours);

  return renderSectionShell(`
    <div class="cfg-layout">
      <main class="cfg-main">
        <section class="cfg-card">
          <div class="cfg-card-head">
            <div>
              <div class="cfg-section-title">Regras de agenda</div>
              <h2>Como os clientes podem marcar horários</h2>
            </div>
          </div>

          <form id="cfg-agenda-form" class="cfg-form">
            <div class="cfg-form-grid">
              <label>Abrir agenda para próximos dias
                <input class="modal-input" name="booking_advance_days" type="number" min="1" max="365" value="${escapeHtml(shop.booking_advance_days ?? 30)}" />
              </label>
              <label>Antecedência para cancelamento
                <input class="modal-input" name="cancellation_hours" type="number" min="0" max="168" value="${escapeHtml(shop.cancellation_hours ?? 2)}" />
              </label>
            </div>

            <label>Mensagem quando a barbearia estiver indisponível
              <textarea class="modal-input cfg-textarea" name="absence_message">${escapeHtml(shop.absence_message || '')}</textarea>
            </label>

            <div id="cfg-agenda-feedback" class="cfg-feedback"></div>

            <div class="cfg-form-actions">
              <button class="btn-save" type="submit">Salvar regras</button>
            </div>
          </form>
        </section>

        <section class="cfg-card">
          <div class="cfg-card-head">
            <div>
              <div class="cfg-section-title">Horários</div>
              <h2>Funcionamento semanal</h2>
            </div>
          </div>

          <form id="cfg-hours-form" class="cfg-hours-list">
            ${DAY_KEYS.map((key) => {
              const day = hours[key];
              return `
                <div class="cfg-hours-row">
                  <label class="cfg-toggle">
                    <input type="checkbox" data-wh-day="${escapeHtml(key)}" data-wh-field="active" ${day.active ? 'checked' : ''} />
                    <span></span>
                  </label>
                  <strong>${escapeHtml(DAY_LABELS[key])}</strong>
                  <div class="cfg-hour-pair">
                    <input class="modal-input" type="time" data-wh-day="${escapeHtml(key)}" data-wh-field="open" value="${escapeHtml(day.open)}" ${!day.active ? 'disabled' : ''} />
                    <em>até</em>
                    <input class="modal-input" type="time" data-wh-day="${escapeHtml(key)}" data-wh-field="close" value="${escapeHtml(day.close)}" ${!day.active ? 'disabled' : ''} />
                  </div>
                </div>
              `;
            }).join('')}

            <div id="cfg-hours-feedback" class="cfg-feedback"></div>

            <div class="cfg-form-actions">
              <button class="btn-save" type="submit">Salvar horários</button>
            </div>
          </form>
        </section>
      </main>

      <aside class="cfg-side">
        <section class="cfg-card cfg-card--spotlight">
          <div class="cfg-section-title">Experiência do cliente</div>
          <p>Essas regras protegem a operação: janela de agenda clara, cancelamento previsível e horário real de funcionamento.</p>
        </section>
      </aside>
    </div>
  `);
}

function renderWhatsapp() {
  const shop = configState.shop || {};
  const status = configState.whatsappStatus || {};
  const connected = Boolean(status.connected || shop.meta_phone_id && shop.meta_access_token);

  return renderSectionShell(`
    <div class="cfg-layout">
      <main class="cfg-main">
        <section class="cfg-card cfg-card--${connected ? 'success' : 'warning'}">
          <div class="cfg-card-head">
            <div>
              <div class="cfg-section-title">WhatsApp Business</div>
              <h2>${connected ? 'Conectado' : 'Não configurado'}</h2>
            </div>
            ${statusChip(connected ? 'Conectado' : 'Pendente', connected)}
          </div>

          <div class="cfg-wa-status">
            <div><span>Phone Number ID</span><strong>${escapeHtml(shop.meta_phone_id || status.phone_number_id || '—')}</strong></div>
            <div><span>Número comercial</span><strong>${escapeHtml(status.business_phone || shop.whatsapp || '—')}</strong></div>
            <div><span>Access Token</span><strong>${escapeHtml(maskSecret(shop.meta_access_token))}</strong></div>
          </div>

          <div id="cfg-wa-feedback" class="cfg-feedback"></div>

          <div class="cfg-form-actions cfg-form-actions--split">
            <button type="button" class="cfg-action-btn cfg-action-btn--success" id="cfg-meta-connect-btn">${connected ? 'Reconectar com Meta' : 'Conectar com Meta'}</button>
            ${connected ? `<button type="button" class="cfg-action-btn cfg-action-btn--danger" id="cfg-wa-disconnect-btn">Desconectar</button>` : ''}
          </div>
        </section>

        <section class="cfg-card">
          <div class="cfg-card-head">
            <div>
              <div class="cfg-section-title">Configuração manual</div>
              <h2>Desenvolvimento ou primeiros clientes</h2>
            </div>
          </div>

          <form id="cfg-whatsapp-form" class="cfg-form">
            <div class="cfg-form-grid">
              <label>Phone Number ID
                <input class="modal-input" name="phone_number_id" value="${escapeHtml(shop.meta_phone_id || '')}" placeholder="1049280788276183" />
              </label>
              <label>WhatsApp exibido
                <input class="modal-input" name="display_phone" value="${escapeHtml(shop.whatsapp || '')}" placeholder="5511999990000" />
              </label>
            </div>
            <label>Access Token
              <input class="modal-input" name="access_token" type="password" value="" placeholder="Cole um token novo para substituir" />
            </label>
            <div class="cfg-warning-box">Evite salvar token temporário em produção. Use token permanente da Meta para operação real.</div>
            <div class="cfg-form-actions">
              <button class="btn-save" type="submit">Validar e salvar manualmente</button>
            </div>
          </form>
        </section>
      </main>

      <aside class="cfg-side">
        <section class="cfg-card cfg-card--spotlight">
          <div class="cfg-section-title">Automação</div>
          <p>Com WhatsApp conectado, o sistema libera avisos de agenda, lembretes, clientes novos, estoque e reativação.</p>
        </section>
      </aside>
    </div>
  `);
}

function renderNotifications() {
  const s = getSettings();
  const msg = s.reactivation_message || REACTIVATION_DEFAULT_MSG;

  return renderSectionShell(`
    <div class="cfg-layout">
      <main class="cfg-main">
        <section class="cfg-card">
          <div class="cfg-card-head">
            <div>
              <div class="cfg-section-title">Notificações automáticas</div>
              <h2>O que o sistema avisa sozinho</h2>
            </div>
          </div>

          <form id="cfg-notifications-form" class="cfg-form">
            <div class="cfg-group-title">Agenda</div>
            ${renderToggle('appointment_confirmed', 'Confirmação de agendamento', 'Mensagem para cliente e barbeiro ao confirmar.')}
            ${renderToggle('appointment_cancelled', 'Cancelamento de agendamento', 'Mensagem para cliente ao cancelar.')}
            ${renderToggle('appointment_reminder_1h', 'Lembrete 1h antes', 'Aviso automático antes do horário.')}

            <div class="cfg-group-title">Financeiro</div>
            ${renderDaysWithHour('bills_reminder_days', 'bills_reminder_hour', 'bills_reminder_enabled', 'Contas a pagar', 'Dias antes do vencimento e horário do alerta.')}
            ${renderDaysWithHour('subscription_reminder_days', 'subscription_reminder_hour', 'subscription_reminder_enabled', 'Mensalidade do sistema', 'Dias antes do vencimento da licença/plataforma.')}

            <div class="cfg-group-title">Operacional e clientes</div>
            ${renderToggleWithHour('stock_alert_enabled', 'stock_alert_hour', 'Estoque baixo', 'Resumo diário dos produtos abaixo do mínimo.')}
            ${renderToggle('new_client_alert', 'Novo cliente cadastrado', 'Aviso ao dono quando alguém entrar pelo link público.')}
            ${renderToggleWithHour('reactivation_enabled', 'reactivation_hour', 'Reativação de clientes', 'Mensagem para clientes sem visita recente.')}

            <div id="cfg-notifications-feedback" class="cfg-feedback"></div>

            <div class="cfg-form-actions">
              <button class="btn-save" type="submit">Salvar notificações</button>
            </div>
          </form>
        </section>

        <section class="cfg-card">
          <div class="cfg-card-head">
            <div>
              <div class="cfg-section-title">Mensagem de reativação</div>
              <h2>Cliente sumido</h2>
            </div>
          </div>

          <form id="cfg-reactivation-form" class="cfg-form">
            <div class="cfg-var-row">
              ${['{nome}', '{dias}', '{link}'].map(v => `<button type="button" class="cfg-var-chip" data-var="${escapeHtml(v)}">${escapeHtml(v)}</button>`).join('')}
            </div>

            <textarea id="cfg-reactivation-message" class="modal-input cfg-textarea cfg-textarea--lg">${escapeHtml(msg)}</textarea>

            <div class="cfg-preview-box" id="cfg-reactivation-preview">${escapeHtml(previewReactivationMessage(msg))}</div>

            <div id="cfg-reactivation-feedback" class="cfg-feedback"></div>

            <div class="cfg-form-actions">
              <button type="button" class="cfg-action-btn" id="cfg-reactivation-reset-btn">Restaurar padrão</button>
              <button class="btn-save" type="submit">Salvar mensagem</button>
            </div>
          </form>
        </section>
      </main>

      <aside class="cfg-side">
        <section class="cfg-card cfg-card--spotlight">
          <div class="cfg-section-title">Controle fino</div>
          <p>As notificações ficam claras para o dono: o que envia, quando envia e para qual situação.</p>
        </section>
      </aside>
    </div>
  `);
}

function previewReactivationMessage(message) {
  const shop = configState.shop || {};
  const link = buildClientAgendaLink(shop.slug || 'minha-barbearia');

  return String(message || REACTIVATION_DEFAULT_MSG)
    .replace(/\{nome\}/g, 'Carlos')
    .replace(/\{dias\}/g, '35')
    .replace(/\{link\}/g, link);
}

function renderLinks() {
  const shop = configState.shop || {};
  const invite = configState.inviteStats || {};
  const inviteLink = buildInviteLink(shop.slug);
  const appLink = 'https://bbarberflow.com.br/app';

  return renderSectionShell(`
    <div class="cfg-layout">
      <main class="cfg-main">
        <section class="cfg-card">
          <div class="cfg-card-head">
            <div>
              <div class="cfg-section-title">Links públicos</div>
              <h2>Portas de entrada da barbearia</h2>
            </div>
          </div>

          <div class="cfg-link-list">
            <div class="cfg-link-card">
              <div>
                <strong>Cadastro / agenda do cliente</strong>
                <code>${escapeHtml(inviteLink || 'Slug não configurado')}</code>
              </div>
              <button type="button" class="cfg-action-btn" data-copy-link="${escapeHtml(inviteLink)}" data-copy-channel="link" ${!inviteLink ? 'disabled' : ''}>Copiar</button>
            </div>

            <div class="cfg-link-card">
              <div>
                <strong>Painel do dono</strong>
                <code>${escapeHtml(appLink)}</code>
              </div>
              <button type="button" class="cfg-action-btn" data-copy-link="${escapeHtml(appLink)}">Copiar</button>
            </div>

            <div class="cfg-link-card">
              <div>
                <strong>Convite por WhatsApp</strong>
                <code>${escapeHtml(inviteLink ? `Olá! Cadastre-se e agende seu horário: ${inviteLink}` : 'Slug não configurado')}</code>
              </div>
              <button type="button" class="cfg-action-btn cfg-action-btn--success" data-copy-link="${escapeHtml(inviteLink ? `Olá! Cadastre-se e agende seu horário: ${inviteLink}` : '')}" data-copy-channel="whatsapp" ${!inviteLink ? 'disabled' : ''}>Copiar texto</button>
            </div>
          </div>

          <div id="cfg-links-feedback" class="cfg-feedback"></div>
        </section>
      </main>

      <aside class="cfg-side">
        <section class="cfg-card">
          <div class="cfg-section-title">Desempenho dos convites</div>
          <div class="cfg-invite-stats cfg-invite-stats--stack">
            <div><strong>${safeCount(invite.sent)}</strong><span>enviados</span></div>
            <div><strong>${safeCount(invite.converted)}</strong><span>convertidos</span></div>
            <div><strong>${safeCount(invite.rate)}%</strong><span>conversão</span></div>
          </div>
        </section>
      </aside>
    </div>
  `);
}

function renderTests() {
  const tests = [
    { id: 'test-bills', icon: '💳', label: 'Conta a pagar', endpoint: '/api/test-notifications/bills' },
    { id: 'test-stock', icon: '📦', label: 'Estoque baixo', endpoint: '/api/test-notifications/stock' },
    { id: 'test-subscription', icon: '🔔', label: 'Mensalidade do sistema', endpoint: '/api/test-notifications/subscription' },
    { id: 'test-appointment-confirmed', icon: '✅', label: 'Confirmação agendamento', endpoint: '/api/test-notifications/appointment-confirmed' },
    { id: 'test-appointment-reminder', icon: '⏰', label: 'Lembrete 1h antes', endpoint: '/api/test-notifications/appointment-reminder' },
    { id: 'test-new-client', icon: '🎉', label: 'Novo cliente cadastrado', endpoint: '/api/test-notifications/new-client' },
    { id: 'test-reactivation', icon: '🔄', label: 'Reativação de clientes', endpoint: '/api/test-notifications/reactivation' },
  ];

  const connected = Boolean(configState.whatsappStatus?.connected || configState.shop?.meta_phone_id && configState.shop?.meta_access_token);

  return renderSectionShell(`
    <div class="cfg-layout">
      <main class="cfg-main">
        <section class="cfg-card">
          <div class="cfg-card-head">
            <div>
              <div class="cfg-section-title">Diagnóstico</div>
              <h2>Testar automações</h2>
            </div>
            ${statusChip(connected ? 'WhatsApp pronto' : 'WhatsApp pendente', connected)}
          </div>

          <div class="cfg-test-grid">
            ${tests.map(t => `
              <button type="button" class="cfg-test-btn" data-test-endpoint="${escapeHtml(t.endpoint)}" ${!connected ? 'disabled' : ''}>
                <span>${t.icon}</span>
                <strong>${escapeHtml(t.label)}</strong>
                <em class="cfg-test-status"></em>
              </button>
            `).join('')}
          </div>

          <div id="cfg-test-feedback" class="cfg-feedback"></div>
        </section>
      </main>

      <aside class="cfg-side">
        <section class="cfg-card cfg-card--spotlight">
          <div class="cfg-section-title">Sem chute</div>
          <p>Teste as notificações no WhatsApp da barbearia antes de liberar a operação para clientes reais.</p>
        </section>
      </aside>
    </div>
  `);
}

function renderActiveSection() {
  if (configState.activeTab === 'business') return renderBusiness();
  if (configState.activeTab === 'agenda') return renderAgenda();
  if (configState.activeTab === 'whatsapp') return renderWhatsapp();
  if (configState.activeTab === 'notifications') return renderNotifications();
  if (configState.activeTab === 'links') return renderLinks();
  if (configState.activeTab === 'tests') return renderTests();
  return renderOverview();
}

// ─── Events ───────────────────────────────────────────────────────────────────

function bindConfigEvents() {
  document.querySelectorAll('[data-cfg-tab]').forEach((btn) => {
    btn.addEventListener('click', () => setActiveTab(btn.dataset.cfgTab));
  });

  document.getElementById('cfg-business-form')?.addEventListener('submit', saveBusinessForm);
  document.getElementById('cfg-agenda-form')?.addEventListener('submit', saveAgendaForm);
  document.getElementById('cfg-hours-form')?.addEventListener('submit', saveWorkingHours);
  document.getElementById('cfg-notifications-form')?.addEventListener('submit', saveNotifications);
  document.getElementById('cfg-reactivation-form')?.addEventListener('submit', saveReactivationMessage);
  document.getElementById('cfg-whatsapp-form')?.addEventListener('submit', saveWhatsAppManual);

  document.getElementById('cfg-meta-connect-btn')?.addEventListener('click', connectWithMeta);
  document.getElementById('cfg-wa-disconnect-btn')?.addEventListener('click', disconnectWhatsApp);

  document.querySelectorAll('[data-wh-field="active"]').forEach((checkbox) => {
    checkbox.addEventListener('change', () => {
      const day = checkbox.dataset.whDay;
      document.querySelectorAll(`[data-wh-day="${day}"][data-wh-field="open"], [data-wh-day="${day}"][data-wh-field="close"]`)
        .forEach((input) => { input.disabled = !checkbox.checked; });
    });
  });

  document.querySelectorAll('[data-copy-link]').forEach((btn) => {
    btn.addEventListener('click', async () => {
      const value = btn.dataset.copyLink || '';
      const channel = btn.dataset.copyChannel || null;
      if (!value) return;

      await copyToClipboard(value, 'cfg-links-feedback');

      if (channel) await registerInvite(channel);
    });
  });

  document.querySelectorAll('[data-test-endpoint]').forEach((btn) => {
    btn.addEventListener('click', () => runNotificationTest(btn.dataset.testEndpoint, btn));
  });

  document.querySelectorAll('.cfg-var-chip[data-var]').forEach((btn) => {
    btn.addEventListener('click', () => {
      const textarea = document.getElementById('cfg-reactivation-message');
      if (!textarea) return;

      const value = btn.dataset.var || '';
      const start = textarea.selectionStart ?? textarea.value.length;
      const end = textarea.selectionEnd ?? textarea.value.length;
      textarea.value = textarea.value.slice(0, start) + value + textarea.value.slice(end);
      textarea.focus();
      textarea.selectionStart = textarea.selectionEnd = start + value.length;
      updateReactivationPreview();
    });
  });

  document.getElementById('cfg-reactivation-message')?.addEventListener('input', updateReactivationPreview);

  document.getElementById('cfg-reactivation-reset-btn')?.addEventListener('click', () => {
    const textarea = document.getElementById('cfg-reactivation-message');
    if (!textarea) return;
    textarea.value = REACTIVATION_DEFAULT_MSG;
    updateReactivationPreview();
  });
}

function updateReactivationPreview() {
  const textarea = document.getElementById('cfg-reactivation-message');
  const preview = document.getElementById('cfg-reactivation-preview');
  if (!textarea || !preview) return;
  preview.textContent = previewReactivationMessage(textarea.value);
}

function rerenderConfig() {
  const root = document.getElementById('configuracoes-root');
  if (!root) return;

  root.innerHTML = `
    ${renderHero()}
    ${renderTabs()}
    <div class="cfg-active-section">${renderActiveSection()}</div>
  `;

  bindConfigEvents();
}

// ─── Export ───────────────────────────────────────────────────────────────────

export function renderConfiguracoes() {
  return /* html */ `
<section class="page-shell page--configuracoes">
  <div id="configuracoes-root">
    ${renderHero()}
    ${renderTabs()}
    <div class="cfg-active-section">${renderActiveSection()}</div>
  </div>
</section>
  `;
}

export async function initConfiguracoesPage() {
  checkMetaStatusFromUrl();
  bindConfigEvents();
  await loadConfigData();
}
