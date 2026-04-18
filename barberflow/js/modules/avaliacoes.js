import { apiFetch } from '../services/api.js';

// ─── State ────────────────────────────────────────────────────────────────────

const avaliacoesState = {
  reviews: [],
  isLoading: false,
  isLoaded: false,
  modalMode: 'closed',
  activeReviewId: null,
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

function formatDate(value) {
  if (!value) return '—';
  const d = new Date(value);
  if (isNaN(d.getTime())) return String(value);
  return d.toLocaleDateString('pt-BR');
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

function getReviewById(id) {
  return avaliacoesState.reviews.find(r => r.id === id) || null;
}

function renderStars(rating) {
  const n = Math.max(0, Math.min(5, Number(rating || 0)));
  return '★'.repeat(n) + `<span style="color:#3a4568">${'★'.repeat(5 - n)}</span>`;
}

function getMetrics() {
  const reviews = avaliacoesState.reviews;
  if (!reviews.length) return { average: '0.0', total: 0, googleSent: 0 };

  const avg = reviews.reduce((s, r) => s + Number(r.rating || 0), 0) / reviews.length;
  const googleSent = reviews.filter(r => r.google_review_sent).length;

  return {
    average: avg.toFixed(1),
    total: reviews.length,
    googleSent,
  };
}

// ─── Render ───────────────────────────────────────────────────────────────────

function renderMetrics() {
  const m = getMetrics();

  return `
    <div class="grid-3 avaliacoes-metrics-grid">
      <div class="metric-card avaliacoes-metric-center">
        <div class="metric-label">Nota média</div>
        <div class="metric-value" style="color:#ffd700">${escapeHtml(m.average)}</div>
        <div class="stars">${renderStars(Math.round(Number(m.average)))}</div>
      </div>
      <div class="metric-card">
        <div class="metric-label">Total de avaliações</div>
        <div class="metric-value">${escapeHtml(m.total)}</div>
      </div>
      <div class="metric-card">
        <div class="metric-label">Enviadas ao Google</div>
        <div class="metric-value" style="color:#00e676">${escapeHtml(m.googleSent)}</div>
      </div>
    </div>
  `;
}

function renderReviewCard(review) {
  const clientName = review.clients?.name || review.client_name || 'Cliente';
  const barberName = review.barber_profiles?.users?.name || review.barber_name || '—';

  return `
    <button type="button" class="review-card-button"
      data-review-id="${escapeHtml(review.id)}"
      title="Ver avaliação de ${escapeHtml(clientName)}">
      <div class="review-card" style="border-color:#4fc3f7">
        <div class="review-top">
          <div class="review-name">${escapeHtml(clientName)}</div>
          <div class="stars">${renderStars(review.rating)}</div>
        </div>
        ${review.comment ? `<div class="review-text">"${escapeHtml(review.comment)}"</div>` : ''}
        <div class="review-meta">
          ${escapeHtml(`Atendido por ${barberName} · ${formatDate(review.created_at)}`)}
          ${review.google_review_sent ? ' · <span style="color:#00e676">Google ✓</span>' : ''}
        </div>
      </div>
    </button>
  `;
}

function renderReviewDetails(review) {
  const clientName = review.clients?.name || 'Cliente';
  const barberName = review.barber_profiles?.users?.name || '—';

  return `
    <div class="avaliacoes-modal-body">
      <div>
        <div class="modal-title" style="margin:0;">${escapeHtml(clientName)}</div>
        <div class="modal-sub" style="margin-top:4px;">Detalhes da avaliação</div>
      </div>

      <div class="avaliacoes-modal-grid">
        <div class="mini-card">
          <div class="mini-lbl">Nota</div>
          <div class="mini-val" style="color:#ffd700">${escapeHtml(review.rating)}</div>
        </div>
        <div class="mini-card">
          <div class="mini-lbl">Barbeiro</div>
          <div class="mini-val" style="font-size:14px;">${escapeHtml(barberName)}</div>
        </div>
        <div class="mini-card">
          <div class="mini-lbl">Google</div>
          <div class="mini-val" style="font-size:14px;color:${review.google_review_sent ? '#00e676' : '#f97316'}">
            ${review.google_review_sent ? 'Enviado' : 'Não enviado'}
          </div>
        </div>
        <div class="mini-card">
          <div class="mini-lbl">Pública</div>
          <div class="mini-val" style="font-size:14px;color:${review.is_public ? '#00e676' : '#5a6888'}">
            ${review.is_public ? 'Sim' : 'Não'}
          </div>
        </div>
      </div>

      <div class="avaliacoes-modal-info">
        <div class="avaliacoes-modal-info-row"><strong>Data:</strong> ${escapeHtml(formatDate(review.created_at))}</div>
        ${review.comment ? `<div class="avaliacoes-modal-info-row"><strong>Comentário:</strong> ${escapeHtml(review.comment)}</div>` : ''}
      </div>

      <div id="avaliacoes-modal-feedback" class="avaliacoes-form-feedback"></div>

      <div class="modal-buttons" style="margin-top:10px;">
        <button type="button" class="btn-cancel" id="avaliacoes-modal-close">Fechar</button>
        ${!review.google_review_sent ? `
          <button type="button" class="btn-secondary" id="avaliacoes-google-btn"
            data-review-id="${escapeHtml(review.id)}"
            style="background:rgba(0,230,118,.1);color:#00e676;border:1px solid rgba(0,230,118,.2);">
            Marcar como enviado ao Google
          </button>
        ` : ''}
      </div>
    </div>
  `;
}

// ─── Modal control ────────────────────────────────────────────────────────────

function openReviewModal(id) {
  avaliacoesState.activeReviewId = id;
  avaliacoesState.modalMode = 'view';
  renderAvaliacoesModal();
}

function closeAvaliacoesModal() {
  const modal = document.getElementById('avaliacoes-details-modal');
  const content = document.getElementById('avaliacoes-details-content');
  if (!modal) return;

  avaliacoesState.modalMode = 'closed';
  avaliacoesState.activeReviewId = null;
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

  const review = avaliacoesState.activeReviewId ? getReviewById(avaliacoesState.activeReviewId) : null;

  if (avaliacoesState.modalMode === 'view') {
    if (!review) { closeAvaliacoesModal(); return; }
    content.innerHTML = renderReviewDetails(review);
  }

  modal.style.display = 'flex';
  modal.classList.add('open');
  bindAvaliacoesModalEvents();
}

// ─── API calls ────────────────────────────────────────────────────────────────

async function loadAvaliacoesData() {
  avaliacoesState.isLoading = true;
  rerenderAvaliacoes();

  try {
    const data = await apiFetch('/api/reviews');
    avaliacoesState.reviews = Array.isArray(data) ? data : [];
    avaliacoesState.isLoaded = true;
  } catch (error) {
    console.error('Erro ao carregar avaliações:', error);
  } finally {
    avaliacoesState.isLoading = false;
    rerenderAvaliacoes();
  }
}

async function handleMarkGoogleSent(reviewId) {
  try {
    setFeedback('avaliacoes-modal-feedback', 'Atualizando...', 'neutral');

    await apiFetch(`/api/reviews/${reviewId}`, {
      method: 'PATCH',
      body: JSON.stringify({ google_review_sent: true }),
    });

    await loadAvaliacoesData();
    openReviewModal(reviewId);
  } catch (error) {
    setFeedback('avaliacoes-modal-feedback', error instanceof Error ? error.message : 'Erro ao atualizar.', 'error');
  }
}

// ─── Events ───────────────────────────────────────────────────────────────────

function bindAvaliacoesModalEvents() {
  document.getElementById('avaliacoes-modal-close')?.addEventListener('click', closeAvaliacoesModal);

  document.getElementById('avaliacoes-google-btn')?.addEventListener('click', (e) => {
    const id = e.currentTarget.dataset.reviewId;
    if (id) handleMarkGoogleSent(id);
  });
}

function bindReviewEvents() {
  document.querySelectorAll('.review-card-button[data-review-id]').forEach(btn => {
    btn.addEventListener('click', () => openReviewModal(btn.dataset.reviewId));
  });
}

function bindAvaliacoesStaticEvents() {
  document.getElementById('avaliacoes-details-modal')?.addEventListener('click', (e) => {
    if (e.target?.id === 'avaliacoes-details-modal') closeAvaliacoesModal();
  });
}

function rerenderAvaliacoes() {
  const metrics = document.getElementById('avaliacoes-metrics');
  const list = document.getElementById('avaliacoes-reviews-list');

  if (avaliacoesState.isLoading) {
    if (list) list.innerHTML = `<div class="finance-empty">Carregando avaliações...</div>`;
    return;
  }

  if (metrics) metrics.innerHTML = renderMetrics();

  if (list) {
    list.innerHTML = avaliacoesState.reviews.length
      ? avaliacoesState.reviews.map(renderReviewCard).join('')
      : `<div class="finance-empty">Nenhuma avaliação encontrada.</div>`;
  }

  bindReviewEvents();
}

export function renderAvaliacoes() {
  return /* html */ `
<section class="page-shell page--avaliacoes">
  <div id="avaliacoes-metrics">
    ${renderMetrics()}
  </div>

  <div class="card">
    <div class="card-header">
      <div class="card-title">Avaliações Recentes</div>
    </div>
    <div id="avaliacoes-reviews-list">
      <div class="finance-empty">Carregando...</div>
    </div>
  </div>

  <div id="avaliacoes-details-modal" class="modal-overlay" style="display:none;">
    <div class="modal" style="width:min(92vw, 620px);">
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
