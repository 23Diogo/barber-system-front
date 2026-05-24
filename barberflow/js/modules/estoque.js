import { apiFetch } from '../services/api.js';

const STOCK_FILTER_STORAGE_KEY = 'barberflow.stock.filter';

const STOCK_FILTERS = [
  { id: 'all', label: 'Todos', hint: 'Catálogo completo' },
  { id: 'active', label: 'Ativos', hint: 'Em uso' },
  { id: 'for_sale', label: 'Venda', hint: 'Produtos vendidos' },
  { id: 'low_stock', label: 'Baixo', hint: 'Reposição' },
  { id: 'zero_stock', label: 'Zerado', hint: 'Ruptura' },
  { id: 'overstock', label: 'Parado', hint: 'Capital preso' },
  { id: 'no_movement', label: 'Sem giro', hint: 'Sem histórico' },
  { id: 'negative_margin', label: 'Margem ruim', hint: 'Rever preço' },
  { id: 'attention', label: 'Atenção', hint: 'Risco operacional' },
];

const MOVEMENT_ACTIONS = [
  { id: 'purchase', type: 'in', label: 'Compra / reposição', tone: 'success', direction: 'in', createsTransaction: true },
  { id: 'sale', type: 'out', label: 'Venda', tone: 'info', direction: 'out', createsTransaction: true },
  { id: 'internal_use', type: 'out', label: 'Uso interno', tone: 'purple', direction: 'out', createsTransaction: false },
  { id: 'loss', type: 'loss', label: 'Perda / avaria', tone: 'danger', direction: 'out', createsTransaction: false },
  { id: 'adjustment', type: 'adjustment', label: 'Ajuste manual', tone: 'gold', direction: 'neutral', createsTransaction: false },
];

const estoqueState = {
  products: [],
  dashboard: null,
  isLoading: false,
  isLoaded: false,
  searchTerm: '',
  activeFilter: getInitialStockFilter(),
  modalMode: 'closed',
  movementAction: 'purchase',
  activeProductId: null,
};

function getInitialStockFilter() {
  try {
    const stored = localStorage.getItem(STOCK_FILTER_STORAGE_KEY);
    return STOCK_FILTERS.some(item => item.id === stored) ? stored : 'all';
  } catch {
    return 'all';
  }
}

function persistStockFilter(filter) {
  try { localStorage.setItem(STOCK_FILTER_STORAGE_KEY, filter); } catch {}
}

function escapeHtml(value) {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

function formatNumber(value, digits = 1) {
  return new Intl.NumberFormat('pt-BR', {
    minimumFractionDigits: Number(value) % 1 === 0 ? 0 : 1,
    maximumFractionDigits: digits,
  }).format(Number(value || 0));
}

function formatCurrency(value) {
  return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(Number(value || 0));
}

function formatCompactCurrency(value) {
  const amount = Number(value || 0);
  if (Math.abs(amount) >= 1000) return `R$ ${(amount / 1000).toFixed(1)}k`;
  return formatCurrency(amount);
}

function formatDateTime(value) {
  if (!value) return '—';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return String(value);
  return date.toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' });
}

function debounce(fn, ms = 350) {
  let timer = null;
  return (...args) => {
    clearTimeout(timer);
    timer = setTimeout(() => fn(...args), ms);
  };
}

function setFeedback(id, message, variant = 'neutral') {
  const el = document.getElementById(id);
  if (!el) return;
  el.textContent = message || '';
  el.style.color = variant === 'error' ? '#ff8a8a' : variant === 'success' ? '#00e676' : '#5a6888';
}

function getProductById(id) {
  return estoqueState.products.find(p => String(p.id) === String(id)) || null;
}

function getDashboardSafe() {
  return estoqueState.dashboard || {
    total: 0, active: 0, inactive: 0, forSale: 0, lowStock: 0, zeroStock: 0, overstock: 0,
    attention: 0, stockValue: 0, saleValue: 0, potentialProfit: 0, movements30d: 0,
    purchaseCost30d: 0, saleRevenue30d: 0, lossCost30d: 0, topByStockValue: null, topByOut: null,
  };
}

function getActionById(id) {
  return MOVEMENT_ACTIONS.find(action => action.id === id) || MOVEMENT_ACTIONS[0];
}

function inferActionFromMovement(movement) {
  const notes = String(movement?.notes || '').toLowerCase();
  if (movement?.purpose) return getActionById(movement.purpose);
  if (String(movement?.type) === 'in') return getActionById('purchase');
  if (String(movement?.type) === 'loss') return getActionById('loss');
  if (String(movement?.type) === 'adjustment') return getActionById('adjustment');
  if (notes.includes('[venda]')) return getActionById('sale');
  return getActionById('internal_use');
}

function getLegacyHealth(product) {
  const current = Number(product?.current_stock || 0);
  const min = Number(product?.min_stock || 0);
  if (current <= 0) return { code: 'zero', label: 'Zerado', tone: 'danger', pct: 0 };
  if (min > 0 && current < min * 0.3) return { code: 'critical', label: 'Crítico', tone: 'danger', pct: Math.round((current / min) * 100) };
  if (min > 0 && current < min) return { code: 'low', label: 'Baixo', tone: 'warning', pct: Math.round((current / min) * 100) };
  if (min > 0 && current >= min * 4) return { code: 'overstock', label: 'Alto estoque', tone: 'gold', pct: 100 };
  return { code: 'healthy', label: 'Saudável', tone: 'success', pct: min > 0 ? Math.min(100, Math.round((current / min) * 100)) : 100 };
}

function getHealthMeta(product) {
  const health = product?.health || getLegacyHealth(product);
  const map = {
    zero: { label: 'Zerado', className: 'stock-chip--danger', icon: '!' },
    critical: { label: 'Crítico', className: 'stock-chip--danger', icon: '!' },
    low: { label: 'Baixo', className: 'stock-chip--warning', icon: '!' },
    overstock: { label: 'Alto estoque', className: 'stock-chip--gold', icon: '★' },
    healthy: { label: 'Saudável', className: 'stock-chip--success', icon: '✓' },
  };
  return map[health.code] || map.healthy;
}

function getAlertToneMeta(tone) {
  const map = {
    success: { className: 'stock-chip--success', icon: '✓' },
    info: { className: 'stock-chip--info', icon: 'i' },
    warning: { className: 'stock-chip--warning', icon: '!' },
    danger: { className: 'stock-chip--danger', icon: '!' },
    purple: { className: 'stock-chip--purple', icon: '✦' },
    gold: { className: 'stock-chip--gold', icon: '★' },
    neutral: { className: 'stock-chip--neutral', icon: '•' },
  };
  return map[tone] || map.neutral;
}

function getProductIcon(product) {
  const text = `${product?.category || ''} ${product?.name || ''}`.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
  if (text.includes('pomada') || text.includes('gel')) return '🧴';
  if (text.includes('lamina') || text.includes('barba')) return '🪒';
  if (text.includes('shampoo') || text.includes('condicionador')) return '🫧';
  if (text.includes('toalha')) return '🧺';
  if (text.includes('maquina') || text.includes('tesoura')) return '✂️';
  return '📦';
}

function renderChip(label, className = 'stock-chip--neutral', icon = '') {
  return `<span class="stock-chip ${escapeHtml(className)}">${escapeHtml(icon)} ${escapeHtml(label)}</span>`;
}

function renderAlertChip(alert) {
  if (!alert) return '';
  const meta = getAlertToneMeta(alert.tone);
  return renderChip(alert.title, meta.className, meta.icon);
}

function buildProgressBar(value, variant = '') {
  const pct = Math.max(0, Math.min(100, Math.round(Number(value || 0))));
  return `<div class="stock-progress ${escapeHtml(variant)}"><span style="width:${pct}%"></span></div>`;
}

function getFilterMetric(filterId) {
  const d = getDashboardSafe();
  const map = {
    all: d.total,
    active: d.active,
    for_sale: d.forSale,
    low_stock: d.lowStock,
    zero_stock: d.zeroStock,
    overstock: d.overstock,
    no_movement: estoqueState.products.filter(item => Number(item.metrics?.movements_count || 0) === 0).length,
    negative_margin: estoqueState.products.filter(item => Number(item.unit_margin || 0) < 0).length,
    attention: d.attention,
  };
  return map[filterId] ?? 0;
}

function normalizePlainProducts(items) {
  const safe = Array.isArray(items) ? items : [];
  return safe.map(product => {
    const current = Number(product.current_stock || 0);
    const cost = Number(product.cost_price || 0);
    const sale = Number(product.sale_price || 0);
    const health = getLegacyHealth(product);
    const stockValue = current * cost;
    const saleValue = current * sale;

    return {
      ...product,
      health,
      stock_value: stockValue,
      sale_value: saleValue,
      potential_profit: saleValue - stockValue,
      unit_margin: sale - cost,
      margin_pct: sale > 0 ? ((sale - cost) / sale) * 100 : 0,
      metrics: {
        movements_count: 0, movements_30d: 0, in_quantity: 0, out_quantity: 0,
        recent_in_quantity: 0, recent_out_quantity: 0, sales_quantity: 0,
        loss_quantity: 0, purchase_cost_30d: 0, loss_cost_30d: 0, sale_revenue_30d: 0,
        latest_movement_at: null, days_without_movement: null, days_coverage: null,
      },
      alerts: [],
      primary_alert: null,
      needs_attention: ['zero', 'critical', 'low'].includes(health.code),
      recent_movements: [],
    };
  });
}

function buildFallbackDashboard(items) {
  const safe = Array.isArray(items) ? items : [];
  const stockValue = safe.reduce((sum, item) => sum + Number(item.stock_value || 0), 0);
  const saleValue = safe.reduce((sum, item) => sum + Number(item.sale_value || 0), 0);

  return {
    total: safe.length,
    active: safe.filter(item => item.is_active !== false).length,
    inactive: safe.filter(item => item.is_active === false).length,
    forSale: safe.filter(item => item.is_for_sale === true || Number(item.sale_price || 0) > 0).length,
    lowStock: safe.filter(item => ['zero', 'critical', 'low'].includes(item.health?.code)).length,
    zeroStock: safe.filter(item => item.health?.code === 'zero').length,
    overstock: safe.filter(item => item.health?.code === 'overstock').length,
    attention: safe.filter(item => item.needs_attention).length,
    stockValue,
    saleValue,
    potentialProfit: saleValue - stockValue,
    movements30d: 0, purchaseCost30d: 0, saleRevenue30d: 0, lossCost30d: 0,
    topByStockValue: safe[0] ? { id: safe[0].id, name: safe[0].name, stockValue: safe[0].stock_value } : null,
    topByOut: null,
  };
}

function renderDashboardCards() {
  const d = getDashboardSafe();
  return `
    <div class="stock-cockpit">
      <div class="stock-metric stock-metric--hero">
        <div class="stock-metric-label">Valor em estoque</div>
        <div class="stock-metric-value color-info">${escapeHtml(formatCompactCurrency(d.stockValue))}</div>
        <div class="stock-metric-sub">${escapeHtml(d.total)} produto(s) · ${escapeHtml(d.active)} ativo(s)</div>
      </div>
      <div class="stock-metric">
        <div class="stock-metric-label">Risco de ruptura</div>
        <div class="stock-metric-value color-danger">${escapeHtml(d.lowStock)}</div>
        <div class="stock-metric-sub">${escapeHtml(d.zeroStock)} zerado(s) · ${escapeHtml(d.attention)} atenção</div>
      </div>
      <div class="stock-metric">
        <div class="stock-metric-label">Potencial de venda</div>
        <div class="stock-metric-value color-money">${escapeHtml(formatCompactCurrency(d.saleValue))}</div>
        <div class="stock-metric-sub">Lucro potencial ${escapeHtml(formatCompactCurrency(d.potentialProfit))}</div>
      </div>
      <div class="stock-metric">
        <div class="stock-metric-label">Giro 30 dias</div>
        <div class="stock-metric-value color-purple">${escapeHtml(d.movements30d)}</div>
        <div class="stock-metric-sub">Compras ${escapeHtml(formatCompactCurrency(d.purchaseCost30d))} · perdas ${escapeHtml(formatCompactCurrency(d.lossCost30d))}</div>
      </div>
    </div>
  `;
}

function renderFilters() {
  return `
    <div class="stock-filters">
      ${STOCK_FILTERS.map(filter => `
        <button type="button" class="stock-filter ${estoqueState.activeFilter === filter.id ? 'is-active' : ''}" data-stock-filter="${escapeHtml(filter.id)}">
          <span>${escapeHtml(filter.label)}</span>
          <strong>${escapeHtml(getFilterMetric(filter.id))}</strong>
          <small>${escapeHtml(filter.hint)}</small>
        </button>
      `).join('')}
    </div>
  `;
}

function renderProductCard(product) {
  const healthMeta = getHealthMeta(product);
  const icon = getProductIcon(product);
  const metrics = product.metrics || {};
  const unit = product.unit || 'un';
  const healthPct = Number(product.health?.pct ?? getLegacyHealth(product).pct ?? 0);
  const chips = [
    renderChip(healthMeta.label, healthMeta.className, healthMeta.icon),
    product.is_for_sale === true || Number(product.sale_price || 0) > 0 ? renderChip('Venda', 'stock-chip--info', 'R$') : renderChip('Uso interno', 'stock-chip--purple', '✦'),
    product.category ? renderChip(product.category, 'stock-chip--neutral', '•') : '',
    product.primary_alert ? renderAlertChip(product.primary_alert) : '',
  ].filter(Boolean);

  return `
    <button type="button" class="stock-card" data-product-id="${escapeHtml(product.id)}">
      <div class="stock-card-icon">${icon}</div>
      <div class="stock-card-main">
        <div class="stock-card-top">
          <div>
            <div class="stock-card-name">${escapeHtml(product.name)}</div>
            <div class="stock-card-sub">${product.brand ? `${escapeHtml(product.brand)} · ` : ''}${escapeHtml(product.category || 'Sem categoria')}</div>
          </div>
          <div class="stock-card-qty">${escapeHtml(formatNumber(product.current_stock || 0))} <small>${escapeHtml(unit)}</small></div>
        </div>
        <div class="stock-card-chips">${chips.join('')}</div>
        <div class="stock-card-grid">
          <span><small>Mínimo</small><strong>${escapeHtml(formatNumber(product.min_stock || 0))} ${escapeHtml(unit)}</strong></span>
          <span><small>Custo</small><strong>${escapeHtml(formatCurrency(product.cost_price))}</strong></span>
          <span><small>Venda</small><strong>${escapeHtml(formatCurrency(product.sale_price))}</strong></span>
          <span><small>Margem</small><strong>${escapeHtml(formatNumber(product.margin_pct || 0, 0))}%</strong></span>
        </div>
        <div class="stock-health-strip">
          <div>
            <strong>Saúde do estoque</strong>
            <small>Valor parado ${escapeHtml(formatCurrency(product.stock_value || 0))} · cobertura ${metrics.days_coverage === null || metrics.days_coverage === undefined ? 'sem giro' : `${escapeHtml(metrics.days_coverage)} dia(s)`}</small>
          </div>
          <div class="stock-health-meter">
            <span>${escapeHtml(Math.round(healthPct))}%</span>
            ${buildProgressBar(healthPct, `stock-progress--${escapeHtml(product.health?.code || 'healthy')}`)}
          </div>
        </div>
        ${product.primary_alert ? `
          <div class="stock-alert stock-alert--${escapeHtml(product.primary_alert.tone || 'neutral')}">
            <strong>${escapeHtml(product.primary_alert.title)}</strong>
            <span>${escapeHtml(product.primary_alert.message)}</span>
          </div>
        ` : ''}
      </div>
    </button>
  `;
}

function renderProductsList() {
  if (estoqueState.isLoading) {
    return `<div class="stock-empty"><strong>Carregando estoque...</strong><span>Buscando produtos, movimentações, margens, giro e alertas.</span></div>`;
  }

  if (!estoqueState.products.length) {
    return `<div class="stock-empty"><strong>Nenhum produto neste filtro</strong><span>Troque o filtro ou cadastre um produto para começar.</span></div>`;
  }

  return `
    <div class="stock-list-head">
      <div>
        <strong>Produtos e insumos</strong>
        <span>${escapeHtml(estoqueState.products.length)} produto(s) encontrado(s)</span>
      </div>
    </div>
    <div class="stock-list">${estoqueState.products.map(renderProductCard).join('')}</div>
  `;
}

function renderSidePanel() {
  const sortedByValue = [...estoqueState.products].sort((a, b) => Number(b.stock_value || 0) - Number(a.stock_value || 0));
  const attention = estoqueState.products.filter(item => item.needs_attention).slice(0, 5);
  const latestMovements = estoqueState.products
    .flatMap(product => (product.recent_movements || []).map(m => ({ ...m, product_name: product.name })))
    .sort((a, b) => new Date(b.created_at || 0) - new Date(a.created_at || 0))
    .slice(0, 6);

  return `
    <div class="stock-side-grid">
      <div class="stock-side-card stock-side-card--spotlight">
        <div class="stock-section-title">Integração total</div>
        <div class="stock-integration-flow"><span>Compra</span><b>→</b><span>Estoque</span><b>→</b><span>Venda / uso</span><b>→</b><span>Financeiro</span></div>
        <p>Compra e venda geram rastro financeiro usando a tabela transactions atual, sem mexer no trigger de estoque.</p>
      </div>

      <div class="stock-side-card">
        <div class="stock-section-title">Dinheiro parado</div>
        <div class="stock-ranking">
          ${sortedByValue.length ? sortedByValue.slice(0, 5).map((product, index) => {
            const maxValue = Math.max(Number(sortedByValue[0]?.stock_value || 0), 1);
            const width = Math.max((Number(product.stock_value || 0) / maxValue) * 100, 8);
            return `
              <button type="button" class="stock-ranking-row" data-product-id="${escapeHtml(product.id)}">
                <div class="stock-ranking-index">${index + 1}</div>
                <div class="stock-ranking-main">
                  <strong>${escapeHtml(product.name)}</strong>
                  <span>${escapeHtml(formatCurrency(product.stock_value || 0))} · ${escapeHtml(formatNumber(product.current_stock || 0))} ${escapeHtml(product.unit || 'un')}</span>
                  ${buildProgressBar(width, '')}
                </div>
              </button>
            `;
          }).join('') : '<div class="stock-side-empty">Nenhum produto cadastrado.</div>'}
        </div>
      </div>

      <div class="stock-side-card">
        <div class="stock-section-title">Atenção do dono</div>
        <div class="stock-attention-list">
          ${attention.length ? attention.map(product => `
            <button type="button" class="stock-attention-row" data-product-id="${escapeHtml(product.id)}">
              <strong>${escapeHtml(product.name)}</strong>
              <span>${escapeHtml(product.primary_alert?.title || 'Revisar produto')}</span>
            </button>
          `).join('') : '<div class="stock-side-empty">Nenhum alerta crítico no estoque.</div>'}
        </div>
      </div>

      <div class="stock-side-card">
        <div class="stock-section-title">Últimas movimentações</div>
        <div class="stock-movement-mini-list">
          ${latestMovements.length ? latestMovements.map(movement => {
            const action = inferActionFromMovement(movement);
            const tone = getAlertToneMeta(action.tone);
            return `
              <div class="stock-movement-mini">
                ${renderChip(action.label, tone.className, tone.icon)}
                <strong>${escapeHtml(movement.product_name)}</strong>
                <span>${escapeHtml(formatNumber(movement.quantity || 0))} · ${escapeHtml(formatDateTime(movement.created_at))}</span>
              </div>
            `;
          }).join('') : '<div class="stock-side-empty">Sem movimentações recentes.</div>'}
        </div>
      </div>
    </div>
  `;
}

function renderProductDetails(product) {
  const healthMeta = getHealthMeta(product);
  const icon = getProductIcon(product);
  const unit = product.unit || 'un';
  const metrics = product.metrics || {};
  const alerts = Array.isArray(product.alerts) ? product.alerts : [];
  const movements = Array.isArray(product.recent_movements) ? product.recent_movements : [];
  const stockValue = Number(product.stock_value || 0);
  const saleValue = Number(product.sale_value || 0);

  return `
    <div class="stock-detail">
      <div class="stock-detail-hero">
        <div class="stock-card-icon stock-card-icon--large">${icon}</div>
        <div class="stock-detail-main">
          <div class="stock-section-title">Ficha de produto</div>
          <h2>${escapeHtml(product.name)}</h2>
          <p>${escapeHtml(product.description || 'Sem descrição cadastrada.')}</p>
          <div class="stock-card-chips">
            ${renderChip(healthMeta.label, healthMeta.className, healthMeta.icon)}
            ${renderChip(`${formatNumber(product.current_stock || 0)} ${unit}`, 'stock-chip--info', '📦')}
            ${product.brand ? renderChip(product.brand, 'stock-chip--neutral', '•') : ''}
            ${product.primary_alert ? renderAlertChip(product.primary_alert) : ''}
          </div>
        </div>
        <div class="stock-detail-price">
          <small>Valor parado</small>
          <strong>${escapeHtml(formatCurrency(stockValue))}</strong>
          <span>Venda potencial ${escapeHtml(formatCurrency(saleValue))}</span>
        </div>
      </div>

      <div class="stock-detail-grid">
        <div class="mini-card"><div class="mini-lbl">Estoque atual</div><div class="mini-val color-info">${escapeHtml(formatNumber(product.current_stock || 0))} ${escapeHtml(unit)}</div></div>
        <div class="mini-card"><div class="mini-lbl">Estoque mínimo</div><div class="mini-val">${escapeHtml(formatNumber(product.min_stock || 0))} ${escapeHtml(unit)}</div></div>
        <div class="mini-card"><div class="mini-lbl">Margem unitária</div><div class="mini-val ${Number(product.unit_margin || 0) < 0 ? 'color-danger' : 'color-money'}">${escapeHtml(formatCurrency(product.unit_margin || 0))}</div></div>
        <div class="mini-card"><div class="mini-lbl">Giro 30 dias</div><div class="mini-val color-purple">${escapeHtml(formatNumber(metrics.recent_out_quantity || 0))}</div></div>
      </div>

      <div class="stock-detail-columns">
        <section class="stock-panel">
          <div class="stock-section-title">Alertas inteligentes</div>
          ${alerts.length ? alerts.map(alert => `
            <div class="stock-detail-alert stock-detail-alert--${escapeHtml(alert.tone)}">
              <strong>${escapeHtml(alert.title)}</strong>
              <span>${escapeHtml(alert.message)}</span>
            </div>
          `).join('') : '<div class="stock-side-empty">Nenhum alerta para este produto.</div>'}
        </section>

        <section class="stock-panel">
          <div class="stock-section-title">Leitura financeira</div>
          <div class="stock-owner-reading">
            <strong>${escapeHtml(product.name)} tem ${escapeHtml(formatNumber(product.current_stock || 0))} ${escapeHtml(unit)} em estoque.</strong>
            <span>Custo ${escapeHtml(formatCurrency(product.cost_price || 0))} · venda ${escapeHtml(formatCurrency(product.sale_price || 0))} · margem ${escapeHtml(formatNumber(product.margin_pct || 0, 0))}% · perda 30d ${escapeHtml(formatCurrency(metrics.loss_cost_30d || 0))}.</span>
          </div>
        </section>
      </div>

      <section class="stock-panel">
        <div class="stock-section-title">Ações rápidas</div>
        <div class="stock-quick-actions">
          ${MOVEMENT_ACTIONS.map(action => `
            <button type="button" class="stock-action-btn stock-action-btn--${escapeHtml(action.tone)}" data-product-id="${escapeHtml(product.id)}" data-movement-action="${escapeHtml(action.id)}">
              ${escapeHtml(action.label)}
            </button>
          `).join('')}
        </div>
      </section>

      <section class="stock-panel">
        <div class="stock-section-title">Histórico recente</div>
        <div class="stock-detail-list">
          ${movements.length ? movements.map(movement => {
            const action = inferActionFromMovement(movement);
            const tone = getAlertToneMeta(action.tone);
            return `
              <div class="stock-detail-row">
                <div>
                  <strong>${escapeHtml(action.label)}</strong>
                  <span>${escapeHtml(formatNumber(movement.quantity || 0))} ${escapeHtml(unit)} · antes ${escapeHtml(formatNumber(movement.stock_before || 0))} → depois ${escapeHtml(formatNumber(movement.stock_after || 0))} · ${escapeHtml(formatDateTime(movement.created_at))}</span>
                  ${movement.notes ? `<span>${escapeHtml(movement.notes)}</span>` : ''}
                </div>
                ${renderChip(action.direction === 'in' ? 'Entrada' : action.direction === 'out' ? 'Saída' : 'Ajuste', tone.className, tone.icon)}
              </div>
            `;
          }).join('') : '<div class="stock-side-empty">Nenhuma movimentação recente.</div>'}
        </div>
      </section>

      <div id="estoque-modal-feedback" class="estoque-form-feedback"></div>

      <div class="modal-buttons stock-modal-actions">
        <button type="button" class="btn-cancel" id="estoque-modal-close">Fechar</button>
        <button type="button" class="stock-action-btn" id="estoque-edit-button" data-product-id="${escapeHtml(product.id)}">Editar produto</button>
      </div>
    </div>
  `;
}

function renderProductForm(mode, product = null) {
  const isEdit = mode === 'edit';
  const p = product || {};
  return `
    <div class="estoque-modal-body stock-form-shell">
      <div class="stock-form-hero">
        <div>
          <div class="stock-section-title">${isEdit ? 'Ajuste de produto' : 'Novo produto'}</div>
          <h2>${isEdit ? 'Editar produto' : 'Cadastrar produto'}</h2>
          <p>Configure custo, venda, estoque mínimo e disponibilidade. Estes dados alimentam margem, giro e alertas.</p>
        </div>
      </div>

      <form id="estoque-form" class="estoque-form">
        <div class="stock-form-steps">
          <div class="stock-form-step is-active"><strong>1</strong><span>Produto</span></div>
          <div class="stock-form-step is-active"><strong>2</strong><span>Estoque</span></div>
          <div class="stock-form-step is-active"><strong>3</strong><span>Margem</span></div>
        </div>

        <section class="stock-form-section">
          <div class="stock-section-title">Identidade</div>
          <div class="estoque-form-grid">
            <div><div class="color-section-label">Nome</div><input class="modal-input" name="name" type="text" value="${escapeHtml(p.name || '')}" placeholder="Ex: Pomada modeladora" /></div>
            <div><div class="color-section-label">Marca</div><input class="modal-input" name="brand" type="text" value="${escapeHtml(p.brand || '')}" placeholder="Ex: Don Alcides" /></div>
            <div><div class="color-section-label">Categoria</div><input class="modal-input" name="category" type="text" value="${escapeHtml(p.category || '')}" placeholder="Ex: Pomada, lâmina, shampoo..." /></div>
            <div>
              <div class="color-section-label">Unidade</div>
              <select class="modal-input" name="unit">
                ${['un', 'cx', 'ml', 'L', 'kg', 'g'].map(unit => `<option value="${escapeHtml(unit)}" ${(p.unit || 'un') === unit ? 'selected' : ''}>${escapeHtml(unit)}</option>`).join('')}
              </select>
            </div>
          </div>
        </section>

        <section class="stock-form-section">
          <div class="stock-section-title">Estoque e preço</div>
          <div class="estoque-form-grid">
            <div>
              <div class="color-section-label">Estoque atual</div>
              <input class="modal-input" name="current_stock" type="number" min="0" step="0.1" value="${escapeHtml(p.current_stock ?? 0)}" ${isEdit ? 'disabled' : ''} />
              ${isEdit ? '<small class="stock-field-hint">Use movimentação para alterar saldo.</small>' : ''}
            </div>
            <div><div class="color-section-label">Estoque mínimo</div><input class="modal-input" name="min_stock" type="number" min="0" step="0.1" value="${escapeHtml(p.min_stock ?? 0)}" /></div>
            <div><div class="color-section-label">Custo unitário (R$)</div><input class="modal-input" name="cost_price" type="number" min="0" step="0.01" value="${escapeHtml(p.cost_price ?? 0)}" /></div>
            <div><div class="color-section-label">Preço de venda (R$)</div><input class="modal-input" name="sale_price" type="number" min="0" step="0.01" value="${escapeHtml(p.sale_price ?? 0)}" /></div>
            <div>
              <div class="color-section-label">Produto vendido?</div>
              <select class="modal-input" name="is_for_sale">
                <option value="false" ${p.is_for_sale === false ? 'selected' : ''}>Não, uso interno</option>
                <option value="true" ${p.is_for_sale === true ? 'selected' : ''}>Sim, venda ao cliente</option>
              </select>
            </div>
            <div>
              <div class="color-section-label">Status</div>
              <select class="modal-input" name="is_active">
                <option value="true" ${p.is_active !== false ? 'selected' : ''}>Ativo</option>
                <option value="false" ${p.is_active === false ? 'selected' : ''}>Inativo</option>
              </select>
            </div>
          </div>
        </section>

        <section class="stock-form-section">
          <div class="stock-section-title">Observações</div>
          <textarea class="modal-input estoque-textarea" name="description" placeholder="Descrição, fornecedor, local de armazenamento ou regra de uso">${escapeHtml(p.description || '')}</textarea>
        </section>

        <section class="stock-form-note">
          <strong>Regra do saldo seguro</strong>
          <span>Depois de criado, o saldo deve ser alterado por movimentação. O trigger do banco atualiza o estoque automaticamente.</span>
        </section>

        <div id="estoque-form-feedback" class="estoque-form-feedback"></div>

        <div class="modal-buttons stock-modal-actions">
          <button type="button" class="btn-cancel" id="${isEdit ? 'estoque-form-back' : 'estoque-form-cancel'}">${isEdit ? 'Voltar' : 'Cancelar'}</button>
          <button type="submit" class="btn-primary-gradient">${isEdit ? 'Salvar alterações' : 'Cadastrar produto'}</button>
        </div>
      </form>
    </div>
  `;
}

function renderMovementForm(product) {
  const action = getActionById(estoqueState.movementAction || 'purchase');
  const isAdjustment = action.id === 'adjustment';
  const valueLabel = action.id === 'sale' ? 'Preço de venda unitário (R$)' : action.id === 'purchase' ? 'Custo unitário (R$)' : 'Custo referência (R$)';
  const valueDefault = action.id === 'sale' ? product.sale_price : product.cost_price;

  return `
    <div class="estoque-modal-body stock-form-shell">
      <div class="stock-form-hero">
        <div>
          <div class="stock-section-title">Movimentação integrada</div>
          <h2>${escapeHtml(action.label)}</h2>
          <p>${escapeHtml(product.name)} · saldo atual ${escapeHtml(formatNumber(product.current_stock || 0))} ${escapeHtml(product.unit || 'un')}</p>
        </div>
      </div>

      <form id="estoque-movement-form" class="estoque-form">
        <section class="stock-form-section">
          <div class="stock-section-title">Tipo de movimento</div>
          <div class="stock-movement-type-grid">
            ${MOVEMENT_ACTIONS.map(item => `
              <button type="button" class="stock-movement-type ${item.id === action.id ? 'is-active' : ''}" data-select-movement-action="${escapeHtml(item.id)}">
                <strong>${escapeHtml(item.label)}</strong>
                <span>${item.direction === 'in' ? 'Aumenta saldo' : item.direction === 'out' ? 'Baixa saldo' : 'Define saldo final'}</span>
              </button>
            `).join('')}
          </div>
        </section>

        <section class="stock-form-section">
          <div class="stock-section-title">Quantidade e valor</div>
          <div class="estoque-form-grid">
            <div><div class="color-section-label">${isAdjustment ? 'Novo saldo final' : 'Quantidade'}</div><input class="modal-input" name="quantity" type="number" min="${isAdjustment ? '0' : '0.1'}" step="0.1" placeholder="0" /></div>
            <div><div class="color-section-label">${escapeHtml(valueLabel)}</div><input class="modal-input" name="unit_value" type="number" min="0" step="0.01" value="${escapeHtml(valueDefault ?? 0)}" /></div>
            ${action.createsTransaction ? `
              <div>
                <div class="color-section-label">Forma de pagamento</div>
                <select class="modal-input" name="payment_method">
                  <option value="">Não informar</option>
                  <option value="cash">Dinheiro</option>
                  <option value="credit_card">Crédito</option>
                  <option value="debit_card">Débito</option>
                  <option value="pix">Pix</option>
                  <option value="transfer">Transferência</option>
                  <option value="other">Outro</option>
                </select>
              </div>
              <div>
                <div class="color-section-label">Lançar financeiro?</div>
                <select class="modal-input" name="create_transaction">
                  <option value="true">Sim</option>
                  <option value="false">Não</option>
                </select>
              </div>
            ` : ''}
          </div>
        </section>

        <section class="stock-form-section">
          <div class="stock-section-title">Observação</div>
          <textarea class="modal-input estoque-textarea" name="notes" placeholder="Ex: fornecedor, venda balcão, perda por avaria, uso em atendimento..."></textarea>
        </section>

        <section class="stock-form-note">
          <strong>Impacto automático</strong>
          <span>
            ${action.direction === 'in' ? 'Esta entrada aumenta o saldo via trigger e pode gerar despesa no financeiro.' : ''}
            ${action.id === 'sale' ? 'Esta venda baixa estoque via trigger e pode gerar receita no financeiro.' : ''}
            ${action.id === 'internal_use' ? 'Este uso interno baixa estoque sem gerar receita.' : ''}
            ${action.id === 'loss' ? 'Esta perda baixa estoque e aparece no alerta de perdas.' : ''}
            ${action.direction === 'neutral' ? 'Este ajuste define o saldo final e mantém histórico de auditoria.' : ''}
          </span>
        </section>

        <div id="estoque-form-feedback" class="estoque-form-feedback"></div>

        <div class="modal-buttons stock-modal-actions">
          <button type="button" class="btn-cancel" id="estoque-movement-back">Voltar</button>
          <button type="submit" class="btn-primary-gradient">Registrar movimento</button>
        </div>
      </form>
    </div>
  `;
}

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

function openMovementModal(id, action = 'purchase') {
  estoqueState.activeProductId = id;
  estoqueState.movementAction = action;
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

  if (estoqueState.modalMode === 'create') content.innerHTML = renderProductForm('create');

  if (estoqueState.modalMode === 'movement') {
    if (!product) { closeEstoqueModal(); return; }
    content.innerHTML = renderMovementForm(product);
  }

  modal.style.display = 'flex';
  modal.classList.add('open');
  bindEstoqueModalEvents();
}

async function loadEstoqueData() {
  estoqueState.isLoading = true;
  rerenderEstoque();

  const query = new URLSearchParams();
  if (estoqueState.searchTerm) query.set('q', estoqueState.searchTerm);
  if (estoqueState.activeFilter) query.set('filter', estoqueState.activeFilter);

  try {
    const data = await apiFetch(`/api/stock/insights/list?${query.toString()}`);
    estoqueState.products = Array.isArray(data?.items) ? data.items : [];
    estoqueState.dashboard = data?.dashboard || buildFallbackDashboard(estoqueState.products);
    estoqueState.isLoaded = true;
  } catch (error) {
    console.warn('Falha ao carregar estoque inteligente. Usando rota simples.', error);
    try {
      const fallback = await apiFetch('/api/stock?includeInactive=true');
      estoqueState.products = normalizePlainProducts(fallback);
      estoqueState.dashboard = buildFallbackDashboard(estoqueState.products);
      estoqueState.isLoaded = true;
    } catch (fallbackError) {
      console.error('Erro ao carregar estoque:', fallbackError);
      estoqueState.products = [];
      estoqueState.dashboard = buildFallbackDashboard([]);
    }
  } finally {
    estoqueState.isLoading = false;
    rerenderEstoque();
  }
}

function collectProductPayload(form) {
  const formData = new FormData(form);
  return {
    name: String(formData.get('name') || '').trim(),
    brand: String(formData.get('brand') || '').trim() || null,
    category: String(formData.get('category') || '').trim() || null,
    unit: String(formData.get('unit') || 'un'),
    current_stock: Number(formData.get('current_stock') || 0),
    min_stock: Number(formData.get('min_stock') || 0),
    cost_price: Number(formData.get('cost_price') || 0),
    sale_price: Number(formData.get('sale_price') || 0),
    description: String(formData.get('description') || '').trim() || null,
    is_for_sale: String(formData.get('is_for_sale')) === 'true',
    is_active: String(formData.get('is_active')) !== 'false',
  };
}

function validateProductPayload(payload) {
  if (!payload.name) return 'Informe o nome do produto.';
  if (payload.cost_price < 0) return 'Custo não pode ser negativo.';
  if (payload.sale_price < 0) return 'Preço de venda não pode ser negativo.';
  if (payload.min_stock < 0) return 'Estoque mínimo não pode ser negativo.';
  return '';
}

async function handleCreateProduct(event) {
  event.preventDefault();
  const form = document.getElementById('estoque-form');
  const btn = form?.querySelector('button[type="submit"]');
  const payload = collectProductPayload(form);
  const validation = validateProductPayload(payload);

  if (validation) {
    setFeedback('estoque-form-feedback', validation, 'error');
    return;
  }

  try {
    if (btn) btn.disabled = true;
    setFeedback('estoque-form-feedback', 'Salvando...', 'neutral');
    await apiFetch('/api/stock', { method: 'POST', body: JSON.stringify(payload) });
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
  const btn = form?.querySelector('button[type="submit"]');
  const productId = estoqueState.activeProductId;
  const payload = collectProductPayload(form);
  const validation = validateProductPayload(payload);

  delete payload.current_stock;

  if (validation) {
    setFeedback('estoque-form-feedback', validation, 'error');
    return;
  }

  try {
    if (btn) btn.disabled = true;
    setFeedback('estoque-form-feedback', 'Salvando...', 'neutral');
    await apiFetch(`/api/stock/${productId}`, { method: 'PATCH', body: JSON.stringify(payload) });
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
  const btn = form?.querySelector('button[type="submit"]');
  const product = getProductById(estoqueState.activeProductId);
  const action = getActionById(estoqueState.movementAction || 'purchase');
  const quantity = Number(formData.get('quantity') || 0);
  const unitValue = Number(formData.get('unit_value') || 0);

  if (action.id === 'adjustment' ? quantity < 0 : quantity <= 0) {
    setFeedback('estoque-form-feedback', 'Informe uma quantidade válida.', 'error');
    return;
  }

  try {
    if (btn) btn.disabled = true;
    setFeedback('estoque-form-feedback', 'Registrando movimentação...', 'neutral');

    const body = {
      type: action.type,
      purpose: action.id,
      quantity,
      notes: String(formData.get('notes') || '').trim() || null,
      create_transaction: String(formData.get('create_transaction') || action.createsTransaction) === 'true',
      payment_method: String(formData.get('payment_method') || '') || null,
    };

    if (action.id === 'purchase') body.unit_cost = unitValue || Number(product?.cost_price || 0);
    else body.unit_cost = Number(product?.cost_price || 0);

    if (action.id === 'sale') body.sale_unit_price = unitValue || Number(product?.sale_price || 0);

    await apiFetch(`/api/stock/${estoqueState.activeProductId}/movement`, {
      method: 'POST',
      body: JSON.stringify(body),
    });

    closeEstoqueModal();
    await loadEstoqueData();
  } catch (error) {
    setFeedback('estoque-form-feedback', error instanceof Error ? error.message : 'Erro ao registrar.', 'error');
    if (btn) btn.disabled = false;
  }
}

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

  document.querySelectorAll('[data-movement-action]').forEach((btn) => {
    btn.addEventListener('click', () => openMovementModal(btn.dataset.productId, btn.dataset.movementAction));
  });

  document.querySelectorAll('[data-select-movement-action]').forEach((btn) => {
    btn.addEventListener('click', () => {
      estoqueState.movementAction = btn.dataset.selectMovementAction || 'purchase';
      renderEstoqueModal();
    });
  });

  document.getElementById('estoque-form-back')?.addEventListener('click', () => {
    if (estoqueState.activeProductId) openProductModal(estoqueState.activeProductId);
  });

  const productForm = document.getElementById('estoque-form');
  if (productForm) {
    if (estoqueState.modalMode === 'create') productForm.addEventListener('submit', handleCreateProduct);
    else if (estoqueState.modalMode === 'edit') productForm.addEventListener('submit', handleEditProduct);
  }

  document.getElementById('estoque-movement-form')?.addEventListener('submit', handleMovement);
}

function bindProductEvents() {
  document.querySelectorAll('.stock-card[data-product-id], .stock-ranking-row[data-product-id], .stock-attention-row[data-product-id]').forEach((btn) => {
    btn.addEventListener('click', () => openProductModal(btn.dataset.productId));
  });
}

function bindStockDynamicEvents() {
  document.querySelectorAll('[data-stock-filter]').forEach(button => {
    button.addEventListener('click', () => {
      estoqueState.activeFilter = button.dataset.stockFilter || 'all';
      persistStockFilter(estoqueState.activeFilter);
      loadEstoqueData();
    });
  });

  bindProductEvents();
}

const debouncedLoadStock = debounce(loadEstoqueData, 350);

function bindEstoqueStaticEvents() {
  document.getElementById('estoque-new-button')?.addEventListener('click', openCreateProductModal);

  document.getElementById('estoque-search-input')?.addEventListener('input', (event) => {
    estoqueState.searchTerm = event.target.value || '';
    debouncedLoadStock();
  });

  document.getElementById('estoque-details-modal')?.addEventListener('click', (e) => {
    if (e.target?.id === 'estoque-details-modal') closeEstoqueModal();
  });
}

function rerenderEstoque() {
  const cockpit = document.getElementById('stock-cockpit-wrap');
  const filters = document.getElementById('stock-filters-wrap');
  const list = document.getElementById('stock-products-list');
  const side = document.getElementById('stock-side-wrap');

  if (cockpit) cockpit.innerHTML = renderDashboardCards();
  if (filters) filters.innerHTML = renderFilters();
  if (list) list.innerHTML = renderProductsList();
  if (side) side.innerHTML = renderSidePanel();

  bindStockDynamicEvents();
}

export function renderEstoque() {
  return /* html */ `
<section class="page-shell page--estoque">
  <div class="stock-hero">
    <div>
      <div class="stock-section-title">Estoque inteligente</div>
      <h1>Central de estoque</h1>
      <p>Controle produtos, reposição, perdas, vendas, margem, giro e dinheiro parado sem planilha escondida.</p>
    </div>
    <button type="button" class="btn-primary-gradient" id="estoque-new-button">+ Novo produto</button>
  </div>

  <div id="stock-cockpit-wrap">${renderDashboardCards()}</div>

  <div class="stock-toolbar">
    <div class="stock-search-wrap">
      <span>🔍</span>
      <input id="estoque-search-input" class="stock-search-input" type="text" placeholder="Buscar por produto, marca, categoria, alerta ou status..." value="${escapeHtml(estoqueState.searchTerm)}" />
    </div>
  </div>

  <div id="stock-filters-wrap">${renderFilters()}</div>

  <div class="stock-layout">
    <div id="stock-products-list">${renderProductsList()}</div>
    <aside id="stock-side-wrap">${renderSidePanel()}</aside>
  </div>

  <div id="estoque-details-modal" class="modal-overlay" style="display:none;">
    <div class="modal stock-modal">
      <div id="estoque-details-content"></div>
    </div>
  </div>
</section>
  `;
}

export function initEstoquePage() {
  bindEstoqueStaticEvents();
  bindStockDynamicEvents();
  loadEstoqueData();
}
