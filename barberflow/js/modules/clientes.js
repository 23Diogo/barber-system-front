const clientesState = {
  items: [
    {
      id: 'rafael-souza',
      name: 'Rafael Souza',
      phone: '(11) 99999-1111',
      whatsapp: '(11) 99999-1111',
      lastService: 'Fade médio + navalha',
      lastCut: 'Hoje 09:00',
      visits: 24,
      totalSpent: 1680,
      status: 'vip',
      notes: 'Cliente frequente. Prefere corte com acabamento na navalha.',
    },
    {
      id: 'carlos-mendes',
      name: 'Carlos Mendes',
      phone: '(11) 98888-2222',
      whatsapp: '(11) 98888-2222',
      lastService: 'Corte curto + barba',
      lastCut: 'Hoje 14:30',
      visits: 15,
      totalSpent: 975,
      status: 'active',
      notes: 'Geralmente agenda no período da tarde.',
    },
    {
      id: 'pedro-costa',
      name: 'Pedro Costa',
      phone: '(11) 95555-5555',
      whatsapp: '(11) 95555-5555',
      lastService: 'Fade alto + navalha',
      lastCut: '08/03/2025',
      visits: 18,
      totalSpent: 1260,
      status: 'vip',
      notes: 'Cliente fiel, costuma fechar combos.',
    },
    {
      id: 'bruno-alves',
      name: 'Bruno Alves',
      phone: '(11) 97777-3333',
      whatsapp: '(11) 97777-3333',
      lastService: 'Barba completa',
      lastCut: '15/03/2025',
      visits: 8,
      totalSpent: 360,
      status: 'active',
      notes: 'Atendimento rápido, foco em barba.',
    },
    {
      id: 'marcos-lima',
      name: 'Marcos Lima',
      phone: '(11) 96666-4444',
      whatsapp: '(11) 96666-4444',
      lastService: '—',
      lastCut: '10/02/2025',
      visits: 3,
      totalSpent: 120,
      status: 'inactive',
      notes: 'Não retorna desde fevereiro.',
    },
  ],
  searchTerm: '',
  modalMode: 'closed', // closed | view | edit | create
  activeClientId: null,
};

function escapeHtml(value) {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

function formatCurrency(value) {
  return new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL',
    maximumFractionDigits: 0,
  }).format(Number(value || 0));
}

function getClientById(clientId) {
  return clientesState.items.find((item) => item.id === clientId) || null;
}

function normalizeClientId(name) {
  const base = String(name || 'novo-cliente')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '') || 'novo-cliente';

  let candidate = base;
  let counter = 2;

  while (clientesState.items.some((item) => item.id === candidate)) {
    candidate = `${base}-${counter}`;
    counter += 1;
  }

  return candidate;
}

function getClientStatusMeta(status) {
  const map = {
    vip: {
      label: '✦ VIP',
      text: '#ffd700',
      bg: 'rgba(255,215,0,.1)',
    },
    active: {
      label: 'Ativo',
      text: '#00e676',
      bg: 'rgba(0,230,118,.1)',
    },
    inactive: {
      label: 'Inativo',
      text: '#f97316',
      bg: 'rgba(249,115,22,.1)',
    },
  };

  return map[status] || map.active;
}

function getFilteredClients() {
  const term = clientesState.searchTerm.trim().toLowerCase();
  if (!term) return clientesState.items;

  return clientesState.items.filter((client) => {
    return [
      client.name,
      client.phone,
      client.whatsapp,
      client.lastService,
      client.lastCut,
      getClientStatusMeta(client.status).label,
    ]
      .join(' ')
      .toLowerCase()
      .includes(term);
  });
}

function renderClientStatusPill(status) {
  const meta = getClientStatusMeta(status);

  return `
    <span class="pill" style="background:${meta.bg};color:${meta.text}">
      ${meta.label}
    </span>
  `;
}

function renderClientRow(client) {
  return `
    <tr class="client-row" data-client-id="${escapeHtml(client.id)}" tabindex="0" role="button" title="Ver detalhes de ${escapeHtml(client.name)}">
      <td>
        <div class="client-name">${escapeHtml(client.name)}</div>
        <div class="client-service">${escapeHtml(client.lastService)}</div>
      </td>
      <td class="client-muted">${escapeHtml(client.whatsapp)}</td>
      <td>${escapeHtml(client.lastCut)}</td>
      <td>${escapeHtml(client.visits)}</td>
      <td class="client-spent ${client.status === 'vip' ? 'is-vip' : client.status === 'active' ? 'is-active' : 'is-inactive'}">
        ${escapeHtml(formatCurrency(client.totalSpent))}
      </td>
      <td>${renderClientStatusPill(client.status)}</td>
    </tr>
  `;
}

function renderClientsTableBody() {
  const clients = getFilteredClients();

  if (!clients.length) {
    return `
      <tr>
        <td colspan="6" class="clients-empty">
          Nenhum cliente encontrado para a busca informada.
        </td>
      </tr>
    `;
  }

  return clients.map(renderClientRow).join('');
}

function renderClientDetails(client) {
  return `
    <div class="clients-modal-body">
      <div>
        <div class="modal-title" style="margin:0;">${escapeHtml(client.name)}</div>
        <div class="modal-sub" style="margin-top:4px;">Detalhes do cliente</div>
      </div>

      <div class="clients-modal-grid">
        <div class="mini-card">
          <div class="mini-lbl">Visitas</div>
          <div class="mini-val" style="color:#4fc3f7">${escapeHtml(client.visits)}</div>
        </div>
        <div class="mini-card">
          <div class="mini-lbl">Total gasto</div>
          <div class="mini-val" style="color:#ffd700">${escapeHtml(formatCurrency(client.totalSpent))}</div>
        </div>
        <div class="mini-card">
          <div class="mini-lbl">Último corte</div>
          <div class="mini-val" style="font-size:15px;">${escapeHtml(client.lastCut)}</div>
        </div>
        <div class="mini-card">
          <div class="mini-lbl">Status</div>
          <div class="mini-val" style="font-size:15px;color:${getClientStatusMeta(client.status).text}">
            ${escapeHtml(getClientStatusMeta(client.status).label)}
          </div>
        </div>
      </div>

      <div class="clients-modal-info">
        <div class="clients-modal-info-row">
          <strong>WhatsApp:</strong> ${escapeHtml(client.whatsapp)}
        </div>
        <div class="clients-modal-info-row">
          <strong>Serviço mais recente:</strong> ${escapeHtml(client.lastService)}
        </div>
        <div class="clients-modal-info-row">
          <strong>Observações:</strong> ${escapeHtml(client.notes || '—')}
        </div>
      </div>

      <div class="modal-buttons" style="margin-top:10px;">
        <button type="button" class="btn-cancel" id="client-modal-close">Fechar</button>
        <button type="button" class="btn-save" id="client-edit-button" data-client-id="${escapeHtml(client.id)}">Editar informações</button>
      </div>
    </div>
  `;
}

function renderClientForm(mode, client = null) {
  const isEdit = mode === 'edit';
  const safeClient = client || {
    name: '',
    phone: '',
    whatsapp: '',
    lastService: '',
    lastCut: '',
    visits: 0,
    totalSpent: 0,
    status: 'active',
    notes: '',
  };

  return `
    <div class="clients-modal-body">
      <div>
        <div class="modal-title" style="margin:0;">${isEdit ? 'Editar cliente' : 'Novo cliente'}</div>
        <div class="modal-sub" style="margin-top:4px;">
          ${isEdit ? 'Atualize os dados do cliente.' : 'Preencha os dados para cadastrar um novo cliente.'}
        </div>
      </div>

      <form id="client-form" class="clients-form">
        <div class="clients-form-grid">
          <div>
            <div class="color-section-label">Nome</div>
            <input class="modal-input" name="name" type="text" value="${escapeHtml(safeClient.name)}" placeholder="Nome do cliente" />
          </div>

          <div>
            <div class="color-section-label">WhatsApp</div>
            <input class="modal-input" name="whatsapp" type="text" value="${escapeHtml(safeClient.whatsapp)}" placeholder="(11) 99999-9999" />
          </div>

          <div>
            <div class="color-section-label">Telefone</div>
            <input class="modal-input" name="phone" type="text" value="${escapeHtml(safeClient.phone)}" placeholder="(11) 99999-9999" />
          </div>

          <div>
            <div class="color-section-label">Status</div>
            <select class="modal-input" name="status">
              <option value="vip" ${safeClient.status === 'vip' ? 'selected' : ''}>VIP</option>
              <option value="active" ${safeClient.status === 'active' ? 'selected' : ''}>Ativo</option>
              <option value="inactive" ${safeClient.status === 'inactive' ? 'selected' : ''}>Inativo</option>
            </select>
          </div>

          <div>
            <div class="color-section-label">Último serviço</div>
            <input class="modal-input" name="lastService" type="text" value="${escapeHtml(safeClient.lastService)}" placeholder="Ex.: Corte + barba" />
          </div>

          <div>
            <div class="color-section-label">Último corte</div>
            <input class="modal-input" name="lastCut" type="text" value="${escapeHtml(safeClient.lastCut)}" placeholder="Ex.: Hoje 14:30" />
          </div>

          <div>
            <div class="color-section-label">Visitas</div>
            <input class="modal-input" name="visits" type="number" min="0" value="${escapeHtml(safeClient.visits)}" />
          </div>

          <div>
            <div class="color-section-label">Total gasto</div>
            <input class="modal-input" name="totalSpent" type="number" min="0" value="${escapeHtml(safeClient.totalSpent)}" />
          </div>
        </div>

        <div>
          <div class="color-section-label">Observações</div>
          <textarea class="modal-input clients-textarea" name="notes" placeholder="Observações do cliente">${escapeHtml(safeClient.notes)}</textarea>
        </div>

        <div id="client-form-feedback" class="clients-form-feedback"></div>

        <div class="modal-buttons" style="margin-top:10px;">
          <button type="button" class="btn-cancel" id="${isEdit ? 'client-form-back' : 'client-form-cancel'}">
            ${isEdit ? 'Voltar' : 'Cancelar'}
          </button>
          <button type="submit" class="btn-save">
            ${isEdit ? 'Salvar alterações' : 'Cadastrar cliente'}
          </button>
        </div>
      </form>
    </div>
  `;
}

function setClientFormFeedback(message, variant = 'neutral') {
  const el = document.getElementById('client-form-feedback');
  if (!el) return;

  el.textContent = message || '';
  el.style.color =
    variant === 'error' ? '#ff8a8a' :
    variant === 'success' ? '#00e676' :
    '#5a6888';
}

function openClientModal(clientId) {
  clientesState.activeClientId = clientId;
  clientesState.modalMode = 'view';
  renderClientModal();
}

function openCreateClientModal() {
  clientesState.activeClientId = null;
  clientesState.modalMode = 'create';
  renderClientModal();
}

function openEditClientModal(clientId) {
  clientesState.activeClientId = clientId;
  clientesState.modalMode = 'edit';
  renderClientModal();
}

function closeClientModal() {
  const modal = document.getElementById('client-details-modal');
  const content = document.getElementById('client-details-content');
  if (!modal) return;

  clientesState.modalMode = 'closed';
  clientesState.activeClientId = null;
  modal.classList.remove('open');
  modal.style.display = 'none';

  if (content) content.innerHTML = '';
}

function collectClientFormData() {
  const form = document.getElementById('client-form');
  const formData = new FormData(form);

  return {
    name: String(formData.get('name') || '').trim(),
    phone: String(formData.get('phone') || '').trim(),
    whatsapp: String(formData.get('whatsapp') || '').trim(),
    lastService: String(formData.get('lastService') || '').trim() || '—',
    lastCut: String(formData.get('lastCut') || '').trim() || '—',
    visits: Number(formData.get('visits') || 0),
    totalSpent: Number(formData.get('totalSpent') || 0),
    status: String(formData.get('status') || 'active').trim(),
    notes: String(formData.get('notes') || '').trim(),
  };
}

function handleClientFormSubmit(event) {
  event.preventDefault();

  const data = collectClientFormData();

  if (!data.name) {
    setClientFormFeedback('Informe o nome do cliente.', 'error');
    return;
  }

  if (!data.whatsapp) {
    setClientFormFeedback('Informe o WhatsApp do cliente.', 'error');
    return;
  }

  if (clientesState.modalMode === 'create') {
    const newClient = {
      id: normalizeClientId(data.name),
      ...data,
    };

    clientesState.items = [newClient, ...clientesState.items];
    rerenderClientesTable();
    openClientModal(newClient.id);
    return;
  }

  if (clientesState.modalMode === 'edit' && clientesState.activeClientId) {
    clientesState.items = clientesState.items.map((item) => {
      if (item.id !== clientesState.activeClientId) return item;
      return { ...item, ...data };
    });

    rerenderClientesTable();
    openClientModal(clientesState.activeClientId);
  }
}

function renderClientModal() {
  const modal = document.getElementById('client-details-modal');
  const content = document.getElementById('client-details-content');
  if (!modal || !content) return;

  if (clientesState.modalMode === 'closed') {
    modal.classList.remove('open');
    modal.style.display = 'none';
    content.innerHTML = '';
    return;
  }

  const client = clientesState.activeClientId ? getClientById(clientesState.activeClientId) : null;

  if ((clientesState.modalMode === 'view' || clientesState.modalMode === 'edit') && !client) {
    closeClientModal();
    return;
  }

  if (clientesState.modalMode === 'view') {
    content.innerHTML = renderClientDetails(client);
  }

  if (clientesState.modalMode === 'edit') {
    content.innerHTML = renderClientForm('edit', client);
  }

  if (clientesState.modalMode === 'create') {
    content.innerHTML = renderClientForm('create');
  }

  modal.style.display = 'flex';
  modal.classList.add('open');

  bindClientModalEvents();
}

function bindClientsRowsEvents() {
  document.querySelectorAll('.client-row[data-client-id]').forEach((row) => {
    row.addEventListener('click', () => {
      openClientModal(row.dataset.clientId);
    });

    row.addEventListener('keydown', (event) => {
      if (event.key === 'Enter' || event.key === ' ') {
        event.preventDefault();
        openClientModal(row.dataset.clientId);
      }
    });
  });
}

function bindClientModalEvents() {
  document.getElementById('client-modal-close')?.addEventListener('click', closeClientModal);

  document.getElementById('client-edit-button')?.addEventListener('click', () => {
    if (!clientesState.activeClientId) return;
    openEditClientModal(clientesState.activeClientId);
  });

  document.getElementById('client-form-back')?.addEventListener('click', () => {
    if (!clientesState.activeClientId) return;
    openClientModal(clientesState.activeClientId);
  });

  document.getElementById('client-form-cancel')?.addEventListener('click', closeClientModal);
  document.getElementById('client-form')?.addEventListener('submit', handleClientFormSubmit);
}

function bindClientesStaticEvents() {
  document.getElementById('client-new-button')?.addEventListener('click', openCreateClientModal);

  document.getElementById('client-search-input')?.addEventListener('input', (event) => {
    clientesState.searchTerm = event.target.value || '';
    rerenderClientesTable();
  });

  document.getElementById('client-details-modal')?.addEventListener('click', (event) => {
    if (event.target?.id === 'client-details-modal') {
      closeClientModal();
    }
  });
}

function rerenderClientesTable() {
  const tbody = document.getElementById('clients-table-body');
  if (!tbody) return;

  tbody.innerHTML = renderClientsTableBody();
  bindClientsRowsEvents();
}

export function renderClientes() {
  return /* html */ `
<section class="page-shell page--clientes">
  <div class="clients-toolbar">
    <div class="clients-search-wrap">
      <span class="clients-search-icon">🔍</span>
      <input
        id="client-search-input"
        class="clients-search-input"
        type="text"
        placeholder="Buscar por nome, telefone ou WhatsApp..."
        value="${escapeHtml(clientesState.searchTerm)}"
      />
    </div>

    <button type="button" class="btn-primary-gradient" id="client-new-button">
      + Novo cliente
    </button>
  </div>

  <div class="card">
    <table class="data-table clients-table">
      <thead>
        <tr>
          <th>Cliente</th>
          <th>WhatsApp</th>
          <th>Último corte</th>
          <th>Visitas</th>
          <th>Total gasto</th>
          <th>Status</th>
        </tr>
      </thead>
      <tbody id="clients-table-body">
        ${renderClientsTableBody()}
      </tbody>
    </table>
  </div>

  <div id="client-details-modal" class="modal-overlay" style="display:none;">
    <div class="modal" style="width:min(92vw, 620px);">
      <div id="client-details-content"></div>
    </div>
  </div>
</section>
  `;
}

export function initClientesPage() {
  bindClientesStaticEvents();
  bindClientsRowsEvents();
}
