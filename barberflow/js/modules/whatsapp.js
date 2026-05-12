import { apiFetch } from '../services/api.js';

// ─── Config Meta ──────────────────────────────────────────────────────────────
const META_APP_ID = '1928408417794214';

// ─── State ────────────────────────────────────────────────────────────────────

const whatsappState = {
  sessions:          [],
  messages:          [],
  activeSessionId:   null,
  isLoadingSessions: false,
  isLoadingMessages: false,
  pollingTimer:      null,
  connection:        null,   // { connected, phone_number_id, business_phone }
  metaSdkReady:      false,
  showManualForm:    false,
};

// ─── Helpers ──────────────────────────────────────────────────────────────────

function escapeHtml(v) {
  return String(v ?? '').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
}

function formatTime(value) {
  if (!value) return '';
  return new Date(value).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
}

function getClientName(session) {
  return session?.clients?.name || session?.phone || 'Desconhecido';
}

function getInitials(name) {
  return String(name || 'W').trim().split(/\s+/).slice(0,2).map(p => p[0]?.toUpperCase() || '').join('') || 'WA';
}

const avatarGradients = [
  'linear-gradient(135deg,#ffd700,#ff8c00)',
  'linear-gradient(135deg,#6b6880,#3a3a4a)',
  'linear-gradient(135deg,#3b82f6,#1d4ed8)',
  'linear-gradient(135deg,#9c6fff,#5530dd)',
  'linear-gradient(135deg,#00e676,#00b248)',
];

function getGradient(index) {
  return avatarGradients[index % avatarGradients.length];
}

function getLastMessage(session) {
  const stateLabels = {
    idle:              'Aguardando mensagem...',
    menu:              'Visualizou o menu',
    selecting_service: 'Escolhendo serviço',
    selecting_barber:  'Escolhendo barbeiro',
    selecting_date:    'Escolhendo data',
  };
  return stateLabels[session.state] || 'Conversa ativa';
}

// ─── Meta SDK ─────────────────────────────────────────────────────────────────

function loadMetaSdk() {
  return new Promise((resolve) => {
    if (whatsappState.metaSdkReady) { resolve(); return; }
    if (document.getElementById('fb-sdk-script')) {
      window.fbAsyncInit = () => {
        FB.init({ appId: META_APP_ID, autoLogAppEvents: true, xfbml: true, version: 'v19.0' });
        whatsappState.metaSdkReady = true;
        resolve();
      };
      return;
    }
    window.fbAsyncInit = () => {
      FB.init({ appId: META_APP_ID, autoLogAppEvents: true, xfbml: true, version: 'v19.0' });
      whatsappState.metaSdkReady = true;
      resolve();
    };
    const script = document.createElement('script');
    script.id  = 'fb-sdk-script';
    script.src = 'https://connect.facebook.net/pt_BR/sdk.js';
    script.async = true;
    script.defer = true;
    document.head.appendChild(script);
  });
}

// ─── Embedded Signup ──────────────────────────────────────────────────────────

async function launchEmbeddedSignup() {
  const btn = document.getElementById('wa-connect-btn');
  const feedback = document.getElementById('wa-connect-feedback');

  try {
    if (btn) { btn.disabled = true; btn.textContent = 'Carregando...'; }
    if (feedback) feedback.textContent = '';

    await loadMetaSdk();

    FB.login(async (response) => {
      if (response.authResponse?.code) {
        await exchangeCodeForToken(response.authResponse.code);
      } else {
        setFeedback('Conexão cancelada ou sem permissão.', 'error');
        if (btn) { btn.disabled = false; btn.textContent = '🔗 Conectar WhatsApp'; }
      }
    }, {
      config_id:    '', // Preencher com config_id após criar no Meta Developers
      response_type: 'code',
      override_default_response_type: true,
      extras: {
        setup: {},
        featureType: '',
        sessionInfoVersion: '3',
      }
    });

  } catch (err) {
    console.error('Embedded Signup error:', err);
    setFeedback('Erro ao iniciar conexão. Tente o método manual abaixo.', 'error');
    if (btn) { btn.disabled = false; btn.textContent = '🔗 Conectar WhatsApp'; }
  }
}

async function exchangeCodeForToken(code) {
  const btn = document.getElementById('wa-connect-btn');
  const feedback = document.getElementById('wa-connect-feedback');

  try {
    setFeedback('Conectando ao WhatsApp...', 'loading');

    const result = await apiFetch('/api/whatsapp/connect', {
      method: 'POST',
      body: JSON.stringify({ code }),
    });

    if (result?.success) {
      setFeedback('WhatsApp conectado com sucesso! ✅', 'success');
      await loadConnectionStatus();
      rerenderConnection();
    } else {
      setFeedback(result?.error || 'Erro ao conectar.', 'error');
    }
  } catch (err) {
    setFeedback(err?.message || 'Erro ao conectar.', 'error');
  } finally {
    if (btn) { btn.disabled = false; btn.textContent = '🔗 Conectar WhatsApp'; }
  }
}

// ─── Manual connect ───────────────────────────────────────────────────────────

async function connectManual() {
  const phoneId    = document.getElementById('wa-manual-phone-id')?.value?.trim();
  const token      = document.getElementById('wa-manual-token')?.value?.trim();
  const phone      = document.getElementById('wa-manual-phone')?.value?.trim();
  const btn        = document.getElementById('wa-manual-save-btn');

  if (!phoneId || !token) {
    setFeedback('Phone Number ID e Access Token são obrigatórios.', 'error');
    return;
  }

  try {
    if (btn) btn.disabled = true;
    setFeedback('Validando credenciais...', 'loading');

    const result = await apiFetch('/api/whatsapp/connect/manual', {
      method: 'POST',
      body: JSON.stringify({
        phone_number_id: phoneId,
        access_token:    token,
        display_phone:   phone || null,
      }),
    });

    if (result?.success) {
      setFeedback('WhatsApp conectado com sucesso! ✅', 'success');
      whatsappState.showManualForm = false;
      await loadConnectionStatus();
      rerenderConnection();
    } else {
      setFeedback(result?.error || 'Erro ao conectar.', 'error');
    }
  } catch (err) {
    setFeedback(err?.message || 'Credenciais inválidas.', 'error');
  } finally {
    if (btn) btn.disabled = false;
  }
}

async function disconnect() {
  if (!confirm('Deseja desconectar o WhatsApp? O bot será desativado.')) return;

  try {
    await apiFetch('/api/whatsapp/disconnect', { method: 'DELETE' });
    whatsappState.connection = { connected: false };
    rerenderConnection();
    setFeedback('WhatsApp desconectado.', 'neutral');
  } catch (err) {
    setFeedback('Erro ao desconectar.', 'error');
  }
}

// ─── Feedback ─────────────────────────────────────────────────────────────────

function setFeedback(message, type = 'neutral') {
  const el = document.getElementById('wa-connect-feedback');
  if (!el) return;
  el.textContent = message;
  el.className = `wa-feedback wa-feedback--${type}`;
}

// ─── Connection status ────────────────────────────────────────────────────────

async function loadConnectionStatus() {
  try {
    const data = await apiFetch('/api/whatsapp/status');
    whatsappState.connection = data;
  } catch (err) {
    whatsappState.connection = { connected: false };
  }
}

function rerenderConnection() {
  const el = document.getElementById('wa-connection-section');
  if (!el) return;
  el.innerHTML = renderConnectionSection();
  bindConnectionEvents();
}

function renderConnectionSection() {
  const c = whatsappState.connection;

  if (c === null) {
    return `<div class="wa-status-card"><div class="wa-status-loading">Carregando status...</div></div>`;
  }

  if (c.connected) {
    const phone = c.business_phone
      ? c.business_phone.replace(/\D/g,'').replace(/^55/,'').replace(/(\d{2})(\d{4,5})(\d{4})/, '($1) $2-$3')
      : c.phone_number_id;

    return `
      <div class="wa-status-card wa-status-card--connected">
        <div class="wa-status-header">
          <div class="wa-status-dot wa-status-dot--on"></div>
          <span class="wa-status-label">WhatsApp conectado</span>
        </div>
        <div class="wa-status-info">
          <div class="wa-status-row">
            <span class="wa-status-key">Número</span>
            <span class="wa-status-val">${escapeHtml(phone || '—')}</span>
          </div>
          <div class="wa-status-row">
            <span class="wa-status-key">Bot</span>
            <span class="wa-status-val wa-status-val--green">● Ativo</span>
          </div>
          <div class="wa-status-row">
            <span class="wa-status-key">Phone Number ID</span>
            <span class="wa-status-val wa-status-val--mono">${escapeHtml(c.phone_number_id || '—')}</span>
          </div>
        </div>
        <button type="button" class="wa-btn wa-btn--danger" id="wa-disconnect-btn">
          Desconectar WhatsApp
        </button>
        <p id="wa-connect-feedback" class="wa-feedback"></p>
      </div>
    `;
  }

  return `
    <div class="wa-status-card wa-status-card--disconnected">
      <div class="wa-status-header">
        <div class="wa-status-dot wa-status-dot--off"></div>
        <span class="wa-status-label">WhatsApp não conectado</span>
      </div>
      <p class="wa-status-desc">
        Conecte o WhatsApp da sua barbearia para ativar o bot automático,
        enviar notificações e gerenciar conversas pelo painel.
      </p>

      <button type="button" class="wa-btn wa-btn--primary" id="wa-connect-btn">
        🔗 Conectar WhatsApp
      </button>

      <button type="button" class="wa-btn wa-btn--ghost" id="wa-manual-toggle-btn">
        ⚙️ Configurar manualmente
      </button>

      ${whatsappState.showManualForm ? renderManualForm() : ''}

      <p id="wa-connect-feedback" class="wa-feedback"></p>
    </div>
  `;
}

function renderManualForm() {
  return `
    <div class="wa-manual-form">
      <div class="wa-manual-title">Configuração manual</div>
      <p class="wa-manual-desc">
        Use esta opção se você já tem as credenciais do WhatsApp Business API.
      </p>
      <div class="wa-manual-field">
        <label class="wa-manual-label">Phone Number ID</label>
        <input id="wa-manual-phone-id" type="text" class="modal-input"
          placeholder="Ex: 1049280788276183" style="margin:0;" />
      </div>
      <div class="wa-manual-field">
        <label class="wa-manual-label">Access Token (60 dias)</label>
        <input id="wa-manual-token" type="text" class="modal-input"
          placeholder="EAAr..." style="margin:0;" />
      </div>
      <div class="wa-manual-field">
        <label class="wa-manual-label">Número de exibição (opcional)</label>
        <input id="wa-manual-phone" type="text" class="modal-input"
          placeholder="Ex: +55 11 91234-5678" style="margin:0;" />
      </div>
      <button type="button" class="wa-btn wa-btn--primary" id="wa-manual-save-btn">
        Salvar credenciais
      </button>
    </div>
  `;
}

// ─── Bind connection events ───────────────────────────────────────────────────

function bindConnectionEvents() {
  document.getElementById('wa-connect-btn')?.addEventListener('click', launchEmbeddedSignup);
  document.getElementById('wa-disconnect-btn')?.addEventListener('click', disconnect);
  document.getElementById('wa-manual-save-btn')?.addEventListener('click', connectManual);
  document.getElementById('wa-manual-toggle-btn')?.addEventListener('click', () => {
    whatsappState.showManualForm = !whatsappState.showManualForm;
    rerenderConnection();
  });
}

// ─── Chat renders ─────────────────────────────────────────────────────────────

function renderSessionRow(session, index) {
  const name     = getClientName(session);
  const initials = getInitials(name);
  const gradient = getGradient(index);
  const isActive = session.id === whatsappState.activeSessionId;
  const time     = formatTime(session.last_message_at);

  return `
    <button type="button" class="wa-session-btn ${isActive ? 'is-active' : ''}"
      data-session-id="${escapeHtml(session.id)}">
      <div class="row-item" style="margin:0;background:transparent;">
        <div class="row-avatar" style="background:${gradient};flex-shrink:0;">${escapeHtml(initials)}</div>
        <div class="row-info">
          <div class="row-name">${escapeHtml(name)}</div>
          <div class="row-sub">${escapeHtml(getLastMessage(session))}</div>
        </div>
        <div style="font-size:9px;color:#3a4568;flex-shrink:0;">${escapeHtml(time)}</div>
      </div>
    </button>
  `;
}

function renderBubble(msg) {
  const isOut  = msg.direction === 'out';
  const isBot  = msg.is_bot;
  const label  = isOut ? (isBot ? 'Bot' : 'Você') : null;
  const time   = formatTime(msg.created_at);

  return `
    <div style="display:flex;flex-direction:column;align-items:${isOut ? 'flex-end' : 'flex-start'};">
      <div style="font-size:8px;color:#3a4568;margin-bottom:2px;${isOut ? 'text-align:right' : ''}">
        ${time}${label ? ` · ${label}` : ''}
      </div>
      <div class="bubble ${isOut ? 'bubble-out' : 'bubble-in'}"
        style="white-space:pre-wrap;word-break:break-word;">
        ${escapeHtml(msg.content || '')}
      </div>
    </div>
  `;
}

function renderEmptySessions() {
  return `
    <div class="finance-empty" style="padding:20px 10px;text-align:center;">
      <div style="font-size:24px;margin-bottom:8px;">💬</div>
      <div style="font-size:11px;color:#5a6888;">Nenhuma conversa ainda.</div>
      <div style="font-size:10px;color:#3a4568;margin-top:4px;">
        As conversas aparecem quando clientes enviarem mensagens via WhatsApp.
      </div>
    </div>
  `;
}

function renderEmptyMessages() {
  return `
    <div class="finance-empty" style="padding:20px 10px;text-align:center;height:100%;display:flex;flex-direction:column;align-items:center;justify-content:center;">
      <div style="font-size:28px;margin-bottom:8px;">💬</div>
      <div style="font-size:11px;color:#5a6888;">Selecione uma conversa</div>
    </div>
  `;
}

function rerenderSessions() {
  const list = document.getElementById('wa-sessions-list');
  if (!list) return;

  if (whatsappState.isLoadingSessions) {
    list.innerHTML = `<div class="finance-empty">Carregando conversas...</div>`;
    return;
  }

  list.innerHTML = whatsappState.sessions.length
    ? whatsappState.sessions.map((s, i) => renderSessionRow(s, i)).join('')
    : renderEmptySessions();

  list.querySelectorAll('.wa-session-btn[data-session-id]').forEach(btn => {
    btn.addEventListener('click', () => loadMessages(btn.dataset.sessionId));
  });
}

function rerenderMessages() {
  const area = document.getElementById('wa-messages-area');
  if (!area) return;

  if (whatsappState.isLoadingMessages) {
    area.innerHTML = `<div class="finance-empty">Carregando mensagens...</div>`;
    return;
  }

  if (!whatsappState.activeSessionId) {
    area.innerHTML = renderEmptyMessages();
    return;
  }

  area.innerHTML = whatsappState.messages.map(renderBubble).join('');
  area.scrollTop = area.scrollHeight;
}

function updateChatHeader() {
  const header = document.getElementById('wa-chat-title');
  const status = document.getElementById('wa-chat-status');
  if (!header || !status) return;

  if (!whatsappState.activeSessionId) {
    header.textContent = 'Conversas';
    status.textContent = '';
    return;
  }

  const session = whatsappState.sessions.find(s => s.id === whatsappState.activeSessionId);
  header.textContent = session ? getClientName(session) : 'Conversa';
  status.textContent = '● Online';
}

// ─── API calls ────────────────────────────────────────────────────────────────

async function loadSessions() {
  whatsappState.isLoadingSessions = true;
  rerenderSessions();

  try {
    const data = await apiFetch('/api/whatsapp/sessions');
    whatsappState.sessions = Array.isArray(data) ? data : [];
  } catch (error) {
    console.error('Erro ao carregar sessões WhatsApp:', error);
  } finally {
    whatsappState.isLoadingSessions = false;
    rerenderSessions();
  }
}

async function loadMessages(sessionId) {
  whatsappState.activeSessionId   = sessionId;
  whatsappState.isLoadingMessages = true;

  updateChatHeader();
  rerenderSessions();
  rerenderMessages();

  try {
    const data = await apiFetch(`/api/whatsapp/messages/${sessionId}`);
    whatsappState.messages = Array.isArray(data) ? data : [];
  } catch (error) {
    console.error('Erro ao carregar mensagens:', error);
    whatsappState.messages = [];
  } finally {
    whatsappState.isLoadingMessages = false;
    rerenderMessages();
    updateChatHeader();
  }
}

async function sendMessage() {
  const input = document.getElementById('wa-message-input');
  const btn   = document.getElementById('wa-send-btn');
  const text  = String(input?.value || '').trim();

  if (!text || !whatsappState.activeSessionId) return;

  try {
    if (btn) btn.disabled = true;
    input.value = '';

    await apiFetch('/api/whatsapp/send', {
      method: 'POST',
      body: JSON.stringify({
        sessionId: whatsappState.activeSessionId,
        message: text,
      }),
    });

    await loadMessages(whatsappState.activeSessionId);
  } catch (error) {
    console.error('Erro ao enviar mensagem:', error);
    if (input) input.value = text;
  } finally {
    if (btn) btn.disabled = false;
    input?.focus();
  }
}

function startPolling() {
  stopPolling();
  whatsappState.pollingTimer = setInterval(async () => {
    if (whatsappState.activeSessionId) {
      await loadMessages(whatsappState.activeSessionId);
    }
    await loadSessions();
  }, 10000);
}

function stopPolling() {
  if (whatsappState.pollingTimer) {
    clearInterval(whatsappState.pollingTimer);
    whatsappState.pollingTimer = null;
  }
}

// ─── Render principal ─────────────────────────────────────────────────────────

export function renderWhatsApp() {
  return /* html */ `
<section class="page-shell page--whatsapp">

  <!-- Seção de conexão -->
  <div id="wa-connection-section">
    <div class="wa-status-card"><div class="wa-status-loading">Carregando status...</div></div>
  </div>

  <!-- Chat -->
  <div class="grid-2" style="margin-top:16px;">

    <div class="card" style="padding:0;overflow:hidden;">
      <div class="card-header" style="padding:12px 14px;">
        <div class="card-title">💬 Conversas</div>
        <div id="wa-bot-badge" style="font-size:10px;background:rgba(0,230,118,.1);color:#00e676;padding:3px 10px;border-radius:8px;font-weight:600;">
          ● Bot ativo
        </div>
      </div>
      <div id="wa-sessions-list" style="overflow-y:auto;max-height:520px;padding:0 8px 8px;">
        <div class="finance-empty">Carregando...</div>
      </div>
    </div>

    <div class="card" style="padding:0;overflow:hidden;display:flex;flex-direction:column;">
      <div class="card-header" style="padding:12px 14px;flex-shrink:0;">
        <div>
          <div class="card-title" id="wa-chat-title">Conversas</div>
          <div style="font-size:9px;color:#00e676;font-weight:600;margin-top:2px;" id="wa-chat-status"></div>
        </div>
      </div>

      <div id="wa-messages-area"
        style="flex:1;overflow-y:auto;padding:12px;display:flex;flex-direction:column;gap:8px;min-height:300px;max-height:420px;">
        ${renderEmptyMessages()}
      </div>

      <div style="padding:10px;border-top:1px solid #1a1f38;display:flex;gap:8px;flex-shrink:0;">
        <input id="wa-message-input" type="text"
          class="modal-input"
          style="margin:0;flex:1;"
          placeholder="Assumir conversa e enviar mensagem..."
        />
        <button type="button" id="wa-send-btn"
          class="btn-primary-gradient"
          style="min-height:36px;padding:8px 16px;white-space:nowrap;">
          Enviar
        </button>
      </div>
    </div>

  </div>
</section>
  `;
}

export function initWhatsAppPage() {
  // Chat
  document.getElementById('wa-send-btn')?.addEventListener('click', sendMessage);
  document.getElementById('wa-message-input')?.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  });

  // Carrega status de conexão e sessões em paralelo
  Promise.all([loadConnectionStatus(), loadSessions()]).then(() => {
    rerenderConnection();
    bindConnectionEvents();

    // Atualiza badge do bot
    const badge = document.getElementById('wa-bot-badge');
    if (badge && whatsappState.connection) {
      if (whatsappState.connection.connected) {
        badge.style.background = 'rgba(0,230,118,.1)';
        badge.style.color = '#00e676';
        badge.textContent = '● Bot ativo';
      } else {
        badge.style.background = 'rgba(255,100,50,.1)';
        badge.style.color = '#ff6b7a';
        badge.textContent = '● Bot inativo';
      }
    }
  });

  startPolling();
}
