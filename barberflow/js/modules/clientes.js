import {
  hasApiConfig,
  hasAuthToken,
  apiFetch,
  getClientsPremium,
  getClientPremiumById,
  createClient,
  updateClient,
} from '../services/api.js';

const CLIENT_NAME_MAX_LENGTH = 100;
const CLIENT_PHONE_MAX_LENGTH = 20;
const CLIENT_WHATSAPP_MAX_LENGTH = 20;
const CLIENT_NOTES_MAX_LENGTH = 500;
const CLIENT_FILTER_STORAGE_KEY = 'barberflow.clients.premiumFilter';

const CLIENT_FILTERS = [
  { id: 'all', label: 'Todos', hint: 'Carteira completa' },
  { id: 'active', label: 'Ativos', hint: 'Clientes habilitados' },
  { id: 'inactive', label: 'Inativos', hint: 'Cadastro inativo' },
  { id: 'with_plan', label: 'Com plano', hint: 'Recorrência ativa' },
  { id: 'without_plan', label: 'Sem plano', hint: 'Potencial de venda' },
  { id: 'birthday', label: 'Aniversariantes', hint: 'Mimo do mês' },
  { id: 'lost', label: 'Sumidos', hint: 'Reativação' },
  { id: 'vip', label: 'VIP', hint: 'Alto valor' },
  { id: 'high_usage', label: 'Uso alto', hint: 'Margem do plano' },
  { id: 'pays_no_use', label: 'Paga e não usa', hint: 'Retenção saudável' },
  { id: 'billing_risk', label: 'Risco cobrança', hint: 'Pendência financeira' },
  { id: 'campaign', label: 'Campanha', hint: 'Bom para WhatsApp' },
];

const clientesState = {
  items: [],
  dashboard: null,
  searchTerm: '',
  activeFilter: getInitialFilter(),
  isLoading: false,
  isLoaded: false,
  modalMode: 'closed',
  activeClientId: null,
  detailClient: null,
  isDetailLoading: false,
};

function getInitialFilter() {
  try {
    const stored = localStorage.getItem(CLIENT_FILTER_STORAGE_KEY);
    return CLIENT_FILTERS.some(item => item.id === stored) ? stored : 'all';
  } catch {
    return 'all';
  }
}

function persistFilter(filter) {
  try {
    localStorage.setItem(CLIENT_FILTER_STORAGE_KEY, filter);
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
  return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(Number(value || 0));
}

function formatCurrencyFromCents(cents) {
  return formatCurrency(Number(cents || 0) / 100);
}

function formatCompactCurrency(value) {
  const amount = Number(value || 0);
  if (amount >= 1000) return `R$${amount.toFixed(1)}k`;
  return formatCurrency(amount);
}

function formatDateDisplay(value) {
  if (!value) return '—';
  const raw = String(value).trim();

  if (/^\d{4}-\d{2}-\d{2}$/.test(raw)) {
    const [year, month, day] = raw.split('-').map(Number);
    const localDate = new Date(year, month - 1, day);
    if (!Number.isNaN(localDate.getTime())) return localDate.toLocaleDateString('pt-BR');
  }

  const date = new Date(raw);
  if (Number.isNaN(date.getTime())) return raw;

  return date.toLocaleDateString('pt-BR');
}

function formatDateTimeDisplay(value) {
  if (!value) return '—';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return String(value);

  return date.toLocaleString('pt-BR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

function formatPhone(value) {
  const raw = String(value || '').replace(/\D/g, '');
  if (!raw) return '—';
  if (raw.length === 11) return `(${raw.slice(0, 2)}) ${raw.slice(2, 7)}-${raw.slice(7)}`;
  if (raw.length === 10) return `(${raw.slice(0, 2)}) ${raw.slice(2, 6)}-${raw.slice(6)}`;
  return value;
}

function getClientInitials(name) {
  const parts = String(name || 'CL').trim().split(/\s+/).filter(Boolean);
  return parts.slice(0, 2).map(part => part[0]?.toUpperCase() || '').join('') || 'CL';
}

function getFilterById(filterId) {
  return CLIENT_FILTERS.find(item => item.id === filterId) || CLIENT_FILTERS[0];
}

function getToneMeta(tone) {
  const map = {
    success: { className: 'clients-premium-chip--success', icon: '✓' },
    warning: { className: 'clients-premium-chip--warning', icon: '!' },
    danger: { className: 'clients-premium-chip--danger', icon: '!' },
    info: { className: 'clients-premium-chip--info', icon: 'i' },
    purple: { className: 'clients-premium-chip--purple', icon: '✦' },
    gold: { className: 'clients-premium-chip--gold', icon: '★' },
    neutral: { className: 'clients-premium-chip--neutral', icon: '•' },
  };
  return map[tone] || map.neutral;
}

function getClientStatusMeta(client) {
  if (client?.intelligence?.isVip) return { label: 'VIP', className: 'clients-premium-chip--gold', icon: '★' };
  if (client?.is_active === false) return { label: 'Inativo', className: 'clients-premium-chip--warning', icon: '!' };
  return { label: 'Ativo', className: 'clients-premium-chip--success', icon: '✓' };
}

function getSubscriptionStatusMeta(status) {
  const map = {
    active: { label: 'Ativa', className: 'clients-premium-chip--success' },
    trialing: { label: 'Trial', className: 'clients-premium-chip--purple' },
    past_due: { label: 'Inadimplente', className: 'clients-premium-chip--danger' },
    paused: { label: 'Pausada', className: 'clients-premium-chip--warning' },
    canceled: { label: 'Cancelada', className: 'clients-premium-chip--neutral' },
    pending_activation: { label: 'Pendente', className: 'clients-premium-chip--info' },
  };
  return map[status] || map.pending_activation;
}

function getInvoiceStatusMeta(status) {
  const map = {
    paid: { label: 'Pago', className: 'clients-premium-chip--success' },
    pending: { label: 'Pendente', className: 'clients-premium-chip--warning' },
    failed: { label: 'Falhou', className: 'clients-premium-chip--danger' },
    canceled: { label: 'Cancelado', className: 'clients-premium-chip--neutral' },
    cancelled: { label: 'Cancelado', className: 'clients-premium-chip--neutral' },
    expired: { label: 'Expirado', className: 'clients-premium-chip--danger' },
  };
  return map[status] || map.pending;
}

function getAppointmentStatusMeta(status) {
  const map = {
    completed: { label: 'Feito', className: 'clients-premium-chip--success' },
    confirmed: { label: 'Confirmado', className: 'clients-premium-chip--purple' },
    pending: { label: 'Agendado', className: 'clients-premium-chip--info' },
    in_progress: { label: 'Em andamento', className: 'clients-premium-chip--info' },
    cancelled: { label: 'Cancelado', className: 'clients-premium-chip--danger' },
    no_show: { label: 'No-show', className: 'clients-premium-chip--warning' },
  };
  return map[status] || map.pending;
}

function renderChip(label, tone = 'neutral', icon = '') {
  const meta = getToneMeta(tone);
  return `<span class="clients-premium-chip ${meta.className}">${escapeHtml(icon || meta.icon)} ${escapeHtml(label)}</span>`;
}

function renderClassChip(label, className, icon = '') {
  return `<span class="clients-premium-chip ${escapeHtml(className)}">${escapeHtml(icon)} ${escapeHtml(label)}</span>`;
}

function buildProgressBar(value, className = '') {
  const pct = Math.max(0, Math.min(100, Math.round(Number(value || 0))));
  return `
    <div class="clients-premium-progress ${escapeHtml(className)}">
      <span style="width:${pct}%"></span>
    </div>
  `;
}

function getDashboardSafe() {
  return clientesState.dashboard || {
    total: 0,
    active: 0,
    inactive: 0,
    withPlan: 0,
    withoutPlan: 0,
    birthdays: 0,
    lost: 0,
    vip: 0,
    highUsage: 0,
    paysNoUse: 0,
    billingRisk: 0,
    campaign: 0,
    totalSpent: 0,
    avgTicket: 0,
  };
}

function getClientMetricByFilter(filterId, dashboard = getDashboardSafe()) {
  const map = {
    all: dashboard.total,
    active: dashboard.active,
    inactive: dashboard.inactive,
    with_plan: dashboard.withPlan,
    without_plan: dashboard.withoutPlan,
    birthday: dashboard.birthdays,
    lost: dashboard.lost,
    vip: dashboard.vip,
    high_usage: dashboard.highUsage,
    pays_no_use: dashboard.paysNoUse,
    billing_risk: dashboard.billingRisk,
    campaign: dashboard.campaign,
  };
  return map[filterId] ?? 0;
}

function renderConfigHint(title, body, showAuthButton = false) {
  return `
    <div class="card clients-premium-empty-card">
      <strong>${escapeHtml(title)}</strong>
      <span>${escapeHtml(body)}</span>
      ${showAuthButton ? '<button class="dev-auth-inline-btn" type="button" data-open-auth-modal="true">Conectar API agora</button>' : ''}
    </div>
  `;
}

function renderDashboardCards() {
  const dashboard = getDashboardSafe();

  return `
    <div class="clients-premium-metrics">
      <div class="clients-premium-metric clients-premium-metric--hero">
        <div class="clients-premium-metric-label">Clientes na carteira</div>
        <div class="clients-premium-metric-value">${escapeHtml(dashboard.total)}</div>
        <div class="clients-premium-metric-sub">Base total do relacionamento</div>
      </div>
      <div class="clients-premium-metric">
        <div class="clients-premium-metric-label">Com plano</div>
        <div class="clients-premium-metric-value color-up">${escapeHtml(dashboard.withPlan)}</div>
        <div class="clients-premium-metric-sub">Recorrência ativa ou pendente</div>
      </div>
      <div class="clients-premium-metric">
        <div class="clients-premium-metric-label">Sumidos</div>
        <div class="clients-premium-metric-value color-dn">${escapeHtml(dashboard.lost)}</div>
        <div class="clients-premium-metric-sub">Precisam de reativação</div>
      </div>
      <div class="clients-premium-metric">
        <div class="clients-premium-metric-label">Receita histórica</div>
        <div class="clients-premium-metric-value color-money">${escapeHtml(formatCompactCurrency(dashboard.totalSpent))}</div>
        <div class="clients-premium-metric-sub">Ticket médio ${escapeHtml(formatCurrency(dashboard.avgTicket))}</div>
      </div>
    </div>
  `;
}

function renderFilters() {
  return `
    <div class="clients-premium-filters">
      ${CLIENT_FILTERS.map(filter => `
        <button
          type="button"
          class="clients-premium-filter ${clientesState.activeFilter === filter.id ? 'is-active' : ''}"
          data-client-filter="${escapeHtml(filter.id)}"
        >
          <span>${escapeHtml(filter.label)}</span>
          <strong>${escapeHtml(getClientMetricByFilter(filter.id))}</strong>
          <small>${escapeHtml(filter.hint)}</small>
        </button>
      `).join('')}
    </div>
  `;
}

function getClientAlert(client) {
  return client?.intelligence?.primaryAlert || null;
}

function renderClientCard(client) {
  const statusMeta = getClientStatusMeta(client);
  const subscription = client.active_subscription;
  const usage = subscription?.usage;
  const alert = getClientAlert(client);
  const subscriptionStatus = subscription ? getSubscriptionStatusMeta(subscription.status) : null;
  const invoiceStatus = subscription?.latest_invoice_status ? getInvoiceStatusMeta(subscription.latest_invoice_status) : null;

  const chips = [
    renderClassChip(statusMeta.label, statusMeta.className, statusMeta.icon),
    subscription
      ? renderClassChip(subscriptionStatus.label, subscriptionStatus.className, '●')
      : renderChip('Sem plano', 'neutral', '○'),
  ];

  if (alert) chips.push(renderChip(alert.title, alert.tone));

  return `
    <button type="button" class="clients-premium-card" data-client-id="${escapeHtml(client.id)}">
      <div class="clients-premium-avatar">${escapeHtml(getClientInitials(client.name))}</div>

      <div class="clients-premium-card-main">
        <div class="clients-premium-card-top">
          <div>
            <div class="clients-premium-card-name">${escapeHtml(client.name || 'Cliente')}</div>
            <div class="clients-premium-card-sub">${escapeHtml(formatPhone(client.whatsapp || client.phone))}</div>
          </div>
          <div class="clients-premium-card-money">${escapeHtml(formatCurrency(client.total_spent))}</div>
        </div>

        <div class="clients-premium-card-chips">${chips.join('')}</div>

        <div class="clients-premium-card-grid">
          <span><small>Última visita</small><strong>${escapeHtml(formatDateDisplay(client.last_visit_at))}</strong></span>
          <span><small>Visitas</small><strong>${escapeHtml(client.total_visits || 0)}</strong></span>
          <span><small>Plano</small><strong>${escapeHtml(subscription?.plan_name || 'Sem plano')}</strong></span>
          <span><small>Barbeiro preferido</small><strong>${escapeHtml(client.preferred_barber_name || '—')}</strong></span>
        </div>

        ${subscription ? `
          <div class="clients-premium-plan-strip">
            <div>
              <strong>${escapeHtml(subscription.plan_name)}</strong>
              <small>
                Saldo: ${escapeHtml(usage?.remainingTotal ?? 0)} de ${escapeHtml(usage?.includedTotal ?? 0)}
                · Próxima cobrança: ${escapeHtml(formatDateDisplay(subscription.next_billing_at))}
                ${invoiceStatus ? `· ${escapeHtml(invoiceStatus.label)}` : ''}
              </small>
            </div>
            <div class="clients-premium-usage">
              <span>${escapeHtml(usage?.usagePct || 0)}%</span>
              ${buildProgressBar(usage?.usagePct || 0, 'clients-premium-progress--plan')}
            </div>
          </div>
        ` : `
          <div class="clients-premium-plan-strip clients-premium-plan-strip--empty">
            <div>
              <strong>Sem plano ativo</strong>
              <small>Cliente com potencial para oferta de assinatura.</small>
            </div>
          </div>
        `}

        ${alert ? `
          <div class="clients-premium-alert clients-premium-alert--${escapeHtml(alert.tone || 'neutral')}">
            <strong>${escapeHtml(alert.title)}</strong>
            <span>${escapeHtml(alert.message)}</span>
          </div>
        ` : ''}
      </div>
    </button>
  `;
}

function renderClientsList() {
  const items = clientesState.items || [];
  const countText = `${items.length} cliente${items.length === 1 ? '' : 's'} encontrado${items.length === 1 ? '' : 's'}`;

  if (clientesState.isLoading) {
    return `
      <div class="card clients-premium-empty-card">
        <strong>Carregando clientes...</strong>
        <span>Buscando dados, planos, faturas, histórico e alertas inteligentes.</span>
      </div>
    `;
  }

  if (!items.length) {
    return `
      <div class="card clients-premium-empty-card">
        <strong>Nenhum cliente neste filtro</strong>
        <span>Tente outro filtro ou limpe a busca para ver toda a carteira.</span>
      </div>
    `;
  }

  return `
    <div class="clients-premium-list-head">
      <div>
        <strong>Central de relacionamento</strong>
        <span>${escapeHtml(countText)} · filtro ${escapeHtml(getFilterById(clientesState.activeFilter).label)}</span>
      </div>
    </div>
    <div class="clients-premium-list">
      ${items.map(renderClientCard).join('')}
    </div>
  `;
}

function renderClientHistory(detail) {
  const appointments = Array.isArray(detail?.raw?.appointments) ? [...detail.raw.appointments] : [];
  appointments.sort((a, b) => new Date(b?.scheduled_at || 0).getTime() - new Date(a?.scheduled_at || 0).getTime());

  if (!appointments.length) {
    return `<div class="clients-premium-detail-empty">Nenhum atendimento registrado.</div>`;
  }

  return appointments.slice(0, 8).map(appointment => {
    const statusMeta = getAppointmentStatusMeta(appointment.status);
    return `
      <div class="clients-premium-timeline-row">
        <div class="clients-premium-timeline-dot"></div>
        <div class="clients-premium-timeline-main">
          <strong>${escapeHtml(appointment.services?.name || 'Serviço')}</strong>
          <span>
            ${escapeHtml(formatDateTimeDisplay(appointment.scheduled_at))}
            · ${escapeHtml(appointment.barber_profiles?.users?.name || 'Barbeiro')}
            · ${escapeHtml(formatCurrency(appointment.final_price || appointment.price || 0))}
          </span>
        </div>
        ${renderClassChip(statusMeta.label, statusMeta.className, '')}
      </div>
    `;
  }).join('');
}

function renderSubscriptionDetail(detail) {
  const subscription = detail.active_subscription;
  const rawSubscriptions = Array.isArray(detail?.raw?.subscriptions) ? detail.raw.subscriptions : [];
  const rawSubscription = rawSubscriptions.find(item => item.id === subscription?.id) || rawSubscriptions[0] || null;

  if (!subscription) {
    return `
      <div class="clients-premium-detail-empty">
        Este cliente não possui assinatura ativa ou pendente.
      </div>
    `;
  }

  const usage = subscription.usage || {};
  const invoices = Array.isArray(rawSubscription?.subscription_invoices) ? [...rawSubscription.subscription_invoices] : [];
  invoices.sort((a, b) => new Date(b?.created_at || b?.due_at || 0).getTime() - new Date(a?.created_at || a?.due_at || 0).getTime());

  const consumptions = Array.isArray(rawSubscription?.subscription_consumptions) ? [...rawSubscription.subscription_consumptions] : [];
  consumptions.sort((a, b) => new Date(b?.created_at || b?.consumed_at || 0).getTime() - new Date(a?.created_at || a?.consumed_at || 0).getTime());

  return `
    <div class="clients-premium-subscription-hero">
      <div>
        <small>Assinatura atual</small>
        <strong>${escapeHtml(subscription.plan_name)}</strong>
        <span>Status ${escapeHtml(getSubscriptionStatusMeta(subscription.status).label)} · próxima cobrança ${escapeHtml(formatDateDisplay(subscription.next_billing_at))}</span>
      </div>
      <div class="clients-premium-usage clients-premium-usage--big">
        <span>${escapeHtml(usage.usagePct || 0)}%</span>
        ${buildProgressBar(usage.usagePct || 0, 'clients-premium-progress--plan')}
      </div>
    </div>

    <div class="clients-premium-detail-grid">
      <div class="mini-card"><div class="mini-lbl">Incluídos</div><div class="mini-val">${escapeHtml(usage.includedTotal || 0)}</div></div>
      <div class="mini-card"><div class="mini-lbl">Consumidos/reservados</div><div class="mini-val">${escapeHtml(usage.usedTotal || 0)}</div></div>
      <div class="mini-card"><div class="mini-lbl">Saldo restante</div><div class="mini-val color-up">${escapeHtml(usage.remainingTotal || 0)}</div></div>
      <div class="mini-card"><div class="mini-lbl">Faturas pendentes</div><div class="mini-val color-dn">${escapeHtml(subscription.invoice_stats?.pending || 0)}</div></div>
    </div>

    <div class="clients-premium-section-title">Faturas</div>
    <div class="clients-premium-detail-list">
      ${invoices.length ? invoices.slice(0, 6).map(invoice => {
        const meta = getInvoiceStatusMeta(invoice.status);
        const amount = invoice.amount_cents != null ? formatCurrencyFromCents(invoice.amount_cents) : formatCurrency(invoice.amount);
        return `
          <div class="clients-premium-detail-row">
            <div>
              <strong>${escapeHtml(amount)}</strong>
              <span>Vencimento ${escapeHtml(formatDateDisplay(invoice.due_at))} · ${escapeHtml(invoice.billing_reason || 'mensalidade')}</span>
            </div>
            ${renderClassChip(meta.label, meta.className, '')}
          </div>
        `;
      }).join('') : '<div class="clients-premium-detail-empty">Nenhuma fatura encontrada.</div>'}
    </div>

    <div class="clients-premium-section-title">Consumo do plano</div>
    <div class="clients-premium-detail-list">
      ${consumptions.length ? consumptions.slice(0, 6).map(consumption => `
        <div class="clients-premium-detail-row">
          <div>
            <strong>${escapeHtml(consumption.services?.name || consumption.consumed_type || 'Consumo')}</strong>
            <span>
              ${escapeHtml(formatDateTimeDisplay(consumption.consumed_at || consumption.created_at))}
              · Quantidade ${escapeHtml(consumption.quantity || 1)}
              · ${escapeHtml(consumption.status || consumption.consumption_status || '—')}
            </span>
          </div>
        </div>
      `).join('') : '<div class="clients-premium-detail-empty">Nenhum consumo registrado.</div>'}
    </div>
  `;
}

function renderAlerts(detail) {
  const alerts = Array.isArray(detail?.intelligence?.alerts) ? detail.intelligence.alerts : [];

  if (!alerts.length) {
    return `<div class="clients-premium-detail-empty">Nenhum alerta crítico para este cliente.</div>`;
  }

  return alerts.map(alert => `
    <div class="clients-premium-detail-alert clients-premium-detail-alert--${escapeHtml(alert.tone || 'neutral')}">
      <strong>${escapeHtml(alert.title)}</strong>
      <span>${escapeHtml(alert.message)}</span>
    </div>
  `).join('');
}

function renderReviews(detail) {
  const reviews = Array.isArray(detail?.raw?.reviews) ? [...detail.raw.reviews] : [];
  reviews.sort((a, b) => new Date(b?.created_at || 0).getTime() - new Date(a?.created_at || 0).getTime());

  if (!reviews.length) {
    return `<div class="clients-premium-detail-empty">Nenhuma avaliação registrada.</div>`;
  }

  return reviews.slice(0, 5).map(review => `
    <div class="clients-premium-detail-row">
      <div>
        <strong>${'★'.repeat(Math.max(0, Math.min(5, Number(review.rating || 0))))}</strong>
        <span>${escapeHtml(review.comment || 'Sem comentário')} · ${escapeHtml(formatDateDisplay(review.created_at))}</span>
      </div>
    </div>
  `).join('');
}

function renderStyleHistory(detail) {
  const history = Array.isArray(detail?.raw?.client_style_history) ? [...detail.raw.client_style_history] : [];
  history.sort((a, b) => new Date(b?.created_at || 0).getTime() - new Date(a?.created_at || 0).getTime());

  if (!history.length) {
    return `<div class="clients-premium-detail-empty">Nenhum histórico de estilo registrado.</div>`;
  }

  return history.slice(0, 5).map(item => `
    <div class="clients-premium-detail-row">
      <div>
        <strong>${escapeHtml(item.services?.name || item.style_name || 'Registro de estilo')}</strong>
        <span>${escapeHtml(item.notes || 'Sem observações')} · ${escapeHtml(formatDateDisplay(item.created_at))}</span>
      </div>
    </div>
  `).join('');
}

function renderClientDetail(detail) {
  const statusMeta = getClientStatusMeta(detail);
  const alert = detail?.intelligence?.primaryAlert;

  return `
    <div class="clients-premium-detail">
      <div class="clients-premium-detail-hero">
        <div class="clients-premium-avatar clients-premium-avatar--large">${escapeHtml(getClientInitials(detail.name))}</div>
        <div class="clients-premium-detail-hero-main">
          <div class="clients-premium-eyebrow">Ficha inteligente do cliente</div>
          <h2>${escapeHtml(detail.name || 'Cliente')}</h2>
          <p>
            ${escapeHtml(formatPhone(detail.whatsapp || detail.phone))}
            ${detail.email ? `· ${escapeHtml(detail.email)}` : ''}
          </p>
          <div class="clients-premium-card-chips">
            ${renderClassChip(statusMeta.label, statusMeta.className, statusMeta.icon)}
            ${detail.active_subscription ? renderChip('Com plano', 'success', '●') : renderChip('Sem plano', 'neutral', '○')}
            ${alert ? renderChip(alert.title, alert.tone) : ''}
          </div>
        </div>
        <div class="clients-premium-detail-money">
          <small>Total gasto</small>
          <strong>${escapeHtml(formatCurrency(detail.total_spent))}</strong>
          <span>${escapeHtml(detail.total_visits || 0)} visita(s)</span>
        </div>
      </div>

      <div class="clients-premium-detail-grid">
        <div class="mini-card"><div class="mini-lbl">Última visita</div><div class="mini-val">${escapeHtml(formatDateDisplay(detail.last_visit_at))}</div></div>
        <div class="mini-card"><div class="mini-lbl">Plano</div><div class="mini-val">${escapeHtml(detail.active_subscription?.plan_name || 'Sem plano')}</div></div>
        <div class="mini-card"><div class="mini-lbl">Barbeiro preferido</div><div class="mini-val">${escapeHtml(detail.preferred_barber_name || '—')}</div></div>
        <div class="mini-card"><div class="mini-lbl">Fidelidade</div><div class="mini-val color-up">${escapeHtml(detail.loyalty_points || 0)} pts</div></div>
      </div>

      <div class="clients-premium-detail-columns">
        <section class="clients-premium-panel">
          <div class="clients-premium-section-title">Alertas inteligentes</div>
          ${renderAlerts(detail)}
        </section>

        <section class="clients-premium-panel">
          <div class="clients-premium-section-title">Observações</div>
          <div class="clients-premium-note">${escapeHtml(detail.notes || detail.raw?.preferences || 'Nenhuma observação registrada.')}</div>
        </section>
      </div>

      <section class="clients-premium-panel">
        <div class="clients-premium-section-title">Assinatura, saldo e faturas</div>
        ${renderSubscriptionDetail(detail)}
      </section>

      <div class="clients-premium-detail-columns">
        <section class="clients-premium-panel">
          <div class="clients-premium-section-title">Histórico de atendimentos</div>
          <div class="clients-premium-timeline">${renderClientHistory(detail)}</div>
        </section>

        <section class="clients-premium-panel">
          <div class="clients-premium-section-title">Avaliações</div>
          <div class="clients-premium-detail-list">${renderReviews(detail)}</div>

          <div class="clients-premium-section-title" style="margin-top:14px;">Histórico de estilo</div>
          <div class="clients-premium-detail-list">${renderStyleHistory(detail)}</div>
        </section>
      </div>

      <div class="clients-premium-detail-actions">
        <button type="button" class="clients-action-btn" id="client-edit-button">Editar cliente</button>
        <button type="button" class="clients-action-btn clients-action-btn--primary" id="client-whatsapp-button" ${detail.whatsapp || detail.phone ? '' : 'disabled'}>
          Chamar no WhatsApp
        </button>
        <button type="button" class="btn-cancel" id="client-modal-close">Fechar</button>
      </div>
    </div>
  `;
}

function renderClientForm(mode, client = null) {
  const isEdit = mode === 'edit';
  const safeClient = client || { name: '', phone: '', whatsapp: '', email: '', birthdate: '', notes: '', is_vip: false, is_active: true };

  return `
    <div class="clients-modal-body">
      <div>
        <div class="modal-title" style="margin:0;">${isEdit ? 'Editar cliente' : 'Novo cliente'}</div>
        <div class="modal-sub" style="margin-top:4px;">${isEdit ? 'Atualize a ficha do relacionamento.' : 'Cadastre o cliente para agenda, planos e retenção.'}</div>
      </div>

      <form id="client-form" class="clients-form">
        <div class="clients-form-grid">
          <div>
            <div class="color-section-label">Nome</div>
            <input class="modal-input" id="client-name-input" name="name" type="text" maxlength="${CLIENT_NAME_MAX_LENGTH}" value="${escapeHtml(safeClient.name || '')}" placeholder="Nome do cliente"/>
          </div>
          <div>
            <div class="color-section-label">WhatsApp</div>
            <input class="modal-input" id="client-whatsapp-input" name="whatsapp" type="text" maxlength="${CLIENT_WHATSAPP_MAX_LENGTH}" value="${escapeHtml(safeClient.whatsapp || '')}" placeholder="11999999999"/>
          </div>
          <div>
            <div class="color-section-label">Telefone</div>
            <input class="modal-input" id="client-phone-input" name="phone" type="text" maxlength="${CLIENT_PHONE_MAX_LENGTH}" value="${escapeHtml(safeClient.phone || '')}" placeholder="Telefone alternativo"/>
          </div>
          <div>
            <div class="color-section-label">E-mail</div>
            <input class="modal-input" id="client-email-input" name="email" type="email" value="${escapeHtml(safeClient.email || '')}" placeholder="cliente@email.com"/>
          </div>
          <div>
            <div class="color-section-label">Nascimento</div>
            <input class="modal-input" id="client-birthdate-input" name="birthdate" type="date" value="${escapeHtml(String(safeClient.birthdate || '').slice(0, 10))}"/>
          </div>
          <div>
            <div class="color-section-label">Status</div>
            <select class="modal-input" id="client-active-input" name="isActive">
              <option value="true" ${safeClient.is_active !== false ? 'selected' : ''}>Ativo</option>
              <option value="false" ${safeClient.is_active === false ? 'selected' : ''}>Inativo</option>
            </select>
          </div>
        </div>

        <label class="clients-premium-check">
          <input type="checkbox" id="client-vip-input" name="isVip" ${safeClient.is_vip ? 'checked' : ''}/>
          <span>Marcar como cliente VIP</span>
        </label>

        <div>
          <div class="color-section-label">Observações</div>
          <textarea class="modal-input clients-textarea" id="client-notes-input" name="notes" maxlength="${CLIENT_NOTES_MAX_LENGTH}" placeholder="Preferências, alergias, estilo, comportamento, oportunidades...">${escapeHtml(safeClient.notes || '')}</textarea>
        </div>

        <div id="client-form-feedback" class="clients-form-feedback"></div>

        <div class="modal-buttons">
          ${isEdit ? '<button type="button" class="btn-cancel" id="client-form-back">Voltar</button>' : ''}
          <button type="button" class="btn-cancel" id="client-form-cancel">Cancelar</button>
          <button type="submit" class="btn-primary-gradient">${isEdit ? 'Salvar alterações' : 'Criar cliente'}</button>
        </div>
      </form>
    </div>
  `;
}

function collectClientFormData() {
  return {
    name: String(document.getElementById('client-name-input')?.value || '').trim(),
    whatsapp: String(document.getElementById('client-whatsapp-input')?.value || '').trim(),
    phone: String(document.getElementById('client-phone-input')?.value || '').trim(),
    email: String(document.getElementById('client-email-input')?.value || '').trim(),
    birthdate: String(document.getElementById('client-birthdate-input')?.value || '').trim(),
    notes: String(document.getElementById('client-notes-input')?.value || '').trim(),
    isActive: String(document.getElementById('client-active-input')?.value || 'true') === 'true',
    isVip: Boolean(document.getElementById('client-vip-input')?.checked),
  };
}

function setClientFormFeedback(message, variant = 'neutral') {
  const el = document.getElementById('client-form-feedback');
  if (!el) return;

  el.textContent = message || '';
  el.style.color = variant === 'error' ? '#ff8a8a' : variant === 'success' ? '#00e676' : '#5a6888';
}

async function handleClientFormSubmit(event) {
  event.preventDefault();

  const data = collectClientFormData();

  if (!data.name) {
    setClientFormFeedback('Informe o nome do cliente.', 'error');
    return;
  }

  const payload = {
    name: data.name,
    phone: data.phone || null,
    whatsapp: data.whatsapp || null,
    email: data.email || null,
    birthdate: data.birthdate || null,
    notes: data.notes || null,
    is_active: data.isActive,
    is_vip: data.isVip,
  };

  try {
    setClientFormFeedback('Salvando cliente...', 'neutral');

    if (clientesState.modalMode === 'edit' && clientesState.activeClientId) {
      await updateClient(clientesState.activeClientId, payload);
      setClientFormFeedback('Cliente atualizado com sucesso.', 'success');
      await loadClientsData();
      await openClientModal(clientesState.activeClientId);
      return;
    }

    const created = await createClient(payload);
    setClientFormFeedback('Cliente criado com sucesso.', 'success');
    await loadClientsData();
    if (created?.id) await openClientModal(created.id);
    else closeClientModal();
  } catch (error) {
    setClientFormFeedback(error instanceof Error ? error.message : 'Erro ao salvar cliente.', 'error');
  }
}

function renderClientModal() {
  const overlay = document.getElementById('client-details-modal');
  const content = document.getElementById('client-details-content');
  if (!overlay || !content) return;

  overlay.style.display = 'flex';
  overlay.classList.add('open');

  if (clientesState.modalMode === 'create') {
    content.innerHTML = renderClientForm('create');
    bindClientModalEvents();
    return;
  }

  if (clientesState.modalMode === 'edit') {
    content.innerHTML = renderClientForm('edit', clientesState.detailClient || {});
    bindClientModalEvents();
    return;
  }

  if (clientesState.isDetailLoading) {
    content.innerHTML = `
      <div class="clients-premium-detail-loading">
        <strong>Carregando ficha inteligente...</strong>
        <span>Buscando histórico, plano, faturas e alertas do cliente.</span>
      </div>
    `;
    return;
  }

  if (!clientesState.detailClient) {
    content.innerHTML = `
      <div class="clients-premium-detail-loading">
        <strong>Cliente não encontrado</strong>
        <span>Não foi possível carregar os dados deste cliente.</span>
        <button type="button" class="btn-cancel" id="client-modal-close">Fechar</button>
      </div>
    `;
    bindClientModalEvents();
    return;
  }

  content.innerHTML = renderClientDetail(clientesState.detailClient);
  bindClientModalEvents();
}

async function openClientModal(clientId) {
  clientesState.activeClientId = clientId;
  clientesState.detailClient = null;
  clientesState.isDetailLoading = true;
  clientesState.modalMode = 'view';
  renderClientModal();

  try {
    clientesState.detailClient = await getClientPremiumById(clientId);
  } catch (error) {
    const fallbackClient = (clientesState.items || []).find(item => String(item.id) === String(clientId));

    if (fallbackClient) {
      clientesState.detailClient = {
        ...fallbackClient,
        raw: {
          ...(fallbackClient.raw || {}),
          appointments: fallbackClient.raw?.appointments || [],
          subscriptions: fallbackClient.raw?.subscriptions || [],
          reviews: fallbackClient.raw?.reviews || [],
          client_style_history: fallbackClient.raw?.client_style_history || [],
          loyalty_transactions: fallbackClient.raw?.loyalty_transactions || [],
        },
        detail_load_error: error instanceof Error ? error.message : 'Não foi possível carregar todos os detalhes premium.',
      };
    } else {
      clientesState.detailClient = null;
    }
  } finally {
    clientesState.isDetailLoading = false;
    renderClientModal();
  }
}

function openCreateClientModal() {
  clientesState.activeClientId = null;
  clientesState.detailClient = null;
  clientesState.isDetailLoading = false;
  clientesState.modalMode = 'create';
  renderClientModal();
}

function openEditClientModal() {
  clientesState.isDetailLoading = false;
  clientesState.modalMode = 'edit';
  renderClientModal();
}

function closeClientModal() {
  const overlay = document.getElementById('client-details-modal');
  const content = document.getElementById('client-details-content');
  if (overlay) {
    overlay.classList.remove('open');
    overlay.style.display = 'none';
  }
  if (content) content.innerHTML = '';
  clientesState.modalMode = 'closed';
  clientesState.activeClientId = null;
}

function bindClientCardsEvents() {
  document.querySelectorAll('.clients-premium-card[data-client-id]').forEach(card => {
    card.addEventListener('click', () => openClientModal(card.dataset.clientId));
  });
}

function rerenderClientes() {
  const dashboard = document.getElementById('clients-premium-dashboard');
  const filters = document.getElementById('clients-premium-filters');
  const list = document.getElementById('clients-premium-list-wrap');

  if (dashboard) dashboard.innerHTML = renderDashboardCards();
  if (filters) filters.innerHTML = renderFilters();
  if (list) list.innerHTML = renderClientsList();

  bindClientesDynamicEvents();
  bindClientCardsEvents();
}


function normalizeLegacyClientToPremium(client) {
  const lastVisit = client.last_visit_at || null;
  const inactiveDays = lastVisit ? Math.max(0, Math.floor((Date.now() - new Date(lastVisit).getTime()) / 86400000)) : null;
  const isLost = inactiveDays !== null && inactiveDays >= 45;
  const isVip = Boolean(client.is_vip) || Number(client.total_spent || 0) >= 500 || Number(client.total_visits || 0) >= 8;
  const campaignCandidate = Boolean(client.whatsapp_opt_in !== false && (client.whatsapp || client.phone) && (isLost || !client.active_subscription));

  const alerts = [];
  if (isLost) {
    alerts.push({
      code: 'lost_client',
      tone: 'warning',
      title: 'Cliente sumido',
      message: `Sem retorno há ${inactiveDays} dia(s). Boa oportunidade para reativação.`,
    });
  }
  if (campaignCandidate) {
    alerts.push({
      code: 'campaign_candidate',
      tone: 'purple',
      title: 'Bom para campanha',
      message: 'Cliente elegível para ação de WhatsApp ou oferta de retorno.',
    });
  }

  return {
    id: client.id,
    name: client.name,
    phone: client.phone,
    whatsapp: client.whatsapp,
    email: client.email,
    birthdate: client.birthdate,
    photo_url: client.photo_url,
    notes: client.notes,
    is_active: client.is_active,
    is_vip: client.is_vip,
    whatsapp_opt_in: client.whatsapp_opt_in,
    loyalty_points: Number(client.loyalty_points || 0),
    preferred_barber_id: client.preferred_barber_id,
    preferred_barber_name: null,
    last_visit_at: lastVisit,
    last_service_name: null,
    total_visits: Number(client.total_visits || 0),
    total_spent: Number(client.total_spent || 0),
    avg_days_between_visits: client.avg_days_between_visits,
    active_subscription: null,
    intelligence: {
      lastVisitAt: lastVisit,
      inactiveDays,
      totalVisits: Number(client.total_visits || 0),
      totalSpent: Number(client.total_spent || 0),
      hasPlan: false,
      isVip,
      isLost,
      isBirthdayMonth: false,
      highUsage: false,
      paysNoUse: false,
      billingRisk: false,
      campaignCandidate,
      alerts,
      primaryAlert: alerts[0] || null,
    },
    appointments_count: 0,
    reviews_count: 0,
    rating_avg: null,
    created_at: client.created_at,
    updated_at: client.updated_at,
  };
}

function buildClientDashboardFromItems(items = []) {
  const total = items.length;
  const totalSpent = items.reduce((sum, item) => sum + Number(item.total_spent || 0), 0);

  return {
    total,
    active: items.filter(item => item.is_active !== false).length,
    inactive: items.filter(item => item.is_active === false || item.intelligence?.isLost).length,
    withPlan: items.filter(item => item.active_subscription).length,
    withoutPlan: items.filter(item => !item.active_subscription).length,
    birthdays: items.filter(item => item.intelligence?.isBirthdayMonth).length,
    lost: items.filter(item => item.intelligence?.isLost).length,
    vip: items.filter(item => item.intelligence?.isVip).length,
    highUsage: items.filter(item => item.intelligence?.highUsage).length,
    paysNoUse: items.filter(item => item.intelligence?.paysNoUse).length,
    billingRisk: items.filter(item => item.intelligence?.billingRisk).length,
    campaign: items.filter(item => item.intelligence?.campaignCandidate).length,
    totalSpent,
    avgTicket: total > 0 ? totalSpent / total : 0,
  };
}

function filterClientsLocally(items = []) {
  const q = String(clientesState.searchTerm || '').trim().toLowerCase();
  const filter = clientesState.activeFilter;

  return items.filter(client => {
    if (q) {
      const haystack = [
        client.name,
        client.phone,
        client.whatsapp,
        client.email,
        client.active_subscription?.plan_name,
        client.preferred_barber_name,
        client.intelligence?.primaryAlert?.title,
      ].join(' ').toLowerCase();

      if (!haystack.includes(q)) return false;
    }

    if (filter === 'active' && client.is_active === false) return false;
    if (filter === 'inactive' && client.is_active !== false && !client.intelligence?.isLost) return false;
    if (filter === 'with_plan' && !client.active_subscription) return false;
    if (filter === 'without_plan' && client.active_subscription) return false;
    if (filter === 'birthday' && !client.intelligence?.isBirthdayMonth) return false;
    if (filter === 'lost' && !client.intelligence?.isLost) return false;
    if (filter === 'vip' && !client.intelligence?.isVip) return false;
    if (filter === 'high_usage' && !client.intelligence?.highUsage) return false;
    if (filter === 'pays_no_use' && !client.intelligence?.paysNoUse) return false;
    if (filter === 'billing_risk' && !client.intelligence?.billingRisk) return false;
    if (filter === 'campaign' && !client.intelligence?.campaignCandidate) return false;

    return true;
  });
}

async function loadLegacyClientsFallback() {
  const legacy = await apiFetch('/api/clients?includeInactive=true');
  const normalized = Array.isArray(legacy) ? legacy.map(normalizeLegacyClientToPremium) : [];

  return {
    dashboard: buildClientDashboardFromItems(normalized),
    items: filterClientsLocally(normalized),
  };
}


async function loadClientsData() {
  const list = document.getElementById('clients-premium-list-wrap');

  if (!hasApiConfig()) {
    if (list) list.innerHTML = renderConfigHint('API não configurada', 'Abra o login dev para conectar o backend.', true);
    return;
  }

  if (!hasAuthToken()) {
    if (list) list.innerHTML = renderConfigHint('Login pendente', 'Faça autenticação para carregar a carteira de clientes.', true);
    return;
  }

  clientesState.isLoading = true;
  rerenderClientes();

  try {
    const payload = await getClientsPremium({
      q: clientesState.searchTerm,
      filter: clientesState.activeFilter,
    });

    let dashboard = payload?.dashboard || null;
    let items = Array.isArray(payload?.items) ? payload.items : [];

    // Rede de segurança: se o endpoint premium ainda não estiver publicado corretamente
    // ou vier zerado por relacionamento do Supabase, usa a rota clássica /api/clients.
    if (!items.length && Number(dashboard?.total || 0) === 0) {
      try {
        const fallback = await loadLegacyClientsFallback();
        if (fallback.items.length || Number(fallback.dashboard?.total || 0) > 0) {
          dashboard = fallback.dashboard;
          items = fallback.items;
        }
      } catch {
        // mantém retorno premium original
      }
    }

    clientesState.dashboard = dashboard;
    clientesState.items = items;
    clientesState.isLoaded = true;
  } catch (error) {
    try {
      const fallback = await loadLegacyClientsFallback();
      clientesState.dashboard = fallback.dashboard;
      clientesState.items = fallback.items;
      clientesState.isLoaded = true;
    } catch {
      if (list) {
        list.innerHTML = `
          <div class="card clients-premium-empty-card">
            <strong>Erro ao carregar clientes</strong>
            <span>${escapeHtml(error instanceof Error ? error.message : 'Tente novamente.')}</span>
          </div>
        `;
      }
    }
  } finally {
    clientesState.isLoading = false;
    rerenderClientes();
  }
}

function debounce(fn, ms = 350) {
  let timer = null;
  return (...args) => {
    clearTimeout(timer);
    timer = setTimeout(() => fn(...args), ms);
  };
}

const debouncedLoadClients = debounce(loadClientsData, 350);

function bindClientesDynamicEvents() {
  document.querySelectorAll('[data-client-filter]').forEach(button => {
    button.addEventListener('click', () => {
      const filter = button.dataset.clientFilter || 'all';
      clientesState.activeFilter = filter;
      persistFilter(filter);
      loadClientsData();
    });
  });
}

async function loadInviteShopData() {
  try {
    const data = await apiFetch('/api/auth/me');
    return data?.barbershop || data?.barbershops || null;
  } catch {
    return null;
  }
}

function buildInviteLink(slug) {
  return `https://bbarberflow.com.br/client/cadastro/${encodeURIComponent(slug)}`;
}

function getDefaultInviteMessage(shopName, link) {
  return `Olá! Temos uma novidade para você 🎉\n\nAgora você pode agendar seus horários na ${shopName} direto pelo celular, de forma fácil e rápida.\n\nCrie sua conta gratuitamente pelo link abaixo e já garanta seu próximo agendamento:\n\n👉 ${link}\n\nEstamos te esperando! 💈`;
}

async function copyTextToClipboard(text) {
  const value = String(text || '').trim();
  if (!value) throw new Error('Nada para copiar.');

  if (navigator.clipboard?.writeText) {
    await navigator.clipboard.writeText(value);
    return;
  }

  const textarea = document.createElement('textarea');
  textarea.value = value;
  textarea.setAttribute('readonly', 'readonly');
  textarea.style.position = 'absolute';
  textarea.style.left = '-9999px';
  document.body.appendChild(textarea);
  textarea.select();
  document.execCommand('copy');
  document.body.removeChild(textarea);
}

async function openInviteModal() {
  const overlay = document.getElementById('client-details-modal');
  const content = document.getElementById('client-details-content');
  if (!overlay || !content) return;

  overlay.style.display = 'flex';
  overlay.classList.add('open');
  content.innerHTML = `
    <div class="clients-premium-detail-loading">
      <strong>Preparando convite...</strong>
      <span>Buscando link público da barbearia.</span>
    </div>
  `;

  const shop = await loadInviteShopData();

  if (!shop?.slug) {
    content.innerHTML = `
      <div class="clients-premium-detail-loading">
        <strong>Não foi possível gerar o convite</strong>
        <span>Configure o slug/link público da barbearia.</span>
        <button type="button" class="btn-cancel" id="client-modal-close">Fechar</button>
      </div>
    `;
    bindClientModalEvents();
    return;
  }

  const link = buildInviteLink(shop.slug);
  const message = shop.invite_message || getDefaultInviteMessage(shop.name || 'nossa barbearia', link);

  content.innerHTML = `
    <div class="clients-premium-invite">
      <div class="clients-premium-eyebrow">Convite inteligente</div>
      <h2>Trazer cliente para o portal</h2>
      <p>Compartilhe o link para o cliente criar conta, agendar e acompanhar os serviços pelo celular.</p>

      <div class="clients-premium-invite-link">${escapeHtml(link)}</div>

      <textarea class="modal-input clients-textarea" id="client-invite-message">${escapeHtml(message)}</textarea>

      <div class="modal-buttons">
        <button type="button" class="clients-action-btn" id="client-invite-copy-link">Copiar link</button>
        <button type="button" class="clients-action-btn" id="client-invite-copy-message">Copiar mensagem</button>
        <a class="btn-primary-gradient clients-premium-whatsapp-link" href="https://wa.me/?text=${encodeURIComponent(message)}" target="_blank" rel="noopener">Abrir WhatsApp</a>
        <button type="button" class="btn-cancel" id="client-modal-close">Fechar</button>
      </div>
      <div id="client-invite-feedback" class="clients-form-feedback"></div>
    </div>
  `;

  document.getElementById('client-invite-copy-link')?.addEventListener('click', async () => {
    await copyTextToClipboard(link);
    const feedback = document.getElementById('client-invite-feedback');
    if (feedback) {
      feedback.textContent = 'Link copiado.';
      feedback.style.color = '#00e676';
    }
  });

  document.getElementById('client-invite-copy-message')?.addEventListener('click', async () => {
    const text = document.getElementById('client-invite-message')?.value || message;
    await copyTextToClipboard(text);
    const feedback = document.getElementById('client-invite-feedback');
    if (feedback) {
      feedback.textContent = 'Mensagem copiada.';
      feedback.style.color = '#00e676';
    }
  });

  bindClientModalEvents();
}

function bindClientModalEvents() {
  document.getElementById('client-modal-close')?.addEventListener('click', closeClientModal);
  document.getElementById('client-form-cancel')?.addEventListener('click', closeClientModal);
  document.getElementById('client-form-back')?.addEventListener('click', () => {
    if (clientesState.activeClientId) openClientModal(clientesState.activeClientId);
  });
  document.getElementById('client-edit-button')?.addEventListener('click', openEditClientModal);
  document.getElementById('client-form')?.addEventListener('submit', handleClientFormSubmit);
  document.getElementById('client-whatsapp-button')?.addEventListener('click', () => {
    const detail = clientesState.detailClient;
    const phone = String(detail?.whatsapp || detail?.phone || '').replace(/\D/g, '');
    if (!phone) return;
    window.open(`https://wa.me/55${phone}`, '_blank', 'noopener');
  });
}

function bindClientesStaticEvents() {
  document.getElementById('client-new-button')?.addEventListener('click', openCreateClientModal);
  document.getElementById('client-invite-button')?.addEventListener('click', openInviteModal);

  document.getElementById('client-search-input')?.addEventListener('input', event => {
    clientesState.searchTerm = event.target.value || '';
    debouncedLoadClients();
  });

  document.getElementById('client-details-modal')?.addEventListener('click', event => {
    if (event.target?.id === 'client-details-modal') closeClientModal();
  });
}

export function renderClientes() {
  return /* html */ `
<section class="page-shell page--clientes">
  <div class="clients-premium-hero">
    <div>
      <h1>Central de relacionamento</h1>
      <p>Entenda quem volta, quem sumiu, quem tem plano, quem merece campanha e quem está virando cliente VIP.</p>
    </div>
    <div class="clients-premium-hero-actions">
      <button type="button" class="clients-invite-btn" id="client-invite-button">Convidar cliente</button>
      <button type="button" class="btn-primary-gradient" id="client-new-button">+ Novo cliente</button>
    </div>
  </div>

  <div id="clients-premium-dashboard">
    ${renderDashboardCards()}
  </div>

  <div class="clients-premium-toolbar">
    <div class="clients-search-wrap">
      <span class="clients-search-icon">🔍</span>
      <input
        id="client-search-input"
        class="clients-search-input"
        type="text"
        placeholder="Buscar por nome, telefone, plano, barbeiro ou alerta..."
        value="${escapeHtml(clientesState.searchTerm)}"
      />
    </div>
  </div>

  <div id="clients-premium-filters">
    ${renderFilters()}
  </div>

  <div id="clients-premium-list-wrap">
    ${renderClientsList()}
  </div>

  <div id="client-details-modal" class="modal-overlay" style="display:none;">
    <div class="modal clients-premium-modal">
      <div id="client-details-content"></div>
    </div>
  </div>
</section>
  `;
}

export function initClientesPage() {
  bindClientesStaticEvents();
  bindClientesDynamicEvents();
  bindClientCardsEvents();
  loadClientsData();
}
