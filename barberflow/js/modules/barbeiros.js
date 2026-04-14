const barberThemes = [
  { avatarGradient: 'linear-gradient(135deg,#ffd700,#ff8c00)', avatarColor: '#000' },
  { avatarGradient: 'linear-gradient(135deg,#6b6880,#3a3a4a)', avatarColor: '#fff' },
  { avatarGradient: 'linear-gradient(135deg,#3b82f6,#1d4ed8)', avatarColor: '#fff' },
  { avatarGradient: 'linear-gradient(135deg,#9c6fff,#5530dd)', avatarColor: '#fff' },
  { avatarGradient: 'linear-gradient(135deg,#00e676,#00b248)', avatarColor: '#001b0b' },
];

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
  modalMode: 'closed', // closed | view | edit | create
  activeBarberId: null,
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

function getBarberById(barberId) {
  return barbeirosState.items.find((item) => item.id === barberId) || null;
}

function getNextBarberTheme() {
  return barberThemes[barbeirosState.items.length % barberThemes.length];
}

function generateInitials(name) {
  const parts = String(name || '')
    .trim()
    .split(/\s+/)
    .filter(Boolean);

  return parts.slice(0, 2).map((part) => part[0]?.toUpperCase() || '').join('') || 'NB';
}

function normalizeBarberId(name) {
  const base = String(name || 'novo-barbeiro')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '') || 'novo-barbeiro';

  let candidate = base;
  let counter = 2;

  while (barbeirosState.items.some((item) => item.id === candidate)) {
    candidate = `${base}-${counter}`;
    counter += 1;
  }

  return candidate;
}

function buildRole(role, commission) {
  const safeRole = String(role || '').trim();
  const safeCommission = String(commission || '').trim();

  if (safeRole) return safeRole;
  if (safeCommission) return `Barbeiro · ${safeCommission} comissão`;
  return 'Barbeiro';
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
        <button type="button" class="btn-save" id="barber-edit-button" data-barber-id="${escapeHtml(barber.id)}">Editar informações</button>
      </div>
    </div>
  `;
}

function renderBarberForm(mode, barber = null) {
  const isEdit = mode === 'edit';
  const safeBarber = barber || {
    name: '',
    role: '',
    commission: '',
    cuts: 0,
    revenue: 'R$0',
    rating: '5.0★',
    todayAppointments: 0,
    specialties: [],
    status: 'available',
  };

  return `
    <div class="barber-modal-body">
      <div>
        <div class="modal-title" style="margin:0;">${isEdit ? 'Editar barbeiro' : 'Novo barbeiro'}</div>
        <div class="modal-sub" style="margin-top:4px;">
          ${isEdit ? 'Atualize os dados do profissional.' : 'Preencha os dados para adicionar um novo barbeiro.'}
        </div>
      </div>

      <form id="barber-form" class="barber-form">
        <div class="barber-form-grid">
          <div>
            <div class="color-section-label">Nome</div>
            <input class="modal-input" name="name" type="text" value="${escapeHtml(safeBarber.name)}" placeholder="Nome do barbeiro" />
          </div>

          <div>
            <div class="color-section-label">Função</div>
            <input class="modal-input" name="role" type="text" value="${escapeHtml(safeBarber.role)}" placeholder="Ex.: Barbeiro · 40% comissão" />
          </div>

          <div>
            <div class="color-section-label">Comissão</div>
            <input class="modal-input" name="commission" type="text" value="${escapeHtml(safeBarber.commission)}" placeholder="Ex.: 40%" />
          </div>

          <div>
            <div class="color-section-label">Status</div>
            <select class="modal-input" name="status">
              <option value="available" ${safeBarber.status === 'available' ? 'selected' : ''}>Disponível</option>
              <option value="busy" ${safeBarber.status === 'busy' ? 'selected' : ''}>Em atendimento</option>
              <option value="break" ${safeBarber.status === 'break' ? 'selected' : ''}>Em pausa</option>
              <option value="off" ${safeBarber.status === 'off' ? 'selected' : ''}>Ausente</option>
            </select>
          </div>

          <div>
            <div class="color-section-label">Cortes</div>
            <input class="modal-input" name="cuts" type="number" min="0" value="${escapeHtml(safeBarber.cuts)}" />
          </div>

          <div>
            <div class="color-section-label">Agenda hoje</div>
            <input class="modal-input" name="todayAppointments" type="number" min="0" value="${escapeHtml(safeBarber.todayAppointments)}" />
          </div>

          <div>
            <div class="color-section-label">Faturado</div>
            <input class="modal-input" name="revenue" type="text" value="${escapeHtml(safeBarber.revenue)}" placeholder="Ex.: R$980" />
          </div>

          <div>
            <div class="color-section-label">Nota</div>
            <input class="modal-input" name="rating" type="text" value="${escapeHtml(safeBarber.rating)}" placeholder="Ex.: 4.8★" />
          </div>
        </div>

        <div>
          <div class="color-section-label">Especialidades</div>
          <textarea class="modal-input barber-textarea" name="specialties" placeholder="Separe por vírgula">${escapeHtml(safeBarber.specialties.join(', '))}</textarea>
        </div>

        <div id="barber-form-feedback" class="barber-form-feedback"></div>

        <div class="modal-buttons" style="margin-top:10px;">
          <button type="button" class="btn-cancel" id="${isEdit ? 'barber-form-back' : 'barber-form-cancel'}">
            ${isEdit ? 'Voltar' : 'Cancelar'}
          </button>
          <button type="submit" class="btn-save">
            ${isEdit ? 'Salvar alterações' : 'Cadastrar barbeiro'}
          </button>
        </div>
      </form>
    </div>
  `;
}

function setBarberModalFeedback(message, variant = 'neutral') {
  const el = document.getElementById('barber-form-feedback');
  if (!el) return;

  el.textContent = message || '';
  el.style.color =
    variant === 'error' ? '#ff8a8a' :
    variant === 'success' ? '#00e676' :
    '#5a6888';
}

function openBarberModal(barberId) {
  barbeirosState.activeBarberId = barberId;
  barbeirosState.modalMode = 'view';
  renderBarberModal();
}

function openCreateBarberModal() {
  barbeirosState.activeBarberId = null;
  barbeirosState.modalMode = 'create';
  renderBarberModal();
}

function openEditBarberModal(barberId) {
  barbeirosState.activeBarberId = barberId;
  barbeirosState.modalMode = 'edit';
  renderBarberModal();
}

function closeBarberModal() {
  const modal = document.getElementById('barber-details-modal');
  const content = document.getElementById('barber-details-content');
  if (!modal) return;

  barbeirosState.modalMode = 'closed';
  barbeirosState.activeBarberId = null;

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

function collectBarberFormData() {
  const form = document.getElementById('barber-form');
  const formData = new FormData(form);

  const name = String(formData.get('name') || '').trim();
  const role = String(formData.get('role') || '').trim();
  const commission = String(formData.get('commission') || '').trim();
  const status = String(formData.get('status') || 'available').trim();
  const cuts = Number(formData.get('cuts') || 0);
  const todayAppointments = Number(formData.get('todayAppointments') || 0);
  const revenue = String(formData.get('revenue') || '').trim() || 'R$0';
  const rating = String(formData.get('rating') || '').trim() || '0.0★';
  const specialties = String(formData.get('specialties') || '')
    .split(',')
    .map((item) => item.trim())
    .filter(Boolean);

  return {
    name,
    role: buildRole(role, commission),
    commission: commission || '—',
    status,
    cuts,
    todayAppointments,
    revenue,
    rating,
    specialties,
  };
}

function handleBarberFormSubmit(event) {
  event.preventDefault();

  const data = collectBarberFormData();

  if (!data.name) {
    setBarberModalFeedback('Informe o nome do barbeiro.', 'error');
    return;
  }

  if (!data.specialties.length) {
    setBarberModalFeedback('Informe ao menos uma especialidade.', 'error');
    return;
  }

  if (barbeirosState.modalMode === 'create') {
    const theme = getNextBarberTheme();

    const newBarber = {
      id: normalizeBarberId(data.name),
      initials: generateInitials(data.name),
      avatarGradient: theme.avatarGradient,
      avatarColor: theme.avatarColor,
      ...data,
    };

    barbeirosState.items = [newBarber, ...barbeirosState.items];
    rerenderBarbeirosGrid();
    openBarberModal(newBarber.id);
    return;
  }

  if (barbeirosState.modalMode === 'edit' && barbeirosState.activeBarberId) {
    const currentBarber = getBarberById(barbeirosState.activeBarberId);
    if (!currentBarber) return;

    const updatedBarber = {
      ...currentBarber,
      ...data,
      initials: generateInitials(data.name),
    };

    barbeirosState.items = barbeirosState.items.map((item) => {
      if (item.id !== barbeirosState.activeBarberId) return item;
      return updatedBarber;
    });

    rerenderBarbeirosGrid();
    openBarberModal(updatedBarber.id);
  }
}

function renderBarberModal() {
  const modal = document.getElementById('barber-details-modal');
  const content = document.getElementById('barber-details-content');
  if (!modal || !content) return;

  if (barbeirosState.modalMode === 'closed') {
    modal.classList.remove('open');
    modal.style.display = 'none';
    content.innerHTML = '';
    return;
  }

  const barber = barbeirosState.activeBarberId ? getBarberById(barbeirosState.activeBarberId) : null;

  if ((barbeirosState.modalMode === 'view' || barbeirosState.modalMode === 'edit') && !barber) {
    closeBarberModal();
    return;
  }

  if (barbeirosState.modalMode === 'view') {
    content.innerHTML = renderBarberDetails(barber);
  }

  if (barbeirosState.modalMode === 'edit') {
    content.innerHTML = renderBarberForm('edit', barber);
  }

  if (barbeirosState.modalMode === 'create') {
    content.innerHTML = renderBarberForm('create');
  }

  modal.style.display = 'flex';
  modal.classList.add('open');

  bindBarberModalEvents();
}

function bindBarberModalEvents() {
  document.getElementById('barber-modal-close')?.addEventListener('click', closeBarberModal);

  document.getElementById('barber-edit-button')?.addEventListener('click', () => {
    if (!barbeirosState.activeBarberId) return;
    openEditBarberModal(barbeirosState.activeBarberId);
  });

  document.getElementById('barber-form-back')?.addEventListener('click', () => {
    if (!barbeirosState.activeBarberId) return;
    openBarberModal(barbeirosState.activeBarberId);
  });

  document.getElementById('barber-form-cancel')?.addEventListener('click', closeBarberModal);

  document.getElementById('barber-form')?.addEventListener('submit', handleBarberFormSubmit);

  document.querySelectorAll('.barber-status-action').forEach((button) => {
    button.addEventListener('click', () => {
      const targetBarberId = button.dataset.barberId;
      const status = button.dataset.status;
      if (!targetBarberId || !status) return;

      updateBarberStatus(targetBarberId, status);
    });
  });
}

function bindBarbeirosGridEvents() {
  document.querySelectorAll('.barber-card-button[data-barber-id]').forEach((button) => {
    button.addEventListener('click', () => {
      openBarberModal(button.dataset.barberId);
    });
  });
}

function bindBarbeirosStaticEvents() {
  document.getElementById('barber-new-button')?.addEventListener('click', openCreateBarberModal);

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
  bindBarbeirosGridEvents();
}

export function renderBarbeiros() {
  return /* html */ `
<section class="page-shell page--barbeiros">
  <div class="barbeiros-topbar">
    <div>
      <div class="card-title">Time de barbeiros</div>
      <div class="barbeiros-subtitle">Visualize desempenho e atualize o status da equipe em tempo real.</div>
    </div>

    <button type="button" class="btn-primary-gradient" id="barber-new-button">
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
  bindBarbeirosGridEvents();
  bindBarbeirosStaticEvents();
}
