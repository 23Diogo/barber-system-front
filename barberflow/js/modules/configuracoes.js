import { apiFetch } from '../services/api.js';
import { state } from '../state.js';

// ─── State ────────────────────────────────────────────────────────────────────

const configState = {
  shop: null,
  settings: null,
  isSaving: false,
};

// ─── Helpers ──────────────────────────────────────────────────────────────────

function escapeHtml(v) {
  return String(v ?? '').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
}

function setFeedback(id, message, variant = 'neutral') {
  const el = document.getElementById(id);
  if (!el) return;
  el.textContent = message || '';
  el.style.color = variant === 'error' ? '#ff8a8a' : variant === 'success' ? '#00e676' : '#5a6888';
}

const defaults = {
  appointment_confirmed:      true,
  appointment_cancelled:      true,
  appointment_reminder_1h:    true,
  bills_reminder_days:        [5, 3, 1, 0],
  subscription_reminder_days: [5, 3, 1, 0],
  stock_alert:                true,
  daily_jobs_hour:            18,
};

function getSettings() {
  return { ...defaults, ...(configState.settings || {}) };
}

// ─── Render ───────────────────────────────────────────────────────────────────

function renderToggle(key, label, hint) {
  const s = getSettings();
  const checked = s[key] ? 'checked' : '';

  return `
    <div class="cfg-row" style="cursor:default;">
      <div>
        <div class="cfg-label">${escapeHtml(label)}</div>
        <div class="cfg-sub">${escapeHtml(hint)}</div>
      </div>
      <label class="cfg-toggle">
        <input type="checkbox" data-setting="${escapeHtml(key)}" ${checked} />
        <span class="cfg-toggle-track"></span>
      </label>
    </div>
  `;
}

function renderDaysInput(key, label) {
  const s   = getSettings();
  const val = (s[key] || []).join(', ');

  return `
    <div class="cfg-row" style="cursor:default;">
      <div style="flex:1;">
        <div class="cfg-label">${escapeHtml(label)}</div>
        <div class="cfg-sub">Dias antes do vencimento (separados por vírgula)</div>
      </div>
      <input
        type="text"
        data-setting="${escapeHtml(key)}"
        value="${escapeHtml(val)}"
        class="modal-input"
        style="width:120px;margin:0;text-align:center;"
        placeholder="5, 3, 1, 0"
      />
    </div>
  `;
}

function renderHourInput() {
  const s   = getSettings();
  const val = s.daily_jobs_hour ?? 18;

  return `
    <div class="cfg-row" style="cursor:default;">
      <div style="flex:1;">
        <div class="cfg-label">🕐 Horário dos alertas diários</div>
        <div class="cfg-sub">Hora em que rodam os jobs de estoque e contas (0–23)</div>
      </div>
      <input
        type="number"
        data-setting="daily_jobs_hour"
        value="${escapeHtml(val)}"
        min="0" max="23"
        class="modal-input"
        style="width:80px;margin:0;text-align:center;"
      />
    </div>
  `;
}

function renderShopInfo() {
  const shop = configState.shop;
  if (!shop) return '';

  const statusBadge = shop.plan_status === 'active'
    ? '<span style="color:#00e676;font-weight:700;">● Ativo</span>'
    : '<span style="color:#f97316;font-weight:700;">⚠️ ' + (shop.plan_status || 'Pendente') + '</span>';

  const subEnd = shop.subscription_end
    ? new Date(shop.subscription_end).toLocaleDateString('pt-BR')
    : '—';

  return `
    <div class="card">
      <div class="card-header">
        <div class="card-title">Configurações da Barbearia</div>
      </div>

      <div class="cfg-row" style="cursor:default;">
        <div><div class="cfg-label">🏪 Nome</div></div>
        <div class="cfg-action-muted">${escapeHtml(shop.name || '—')}</div>
      </div>

      <div class="cfg-row" style="cursor:default;">
        <div><div class="cfg-label">📧 E-mail</div></div>
        <div class="cfg-action-muted">${escapeHtml(shop.email || '—')}</div>
      </div>

      <div class="cfg-row" style="cursor:default;">
        <div><div class="cfg-label">📱 WhatsApp da barbearia</div><div class="cfg-sub">Número que recebe alertas</div></div>
        <div class="cfg-action-muted">${escapeHtml(shop.whatsapp || '—')}</div>
      </div>

      <div class="cfg-row" style="cursor:default;">
        <div><div class="cfg-label">💳 Plano atual</div></div>
        <div>${statusBadge}</div>
      </div>

      <div class="cfg-row" style="cursor:default;">
        <div><div class="cfg-label">📅 Vigência até</div></div>
        <div class="cfg-action-muted">${escapeHtml(subEnd)}</div>
      </div>

      <div class="cfg-row" style="cursor:default;">
        <div>
          <div class="cfg-label">🤖 WhatsApp Bot</div>
          <div class="cfg-sub">Meta Phone ID configurado</div>
        </div>
        <div class="cfg-badge cfg-badge--${shop.meta_phone_id ? 'success' : 'muted'}">
          ${shop.meta_phone_id ? '● Conectado' : '○ Não configurado'}
        </div>
      </div>
    </div>
  `;
}

function renderNotificationSettings() {
  return `
    <div class="card">
      <div class="card-header">
        <div class="card-title">🔔 Notificações Automáticas</div>
      </div>

      <div style="font-size:9px;font-weight:700;letter-spacing:.1em;text-transform:uppercase;color:#3a4568;padding:4px 0 8px;">
        Agendamentos
      </div>

      ${renderToggle('appointment_confirmed',   '✅ Confirmação de agendamento', 'Envia msg para cliente e barbeiro ao confirmar')}
      ${renderToggle('appointment_cancelled',   '❌ Cancelamento de agendamento', 'Envia msg para o cliente ao cancelar')}
      ${renderToggle('appointment_reminder_1h', '⏰ Lembrete 1h antes', 'Envia lembrete ao cliente 1 hora antes')}

      <div style="font-size:9px;font-weight:700;letter-spacing:.1em;text-transform:uppercase;color:#3a4568;padding:12px 0 8px;">
        Financeiro
      </div>

      ${renderDaysInput('bills_reminder_days', '💳 Lembretes de contas a pagar')}
      ${renderDaysInput('subscription_reminder_days', '🔔 Lembretes de mensalidade do sistema')}

      <div style="font-size:9px;font-weight:700;letter-spacing:.1em;text-transform:uppercase;color:#3a4568;padding:12px 0 8px;">
        Operacional
      </div>

      ${renderToggle('stock_alert', '📦 Alerta de estoque baixo', 'Envia resumo diário de itens abaixo do mínimo')}
      ${renderHourInput()}

      <div id="cfg-notif-feedback" style="min-height:18px;font-size:10px;margin:10px 0 4px;color:#5a6888;"></div>

      <div style="display:flex;justify-content:flex-end;margin-top:4px;">
        <button type="button" class="btn-primary-gradient" id="cfg-save-btn" style="min-height:38px;">
          Salvar configurações
        </button>
      </div>
    </div>
  `;
}

// ─── Coleta dados do formulário ───────────────────────────────────────────────

function collectSettings() {
  const result = { ...getSettings() };

  document.querySelectorAll('[data-setting]').forEach(el => {
    const key = el.dataset.setting;

    if (el.type === 'checkbox') {
      result[key] = el.checked;
    } else if (key === 'bills_reminder_days' || key === 'subscription_reminder_days') {
      result[key] = el.value
        .split(',')
        .map(v => parseInt(v.trim(), 10))
        .filter(n => !isNaN(n) && n >= 0);
    } else if (key === 'daily_jobs_hour') {
      const h = parseInt(el.value, 10);
      result[key] = isNaN(h) ? 18 : Math.min(23, Math.max(0, h));
    }
  });

  return result;
}

// ─── API ──────────────────────────────────────────────────────────────────────

async function loadShopData() {
  try {
    const data = await apiFetch('/api/auth/me');
    configState.shop     = data?.barbershop || null;
    configState.settings = data?.barbershop?.notification_settings || null;
  } catch (error) {
    console.error('Erro ao carregar dados da barbearia:', error);
  }
}

async function saveSettings() {
  if (configState.isSaving) return;

  const newSettings = collectSettings();
  configState.isSaving = true;

  const btn = document.getElementById('cfg-save-btn');
  if (btn) btn.disabled = true;
  setFeedback('cfg-notif-feedback', 'Salvando...', 'neutral');

  try {
    await apiFetch('/api/barbershops/settings', {
      method: 'PATCH',
      body: JSON.stringify({ notification_settings: newSettings }),
    });

    configState.settings = newSettings;
    setFeedback('cfg-notif-feedback', 'Configurações salvas com sucesso!', 'success');
  } catch (error) {
    setFeedback('cfg-notif-feedback', error instanceof Error ? error.message : 'Erro ao salvar.', 'error');
  } finally {
    configState.isSaving = false;
    if (btn) btn.disabled = false;
  }
}

// ─── Export ───────────────────────────────────────────────────────────────────

export function renderConfiguracoes() {
  return /* html */ `
<section class="page-shell page--configuracoes">
  <div class="grid-2">
    <div id="cfg-shop-info">
      <div class="card">
        <div class="card-header"><div class="card-title">Carregando...</div></div>
      </div>
    </div>
    <div id="cfg-notification-settings">
      ${renderNotificationSettings()}
    </div>
  </div>

  <style>
    .cfg-toggle { position:relative; display:inline-flex; align-items:center; cursor:pointer; }
    .cfg-toggle input { opacity:0; width:0; height:0; position:absolute; }
    .cfg-toggle-track {
      width:36px; height:20px; background:#1e2345; border-radius:10px;
      transition:background .2s; position:relative; flex-shrink:0;
    }
    .cfg-toggle-track::after {
      content:''; position:absolute; width:14px; height:14px; border-radius:50%;
      background:#fff; top:3px; left:3px; transition:transform .2s;
    }
    .cfg-toggle input:checked + .cfg-toggle-track { background:linear-gradient(90deg,#00b4ff,#6c3fff); }
    .cfg-toggle input:checked + .cfg-toggle-track::after { transform:translateX(16px); }
  </style>
</section>
  `;
}

export async function initConfiguracoesPage() {
  await loadShopData();

  const shopInfo = document.getElementById('cfg-shop-info');
  if (shopInfo) shopInfo.innerHTML = renderShopInfo();

  document.getElementById('cfg-save-btn')?.addEventListener('click', saveSettings);
}
