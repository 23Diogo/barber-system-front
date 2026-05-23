import { apiFetch } from '../services/api.js';

// ─── State ────────────────────────────────────────────────────────────────────

const SERVICE_FILTER_STORAGE_KEY = 'barberflow.services.filter';

const SERVICE_FILTERS = [
  { id: 'all', label: 'Todos', hint: 'Catálogo completo' },
  { id: 'active', label: 'Ativos', hint: 'Disponíveis na agenda' },
  { id: 'inactive', label: 'Inativos', hint: 'Fora de venda' },
  { id: 'with_plan', label: 'Em planos', hint: 'Assinaturas' },
  { id: 'without_barber', label: 'Sem barbeiro', hint: 'Ajustar operação' },
  { id: 'best_sellers', label: 'Mais vendidos', hint: 'Histórico real' },
  { id: 'subscription_usage', label: 'Usados no clube', hint: 'Consumo de plano' },
  { id: 'long_duration', label: 'Longos', hint: 'Impactam agenda' },
  { id: 'attention', label: 'Atenção', hint: 'Revisar regra' },
];

const servicosState = {
  items: [],
  dashboard: null,
  isLoading: false,
  isLoaded: false,
  searchTerm: '',
  activeFilter: getInitialServiceFilter(),
  modalMode: 'closed', // closed | view | edit | create
  activeServiceId: null,
  detailService: null,
};

// ─── Helpers ──────────────────────────────────────────────────────────────────

function getInitialServiceFilter() {
  try {
    const stored = localStorage.getItem(SERVICE_FILTER_STORAGE_KEY);
    return SERVICE_FILTERS.some(item => item.id === stored) ? stored : 'all';
  } catch {
    return 'all';
  }
}

function persistServiceFilter(filter) {
  try {
    localStorage.setItem(SERVICE_FILTER_STORAGE_KEY, filter);
  } catch {
    // noop
  }
}

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
  }).format(Number(value || 0));
}

function formatCompactCurrency(value) {
  const amount = Number(value || 0);
  if (amount >= 1000) return `R$ ${amount.toFixed(1)}k`;
  return formatCurrency(amount);
}

function formatDateTime(value) {
  if (!value) return '—';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return String(value);

  return date.toLocaleString('pt-BR', {
    day: '2-digit',
    month: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  });
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
  el.style.color =
    variant === 'error' ? '#ff8a8a' :
    variant === 'success' ? '#00e676' :
    '#5a6888';
}

function getServiceById(id) {
  return servicosState.items.find(s => String(s.id) === String(id)) || null;
}

function getDashboardSafe() {
  return servicosState.dashboard || {
    total: 0,
    active: 0,
    inactive: 0,
    totalRevenue: 0,
    totalCompleted: 0,
    avgTicket: 0,
    avgPrice: 0,
    avgDuration: 0,
    activeWithoutBarber: 0,
    usedInPlans: 0,
    needsAttention: 0,
    topService: null,
  };
}

function getServiceStatusMeta(isActive) {
  return isActive !== false
    ? { label: 'Ativo', className: 'services-chip--success', icon: '✓' }
    : { label: 'Inativo', className: 'services-chip--danger', icon: '!' };
}

function getAlertToneMeta(tone) {
  const map = {
    success: { className: 'services-chip--success', icon: '✓' },
    info: { className: 'services-chip--info', icon: 'i' },
    warning: { className: 'services-chip--warning', icon: '!' },
    danger: { className: 'services-chip--danger', icon: '!' },
    purple: { className: 'services-chip--purple', icon: '✦' },
    gold: { className: 'services-chip--gold', icon: '★' },
    neutral: { className: 'services-chip--neutral', icon: '•' },
  };
  return map[tone] || map.neutral;
}

function getCategoryIcon(category) {
  const map = {
    corte: '✂️',
    cabelo: '✂️',
    barba: '🪒',
    combo: '💈',
    coloracao: '🎨',
    estetica: '✨',
    tratamento: '💆',
    acabamento: '💈',
    sobrancelha: '🪄',
  };
  const key = String(category || '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
  return Object.entries(map).find(([k]) => key.includes(k))?.[1] || '✂️';
}

function renderChip(label, className = 'services-chip--neutral', icon = '') {
  return `<span class="services-chip ${escapeHtml(className)}">${escapeHtml(icon)} ${escapeHtml(label)}</span>`;
}

function renderAlertChip(alert) {
  if (!alert) return '';
  const meta = getAlertToneMeta(alert.tone);
  return renderChip(alert.title, meta.className, meta.icon);
}

function buildProgressBar(value, variant = '') {
  const pct = Math.max(0, Math.min(100, Math.round(Number(value || 0))));
  return `
    <div class="services-progress ${escapeHtml(variant)}">
      <span style="width:${pct}%"></span>
    </div>
  `;
}

function getFilterMetric(filterId) {
  const dashboard = getDashboardSafe();
  const map = {
    all: dashboard.total,
    active: dashboard.active,
    inactive: dashboard.inactive,
    with_plan: dashboard.usedInPlans,
    without_barber: dashboard.activeWithoutBarber,
    best_sellers: dashboard.totalCompleted,
    subscription_usage: servicosState.items.filter(item => Number(item.metrics?.subscription_consumptions_count || 0) > 0).length,
    long_duration: servicosState.items.filter(item => Number(item.duration_min || 0) >= 60).length,
    attention: dashboard.needsAttention,
  };

  return map[filterId] ?? 0;
}

function normalizePlainServices(items) {
  const safeItems = Array.isArray(items) ? items : [];

  return safeItems.map(service => ({
    ...service,
    price_number: Number(service.price || 0),
    metrics: {
      appointments_count: 0,
      completed_count: 0,
      future_count: 0,
      revenue: 0,
      avg_ticket: 0,
      rating_avg: null,
      rating_count: 0,
      subscription_consumptions_count: 0,
      barbers_count: 0,
      plans_count: 0,
      last_sold_at: null,
      next_appointment_at: null,
    },
    barbers: [],
    plans: [],
    subscription_consumptions: [],
    recent_appointments: [],
    alerts: [],
    primary_alert: null,
    needs_attention: false,
  }));
}

function buildFallbackDashboard(items) {
  const safeItems = Array.isArray(items) ? items : [];
  const active = safeItems.filter(item => item.is_active !== false);
  const totalPrice = safeItems.reduce((sum, item) => sum + Number(item.price || 0), 0);
  const totalDuration = safeItems.reduce((sum, item) => sum + Number(item.duration_min || 0), 0);

  return {
    total: safeItems.length,
    active: active.length,
    inactive: safeItems.length - active.length,
    totalRevenue: 0,
    totalCompleted: 0,
    avgTicket: 0,
    avgPrice: safeItems.length ? totalPrice / safeItems.length : 0,
    avgDuration: safeItems.length ? totalDuration / safeItems.length : 0,
    activeWithoutBarber: 0,
    usedInPlans: 0,
    needsAttention: 0,
    topService: active[0] ? { id: active[0].id, name: active[0].name, revenue: 0, completed_count: 0 } : null,
  };
}

// ─── Render cards ─────────────────────────────────────────────────────────────

function renderDashboardCards() {
  const dashboard = getDashboardSafe();

  return `
    <div class="services-cockpit">
      <div class="services-metric services-metric--hero">
        <div class="services-metric-label">Serviços ativos</div>
        <div class="services-metric-value">${escapeHtml(dashboard.active)}</div>
        <div class="services-metric-sub">${escapeHtml(dashboard.total)} no catálogo · ${escapeHtml(dashboard.inactive)} inativo(s)</div>
      </div>
      <div class="services-metric">
        <div class="services-metric-label">Receita gerada</div>
        <div class="services-metric-value color-money">${escapeHtml(formatCompactCurrency(dashboard.totalRevenue))}</div>
        <div class="services-metric-sub">${escapeHtml(dashboard.totalCompleted)} atendimento(s) finalizado(s)</div>
      </div>
      <div class="services-metric">
        <div class="services-metric-label">Preço médio</div>
        <div class="services-metric-value color-info">${escapeHtml(formatCurrency(dashboard.avgPrice))}</div>
        <div class="services-metric-sub">Ticket médio ${escapeHtml(formatCurrency(dashboard.avgTicket))}</div>
      </div>
      <div class="services-metric">
        <div class="services-metric-label">Duração média</div>
        <div class="services-metric-value color-purple">${escapeHtml(Math.round(dashboard.avgDuration || 0))} min</div>
        <div class="services-metric-sub">${escapeHtml(dashboard.activeWithoutBarber)} sem barbeiro · ${escapeHtml(dashboard.usedInPlans)} em planos</div>
      </div>
    </div>
  `;
}

function renderFilters() {
  return `
    <div class="services-filters">
      ${SERVICE_FILTERS.map(filter => `
        <button
          type="button"
          class="services-filter ${servicosState.activeFilter === filter.id ? 'is-active' : ''}"
          data-service-filter="${escapeHtml(filter.id)}"
        >
          <span>${escapeHtml(filter.label)}</span>
          <strong>${escapeHtml(getFilterMetric(filter.id))}</strong>
          <small>${escapeHtml(filter.hint)}</small>
        </button>
      `).join('')}
    </div>
  `;
}

function renderServiceCard(service) {
  const statusMeta = getServiceStatusMeta(service.is_active);
  const icon = getCategoryIcon(service.category);
  const metrics = service.metrics || {};
  const chips = [
    renderChip(statusMeta.label, statusMeta.className, statusMeta.icon),
    Number(metrics.plans_count || 0) > 0 ? renderChip('Em planos', 'services-chip--purple', '✦') : '',
    Number(metrics.barbers_count || 0) > 0 ? renderChip(`${metrics.barbers_count} barbeiro(s)`, 'services-chip--info', '👤') : renderChip('Sem barbeiro', 'services-chip--warning', '!'),
    service.primary_alert ? renderAlertChip(service.primary_alert) : '',
  ].filter(Boolean);

  const completed = Number(metrics.completed_count || 0);
  const future = Number(metrics.future_count || 0);
  const revenue = Number(metrics.revenue || 0);
  const demandScore = Math.min(100, completed * 20 + future * 12 + Number(metrics.subscription_consumptions_count || 0) * 14);

  return `
    <button type="button" class="services-card" data-service-id="${escapeHtml(service.id)}">
      <div class="services-card-icon">${icon}</div>

      <div class="services-card-main">
        <div class="services-card-top">
          <div>
            <div class="services-card-name">${escapeHtml(service.name)}</div>
            <div class="services-card-sub">
              ${escapeHtml(service.duration_min || 0)} min
              ${service.category ? ` · ${escapeHtml(service.category)}` : ''}
            </div>
          </div>
          <div class="services-card-price">${escapeHtml(formatCurrency(service.price))}</div>
        </div>

        <div class="services-card-chips">${chips.join('')}</div>

        <div class="services-card-grid">
          <span><small>Receita</small><strong>${escapeHtml(formatCurrency(revenue))}</strong></span>
          <span><small>Vendas</small><strong>${escapeHtml(completed)}</strong></span>
          <span><small>Planos</small><strong>${escapeHtml(metrics.plans_count || 0)}</strong></span>
          <span><small>Agenda futura</small><strong>${escapeHtml(future)}</strong></span>
        </div>

        <div class="services-demand-strip">
          <div>
            <strong>Força operacional</strong>
            <small>
              ${completed ? `${completed} venda(s) finalizada(s)` : 'Sem vendas finalizadas ainda'}
              · ${metrics.subscription_consumptions_count || 0} consumo(s) de assinatura
            </small>
          </div>
          <div class="services-demand-meter">
            <span>${escapeHtml(demandScore)}%</span>
            ${buildProgressBar(demandScore, 'services-progress--demand')}
          </div>
        </div>

        ${service.primary_alert ? `
          <div class="services-alert services-alert--${escapeHtml(service.primary_alert.tone || 'neutral')}">
            <strong>${escapeHtml(service.primary_alert.title)}</strong>
            <span>${escapeHtml(service.primary_alert.message)}</span>
          </div>
        ` : ''}
      </div>
    </button>
  `;
}

function renderServicesList() {
  if (servicosState.isLoading) {
    return `
      <div class="services-empty">
        <strong>Carregando serviços...</strong>
        <span>Buscando agenda, planos, consumo, barbeiros e alertas operacionais.</span>
      </div>
    `;
  }

  if (!servicosState.items.length) {
    return `
      <div class="services-empty">
        <strong>Nenhum serviço neste filtro</strong>
        <span>Tente outro filtro ou cadastre um novo serviço para começar.</span>
      </div>
    `;
  }

  return `
    <div class="services-list-head">
      <div>
        <strong>Catálogo operacional</strong>
        <span>${escapeHtml(servicosState.items.length)} serviço(s) encontrado(s)</span>
      </div>
    </div>

    <div class="services-list">
      ${servicosState.items.map(renderServiceCard).join('')}
    </div>
  `;
}

function renderSidePanel() {
  const dashboard = getDashboardSafe();
  const sortedByRevenue = [...servicosState.items].sort((a, b) => Number(b.metrics?.revenue || 0) - Number(a.metrics?.revenue || 0));
  const attention = servicosState.items.filter(item => item.needs_attention).slice(0, 4);

  return `
    <div class="services-side-grid">
      <div class="services-side-card services-side-card--spotlight">
        <div class="services-section-title">Mais forte do catálogo</div>
        ${dashboard.topService ? `
          <div class="services-spotlight">
            <strong>${escapeHtml(dashboard.topService.name)}</strong>
            <span>${escapeHtml(formatCurrency(dashboard.topService.revenue))} · ${escapeHtml(dashboard.topService.completed_count)} venda(s)</span>
          </div>
        ` : `
          <div class="services-side-empty">Sem histórico de venda ainda.</div>
        `}
      </div>

      <div class="services-side-card">
        <div class="services-section-title">Ranking operacional</div>
        <div class="services-ranking">
          ${sortedByRevenue.length ? sortedByRevenue.slice(0, 5).map((service, index) => {
            const revenue = Number(service.metrics?.revenue || 0);
            const maxRevenue = Math.max(Number(sortedByRevenue[0]?.metrics?.revenue || 0), Number(service.price || 0), 1);
            const width = Math.max((Math.max(revenue, Number(service.price || 0)) / maxRevenue) * 100, 8);

            return `
              <div class="services-ranking-row">
                <div class="services-ranking-index">${index + 1}</div>
                <div class="services-ranking-main">
                  <strong>${escapeHtml(service.name)}</strong>
                  <span>${escapeHtml(service.duration_min || 0)} min · ${escapeHtml(formatCurrency(service.price))}</span>
                  ${buildProgressBar(width, '')}
                </div>
              </div>
            `;
          }).join('') : '<div class="services-side-empty">Nenhum serviço cadastrado.</div>'}
        </div>
      </div>

      <div class="services-side-card">
        <div class="services-section-title">Atenção do dono</div>
        <div class="services-attention-list">
          ${attention.length ? attention.map(service => `
            <button type="button" class="services-attention-row" data-service-id="${escapeHtml(service.id)}">
              <strong>${escapeHtml(service.name)}</strong>
              <span>${escapeHtml(service.primary_alert?.title || 'Revisar serviço')}</span>
            </button>
          `).join('') : '<div class="services-side-empty">Nenhum alerta crítico no catálogo.</div>'}
        </div>
      </div>
    </div>
  `;
}

// ─── Modal renders ────────────────────────────────────────────────────────────

function renderServiceDetails(service) {
  const statusMeta = getServiceStatusMeta(service.is_active);
  const icon = getCategoryIcon(service.category);
  const metrics = service.metrics || {};
  const alerts = Array.isArray(service.alerts) ? service.alerts : [];
  const barbers = Array.isArray(service.barbers) ? service.barbers : [];
  const plans = Array.isArray(service.plans) ? service.plans : [];
  const appointments = Array.isArray(service.recent_appointments) ? service.recent_appointments : [];

  return `
    <div class="service-detail">
      <div class="service-detail-hero">
        <div class="services-card-icon services-card-icon--large">${icon}</div>
        <div class="service-detail-main">
          <div class="services-section-title">Ficha operacional do serviço</div>
          <h2>${escapeHtml(service.name)}</h2>
          <p>${escapeHtml(service.description || 'Sem descrição cadastrada.')}</p>
          <div class="services-card-chips">
            ${renderChip(statusMeta.label, statusMeta.className, statusMeta.icon)}
            ${renderChip(`${service.duration_min || 0} min`, 'services-chip--info', '⏱')}
            ${service.category ? renderChip(service.category, 'services-chip--neutral', '•') : ''}
            ${service.primary_alert ? renderAlertChip(service.primary_alert) : ''}
          </div>
        </div>
        <div class="service-detail-price">
          <small>Preço de venda</small>
          <strong>${escapeHtml(formatCurrency(service.price))}</strong>
          <span>${escapeHtml(metrics.completed_count || 0)} venda(s) · ${escapeHtml(formatCurrency(metrics.revenue || 0))}</span>
        </div>
      </div>

      <div class="services-detail-grid">
        <div class="mini-card"><div class="mini-lbl">Receita</div><div class="mini-val color-money">${escapeHtml(formatCurrency(metrics.revenue || 0))}</div></div>
        <div class="mini-card"><div class="mini-lbl">Atendimentos</div><div class="mini-val">${escapeHtml(metrics.appointments_count || 0)}</div></div>
        <div class="mini-card"><div class="mini-lbl">Barbeiros</div><div class="mini-val color-info">${escapeHtml(metrics.barbers_count || 0)}</div></div>
        <div class="mini-card"><div class="mini-lbl">Planos</div><div class="mini-val color-purple">${escapeHtml(metrics.plans_count || 0)}</div></div>
      </div>

      <div class="services-detail-columns">
        <section class="services-panel">
          <div class="services-section-title">Alertas inteligentes</div>
          ${alerts.length ? alerts.map(alert => `
            <div class="services-detail-alert services-detail-alert--${escapeHtml(alert.tone)}">
              <strong>${escapeHtml(alert.title)}</strong>
              <span>${escapeHtml(alert.message)}</span>
            </div>
          `).join('') : '<div class="services-side-empty">Nenhum alerta para este serviço.</div>'}
        </section>

        <section class="services-panel">
          <div class="services-section-title">Leitura para o dono</div>
          <div class="services-owner-reading">
            <strong>${escapeHtml(service.name)} está ${service.is_active !== false ? 'disponível' : 'inativo'}.</strong>
            <span>
              Preço: ${escapeHtml(formatCurrency(service.price))} · Duração: ${escapeHtml(service.duration_min || 0)} min ·
              ${barbers.length ? `${barbers.length} barbeiro(s) vinculado(s)` : 'nenhum barbeiro vinculado'} ·
              ${plans.length ? `${plans.length} plano(s) usando o serviço` : 'não usado em planos'}.
            </span>
          </div>
        </section>
      </div>

      <div class="services-detail-columns">
        <section class="services-panel">
          <div class="services-section-title">Barbeiros habilitados</div>
          <div class="services-detail-list">
            ${barbers.length ? barbers.map(barber => `
              <div class="services-detail-row">
                <div>
                  <strong>${escapeHtml(barber.name)}</strong>
                  <span>${barber.custom_price ? `Preço customizado ${escapeHtml(formatCurrency(barber.custom_price))}` : 'Usa preço padrão do serviço'}</span>
                </div>
              </div>
            `).join('') : '<div class="services-side-empty">Nenhum barbeiro vinculado ainda.</div>'}
          </div>
        </section>

        <section class="services-panel">
          <div class="services-section-title">Planos e assinaturas</div>
          <div class="services-detail-list">
            ${plans.length ? plans.map(plan => `
              <div class="services-detail-row">
                <div>
                  <strong>${escapeHtml(plan.name)}</strong>
                  <span>${escapeHtml(plan.included_quantity || 0)} uso(s) incluído(s) · ${plan.is_active === false ? 'plano inativo' : 'plano ativo'}</span>
                </div>
              </div>
            `).join('') : '<div class="services-side-empty">Este serviço ainda não está vinculado em planos.</div>'}
          </div>
        </section>
      </div>

      <section class="services-panel">
        <div class="services-section-title">Histórico recente</div>
        <div class="services-detail-list">
          ${appointments.length ? appointments.map(item => `
            <div class="services-detail-row">
              <div>
                <strong>${escapeHtml(formatDateTime(item.scheduled_at))}</strong>
                <span>Status ${escapeHtml(item.status || '—')} · ${escapeHtml(formatCurrency(item.final_price || item.price || 0))}</span>
              </div>
            </div>
          `).join('') : '<div class="services-side-empty">Nenhum atendimento recente para este serviço.</div>'}
        </div>
      </section>

      <div id="service-modal-feedback" class="svc-form-feedback"></div>

      <div class="modal-buttons services-modal-actions">
        <button type="button" class="btn-cancel" id="service-modal-close">Fechar</button>
        <button type="button" class="clients-action-btn" id="service-toggle-btn"
          data-service-id="${escapeHtml(service.id)}"
          data-is-active="${escapeHtml(service.is_active !== false)}">
          ${service.is_active !== false ? 'Desativar' : 'Ativar'}
        </button>
        <button type="button" class="btn-primary-gradient" id="service-edit-button" data-service-id="${escapeHtml(service.id)}">
          Editar serviço
        </button>
      </div>
    </div>
  `;
}

function renderServiceForm(mode, service = null) {
  const isEdit = mode === 'edit';
  const s = service || {};

  return `
    <div class="svc-modal-body services-form-shell">
      <div class="services-form-hero">
        <div>
          <div class="services-section-title">${isEdit ? 'Ajuste de catálogo' : 'Novo serviço'}</div>
          <h2>${isEdit ? 'Editar serviço' : 'Cadastrar serviço'}</h2>
          <p>Configure preço, duração e regras básicas. Isso impacta agenda, planos, consumo e comissão.</p>
        </div>
      </div>

      <form id="service-form" class="svc-form">
        <div class="services-form-steps">
          <div class="services-form-step is-active"><strong>1</strong><span>Identidade</span></div>
          <div class="services-form-step is-active"><strong>2</strong><span>Operação</span></div>
          <div class="services-form-step is-active"><strong>3</strong><span>Revisão</span></div>
        </div>

        <section class="services-form-section">
          <div class="services-section-title">Identidade do serviço</div>
          <div class="svc-form-grid">
            <div>
              <div class="color-section-label">Nome</div>
              <input class="modal-input" name="name" type="text" value="${escapeHtml(s.name || '')}" placeholder="Ex: Corte simples" />
            </div>
            <div>
              <div class="color-section-label">Categoria</div>
              <input class="modal-input" name="category" type="text" value="${escapeHtml(s.category || '')}" placeholder="Ex: Corte, Barba, Combo..." />
            </div>
          </div>
          <div>
            <div class="color-section-label">Descrição</div>
            <textarea class="modal-input svc-textarea" name="description" placeholder="Explique o serviço de forma simples para dono e cliente">${escapeHtml(s.description || '')}</textarea>
          </div>
        </section>

        <section class="services-form-section">
          <div class="services-section-title">Preço, agenda e status</div>
          <div class="svc-form-grid">
            <div>
              <div class="color-section-label">Preço (R$)</div>
              <input class="modal-input" name="price" type="number" min="0" step="0.01" value="${escapeHtml(s.price ?? 0)}" />
            </div>
            <div>
              <div class="color-section-label">Duração (min)</div>
              <input class="modal-input" name="duration_min" type="number" min="5" step="5" value="${escapeHtml(s.duration_min ?? 30)}" />
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
        </section>

        <section class="services-form-section services-form-note">
          <strong>Leitura operacional</strong>
          <span>
            Serviço ativo aparece para agenda e pode alimentar plano, consumo e comissão.
            Serviços sem barbeiro vinculado serão sinalizados como atenção na tela.
          </span>
        </section>

        <div id="service-form-feedback" class="svc-form-feedback"></div>

        <div class="modal-buttons services-modal-actions">
          <button type="button" class="btn-cancel" id="${isEdit ? 'service-form-back' : 'service-form-cancel'}">
            ${isEdit ? 'Voltar' : 'Cancelar'}
          </button>
          <button type="submit" class="btn-primary-gradient">${isEdit ? 'Salvar alterações' : 'Cadastrar serviço'}</button>
        </div>
      </form>
    </div>
  `;
}

// ─── Modal control ────────────────────────────────────────────────────────────

function openServiceModal(id) {
  servicosState.activeServiceId = id;
  servicosState.detailService = getServiceById(id);
  servicosState.modalMode = 'view';
  renderServiceModal();
}

function openCreateServiceModal() {
  servicosState.activeServiceId = null;
  servicosState.detailService = null;
  servicosState.modalMode = 'create';
  renderServiceModal();
}

function openEditServiceModal(id) {
  servicosState.activeServiceId = id;
  servicosState.detailService = getServiceById(id);
  servicosState.modalMode = 'edit';
  renderServiceModal();
}

function closeServiceModal() {
  const modal = document.getElementById('service-details-modal');
  const content = document.getElementById('service-details-content');
  if (!modal) return;

  servicosState.modalMode = 'closed';
  servicosState.activeServiceId = null;
  servicosState.detailService = null;
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

  const query = new URLSearchParams();
  if (servicosState.searchTerm) query.set('q', servicosState.searchTerm);
  if (servicosState.activeFilter) query.set('filter', servicosState.activeFilter);

  try {
    const data = await apiFetch(`/api/services/insights/list?${query.toString()}`);
    servicosState.items = Array.isArray(data?.items) ? data.items : [];
    servicosState.dashboard = data?.dashboard || buildFallbackDashboard(servicosState.items);
    servicosState.isLoaded = true;
  } catch (error) {
    console.warn('Falha ao carregar insights de serviços. Usando rota simples.', error);

    try {
      const fallback = await apiFetch('/api/services?includeInactive=true');
      servicosState.items = normalizePlainServices(fallback);
      servicosState.dashboard = buildFallbackDashboard(servicosState.items);
      servicosState.isLoaded = true;
    } catch (fallbackError) {
      console.error('Erro ao carregar serviços:', fallbackError);
      servicosState.items = [];
      servicosState.dashboard = buildFallbackDashboard([]);
    }
  } finally {
    servicosState.isLoading = false;
    rerenderServicos();
  }
}

function collectServicePayload(form) {
  const formData = new FormData(form);
  return {
    name: String(formData.get('name') || '').trim(),
    price: Number(formData.get('price') || 0),
    duration_min: Number(formData.get('duration_min') || 30),
    category: String(formData.get('category') || '').trim() || null,
    description: String(formData.get('description') || '').trim() || null,
    sort_order: Number(formData.get('sort_order') || 0),
    is_active: String(formData.get('is_active')) === 'true',
  };
}

function validateServicePayload(payload) {
  if (!payload.name) return 'Informe o nome do serviço.';
  if (payload.price <= 0) return 'Informe um preço válido.';
  if (payload.duration_min <= 0) return 'Informe uma duração válida.';
  return '';
}

async function handleCreateService(event) {
  event.preventDefault();
  const form = document.getElementById('service-form');
  const btn = form?.querySelector('button[type="submit"]');
  const payload = collectServicePayload(form);
  const validation = validateServicePayload(payload);

  if (validation) {
    setFeedback('service-form-feedback', validation, 'error');
    return;
  }

  try {
    if (btn) btn.disabled = true;
    setFeedback('service-form-feedback', 'Salvando...', 'neutral');

    await apiFetch('/api/services', {
      method: 'POST',
      body: JSON.stringify(payload),
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
  const btn = form?.querySelector('button[type="submit"]');
  const serviceId = servicosState.activeServiceId;
  const payload = collectServicePayload(form);
  const validation = validateServicePayload(payload);

  if (validation) {
    setFeedback('service-form-feedback', validation, 'error');
    return;
  }

  try {
    if (btn) btn.disabled = true;
    setFeedback('service-form-feedback', 'Salvando...', 'neutral');

    await apiFetch(`/api/services/${serviceId}`, {
      method: 'PATCH',
      body: JSON.stringify(payload),
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
  document.querySelectorAll('.services-card[data-service-id], .services-attention-row[data-service-id]').forEach((btn) => {
    btn.addEventListener('click', () => openServiceModal(btn.dataset.serviceId));
  });
}

function bindServicosDynamicEvents() {
  document.querySelectorAll('[data-service-filter]').forEach(button => {
    button.addEventListener('click', () => {
      const filter = button.dataset.serviceFilter || 'all';
      servicosState.activeFilter = filter;
      persistServiceFilter(filter);
      loadServicosData();
    });
  });

  bindServicosListEvents();
}

const debouncedLoadServicos = debounce(loadServicosData, 350);

function bindServicosStaticEvents() {
  document.getElementById('service-new-button')?.addEventListener('click', openCreateServiceModal);

  document.getElementById('service-search-input')?.addEventListener('input', (event) => {
    servicosState.searchTerm = event.target.value || '';
    debouncedLoadServicos();
  });

  document.getElementById('service-details-modal')?.addEventListener('click', (e) => {
    if (e.target?.id === 'service-details-modal') closeServiceModal();
  });
}

// ─── Render ───────────────────────────────────────────────────────────────────

function rerenderServicos() {
  const cockpit = document.getElementById('services-cockpit-wrap');
  const filters = document.getElementById('services-filters-wrap');
  const list = document.getElementById('services-list-wrap');
  const side = document.getElementById('services-side-wrap');

  if (cockpit) cockpit.innerHTML = renderDashboardCards();
  if (filters) filters.innerHTML = renderFilters();
  if (list) list.innerHTML = renderServicesList();
  if (side) side.innerHTML = renderSidePanel();

  bindServicosDynamicEvents();
}

export function renderServicos() {
  return /* html */ `
<section class="page-shell page--servicos">
  <div class="services-hero">
    <div>
      <div class="services-section-title">Catálogo inteligente</div>
      <h1>Central de serviços</h1>
      <p>Controle preço, duração, agenda, planos, barbeiros e leitura operacional em uma única tela.</p>
    </div>
    <button type="button" class="btn-primary-gradient" id="service-new-button">+ Novo serviço</button>
  </div>

  <div id="services-cockpit-wrap">
    ${renderDashboardCards()}
  </div>

  <div class="services-toolbar">
    <div class="services-search-wrap">
      <span>🔍</span>
      <input
        id="service-search-input"
        class="services-search-input"
        type="text"
        placeholder="Buscar por serviço, categoria, plano, barbeiro ou alerta..."
        value="${escapeHtml(servicosState.searchTerm)}"
      />
    </div>
  </div>

  <div id="services-filters-wrap">
    ${renderFilters()}
  </div>

  <div class="services-layout">
    <div id="services-list-wrap">
      ${renderServicesList()}
    </div>
    <aside id="services-side-wrap">
      ${renderSidePanel()}
    </aside>
  </div>

  <div id="service-details-modal" class="modal-overlay" style="display:none;">
    <div class="modal services-modal">
      <div id="service-details-content"></div>
    </div>
  </div>
</section>
  `;
}

export function initServicosPage() {
  bindServicosStaticEvents();
  bindServicosDynamicEvents();
  loadServicosData();
}
