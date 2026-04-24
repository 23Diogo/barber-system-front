import { apiFetch } from '../services/api.js';

// ─── State ────────────────────────────────────────────────────────────────────

const configState = {
  shop: null,
  settings: null,
  workingHours: null,
  isSaving: false,
  isSavingHours: false,
  isSavingReactivation: false,
  isSavingBot: false,
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

// ─── Defaults ─────────────────────────────────────────────────────────────────

const REACTIVATION_DEFAULT_MSG =
  `👋 Olá, {nome}! Sentimos muito a sua falta 😊\n\n` +
  `Faz *{dias} dias* que você não passa aqui, e a gente ficou preocupado! 💈\n\n` +
  `Que tal dar uma renovada no visual essa semana?\n\n` +
  `🎁 Como presente de retorno, você ganha um *desconto especial* na próxima visita!\n\n` +
  `👉 Agende agora: {link}\n\n` +
  `_Te esperamos! Qualquer dúvida é só chamar._ 😄`;

const notifDefaults = {
  appointment_confirmed:         true,
  appointment_cancelled:         true,
  appointment_reminder_1h:       true,
  bills_reminder_enabled:        true,
  bills_reminder_days:           [5, 3, 1, 0],
  bills_reminder_hour:           9,
  subscription_reminder_enabled: true,
  subscription_reminder_days:    [5, 3, 1, 0],
  subscription_reminder_hour:    9,
  stock_alert_enabled:           true,
  stock_alert_hour:              8,
  reactivation_enabled:          true,
  reactivation_hour:             10,
  reactivation_message:          '',
  new_client_alert:              true,
};

function getSettings() {
  return { ...notifDefaults, ...(configState.settings || {}) };
}

// ─── Render helpers ───────────────────────────────────────────────────────────

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
    </div>`;
}

function renderToggleWithHour(enabledKey, hourKey, label, hint) {
  const s = getSettings();
  return `
    <div class="cfg-row" style="cursor:default;flex-wrap:wrap;gap:8px;">
      <div style="flex:1;">
        <div class="cfg-label">${escapeHtml(label)}</div>
        <div class="cfg-sub">${escapeHtml(hint)}</div>
      </div>
      <div style="display:flex;align-items:center;gap:10px;flex-shrink:0;">
        <div style="display:flex;align-items:center;gap:5px;">
          <span style="font-size:10px;color:#5a6888;">🕐 Hora:</span>
          <input type="number" data-setting="${escapeHtml(hourKey)}"
            value="${escapeHtml(s[hourKey] ?? 9)}"
            min="0" max="23"
            class="modal-input"
            style="width:60px;margin:0;text-align:center;padding:5px 6px;font-size:11px;"
            title="Hora de envio (0–23h)"/>
        </div>
        <label class="cfg-toggle">
          <input type="checkbox" data-setting="${escapeHtml(enabledKey)}" ${s[enabledKey] ? 'checked' : ''} />
          <span class="cfg-toggle-track"></span>
        </label>
      </div>
    </div>`;
}

function renderDaysWithHour(daysKey, hourKey, enabledKey, label) {
  const s   = getSettings();
  const val = (s[daysKey] || []).join(', ');
  return `
    <div style="background:rgba(255,255,255,.02);border-radius:10px;padding:12px 14px;margin-bottom:7px;border:1px solid transparent;">
      <div style="display:flex;align-items:center;justify-content:space-between;gap:8px;flex-wrap:wrap;">
        <div style="flex:1;">
          <div class="cfg-label">${escapeHtml(label)}</div>
          <div class="cfg-sub">Dias antes do vencimento (separados por vírgula)</div>
        </div>
        <label class="cfg-toggle">
          <input type="checkbox" data-setting="${escapeHtml(enabledKey)}" ${s[enabledKey] ? 'checked' : ''} />
          <span class="cfg-toggle-track"></span>
        </label>
      </div>
      <div style="display:flex;align-items:center;gap:10px;margin-top:10px;flex-wrap:wrap;">
        <div style="display:flex;align-items:center;gap:6px;flex:1;">
          <span style="font-size:10px;color:#5a6888;white-space:nowrap;">📅 Dias:</span>
          <input type="text" data-setting="${escapeHtml(daysKey)}" value="${escapeHtml(val)}"
            class="modal-input" style="flex:1;margin:0;text-align:center;" placeholder="5, 3, 1, 0"/>
        </div>
        <div style="display:flex;align-items:center;gap:6px;flex-shrink:0;">
          <span style="font-size:10px;color:#5a6888;white-space:nowrap;">🕐 Hora:</span>
          <input type="number" data-setting="${escapeHtml(hourKey)}"
            value="${escapeHtml(s[hourKey] ?? 9)}"
            min="0" max="23"
            class="modal-input"
            style="width:60px;margin:0;text-align:center;padding:5px 6px;font-size:11px;"/>
        </div>
      </div>
    </div>`;
}

// ─── Horário de funcionamento ─────────────────────────────────────────────────

const DAY_LABELS = {
  monday:'Segunda-feira', tuesday:'Terça-feira', wednesday:'Quarta-feira',
  thursday:'Quinta-feira', friday:'Sexta-feira', saturday:'Sábado', sunday:'Domingo',
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
        open:   raw[key].open   || defaults[key].open,
        close:  raw[key].close  || defaults[key].close,
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
          <input type="checkbox" data-wh-day="${escapeHtml(key)}" data-wh-field="active" ${day.active ? 'checked' : ''}/>
          <span class="cfg-toggle-track"></span>
        </label>
        <div style="flex:1;min-width:100px;">
          <div class="cfg-label" style="font-size:11px;">${escapeHtml(DAY_LABELS[key])}</div>
        </div>
        <div style="display:flex;align-items:center;gap:6px;flex-shrink:0;">
          <input type="time" data-wh-day="${escapeHtml(key)}" data-wh-field="open"
            value="${escapeHtml(day.open)}" class="modal-input"
            style="width:100px;margin:0;padding:6px 8px;font-size:12px;"
            ${!day.active ? 'disabled' : ''}/>
          <span style="color:#5a6888;font-size:11px;">até</span>
          <input type="time" data-wh-day="${escapeHtml(key)}" data-wh-field="close"
            value="${escapeHtml(day.close)}" class="modal-input"
            style="width:100px;margin:0;padding:6px 8px;font-size:12px;"
            ${!day.active ? 'disabled' : ''}/>
        </div>
      </div>`;
  }).join('');

  return `
    <div class="card">
      <div class="card-header"><div class="card-title">🕐 Horário de Funcionamento</div></div>
      ${rows}
      <div id="cfg-hours-feedback" style="min-height:18px;font-size:10px;margin:10px 0 4px;color:#5a6888;"></div>
      <div style="display:flex;justify-content:flex-end;margin-top:4px;">
        <button type="button" class="btn-primary-gradient" id="cfg-hours-save-btn" style="min-height:38px;">
          Salvar horários
        </button>
      </div>
    </div>`;
}

// ─── Info da barbearia ────────────────────────────────────────────────────────

function buildInviteLink(slug) {
  return `https://bbarberflow.com.br/client/cadastro/${encodeURIComponent(slug)}`;
}

function renderShopInfo() {
  const shop = configState.shop;
  if (!shop) return `<div class="card"><div class="card-header"><div class="card-title">Carregando...</div></div></div>`;

  const statusBadge = shop.plan_status === 'active'
    ? '<span style="color:#00e676;font-weight:700;">● Ativo</span>'
    : `<span style="color:#f97316;font-weight:700;">⚠️ ${escapeHtml(shop.plan_status || 'Pendente')}</span>`;

  const subEnd = shop.subscription_end
    ? new Date(shop.subscription_end).toLocaleDateString('pt-BR') : '—';

  const inviteLink = shop.slug ? buildInviteLink(shop.slug) : null;

  const botConnected = !!(shop.meta_phone_id && shop.meta_access_token);

  return `
    <div class="card">
      <div class="card-header"><div class="card-title">Configurações da Barbearia</div></div>

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

      <div class="cfg-row" style="cursor:default;flex-direction:column;align-items:flex-start;gap:8px;">
        <div>
          <div class="cfg-label">📨 Link de convite de clientes</div>
          <div class="cfg-sub">Compartilhe este link para que clientes se cadastrem direto na sua barbearia</div>
        </div>
        ${inviteLink ? `
          <div class="cfg-invite-link-box">
            <span class="cfg-invite-link-text">${escapeHtml(inviteLink)}</span>
            <button type="button" id="cfg-invite-copy-btn" class="btn-save cfg-invite-copy-btn">Copiar link</button>
          </div>
          <div id="cfg-invite-feedback" style="min-height:14px;font-size:10px;color:#5a6888;"></div>
        ` : `<div class="cfg-action-muted">Slug da barbearia não configurado.</div>`}
      </div>
    </div>

    <!-- ── WhatsApp Bot ── -->
    <div class="card" style="border-color:${botConnected ? 'rgba(0,230,118,.2)' : 'rgba(79,195,247,.12)'};">
      <div class="card-header">
        <div class="card-title">🤖 WhatsApp Bot</div>
        <span style="font-size:11px;font-weight:700;color:${botConnected ? '#00e676' : '#5a6888'};">
          ${botConnected ? '● Conectado' : '○ Não configurado'}
        </span>
      </div>

      <div class="cfg-sub" style="margin-bottom:14px;">
        Configure aqui o número e o token da API do WhatsApp Business para enviar notificações automáticas.
        Obtenha esses dados em
        <a href="https://developers.facebook.com/apps" target="_blank" rel="noopener"
          style="color:#4fc3f7;">developers.facebook.com/apps</a>
        → seu app → Configuração da API.
      </div>

      <div style="display:grid;gap:10px;">
        <div>
          <div class="color-section-label">Phone Number ID</div>
          <input type="text" id="cfg-meta-phone-id" class="modal-input"
            placeholder="Ex: 1118500758022349"
            value="${escapeHtml(shop.meta_phone_id || '')}"/>
        </div>
        <div>
          <div class="color-section-label">Access Token</div>
          <input type="password" id="cfg-meta-token" class="modal-input"
            placeholder="EAAxxxxxx..."
            value="${escapeHtml(shop.meta_access_token || '')}"/>
          <div style="font-size:10px;color:#3a4568;margin-top:4px;">
            ⚠️ O token temporário expira em 24h. Para produção use um token permanente via System User.
          </div>
        </div>
      </div>

      <div id="cfg-bot-feedback" style="min-height:18px;font-size:10px;margin:10px 0 4px;color:#5a6888;"></div>
      <div style="display:flex;justify-content:flex-end;margin-top:4px;">
        <button type="button" class="btn-primary-gradient" id="cfg-bot-save-btn" style="min-height:38px;">
          Salvar configuração do Bot
        </button>
      </div>
    </div>`;
}

// ─── Notificações ─────────────────────────────────────────────────────────────

function renderNotificationSettings() {
  return `
    <div class="card">
      <div class="card-header"><div class="card-title">🔔 Notificações Automáticas</div></div>

      <div style="font-size:9px;font-weight:700;letter-spacing:.1em;text-transform:uppercase;color:#3a4568;padding:4px 0 8px;">
        Agendamentos — disparo imediato
      </div>
      ${renderToggle('appointment_confirmed',   '✅ Confirmação de agendamento', 'Envia msg para cliente e barbeiro ao confirmar')}
      ${renderToggle('appointment_cancelled',   '❌ Cancelamento de agendamento', 'Envia msg para o cliente ao cancelar')}
      ${renderToggle('appointment_reminder_1h', '⏰ Lembrete 1h antes', 'Envia lembrete ao cliente 1 hora antes do horário')}

      <div style="font-size:9px;font-weight:700;letter-spacing:.1em;text-transform:uppercase;color:#3a4568;padding:12px 0 8px;">
        Financeiro — horário configurável
      </div>
      ${renderDaysWithHour('bills_reminder_days', 'bills_reminder_hour', 'bills_reminder_enabled', '💳 Lembretes de contas a pagar')}
      ${renderDaysWithHour('subscription_reminder_days', 'subscription_reminder_hour', 'subscription_reminder_enabled', '🔔 Lembretes de mensalidade do sistema')}

      <div style="font-size:9px;font-weight:700;letter-spacing:.1em;text-transform:uppercase;color:#3a4568;padding:12px 0 8px;">
        Operacional — horário configurável
      </div>
      ${renderToggleWithHour('stock_alert_enabled', 'stock_alert_hour', '📦 Alerta de estoque baixo', 'Envia resumo diário de itens abaixo do estoque mínimo')}

      <div style="font-size:9px;font-weight:700;letter-spacing:.1em;text-transform:uppercase;color:#3a4568;padding:12px 0 8px;">
        Clientes
      </div>
      ${renderToggle('new_client_alert', '🎉 Novo cliente cadastrado', 'Receba uma msg quando um cliente se cadastrar pelo link de convite')}
      ${renderToggleWithHour('reactivation_enabled', 'reactivation_hour', '🔄 Reativação de clientes inativos', 'Envia mensagem automática para clientes sem visita há 30–60 dias')}

      <div id="cfg-notif-feedback" style="min-height:18px;font-size:10px;margin:10px 0 4px;color:#5a6888;"></div>
      <div style="display:flex;justify-content:flex-end;margin-top:4px;">
        <button type="button" class="btn-primary-gradient" id="cfg-save-btn" style="min-height:38px;">
          Salvar configurações
        </button>
      </div>
    </div>`;
}

// ─── Mensagem de reativação ───────────────────────────────────────────────────

function renderReactivationMessage() {
  const s   = getSettings();
  const msg = s.reactivation_message || REACTIVATION_DEFAULT_MSG;

  return `
    <div class="card">
      <div class="card-header">
        <div class="card-title">💬 Mensagem de Reativação</div>
      </div>
      <div class="cfg-sub" style="margin-bottom:12px;">
        Use as variáveis abaixo — clique para inserir no cursor.
      </div>
      <div style="display:flex;gap:6px;flex-wrap:wrap;margin-bottom:12px;">
        <span class="cfg-var-chip" data-var="{nome}">{nome} — nome do cliente</span>
        <span class="cfg-var-chip" data-var="{dias}">{dias} — dias sem visitar</span>
        <span class="cfg-var-chip" data-var="{link}">{link} — link de agendamento</span>
      </div>
      <textarea id="cfg-reactivation-msg" class="modal-input" rows="10" maxlength="1000"
        style="resize:vertical;min-height:180px;line-height:1.6;font-size:12px;"
        placeholder="Digite a mensagem...">${escapeHtml(msg)}</textarea>
      <div style="display:flex;align-items:center;justify-content:space-between;margin-top:6px;">
        <span id="cfg-reactivation-char" style="font-size:10px;color:#3a4568;">${msg.length} / 1000</span>
        <button type="button" class="cfg-reactivation-reset"
          style="font-size:10px;color:#4a5880;background:none;border:none;cursor:pointer;padding:0;">
          ↺ Restaurar padrão
        </button>
      </div>
      <div style="margin-top:14px;">
        <div style="font-size:9px;font-weight:700;letter-spacing:.1em;text-transform:uppercase;color:#3a4568;margin-bottom:8px;">Preview (exemplo)</div>
        <div id="cfg-reactivation-preview"
          style="background:#080b18;border:1px solid #1a2040;border-radius:10px;padding:12px 14px;font-size:12px;color:#c0cce8;line-height:1.7;white-space:pre-wrap;word-break:break-word;"></div>
      </div>
      <div id="cfg-reactivation-feedback" style="min-height:18px;font-size:10px;margin:10px 0 4px;color:#5a6888;"></div>
      <div style="display:flex;justify-content:flex-end;margin-top:4px;">
        <button type="button" class="btn-primary-gradient" id="cfg-reactivation-save-btn" style="min-height:38px;">
          Salvar mensagem
        </button>
      </div>
    </div>

    <style>
      .cfg-var-chip{display:inline-flex;align-items:center;padding:3px 10px;border-radius:8px;
        background:rgba(79,195,247,.08);border:1px solid rgba(79,195,247,.2);color:#4fc3f7;
        font-size:11px;font-weight:700;cursor:pointer;transition:background .15s;user-select:none;}
      .cfg-var-chip:hover{background:rgba(79,195,247,.16);}
      .cfg-reactivation-reset:hover{color:#c0cce8;}
    </style>`;
}

// ─── Card de testes ───────────────────────────────────────────────────────────

function renderTestCard() {
  const tests = [
    { id: 'test-bills',                 icon: '💳', label: 'Conta a pagar',          endpoint: '/api/test-notifications/bills' },
    { id: 'test-stock',                 icon: '📦', label: 'Estoque baixo',           endpoint: '/api/test-notifications/stock' },
    { id: 'test-subscription',          icon: '🔔', label: 'Mensalidade do sistema',  endpoint: '/api/test-notifications/subscription' },
    { id: 'test-appointment-confirmed', icon: '✅', label: 'Confirmação agendamento', endpoint: '/api/test-notifications/appointment-confirmed' },
    { id: 'test-appointment-reminder',  icon: '⏰', label: 'Lembrete 1h antes',       endpoint: '/api/test-notifications/appointment-reminder' },
    { id: 'test-new-client',            icon: '🎉', label: 'Novo cliente cadastrado', endpoint: '/api/test-notifications/new-client' },
    { id: 'test-reactivation',          icon: '🔄', label: 'Reativação de clientes',  endpoint: '/api/test-notifications/reactivation' },
  ];

  const buttons = tests.map(t => `
    <button type="button" class="cfg-test-btn" data-endpoint="${t.endpoint}" id="${t.id}">
      <span class="cfg-test-icon">${t.icon}</span>
      <span class="cfg-test-label">${t.label}</span>
      <span class="cfg-test-status" id="${t.id}-status"></span>
    </button>
  `).join('');

  return `
    <div class="card" style="border-color:rgba(255,193,7,.15);">
      <div class="card-header">
        <div class="card-title" style="color:#ffc107;">🧪 Testar Notificações</div>
      </div>
      <div class="cfg-sub" style="margin-bottom:14px;">
        Clique em qualquer botão para enviar uma mensagem de teste para o WhatsApp da barbearia agora mesmo.
      </div>
      <div style="display:grid;gap:8px;">
        ${buttons}
      </div>
      <div id="cfg-test-feedback" style="min-height:18px;font-size:11px;margin-top:12px;color:#5a6888;text-align:center;"></div>
    </div>

    <style>
      .cfg-test-btn{
        display:flex;align-items:center;gap:10px;width:100%;
        padding:10px 14px;border-radius:10px;
        border:1px solid rgba(255,193,7,.15);background:rgba(255,193,7,.04);
        color:#e8f0fe;font:inherit;font-size:12px;font-weight:600;
        cursor:pointer;transition:all .15s;text-align:left;
      }
      .cfg-test-btn:hover{border-color:rgba(255,193,7,.35);background:rgba(255,193,7,.08);}
      .cfg-test-btn:disabled{opacity:.5;cursor:not-allowed;}
      .cfg-test-icon{font-size:16px;flex-shrink:0;}
      .cfg-test-label{flex:1;}
      .cfg-test-status{font-size:10px;font-weight:700;flex-shrink:0;min-width:60px;text-align:right;}
    </style>`;
}

// ─── Preview da reativação ────────────────────────────────────────────────────

function updateReactivationPreview() {
  const preview  = document.getElementById('cfg-reactivation-preview');
  const textarea = document.getElementById('cfg-reactivation-msg');
  if (!preview || !textarea) return;
  const slug = configState.shop?.slug || 'minha-barbearia';
  const link = `https://bbarberflow.com.br/client/cadastro/${slug}`;
  preview.textContent = (textarea.value || REACTIVATION_DEFAULT_MSG)
    .replace(/\{nome\}/g, 'Carlos')
    .replace(/\{dias\}/g, '35')
    .replace(/\{link\}/g, link);
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
    } else if (['bills_reminder_hour','subscription_reminder_hour','stock_alert_hour','reactivation_hour'].includes(key)) {
      const h = parseInt(el.value, 10);
      result[key] = isNaN(h) ? 9 : Math.min(23, Math.max(0, h));
    } else {
      result[key] = String(el.value || '');
    }
  });
  return result;
}

function collectWorkingHours() {
  const result = parseWorkingHours(configState.workingHours);
  document.querySelectorAll('[data-wh-day][data-wh-field]').forEach(el => {
    const day = el.dataset.whDay; const field = el.dataset.whField;
    if (!result[day]) return;
    if (field === 'active') result[day].active = el.checked;
    else result[day][field] = el.value;
  });
  return result;
}

function collectReactivationSettings() {
  return {
    ...getSettings(),
    reactivation_message: document.getElementById('cfg-reactivation-msg')?.value || '',
  };
}

// ─── API ──────────────────────────────────────────────────────────────────────

async function loadShopData() {
  try {
    const data = await apiFetch('/api/auth/me');
    configState.shop = data?.barbershop || data?.barbershops || null;
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
    setFeedback('cfg-notif-feedback', '✓ Configurações salvas!', 'success');
  } catch (error) {
    setFeedback('cfg-notif-feedback', error instanceof Error ? error.message : 'Erro ao salvar.', 'error');
  } finally {
    configState.isSaving = false;
    if (btn) btn.disabled = false;
  }
}

async function saveReactivationSettings() {
  if (configState.isSavingReactivation) return;
  configState.isSavingReactivation = true;
  const btn = document.getElementById('cfg-reactivation-save-btn');
  if (btn) btn.disabled = true;
  setFeedback('cfg-reactivation-feedback', 'Salvando...', 'neutral');
  try {
    const settings = collectReactivationSettings();
    await apiFetch('/api/barbershops/settings', {
      method: 'PATCH',
      body: JSON.stringify({ notification_settings: settings }),
    });
    configState.settings = settings;
    setFeedback('cfg-reactivation-feedback', '✓ Mensagem salva!', 'success');
  } catch (error) {
    setFeedback('cfg-reactivation-feedback', error instanceof Error ? error.message : 'Erro ao salvar.', 'error');
  } finally {
    configState.isSavingReactivation = false;
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
    setFeedback('cfg-whatsapp-feedback', '✓ Número salvo!', 'success');
  } catch (error) {
    setFeedback('cfg-whatsapp-feedback', error instanceof Error ? error.message : 'Erro ao salvar.', 'error');
  } finally {
    if (btn) btn.disabled = false;
  }
}

async function saveWhatsAppBot() {
  if (configState.isSavingBot) return;
  configState.isSavingBot = true;
  const btn     = document.getElementById('cfg-bot-save-btn');
  const phoneId = String(document.getElementById('cfg-meta-phone-id')?.value || '').trim();
  const token   = String(document.getElementById('cfg-meta-token')?.value || '').trim();
  if (btn) btn.disabled = true;
  setFeedback('cfg-bot-feedback', 'Salvando...', 'neutral');
  try {
    if (!phoneId) throw new Error('Informe o Phone Number ID.');
    if (!token)   throw new Error('Informe o Access Token.');
    await apiFetch('/api/barbershops/settings', {
      method: 'PATCH',
      body: JSON.stringify({ meta_phone_id: phoneId, meta_access_token: token }),
    });
    if (configState.shop) {
      configState.shop.meta_phone_id    = phoneId;
      configState.shop.meta_access_token = token;
    }
    setFeedback('cfg-bot-feedback', '✓ WhatsApp Bot configurado com sucesso!', 'success');
    // Atualiza o indicador de status sem recarregar a página toda
    const shopInfo = document.getElementById('cfg-shop-info');
    if (shopInfo) shopInfo.innerHTML = renderShopInfo();
    bindShopInfoEvents();
  } catch (error) {
    setFeedback('cfg-bot-feedback', error instanceof Error ? error.message : 'Erro ao salvar.', 'error');
  } finally {
    configState.isSavingBot = false;
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
    setFeedback('cfg-hours-feedback', 'Horários salvos!', 'success');
  } catch (error) {
    setFeedback('cfg-hours-feedback', error instanceof Error ? error.message : 'Erro ao salvar.', 'error');
  } finally {
    configState.isSavingHours = false;
    if (btn) btn.disabled = false;
  }
}

// ─── Event binding ────────────────────────────────────────────────────────────

function bindShopInfoEvents() {
  document.getElementById('cfg-whatsapp-save-btn')?.addEventListener('click', saveWhatsApp);
  document.getElementById('cfg-bot-save-btn')?.addEventListener('click', saveWhatsAppBot);
  bindInviteLinkCopy();
}

function bindInviteLinkCopy() {
  document.getElementById('cfg-invite-copy-btn')?.addEventListener('click', async () => {
    const slug = configState.shop?.slug;
    if (!slug) return;
    const link = buildInviteLink(slug);
    try {
      if (navigator.clipboard?.writeText) await navigator.clipboard.writeText(link);
      else {
        const ta = document.createElement('textarea');
        ta.value = link; ta.style.position = 'absolute'; ta.style.left = '-9999px';
        document.body.appendChild(ta); ta.select(); document.execCommand('copy'); document.body.removeChild(ta);
      }
      setFeedback('cfg-invite-feedback', '✓ Link copiado!', 'success');
    } catch {
      setFeedback('cfg-invite-feedback', 'Não foi possível copiar.', 'error');
    }
  });
}

function bindWorkingHoursEvents() {
  document.querySelectorAll('[data-wh-field="active"]').forEach(checkbox => {
    checkbox.addEventListener('change', () => {
      const day = checkbox.dataset.whDay;
      document.querySelectorAll(
        `[data-wh-day="${day}"][data-wh-field="open"], [data-wh-day="${day}"][data-wh-field="close"]`
      ).forEach(input => { input.disabled = !checkbox.checked; });
    });
  });
  document.getElementById('cfg-hours-save-btn')?.addEventListener('click', saveWorkingHours);
}

function bindReactivationEvents() {
  const textarea  = document.getElementById('cfg-reactivation-msg');
  const charCount = document.getElementById('cfg-reactivation-char');

  textarea?.addEventListener('input', () => {
    if (charCount) charCount.textContent = `${textarea.value.length} / 1000`;
    updateReactivationPreview();
  });

  document.querySelectorAll('.cfg-var-chip').forEach(chip => {
    chip.addEventListener('click', () => {
      if (!textarea) return;
      const variable = chip.dataset.var;
      const start = textarea.selectionStart, end = textarea.selectionEnd;
      textarea.value = textarea.value.substring(0, start) + variable + textarea.value.substring(end);
      textarea.selectionStart = textarea.selectionEnd = start + variable.length;
      textarea.focus();
      if (charCount) charCount.textContent = `${textarea.value.length} / 1000`;
      updateReactivationPreview();
    });
  });

  document.querySelector('.cfg-reactivation-reset')?.addEventListener('click', () => {
    if (!textarea) return;
    if (!confirm('Restaurar a mensagem padrão? Sua mensagem atual será perdida.')) return;
    textarea.value = REACTIVATION_DEFAULT_MSG;
    if (charCount) charCount.textContent = `${textarea.value.length} / 1000`;
    updateReactivationPreview();
  });

  document.getElementById('cfg-reactivation-save-btn')?.addEventListener('click', saveReactivationSettings);
  updateReactivationPreview();
}

function bindTestEvents() {
  document.querySelectorAll('.cfg-test-btn[data-endpoint]').forEach(btn => {
    btn.addEventListener('click', async () => {
      const endpoint  = btn.dataset.endpoint;
      const statusEl  = btn.querySelector('.cfg-test-status');
      const feedbackEl = document.getElementById('cfg-test-feedback');

      btn.disabled = true;
      if (statusEl)   { statusEl.textContent = '⏳'; statusEl.style.color = '#5a6888'; }
      if (feedbackEl) { feedbackEl.textContent = ''; }

      try {
        const result = await apiFetch(endpoint, { method: 'POST' });
        if (statusEl)   { statusEl.textContent = '✓ Enviado'; statusEl.style.color = '#00e676'; }
        if (feedbackEl) { feedbackEl.textContent = result?.message || 'Enviado!'; feedbackEl.style.color = '#00e676'; }
      } catch (err) {
        if (statusEl)   { statusEl.textContent = '✗ Erro'; statusEl.style.color = '#ff8a8a'; }
        if (feedbackEl) { feedbackEl.textContent = err instanceof Error ? err.message : 'Erro ao enviar.'; feedbackEl.style.color = '#ff8a8a'; }
      } finally {
        btn.disabled = false;
        setTimeout(() => { if (statusEl) statusEl.textContent = ''; }, 5000);
      }
    });
  });
}

// ─── Export ───────────────────────────────────────────────────────────────────

export function renderConfiguracoes() {
  return /* html */ `
<section class="page-shell page--configuracoes">
  <div class="grid-2">
    <div>
      <div id="cfg-shop-info">
        <div class="card"><div class="card-header"><div class="card-title">Carregando...</div></div></div>
      </div>
      <div id="cfg-working-hours">
        <div class="card"><div class="card-header"><div class="card-title">Carregando...</div></div></div>
      </div>
      <div id="cfg-reactivation-section">
        <div class="card"><div class="card-header"><div class="card-title">Carregando...</div></div></div>
      </div>
      <div id="cfg-test-section">
        <div class="card"><div class="card-header"><div class="card-title">Carregando...</div></div></div>
      </div>
    </div>
    <div id="cfg-notification-settings">
      ${renderNotificationSettings()}
    </div>
  </div>

  <style>
    .cfg-toggle{position:relative;display:inline-flex;align-items:center;cursor:pointer;}
    .cfg-toggle input{opacity:0;width:0;height:0;position:absolute;}
    .cfg-toggle-track{width:36px;height:20px;background:#1e2345;border-radius:10px;transition:background .2s;position:relative;flex-shrink:0;}
    .cfg-toggle-track::after{content:'';position:absolute;width:14px;height:14px;border-radius:50%;background:#fff;top:3px;left:3px;transition:transform .2s;}
    .cfg-toggle input:checked + .cfg-toggle-track{background:linear-gradient(90deg,#00b4ff,#6c3fff);}
    .cfg-toggle input:checked + .cfg-toggle-track::after{transform:translateX(16px);}
    input[type="time"]:disabled{opacity:.35;cursor:not-allowed;}
  </style>
</section>`;
}

export async function initConfiguracoesPage() {
  await loadShopData();

  const shopInfo = document.getElementById('cfg-shop-info');
  if (shopInfo) shopInfo.innerHTML = renderShopInfo();

  const workingHoursEl = document.getElementById('cfg-working-hours');
  if (workingHoursEl) workingHoursEl.innerHTML = renderWorkingHoursForm();

  const reactivationEl = document.getElementById('cfg-reactivation-section');
  if (reactivationEl) reactivationEl.innerHTML = renderReactivationMessage();

  const testEl = document.getElementById('cfg-test-section');
  if (testEl) testEl.innerHTML = renderTestCard();

  document.getElementById('cfg-save-btn')?.addEventListener('click', saveSettings);
  bindShopInfoEvents();
  bindWorkingHoursEvents();
  bindReactivationEvents();
  bindTestEvents();
}
