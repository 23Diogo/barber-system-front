import { apiFetch } from '../services/api.js';

// ─── State ────────────────────────────────────────────────────────────────────

const servicosState = {
  items: [],
  isLoading: false,
  isLoaded: false,
  modalMode: 'closed', // closed | view | edit | create
  activeServiceId: null,
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

function formatCurrency(value) {
  return new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL',
    maximumFractionDigits: 0,
  }).format(Number(value || 0));
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

function getServiceById(id) {
  return servicosState.items.find(s => s.id === id) || null;
}

function getServiceStatusMeta(isActive) {
  return isActive
    ? { label: 'Ativo',   color: '#00e676', bg: 'rgba(0,230,118,.1)',    border: 'rgba(0,230,118,.18)' }
    : { label: 'Inativo', color: '#ff6b81', bg: 'rgba(255,107,129,.1)',  border: 'rgba(255,107,129,.18)' };
}

function getCategoryIcon(category) {
  const map = {
    corte: '✂️', barba: '🪒', combo: '✂️', coloracao: '🎨',
    estetica: '✨', tratamento: '💆', acabamento: '💈',
  };
  const key = String(category || '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
  return Object.entries(map).find(([k]) => key.includes(k))?.[1] || '✂️';
}

// ─── Render rows ──────────────────────────────────────────────────────────────

function renderServiceRow(service) {
  const meta = getServiceStatusMeta(service.is_active);
  const icon = getCategoryIcon(service.category);
  const detail = `${service.duration_min || 0} min${service.category ? ` · ${service.category}` : ''}`;

  return `
    <button type="button" class="svc-row-button"
      data-service-id="${escapeHtml(service.id)}"
      title="Ver detalhes de ${escapeHtml(service.name)}">
      <div class="svc-row">
        <div class="svc-icon">${icon}</div>
        <div class="svc-info">
          <div class="svc-name">${escapeHtml(service.name)}</div>
          <div class="svc-detail">${escapeHtml(detail)}</div>
        </div>
        <div class="svc-side">
          <div class="svc-status-badge" style="background:${meta.bg};color:${meta.color};border:1px solid ${meta.border};">
            ${meta.label}
          </div>
          <div class="svc-price">${escapeHtml(formatCurrency(service.price))}</div>
        </div>
      </div>
    </button>
  `;
}

function renderTopSellingServices() {
  const active = servicosState.items.filter(s => s.is_active);

  if (!active.length) {
    return '<div class="row-sub" style="padding:10px 2px;">Nenhum serviço ativo cadastrado.</div>';
  }

  // Ordena por preço como proxy de popularidade (sem dado real de vendas)
  const top = [...active].sort((a, b) => Number(b.price || 0) - Number(a.price || 0)).slice(0, 3);
  const maxPrice = Math.max(...top.map(s => Number(s.price || 0)), 1);

  return top.map((service, index) => {
    const width = Math.max((Number(service.price || 0) / maxPrice) * 100, 12);
    const icon = getCategoryIcon(service.category);

    return `
      <div class="row-item">
        <div class="svc-top-icon">${icon}</div>
        <div class="row-info">
          <div class="row-name">${escapeHtml(service.name)}</div>
          <div class="row-sub">${escapeHtml(`${service.duration_min || 0} min`)}</div>
          <div class="row-prog"><div class="row-fill" style="width:${width}%"></div></div>
        </div>
        <div class="row-value">${escapeHtml(formatCurrency(service.price))}</div>
      </div>
    `;
  }).join('');
}

// ─── Modal renders ────────────────────────────────────────────────────────────

function renderServiceDetails(service) {
  const meta = getServiceStatusMeta(service.is_active);
  const icon = getCategoryIcon(service.category);

  return `
    <div class="svc-modal-body">
      <div class="svc-modal-header">
        <div class="svc-modal-icon">${icon}</div>
        <div>
          <div class="modal-title" style="margin:0;">${escapeHtml(service.name)}</div>
          <div class="modal-sub" style="margin-top:4px;">${escapeHtml(`${service.duration_min || 0} min${service.category ? ` · ${service.category}` : ''}`)}</div>
        </div>
      </div>

      <div class="svc-modal-grid">
        <div class="mini-card">
          <div class="mini-lbl">Preço</div>
          <div class="mini-val" style="color:#4fc3f7">${escapeHtml(formatCurrency(service.price))}</div>
        </div>
        <div class="mini-card">
          <div class="mini-lbl">Duração</div>
          <div class="mini-val" style="color:#9c6fff">${escapeHtml(service.duration_min || 0)} min</div>
        </div>
        <div class="mini-card">
          <div class="mini-lbl">Categoria</div>
          <div class="mini-val" style="font-size:14px;">${escapeHtml(service.category || '—')}</div>
        </div>
        <div class="mini-card">
          <div class="mini-lbl">Status</div>
          <div class="mini-val" style="font-size:16px;color:${meta.color}">${escapeHtml(meta.label)}</div>
        </div>
      </div>

      ${service.description ? `
        <div class="svc-modal-info">
          <div class="svc-modal-info-row"><strong>Descrição:</strong> ${escapeHtml(service.description)}</div>
        </div>
      ` : ''}

      <div id="service-modal-feedback" class="svc-form-feedback"></div>

      <div class="modal-buttons" style="margin-top:10px;">
        <button type="button" class="btn-cancel" id="service-modal-close">Fechar</button>
        <button type="button" class="btn-secondary" id="service-toggle-btn"
          data-service-id="${escapeHtml(service.id)}"
          data-is-active="${escapeHtml(service.is_active)}"
          style="background:rgba(255,107,129,.1);color:#ff6b81;border:1px solid rgba(255,107,129,.2);">
          ${service.is_active ? 'Desativar' : 'Ativar'}
        </button>
        <button type="button" class="btn-save" id="service-edit-button" data-service-id="${escapeHtml(service.id)}">
          Editar
        </button>
      </div>
    </div>
  `;
}

function renderServiceForm(mode, service = null) {
  const isEdit = mode === 'edit';
  const s = service || {};

  return `
    <div class="svc-modal-body">
      <div>
        <div class="modal-title" style="margin:0;">${isEdit ? 'Editar serviço' : 'Novo serviço'}</div>
        <div class="modal-sub" style="margin-top:4px;">${isEdit ? 'Atualize os dados do serviço.' : 'Preencha os dados para cadastrar um serviço.'}</div>
      </div>

      <form id="service-form" class="svc-form">
        <div class="svc-form-grid">
          <div>
            <div class="color-section-label">Nome</div>
            <input class="modal-input" name="name" type="text" value="${escapeHtml(s.name || '')}" placeholder="Ex: Corte simples" />
          </div>
          <div>
            <div class="color-section-label">Categoria</div>
            <input class="modal-input" name="category" type="text" value="${escapeHtml(s.category || '')}" placeholder="Ex: Corte, Barba, Combo..." />
          </div>
          <div>
            <div class="color-section-label">Duração (min)</div>
            <input class="modal-input" name="duration_min" type="number" min="5" step="5" value="${escapeHtml(s.duration_min ?? 30)}" />
          </div>
          <div>
            <div class="color-section-label">Preço (R$)</div>
            <input class="modal-input" name="price" type="number" min="0" step="1" value="${escapeHtml(s.price ?? 0)}" />
          </div>
          <div>
            <div class="color-section-label">Ordem de exibição</div>
            <input class="modal-input" name="sort_order" type="number" min="0" step="1" value="${escapeHtml(s.sort_order ?? 0)}" />
          </div>
          <div>
            <div class="color-section-label">Status</div>
            <select class="modal-input" name="is_active">
              <option value="true" ${s.is_active !== false ? 'selected' : ''}>Ativo</option>
              <option value="false" ${s.is_active === false ? 'selected' : ''}>Inativo</option>
            </select>
          </div>
        </div>

        <div>
          <div class="color-section-label">Descrição</div>
          <textarea class="modal-input svc-textarea" name="description" placeholder="Descrição opcional do serviço">${escapeHtml(s.description || '')}</textarea>
        </div>

        <div id="service-form-feedback" class="svc-form-feedback"></div>

        <div class="modal-buttons" style="margin-top:10px;">
          <button type="button" class="btn-cancel" id="${isEdit ? 'service-form-back' : 'service-form-cancel'}">
            ${isEdit ? 'Voltar' : 'Cancelar'}
          </button>
          <button type="submit" class="btn-save">${isEdit ? 'Salvar alterações' : 'Cadastrar serviço'}</button>
        </div>
      </form>
    </div>
  `;
}

// ─── Modal control ────────────────────────────────────────────────────────────

function openServiceModal(id) {
  servicosState.activeServiceId = id;
  servicosState.modalMode = 'view';
  renderServiceModal();
}

function openCreateServiceModal() {
  servicosState.activeServiceId = null;
  servicosState.modalMode = 'create';
  renderServiceModal();
}

function openEditServiceModal(id) {
  servicosState.activeServiceId = id;
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

function renderServiceModal() {
  const modal = document.getElementById('service-details-modal');
  const content = document.getElementById('service-details-content');
  if (!modal || !content) return;

  if (servicosState.modalMode === 'closed') {
    modal.style.display = 'none';
    modal.classList.remove('open');
    content.innerHTML = '';
    return;
  }

  const service = servicosState.activeServiceId ? getServiceById(servicosState.activeServiceId) : null;

  if (servicosState.modalMode === 'view') {
    if (!service) { closeServiceModal(); return; }
    content.innerHTML = renderServiceDetails(service);
  }

  if (servicosState.modalMode === 'edit') {
    if (!service) { closeServiceModal(); return; }
    content.innerHTML = renderServiceForm('edit', service);
  }

  if (servicosState.modalMode === 'create') {
    content.innerHTML = renderServiceForm('create');
  }

  modal.style.display = 'flex';
  modal.classList.add('open');
  bindServiceModalEvents();
}

// ─── API calls ────────────────────────────────────────────────────────────────

async function loadServicosData() {
  servicosState.isLoading = true;
  rerenderServicos();

  try {
    const data = await apiFetch('/api/services');
    servicosState.items = Array.isArray(data) ? data : [];
    servicosState.isLoaded = true;
  } catch (error) {
    console.error('Erro ao carregar serviços:', error);
  } finally {
    servicosState.isLoading = false;
    rerenderServicos();
  }
}

async function handleCreateService(event) {
  event.preventDefault();
  const form = document.getElementById('service-form');
  const formData = new FormData(form);
  const btn = form.querySelector('button[type="submit"]');

  const name = String(formData.get('name') || '').trim();
  const price = Number(formData.get('price') || 0);
  const duration_min = Number(formData.get('duration_min') || 30);

  if (!name) { setFeedback('service-form-feedback', 'Informe o nome do serviço.', 'error'); return; }
  if (price <= 0) { setFeedback('service-form-feedback', 'Informe um preço válido.', 'error'); return; }
  if (duration_min <= 0) { setFeedback('service-form-feedback', 'Informe uma duração válida.', 'error'); return; }

  try {
    if (btn) btn.disabled = true;
    setFeedback('service-form-feedback', 'Salvando...', 'neutral');

    await apiFetch('/api/services', {
      method: 'POST',
      body: JSON.stringify({
        name,
        price,
        duration_min,
        category: String(formData.get('category') || '').trim() || null,
        description: String(formData.get('description') || '').trim() || null,
        sort_order: Number(formData.get('sort_order') || 0),
        is_active: String(formData.get('is_active')) === 'true',
      }),
    });

    closeServiceModal();
    await loadServicosData();
  } catch (error) {
    setFeedback('service-form-feedback', error instanceof Error ? error.message : 'Erro ao salvar.', 'error');
    if (btn) btn.disabled = false;
  }
}

async function handleEditService(event) {
  event.preventDefault();
  const form = document.getElementById('service-form');
  const formData = new FormData(form);
  const btn = form.querySelector('button[type="submit"]');
  const serviceId = servicosState.activeServiceId;

  const name = String(formData.get('name') || '').trim();
  if (!name) { setFeedback('service-form-feedback', 'Informe o nome do serviço.', 'error'); return; }

  try {
    if (btn) btn.disabled = true;
    setFeedback('service-form-feedback', 'Salvando...', 'neutral');

    await apiFetch(`/api/services/${serviceId}`, {
      method: 'PATCH',
      body: JSON.stringify({
        name,
        price: Number(formData.get('price') || 0),
        duration_min: Number(formData.get('duration_min') || 30),
        category: String(formData.get('category') || '').trim() || null,
        description: String(formData.get('description') || '').trim() || null,
        sort_order: Number(formData.get('sort_order') || 0),
        is_active: String(formData.get('is_active')) === 'true',
      }),
    });

    closeServiceModal();
    await loadServicosData();
  } catch (error) {
    setFeedback('service-form-feedback', error instanceof Error ? error.message : 'Erro ao salvar.', 'error');
    if (btn) btn.disabled = false;
  }
}

async function handleToggleService(serviceId, isActive) {
  try {
    setFeedback('service-modal-feedback', 'Atualizando...', 'neutral');

    await apiFetch(`/api/services/${serviceId}`, {
      method: 'PATCH',
      body: JSON.stringify({ is_active: !isActive }),
    });

    closeServiceModal();
    await loadServicosData();
  } catch (error) {
    setFeedback('service-modal-feedback', error instanceof Error ? error.message : 'Erro ao atualizar.', 'error');
  }
}

// ─── Events ───────────────────────────────────────────────────────────────────

function bindServiceModalEvents() {
  document.getElementById('service-modal-close')?.addEventListener('click', closeServiceModal);
  document.getElementById('service-form-cancel')?.addEventListener('click', closeServiceModal);

  document.getElementById('service-form-back')?.addEventListener('click', () => {
    if (servicosState.activeServiceId) openServiceModal(servicosState.activeServiceId);
  });

  document.getElementById('service-edit-button')?.addEventListener('click', (e) => {
    const id = e.currentTarget.dataset.serviceId;
    if (id) openEditServiceModal(id);
  });

  document.getElementById('service-toggle-btn')?.addEventListener('click', (e) => {
    const id = e.currentTarget.dataset.serviceId;
    const isActive = e.currentTarget.dataset.isActive === 'true';
    if (id) handleToggleService(id, isActive);
  });

  const form = document.getElementById('service-form');
  if (form) {
    if (servicosState.modalMode === 'create') {
      form.addEventListener('submit', handleCreateService);
    } else if (servicosState.modalMode === 'edit') {
      form.addEventListener('submit', handleEditService);
    }
  }
}

function bindServicosListEvents() {
  document.querySelectorAll('.svc-row-button[data-service-id]').forEach((btn) => {
    btn.addEventListener('click', () => openServiceModal(btn.dataset.serviceId));
  });
}

function bindServicosStaticEvents() {
  document.getElementById('service-new-button')?.addEventListener('click', openCreateServiceModal);

  document.getElementById('service-details-modal')?.addEventListener('click', (e) => {
    if (e.target?.id === 'service-details-modal') closeServiceModal();
  });
}

// ─── Render ───────────────────────────────────────────────────────────────────

function rerenderServicos() {
  const list = document.getElementById('services-list');
  const top = document.getElementById('services-top-selling');

  if (servicosState.isLoading) {
    if (list) list.innerHTML = `<div class="finance-empty">Carregando serviços...</div>`;
    return;
  }

  if (list) {
    list.innerHTML = servicosState.items.length
      ? servicosState.items.map(renderServiceRow).join('')
      : `<div class="finance-empty">Nenhum serviço cadastrado.</div>`;
    bindServicosListEvents();
  }

  if (top) top.innerHTML = renderTopSellingServices();
}

export function renderServicos() {
  return /* html */ `
<section class="page-shell page--servicos">
  <div class="grid-2">
    <div class="card">
      <div class="card-header">
        <div class="card-title">Serviços Cadastrados</div>
        <button type="button" class="btn-primary-gradient" id="service-new-button">+ Novo serviço</button>
      </div>
      <div id="services-list">
        <div class="finance-empty">Carregando...</div>
      </div>
    </div>

    <div class="card">
      <div class="card-header">
        <div class="card-title">Mais Vendidos</div>
      </div>
      <div id="services-top-selling">
        <div class="finance-empty">Carregando...</div>
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
  bindServicosStaticEvents();
  loadServicosData();
}
