import { apiFetch } from '../services/api.js';

// ─── State ────────────────────────────────────────────────────────────────────

const fidelidadeState = {
  program: null,
  rewards: [],
  topClients: [],
  isLoading: false,
  modalMode: 'closed', // closed | viewClient | viewReward | editReward | createReward
  activeClientId: null,
  activeRewardId: null,
};

// ─── Helpers ──────────────────────────────────────────────────────────────────

function escapeHtml(value) {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

function setFeedback(id, message, variant = 'neutral') {
  const el = document.getElementById(id);
  if (!el) return;
  el.textContent = message || '';
  el.style.color =
    variant === 'error' ? '#ff8a8a' :
    variant === 'success' ? '#00e676' :
    '#5a6888';
}

function getRewardById(id) {
  return fidelidadeState.rewards.find(r => r.id === id) || null;
}

function getTopClientById(id) {
  return fidelidadeState.topClients.find(c => c.id === id) || null;
}

function formatPoints(value) {
  const n = Number(value || 0);
  return n >= 1000 ? `${(n / 1000).toFixed(1)}k` : String(n);
}

const clientThemes = [
  { gradient: 'linear-gradient(135deg,#ffd700,#ff8c00)', color: '#000' },
  { gradient: 'linear-gradient(135deg,#6b6880,#3a3a4a)', color: '#fff' },
  { gradient: 'linear-gradient(135deg,#3b82f6,#1d4ed8)', color: '#fff' },
  { gradient: 'linear-gradient(135deg,#00b4ff,#6c3fff)', color: '#fff' },
  { gradient: 'linear-gradient(135deg,#00e676,#00b248)', color: '#001b0b' },
];

function getClientTheme(index) {
  return clientThemes[index % clientThemes.length];
}

function getInitials(name) {
  return String(name || 'C').trim().split(/\s+/).slice(0, 2).map(p => p[0]?.toUpperCase() || '').join('') || 'C';
}

// ─── Metrics ──────────────────────────────────────────────────────────────────

function renderMetrics() {
  const members = fidelidadeState.topClients.length;
  const totalPoints = fidelidadeState.topClients.reduce((s, c) => s + Number(c.loyalty_points || 0), 0);
  const activeRewards = fidelidadeState.rewards.filter(r => r.is_active).length;
  const pointsPerVisit = fidelidadeState.program?.points_per_visit || 0;

  return `
    <div class="grid-4 fidelidade-metrics-grid">
      <div class="metric-card">
        <div class="metric-label">No programa</div>
        <div class="metric-value">${escapeHtml(members)}</div>
        <div class="metric-sub color-nt">clientes com pontos</div>
      </div>
      <div class="metric-card">
        <div class="metric-label">Pontos em circulação</div>
        <div class="metric-value">${escapeHtml(formatPoints(totalPoints))}</div>
        <div class="metric-sub color-nt">total acumulado</div>
      </div>
      <div class="metric-card">
        <div class="metric-label">Recompensas ativas</div>
        <div class="metric-value">${escapeHtml(activeRewards)}</div>
        <div class="metric-sub color-nt">disponíveis para resgate</div>
      </div>
      <div class="metric-card">
        <div class="metric-label">Pontos por visita</div>
        <div class="metric-value" style="color:#00e676">${escapeHtml(pointsPerVisit || '—')}</div>
        <div class="metric-sub color-nt">configurado no programa</div>
      </div>
    </div>
  `;
}

// ─── Render rows ──────────────────────────────────────────────────────────────

function renderTopClientRow(client, index) {
  const theme = getClientTheme(index);
  const points = Number(client.loyalty_points || 0);
  const maxPoints = Math.max(...fidelidadeState.topClients.map(c => Number(c.loyalty_points || 0)), 1);
  const width = Math.max((points / maxPoints) * 100, 12);
  const medals = ['🥇', '🥈', '🥉'];

  return `
    <button type="button" class="fidelidade-row-button"
      data-client-id="${escapeHtml(client.id)}"
      title="Ver detalhes de ${escapeHtml(client.name)}">
      <div class="row-item fidelidade-row-item">
        <div class="row-avatar" style="background:${theme.gradient};color:${theme.color};">
          ${escapeHtml(getInitials(client.name))}
        </div>
        <div class="row-info">
          <div class="row-name">${escapeHtml(client.name)} ${medals[index] || ''}</div>
          <div class="row-sub">${escapeHtml(`${points} pts`)}</div>
          <div class="row-prog"><div class="row-fill" style="width:${width}%"></div></div>
        </div>
        <div class="row-value">${escapeHtml(`${points} pts`)}</div>
      </div>
    </button>
  `;
}

function renderRewardRow(reward) {
  const colors = { info: '#4fc3f7', purple: '#9c6fff', success: '#00e676', warning: '#f97316' };
  const color = colors[reward.highlight] || '#4fc3f7';

  return `
    <button type="button" class="fidelidade-row-button"
      data-reward-id="${escapeHtml(reward.id)}"
      title="Ver detalhes de ${escapeHtml(reward.title || reward.name)}">
      <div class="fin-row" style="border-color:${color}">
        <div class="fin-icon">${escapeHtml(reward.icon || '🎁')}</div>
        <div class="fin-info">
          <div class="fin-title">${escapeHtml(reward.title || reward.name)}</div>
          <div class="fin-date">${escapeHtml(`${reward.points_required || reward.required_points || 0} pontos necessários`)}</div>
        </div>
        <div class="fin-val" style="color:${color}">${escapeHtml(`${reward.points_required || reward.required_points || 0} pts`)}</div>
      </div>
    </button>
  `;
}

// ─── Modal renders ────────────────────────────────────────────────────────────

function renderClientDetails(client) {
  const theme = getClientTheme(fidelidadeState.topClients.indexOf(client));

  return `
    <div class="fidelidade-modal-body">
      <div class="fidelidade-modal-header" style="display:flex;align-items:center;gap:14px;margin-bottom:16px;">
        <div class="row-avatar" style="width:52px;height:52px;border-radius:16px;background:${theme.gradient};color:${theme.color};display:grid;place-items:center;font-weight:900;font-size:18px;">
          ${escapeHtml(getInitials(client.name))}
        </div>
        <div>
          <div class="modal-title" style="margin:0;">${escapeHtml(client.name)}</div>
          <div class="modal-sub" style="margin-top:4px;">Programa de fidelidade</div>
        </div>
      </div>

      <div class="fidelidade-modal-grid">
        <div class="mini-card">
          <div class="mini-lbl">Pontos</div>
          <div class="mini-val" style="color:#4fc3f7">${escapeHtml(client.loyalty_points || 0)}</div>
        </div>
        <div class="mini-card">
          <div class="mini-lbl">Visitas</div>
          <div class="mini-val" style="color:#00e676">${escapeHtml(client.total_visits || client.completed_appointments_count || 0)}</div>
        </div>
      </div>

      <div id="fidelidade-modal-feedback" class="fidelidade-form-feedback"></div>

      <div class="modal-buttons" style="margin-top:10px;">
        <button type="button" class="btn-cancel" id="fidelidade-modal-close">Fechar</button>
      </div>
    </div>
  `;
}

function renderRewardDetails(reward) {
  const colors = { info: '#4fc3f7', purple: '#9c6fff', success: '#00e676', warning: '#f97316' };
  const color = colors[reward.highlight] || '#4fc3f7';
  const points = reward.points_required || reward.required_points || 0;

  return `
    <div class="fidelidade-modal-body">
      <div>
        <div class="modal-title" style="margin:0;">${escapeHtml(reward.title || reward.name)}</div>
        <div class="modal-sub" style="margin-top:4px;">Detalhes da recompensa</div>
      </div>

      <div class="fidelidade-modal-grid">
        <div class="mini-card">
          <div class="mini-lbl">Pontos necessários</div>
          <div class="mini-val" style="color:${color}">${escapeHtml(points)}</div>
        </div>
        <div class="mini-card">
          <div class="mini-lbl">Status</div>
          <div class="mini-val" style="font-size:14px;color:${reward.is_active ? '#00e676' : '#5a6888'}">
            ${reward.is_active ? 'Ativa' : 'Inativa'}
          </div>
        </div>
      </div>

      ${reward.description ? `
        <div class="fidelidade-modal-info">
          <div class="fidelidade-modal-info-row"><strong>Descrição:</strong> ${escapeHtml(reward.description)}</div>
        </div>
      ` : ''}

      <div id="fidelidade-modal-feedback" class="fidelidade-form-feedback"></div>

      <div class="modal-buttons" style="margin-top:10px;">
        <button type="button" class="btn-cancel" id="fidelidade-modal-close">Fechar</button>
        <button type="button" class="btn-save" id="fidelidade-edit-reward" data-reward-id="${escapeHtml(reward.id)}">
          Editar recompensa
        </button>
      </div>
    </div>
  `;
}

function renderRewardForm(mode, reward = null) {
  const isEdit = mode === 'editReward';
  const r = reward || {};
  const points = r.points_required || r.required_points || 200;

  return `
    <div class="fidelidade-modal-body">
      <div>
        <div class="modal-title" style="margin:0;">${isEdit ? 'Editar recompensa' : 'Nova recompensa'}</div>
        <div class="modal-sub" style="margin-top:4px;">${isEdit ? 'Atualize os dados.' : 'Preencha para criar uma recompensa.'}</div>
      </div>

      <form id="fidelidade-form" class="fidelidade-form">
        <div class="fidelidade-form-grid">
          <div>
            <div class="color-section-label">Nome da recompensa</div>
            <input class="modal-input" name="name" type="text"
              value="${escapeHtml(r.title || r.name || '')}" placeholder="Ex: 1 Corte Grátis" />
          </div>
          <div>
            <div class="color-section-label">Ícone</div>
            <input class="modal-input" name="icon" type="text"
              value="${escapeHtml(r.icon || '🎁')}" placeholder="Ex: 🎁" />
          </div>
          <div>
            <div class="color-section-label">Pontos necessários</div>
            <input class="modal-input" name="points_required" type="number" min="1"
              value="${escapeHtml(points)}" />
          </div>
          <div>
            <div class="color-section-label">Status</div>
            <select class="modal-input" name="is_active">
              <option value="true" ${r.is_active !== false ? 'selected' : ''}>Ativa</option>
              <option value="false" ${r.is_active === false ? 'selected' : ''}>Inativa</option>
            </select>
          </div>
        </div>

        <div>
          <div class="color-section-label">Descrição</div>
          <textarea class="modal-input fidelidade-textarea" name="description"
            placeholder="Descrição da recompensa">${escapeHtml(r.description || '')}</textarea>
        </div>

        <div id="fidelidade-form-feedback" class="fidelidade-form-feedback"></div>

        <div class="modal-buttons" style="margin-top:10px;">
          <button type="button" class="btn-cancel" id="${isEdit ? 'fidelidade-form-back' : 'fidelidade-form-cancel'}">
            ${isEdit ? 'Voltar' : 'Cancelar'}
          </button>
          <button type="submit" class="btn-save">${isEdit ? 'Salvar' : 'Criar recompensa'}</button>
        </div>
      </form>
    </div>
  `;
}

// ─── Modal control ────────────────────────────────────────────────────────────

function openClientModal(id) {
  fidelidadeState.activeClientId = id;
  fidelidadeState.activeRewardId = null;
  fidelidadeState.modalMode = 'viewClient';
  renderFidelidadeModal();
}

function openRewardModal(id) {
  fidelidadeState.activeRewardId = id;
  fidelidadeState.activeClientId = null;
  fidelidadeState.modalMode = 'viewReward';
  renderFidelidadeModal();
}

function openCreateRewardModal() {
  fidelidadeState.activeRewardId = null;
  fidelidadeState.activeClientId = null;
  fidelidadeState.modalMode = 'createReward';
  renderFidelidadeModal();
}

function openEditRewardModal(id) {
  fidelidadeState.activeRewardId = id;
  fidelidadeState.activeClientId = null;
  fidelidadeState.modalMode = 'editReward';
  renderFidelidadeModal();
}

function closeFidelidadeModal() {
  const modal = document.getElementById('fidelidade-details-modal');
  const content = document.getElementById('fidelidade-details-content');
  if (!modal) return;

  fidelidadeState.modalMode = 'closed';
  fidelidadeState.activeClientId = null;
  fidelidadeState.activeRewardId = null;
  modal.classList.remove('open');
  modal.style.display = 'none';
  if (content) content.innerHTML = '';
}

function renderFidelidadeModal() {
  const modal = document.getElementById('fidelidade-details-modal');
  const content = document.getElementById('fidelidade-details-content');
  if (!modal || !content) return;

  if (fidelidadeState.modalMode === 'closed') {
    modal.style.display = 'none';
    modal.classList.remove('open');
    content.innerHTML = '';
    return;
  }

  const client = fidelidadeState.activeClientId ? getTopClientById(fidelidadeState.activeClientId) : null;
  const reward = fidelidadeState.activeRewardId ? getRewardById(fidelidadeState.activeRewardId) : null;

  if (fidelidadeState.modalMode === 'viewClient') {
    if (!client) { closeFidelidadeModal(); return; }
    content.innerHTML = renderClientDetails(client);
  }

  if (fidelidadeState.modalMode === 'viewReward') {
    if (!reward) { closeFidelidadeModal(); return; }
    content.innerHTML = renderRewardDetails(reward);
  }

  if (fidelidadeState.modalMode === 'editReward') {
    if (!reward) { closeFidelidadeModal(); return; }
    content.innerHTML = renderRewardForm('editReward', reward);
  }

  if (fidelidadeState.modalMode === 'createReward') {
    content.innerHTML = renderRewardForm('createReward');
  }

  modal.style.display = 'flex';
  modal.classList.add('open');
  bindFidelidadeModalEvents();
}

// ─── API calls ────────────────────────────────────────────────────────────────

async function loadFidelidadeData() {
  fidelidadeState.isLoading = true;
  rerenderFidelidade();

  try {
    const [program, rewards, clients] = await Promise.all([
      apiFetch('/api/loyalty/program').catch(() => null),
      apiFetch('/api/loyalty/rewards'),
      apiFetch('/api/clients'),
    ]);

    fidelidadeState.program = program || null;
    fidelidadeState.rewards = Array.isArray(rewards) ? rewards : [];

    // Top clientes por loyalty_points
    const allClients = Array.isArray(clients) ? clients : [];
    fidelidadeState.topClients = allClients
      .filter(c => Number(c.loyalty_points || 0) > 0)
      .sort((a, b) => Number(b.loyalty_points || 0) - Number(a.loyalty_points || 0))
      .slice(0, 5);

  } catch (error) {
    console.error('Erro ao carregar fidelidade:', error);
  } finally {
    fidelidadeState.isLoading = false;
    rerenderFidelidade();
  }
}

async function handleCreateReward(event) {
  event.preventDefault();
  const form = document.getElementById('fidelidade-form');
  const formData = new FormData(form);
  const btn = form.querySelector('button[type="submit"]');

  const name = String(formData.get('name') || '').trim();
  const points = Number(formData.get('points_required') || 0);

  if (!name) { setFeedback('fidelidade-form-feedback', 'Informe o nome da recompensa.', 'error'); return; }
  if (points <= 0) { setFeedback('fidelidade-form-feedback', 'Informe os pontos necessários.', 'error'); return; }

  try {
    if (btn) btn.disabled = true;
    setFeedback('fidelidade-form-feedback', 'Salvando...', 'neutral');

    await apiFetch('/api/loyalty/rewards', {
      method: 'POST',
      body: JSON.stringify({
        title: name,
        name,
        icon: String(formData.get('icon') || '🎁').trim() || '🎁',
        points_required: points,
        description: String(formData.get('description') || '').trim() || null,
        is_active: String(formData.get('is_active')) === 'true',
      }),
    });

    closeFidelidadeModal();
    await loadFidelidadeData();
  } catch (error) {
    setFeedback('fidelidade-form-feedback', error instanceof Error ? error.message : 'Erro ao salvar.', 'error');
    if (btn) btn.disabled = false;
  }
}

// ─── Events ───────────────────────────────────────────────────────────────────

function bindFidelidadeModalEvents() {
  document.getElementById('fidelidade-modal-close')?.addEventListener('click', closeFidelidadeModal);
  document.getElementById('fidelidade-form-cancel')?.addEventListener('click', closeFidelidadeModal);

  document.getElementById('fidelidade-form-back')?.addEventListener('click', () => {
    if (fidelidadeState.activeRewardId) openRewardModal(fidelidadeState.activeRewardId);
  });

  document.getElementById('fidelidade-edit-reward')?.addEventListener('click', (e) => {
    const id = e.currentTarget.dataset.rewardId;
    if (id) openEditRewardModal(id);
  });

  document.getElementById('fidelidade-form')?.addEventListener('submit', handleCreateReward);
}

function bindTopClientsEvents() {
  document.querySelectorAll('.fidelidade-row-button[data-client-id]').forEach(btn => {
    btn.addEventListener('click', () => openClientModal(btn.dataset.clientId));
  });
}

function bindRewardsEvents() {
  document.querySelectorAll('.fidelidade-row-button[data-reward-id]').forEach(btn => {
    btn.addEventListener('click', () => openRewardModal(btn.dataset.rewardId));
  });
}

function bindFidelidadeStaticEvents() {
  document.getElementById('fidelidade-new-reward-button')?.addEventListener('click', openCreateRewardModal);
  document.getElementById('fidelidade-details-modal')?.addEventListener('click', (e) => {
    if (e.target?.id === 'fidelidade-details-modal') closeFidelidadeModal();
  });
}

function rerenderFidelidade() {
  const metrics = document.getElementById('fidelidade-metrics');
  const clients = document.getElementById('fidelidade-top-clients');
  const rewards = document.getElementById('fidelidade-rewards-list');

  if (fidelidadeState.isLoading) {
    if (clients) clients.innerHTML = `<div class="finance-empty">Carregando...</div>`;
    if (rewards) rewards.innerHTML = `<div class="finance-empty">Carregando...</div>`;
    return;
  }

  if (metrics) metrics.innerHTML = renderMetrics();

  if (clients) {
    clients.innerHTML = fidelidadeState.topClients.length
      ? fidelidadeState.topClients.map((c, i) => renderTopClientRow(c, i)).join('')
      : `<div class="finance-empty">Nenhum cliente com pontos ainda.</div>`;
  }

  if (rewards) {
    rewards.innerHTML = fidelidadeState.rewards.length
      ? fidelidadeState.rewards.map(renderRewardRow).join('')
      : `<div class="finance-empty">Nenhuma recompensa cadastrada.</div>`;
  }

  bindTopClientsEvents();
  bindRewardsEvents();
}

export function renderFidelidade() {
  return /* html */ `
<section class="page-shell page--fidelidade">
  <div id="fidelidade-metrics">
    ${renderMetrics()}
  </div>

  <div class="grid-2">
    <div class="card">
      <div class="card-header">
        <div class="card-title">🏆 Top Clientes</div>
      </div>
      <div id="fidelidade-top-clients">
        <div class="finance-empty">Carregando...</div>
      </div>
    </div>

    <div class="card">
      <div class="card-header">
        <div class="card-title">🎁 Recompensas</div>
        <button type="button" class="btn-primary-gradient" id="fidelidade-new-reward-button">+ Criar</button>
      </div>
      <div id="fidelidade-rewards-list">
        <div class="finance-empty">Carregando...</div>
      </div>
    </div>
  </div>

  <div id="fidelidade-details-modal" class="modal-overlay" style="display:none;">
    <div class="modal" style="width:min(92vw, 620px);">
      <div id="fidelidade-details-content"></div>
    </div>
  </div>
</section>
  `;
}

export function initFidelidadePage() {
  bindFidelidadeStaticEvents();
  loadFidelidadeData();
}
