import { apiFetch } from '../services/api.js';

// ─── State ────────────────────────────────────────────────────────────────────

const whatsappState = {
  sessions: [],
  messages: [],
  activeSessionId: null,
  isLoadingSessions: false,
  isLoadingMessages: false,
  pollingTimer: null,
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
  // Último estado do bot como preview
  const stateLabels = {
    idle:              'Aguardando mensagem...',
    menu:              'Visualizou o menu',
    selecting_service: 'Escolhendo serviço',
    selecting_barber:  'Escolhendo barbeiro',
    selecting_date:    'Escolhendo data',
  };
  return stateLabels[session.state] || 'Conversa ativa';
}

// ─── Render ───────────────────────────────────────────────────────────────────

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

// ─── Render principal ─────────────────────────────────────────────────────────

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

  // Scroll para o final
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
  whatsappState.activeSessionId = sessionId;
  whatsappState.isLoadingMessages = true;

  updateChatHeader();
  rerenderSessions(); // atualiza is-active
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

    // Recarrega mensagens para mostrar a enviada
    await loadMessages(whatsappState.activeSessionId);
  } catch (error) {
    console.error('Erro ao enviar mensagem:', error);
    if (input) input.value = text; // restaura se falhou
  } finally {
    if (btn) btn.disabled = false;
    input?.focus();
  }
}

// Polling para novas mensagens a cada 10s quando há sessão ativa
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

// ─── Export ───────────────────────────────────────────────────────────────────

export function renderWhatsApp() {
  return /* html */ `
<section class="page-shell page--whatsapp">
  <div class="grid-2">

    <div class="card" style="padding:0;overflow:hidden;">
      <div class="card-header" style="padding:12px 14px;">
        <div class="card-title">💬 Conversas</div>
        <div style="font-size:10px;background:rgba(0,230,118,.1);color:#00e676;padding:3px 10px;border-radius:8px;font-weight:600;">
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
  document.getElementById('wa-send-btn')?.addEventListener('click', sendMessage);

  document.getElementById('wa-message-input')?.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  });

  loadSessions();
  startPolling();
}
