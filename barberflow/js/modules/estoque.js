const estoqueState = {
  summaryBase: {
    otherProductsCount: 20,
    otherNormalCount: 17,
    otherStockValue: 1681,
  },
  products: [
    {
      id: 'pomada-dapper-dan',
      icon: '🍯',
      title: 'Pomada Dapper Dan',
      quantity: 2,
      minLevel: 10,
      unit: 'un',
      avgCost: 32,
      notes: 'Produto de maior saída no acabamento.',
    },
    {
      id: 'lamina-gillette-fusion',
      icon: '🪒',
      title: 'Lâmina Gillette Fusion',
      quantity: 8,
      minLevel: 20,
      unit: 'un',
      avgCost: 15,
      notes: 'Usada nos atendimentos premium.',
    },
    {
      id: 'shampoo-profissional',
      icon: '🧴',
      title: 'Shampoo Profissional',
      quantity: 1.5,
      minLevel: 5,
      unit: 'L',
      avgCost: 90,
      notes: 'Produto de uso contínuo na lavagem.',
    },
    {
      id: 'tesoura-kamisori',
      icon: '✂️',
      title: 'Tesoura Kamisori',
      quantity: 4,
      minLevel: 2,
      unit: 'un',
      avgCost: 100,
      notes: 'Equipamento em nível saudável.',
    },
  ],
  modalMode: 'closed', // closed | view | edit | create
  activeProductId: null,
};

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
  if (abs >= 1000) {
    return `R$${(abs / 1000).toFixed(1)}k`;
  }
  return formatCurrency(abs);
}

function formatStockAmount(value, unit) {
  return `${formatNumber(value)} ${unit}`;
}

function getProductById(productId) {
  return estoqueState.products.find((item) => item.id === productId) || null;
}

function normalizeProductId(title) {
  const base = String(title || 'novo-produto')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '') || 'novo-produto';

  let candidate = base;
  let counter = 2;

  while (estoqueState.products.some((item) => item.id === candidate)) {
    candidate = `${base}-${counter}`;
    counter += 1;
  }

  return candidate;
}

function getProductMeta(product) {
  const quantity = Number(product.quantity || 0);
  const minLevel = Math.max(Number(product.minLevel || 0), 1);

  if (quantity < minLevel * 0.3) {
    return { color: '#ff1744', border: '#ff1744', label: 'Crítico' };
  }

  if (quantity < minLevel) {
    return { color: '#f97316', border: '#f97316', label: 'Baixo' };
  }

  return { color: '#00e676', border: '#00e676', label: 'Normal' };
}

function getInventorySummary() {
  const belowMinimum = estoqueState.products.filter((item) => Number(item.quantity || 0) < Number(item.minLevel || 0)).length;
  const normalVisible = estoqueState.products.filter((item) => Number(item.quantity || 0) >= Number(item.minLevel || 0)).length;
  const visibleValue = estoqueState.products.reduce((sum, item) => sum + (Number(item.quantity || 0) * Number(item.avgCost || 0)), 0);

  return {
    totalProducts: estoqueState.summaryBase.otherProductsCount + estoqueState.products.length,
    belowMinimum,
    stockValue: estoqueState.summaryBase.otherStockValue + visibleValue,
    normalLevel: estoqueState.summaryBase.otherNormalCount + normalVisible,
  };
}

function getSortedProducts() {
  return [...estoqueState.products].sort((a, b) => {
    const ratioA = Number(a.quantity || 0) / Math.max(Number(a.minLevel || 1), 1);
    const ratioB = Number(b.quantity || 0) / Math.max(Number(b.minLevel || 1), 1);
    return ratioA - ratioB;
  });
}

function renderStockRow(product) {
  const meta = getProductMeta(product);
  const quantityLabel = formatStockAmount(product.quantity, product.unit);
  const minLabel = formatStockAmount(product.minLevel, product.unit);
  const detail = Number(product.quantity || 0) < Number(product.minLevel || 0)
    ? `${quantityLabel} restantes · Mín: ${minLabel}`
    : `Normal · ${quantityLabel}`;

  return `
    <button
      type="button"
      class="estoque-row-button"
      data-product-id="${escapeHtml(product.id)}"
      title="Ver detalhes de ${escapeHtml(product.title)}"
    >
      <div class="fin-row" style="border-color:${meta.border}">
        <div class="fin-icon">${escapeHtml(product.icon)}</div>
        <div class="fin-info">
          <div class="fin-title">${escapeHtml(product.title)}</div>
          <div class="fin-date">${escapeHtml(detail)}</div>
        </div>
        <div class="fin-val" style="color:${meta.color}">${escapeHtml(quantityLabel)}</div>
      </div>
    </button>
  `;
}

function renderSummaryCards() {
  const summary = getInventorySummary();

  return `
    <div class="estoque-summary-grid">
      <div class="mini-card">
        <div class="mini-val">${escapeHtml(summary.totalProducts)}</div>
        <div class="mini-lbl">Produtos cadastrados</div>
      </div>

      <div class="mini-card estoque-summary-card estoque-summary-card--danger">
        <div class="mini-val" style="color:#ff1744">${escapeHtml(summary.belowMinimum)}</div>
        <div class="mini-lbl">Abaixo do mínimo</div>
      </div>

      <div class="mini-card">
        <div class="mini-val" style="color:#4fc3f7">${escapeHtml(formatCompactCurrency(summary.stockValue))}</div>
        <div class="mini-lbl">Valor em estoque</div>
      </div>

      <div class="mini-card estoque-summary-card estoque-summary-card--success">
        <div class="mini-val" style="color:#00e676">${escapeHtml(summary.normalLevel)}</div>
        <div class="mini-lbl">Em nível normal</div>
      </div>
    </div>
  `;
}

function renderProductDetails(product) {
  const meta = getProductMeta(product);

  return `
    <div class="estoque-modal-body">
      <div>
        <div class="modal-title" style="margin:0;">${escapeHtml(product.title)}</div>
        <div class="modal-sub" style="margin-top:4px;">Detalhes do produto</div>
      </div>

      <div class="estoque-modal-grid">
        <div class="mini-card">
          <div class="mini-lbl">Estoque atual</div>
          <div class="mini-val" style="color:${meta.color}">${escapeHtml(formatStockAmount(product.quantity, product.unit))}</div>
        </div>
        <div class="mini-card">
          <div class="mini-lbl">Estoque mínimo</div>
          <div class="mini-val" style="font-size:15px;">${escapeHtml(formatStockAmount(product.minLevel, product.unit))}</div>
        </div>
        <div class="mini-card">
          <div class="mini-lbl">Custo médio</div>
          <div class="mini-val" style="font-size:15px;">${escapeHtml(formatCurrency(product.avgCost))}</div>
        </div>
        <div class="mini-card">
          <div class="mini-lbl">Status</div>
          <div class="mini-val" style="font-size:15px;color:${meta.color}">${escapeHtml(meta.label)}</div>
        </div>
      </div>

      <div class="estoque-modal-info">
        <div class="estoque-modal-info-row">
          <strong>Valor em estoque:</strong> ${escapeHtml(formatCurrency(Number(product.quantity || 0) * Number(product.avgCost || 0)))}
        </div>
        <div class="estoque-modal-info-row">
          <strong>Observações:</strong> ${escapeHtml(product.notes || '—')}
        </div>
      </div>

      <div class="modal-buttons" style="margin-top:10px;">
        <button type="button" class="btn-cancel" id="estoque-modal-close">Fechar</button>
        <button type="button" class="btn-save" id="estoque-edit-button" data-product-id="${escapeHtml(product.id)}">Editar produto</button>
      </div>
    </div>
  `;
}

function renderProductForm(mode, product = null) {
  const isEdit = mode === 'edit';
  const safeProduct = product || {
    title: '',
    icon: '📦',
    quantity: 1,
    minLevel: 5,
    unit: 'un',
    avgCost: 50,
    notes: '',
  };

  return `
    <div class="estoque-modal-body">
      <div>
        <div class="modal-title" style="margin:0;">${isEdit ? 'Editar produto' : 'Novo produto'}</div>
        <div class="modal-sub" style="margin-top:4px;">
          ${isEdit ? 'Atualize os dados do produto.' : 'Preencha os dados para cadastrar um novo produto.'}
        </div>
      </div>

      <form id="estoque-form" class="estoque-form">
        <div class="estoque-form-grid">
          <div>
            <div class="color-section-label">Produto</div>
            <input class="modal-input" name="title" type="text" value="${escapeHtml(safeProduct.title)}" placeholder="Nome do produto" />
          </div>

          <div>
            <div class="color-section-label">Ícone</div>
            <input class="modal-input" name="icon" type="text" value="${escapeHtml(safeProduct.icon)}" placeholder="Ex.: 📦" />
          </div>

          <div>
            <div class="color-section-label">Quantidade</div>
            <input class="modal-input" name="quantity" type="number" min="0" step="0.1" value="${escapeHtml(safeProduct.quantity)}" />
          </div>

          <div>
            <div class="color-section-label">Estoque mínimo</div>
            <input class="modal-input" name="minLevel" type="number" min="0" step="0.1" value="${escapeHtml(safeProduct.minLevel)}" />
          </div>

          <div>
            <div class="color-section-label">Unidade</div>
            <select class="modal-input" name="unit">
              <option value="un" ${safeProduct.unit === 'un' ? 'selected' : ''}>Unidade</option>
              <option value="L" ${safeProduct.unit === 'L' ? 'selected' : ''}>Litro</option>
              <option value="ml" ${safeProduct.unit === 'ml' ? 'selected' : ''}>Mililitro</option>
              <option value="cx" ${safeProduct.unit === 'cx' ? 'selected' : ''}>Caixa</option>
            </select>
          </div>

          <div>
            <div class="color-section-label">Custo médio</div>
            <input class="modal-input" name="avgCost" type="number" min="0" step="1" value="${escapeHtml(safeProduct.avgCost)}" />
          </div>
        </div>

        <div>
          <div class="color-section-label">Observações</div>
          <textarea class="modal-input estoque-textarea" name="notes" placeholder="Observações do produto">${escapeHtml(safeProduct.notes || '')}</textarea>
        </div>

        <div id="estoque-form-feedback" class="estoque-form-feedback"></div>

        <div class="modal-buttons" style="margin-top:10px;">
          <button type="button" class="btn-cancel" id="${isEdit ? 'estoque-form-back' : 'estoque-form-cancel'}">
            ${isEdit ? 'Voltar' : 'Cancelar'}
          </button>
          <button type="submit" class="btn-save">
            ${isEdit ? 'Salvar alterações' : 'Cadastrar produto'}
          </button>
        </div>
      </form>
    </div>
  `;
}

function setEstoqueFormFeedback(message, variant = 'neutral') {
  const el = document.getElementById('estoque-form-feedback');
  if (!el) return;

  el.textContent = message || '';
  el.style.color =
    variant === 'error' ? '#ff8a8a' :
    variant === 'success' ? '#00e676' :
    '#5a6888';
}

function openProductModal(productId) {
  estoqueState.activeProductId = productId;
  estoqueState.modalMode = 'view';
  renderEstoqueModal();
}

function openCreateProductModal() {
  estoqueState.activeProductId = null;
  estoqueState.modalMode = 'create';
  renderEstoqueModal();
}

function openEditProductModal(productId) {
  estoqueState.activeProductId = productId;
  estoqueState.modalMode = 'edit';
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

function collectProductFormData() {
  const form = document.getElementById('estoque-form');
  const formData = new FormData(form);

  return {
    title: String(formData.get('title') || '').trim(),
    icon: String(formData.get('icon') || '📦').trim() || '📦',
    quantity: Number(formData.get('quantity') || 0),
    minLevel: Number(formData.get('minLevel') || 0),
    unit: String(formData.get('unit') || 'un').trim(),
    avgCost: Number(formData.get('avgCost') || 0),
    notes: String(formData.get('notes') || '').trim(),
  };
}

function handleProductFormSubmit(event) {
  event.preventDefault();

  const data = collectProductFormData();

  if (!data.title) {
    setEstoqueFormFeedback('Informe o nome do produto.', 'error');
    return;
  }

  if (data.quantity < 0) {
    setEstoqueFormFeedback('Informe uma quantidade válida.', 'error');
    return;
  }

  if (data.minLevel < 0) {
    setEstoqueFormFeedback('Informe um estoque mínimo válido.', 'error');
    return;
  }

  if (data.avgCost < 0) {
    setEstoqueFormFeedback('Informe um custo médio válido.', 'error');
    return;
  }

  if (estoqueState.modalMode === 'create') {
    const newProduct = {
      id: normalizeProductId(data.title),
      ...data,
    };

    estoqueState.products = [newProduct, ...estoqueState.products];
    rerenderEstoque();
    openProductModal(newProduct.id);
    return;
  }

  if (estoqueState.modalMode === 'edit' && estoqueState.activeProductId) {
    estoqueState.products = estoqueState.products.map((item) => {
      if (item.id !== estoqueState.activeProductId) return item;
      return { ...item, ...data };
    });

    rerenderEstoque();
    openProductModal(estoqueState.activeProductId);
  }
}

function restockCriticalProducts() {
  estoqueState.products = estoqueState.products.map((item) => {
    if (Number(item.quantity || 0) >= Number(item.minLevel || 0)) return item;
    return { ...item, quantity: item.minLevel };
  });

  rerenderEstoque();
}

function renderEstoqueModal() {
  const modal = document.getElementById('estoque-details-modal');
  const content = document.getElementById('estoque-details-content');
  if (!modal || !content) return;

  if (estoqueState.modalMode === 'closed') {
    modal.classList.remove('open');
    modal.style.display = 'none';
    content.innerHTML = '';
    return;
  }

  const product = estoqueState.activeProductId ? getProductById(estoqueState.activeProductId) : null;

  if ((estoqueState.modalMode === 'view' || estoqueState.modalMode === 'edit') && !product) {
    closeEstoqueModal();
    return;
  }

  if (estoqueState.modalMode === 'view') {
    content.innerHTML = renderProductDetails(product);
  }

  if (estoqueState.modalMode === 'edit') {
    content.innerHTML = renderProductForm('edit', product);
  }

  if (estoqueState.modalMode === 'create') {
    content.innerHTML = renderProductForm('create');
  }

  modal.style.display = 'flex';
  modal.classList.add('open');

  bindEstoqueModalEvents();
}

function bindProductEvents() {
  document.querySelectorAll('.estoque-row-button[data-product-id]').forEach((button) => {
    button.addEventListener('click', () => {
      openProductModal(button.dataset.productId);
    });
  });
}

function bindEstoqueModalEvents() {
  document.getElementById('estoque-modal-close')?.addEventListener('click', closeEstoqueModal);

  document.getElementById('estoque-edit-button')?.addEventListener('click', () => {
    const button = document.getElementById('estoque-edit-button');
    if (!button?.dataset.productId) return;
    openEditProductModal(button.dataset.productId);
  });

  document.getElementById('estoque-form-back')?.addEventListener('click', () => {
    if (!estoqueState.activeProductId) return;
    openProductModal(estoqueState.activeProductId);
  });

  document.getElementById('estoque-form-cancel')?.addEventListener('click', closeEstoqueModal);
  document.getElementById('estoque-form')?.addEventListener('submit', handleProductFormSubmit);
}

function bindEstoqueStaticEvents() {
  document.getElementById('estoque-new-button')?.addEventListener('click', openCreateProductModal);
  document.getElementById('estoque-restock-all-button')?.addEventListener('click', restockCriticalProducts);

  document.getElementById('estoque-details-modal')?.addEventListener('click', (event) => {
    if (event.target?.id === 'estoque-details-modal') {
      closeEstoqueModal();
    }
  });
}

function rerenderEstoque() {
  const list = document.getElementById('estoque-products-list');
  const summary = document.getElementById('estoque-summary');
  if (list) list.innerHTML = getSortedProducts().map(renderStockRow).join('');
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
        <button type="button" class="card-action estoque-restock-button" id="estoque-restock-all-button">Repor tudo</button>
      </div>

      <div id="estoque-products-list">
        ${getSortedProducts().map(renderStockRow).join('')}
      </div>
    </div>

    <div class="card">
      <div class="card-header">
        <div class="card-title">Resumo do Estoque</div>
        <button type="button" class="card-action" id="estoque-new-button">+ Produto</button>
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
  bindProductEvents();
}
