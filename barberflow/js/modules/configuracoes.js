import { apiFetch } from '../services/api.js';

// ─── State ────────────────────────────────────────────────────────────────────

const configState = {
  shop: null,
  settings: null,
  workingHours: null,
  isSaving: false,
  isSavingHours: false,
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

// ─── Notificações ─────────────────────────────────────────────────────────────

const notifDefaults = {
  appointment_confirmed:      true,
  appointment_cancelled:      true,
  appointment_reminder_1h:    true,
  bills_reminder_days:        [5, 3, 1, 0],
  subscription_reminder_days: [5, 3, 1, 0],
  stock_alert:                true,
  daily_jobs_hour:            18,
};

function getSettings() {
  return { ...notifDefaults, ...(configState.settings || {}) };
}

function renderToggle(key, label, hint) {
  const s = getSettings();
  return `
    <div class="cfg-row" style="cursor:default;">
      <div>
        <div class="cfg-label">${escapeHtml(label)}</div>
        <div class="cfg-sub">${escapeHtml(hint)}</div>
      </div>
      <label class="cfg-toggle">
        <input type="checkbox" data-setting="${escapeHtml(key)}" ${s[key] ? 'checked' : ''} />
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
      <input type="text" data-setting="${escapeHtml(key)}" value="${escapeHtml(val)}"
        class="modal-input" style="width:120px;margin:0;text-align:center;" placeholder="5, 3, 1, 0"/>
    </div>
  `;
}

function renderHourInput() {
  const s = getSettings();
  return `
    <div class="cfg-row" style="cursor:default;">
      <div style="flex:1;">
        <div class="cfg-label">🕐 Horário dos alertas diários</div>
        <div class="cfg-sub">Hora em que rodam os jobs de estoque e contas (0–23)</div>
      </div>
      <input type="number" data-setting="daily_jobs_hour" value="${escapeHtml(s.daily_jobs_hour ?? 18)}"
        min="0" max="23" class="modal-input" style="width:80px;margin:0;text-align:center;"/>
    </div>
  `;
}

// ─── Horário de funcionamento ─────────────────────────────────────────────────

const DAY_LABELS = {
  monday:    'Segunda-feira',
  tuesday:   'Terça-feira',
  wednesday: 'Quarta-feira',
  thursday:  'Quinta-feira',
  friday:    'Sexta-feira',
  saturday:  'Sábado',
  sunday:    'Domingo',
};

const DAY_KEYS = ['monday','tuesday','wednesday','thursday','friday','saturday','sunday'];

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
  for (const key of DAY_KEYS) {
    if (raw[key]) {
      result[key] = {
        active: raw[key].active !== undefined ? Boolean(raw[key].active) : defaults[key].active,
        open:   raw[key].open  || defaults[key].open,
        close:  raw[key].close || defaults[key].close,
      };
    }
  }
  return result;
}

function renderWorkingHoursForm() {
  const hours = parseWorkingHours(configState.workingHours);

  const rows = DAY_KEYS.map(key => {
    const day = hours[key];
    return `
      <div class="cfg-row" style="cursor:default;gap:12px;flex-wrap:wrap;">
        <label class="cfg-toggle" style="flex-shrink:0;">
          <input type="checkbox" data-wh-day="${escapeHtml(key)}" data-wh-field="active"
            ${day.active ? 'checked' : ''}/>
          <span class="cfg-toggle-track"></span>
        </label>
        <div style="flex:1;min-width:100px;">
          <div class="cfg-label" style="font-size:11px;">${escapeHtml(DAY_LABELS[key])}</div>
        </div>
        <div style="display:flex;align-items:center;gap:6px;flex-shrink:0;">
          <input type="time" data-wh-day="${escapeHtml(key)}" data-wh-field="open"
            value="${escapeHtml(day.open)}"
            class="modal-input" style="width:100px;margin:0;padding:6px 8px;font-size:12px;"
            ${!day.active ? 'disabled' : ''}/>
          <span style="color:#5a6888;font-size:11px;">até</span>
          <input type="time" data-wh-day="${escapeHtml(key)}" data-wh-field="close"
            value="${escapeHtml(day.close)}"
            class="modal-input" style="width:100px;margin:0;padding:6px 8px;font-size:12px;"
            ${!day.active ? 'disabled' : ''}/>
        </div>
      </div>
    `;
  }).join('');

  return `
    <div class="card">
      <div class="card-header">
        <div class="card-title">🕐 Horário de Funcionamento</div>
      </div>
      ${rows}
      <div id="cfg-hours-feedback" style="min-height:18px;font-size:10px;margin:10px 0 4px;color:#5a6888;"></div>
      <div style="display:flex;justify-content:flex-end;margin-top:4px;">
        <button type="button" class="btn-primary-gradient" id="cfg-hours-save-btn" style="min-height:38px;">
          Salvar horários
        </button>
      </div>
    </div>
  `;
}

// ─── Info da barbearia ────────────────────────────────────────────────────────

function renderShopInfo() {
  const shop = configState.shop;
  if (!shop) return `
    <div class="card">
      <div class="card-header"><div class="card-title">Carregando...</div></div>
    </div>
  `;

  const statusBadge = shop.plan_status === 'active'
    ? '<span style="color:#00e676;font-weight:700;">● Ativo</span>'
    : `<span style="color:#f97316;font-weight:700;">⚠️ ${escapeHtml(shop.plan_status || 'Pendente')}</span>`;

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

      <div class="cfg-row" style="cursor:default;flex-wrap:wrap;gap:8px;">
        <div style="flex:1;">
          <div class="cfg-label">📱 WhatsApp da barbearia</div>
          <div class="cfg-sub">Com código do país + DDD. Ex: 5511999990000</div>
        </div>
        <div style="display:flex;align-items:center;gap:8px;flex-shrink:0;">
          <input type="text" id="cfg-whatsapp-input" class="modal-input"
            style="width:180px;margin:0;padding:7px 10px;"
            placeholder="5511999990000"
            value="${escapeHtml(shop.whatsapp || '')}"/>
          <button type="button" id="cfg-whatsapp-save-btn" class="btn-primary-gradient"
            style="min-height:34px;padding:7px 14px;font-size:11px;white-space:nowrap;">
            Salvar
          </button>
        </div>
      </div>
      <div id="cfg-whatsapp-feedback" style="min-height:16px;font-size:10px;margin:-4px 0 6px;color:#5a6888;padding:0 4px;"></div>

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
        <div style="font-size:11px;font-weight:700;color:${shop.meta_phone_id ? '#00e676' : '#5a6888'};">
          ${shop.meta_phone_id ? '● Conectado' : '○ Não configurado'}
        </div>
      </div>
    </div>
  `;
}

// ─── Notificações ─────────────────────────────────────────────────────────────

function renderNotificationSettings() {
  return `
    <div class="card">
      <div class="card-header">
        <div class="card-title">🔔 Notificações Automáticas</div>
      </div>

      <div style="font-size:9px;font-weight:700;letter-spacing:.1em;text-transform:uppercase;color:#3a4568;padding:4px 0 8px;">Agendamentos</div>
      ${renderToggle('appointment_confirmed',   '✅ Confirmação de agendamento', 'Envia msg para cliente e barbeiro ao confirmar')}
      ${renderToggle('appointment_cancelled',   '❌ Cancelamento de agendamento', 'Envia msg para o cliente ao cancelar')}
      ${renderToggle('appointment_reminder_1h', '⏰ Lembrete 1h antes', 'Envia lembrete ao cliente 1 hora antes')}

      <div style="font-size:9px;font-weight:700;letter-spacing:.1em;text-transform:uppercase;color:#3a4568;padding:12px 0 8px;">Financeiro</div>
      ${renderDaysInput('bills_reminder_days', '💳 Lembretes de contas a pagar')}
      ${renderDaysInput('subscription_reminder_days', '🔔 Lembretes de mensalidade do sistema')}

      <div style="font-size:9px;font-weight:700;letter-spacing:.1em;text-transform:uppercase;color:#3a4568;padding:12px 0 8px;">Operacional</div>
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

// ─── Coleta dados ─────────────────────────────────────────────────────────────

function collectSettings() {
  const result = { ...getSettings() };
  document.querySelectorAll('[data-setting]').forEach(el => {
    const key = el.dataset.setting;
    if (el.type === 'checkbox') {
      result[key] = el.checked;
    } else if (key === 'bills_reminder_days' || key === 'subscription_reminder_days') {
      result[key] = el.value.split(',').map(v => parseInt(v.trim(), 10)).filter(n => !isNaN(n) && n >= 0);
    } else if (key === 'daily_jobs_hour') {
      const h = parseInt(el.value, 10);
      result[key] = isNaN(h) ? 18 : Math.min(23, Math.max(0, h));
    }
  });
  return result;
}

function collectWorkingHours() {
  const result = parseWorkingHours(configState.workingHours);
  document.querySelectorAll('[data-wh-day][data-wh-field]').forEach(el => {
    const day   = el.dataset.whDay;
    const field = el.dataset.whField;
    if (!result[day]) return;
    if (field === 'active') {
      result[day].active = el.checked;
    } else {
      result[day][field] = el.value;
    }
  });
  return result;
}

// ─── API ──────────────────────────────────────────────────────────────────────

async function loadShopData() {
  try {
    const data = await apiFetch('/api/auth/me');
    configState.shop         = data?.barbershop || null;
    configState.settings     = data?.barbershop?.notification_settings || null;
    configState.workingHours = data?.barbershop?.working_hours || null;
  } catch (error) {
    console.error('Erro ao carregar dados da barbearia:', error);
  }
}

async function saveSettings() {
  if (configState.isSaving) return;
  configState.isSaving = true;
  const btn = document.getElementById('cfg-save-btn');
  if (btn) btn.disabled = true;
  setFeedback('cfg-notif-feedback', 'Salvando...', 'neutral');

  try {
    await apiFetch('/api/barbershops/settings', {
      method: 'PATCH',
      body: JSON.stringify({ notification_settings: collectSettings() }),
    });
    configState.settings = collectSettings();
    setFeedback('cfg-notif-feedback', 'Configurações salvas com sucesso!', 'success');
  } catch (error) {
    setFeedback('cfg-notif-feedback', error instanceof Error ? error.message : 'Erro ao salvar.', 'error');
  } finally {
    configState.isSaving = false;
    if (btn) btn.disabled = false;
  }
}

async function saveWhatsApp() {
  const input = document.getElementById('cfg-whatsapp-input');
  const btn   = document.getElementById('cfg-whatsapp-save-btn');
  const phone = String(input?.value || '').replace(/\D/g, '').trim();

  if (!phone || phone.length < 10) {
    setFeedback('cfg-whatsapp-feedback', 'Informe um número válido com DDD e código do país.', 'error');
    return;
  }

  if (btn) btn.disabled = true;
  setFeedback('cfg-whatsapp-feedback', 'Salvando...', 'neutral');

  try {
    await apiFetch('/api/barbershops/settings', {
      method: 'PATCH',
      body: JSON.stringify({ whatsapp: phone }),
    });
    if (configState.shop) configState.shop.whatsapp = phone;
    if (input) input.value = phone;
    setFeedback('cfg-whatsapp-feedback', '✓ Número salvo com sucesso!', 'success');
  } catch (error) {
    setFeedback('cfg-whatsapp-feedback', error instanceof Error ? error.message : 'Erro ao salvar.', 'error');
  } finally {
    if (btn) btn.disabled = false;
  }
}

async function saveWorkingHours() {
  if (configState.isSavingHours) return;
  configState.isSavingHours = true;
  const btn = document.getElementById('cfg-hours-save-btn');
  if (btn) btn.disabled = true;
  setFeedback('cfg-hours-feedback', 'Salvando...', 'neutral');

  try {
    const hours = collectWorkingHours();
    await apiFetch('/api/barbershops/settings', {
      method: 'PATCH',
      body: JSON.stringify({ working_hours: hours }),
    });
    configState.workingHours = hours;
    setFeedback('cfg-hours-feedback', 'Horários salvos com sucesso!', 'success');
  } catch (error) {
    setFeedback('cfg-hours-feedback', error instanceof Error ? error.message : 'Erro ao salvar.', 'error');
  } finally {
    configState.isSavingHours = false;
    if (btn) btn.disabled = false;
  }
}

// ─── Bind events ──────────────────────────────────────────────────────────────

function bindWorkingHoursEvents() {
  // Habilita/desabilita inputs de horário ao togular o dia
  document.querySelectorAll('[data-wh-field="active"]').forEach(checkbox => {
    checkbox.addEventListener('change', () => {
      const day = checkbox.dataset.whDay;
      const inputs = document.querySelectorAll(
        `[data-wh-day="${day}"][data-wh-field="open"],
         [data-wh-day="${day}"][data-wh-field="close"]`
      );
      inputs.forEach(input => { input.disabled = !checkbox.checked; });
    });
  });

  document.getElementById('cfg-hours-save-btn')?.addEventListener('click', saveWorkingHours);
}

// ─── Export ───────────────────────────────────────────────────────────────────

export function renderConfiguracoes() {
  return /* html */ `
<section class="page-shell page--configuracoes">
  <div class="grid-2">
    <div>
      <div id="cfg-shop-info">
        <div class="card">
          <div class="card-header"><div class="card-title">Carregando...</div></div>
        </div>
      </div>
      <div id="cfg-working-hours">
        <div class="card">
          <div class="card-header"><div class="card-title">Carregando...</div></div>
        </div>
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
    input[type="time"]:disabled { opacity:.35; cursor:not-allowed; }
  </style>
</section>
  `;
}

export async function initConfiguracoesPage() {
  await loadShopData();

  const shopInfo = document.getElementById('cfg-shop-info');
  if (shopInfo) shopInfo.innerHTML = renderShopInfo();

  const workingHoursEl = document.getElementById('cfg-working-hours');
  if (workingHoursEl) workingHoursEl.innerHTML = renderWorkingHoursForm();

  document.getElementById('cfg-save-btn')?.addEventListener('click', saveSettings);
  document.getElementById('cfg-whatsapp-save-btn')?.addEventListener('click', saveWhatsApp);
  bindWorkingHoursEvents();
}
