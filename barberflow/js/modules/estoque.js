import { apiFetch } from '../services/api.js';

// ─── State ────────────────────────────────────────────────────────────────────

const estoqueState = {
  products: [],
  isLoading: false,
  isLoaded: false,
  modalMode: 'closed', // closed | view | edit | create | movement
  activeProductId: null,
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

function formatNumber(value) {
  return new Intl.NumberFormat('pt-BR', {
    minimumFractionDigits: Number(value) % 1 === 0 ? 0 : 1,
    maximumFractionDigits: 1,
  }).format(Number(value || 0));
}

function formatCurrency(value) {
  return new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL',
    maximumFractionDigits: 0,
  }).format(Number(value || 0));
}

function formatCompactCurrency(value) {
  const abs = Math.abs(Number(value || 0));
  if (abs >= 1000) return `R$${(abs / 1000).toFixed(1)}k`;
  return formatCurrency(abs);
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

function getProductById(id) {
  return estoqueState.products.find(p => p.id === id) || null;
}

function getProductMeta(product) {
  const current = Number(product.current_stock || 0);
  const min = Math.max(Number(product.min_stock || 0), 1);

  if (current < min * 0.3) return { color: '#ff1744', border: '#ff1744', label: 'Crítico' };
  if (current < min)       return { color: '#f97316', border: '#f97316', label: 'Baixo' };
  return                          { color: '#00e676', border: '#00e676', label: 'Normal' };
}

function getSortedProducts() {
  return [...estoqueState.products].sort((a, b) => {
    const ratioA = Number(a.current_stock || 0) / Math.max(Number(a.min_stock || 1), 1);
    const ratioB = Number(b.current_stock || 0) / Math.max(Number(b.min_stock || 1), 1);
    return ratioA - ratioB;
  });
}

function getSummary() {
  const total = estoqueState.products.length;
  const belowMin = estoqueState.products.filter(p => Number(p.current_stock || 0) < Number(p.min_stock || 0)).length;
  const normal = total - belowMin;
  const stockValue = estoqueState.products.reduce((sum, p) => sum + (Number(p.current_stock || 0) * Number(p.cost_price || 0)), 0);

  return { total, belowMin, normal, stockValue };
}

// ─── Render rows ──────────────────────────────────────────────────────────────

function renderStockRow(product) {
  const meta = getProductMeta(product);
  const current = Number(product.current_stock || 0);
  const min = Number(product.min_stock || 0);
  const unit = product.unit || 'un';

  const detail = current < min
    ? `${formatNumber(current)} ${unit} restantes · Mín: ${formatNumber(min)} ${unit}`
    : `Normal · ${formatNumber(current)} ${unit}`;

  return `
    <button type="button" class="estoque-row-button"
      data-product-id="${escapeHtml(product.id)}"
      title="Ver detalhes de ${escapeHtml(product.name)}">
      <div class="fin-row" style="border-color:${meta.border}">
        <div class="fin-icon">📦</div>
        <div class="fin-info">
          <div class="fin-title">${escapeHtml(product.name)}</div>
          <div class="fin-date">${escapeHtml(detail)}${product.brand ? ` · ${escapeHtml(product.brand)}` : ''}</div>
        </div>
        <div class="fin-val" style="color:${meta.color}">${escapeHtml(formatNumber(current))} ${escapeHtml(unit)}</div>
      </div>
    </button>
  `;
}

function renderSummaryCards() {
  const s = getSummary();

  return `
    <div class="estoque-summary-grid">
      <div class="mini-card">
        <div class="mini-val">${escapeHtml(s.total)}</div>
        <div class="mini-lbl">Produtos cadastrados</div>
      </div>
      <div class="mini-card">
        <div class="mini-val" style="color:#ff1744">${escapeHtml(s.belowMin)}</div>
        <div class="mini-lbl">Abaixo do mínimo</div>
      </div>
      <div class="mini-card">
        <div class="mini-val" style="color:#4fc3f7">${escapeHtml(formatCompactCurrency(s.stockValue))}</div>
        <div class="mini-lbl">Valor em estoque</div>
      </div>
      <div class="mini-card">
        <div class="mini-val" style="color:#00e676">${escapeHtml(s.normal)}</div>
        <div class="mini-lbl">Em nível normal</div>
      </div>
    </div>
  `;
}

// ─── Modal renders ────────────────────────────────────────────────────────────

function renderProductDetails(product) {
  const meta = getProductMeta(product);
  const unit = product.unit || 'un';

  return `
    <div class="estoque-modal-body">
      <div>
        <div class="modal-title" style="margin:0;">${escapeHtml(product.name)}</div>
        <div class="modal-sub" style="margin-top:4px;">Detalhes do produto</div>
      </div>

      <div class="estoque-modal-grid">
        <div class="mini-card">
          <div class="mini-lbl">Estoque atual</div>
          <div class="mini-val" style="color:${meta.color}">${escapeHtml(formatNumber(product.current_stock))} ${escapeHtml(unit)}</div>
        </div>
        <div class="mini-card">
          <div class="mini-lbl">Estoque mínimo</div>
          <div class="mini-val" style="font-size:15px;">${escapeHtml(formatNumber(product.min_stock))} ${escapeHtml(unit)}</div>
        </div>
        <div class="mini-card">
          <div class="mini-lbl">Custo</div>
          <div class="mini-val" style="font-size:15px;">${escapeHtml(formatCurrency(product.cost_price))}</div>
        </div>
        <div class="mini-card">
          <div class="mini-lbl">Status</div>
          <div class="mini-val" style="font-size:15px;color:${meta.color}">${escapeHtml(meta.label)}</div>
        </div>
      </div>

      <div class="estoque-modal-info">
        ${product.brand ? `<div class="estoque-modal-info-row"><strong>Marca:</strong> ${escapeHtml(product.brand)}</div>` : ''}
        ${product.category ? `<div class="estoque-modal-info-row"><strong>Categoria:</strong> ${escapeHtml(product.category)}</div>` : ''}
        <div class="estoque-modal-info-row">
          <strong>Valor em estoque:</strong> ${escapeHtml(formatCurrency(Number(product.current_stock || 0) * Number(product.cost_price || 0)))}
        </div>
        ${product.description ? `<div class="estoque-modal-info-row"><strong>Descrição:</strong> ${escapeHtml(product.description)}</div>` : ''}
      </div>

      <div id="estoque-modal-feedback" class="estoque-form-feedback"></div>

      <div class="modal-buttons" style="margin-top:10px;">
        <button type="button" class="btn-cancel" id="estoque-modal-close">Fechar</button>
        <button type="button" class="btn-secondary" id="estoque-movement-btn" data-product-id="${escapeHtml(product.id)}" style="background:rgba(79,195,247,.12);color:#4fc3f7;border:1px solid rgba(79,195,247,.2);">
          Movimentar estoque
        </button>
        <button type="button" class="btn-save" id="estoque-edit-button" data-product-id="${escapeHtml(product.id)}">
          Editar produto
        </button>
      </div>
    </div>
  `;
}

function renderProductForm(mode, product = null) {
  const isEdit = mode === 'edit';
  const p = product || {};

  return `
    <div class="estoque-modal-body">
      <div>
        <div class="modal-title" style="margin:0;">${isEdit ? 'Editar produto' : 'Novo produto'}</div>
        <div class="modal-sub" style="margin-top:4px;">${isEdit ? 'Atualize os dados do produto.' : 'Preencha os dados para cadastrar um produto.'}</div>
      </div>

      <form id="estoque-form" class="estoque-form">
        <div class="estoque-form-grid">
          <div>
            <div class="color-section-label">Nome do produto</div>
            <input class="modal-input" name="name" type="text" value="${escapeHtml(p.name || '')}" placeholder="Ex: Pomada Dapper Dan" />
          </div>
          <div>
            <div class="color-section-label">Marca</div>
            <input class="modal-input" name="brand" type="text" value="${escapeHtml(p.brand || '')}" placeholder="Ex: Dapper Dan" />
          </div>
          <div>
            <div class="color-section-label">Categoria</div>
            <input class="modal-input" name="category" type="text" value="${escapeHtml(p.category || '')}" placeholder="Ex: Pomada, Lâmina..." />
          </div>
          <div>
            <div class="color-section-label">Unidade</div>
            <select class="modal-input" name="unit">
              <option value="un" ${(p.unit || 'un') === 'un' ? 'selected' : ''}>Unidade</option>
              <option value="L" ${p.unit === 'L' ? 'selected' : ''}>Litro</option>
              <option value="ml" ${p.unit === 'ml' ? 'selected' : ''}>Mililitro</option>
              <option value="cx" ${p.unit === 'cx' ? 'selected' : ''}>Caixa</option>
              <option value="kg" ${p.unit === 'kg' ? 'selected' : ''}>Quilograma</option>
            </select>
          </div>
          <div>
            <div class="color-section-label">Estoque atual</div>
            <input class="modal-input" name="current_stock" type="number" min="0" step="0.1" value="${escapeHtml(p.current_stock ?? 0)}" />
          </div>
          <div>
            <div class="color-section-label">Estoque mínimo</div>
            <input class="modal-input" name="min_stock" type="number" min="0" step="0.1" value="${escapeHtml(p.min_stock ?? 0)}" />
          </div>
          <div>
            <div class="color-section-label">Preço de custo (R$)</div>
            <input class="modal-input" name="cost_price" type="number" min="0" step="0.01" value="${escapeHtml(p.cost_price ?? 0)}" />
          </div>
          <div>
            <div class="color-section-label">Preço de venda (R$)</div>
            <input class="modal-input" name="sale_price" type="number" min="0" step="0.01" value="${escapeHtml(p.sale_price ?? 0)}" />
          </div>
        </div>

        <div>
          <div class="color-section-label">Descrição</div>
          <textarea class="modal-input estoque-textarea" name="description" placeholder="Descrição opcional">${escapeHtml(p.description || '')}</textarea>
        </div>

        <div id="estoque-form-feedback" class="estoque-form-feedback"></div>

        <div class="modal-buttons" style="margin-top:10px;">
          <button type="button" class="btn-cancel" id="${isEdit ? 'estoque-form-back' : 'estoque-form-cancel'}">
            ${isEdit ? 'Voltar' : 'Cancelar'}
          </button>
          <button type="submit" class="btn-save">${isEdit ? 'Salvar alterações' : 'Cadastrar produto'}</button>
        </div>
      </form>
    </div>
  `;
}

function renderMovementForm(product) {
  return `
    <div class="estoque-modal-body">
      <div>
        <div class="modal-title" style="margin:0;">Movimentar estoque</div>
        <div class="modal-sub" style="margin-top:4px;">${escapeHtml(product.name)} · Atual: ${escapeHtml(formatNumber(product.current_stock))} ${escapeHtml(product.unit || 'un')}</div>
      </div>

      <form id="estoque-movement-form" class="estoque-form">
        <div class="estoque-form-grid">
          <div>
            <div class="color-section-label">Tipo</div>
            <select class="modal-input" name="type">
              <option value="in">Entrada</option>
              <option value="out">Saída</option>
              <option value="adjustment">Ajuste</option>
            </select>
          </div>
          <div>
            <div class="color-section-label">Quantidade</div>
            <input class="modal-input" name="quantity" type="number" min="0" step="0.1" placeholder="0" />
          </div>
          <div>
            <div class="color-section-label">Custo unitário (R$)</div>
            <input class="modal-input" name="unit_cost" type="number" min="0" step="0.01" value="${escapeHtml(product.cost_price ?? 0)}" />
          </div>
        </div>

        <div>
          <div class="color-section-label">Observações</div>
          <textarea class="modal-input estoque-textarea" name="notes" placeholder="Motivo da movimentação"></textarea>
        </div>

        <div id="estoque-form-feedback" class="estoque-form-feedback"></div>

        <div class="modal-buttons" style="margin-top:10px;">
          <button type="button" class="btn-cancel" id="estoque-movement-back">Voltar</button>
          <button type="submit" class="btn-save">Registrar</button>
        </div>
      </form>
    </div>
  `;
}

// ─── Modal control ────────────────────────────────────────────────────────────

function openProductModal(id) {
  estoqueState.activeProductId = id;
  estoqueState.modalMode = 'view';
  renderEstoqueModal();
}

function openCreateProductModal() {
  estoqueState.activeProductId = null;
  estoqueState.modalMode = 'create';
  renderEstoqueModal();
}

function openEditProductModal(id) {
  estoqueState.activeProductId = id;
  estoqueState.modalMode = 'edit';
  renderEstoqueModal();
}

function openMovementModal(id) {
  estoqueState.activeProductId = id;
  estoqueState.modalMode = 'movement';
  renderEstoqueModal();
}

function closeEstoqueModal() {
  const modal = document.getElementById('estoque-details-modal');
  const content = document.getElementById('estoque-details-content');
  if (!modal) return;

  estoqueState.modalMode = 'closed';
  estoqueState.activeProductId = null;
  modal.classList.remove('open');
  modal.style.display = 'none';
  if (content) content.innerHTML = '';
}

function renderEstoqueModal() {
  const modal = document.getElementById('estoque-details-modal');
  const content = document.getElementById('estoque-details-content');
  if (!modal || !content) return;

  if (estoqueState.modalMode === 'closed') {
    modal.style.display = 'none';
    modal.classList.remove('open');
    content.innerHTML = '';
    return;
  }

  const product = estoqueState.activeProductId ? getProductById(estoqueState.activeProductId) : null;

  if (estoqueState.modalMode === 'view') {
    if (!product) { closeEstoqueModal(); return; }
    content.innerHTML = renderProductDetails(product);
  }

  if (estoqueState.modalMode === 'edit') {
    if (!product) { closeEstoqueModal(); return; }
    content.innerHTML = renderProductForm('edit', product);
  }

  if (estoqueState.modalMode === 'create') {
    content.innerHTML = renderProductForm('create');
  }

  if (estoqueState.modalMode === 'movement') {
    if (!product) { closeEstoqueModal(); return; }
    content.innerHTML = renderMovementForm(product);
  }

  modal.style.display = 'flex';
  modal.classList.add('open');
  bindEstoqueModalEvents();
}

// ─── API calls ────────────────────────────────────────────────────────────────

async function loadEstoqueData() {
  estoqueState.isLoading = true;
  rerenderEstoque();

  try {
    const data = await apiFetch('/api/stock');
    estoqueState.products = Array.isArray(data) ? data : [];
    estoqueState.isLoaded = true;
  } catch (error) {
    console.error('Erro ao carregar estoque:', error);
  } finally {
    estoqueState.isLoading = false;
    rerenderEstoque();
  }
}

async function handleCreateProduct(event) {
  event.preventDefault();
  const form = document.getElementById('estoque-form');
  const formData = new FormData(form);
  const btn = form.querySelector('button[type="submit"]');

  const name = String(formData.get('name') || '').trim();
  if (!name) { setFeedback('estoque-form-feedback', 'Informe o nome do produto.', 'error'); return; }

  try {
    if (btn) btn.disabled = true;
    setFeedback('estoque-form-feedback', 'Salvando...', 'neutral');

    await apiFetch('/api/stock', {
      method: 'POST',
      body: JSON.stringify({
        name,
        brand: String(formData.get('brand') || '').trim() || null,
        category: String(formData.get('category') || '').trim() || null,
        unit: String(formData.get('unit') || 'un'),
        current_stock: Number(formData.get('current_stock') || 0),
        min_stock: Number(formData.get('min_stock') || 0),
        cost_price: Number(formData.get('cost_price') || 0),
        sale_price: Number(formData.get('sale_price') || 0),
        description: String(formData.get('description') || '').trim() || null,
        is_active: true,
        is_for_sale: false,
      }),
    });

    closeEstoqueModal();
    await loadEstoqueData();
  } catch (error) {
    setFeedback('estoque-form-feedback', error instanceof Error ? error.message : 'Erro ao salvar.', 'error');
    if (btn) btn.disabled = false;
  }
}

async function handleEditProduct(event) {
  event.preventDefault();
  const form = document.getElementById('estoque-form');
  const formData = new FormData(form);
  const btn = form.querySelector('button[type="submit"]');
  const productId = estoqueState.activeProductId;

  const name = String(formData.get('name') || '').trim();
  if (!name) { setFeedback('estoque-form-feedback', 'Informe o nome do produto.', 'error'); return; }

  try {
    if (btn) btn.disabled = true;
    setFeedback('estoque-form-feedback', 'Salvando...', 'neutral');

    await apiFetch(`/api/stock/${productId}`, {
      method: 'PATCH',
      body: JSON.stringify({
        name,
        brand: String(formData.get('brand') || '').trim() || null,
        category: String(formData.get('category') || '').trim() || null,
        unit: String(formData.get('unit') || 'un'),
        min_stock: Number(formData.get('min_stock') || 0),
        cost_price: Number(formData.get('cost_price') || 0),
        sale_price: Number(formData.get('sale_price') || 0),
        description: String(formData.get('description') || '').trim() || null,
      }),
    });

    closeEstoqueModal();
    await loadEstoqueData();
  } catch (error) {
    setFeedback('estoque-form-feedback', error instanceof Error ? error.message : 'Erro ao salvar.', 'error');
    if (btn) btn.disabled = false;
  }
}

async function handleMovement(event) {
  event.preventDefault();
  const form = document.getElementById('estoque-movement-form');
  const formData = new FormData(form);
  const btn = form.querySelector('button[type="submit"]');
  const productId = estoqueState.activeProductId;

  const quantity = Number(formData.get('quantity') || 0);
  if (!quantity || quantity <= 0) {
    setFeedback('estoque-form-feedback', 'Informe uma quantidade válida.', 'error');
    return;
  }

  try {
    if (btn) btn.disabled = true;
    setFeedback('estoque-form-feedback', 'Registrando...', 'neutral');

    await apiFetch(`/api/stock/${productId}/movement`, {
      method: 'POST',
      body: JSON.stringify({
        type: String(formData.get('type') || 'in'),
        quantity,
        unit_cost: Number(formData.get('unit_cost') || 0) || null,
        notes: String(formData.get('notes') || '').trim() || null,
      }),
    });

    closeEstoqueModal();
    await loadEstoqueData();
  } catch (error) {
    setFeedback('estoque-form-feedback', error instanceof Error ? error.message : 'Erro ao registrar.', 'error');
    if (btn) btn.disabled = false;
  }
}

// ─── Events ───────────────────────────────────────────────────────────────────

function bindEstoqueModalEvents() {
  document.getElementById('estoque-modal-close')?.addEventListener('click', closeEstoqueModal);
  document.getElementById('estoque-form-cancel')?.addEventListener('click', closeEstoqueModal);
  document.getElementById('estoque-movement-back')?.addEventListener('click', () => {
    if (estoqueState.activeProductId) openProductModal(estoqueState.activeProductId);
  });

  document.getElementById('estoque-edit-button')?.addEventListener('click', (e) => {
    const id = e.currentTarget.dataset.productId;
    if (id) openEditProductModal(id);
  });

  document.getElementById('estoque-movement-btn')?.addEventListener('click', (e) => {
    const id = e.currentTarget.dataset.productId;
    if (id) openMovementModal(id);
  });

  document.getElementById('estoque-form-back')?.addEventListener('click', () => {
    if (estoqueState.activeProductId) openProductModal(estoqueState.activeProductId);
  });

  const productForm = document.getElementById('estoque-form');
  if (productForm) {
    if (estoqueState.modalMode === 'create') {
      productForm.addEventListener('submit', handleCreateProduct);
    } else if (estoqueState.modalMode === 'edit') {
      productForm.addEventListener('submit', handleEditProduct);
    }
  }

  document.getElementById('estoque-movement-form')?.addEventListener('submit', handleMovement);
}

function bindProductEvents() {
  document.querySelectorAll('.estoque-row-button[data-product-id]').forEach((btn) => {
    btn.addEventListener('click', () => openProductModal(btn.dataset.productId));
  });
}

function bindEstoqueStaticEvents() {
  document.getElementById('estoque-new-button')?.addEventListener('click', openCreateProductModal);

  document.getElementById('estoque-restock-all-button')?.addEventListener('click', async () => {
    const critical = estoqueState.products.filter(p => Number(p.current_stock || 0) < Number(p.min_stock || 0));
    if (!critical.length) return;

    try {
      await Promise.all(critical.map(p =>
        apiFetch(`/api/stock/${p.id}/movement`, {
          method: 'POST',
          body: JSON.stringify({
            type: 'adjustment',
            quantity: Number(p.min_stock || 0),
            notes: 'Reposição automática pelo painel',
          }),
        })
      ));
      await loadEstoqueData();
    } catch (error) {
      console.error('Erro ao repor estoque:', error);
    }
  });

  document.getElementById('estoque-details-modal')?.addEventListener('click', (e) => {
    if (e.target?.id === 'estoque-details-modal') closeEstoqueModal();
  });
}

// ─── Render ───────────────────────────────────────────────────────────────────

function rerenderEstoque() {
  const list = document.getElementById('estoque-products-list');
  const summary = document.getElementById('estoque-summary');

  if (estoqueState.isLoading) {
    if (list) list.innerHTML = `<div class="finance-empty">Carregando...</div>`;
    return;
  }

  const sorted = getSortedProducts();

  if (list) {
    list.innerHTML = sorted.length
      ? sorted.map(renderStockRow).join('')
      : `<div class="finance-empty">Nenhum produto cadastrado.</div>`;
  }

  if (summary) summary.innerHTML = renderSummaryCards();

  bindProductEvents();
}

export function renderEstoque() {
  return /* html */ `
<section class="page-shell page--estoque">
  <div class="grid-2">
    <div class="card">
      <div class="card-header">
        <div class="card-title">⚠️ Estoque Crítico</div>
        <button type="button" class="btn-primary-gradient" id="estoque-restock-all-button">Repor tudo</button>
      </div>
      <div id="estoque-products-list">
        <div class="finance-empty">Carregando...</div>
      </div>
    </div>

    <div class="card">
      <div class="card-header">
        <div class="card-title">Resumo do Estoque</div>
        <button type="button" class="btn-primary-gradient" id="estoque-new-button">+ Produto</button>
      </div>
      <div id="estoque-summary">
        ${renderSummaryCards()}
      </div>
    </div>
  </div>

  <div id="estoque-details-modal" class="modal-overlay" style="display:none;">
    <div class="modal" style="width:min(92vw, 620px);">
      <div id="estoque-details-content"></div>
    </div>
  </div>
</section>
  `;
}

export function initEstoquePage() {
  bindEstoqueStaticEvents();
  loadEstoqueData();
}
