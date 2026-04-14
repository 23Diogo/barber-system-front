const servicosState = {
  items: [
    {
      id: 'corte-simples',
      icon: '✂️',
      name: 'Corte simples',
      durationMinutes: 30,
      barbers: ['Todos os barbeiros'],
      price: 40,
      monthlySales: 28,
      active: true,
    },
    {
      id: 'corte-barba',
      icon: '✂️',
      name: 'Corte + Barba',
      durationMinutes: 60,
      barbers: ['Todos os barbeiros'],
      price: 70,
      monthlySales: 48,
      active: true,
    },
    {
      id: 'fade-medio',
      icon: '✨',
      name: 'Fade médio',
      durationMinutes: 45,
      barbers: ['Todos os barbeiros'],
      price: 55,
      monthlySales: 32,
      active: true,
    },
    {
      id: 'barba-completa',
      icon: '🪒',
      name: 'Barba completa',
      durationMinutes: 30,
      barbers: ['Jorge', 'Lucas'],
      price: 45,
      monthlySales: 18,
      active: true,
    },
    {
      id: 'fade-navalha',
      icon: '💈',
      name: 'Fade + Navalha',
      durationMinutes: 60,
      barbers: ['Jorge'],
      price: 65,
      monthlySales: 14,
      active: true,
    },
  ],
  modalMode: 'closed', // closed | view | edit | create
  activeServiceId: null,
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

function getServiceById(serviceId) {
  return servicosState.items.find((item) => item.id === serviceId) || null;
}

function normalizeServiceId(name) {
  const base = String(name || 'novo-servico')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '') || 'novo-servico';

  let candidate = base;
  let counter = 2;

  while (servicosState.items.some((item) => item.id === candidate)) {
    candidate = `${base}-${counter}`;
    counter += 1;
  }

  return candidate;
}

function getServiceStatusMeta(active) {
  if (active) {
    return {
      label: 'Ativo',
      color: '#00e676',
      bg: 'rgba(0,230,118,.1)',
      border: 'rgba(0,230,118,.18)',
    };
  }

  return {
    label: 'Inativo',
    color: '#ff6b81',
    bg: 'rgba(255,107,129,.1)',
    border: 'rgba(255,107,129,.18)',
  };
}

function getServiceBarbersLabel(barbers) {
  if (!Array.isArray(barbers) || !barbers.length) return 'Não informado';
  return barbers.join(', ');
}

function getMonthlyRevenue(service) {
  return Number(service.price || 0) * Number(service.monthlySales || 0);
}

function renderServiceStatusBadge(active) {
  const meta = getServiceStatusMeta(active);

  return `
    <div
      class="svc-status-badge"
      style="background:${meta.bg};color:${meta.color};border:1px solid ${meta.border};"
    >
      ${meta.label}
    </div>
  `;
}

function renderServiceRow(service) {
  return `
    <button
      type="button"
      class="svc-row-button"
      data-service-id="${escapeHtml(service.id)}"
      title="Ver detalhes de ${escapeHtml(service.name)}"
    >
      <div class="svc-row">
        <div class="svc-icon">${escapeHtml(service.icon)}</div>
        <div class="svc-info">
          <div class="svc-name">${escapeHtml(service.name)}</div>
          <div class="svc-detail">
            ${escapeHtml(`${service.durationMinutes} min · ${getServiceBarbersLabel(service.barbers)}`)}
          </div>
        </div>
        <div class="svc-side">
          ${renderServiceStatusBadge(service.active)}
          <div class="svc-price">${escapeHtml(formatCurrency(service.price))}</div>
        </div>
      </div>
    </button>
  `;
}

function renderTopSellingRow(service, index, maxSales) {
  const safeMax = Math.max(maxSales, 1);
  const width = Math.max((service.monthlySales / safeMax) * 100, 12);
  const icons = ['✂️', '✨', '🪒', '💈'];

  return `
    <div class="row-item">
      <div class="svc-top-icon">${escapeHtml(service.icon || icons[index] || '✂️')}</div>
      <div class="row-info">
        <div class="row-name">${escapeHtml(service.name)}</div>
        <div class="row-sub">${escapeHtml(`${service.monthlySales} vezes este mês`)}</div>
        <div class="row-prog"><div class="row-fill" style="width:${width}%"></div></div>
      </div>
      <div class="row-value">${escapeHtml(formatCurrency(getMonthlyRevenue(service)))}</div>
    </div>
  `;
}

function renderTopSellingServices() {
  const activeServices = servicosState.items.filter((item) => item.active);
  const topServices = [...activeServices]
    .sort((a, b) => b.monthlySales - a.monthlySales)
    .slice(0, 3);

  if (!topServices.length) {
    return '<div class="row-sub" style="padding:10px 2px;">Nenhum serviço ativo para exibir no ranking.</div>';
  }

  const maxSales = Math.max(...topServices.map((item) => item.monthlySales), 1);
  return topServices.map((service, index) => renderTopSellingRow(service, index, maxSales)).join('');
}

function renderServiceDetails(service) {
  const meta = getServiceStatusMeta(service.active);

  return `
    <div class="svc-modal-body">
      <div class="svc-modal-header">
        <div class="svc-modal-icon">${escapeHtml(service.icon)}</div>
        <div>
          <div class="modal-title" style="margin:0;">${escapeHtml(service.name)}</div>
          <div class="modal-sub" style="margin-top:4px;">
            ${escapeHtml(`${service.durationMinutes} min · ${getServiceBarbersLabel(service.barbers)}`)}
          </div>
        </div>
      </div>

      <div class="svc-modal-grid">
        <div class="mini-card">
          <div class="mini-lbl">Preço</div>
          <div class="mini-val" style="color:#4fc3f7">${escapeHtml(formatCurrency(service.price))}</div>
        </div>
        <div class="mini-card">
          <div class="mini-lbl">Vendas no mês</div>
          <div class="mini-val" style="color:#00e676">${escapeHtml(service.monthlySales)}</div>
        </div>
        <div class="mini-card">
          <div class="mini-lbl">Faturamento</div>
          <div class="mini-val" style="color:#9c6fff">${escapeHtml(formatCurrency(getMonthlyRevenue(service)))}</div>
        </div>
        <div class="mini-card">
          <div class="mini-lbl">Status</div>
          <div class="mini-val" style="font-size:16px;color:${meta.color}">${escapeHtml(meta.label)}</div>
        </div>
      </div>

      <div class="svc-modal-info">
        <div class="svc-modal-info-row">
          <strong>Barbeiros:</strong> ${escapeHtml(getServiceBarbersLabel(service.barbers))}
        </div>
        <div class="svc-modal-info-row">
          <strong>Duração:</strong> ${escapeHtml(`${service.durationMinutes} minutos`)}
        </div>
      </div>

      <div class="modal-buttons" style="margin-top:10px;">
        <button type="button" class="btn-cancel" id="service-modal-close">Fechar</button>
        <button type="button" class="btn-save" id="service-edit-button" data-service-id="${escapeHtml(service.id)}">Editar informações</button>
      </div>
    </div>
  `;
}

function renderServiceForm(mode, service = null) {
  const isEdit = mode === 'edit';
  const safeService = service || {
    name: '',
    icon: '✂️',
    durationMinutes: 30,
    barbers: [],
    price: 40,
    monthlySales: 0,
    active: true,
  };

  return `
    <div class="svc-modal-body">
      <div>
        <div class="modal-title" style="margin:0;">${isEdit ? 'Editar serviço' : 'Novo serviço'}</div>
        <div class="modal-sub" style="margin-top:4px;">
          ${isEdit ? 'Atualize os dados do serviço.' : 'Preencha os dados para cadastrar um novo serviço.'}
        </div>
      </div>

      <form id="service-form" class="svc-form">
        <div class="svc-form-grid">
          <div>
            <div class="color-section-label">Nome</div>
            <input class="modal-input" name="name" type="text" value="${escapeHtml(safeService.name)}" placeholder="Nome do serviço" />
          </div>

          <div>
            <div class="color-section-label">Ícone</div>
            <input class="modal-input" name="icon" type="text" value="${escapeHtml(safeService.icon)}" placeholder="Ex.: ✂️" />
          </div>

          <div>
            <div class="color-section-label">Duração (min)</div>
            <input class="modal-input" name="durationMinutes" type="number" min="5" step="5" value="${escapeHtml(safeService.durationMinutes)}" />
          </div>

          <div>
            <div class="color-section-label">Preço</div>
            <input class="modal-input" name="price" type="number" min="1" step="1" value="${escapeHtml(safeService.price)}" />
          </div>

          <div>
            <div class="color-section-label">Vendas no mês</div>
            <input class="modal-input" name="monthlySales" type="number" min="0" step="1" value="${escapeHtml(safeService.monthlySales)}" />
          </div>

          <div>
            <div class="color-section-label">Status</div>
            <select class="modal-input" name="active">
              <option value="true" ${safeService.active ? 'selected' : ''}>Ativo</option>
              <option value="false" ${!safeService.active ? 'selected' : ''}>Inativo</option>
            </select>
          </div>
        </div>

        <div>
          <div class="color-section-label">Barbeiros</div>
          <textarea class="modal-input svc-textarea" name="barbers" placeholder="Separe por vírgula">${escapeHtml(safeService.barbers.join(', '))}</textarea>
        </div>

        <div id="service-form-feedback" class="svc-form-feedback"></div>

        <div class="modal-buttons" style="margin-top:10px;">
          <button type="button" class="btn-cancel" id="${isEdit ? 'service-form-back' : 'service-form-cancel'}">
            ${isEdit ? 'Voltar' : 'Cancelar'}
          </button>
          <button type="submit" class="btn-save">
            ${isEdit ? 'Salvar alterações' : 'Cadastrar serviço'}
          </button>
        </div>
      </form>
    </div>
  `;
}

function setServiceFormFeedback(message, variant = 'neutral') {
  const el = document.getElementById('service-form-feedback');
  if (!el) return;

  el.textContent = message || '';
  el.style.color =
    variant === 'error' ? '#ff8a8a' :
    variant === 'success' ? '#00e676' :
    '#5a6888';
}

function openServiceModal(serviceId) {
  servicosState.activeServiceId = serviceId;
  servicosState.modalMode = 'view';
  renderServiceModal();
}

function openCreateServiceModal() {
  servicosState.activeServiceId = null;
  servicosState.modalMode = 'create';
  renderServiceModal();
}

function openEditServiceModal(serviceId) {
  servicosState.activeServiceId = serviceId;
  servicosState.modalMode = 'edit';
  renderServiceModal();
}

function closeServiceModal() {
  const modal = document.getElementById('service-details-modal');
  const content = document.getElementById('service-details-content');
  if (!modal) return;

  servicosState.modalMode = 'closed';
  servicosState.activeServiceId = null;
  modal.classList.remove('open');
  modal.style.display = 'none';

  if (content) content.innerHTML = '';
}

function collectServiceFormData() {
  const form = document.getElementById('service-form');
  const formData = new FormData(form);

  return {
    name: String(formData.get('name') || '').trim(),
    icon: String(formData.get('icon') || '✂️').trim() || '✂️',
    durationMinutes: Number(formData.get('durationMinutes') || 30),
    price: Number(formData.get('price') || 0),
    monthlySales: Number(formData.get('monthlySales') || 0),
    active: String(formData.get('active') || 'true') === 'true',
    barbers: String(formData.get('barbers') || '')
      .split(',')
      .map((item) => item.trim())
      .filter(Boolean),
  };
}

function handleServiceFormSubmit(event) {
  event.preventDefault();

  const data = collectServiceFormData();

  if (!data.name) {
    setServiceFormFeedback('Informe o nome do serviço.', 'error');
    return;
  }

  if (data.price <= 0) {
    setServiceFormFeedback('Informe um preço válido.', 'error');
    return;
  }

  if (data.durationMinutes <= 0) {
    setServiceFormFeedback('Informe uma duração válida.', 'error');
    return;
  }

  if (!data.barbers.length) {
    setServiceFormFeedback('Informe ao menos um barbeiro ou "Todos os barbeiros".', 'error');
    return;
  }

  if (servicosState.modalMode === 'create') {
    const newService = {
      id: normalizeServiceId(data.name),
      ...data,
    };

    servicosState.items = [newService, ...servicosState.items];
    rerenderServicos();
    openServiceModal(newService.id);
    return;
  }

  if (servicosState.modalMode === 'edit' && servicosState.activeServiceId) {
    servicosState.items = servicosState.items.map((item) => {
      if (item.id !== servicosState.activeServiceId) return item;
      return { ...item, ...data };
    });

    rerenderServicos();
    openServiceModal(servicosState.activeServiceId);
  }
}

function renderServiceModal() {
  const modal = document.getElementById('service-details-modal');
  const content = document.getElementById('service-details-content');
  if (!modal || !content) return;

  if (servicosState.modalMode === 'closed') {
    modal.classList.remove('open');
    modal.style.display = 'none';
    content.innerHTML = '';
    return;
  }

  const service = servicosState.activeServiceId ? getServiceById(servicosState.activeServiceId) : null;

  if ((servicosState.modalMode === 'view' || servicosState.modalMode === 'edit') && !service) {
    closeServiceModal();
    return;
  }

  if (servicosState.modalMode === 'view') {
    content.innerHTML = renderServiceDetails(service);
  }

  if (servicosState.modalMode === 'edit') {
    content.innerHTML = renderServiceForm('edit', service);
  }

  if (servicosState.modalMode === 'create') {
    content.innerHTML = renderServiceForm('create');
  }

  modal.style.display = 'flex';
  modal.classList.add('open');

  bindServiceModalEvents();
}

function bindServiceModalEvents() {
  document.getElementById('service-modal-close')?.addEventListener('click', closeServiceModal);

  document.getElementById('service-edit-button')?.addEventListener('click', () => {
    if (!servicosState.activeServiceId) return;
    openEditServiceModal(servicosState.activeServiceId);
  });

  document.getElementById('service-form-back')?.addEventListener('click', () => {
    if (!servicosState.activeServiceId) return;
    openServiceModal(servicosState.activeServiceId);
  });

  document.getElementById('service-form-cancel')?.addEventListener('click', closeServiceModal);

  document.getElementById('service-form')?.addEventListener('submit', handleServiceFormSubmit);
}

function bindServicosListEvents() {
  document.querySelectorAll('.svc-row-button[data-service-id]').forEach((button) => {
    button.addEventListener('click', () => {
      openServiceModal(button.dataset.serviceId);
    });
  });
}

function bindServicosStaticEvents() {
  document.getElementById('service-new-button')?.addEventListener('click', openCreateServiceModal);

  document.getElementById('service-details-modal')?.addEventListener('click', (event) => {
    if (event.target?.id === 'service-details-modal') {
      closeServiceModal();
    }
  });
}

function rerenderServicos() {
  const list = document.getElementById('services-list');
  const top = document.getElementById('services-top-selling');

  if (list) {
    list.innerHTML = servicosState.items.map(renderServiceRow).join('');
    bindServicosListEvents();
  }

  if (top) {
    top.innerHTML = renderTopSellingServices();
  }
}

export function renderServicos() {
  return /* html */ `
<section class="page-shell page--servicos">
  <div class="grid-2">
    <div class="card">
      <div class="card-header">
        <div class="card-title">Serviços Cadastrados</div>
        <button type="button" class="card-action" id="service-new-button">+ Novo serviço</button>
      </div>

      <div id="services-list">
        ${servicosState.items.map(renderServiceRow).join('')}
      </div>
    </div>

    <div class="card">
      <div class="card-header">
        <div class="card-title">Mais Vendidos</div>
      </div>

      <div id="services-top-selling">
        ${renderTopSellingServices()}
      </div>
    </div>
  </div>

  <div id="service-details-modal" class="modal-overlay" style="display:none;">
    <div class="modal" style="width:min(92vw, 560px);">
      <div id="service-details-content"></div>
    </div>
  </div>
</section>
  `;
}

export function initServicosPage() {
  bindServicosListEvents();
  bindServicosStaticEvents();
}
