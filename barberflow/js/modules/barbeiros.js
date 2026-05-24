import { apiFetch } from '../services/api.js';

// ─── State ────────────────────────────────────────────────────────────────────

const FILTER_STORAGE_KEY = 'barberflow.barbers.filter';

const BARBER_FILTERS = [
  { id: 'all', label: 'Todos', hint: 'Time completo' },
  { id: 'accepting', label: 'Aceitando', hint: 'Disponíveis' },
  { id: 'not_accepting', label: 'Pausados', hint: 'Não aceitando' },
  { id: 'without_services', label: 'Sem serviços', hint: 'Ajustar agenda' },
  { id: 'with_future_agenda', label: 'Com agenda', hint: 'Próximos horários' },
  { id: 'commission_pending', label: 'Comissão', hint: 'Pendente' },
  { id: 'top_rated', label: 'Destaque', hint: 'Nota alta' },
  { id: 'attention', label: 'Atenção', hint: 'Risco operacional' },
];

const barberThemes = [
  { gradient: 'linear-gradient(135deg,#ffd700,#ff8c00)', color: '#000' },
  { gradient: 'linear-gradient(135deg,#6b6880,#3a3a4a)', color: '#fff' },
  { gradient: 'linear-gradient(135deg,#3b82f6,#1d4ed8)', color: '#fff' },
  { gradient: 'linear-gradient(135deg,#9c6fff,#5530dd)', color: '#fff' },
  { gradient: 'linear-gradient(135deg,#00e676,#00b248)', color: '#001b0b' },
];

const barbeirosState = {
  items: [],
  dashboard: null,
  isLoading: false,
  isLoaded: false,
  searchTerm: '',
  activeFilter: getInitialFilter(),
  modalMode: 'closed',
  activeBarberId: null,
  servicesDraft: null,
};

// ─── Helpers ──────────────────────────────────────────────────────────────────

function getInitialFilter() {
  try {
    const stored = localStorage.getItem(FILTER_STORAGE_KEY);
    return BARBER_FILTERS.some(item => item.id === stored) ? stored : 'all';
  } catch {
    return 'all';
  }
}

function persistFilter(filter) {
  try { localStorage.setItem(FILTER_STORAGE_KEY, filter); } catch {}
}

function escapeHtml(value) {
  return String(value ?? '')
    .replace(/&/g, '&amp;').replace(/</g, '&lt;')
    .replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#039;');
}

function formatCurrencyFromCents(value) {
  return new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL',
  }).format(Number(value || 0) / 100);
}

function formatCurrency(value) {
  return new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL',
    maximumFractionDigits: 0,
  }).format(Number(value || 0));
}

function formatCompactCurrencyFromCents(value) {
  const amount = Number(value || 0) / 100;
  if (Math.abs(amount) >= 1000) return `R$ ${(amount / 1000).toFixed(1)}k`;
  return formatCurrencyFromCents(value);
}

function formatDateTime(value) {
  if (!value) return '—';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '—';

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
  el.style.color = variant === 'error' ? '#ff8a8a' : variant === 'success' ? '#00e676' : '#5a6888';
}

function getBarberById(id) {
  return barbeirosState.items.find(b => String(b.id) === String(id)) || null;
}

function getUser(barber) {
  const users = barber?.users || barber?.user;
  if (Array.isArray(users)) return users[0] || {};
  return users || {};
}

function getBarberName(barber) {
  return barber?.name || getUser(barber)?.name || 'Barbeiro';
}

function getBarberEmail(barber) {
  return barber?.email || getUser(barber)?.email || '';
}

function getBarberPhone(barber) {
  return barber?.phone || getUser(barber)?.phone || '';
}

function getBarberAvatarUrl(barber) {
  return barber?.avatar_url || getUser(barber)?.avatar_url || null;
}

function getBarberInitials(name) {
  return String(name || 'B').trim().split(/\s+/).filter(Boolean)
    .slice(0, 2).map(p => p[0]?.toUpperCase() || '').join('') || 'BB';
}

function getBarberTheme(index) {
  return barberThemes[index % barberThemes.length];
}

function getDashboardSafe() {
  return barbeirosState.dashboard || {
    total: 0,
    accepting: 0,
    not_accepting: 0,
    attention: 0,
    total_revenue_cents: 0,
    month_revenue_cents: 0,
    completed_month_count: 0,
    future_appointments_count: 0,
    pending_commission_cents: 0,
    average_ticket_cents: 0,
    top_rated: null,
    top_revenue: null,
  };
}

function getSpecialtiesLabel(specialties) {
  if (!Array.isArray(specialties) || !specialties.length) return '—';
  return specialties.join(', ');
}

function getCommissionLabel(barber) {
  if (!barber?.commission_type && !barber?.commission_value) return '—';
  if (barber.commission_type === 'percentage') return `${Number(barber.commission_value || 0).toFixed(0)}%`;
  return formatCurrency(barber.commission_value);
}

function getStatusMeta(isAccepting) {
  return isAccepting
    ? { label: 'Aceitando', className: 'barber-chip--success', icon: '●' }
    : { label: 'Pausado', className: 'barber-chip--danger', icon: '●' };
}

function getAlertToneMeta(tone) {
  const map = {
    success: { className: 'barber-chip--success', icon: '✓' },
    info: { className: 'barber-chip--info', icon: 'i' },
    warning: { className: 'barber-chip--warning', icon: '!' },
    danger: { className: 'barber-chip--danger', icon: '!' },
    purple: { className: 'barber-chip--purple', icon: '✦' },
    gold: { className: 'barber-chip--gold', icon: '★' },
    neutral: { className: 'barber-chip--neutral', icon: '•' },
  };
  return map[tone] || map.neutral;
}

function getWorkingHours(barber) {
  const wh = barber?.working_hours || {};
  return {
    start: wh.start || '08:00',
    lunch_start: wh.lunch_start || '12:00',
    lunch_end: wh.lunch_end || '13:00',
    end: wh.end || '19:00',
  };
}

function formatWorkingHoursLabel(barber) {
  const wh = getWorkingHours(barber);
  return `${wh.start} – ${wh.end} (almoço ${wh.lunch_start}–${wh.lunch_end})`;
}

function renderChip(label, className = 'barber-chip--neutral', icon = '') {
  return `<span class="barber-chip ${escapeHtml(className)}">${escapeHtml(icon)} ${escapeHtml(label)}</span>`;
}

function renderAlertChip(alert) {
  if (!alert) return '';
  const meta = getAlertToneMeta(alert.tone);
  return renderChip(alert.title, meta.className, meta.icon);
}

function renderAvatar(barber, index, size = 'md') {
  const theme = getBarberTheme(index);
  const name = getBarberName(barber);
  const initials = getBarberInitials(name);
  const avatarUrl = getBarberAvatarUrl(barber);
  const cls = size === 'lg'
    ? 'barber-avatar barber-avatar--lg'
    : 'barber-avatar';

  if (avatarUrl) {
    return `
      <div class="${cls}" style="background:none;padding:0;overflow:hidden;">
        <img src="${escapeHtml(avatarUrl)}" alt="${escapeHtml(name)}"/>
      </div>`;
  }

  return `<div class="${cls}" style="background:${theme.gradient};color:${theme.color};">${escapeHtml(initials)}</div>`;
}

function getMetric(barber, key, fallback = 0) {
  return Number(barber?.metrics?.[key] || fallback);
}

function getFilterMetric(filterId) {
  const dashboard = getDashboardSafe();
  const map = {
    all: dashboard.total,
    accepting: dashboard.accepting,
    not_accepting: dashboard.not_accepting,
    without_services: barbeirosState.items.filter(item => getMetric(item, 'services_count') === 0).length,
    with_future_agenda: barbeirosState.items.filter(item => getMetric(item, 'future_count') > 0).length,
    commission_pending: barbeirosState.items.filter(item => Number(item.commission?.pending_cents || 0) > 0).length,
    top_rated: barbeirosState.items.filter(item => getMetric(item, 'rating_avg') >= 4.5).length,
    attention: dashboard.attention,
  };
  return map[filterId] ?? 0;
}

function normalizeLegacyBarbers(items) {
  const safe = Array.isArray(items) ? items : [];

  return safe.map(item => ({
    ...item,
    name: getBarberName(item),
    email: getBarberEmail(item),
    phone: getBarberPhone(item),
    avatar_url: getBarberAvatarUrl(item),
    services: [],
    metrics: {
      appointments_count: 0,
      completed_count: Number(item.total_cuts || 0),
      completed_month_count: 0,
      future_count: 0,
      cancelled_count: 0,
      no_show_count: 0,
      total_revenue_cents: 0,
      month_revenue_cents: 0,
      average_ticket_cents: 0,
      rating_avg: Number(item.rating_avg || 0),
      rating_count: Number(item.rating_count || 0),
      services_count: 0,
    },
    commission: {
      pending_cents: 0,
      paid_cents: 0,
      total_cents: 0,
    },
    alerts: [],
    primary_alert: null,
    needs_attention: item.is_accepting === false,
    upcoming_appointments: [],
    recent_appointments: [],
  }));
}

function buildFallbackDashboard(items) {
  const safe = Array.isArray(items) ? items : [];
  return {
    total: safe.length,
    accepting: safe.filter(item => item.is_accepting !== false).length,
    not_accepting: safe.filter(item => item.is_accepting === false).length,
    attention: safe.filter(item => item.needs_attention).length,
    total_revenue_cents: safe.reduce((sum, item) => sum + Number(item.metrics?.total_revenue_cents || 0), 0),
    month_revenue_cents: safe.reduce((sum, item) => sum + Number(item.metrics?.month_revenue_cents || 0), 0),
    completed_month_count: safe.reduce((sum, item) => sum + Number(item.metrics?.completed_month_count || 0), 0),
    future_appointments_count: safe.reduce((sum, item) => sum + Number(item.metrics?.future_count || 0), 0),
    pending_commission_cents: safe.reduce((sum, item) => sum + Number(item.commission?.pending_cents || 0), 0),
    average_ticket_cents: 0,
    top_rated: null,
    top_revenue: null,
  };
}

// ─── Compressão de imagem via Canvas ─────────────────────────────────────────

function compressImage(file, maxSize = 600, quality = 0.82) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    const url = URL.createObjectURL(file);

    img.onload = () => {
      URL.revokeObjectURL(url);
      let { width, height } = img;
      if (width > height && width > maxSize) {
        height = Math.round((height * maxSize) / width);
        width = maxSize;
      } else if (height > maxSize) {
        width = Math.round((width * maxSize) / height);
        height = maxSize;
      }
      const canvas = document.createElement('canvas');
      canvas.width = width;
      canvas.height = height;
      canvas.getContext('2d').drawImage(img, 0, 0, width, height);
      resolve(canvas.toDataURL('image/jpeg', quality));
    };

    img.onerror = () => reject(new Error('Não foi possível processar a imagem.'));
    img.src = url;
  });
}

// ─── Render dashboard/list ────────────────────────────────────────────────────

function renderDashboard() {
  const d = getDashboardSafe();

  return `
    <div class="barber-cockpit">
      <div class="barber-metric barber-metric--hero">
        <div class="barber-metric-label">Receita do time no mês</div>
        <div class="barber-metric-value color-info">${escapeHtml(formatCompactCurrencyFromCents(d.month_revenue_cents))}</div>
        <div class="barber-metric-sub">${escapeHtml(d.completed_month_count)} atendimento(s) concluído(s) · ticket ${escapeHtml(formatCurrencyFromCents(d.average_ticket_cents))}</div>
      </div>
      <div class="barber-metric">
        <div class="barber-metric-label">Aceitando agenda</div>
        <div class="barber-metric-value color-success">${escapeHtml(d.accepting)}</div>
        <div class="barber-metric-sub">${escapeHtml(d.not_accepting)} pausado(s) · ${escapeHtml(d.total)} profissional(is)</div>
      </div>
      <div class="barber-metric">
        <div class="barber-metric-label">Próximos horários</div>
        <div class="barber-metric-value color-purple">${escapeHtml(d.future_appointments_count)}</div>
        <div class="barber-metric-sub">Agenda futura do time</div>
      </div>
      <div class="barber-metric">
        <div class="barber-metric-label">Comissão pendente</div>
        <div class="barber-metric-value color-gold">${escapeHtml(formatCompactCurrencyFromCents(d.pending_commission_cents))}</div>
        <div class="barber-metric-sub">${escapeHtml(d.attention)} alerta(s) de atenção</div>
      </div>
    </div>
  `;
}

function renderFilters() {
  return `
    <div class="barber-filters">
      ${BARBER_FILTERS.map(filter => `
        <button type="button" class="barber-filter ${barbeirosState.activeFilter === filter.id ? 'is-active' : ''}" data-barber-filter="${escapeHtml(filter.id)}">
          <span>${escapeHtml(filter.label)}</span>
          <strong>${escapeHtml(getFilterMetric(filter.id))}</strong>
          <small>${escapeHtml(filter.hint)}</small>
        </button>
      `).join('')}
    </div>
  `;
}

function renderBarberCard(barber, index) {
  const name = getBarberName(barber);
  const status = getStatusMeta(barber.is_accepting !== false);
  const servicesCount = getMetric(barber, 'services_count');
  const ratingAvg = getMetric(barber, 'rating_avg');
  const ratingLabel = ratingAvg ? `${ratingAvg.toFixed(1)}★` : '—';

  const chips = [
    renderChip(status.label, status.className, status.icon),
    renderChip(`${servicesCount} serviço(s)`, servicesCount ? 'barber-chip--info' : 'barber-chip--danger', servicesCount ? '✂' : '!'),
    barber.primary_alert ? renderAlertChip(barber.primary_alert) : '',
  ].filter(Boolean).join('');

  return `
    <button type="button" class="barber-card-button" data-barber-id="${escapeHtml(barber.id)}" title="Ver detalhes de ${escapeHtml(name)}">
      <div class="barber-card-premium">
        <div class="barber-card-top">
          ${renderAvatar(barber, index)}
          <div class="barber-card-title">
            <strong>${escapeHtml(name)}</strong>
            <span>${escapeHtml(getBarberEmail(barber) || getBarberPhone(barber) || 'Sem contato cadastrado')}</span>
          </div>
          <div class="barber-card-score">${escapeHtml(ratingLabel)}</div>
        </div>

        <div class="barber-card-chips">${chips}</div>

        <div class="barber-card-grid">
          <span><small>Mês</small><strong>${escapeHtml(formatCurrencyFromCents(getMetric(barber, 'month_revenue_cents')))}</strong></span>
          <span><small>Concluídos</small><strong>${escapeHtml(getMetric(barber, 'completed_month_count'))}</strong></span>
          <span><small>Agenda</small><strong>${escapeHtml(getMetric(barber, 'future_count'))}</strong></span>
          <span><small>Comissão</small><strong>${escapeHtml(formatCurrencyFromCents(barber.commission?.pending_cents || 0))}</strong></span>
        </div>

        <div class="barber-card-reading">
          <strong>${escapeHtml(formatWorkingHoursLabel(barber))}</strong>
          <span>${escapeHtml(getSpecialtiesLabel(barber.specialties))}</span>
        </div>

        ${barber.primary_alert ? `
          <div class="barber-alert barber-alert--${escapeHtml(barber.primary_alert.tone)}">
            <strong>${escapeHtml(barber.primary_alert.title)}</strong>
            <span>${escapeHtml(barber.primary_alert.message)}</span>
          </div>
        ` : ''}
      </div>
    </button>`;
}

function renderBarbersList() {
  if (barbeirosState.isLoading) {
    return `<div class="barber-empty"><strong>Carregando time...</strong><span>Buscando agenda, comissões, serviços e avaliações.</span></div>`;
  }

  if (!barbeirosState.items.length) {
    return `<div class="barber-empty"><strong>Nenhum barbeiro neste filtro</strong><span>Troque o filtro ou cadastre um profissional.</span></div>`;
  }

  return `
    <div class="barber-list-head">
      <div>
        <strong>Profissionais</strong>
        <span>${escapeHtml(barbeirosState.items.length)} profissional(is) encontrado(s)</span>
      </div>
    </div>
    <div class="barber-list">
      ${barbeirosState.items.map((b, i) => renderBarberCard(b, i)).join('')}
    </div>
  `;
}

function renderSidePanel() {
  const byRevenue = [...barbeirosState.items].sort((a, b) => Number(b.metrics?.month_revenue_cents || 0) - Number(a.metrics?.month_revenue_cents || 0));
  const attention = barbeirosState.items.filter(item => item.needs_attention).slice(0, 5);
  const byRating = [...barbeirosState.items].filter(item => getMetric(item, 'rating_avg') > 0).sort((a, b) => getMetric(b, 'rating_avg') - getMetric(a, 'rating_avg'));

  return `
    <div class="barber-side-grid">
      <div class="barber-side-card barber-side-card--spotlight">
        <div class="barber-section-title">Central do time</div>
        <div class="barber-integration-flow"><span>Agenda</span><b>→</b><span>Serviços</span><b>→</b><span>Comissão</span><b>→</b><span>Performance</span></div>
        <p>O dono enxerga quem agenda, quem vende, quem atende bem e quem precisa de ajuste operacional.</p>
      </div>

      <div class="barber-side-card">
        <div class="barber-section-title">Ranking de receita</div>
        <div class="barber-ranking">
          ${byRevenue.length ? byRevenue.slice(0, 5).map((barber, index) => `
            <button type="button" class="barber-ranking-row" data-barber-id="${escapeHtml(barber.id)}">
              <div class="barber-ranking-index">${index + 1}</div>
              <div>
                <strong>${escapeHtml(getBarberName(barber))}</strong>
                <span>${escapeHtml(formatCurrencyFromCents(getMetric(barber, 'month_revenue_cents')))} no mês · ${escapeHtml(getMetric(barber, 'completed_month_count'))} atendimento(s)</span>
              </div>
            </button>
          `).join('') : '<div class="barber-side-empty">Sem receita registrada no mês.</div>'}
        </div>
      </div>

      <div class="barber-side-card">
        <div class="barber-section-title">Melhores avaliações</div>
        <div class="barber-ranking">
          ${byRating.length ? byRating.slice(0, 5).map((barber, index) => `
            <button type="button" class="barber-ranking-row" data-barber-id="${escapeHtml(barber.id)}">
              <div class="barber-ranking-index">${index + 1}</div>
              <div>
                <strong>${escapeHtml(getBarberName(barber))}</strong>
                <span>${escapeHtml(getMetric(barber, 'rating_avg').toFixed(1))}★ · ${escapeHtml(getMetric(barber, 'rating_count'))} avaliação(ões)</span>
              </div>
            </button>
          `).join('') : '<div class="barber-side-empty">Ainda sem avaliações suficientes.</div>'}
        </div>
      </div>

      <div class="barber-side-card">
        <div class="barber-section-title">Atenção do dono</div>
        <div class="barber-attention-list">
          ${attention.length ? attention.map(barber => `
            <button type="button" class="barber-attention-row" data-barber-id="${escapeHtml(barber.id)}">
              <strong>${escapeHtml(getBarberName(barber))}</strong>
              <span>${escapeHtml(barber.primary_alert?.title || 'Revisar profissional')}</span>
            </button>
          `).join('') : '<div class="barber-side-empty">Nenhum alerta crítico no time.</div>'}
        </div>
      </div>
    </div>
  `;
}

// ─── Modal views ──────────────────────────────────────────────────────────────

function renderAppointmentMini(item) {
  const service = Array.isArray(item.services) ? item.services[0] : item.services;
  const client = Array.isArray(item.clients) ? item.clients[0] : item.clients;

  return `
    <div class="barber-detail-row">
      <div>
        <strong>${escapeHtml(service?.name || 'Serviço')}</strong>
        <span>${escapeHtml(client?.name || 'Cliente')} · ${escapeHtml(formatDateTime(item.scheduled_at))} · ${escapeHtml(item.status || '—')}</span>
      </div>
      ${renderChip(formatCurrencyFromCents(Math.round(Number(item.final_price ?? item.price ?? 0) * 100)), 'barber-chip--info', 'R$')}
    </div>
  `;
}

function renderBarberDetails(barber, index) {
  const status = getStatusMeta(barber.is_accepting !== false);
  const email = getBarberEmail(barber);
  const phone = getBarberPhone(barber);
  const alerts = Array.isArray(barber.alerts) ? barber.alerts : [];
  const services = Array.isArray(barber.services) ? barber.services : [];
  const upcoming = Array.isArray(barber.upcoming_appointments) ? barber.upcoming_appointments : [];
  const recent = Array.isArray(barber.recent_appointments) ? barber.recent_appointments : [];

  return `
    <div class="barber-modal-body barber-detail">
      <div class="barber-detail-hero">
        ${renderAvatar(barber, index, 'lg')}
        <div class="barber-detail-main">
          <div class="barber-section-title">Ficha do profissional</div>
          <h2>${escapeHtml(getBarberName(barber))}</h2>
          <p>${escapeHtml(barber.bio || 'Sem bio cadastrada.')}</p>
          <div class="barber-card-chips">
            ${renderChip(status.label, status.className, status.icon)}
            ${renderChip(`Comissão ${getCommissionLabel(barber)}`, 'barber-chip--purple', '✦')}
            ${services.length ? renderChip(`${services.length} serviço(s)`, 'barber-chip--info', '✂') : renderChip('Sem serviços', 'barber-chip--danger', '!')}
            ${barber.primary_alert ? renderAlertChip(barber.primary_alert) : ''}
          </div>
        </div>
        <div class="barber-detail-score">
          <small>Nota média</small>
          <strong>${escapeHtml(getMetric(barber, 'rating_avg') ? `${getMetric(barber, 'rating_avg').toFixed(1)}★` : '—')}</strong>
          <span>${escapeHtml(getMetric(barber, 'rating_count'))} avaliação(ões)</span>
        </div>
      </div>

      <div class="barber-detail-grid">
        <div class="mini-card"><div class="mini-lbl">Receita mês</div><div class="mini-val color-info">${escapeHtml(formatCurrencyFromCents(getMetric(barber, 'month_revenue_cents')))}</div></div>
        <div class="mini-card"><div class="mini-lbl">Concluídos mês</div><div class="mini-val color-success">${escapeHtml(getMetric(barber, 'completed_month_count'))}</div></div>
        <div class="mini-card"><div class="mini-lbl">Agenda futura</div><div class="mini-val color-purple">${escapeHtml(getMetric(barber, 'future_count'))}</div></div>
        <div class="mini-card"><div class="mini-lbl">Comissão pendente</div><div class="mini-val color-gold">${escapeHtml(formatCurrencyFromCents(barber.commission?.pending_cents || 0))}</div></div>
      </div>

      <div class="barber-detail-columns">
        <section class="barber-panel">
          <div class="barber-section-title">Dados e acesso ao app</div>
          <div class="barber-info-stack">
            <div><strong>E-mail</strong><span>${escapeHtml(email || '—')}</span></div>
            <div><strong>Telefone</strong><span>${escapeHtml(phone || '—')}</span></div>
            <div><strong>Horário</strong><span>${escapeHtml(formatWorkingHoursLabel(barber))}</span></div>
            <div><strong>Especialidades</strong><span>${escapeHtml(getSpecialtiesLabel(barber.specialties))}</span></div>
          </div>

          <div class="barber-app-box">
            <strong>📱 Acesso ao App BarberFlow</strong>
            <span>O barbeiro entra no app mobile usando o e-mail cadastrado. Senha padrão em novo cadastro: <b>barberflow123</b>.</span>
            <div class="barber-password-row">
              <input type="password" id="barber-new-password" class="modal-input" placeholder="Nova senha, mínimo 6 caracteres"/>
              <button type="button" id="barber-reset-password-btn" data-barber-id="${escapeHtml(barber.id)}" class="btn-save">Atualizar</button>
            </div>
            <div id="barber-password-feedback" class="barber-form-feedback"></div>
          </div>
        </section>

        <section class="barber-panel">
          <div class="barber-section-title">Alertas inteligentes</div>
          ${alerts.length ? alerts.map(alert => `
            <div class="barber-detail-alert barber-detail-alert--${escapeHtml(alert.tone)}">
              <strong>${escapeHtml(alert.title)}</strong>
              <span>${escapeHtml(alert.message)}</span>
            </div>
          `).join('') : '<div class="barber-side-empty">Nenhum alerta para este profissional.</div>'}
        </section>
      </div>

      <section class="barber-panel">
        <div class="barber-section-title">Serviços vinculados</div>
        <div class="barber-service-list">
          ${services.length ? services.map(service => `
            <div class="barber-service-row">
              <div>
                <strong>${escapeHtml(service.name)}</strong>
                <span>${escapeHtml(service.category || 'Sem categoria')} · ${escapeHtml(service.duration_min || 0)} min</span>
              </div>
              ${renderChip(formatCurrency(Number(service.custom_price ?? service.price ?? 0)), 'barber-chip--info', 'R$')}
            </div>
          `).join('') : '<div class="barber-side-empty">Nenhum serviço vinculado. Isso pode afetar agenda e filtros do cliente.</div>'}
        </div>
      </section>

      <div class="barber-detail-columns">
        <section class="barber-panel">
          <div class="barber-section-title">Próxima agenda</div>
          <div class="barber-detail-list">
            ${upcoming.length ? upcoming.map(renderAppointmentMini).join('') : '<div class="barber-side-empty">Sem agenda futura.</div>'}
          </div>
        </section>
        <section class="barber-panel">
          <div class="barber-section-title">Últimos atendimentos</div>
          <div class="barber-detail-list">
            ${recent.length ? recent.map(renderAppointmentMini).join('') : '<div class="barber-side-empty">Sem atendimentos concluídos recentes.</div>'}
          </div>
        </section>
      </div>

      <section class="barber-panel">
        <div class="barber-section-title">Ações rápidas</div>
        <div class="barber-modal-actions">
          <button type="button" class="barber-status-action ${barber.is_accepting !== false ? 'is-active' : ''}" data-barber-id="${escapeHtml(barber.id)}" data-is-accepting="true">● Aceitando agenda</button>
          <button type="button" class="barber-status-action ${barber.is_accepting === false ? 'is-active' : ''}" data-barber-id="${escapeHtml(barber.id)}" data-is-accepting="false">● Pausar agenda</button>
          <button type="button" class="barber-action-btn" id="barber-services-button" data-barber-id="${escapeHtml(barber.id)}">Vincular serviços</button>
          <button type="button" class="barber-action-btn" id="barber-edit-button" data-barber-id="${escapeHtml(barber.id)}">Editar informações</button>
        </div>
      </section>

      <section class="barber-panel">
        <div class="barber-section-title">Foto do profissional</div>
        <div class="barber-upload-box">
          <div>
            <strong>Imagem de perfil</strong>
            <span>O sistema comprime automaticamente para deixar o app leve.</span>
          </div>
          <label for="barber-avatar-input" class="barber-upload-label">Enviar foto</label>
          <input type="file" id="barber-avatar-input" accept="image/*" style="display:none;" data-barber-id="${escapeHtml(barber.id)}"/>
          <div id="barber-avatar-feedback" class="barber-form-feedback"></div>
        </div>
      </section>

      <div id="barber-modal-feedback" class="barber-form-feedback"></div>

      <div class="modal-buttons barber-modal-actions">
        <button type="button" class="btn-cancel" id="barber-modal-close">Fechar</button>
      </div>
    </div>`;
}

function renderBarberForm(mode, barber = null) {
  const isEdit = mode === 'edit';
  const b = barber || {};
  const wh = isEdit ? getWorkingHours(barber) : { start: '08:00', lunch_start: '12:00', lunch_end: '13:00', end: '19:00' };

  return `
    <div class="barber-modal-body">
      <div class="barber-form-hero">
        <div class="barber-section-title">${isEdit ? 'Ajuste do profissional' : 'Novo profissional'}</div>
        <h2>${isEdit ? 'Editar barbeiro' : 'Cadastrar barbeiro'}</h2>
        <p>${isEdit ? 'Atualize comissão, disponibilidade, horários e especialidades.' : 'Cadastre o profissional e libere acesso ao app mobile.'}</p>
      </div>

      <form id="barber-form" class="barber-form">
        <section class="barber-form-section">
          <div class="barber-section-title">Dados principais</div>
          <div class="barber-form-grid">
            ${!isEdit ? `
              <div><div class="color-section-label">Nome</div><input class="modal-input" name="name" type="text" placeholder="Nome do barbeiro" /></div>
              <div><div class="color-section-label">E-mail</div><input class="modal-input" name="email" type="email" placeholder="email@dominio.com" /></div>
              <div><div class="color-section-label">Telefone</div><input class="modal-input" name="phone" type="text" placeholder="(11) 99999-9999" /></div>
            ` : ''}
            <div>
              <div class="color-section-label">Tipo de comissão</div>
              <select class="modal-input" name="commission_type">
                <option value="percentage" ${b.commission_type === 'percentage' ? 'selected' : ''}>Percentual (%)</option>
                <option value="fixed" ${b.commission_type === 'fixed' ? 'selected' : ''}>Valor fixo (R$)</option>
              </select>
            </div>
            <div><div class="color-section-label">Valor da comissão</div><input class="modal-input" name="commission_value" type="number" min="0" step="0.01" value="${escapeHtml(b.commission_value ?? '')}" placeholder="Ex: 40" /></div>
            <div>
              <div class="color-section-label">Aceitando agendamentos</div>
              <select class="modal-input" name="is_accepting">
                <option value="true" ${b.is_accepting !== false ? 'selected' : ''}>Sim</option>
                <option value="false" ${b.is_accepting === false ? 'selected' : ''}>Não</option>
              </select>
            </div>
          </div>
        </section>

        <section class="barber-form-section">
          <div class="barber-section-title">Especialidades e bio</div>
          <div><div class="color-section-label">Especialidades (separe por vírgula)</div><input class="modal-input" name="specialties" value="${escapeHtml(Array.isArray(b.specialties) ? b.specialties.join(', ') : '')}" placeholder="Ex: Fade, Barba, Corte social" /></div>
          <div><div class="color-section-label">Bio</div><textarea class="modal-input barber-textarea" name="bio" placeholder="Breve descrição do profissional">${escapeHtml(b.bio || '')}</textarea></div>
        </section>

        <section class="barber-form-section">
          <div class="barber-section-title">Horário de trabalho</div>
          <div class="barber-form-grid">
            <div><div class="color-section-label">Início</div><input class="modal-input" name="wh_start" type="time" value="${escapeHtml(wh.start)}" /></div>
            <div><div class="color-section-label">Término</div><input class="modal-input" name="wh_end" type="time" value="${escapeHtml(wh.end)}" /></div>
            <div><div class="color-section-label">Início do almoço</div><input class="modal-input" name="wh_lunch_start" type="time" value="${escapeHtml(wh.lunch_start)}" /></div>
            <div><div class="color-section-label">Fim do almoço</div><input class="modal-input" name="wh_lunch_end" type="time" value="${escapeHtml(wh.lunch_end)}" /></div>
          </div>
        </section>

        ${!isEdit ? `
          <section class="barber-form-section barber-form-section--purple">
            <div class="barber-section-title">Acesso ao App</div>
            <p class="barber-form-help">O barbeiro usará e-mail + senha para entrar no app mobile. Se deixar em branco, a senha padrão será <b>barberflow123</b>.</p>
            <div><div class="color-section-label">Senha inicial (opcional)</div><input class="modal-input" name="password" type="password" placeholder="Deixe em branco para usar barberflow123" /></div>
          </section>
        ` : ''}

        <div id="barber-form-feedback" class="barber-form-feedback"></div>

        <div class="modal-buttons barber-modal-actions">
          <button type="button" class="btn-cancel" id="${isEdit ? 'barber-form-back' : 'barber-form-cancel'}">${isEdit ? 'Voltar' : 'Cancelar'}</button>
          <button type="submit" class="btn-save">${isEdit ? 'Salvar alterações' : 'Cadastrar barbeiro'}</button>
        </div>
      </form>
    </div>`;
}

function renderServicesManager(barber) {
  if (!barbeirosState.servicesDraft) {
    return `
      <div class="barber-modal-body">
        <div class="barber-form-hero">
          <div class="barber-section-title">Serviços do profissional</div>
          <h2>Carregando serviços...</h2>
          <p>Buscando serviços disponíveis para vincular ao barbeiro.</p>
        </div>
      </div>
    `;
  }

  const { available = [], serviceIds = [] } = barbeirosState.servicesDraft;
  const selected = new Set((serviceIds || []).map(String));

  return `
    <div class="barber-modal-body">
      <div class="barber-form-hero">
        <div class="barber-section-title">Serviços do profissional</div>
        <h2>Vincular serviços</h2>
        <p>${escapeHtml(getBarberName(barber))} só deve receber na agenda os serviços que realiza.</p>
      </div>

      <form id="barber-services-form" class="barber-form">
        <div class="barber-services-picker">
          ${available.length ? available.map(service => `
            <label class="barber-service-check">
              <input type="checkbox" name="serviceIds" value="${escapeHtml(service.id)}" ${selected.has(String(service.id)) ? 'checked' : ''}/>
              <div>
                <strong>${escapeHtml(service.name)}</strong>
                <span>${escapeHtml(service.category || 'Sem categoria')} · ${escapeHtml(service.duration_min || 0)} min · ${escapeHtml(formatCurrency(service.price || 0))}</span>
              </div>
            </label>
          `).join('') : '<div class="barber-side-empty">Nenhum serviço ativo cadastrado.</div>'}
        </div>

        <div id="barber-form-feedback" class="barber-form-feedback"></div>

        <div class="modal-buttons barber-modal-actions">
          <button type="button" class="btn-cancel" id="barber-services-back">Voltar</button>
          <button type="submit" class="btn-save">Salvar serviços</button>
        </div>
      </form>
    </div>
  `;
}

// ─── Modal control ────────────────────────────────────────────────────────────

function getBarberIndex(id) {
  return Math.max(0, barbeirosState.items.findIndex(b => String(b.id) === String(id)));
}

function openBarberModal(id) {
  barbeirosState.activeBarberId = id;
  barbeirosState.modalMode = 'view';
  barbeirosState.servicesDraft = null;
  renderBarberModal();
}

function openCreateBarberModal() {
  barbeirosState.activeBarberId = null;
  barbeirosState.modalMode = 'create';
  barbeirosState.servicesDraft = null;
  renderBarberModal();
}

function openEditBarberModal(id) {
  barbeirosState.activeBarberId = id;
  barbeirosState.modalMode = 'edit';
  barbeirosState.servicesDraft = null;
  renderBarberModal();
}

async function openServicesModal(id) {
  barbeirosState.activeBarberId = id;
  barbeirosState.modalMode = 'services';
  barbeirosState.servicesDraft = null;
  renderBarberModal();

  try {
    barbeirosState.servicesDraft = await apiFetch(`/api/barbers/${id}/services`);
    renderBarberModal();
  } catch (error) {
    setFeedback('barber-form-feedback', error instanceof Error ? error.message : 'Erro ao carregar serviços.', 'error');
  }
}

function closeBarberModal() {
  const modal = document.getElementById('barber-details-modal');
  const content = document.getElementById('barber-details-content');
  if (!modal) return;

  barbeirosState.modalMode = 'closed';
  barbeirosState.activeBarberId = null;
  barbeirosState.servicesDraft = null;
  modal.classList.remove('open');
  modal.style.display = 'none';
  if (content) content.innerHTML = '';
}

function renderBarberModal() {
  const modal = document.getElementById('barber-details-modal');
  const content = document.getElementById('barber-details-content');
  if (!modal || !content) return;

  if (barbeirosState.modalMode === 'closed') {
    modal.style.display = 'none';
    modal.classList.remove('open');
    content.innerHTML = '';
    return;
  }

  const barber = barbeirosState.activeBarberId ? getBarberById(barbeirosState.activeBarberId) : null;
  const index = barbeirosState.activeBarberId ? getBarberIndex(barbeirosState.activeBarberId) : 0;

  if (barbeirosState.modalMode === 'view') {
    if (!barber) { closeBarberModal(); return; }
    content.innerHTML = renderBarberDetails(barber, index);
  }

  if (barbeirosState.modalMode === 'edit') {
    if (!barber) { closeBarberModal(); return; }
    content.innerHTML = renderBarberForm('edit', barber);
  }

  if (barbeirosState.modalMode === 'create') {
    content.innerHTML = renderBarberForm('create');
  }

  if (barbeirosState.modalMode === 'services') {
    if (!barber) { closeBarberModal(); return; }
    content.innerHTML = renderServicesManager(barber);
  }

  modal.style.display = 'flex';
  modal.classList.add('open');
  bindBarberModalEvents();
}

// ─── API calls ────────────────────────────────────────────────────────────────

async function loadBarbeirosData() {
  barbeirosState.isLoading = true;
  rerenderBarbeiros();
  const query = new URLSearchParams();
  if (barbeirosState.searchTerm) query.set('q', barbeirosState.searchTerm);
  if (barbeirosState.activeFilter) query.set('filter', barbeirosState.activeFilter);

  try {
    const data = await apiFetch(`/api/barbers/insights/list?${query.toString()}`);
    barbeirosState.items = Array.isArray(data?.items) ? data.items : [];
    barbeirosState.dashboard = data?.dashboard || buildFallbackDashboard(barbeirosState.items);
    barbeirosState.isLoaded = true;
  } catch (error) {
    console.warn('Falha no endpoint premium de barbeiros. Usando rota simples.', error);
    try {
      const legacy = await apiFetch('/api/barbers');
      barbeirosState.items = normalizeLegacyBarbers(legacy);
      barbeirosState.dashboard = buildFallbackDashboard(barbeirosState.items);
      barbeirosState.isLoaded = true;
    } catch (fallbackError) {
      console.error('Erro ao carregar barbeiros:', fallbackError);
      barbeirosState.items = [];
      barbeirosState.dashboard = buildFallbackDashboard([]);
    }
  } finally {
    barbeirosState.isLoading = false;
    rerenderBarbeiros();
  }
}

async function handleAvatarUpload(file, barberId) {
  const fb = document.getElementById('barber-avatar-feedback');
  if (!file || !barberId) return;

  try {
    if (fb) { fb.textContent = 'Processando imagem...'; fb.style.color = '#5a6888'; }
    const compressedBase64 = await compressImage(file);
    if (fb) { fb.textContent = 'Enviando foto...'; fb.style.color = '#5a6888'; }

    await apiFetch(`/api/barbers/${barberId}/avatar`, {
      method: 'POST',
      body: JSON.stringify({ imageBase64: compressedBase64, mimeType: 'image/jpeg' }),
    });

    if (fb) { fb.textContent = '✓ Foto atualizada!'; fb.style.color = '#00e676'; }
    await loadBarbeirosData();
    if (barbeirosState.activeBarberId) openBarberModal(barbeirosState.activeBarberId);
  } catch (error) {
    if (fb) {
      fb.textContent = error instanceof Error ? error.message : 'Erro ao enviar foto.';
      fb.style.color = '#ff8a8a';
    }
  }
}

async function handleResetPassword(barberId) {
  const input = document.getElementById('barber-new-password');
  const password = String(input?.value || '').trim();

  if (!password || password.length < 6) {
    setFeedback('barber-password-feedback', 'A senha deve ter pelo menos 6 caracteres.', 'error');
    return;
  }

  const btn = document.getElementById('barber-reset-password-btn');
  if (btn) btn.disabled = true;
  setFeedback('barber-password-feedback', 'Atualizando senha...', 'neutral');

  try {
    await apiFetch(`/api/barbers/${barberId}/password`, {
      method: 'PATCH',
      body: JSON.stringify({ password }),
    });
    setFeedback('barber-password-feedback', '✓ Senha atualizada com sucesso!', 'success');
    if (input) input.value = '';
  } catch (error) {
    setFeedback('barber-password-feedback', error instanceof Error ? error.message : 'Erro ao atualizar senha.', 'error');
  } finally {
    if (btn) btn.disabled = false;
  }
}

function collectBarberFormPayload(form, isEdit = false) {
  const formData = new FormData(form);
  const specialties = String(formData.get('specialties') || '')
    .split(',').map(s => s.trim()).filter(Boolean);

  const working_hours = {
    start: String(formData.get('wh_start') || '08:00'),
    end: String(formData.get('wh_end') || '19:00'),
    lunch_start: String(formData.get('wh_lunch_start') || '12:00'),
    lunch_end: String(formData.get('wh_lunch_end') || '13:00'),
    slot_interval: 30,
  };

  const payload = {
    commission_type: String(formData.get('commission_type') || 'percentage'),
    commission_value: Number(formData.get('commission_value') || 0),
    specialties,
    bio: String(formData.get('bio') || '').trim() || null,
    is_accepting: String(formData.get('is_accepting')) === 'true',
    working_hours,
  };

  if (!isEdit) {
    payload.name = String(formData.get('name') || '').trim();
    payload.email = String(formData.get('email') || '').trim();
    payload.phone = String(formData.get('phone') || '').trim() || null;
    const password = String(formData.get('password') || '').trim();
    if (password) payload.password = password;
  }

  return payload;
}

async function handleCreateBarber(event) {
  event.preventDefault();
  const form = document.getElementById('barber-form');
  const btn = form?.querySelector('button[type="submit"]');
  const payload = collectBarberFormPayload(form, false);

  if (!payload.name) { setFeedback('barber-form-feedback', 'Informe o nome do barbeiro.', 'error'); return; }
  if (!payload.email) { setFeedback('barber-form-feedback', 'Informe o e-mail.', 'error'); return; }

  try {
    if (btn) btn.disabled = true;
    setFeedback('barber-form-feedback', 'Salvando...', 'neutral');

    const result = await apiFetch('/api/barbers', {
      method: 'POST',
      body: JSON.stringify(payload),
    });

    if (result?.temp_password) {
      setFeedback('barber-form-feedback', `✓ Barbeiro cadastrado! Senha de acesso ao app: ${result.temp_password}`, 'success');
      setTimeout(() => { closeBarberModal(); loadBarbeirosData(); }, 2200);
    } else {
      closeBarberModal();
      await loadBarbeirosData();
    }
  } catch (error) {
    setFeedback('barber-form-feedback', error instanceof Error ? error.message : 'Erro ao salvar.', 'error');
    if (btn) btn.disabled = false;
  }
}

async function handleEditBarber(event) {
  event.preventDefault();
  const form = document.getElementById('barber-form');
  const btn = form?.querySelector('button[type="submit"]');
  const barberId = barbeirosState.activeBarberId;
  const payload = collectBarberFormPayload(form, true);

  try {
    if (btn) btn.disabled = true;
    setFeedback('barber-form-feedback', 'Salvando...', 'neutral');

    await apiFetch(`/api/barbers/${barberId}`, {
      method: 'PATCH',
      body: JSON.stringify(payload),
    });

    closeBarberModal();
    await loadBarbeirosData();
  } catch (error) {
    setFeedback('barber-form-feedback', error instanceof Error ? error.message : 'Erro ao salvar.', 'error');
    if (btn) btn.disabled = false;
  }
}

async function handleSaveServices(event) {
  event.preventDefault();
  const form = document.getElementById('barber-services-form');
  const btn = form?.querySelector('button[type="submit"]');
  const barberId = barbeirosState.activeBarberId;
  const serviceIds = Array.from(form?.querySelectorAll('input[name="serviceIds"]:checked') || [])
    .map(input => input.value);

  try {
    if (btn) btn.disabled = true;
    setFeedback('barber-form-feedback', 'Salvando serviços...', 'neutral');

    await apiFetch(`/api/barbers/${barberId}/services`, {
      method: 'PUT',
      body: JSON.stringify({ serviceIds }),
    });

    closeBarberModal();
    await loadBarbeirosData();
    openBarberModal(barberId);
  } catch (error) {
    setFeedback('barber-form-feedback', error instanceof Error ? error.message : 'Erro ao salvar serviços.', 'error');
    if (btn) btn.disabled = false;
  }
}

async function handleToggleAccepting(barberId, isAccepting) {
  try {
    setFeedback('barber-modal-feedback', 'Atualizando...', 'neutral');
    await apiFetch(`/api/barbers/${barberId}`, {
      method: 'PATCH',
      body: JSON.stringify({ is_accepting: isAccepting }),
    });
    await loadBarbeirosData();
    openBarberModal(barberId);
  } catch (error) {
    setFeedback('barber-modal-feedback', error instanceof Error ? error.message : 'Erro ao atualizar.', 'error');
  }
}

// ─── Events ───────────────────────────────────────────────────────────────────

function bindBarberModalEvents() {
  document.getElementById('barber-modal-close')?.addEventListener('click', closeBarberModal);
  document.getElementById('barber-form-cancel')?.addEventListener('click', closeBarberModal);

  document.getElementById('barber-form-back')?.addEventListener('click', () => {
    if (barbeirosState.activeBarberId) openBarberModal(barbeirosState.activeBarberId);
  });

  document.getElementById('barber-services-back')?.addEventListener('click', () => {
    if (barbeirosState.activeBarberId) openBarberModal(barbeirosState.activeBarberId);
  });

  document.getElementById('barber-edit-button')?.addEventListener('click', (e) => {
    const id = e.currentTarget.dataset.barberId;
    if (id) openEditBarberModal(id);
  });

  document.getElementById('barber-services-button')?.addEventListener('click', (e) => {
    const id = e.currentTarget.dataset.barberId;
    if (id) openServicesModal(id);
  });

  document.querySelectorAll('.barber-status-action[data-barber-id]').forEach(btn => {
    btn.addEventListener('click', () => {
      const id = btn.dataset.barberId;
      const isAccepting = btn.dataset.isAccepting === 'true';
      if (id) handleToggleAccepting(id, isAccepting);
    });
  });

  document.getElementById('barber-avatar-input')?.addEventListener('change', (e) => {
    const file = e.target.files?.[0];
    const barberId = e.target.dataset.barberId;
    if (file && barberId) handleAvatarUpload(file, barberId);
  });

  document.getElementById('barber-reset-password-btn')?.addEventListener('click', (e) => {
    const barberId = e.currentTarget.dataset.barberId;
    if (barberId) handleResetPassword(barberId);
  });

  document.getElementById('barber-services-form')?.addEventListener('submit', handleSaveServices);

  const form = document.getElementById('barber-form');
  if (form) {
    if (barbeirosState.modalMode === 'create') form.addEventListener('submit', handleCreateBarber);
    if (barbeirosState.modalMode === 'edit') form.addEventListener('submit', handleEditBarber);
  }
}

function bindBarbeirosGridEvents() {
  document.querySelectorAll('.barber-card-button[data-barber-id], .barber-ranking-row[data-barber-id], .barber-attention-row[data-barber-id]').forEach(btn => {
    btn.addEventListener('click', () => openBarberModal(btn.dataset.barberId));
  });
}

function bindBarbeirosDynamicEvents() {
  document.querySelectorAll('[data-barber-filter]').forEach(button => {
    button.addEventListener('click', () => {
      barbeirosState.activeFilter = button.dataset.barberFilter || 'all';
      persistFilter(barbeirosState.activeFilter);
      loadBarbeirosData();
    });
  });

  bindBarbeirosGridEvents();
}

const debouncedLoad = debounce(loadBarbeirosData, 350);

function bindBarbeirosStaticEvents() {
  document.getElementById('barber-new-button')?.addEventListener('click', openCreateBarberModal);

  document.getElementById('barber-search-input')?.addEventListener('input', (event) => {
    barbeirosState.searchTerm = event.target.value || '';
    debouncedLoad();
  });

  document.getElementById('barber-details-modal')?.addEventListener('click', (e) => {
    if (e.target?.id === 'barber-details-modal') closeBarberModal();
  });
}

function rerenderBarbeiros() {
  const cockpit = document.getElementById('barber-cockpit-wrap');
  const filters = document.getElementById('barber-filters-wrap');
  const list = document.getElementById('barbeiros-grid');
  const side = document.getElementById('barber-side-wrap');

  if (cockpit) cockpit.innerHTML = renderDashboard();
  if (filters) filters.innerHTML = renderFilters();
  if (list) list.innerHTML = renderBarbersList();
  if (side) side.innerHTML = renderSidePanel();

  bindBarbeirosDynamicEvents();
}

// ─── Export ───────────────────────────────────────────────────────────────────

export function renderBarbeiros() {
  return /* html */ `
<section class="page-shell page--barbeiros">
  <div class="barber-hero">
    <div>
      <div class="barber-section-title">Gestão do time</div>
      <h1>Central do time</h1>
      <p>Controle barbeiros, agenda, serviços, comissões, avaliações, produtividade e disponibilidade em uma única visão.</p>
    </div>
    <button type="button" class="btn-primary-gradient" id="barber-new-button">+ Novo barbeiro</button>
  </div>

  <div id="barber-cockpit-wrap">${renderDashboard()}</div>

  <div class="barber-toolbar">
    <div class="barber-search-wrap">
      <span>🔍</span>
      <input id="barber-search-input" class="barber-search-input" type="text" placeholder="Buscar por nome, contato, especialidade, serviço ou alerta..." value="${escapeHtml(barbeirosState.searchTerm)}" />
    </div>
  </div>

  <div id="barber-filters-wrap">${renderFilters()}</div>

  <div class="barber-layout">
    <div id="barbeiros-grid">${renderBarbersList()}</div>
    <aside id="barber-side-wrap">${renderSidePanel()}</aside>
  </div>

  <div id="barber-details-modal" class="modal-overlay" style="display:none;">
    <div class="modal barber-modal">
      <div id="barber-details-content"></div>
    </div>
  </div>
</section>
  `;
}

export function initBarbeirosPage() {
  bindBarbeirosStaticEvents();
  bindBarbeirosDynamicEvents();
  loadBarbeirosData();
}
