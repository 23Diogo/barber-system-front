const fidelidadeState = {
  retentionRate: 78,
  retentionTrend: '↑ 5%',
  clients: [
    {
      id: 'rafael-souza',
      initials: 'RS',
      avatarGradient: 'linear-gradient(135deg,#ffd700,#ff8c00)',
      avatarColor: '#000',
      name: 'Rafael Souza 🥇',
      points: 480,
      visits: 24,
      tier: 'Gold',
      joinedAt: 'Jan/2025',
      notes: 'Cliente mais ativo do programa.',
    },
    {
      id: 'pedro-costa',
      initials: 'PC',
      avatarGradient: 'linear-gradient(135deg,#6b6880,#3a3a4a)',
      avatarColor: '#fff',
      name: 'Pedro Costa 🥈',
      points: 360,
      visits: 18,
      tier: 'Silver',
      joinedAt: 'Fev/2025',
      notes: 'Alta recorrência em serviços premium.',
    },
    {
      id: 'carlos-mendes',
      initials: 'CM',
      avatarGradient: 'linear-gradient(135deg,#3b82f6,#1d4ed8)',
      avatarColor: '#fff',
      name: 'Carlos Mendes 🥉',
      points: 300,
      visits: 15,
      tier: 'Silver',
      joinedAt: 'Mar/2025',
      notes: 'Participa com boa frequência das campanhas.',
    },
    {
      id: 'bruno-alves',
      initials: 'BA',
      avatarGradient: 'linear-gradient(135deg,#00b4ff,#6c3fff)',
      avatarColor: '#fff',
      name: 'Bruno Alves',
      points: 240,
      visits: 12,
      tier: 'Bronze',
      joinedAt: 'Mar/2025',
      notes: 'Em crescimento dentro do programa.',
    },
  ],
  rewards: [
    {
      id: 'corte-gratis',
      icon: '✂️',
      title: '1 Corte Grátis',
      requiredPoints: 500,
      highlight: 'info',
      redemptions: 6,
      active: true,
      notes: 'Recompensa premium para clientes recorrentes.',
    },
    {
      id: 'desconto-20',
      icon: '🎯',
      title: '20% de desconto',
      requiredPoints: 200,
      highlight: 'purple',
      redemptions: 5,
      active: true,
      notes: 'Aplicável em qualquer serviço da casa.',
    },
    {
      id: 'barba-gratis',
      icon: '🪒',
      title: 'Barba grátis',
      requiredPoints: 300,
      highlight: 'success',
      redemptions: 3,
      active: true,
      notes: 'Muito usada em campanhas de reativação.',
    },
  ],
  modalMode: 'closed', // closed | viewClient | viewReward | editReward | createReward
  activeClientId: null,
  activeRewardId: null,
};

function escapeHtml(value) {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

function getClientById(clientId) {
  return fidelidadeState.clients.find((item) => item.id === clientId) || null;
}

function getRewardById(rewardId) {
  return fidelidadeState.rewards.find((item) => item.id === rewardId) || null;
}

function normalizeRewardId(title) {
  const base = String(title || 'nova-recompensa')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '') || 'nova-recompensa';

  let candidate = base;
  let counter = 2;

  while (fidelidadeState.rewards.some((item) => item.id === candidate)) {
    candidate = `${base}-${counter}`;
    counter += 1;
  }

  return candidate;
}

function getRewardMeta(highlight) {
  const map = {
    info: { color: '#4fc3f7', border: '#4fc3f7' },
    purple: { color: '#9c6fff', border: '#9c6fff' },
    success: { color: '#00e676', border: '#00e676' },
    warning: { color: '#f97316', border: '#f97316' },
  };

  return map[highlight] || map.info;
}

function getMetrics() {
  const members = fidelidadeState.clients.length + 83;
  const distributedPoints = fidelidadeState.clients.reduce((sum, item) => sum + Number(item.points || 0), 0) + 3060;
  const redemptions = fidelidadeState.rewards.reduce((sum, item) => sum + Number(item.redemptions || 0), 0);

  return {
    members,
    distributedPoints,
    redemptions,
    retentionRate: fidelidadeState.retentionRate,
  };
}

function formatPoints(value) {
  const num = Number(value || 0);
  if (num >= 1000) {
    return `${(num / 1000).toFixed(1)}k`;
  }
  return String(num);
}

function renderMetrics() {
  const metrics = getMetrics();

  return `
    <div class="grid-4 fidelidade-metrics-grid">
      <div class="metric-card">
        <div class="metric-label">No programa</div>
        <div class="metric-value">${escapeHtml(metrics.members)}</div>
        <div class="metric-sub color-up">↑ 12 este mês</div>
      </div>

      <div class="metric-card">
        <div class="metric-label">Pontos distribuídos</div>
        <div class="metric-value">${escapeHtml(formatPoints(metrics.distributedPoints))}k</div>
        <div class="metric-sub color-nt">este mês</div>
      </div>

      <div class="metric-card">
        <div class="metric-label">Resgates</div>
        <div class="metric-value">${escapeHtml(metrics.redemptions)}</div>
        <div class="metric-sub color-up">↑ 3 vs anterior</div>
      </div>

      <div class="metric-card">
        <div class="metric-label">Retenção</div>
        <div class="metric-value" style="color:#00e676">${escapeHtml(`${metrics.retentionRate}%`)}</div>
        <div class="metric-sub color-up">${escapeHtml(fidelidadeState.retentionTrend)}</div>
      </div>
    </div>
  `;
}

function renderTopClientRow(client, index, maxPoints) {
  const width = Math.max((client.points / maxPoints) * 100, 15);

  return `
    <button
      type="button"
      class="fidelidade-row-button"
      data-client-id="${escapeHtml(client.id)}"
      title="Ver detalhes de ${escapeHtml(client.name)}"
    >
      <div class="row-item fidelidade-row-item">
        <div class="row-avatar" style="background:${client.avatarGradient};color:${client.avatarColor};">
          ${escapeHtml(client.initials)}
        </div>
        <div class="row-info">
          <div class="row-name">${escapeHtml(client.name)}</div>
          <div class="row-sub">${escapeHtml(`${client.points} pts · ${client.visits} visitas`)}</div>
          <div class="row-prog"><div class="row-fill" style="width:${width}%"></div></div>
        </div>
        <div class="row-value">${escapeHtml(`${client.points} pts`)}</div>
      </div>
    </button>
  `;
}

function renderTopClientsList() {
  const topClients = [...fidelidadeState.clients]
    .sort((a, b) => b.points - a.points)
    .slice(0, 3);

  const maxPoints = Math.max(...topClients.map((item) => item.points), 1);
  return topClients.map((client, index) => renderTopClientRow(client, index, maxPoints)).join('');
}

function renderRewardRow(reward) {
  const meta = getRewardMeta(reward.highlight);

  return `
    <button
      type="button"
      class="fidelidade-row-button"
      data-reward-id="${escapeHtml(reward.id)}"
      title="Ver detalhes de ${escapeHtml(reward.title)}"
    >
      <div class="fin-row" style="border-color:${meta.border}">
        <div class="fin-icon">${escapeHtml(reward.icon)}</div>
        <div class="fin-info">
          <div class="fin-title">${escapeHtml(reward.title)}</div>
          <div class="fin-date">${escapeHtml(`${reward.requiredPoints} pontos necessários`)}</div>
        </div>
        <div class="fin-val" style="color:${meta.color}">${escapeHtml(`${reward.requiredPoints} pts`)}</div>
      </div>
    </button>
  `;
}

function renderRewardList() {
  return fidelidadeState.rewards.map(renderRewardRow).join('');
}

function renderClientDetails(client) {
  return `
    <div class="fidelidade-modal-body">
      <div>
        <div class="modal-title" style="margin:0;">${escapeHtml(client.name)}</div>
        <div class="modal-sub" style="margin-top:4px;">Detalhes do cliente no programa</div>
      </div>

      <div class="fidelidade-modal-grid">
        <div class="mini-card">
          <div class="mini-lbl">Pontos</div>
          <div class="mini-val" style="color:#4fc3f7">${escapeHtml(client.points)}</div>
        </div>
        <div class="mini-card">
          <div class="mini-lbl">Visitas</div>
          <div class="mini-val" style="color:#00e676">${escapeHtml(client.visits)}</div>
        </div>
        <div class="mini-card">
          <div class="mini-lbl">Nível</div>
          <div class="mini-val" style="font-size:15px;">${escapeHtml(client.tier)}</div>
        </div>
        <div class="mini-card">
          <div class="mini-lbl">Entrada</div>
          <div class="mini-val" style="font-size:15px;">${escapeHtml(client.joinedAt)}</div>
        </div>
      </div>

      <div class="fidelidade-modal-info">
        <div class="fidelidade-modal-info-row">
          <strong>Observações:</strong> ${escapeHtml(client.notes || '—')}
        </div>
      </div>

      <div class="modal-buttons" style="margin-top:10px;">
        <button type="button" class="btn-cancel" id="fidelidade-modal-close">Fechar</button>
      </div>
    </div>
  `;
}

function renderRewardDetails(reward) {
  const meta = getRewardMeta(reward.highlight);

  return `
    <div class="fidelidade-modal-body">
      <div>
        <div class="modal-title" style="margin:0;">${escapeHtml(reward.title)}</div>
        <div class="modal-sub" style="margin-top:4px;">Detalhes da recompensa</div>
      </div>

      <div class="fidelidade-modal-grid">
        <div class="mini-card">
          <div class="mini-lbl">Pontos necessários</div>
          <div class="mini-val" style="color:${meta.color}">${escapeHtml(reward.requiredPoints)}</div>
        </div>
        <div class="mini-card">
          <div class="mini-lbl">Resgates</div>
          <div class="mini-val" style="color:#00e676">${escapeHtml(reward.redemptions)}</div>
        </div>
      </div>

      <div class="fidelidade-modal-info">
        <div class="fidelidade-modal-info-row">
          <strong>Status:</strong> ${escapeHtml(reward.active ? 'Ativa' : 'Inativa')}
        </div>
        <div class="fidelidade-modal-info-row">
          <strong>Observações:</strong> ${escapeHtml(reward.notes || '—')}
        </div>
      </div>

      <div class="modal-buttons" style="margin-top:10px;">
        <button type="button" class="btn-cancel" id="fidelidade-modal-close">Fechar</button>
        <button type="button" class="btn-save" id="fidelidade-edit-reward" data-reward-id="${escapeHtml(reward.id)}">Editar recompensa</button>
      </div>
    </div>
  `;
}

function renderRewardForm(mode, reward = null) {
  const isEdit = mode === 'editReward';
  const safeReward = reward || {
    title: '',
    icon: '🎁',
    requiredPoints: 200,
    highlight: 'info',
    redemptions: 0,
    active: true,
    notes: '',
  };

  return `
    <div class="fidelidade-modal-body">
      <div>
        <div class="modal-title" style="margin:0;">${isEdit ? 'Editar recompensa' : 'Nova recompensa'}</div>
        <div class="modal-sub" style="margin-top:4px;">
          ${isEdit ? 'Atualize os dados da recompensa.' : 'Preencha os dados para criar uma nova recompensa.'}
        </div>
      </div>

      <form id="fidelidade-form" class="fidelidade-form">
        <div class="fidelidade-form-grid">
          <div>
            <div class="color-section-label">Título</div>
            <input class="modal-input" name="title" type="text" value="${escapeHtml(safeReward.title)}" placeholder="Nome da recompensa" />
          </div>

          <div>
            <div class="color-section-label">Ícone</div>
            <input class="modal-input" name="icon" type="text" value="${escapeHtml(safeReward.icon)}" placeholder="Ex.: 🎁" />
          </div>

          <div>
            <div class="color-section-label">Pontos necessários</div>
            <input class="modal-input" name="requiredPoints" type="number" min="1" value="${escapeHtml(safeReward.requiredPoints)}" />
          </div>

          <div>
            <div class="color-section-label">Resgates</div>
            <input class="modal-input" name="redemptions" type="number" min="0" value="${escapeHtml(safeReward.redemptions)}" />
          </div>

          <div>
            <div class="color-section-label">Cor destaque</div>
            <select class="modal-input" name="highlight">
              <option value="info" ${safeReward.highlight === 'info' ? 'selected' : ''}>Azul</option>
              <option value="purple" ${safeReward.highlight === 'purple' ? 'selected' : ''}>Roxo</option>
              <option value="success" ${safeReward.highlight === 'success' ? 'selected' : ''}>Verde</option>
              <option value="warning" ${safeReward.highlight === 'warning' ? 'selected' : ''}>Laranja</option>
            </select>
          </div>

          <div>
            <div class="color-section-label">Status</div>
            <select class="modal-input" name="active">
              <option value="true" ${safeReward.active ? 'selected' : ''}>Ativa</option>
              <option value="false" ${!safeReward.active ? 'selected' : ''}>Inativa</option>
            </select>
          </div>
        </div>

        <div>
          <div class="color-section-label">Observações</div>
          <textarea class="modal-input fidelidade-textarea" name="notes" placeholder="Observações da recompensa">${escapeHtml(safeReward.notes || '')}</textarea>
        </div>

        <div id="fidelidade-form-feedback" class="fidelidade-form-feedback"></div>

        <div class="modal-buttons" style="margin-top:10px;">
          <button type="button" class="btn-cancel" id="${isEdit ? 'fidelidade-form-back' : 'fidelidade-form-cancel'}">
            ${isEdit ? 'Voltar' : 'Cancelar'}
          </button>
          <button type="submit" class="btn-save">
            ${isEdit ? 'Salvar alterações' : 'Criar recompensa'}
          </button>
        </div>
      </form>
    </div>
  `;
}

function setFidelidadeFormFeedback(message, variant = 'neutral') {
  const el = document.getElementById('fidelidade-form-feedback');
  if (!el) return;

  el.textContent = message || '';
  el.style.color =
    variant === 'error' ? '#ff8a8a' :
    variant === 'success' ? '#00e676' :
    '#5a6888';
}

function openClientModal(clientId) {
  fidelidadeState.activeClientId = clientId;
  fidelidadeState.activeRewardId = null;
  fidelidadeState.modalMode = 'viewClient';
  renderFidelidadeModal();
}

function openRewardModal(rewardId) {
  fidelidadeState.activeRewardId = rewardId;
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

function openEditRewardModal(rewardId) {
  fidelidadeState.activeRewardId = rewardId;
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

function collectRewardFormData() {
  const form = document.getElementById('fidelidade-form');
  const formData = new FormData(form);

  return {
    title: String(formData.get('title') || '').trim(),
    icon: String(formData.get('icon') || '🎁').trim() || '🎁',
    requiredPoints: Number(formData.get('requiredPoints') || 0),
    redemptions: Number(formData.get('redemptions') || 0),
    highlight: String(formData.get('highlight') || 'info').trim(),
    active: String(formData.get('active') || 'true') === 'true',
    notes: String(formData.get('notes') || '').trim(),
  };
}

function handleRewardFormSubmit(event) {
  event.preventDefault();

  const data = collectRewardFormData();

  if (!data.title) {
    setFidelidadeFormFeedback('Informe o título da recompensa.', 'error');
    return;
  }

  if (data.requiredPoints <= 0) {
    setFidelidadeFormFeedback('Informe uma quantidade válida de pontos.', 'error');
    return;
  }

  if (fidelidadeState.modalMode === 'createReward') {
    const newReward = {
      id: normalizeRewardId(data.title),
      ...data,
    };

    fidelidadeState.rewards = [newReward, ...fidelidadeState.rewards];
    rerenderFidelidade();
    openRewardModal(newReward.id);
    return;
  }

  if (fidelidadeState.modalMode === 'editReward' && fidelidadeState.activeRewardId) {
    fidelidadeState.rewards = fidelidadeState.rewards.map((item) => {
      if (item.id !== fidelidadeState.activeRewardId) return item;
      return { ...item, ...data };
    });

    rerenderFidelidade();
    openRewardModal(fidelidadeState.activeRewardId);
  }
}

function renderFidelidadeModal() {
  const modal = document.getElementById('fidelidade-details-modal');
  const content = document.getElementById('fidelidade-details-content');
  if (!modal || !content) return;

  if (fidelidadeState.modalMode === 'closed') {
    modal.classList.remove('open');
    modal.style.display = 'none';
    content.innerHTML = '';
    return;
  }

  const client = fidelidadeState.activeClientId ? getClientById(fidelidadeState.activeClientId) : null;
  const reward = fidelidadeState.activeRewardId ? getRewardById(fidelidadeState.activeRewardId) : null;

  if (fidelidadeState.modalMode === 'viewClient' && !client) {
    closeFidelidadeModal();
    return;
  }

  if ((fidelidadeState.modalMode === 'viewReward' || fidelidadeState.modalMode === 'editReward') && !reward) {
    closeFidelidadeModal();
    return;
  }

  if (fidelidadeState.modalMode === 'viewClient') {
    content.innerHTML = renderClientDetails(client);
  }

  if (fidelidadeState.modalMode === 'viewReward') {
    content.innerHTML = renderRewardDetails(reward);
  }

  if (fidelidadeState.modalMode === 'editReward') {
    content.innerHTML = renderRewardForm('editReward', reward);
  }

  if (fidelidadeState.modalMode === 'createReward') {
    content.innerHTML = renderRewardForm('createReward');
  }

  modal.style.display = 'flex';
  modal.classList.add('open');

  bindFidelidadeModalEvents();
}

function bindTopClientsEvents() {
  document.querySelectorAll('.fidelidade-row-button[data-client-id]').forEach((button) => {
    button.addEventListener('click', () => {
      openClientModal(button.dataset.clientId);
    });
  });
}

function bindRewardsEvents() {
  document.querySelectorAll('.fidelidade-row-button[data-reward-id]').forEach((button) => {
    button.addEventListener('click', () => {
      openRewardModal(button.dataset.rewardId);
    });
  });
}

function bindFidelidadeModalEvents() {
  document.getElementById('fidelidade-modal-close')?.addEventListener('click', closeFidelidadeModal);

  document.getElementById('fidelidade-edit-reward')?.addEventListener('click', () => {
    const button = document.getElementById('fidelidade-edit-reward');
    if (!button?.dataset.rewardId) return;
    openEditRewardModal(button.dataset.rewardId);
  });

  document.getElementById('fidelidade-form-back')?.addEventListener('click', () => {
    if (!fidelidadeState.activeRewardId) return;
    openRewardModal(fidelidadeState.activeRewardId);
  });

  document.getElementById('fidelidade-form-cancel')?.addEventListener('click', closeFidelidadeModal);
  document.getElementById('fidelidade-form')?.addEventListener('submit', handleRewardFormSubmit);
}

function bindFidelidadeStaticEvents() {
  document.getElementById('fidelidade-new-reward-button')?.addEventListener('click', openCreateRewardModal);

  document.getElementById('fidelidade-details-modal')?.addEventListener('click', (event) => {
    if (event.target?.id === 'fidelidade-details-modal') {
      closeFidelidadeModal();
    }
  });
}

function rerenderFidelidade() {
  const metrics = document.getElementById('fidelidade-metrics');
  const clients = document.getElementById('fidelidade-top-clients');
  const rewards = document.getElementById('fidelidade-rewards-list');

  if (metrics) metrics.innerHTML = renderMetrics();
  if (clients) clients.innerHTML = renderTopClientsList();
  if (rewards) rewards.innerHTML = renderRewardList();

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
        ${renderTopClientsList()}
      </div>
    </div>

    <div class="card">
      <div class="card-header">
        <div class="card-title">🎁 Recompensas</div>
        <button type="button" class="card-action" id="fidelidade-new-reward-button">+ Criar</button>
      </div>
      <div id="fidelidade-rewards-list">
        ${renderRewardList()}
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
  bindTopClientsEvents();
  bindRewardsEvents();
}
