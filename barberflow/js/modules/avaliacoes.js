import { apiFetch } from '../services/api.js';

// ─── State ────────────────────────────────────────────────────────────────────

const FILTER_STORAGE_KEY = 'barberflow.reviews.filter';

const REVIEW_FILTERS = [
  { id: 'all', label: 'Todas', hint: 'Avaliações' },
  { id: 'five_star', label: '5 estrelas', hint: 'Promotores' },
  { id: 'google_pending', label: 'Google', hint: 'Pedir avaliação' },
  { id: 'negative', label: 'Críticas', hint: 'Tratar rápido' },
  { id: 'attention', label: 'Atenção', hint: 'Risco' },
  { id: 'with_comment', label: 'Com texto', hint: 'Depoimentos' },
  { id: 'without_comment', label: 'Sem texto', hint: 'Feedback curto' },
  { id: 'public', label: 'Públicas', hint: 'Vitrine' },
  { id: 'featured', label: 'Destaque', hint: 'Prova social' },
];

const avaliacoesState = {
  reviews: [],
  pendingRequests: [],
  dashboard: null,
  isLoading: false,
  isLoaded: false,
  modalMode: 'closed',
  activeReviewId: null,
  activePendingId: null,
  activeFilter: getInitialFilter(),
  searchTerm: '',
};

function getInitialFilter() {
  try {
    const stored = localStorage.getItem(FILTER_STORAGE_KEY);
    return REVIEW_FILTERS.some(item => item.id === stored) ? stored : 'all';
  } catch {
    return 'all';
  }
}

function persistFilter(filter) {
  try { localStorage.setItem(FILTER_STORAGE_KEY, filter); } catch {}
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function escapeHtml(value) {
  return String(value ?? '')
    .replace(/&/g, '&amp;').replace(/</g, '&lt;')
    .replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#039;');
}

function formatDate(value) {
  if (!value) return '—';
  const d = new Date(value);
  if (isNaN(d.getTime())) return String(value);
  return d.toLocaleDateString('pt-BR');
}

function formatDateTime(value) {
  if (!value) return '—';
  const d = new Date(value);
  if (isNaN(d.getTime())) return String(value);
  return d.toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' });
}

function formatNumber(value) {
  return new Intl.NumberFormat('pt-BR').format(Number(value || 0));
}

function setFeedback(id, message, variant = 'neutral') {
  const el = document.getElementById(id);
  if (!el) return;
  el.textContent = message || '';
  el.style.color = variant === 'error' ? '#ff8a8a' : variant === 'success' ? '#00e676' : '#5a6888';
}

function debounce(fn, ms = 350) {
  let timer = null;
  return (...args) => {
    clearTimeout(timer);
    timer = setTimeout(() => fn(...args), ms);
  };
}

function getReviewById(id) {
  return avaliacoesState.reviews.find(r => String(r.id) === String(id)) || null;
}

function getPendingById(id) {
  return avaliacoesState.pendingRequests.find(r => String(r.id) === String(id)) || null;
}

function renderStars(rating) {
  const n = Math.max(0, Math.min(5, Number(rating || 0)));
  return '★'.repeat(n) + `<span style="color:#3a4568">${'★'.repeat(5 - n)}</span>`;
}

function getToneMeta(tone) {
  const map = {
    success: { className: 'review-chip--success', icon: '✓' },
    info: { className: 'review-chip--info', icon: 'i' },
    warning: { className: 'review-chip--warning', icon: '!' },
    danger: { className: 'review-chip--danger', icon: '!' },
    purple: { className: 'review-chip--purple', icon: '✦' },
    gold: { className: 'review-chip--gold', icon: '★' },
    neutral: { className: 'review-chip--neutral', icon: '•' },
  };
  return map[tone] || map.neutral;
}

function renderChip(label, className = 'review-chip--neutral', icon = '') {
  return `<span class="review-chip ${escapeHtml(className)}">${escapeHtml(icon)} ${escapeHtml(label)}</span>`;
}

function renderAlertChip(alert) {
  if (!alert) return '';
  const meta = getToneMeta(alert.tone);
  return renderChip(alert.title, meta.className, meta.icon);
}

function getRatingClass(rating) {
  const value = Number(rating || 0);
  if (value >= 5) return 'review-chip--success';
  if (value >= 4) return 'review-chip--gold';
  if (value >= 3) return 'review-chip--warning';
  return 'review-chip--danger';
}

function getFilterMetric(filterId) {
  const d = avaliacoesState.dashboard || {};
  const map = {
    all: d.total || 0,
    five_star: d.five_star_count || 0,
    google_pending: d.google_pending_count || 0,
    negative: d.negative_count || 0,
    attention: d.attention_count || 0,
    with_comment: d.with_comment_count || 0,
    without_comment: Math.max(0, Number(d.total || 0) - Number(d.with_comment_count || 0)),
    public: d.public_count || 0,
    featured: avaliacoesState.reviews.filter(review => review.is_featured === true).length,
  };
  return map[filterId] ?? 0;
}

function getReviewStatusLabel(status) {
  const map = {
    new: 'Nova',
    responded: 'Respondida',
    in_treatment: 'Em tratativa',
    resolved: 'Resolvida',
  };
  return map[status] || status || 'Nova';
}

// ─── Render ───────────────────────────────────────────────────────────────────

function renderDashboard() {
  const d = avaliacoesState.dashboard || {
    total: 0,
    average_rating: 0,
    nps_like_score: 0,
    google_pending_count: 0,
    negative_count: 0,
    pending_feedback_requests: 0,
  };

  return `
    <div class="reviews-cockpit">
      <div class="reviews-metric reviews-metric--hero">
        <div class="reviews-metric-label">Nota média</div>
        <div class="reviews-metric-value color-gold">${escapeHtml(Number(d.average_rating || 0).toFixed(1))}</div>
        <div class="stars">${renderStars(Math.round(Number(d.average_rating || 0)))}</div>
        <div class="reviews-metric-sub">${escapeHtml(formatNumber(d.total || 0))} avaliação(ões) · índice ${escapeHtml(formatNumber(d.nps_like_score || 0))}</div>
      </div>
      <div class="reviews-metric">
        <div class="reviews-metric-label">Pedir Google</div>
        <div class="reviews-metric-value color-success">${escapeHtml(formatNumber(d.google_pending_count || 0))}</div>
        <div class="reviews-metric-sub">Clientes satisfeitos ainda não enviados ao Google</div>
      </div>
      <div class="reviews-metric">
        <div class="reviews-metric-label">Atenção</div>
        <div class="reviews-metric-value color-danger">${escapeHtml(formatNumber(d.negative_count || 0))}</div>
        <div class="reviews-metric-sub">${escapeHtml(formatNumber(d.unresolved_count || 0))} crítica(s) não resolvida(s)</div>
      </div>
      <div class="reviews-metric">
        <div class="reviews-metric-label">Sem avaliação</div>
        <div class="reviews-metric-value color-info">${escapeHtml(formatNumber(d.pending_feedback_requests || 0))}</div>
        <div class="reviews-metric-sub">Atendimentos concluídos aguardando feedback</div>
      </div>
    </div>
  `;
}

function renderFilters() {
  return `
    <div class="reviews-filters">
      ${REVIEW_FILTERS.map(filter => `
        <button type="button" class="reviews-filter ${avaliacoesState.activeFilter === filter.id ? 'is-active' : ''}" data-review-filter="${escapeHtml(filter.id)}">
          <span>${escapeHtml(filter.label)}</span>
          <strong>${escapeHtml(formatNumber(getFilterMetric(filter.id)))}</strong>
          <small>${escapeHtml(filter.hint)}</small>
        </button>
      `).join('')}
    </div>
  `;
}

function renderReviewCard(review) {
  const chips = [
    renderChip(`${review.rating || 0} estrelas`, getRatingClass(review.rating), '★'),
    review.google_review_sent ? renderChip('Google ✓', 'review-chip--success', '✓') : Number(review.rating || 0) >= 5 ? renderChip('Pedir Google', 'review-chip--gold', '★') : '',
    review.is_featured ? renderChip('Destaque', 'review-chip--purple', '✦') : '',
    renderChip(getReviewStatusLabel(review.quality_status), review.quality_status === 'resolved' ? 'review-chip--success' : 'review-chip--neutral', '•'),
    review.primary_alert ? renderAlertChip(review.primary_alert) : '',
  ].filter(Boolean).join('');

  return `
    <button type="button" class="review-card-button" data-review-id="${escapeHtml(review.id)}" title="Ver avaliação de ${escapeHtml(review.client_name || 'Cliente')}">
      <div class="review-card-premium review-card-premium--${escapeHtml(review.rating_tone || 'info')}">
        <div class="review-card-top">
          <div>
            <strong>${escapeHtml(review.client_name || 'Cliente')}</strong>
            <span>${escapeHtml(review.client_whatsapp || review.client_phone || 'Sem contato')} · ${escapeHtml(formatDate(review.created_at))}</span>
          </div>
          <div class="review-score">
            <b>${escapeHtml(review.rating || 0)}</b>
            <span>${renderStars(review.rating)}</span>
          </div>
        </div>

        <div class="review-chip-row">${chips}</div>

        ${review.comment ? `<div class="review-quote">"${escapeHtml(review.comment)}"</div>` : '<div class="review-quote review-quote--empty">Sem comentário escrito.</div>'}

        <div class="review-card-grid">
          <span><small>Barbeiro</small><strong>${escapeHtml(review.barber_name || '—')}</strong></span>
          <span><small>Serviço</small><strong>${escapeHtml(review.service_name || '—')}</strong></span>
          <span><small>Status</small><strong>${escapeHtml(getReviewStatusLabel(review.quality_status))}</strong></span>
          <span><small>Google</small><strong>${review.google_review_sent ? 'Enviado' : 'Pendente'}</strong></span>
        </div>

        ${review.primary_alert ? `
          <div class="review-alert review-alert--${escapeHtml(review.primary_alert.tone)}">
            <strong>${escapeHtml(review.primary_alert.title)}</strong>
            <span>${escapeHtml(review.primary_alert.message)}</span>
          </div>
        ` : ''}
      </div>
    </button>
  `;
}

function renderReviewsList() {
  if (avaliacoesState.isLoading) {
    return `<div class="reviews-empty"><strong>Carregando avaliações...</strong><span>Buscando notas, comentários, barbeiros e oportunidades.</span></div>`;
  }

  if (!avaliacoesState.reviews.length) {
    return `<div class="reviews-empty"><strong>Nenhuma avaliação neste filtro</strong><span>Troque o filtro ou peça feedback dos atendimentos concluídos.</span></div>`;
  }

  return `
    <div class="reviews-list-head">
      <div>
        <strong>Avaliações</strong>
        <span>${escapeHtml(avaliacoesState.reviews.length)} registro(s) encontrado(s)</span>
      </div>
    </div>
    <div class="reviews-list">${avaliacoesState.reviews.map(renderReviewCard).join('')}</div>
  `;
}

function renderPendingRequest(row) {
  return `
    <button type="button" class="pending-review-row" data-pending-id="${escapeHtml(row.id)}">
      <div>
        <strong>${escapeHtml(row.client_name || 'Cliente')}</strong>
        <span>${escapeHtml(row.service_name || 'Serviço')} · ${escapeHtml(row.barber_name || 'Profissional')} · ${escapeHtml(formatDateTime(row.scheduled_at))}</span>
      </div>
      ${renderChip('Pedir avaliação', 'review-chip--info', '★')}
    </button>
  `;
}

function renderSidePanel() {
  const d = avaliacoesState.dashboard || {};
  const barberRanking = Array.isArray(d.barber_ranking) ? d.barber_ranking : [];
  const serviceRanking = Array.isArray(d.service_ranking) ? d.service_ranking : [];

  return `
    <div class="reviews-side-grid">
      <div class="reviews-side-card reviews-side-card--spotlight">
        <div class="reviews-section-title">Reputação com ação</div>
        <div class="reviews-flow"><span>Avaliação</span><b>→</b><span>Tratativa</span><b>→</b><span>Google</span><b>→</b><span>Retorno</span></div>
        <p>Nota boa vira prova social. Nota ruim vira tratativa. Atendimento sem nota vira pedido de feedback.</p>
      </div>

      <div class="reviews-side-card">
        <div class="reviews-section-title">Ranking de barbeiros</div>
        <div class="reviews-ranking">
          ${barberRanking.length ? barberRanking.map((item, index) => `
            <div class="reviews-ranking-row">
              <div class="reviews-ranking-index">${index + 1}</div>
              <div>
                <strong>${escapeHtml(item.name)}</strong>
                <span>${escapeHtml(Number(item.average_rating || 0).toFixed(1))}★ · ${escapeHtml(item.count)} avaliação(ões) · ${escapeHtml(item.negative_count)} crítica(s)</span>
              </div>
            </div>
          `).join('') : '<div class="reviews-empty">Sem ranking ainda.</div>'}
        </div>
      </div>

      <div class="reviews-side-card">
        <div class="reviews-section-title">Ranking de serviços</div>
        <div class="reviews-ranking">
          ${serviceRanking.length ? serviceRanking.map((item, index) => `
            <div class="reviews-ranking-row">
              <div class="reviews-ranking-index">${index + 1}</div>
              <div>
                <strong>${escapeHtml(item.name)}</strong>
                <span>${escapeHtml(Number(item.average_rating || 0).toFixed(1))}★ · ${escapeHtml(item.count)} avaliação(ões)</span>
              </div>
            </div>
          `).join('') : '<div class="reviews-empty">Sem serviços avaliados ainda.</div>'}
        </div>
      </div>

      <div class="reviews-side-card">
        <div class="reviews-section-title">Pedir feedback</div>
        <div class="pending-review-list">
          ${avaliacoesState.pendingRequests.length ? avaliacoesState.pendingRequests.slice(0, 6).map(renderPendingRequest).join('') : '<div class="reviews-empty">Nenhum atendimento pendente de avaliação.</div>'}
        </div>
      </div>
    </div>
  `;
}

function renderReviewDetails(review) {
  return `
    <div class="avaliacoes-modal-body">
      <div class="review-detail-hero">
        <div>
          <div class="reviews-section-title">Ficha da avaliação</div>
          <h2>${escapeHtml(review.client_name || 'Cliente')}</h2>
          <p>${escapeHtml(review.comment || 'Sem comentário escrito.')}</p>
          <div class="review-chip-row">
            ${renderChip(`${review.rating || 0} estrelas`, getRatingClass(review.rating), '★')}
            ${review.google_review_sent ? renderChip('Google enviado', 'review-chip--success', '✓') : Number(review.rating || 0) >= 5 ? renderChip('Pedir Google', 'review-chip--gold', '★') : ''}
            ${review.is_public !== false ? renderChip('Pública', 'review-chip--info', 'i') : renderChip('Privada', 'review-chip--neutral', '•')}
            ${review.is_featured ? renderChip('Destaque', 'review-chip--purple', '✦') : ''}
          </div>
        </div>
      </div>

      <div class="avaliacoes-modal-grid">
        <div class="mini-card"><div class="mini-lbl">Nota</div><div class="mini-val color-gold">${escapeHtml(review.rating)}</div></div>
        <div class="mini-card"><div class="mini-lbl">Barbeiro</div><div class="mini-val" style="font-size:14px;">${escapeHtml(review.barber_name || '—')}</div></div>
        <div class="mini-card"><div class="mini-lbl">Serviço</div><div class="mini-val" style="font-size:14px;">${escapeHtml(review.service_name || '—')}</div></div>
        <div class="mini-card"><div class="mini-lbl">Status</div><div class="mini-val" style="font-size:14px;">${escapeHtml(getReviewStatusLabel(review.quality_status))}</div></div>
      </div>

      <div class="review-detail-columns">
        <section class="review-panel">
          <div class="reviews-section-title">Alertas inteligentes</div>
          <div class="reviews-detail-list">
            ${review.alerts?.length ? review.alerts.map(alert => `
              <div class="review-alert review-alert--${escapeHtml(alert.tone)}">
                <strong>${escapeHtml(alert.title)}</strong>
                <span>${escapeHtml(alert.message)}</span>
              </div>
            `).join('') : '<div class="reviews-empty">Sem alertas para esta avaliação.</div>'}
          </div>
        </section>

        <section class="review-panel">
          <div class="reviews-section-title">Tratativa</div>
          <form id="review-recovery-form" class="avaliacoes-form">
            <div>
              <div class="color-section-label">Status de tratativa</div>
              <select class="modal-input" name="recovery_status">
                <option value="none" ${review.recovery_status === 'none' ? 'selected' : ''}>Não iniciado</option>
                <option value="in_progress" ${review.recovery_status === 'in_progress' ? 'selected' : ''}>Em andamento</option>
                <option value="resolved" ${review.recovery_status === 'resolved' ? 'selected' : ''}>Resolvido</option>
                <option value="lost" ${review.recovery_status === 'lost' ? 'selected' : ''}>Cliente perdido</option>
              </select>
            </div>
            <div>
              <div class="color-section-label">Notas internas</div>
              <textarea class="modal-input avaliacoes-textarea" name="recovery_notes" placeholder="Ex: liguei para o cliente, ofereci retorno sem custo...">${escapeHtml(review.recovery_notes || '')}</textarea>
            </div>
            <div id="review-recovery-feedback" class="avaliacoes-form-feedback"></div>
            <button type="submit" class="btn-save">Salvar tratativa</button>
          </form>
        </section>
      </div>

      <section class="review-panel">
        <div class="reviews-section-title">Resposta ao cliente</div>
        <form id="review-response-form" class="avaliacoes-form">
          <textarea class="modal-input avaliacoes-textarea" name="owner_response" placeholder="Escreva uma resposta educada e profissional...">${escapeHtml(review.owner_response || '')}</textarea>
          <div id="review-response-feedback" class="avaliacoes-form-feedback"></div>
          <button type="submit" class="btn-save">Salvar resposta</button>
        </form>
      </section>

      <div id="avaliacoes-modal-feedback" class="avaliacoes-form-feedback"></div>

      <div class="modal-buttons review-modal-actions">
        <button type="button" class="btn-cancel" id="avaliacoes-modal-close">Fechar</button>
        ${!review.google_review_sent ? `<button type="button" class="review-action-btn review-action-btn--success" id="avaliacoes-google-btn" data-review-id="${escapeHtml(review.id)}">Marcar Google enviado</button>` : ''}
        <button type="button" class="review-action-btn" id="avaliacoes-public-btn" data-review-id="${escapeHtml(review.id)}" data-current="${review.is_public !== false}">${review.is_public !== false ? 'Tornar privada' : 'Tornar pública'}</button>
        <button type="button" class="review-action-btn review-action-btn--purple" id="avaliacoes-featured-btn" data-review-id="${escapeHtml(review.id)}" data-current="${review.is_featured === true}">${review.is_featured ? 'Remover destaque' : 'Destacar avaliação'}</button>
      </div>
    </div>
  `;
}

function renderPendingDetails(row) {
  return `
    <div class="avaliacoes-modal-body">
      <div class="review-detail-hero">
        <div>
          <div class="reviews-section-title">Atendimento sem avaliação</div>
          <h2>${escapeHtml(row.client_name || 'Cliente')}</h2>
          <p>${escapeHtml(row.service_name || 'Serviço')} com ${escapeHtml(row.barber_name || 'Profissional')} em ${escapeHtml(formatDateTime(row.scheduled_at))}</p>
        </div>
      </div>

      <section class="review-panel">
        <div class="reviews-section-title">Registrar avaliação manual</div>
        <form id="pending-review-form" class="avaliacoes-form">
          <div class="avaliacoes-form-grid">
            <div>
              <div class="color-section-label">Nota</div>
              <select class="modal-input" name="rating">
                <option value="5">5 estrelas</option>
                <option value="4">4 estrelas</option>
                <option value="3">3 estrelas</option>
                <option value="2">2 estrelas</option>
                <option value="1">1 estrela</option>
              </select>
            </div>
          </div>
          <div>
            <div class="color-section-label">Comentário</div>
            <textarea class="modal-input avaliacoes-textarea" name="comment" placeholder="Comentário do cliente, se houver"></textarea>
          </div>
          <div id="pending-review-feedback" class="avaliacoes-form-feedback"></div>
          <button type="submit" class="btn-save">Salvar avaliação</button>
        </form>
      </section>

      <section class="review-panel">
        <div class="reviews-section-title">Mensagem sugerida</div>
        <div class="review-message-box">
          Olá ${escapeHtml(String(row.client_name || 'cliente').split(' ')[0])}, tudo bem? Gostaríamos de saber como foi seu atendimento. Sua avaliação ajuda a melhorar a experiência da barbearia. ⭐
        </div>
      </section>

      <div class="modal-buttons review-modal-actions">
        <button type="button" class="btn-cancel" id="avaliacoes-modal-close">Fechar</button>
      </div>
    </div>
  `;
}

// ─── Modal control ────────────────────────────────────────────────────────────

function openReviewModal(id) {
  avaliacoesState.activeReviewId = id;
  avaliacoesState.activePendingId = null;
  avaliacoesState.modalMode = 'view';
  renderAvaliacoesModal();
}

function openPendingModal(id) {
  avaliacoesState.activePendingId = id;
  avaliacoesState.activeReviewId = null;
  avaliacoesState.modalMode = 'pending';
  renderAvaliacoesModal();
}

function closeAvaliacoesModal() {
  const modal = document.getElementById('avaliacoes-details-modal');
  const content = document.getElementById('avaliacoes-details-content');
  if (!modal) return;

  avaliacoesState.modalMode = 'closed';
  avaliacoesState.activeReviewId = null;
  avaliacoesState.activePendingId = null;
  modal.classList.remove('open');
  modal.style.display = 'none';
  if (content) content.innerHTML = '';
}

function renderAvaliacoesModal() {
  const modal = document.getElementById('avaliacoes-details-modal');
  const content = document.getElementById('avaliacoes-details-content');
  if (!modal || !content) return;

  if (avaliacoesState.modalMode === 'closed') {
    modal.style.display = 'none';
    modal.classList.remove('open');
    content.innerHTML = '';
    return;
  }

  if (avaliacoesState.modalMode === 'view') {
    const review = avaliacoesState.activeReviewId ? getReviewById(avaliacoesState.activeReviewId) : null;
    if (!review) { closeAvaliacoesModal(); return; }
    content.innerHTML = renderReviewDetails(review);
  }

  if (avaliacoesState.modalMode === 'pending') {
    const pending = avaliacoesState.activePendingId ? getPendingById(avaliacoesState.activePendingId) : null;
    if (!pending) { closeAvaliacoesModal(); return; }
    content.innerHTML = renderPendingDetails(pending);
  }

  modal.style.display = 'flex';
  modal.classList.add('open');
  bindAvaliacoesModalEvents();
}

// ─── API calls ────────────────────────────────────────────────────────────────

async function loadAvaliacoesData() {
  avaliacoesState.isLoading = true;
  rerenderAvaliacoes();

  const query = new URLSearchParams();
  query.set('filter', avaliacoesState.activeFilter);
  if (avaliacoesState.searchTerm) query.set('q', avaliacoesState.searchTerm);

  try {
    const data = await apiFetch(`/api/reviews/insights?${query.toString()}`);
    avaliacoesState.reviews = Array.isArray(data?.items) ? data.items : [];
    avaliacoesState.pendingRequests = Array.isArray(data?.pending_requests) ? data.pending_requests : [];
    avaliacoesState.dashboard = data?.dashboard || null;
    avaliacoesState.isLoaded = true;
  } catch (error) {
    console.warn('Falha no endpoint premium de avaliações. Usando rota simples.', error);
    try {
      const legacy = await apiFetch('/api/reviews');
      avaliacoesState.reviews = Array.isArray(legacy) ? legacy : [];
      avaliacoesState.pendingRequests = [];
      avaliacoesState.dashboard = buildLegacyDashboard(avaliacoesState.reviews);
      avaliacoesState.isLoaded = true;
    } catch (fallbackError) {
      console.error('Erro ao carregar avaliações:', fallbackError);
    }
  } finally {
    avaliacoesState.isLoading = false;
    rerenderAvaliacoes();
  }
}

function buildLegacyDashboard(reviews) {
  const total = reviews.length;
  const average = total ? reviews.reduce((sum, item) => sum + Number(item.rating || 0), 0) / total : 0;
  return {
    total,
    average_rating: Number(average.toFixed(2)),
    five_star_count: reviews.filter(item => Number(item.rating || 0) >= 5).length,
    negative_count: reviews.filter(item => Number(item.rating || 0) <= 3).length,
    google_pending_count: reviews.filter(item => Number(item.rating || 0) >= 5 && item.google_review_sent !== true).length,
    with_comment_count: reviews.filter(item => String(item.comment || '').trim()).length,
    public_count: reviews.filter(item => item.is_public !== false).length,
    unresolved_count: 0,
    pending_feedback_requests: 0,
    attention_count: 0,
  };
}

async function handleMarkGoogleSent(reviewId) {
  try {
    setFeedback('avaliacoes-modal-feedback', 'Atualizando...', 'neutral');

    await apiFetch(`/api/reviews/${reviewId}/google-sent`, {
      method: 'POST',
      body: JSON.stringify({}),
    });

    await loadAvaliacoesData();
    openReviewModal(reviewId);
  } catch (error) {
    setFeedback('avaliacoes-modal-feedback', error instanceof Error ? error.message : 'Erro ao atualizar.', 'error');
  }
}

async function handleTogglePublic(reviewId, current) {
  try {
    setFeedback('avaliacoes-modal-feedback', 'Atualizando visibilidade...', 'neutral');

    await apiFetch(`/api/reviews/${reviewId}`, {
      method: 'PATCH',
      body: JSON.stringify({ is_public: !current }),
    });

    await loadAvaliacoesData();
    openReviewModal(reviewId);
  } catch (error) {
    setFeedback('avaliacoes-modal-feedback', error instanceof Error ? error.message : 'Erro ao atualizar.', 'error');
  }
}

async function handleToggleFeatured(reviewId, current) {
  try {
    setFeedback('avaliacoes-modal-feedback', 'Atualizando destaque...', 'neutral');

    await apiFetch(`/api/reviews/${reviewId}`, {
      method: 'PATCH',
      body: JSON.stringify({ is_featured: !current }),
    });

    await loadAvaliacoesData();
    openReviewModal(reviewId);
  } catch (error) {
    setFeedback('avaliacoes-modal-feedback', error instanceof Error ? error.message : 'Erro ao atualizar.', 'error');
  }
}

async function handleSaveResponse(event) {
  event.preventDefault();
  const review = getReviewById(avaliacoesState.activeReviewId);
  const form = document.getElementById('review-response-form');
  const formData = new FormData(form);
  const text = String(formData.get('owner_response') || '').trim();

  if (!text) {
    setFeedback('review-response-feedback', 'Digite uma resposta antes de salvar.', 'error');
    return;
  }

  try {
    setFeedback('review-response-feedback', 'Salvando resposta...', 'neutral');

    await apiFetch(`/api/reviews/${review.id}/respond`, {
      method: 'POST',
      body: JSON.stringify({ response: text }),
    });

    setFeedback('review-response-feedback', 'Resposta salva.', 'success');
    await loadAvaliacoesData();
    openReviewModal(review.id);
  } catch (error) {
    setFeedback('review-response-feedback', error instanceof Error ? error.message : 'Erro ao salvar resposta.', 'error');
  }
}

async function handleSaveRecovery(event) {
  event.preventDefault();
  const review = getReviewById(avaliacoesState.activeReviewId);
  const form = document.getElementById('review-recovery-form');
  const formData = new FormData(form);

  try {
    setFeedback('review-recovery-feedback', 'Salvando tratativa...', 'neutral');

    await apiFetch(`/api/reviews/${review.id}/recover`, {
      method: 'POST',
      body: JSON.stringify({
        recovery_status: String(formData.get('recovery_status') || 'in_progress'),
        recovery_notes: String(formData.get('recovery_notes') || ''),
      }),
    });

    setFeedback('review-recovery-feedback', 'Tratativa salva.', 'success');
    await loadAvaliacoesData();
    openReviewModal(review.id);
  } catch (error) {
    setFeedback('review-recovery-feedback', error instanceof Error ? error.message : 'Erro ao salvar tratativa.', 'error');
  }
}

async function handleCreateReviewFromAppointment(event) {
  event.preventDefault();
  const pending = getPendingById(avaliacoesState.activePendingId);
  const form = document.getElementById('pending-review-form');
  const formData = new FormData(form);

  try {
    setFeedback('pending-review-feedback', 'Salvando avaliação...', 'neutral');

    const created = await apiFetch(`/api/reviews/appointments/${pending.id}`, {
      method: 'POST',
      body: JSON.stringify({
        rating: Number(formData.get('rating') || 5),
        comment: String(formData.get('comment') || '').trim(),
      }),
    });

    setFeedback('pending-review-feedback', 'Avaliação salva.', 'success');
    closeAvaliacoesModal();
    await loadAvaliacoesData();
    if (created?.id) openReviewModal(created.id);
  } catch (error) {
    setFeedback('pending-review-feedback', error instanceof Error ? error.message : 'Erro ao salvar avaliação.', 'error');
  }
}

// ─── Events ───────────────────────────────────────────────────────────────────

function bindAvaliacoesModalEvents() {
  document.getElementById('avaliacoes-modal-close')?.addEventListener('click', closeAvaliacoesModal);

  document.getElementById('avaliacoes-google-btn')?.addEventListener('click', (e) => {
    const id = e.currentTarget.dataset.reviewId;
    if (id) handleMarkGoogleSent(id);
  });

  document.getElementById('avaliacoes-public-btn')?.addEventListener('click', (e) => {
    const id = e.currentTarget.dataset.reviewId;
    const current = e.currentTarget.dataset.current === 'true';
    if (id) handleTogglePublic(id, current);
  });

  document.getElementById('avaliacoes-featured-btn')?.addEventListener('click', (e) => {
    const id = e.currentTarget.dataset.reviewId;
    const current = e.currentTarget.dataset.current === 'true';
    if (id) handleToggleFeatured(id, current);
  });

  document.getElementById('review-response-form')?.addEventListener('submit', handleSaveResponse);
  document.getElementById('review-recovery-form')?.addEventListener('submit', handleSaveRecovery);
  document.getElementById('pending-review-form')?.addEventListener('submit', handleCreateReviewFromAppointment);
}

function bindReviewEvents() {
  document.querySelectorAll('.review-card-button[data-review-id]').forEach(btn => {
    btn.addEventListener('click', () => openReviewModal(btn.dataset.reviewId));
  });

  document.querySelectorAll('.pending-review-row[data-pending-id]').forEach(btn => {
    btn.addEventListener('click', () => openPendingModal(btn.dataset.pendingId));
  });

  document.querySelectorAll('[data-review-filter]').forEach(btn => {
    btn.addEventListener('click', () => {
      avaliacoesState.activeFilter = btn.dataset.reviewFilter || 'all';
      persistFilter(avaliacoesState.activeFilter);
      loadAvaliacoesData();
    });
  });
}

const debouncedLoad = debounce(() => loadAvaliacoesData(), 350);

function bindAvaliacoesStaticEvents() {
  document.getElementById('avaliacoes-details-modal')?.addEventListener('click', (e) => {
    if (e.target?.id === 'avaliacoes-details-modal') closeAvaliacoesModal();
  });

  document.getElementById('avaliacoes-search-input')?.addEventListener('input', (event) => {
    avaliacoesState.searchTerm = event.target.value || '';
    debouncedLoad();
  });
}

function rerenderAvaliacoes() {
  const cockpit = document.getElementById('reviews-cockpit-wrap');
  const filters = document.getElementById('reviews-filters-wrap');
  const list = document.getElementById('avaliacoes-reviews-list');
  const side = document.getElementById('reviews-side-wrap');

  if (cockpit) cockpit.innerHTML = renderDashboard();
  if (filters) filters.innerHTML = renderFilters();
  if (list) list.innerHTML = renderReviewsList();
  if (side) side.innerHTML = renderSidePanel();

  bindReviewEvents();
}

export function renderAvaliacoes() {
  return /* html */ `
<section class="page-shell page--avaliacoes">
  <div class="reviews-hero">
    <div>
      <div class="reviews-section-title">Reputação e qualidade</div>
      <h1>Central de Avaliações</h1>
      <p>Transforme notas em reputação, tratativas, ranking de barbeiros, prova social e pedidos inteligentes de feedback.</p>
    </div>
  </div>

  <div id="reviews-cockpit-wrap">${renderDashboard()}</div>

  <div class="reviews-toolbar">
    <div class="reviews-search-wrap">
      <span>🔍</span>
      <input id="avaliacoes-search-input" class="reviews-search-input" type="text" placeholder="Buscar por cliente, barbeiro, serviço, comentário ou status..." value="${escapeHtml(avaliacoesState.searchTerm)}" />
    </div>
  </div>

  <div id="reviews-filters-wrap">${renderFilters()}</div>

  <div class="reviews-layout">
    <main class="reviews-main-grid">
      <section class="review-panel">
        <div class="reviews-panel-head">
          <div>
            <div class="reviews-section-title">Avaliações recebidas</div>
            <h2>Notas e comentários</h2>
          </div>
        </div>
        <div id="avaliacoes-reviews-list">${renderReviewsList()}</div>
      </section>
    </main>

    <aside id="reviews-side-wrap">${renderSidePanel()}</aside>
  </div>

  <div id="avaliacoes-details-modal" class="modal-overlay" style="display:none;">
    <div class="modal reviews-modal">
      <div id="avaliacoes-details-content"></div>
    </div>
  </div>
</section>
  `;
}

export function initAvaliacoesPage() {
  bindAvaliacoesStaticEvents();
  loadAvaliacoesData();
}
