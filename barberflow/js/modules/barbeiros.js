const barbeirosState = {
  items: [
    {
      id: 'jorge-barbeiro',
      initials: 'JB',
      name: 'Jorge Barbeiro',
      role: 'Proprietário · Sócio',
      cuts: 24,
      revenue: 'R$1.4k',
      rating: '4.9★',
      status: 'available',
      avatarGradient: 'linear-gradient(135deg,#ffd700,#ff8c00)',
      avatarColor: '#000',
      commission: 'Sócio',
      specialties: ['Corte premium', 'Barba completa', 'Consultoria visual'],
      todayAppointments: 8,
    },
    {
      id: 'marcos-rodrigues',
      initials: 'MR',
      name: 'Marcos Rodrigues',
      role: 'Barbeiro · 40% comissão',
      cuts: 18,
      revenue: 'R$980',
      rating: '4.7★',
      status: 'available',
      avatarGradient: 'linear-gradient(135deg,#6b6880,#3a3a4a)',
      avatarColor: '#fff',
      commission: '40%',
      specialties: ['Fade', 'Barba desenhada', 'Pigmentação'],
      todayAppointments: 6,
    },
    {
      id: 'lucas-santos',
      initials: 'LS',
      name: 'Lucas Santos',
      role: 'Barbeiro · 35% comissão',
      cuts: 14,
      revenue: 'R$720',
      rating: '4.8★',
      status: 'busy',
      avatarGradient: 'linear-gradient(135deg,#3b82f6,#1d4ed8)',
      avatarColor: '#fff',
      commission: '35%',
      specialties: ['Corte social', 'Navalhado', 'Barba clássica'],
      todayAppointments: 5,
    },
  ],
};

function escapeHtml(value) {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

function getBarberStatusMeta(status) {
  const map = {
    available: {
      label: '● Disponível',
      color: '#00e676',
      bg: 'rgba(0,230,118,.1)',
      border: 'rgba(0,230,118,.18)',
    },
    busy: {
      label: '● Em atendimento',
      color: '#4fc3f7',
      bg: 'rgba(79,195,247,.1)',
      border: 'rgba(79,195,247,.18)',
    },
    break: {
      label: '● Em pausa',
      color: '#ffd700',
      bg: 'rgba(255,215,0,.1)',
      border: 'rgba(255,215,0,.18)',
    },
    off: {
      label: '● Ausente',
      color: '#ff6b81',
      bg: 'rgba(255,107,129,.1)',
      border: 'rgba(255,107,129,.18)',
    },
  };

  return map[status] || map.available;
}

function renderStatusBadge(status) {
  const meta = getBarberStatusMeta(status);

  return `
    <div
      class="barber-status-badge"
      style="background:${meta.bg};color:${meta.color};border:1px solid ${meta.border};"
    >
      ${meta.label}
    </div>
  `;
}

function renderBarberCard(barber) {
  return `
    <button
      type="button"
      class="barber-card-button"
      data-barber-id="${escapeHtml(barber.id)}"
      title="Ver detalhes de ${escapeHtml(barber.name)}"
    >
      <div class="card barber-card">
        <div
          class="row-avatar barber-avatar"
          style="background:${barber.avatarGradient};color:${barber.avatarColor};"
        >
          ${escapeHtml(barber.initials)}
        </div>

        <div class="barber-name">${escapeHtml(barber.name)}</div>
        <div class="barber-role">${escapeHtml(barber.role)}</div>

        <div class="barber-stats">
          <div>
            <div class="barber-stat-value barber-stat-value--blue">${escapeHtml(barber.cuts)}</div>
            <div class="barber-stat-label">Cortes</div>
          </div>
          <div>
            <div class="barber-stat-value barber-stat-value--green">${escapeHtml(barber.revenue)}</div>
            <div class="barber-stat-label">Faturado</div>
          </div>
          <div>
            <div class="barber-stat-value barber-stat-value--purple">${escapeHtml(barber.rating)}</div>
            <div class="barber-stat-label">Nota</div>
          </div>
        </div>

        ${renderStatusBadge(barber.status)}
      </div>
    </button>
  `;
}

function renderBarberStatusActions(barber) {
  const statuses = ['available', 'busy', 'break', 'off'];

  return `
    <div class="barber-modal-actions">
      ${statuses.map((status) => {
        const meta = getBarberStatusMeta(status);
        const isActive = barber.status === status;

        return `
          <button
            type="button"
            class="barber-status-action ${isActive ? 'is-active' : ''}"
            data-barber-id="${escapeHtml(barber.id)}"
            data-status="${escapeHtml(status)}"
            style="
              border:1px solid ${meta.border};
              background:${meta.bg};
              color:${meta.color};
            "
            ${isActive ? 'disabled' : ''}
          >
            ${meta.label}
          </button>
        `;
      }).join('')}
    </div>
  `;
}

function renderBarberDetails(barber) {
  return `
    <div class="barber-modal-body">
      <div class="barber-modal-header">
        <div
          class="row-avatar barber-avatar barber-avatar--lg"
          style="background:${barber.avatarGradient};color:${barber.avatarColor};"
        >
          ${escapeHtml(barber.initials)}
        </div>

        <div>
          <div class="modal-title" style="margin:0;">${escapeHtml(barber.name)}</div>
          <div class="modal-sub" style="margin-top:4px;">${escapeHtml(barber.role)}</div>
        </div>
      </div>

      <div class="barber-modal-grid">
        <div class="mini-card">
          <div class="mini-lbl">Cortes</div>
          <div class="mini-val" style="color:#4fc3f7">${escapeHtml(barber.cuts)}</div>
        </div>
        <div class="mini-card">
          <div class="mini-lbl">Faturado</div>
          <div class="mini-val" style="color:#00e676">${escapeHtml(barber.revenue)}</div>
        </div>
        <div class="mini-card">
          <div class="mini-lbl">Nota</div>
          <div class="mini-val" style="color:#9c6fff">${escapeHtml(barber.rating)}</div>
        </div>
        <div class="mini-card">
          <div class="mini-lbl">Agenda hoje</div>
          <div class="mini-val" style="color:#ffd700">${escapeHtml(barber.todayAppointments)}</div>
        </div>
      </div>

      <div class="barber-modal-info">
        <div class="barber-modal-info-row">
          <strong>Comissão:</strong> ${escapeHtml(barber.commission)}
        </div>
        <div class="barber-modal-info-row">
          <strong>Status atual:</strong> ${escapeHtml(getBarberStatusMeta(barber.status).label)}
        </div>
        <div class="barber-modal-info-row">
          <strong>Especialidades:</strong> ${escapeHtml(barber.specialties.join(', '))}
        </div>
      </div>

      <div>
        <div class="barber-modal-section-title">Alterar status</div>
        ${renderBarberStatusActions(barber)}
      </div>

      <div class="modal-buttons" style="margin-top:10px;">
        <button type="button" class="btn-cancel" id="barber-modal-close">Fechar</button>
      </div>
    </div>
  `;
}

function openBarberModal(barberId) {
  const modal = document.getElementById('barber-details-modal');
  const content = document.getElementById('barber-details-content');
  if (!modal || !content) return;

  const barber = barbeirosState.items.find((item) => item.id === barberId);
  if (!barber) return;

  content.innerHTML = renderBarberDetails(barber);
  modal.style.display = 'flex';
  modal.classList.add('open');

  document.getElementById('barber-modal-close')?.addEventListener('click', closeBarberModal);

  document.querySelectorAll('.barber-status-action').forEach((button) => {
    button.addEventListener('click', () => {
      const targetBarberId = button.dataset.barberId;
      const status = button.dataset.status;
      if (!targetBarberId || !status) return;

      updateBarberStatus(targetBarberId, status);
    });
  });
}

function closeBarberModal() {
  const modal = document.getElementById('barber-details-modal');
  const content = document.getElementById('barber-details-content');
  if (!modal) return;

  modal.classList.remove('open');
  modal.style.display = 'none';

  if (content) content.innerHTML = '';
}

function updateBarberStatus(barberId, status) {
  barbeirosState.items = barbeirosState.items.map((item) => {
    if (item.id !== barberId) return item;
    return { ...item, status };
  });

  rerenderBarbeirosGrid();
  openBarberModal(barberId);
}

function bindBarbeirosEvents() {
  document.querySelectorAll('.barber-card-button[data-barber-id]').forEach((button) => {
    button.addEventListener('click', () => {
      openBarberModal(button.dataset.barberId);
    });
  });

  document.getElementById('barber-details-modal')?.addEventListener('click', (event) => {
    if (event.target?.id === 'barber-details-modal') {
      closeBarberModal();
    }
  });
}

function rerenderBarbeirosGrid() {
  const grid = document.getElementById('barbeiros-grid');
  if (!grid) return;

  grid.innerHTML = barbeirosState.items.map(renderBarberCard).join('');
  bindBarbeirosEvents();
}

export function renderBarbeiros() {
  return /* html */ `
<section class="page-shell page--barbeiros">
  <div class="barbeiros-topbar">
    <div>
      <div class="card-title">Time de barbeiros</div>
      <div class="barbeiros-subtitle">Visualize desempenho e atualize o status da equipe em tempo real.</div>
    </div>

    <button type="button" class="card-action barbeiros-action-btn">
      + Novo barbeiro
    </button>
  </div>

  <div class="grid-3" id="barbeiros-grid">
    ${barbeirosState.items.map(renderBarberCard).join('')}
  </div>

  <div id="barber-details-modal" class="modal-overlay" style="display:none;">
    <div class="modal" style="width:min(92vw, 560px);">
      <div id="barber-details-content"></div>
    </div>
  </div>
</section>
  `;
}

export function initBarbeirosPage() {
  bindBarbeirosEvents();
}
