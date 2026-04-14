const avaliacoesState = {
  googleReviewsCount: 34,
  reviews: [
    {
      id: 'rafael-souza-review',
      clientName: 'Rafael Souza',
      barberName: 'Jorge',
      rating: 5,
      text: 'Melhor barbearia da cidade! Jorge é um artista, fade perfeito como sempre. Atendimento rápido e ambiente ótimo.',
      dateLabel: 'Hoje 09:00',
      channel: 'Google',
      publishedToGoogle: true,
    },
    {
      id: 'pedro-lima-review',
      clientName: 'Pedro Lima',
      barberName: 'Marcos',
      rating: 5,
      text: 'Marcos fez um trabalho impecável no fade. Primeira vez aqui e já voltarei com certeza!',
      dateLabel: 'Hoje 10:00',
      channel: 'Google',
      publishedToGoogle: true,
    },
    {
      id: 'andre-costa-review',
      clientName: 'André Costa',
      barberName: 'Lucas',
      rating: 4,
      text: 'Ótimo atendimento, só achei um pouco demorado. No geral, muito bom!',
      dateLabel: '12/04/2025',
      channel: 'Interna',
      publishedToGoogle: false,
    },
  ],
  modalMode: 'closed', // closed | view | edit | create
  activeReviewId: null,
};

function escapeHtml(value) {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

function getReviewById(reviewId) {
  return avaliacoesState.reviews.find((item) => item.id === reviewId) || null;
}

function normalizeReviewId(clientName) {
  const base = String(clientName || 'nova-avaliacao')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '') || 'nova-avaliacao';

  let candidate = `${base}-review`;
  let counter = 2;

  while (avaliacoesState.reviews.some((item) => item.id === candidate)) {
    candidate = `${base}-review-${counter}`;
    counter += 1;
  }

  return candidate;
}

function renderStars(rating) {
  const safeRating = Math.max(0, Math.min(5, Number(rating || 0)));
  const filled = '★'.repeat(safeRating);
  const empty = '★'.repeat(5 - safeRating);

  return `${filled}${empty ? `<span style="color:#3a4568">${empty}</span>` : ''}`;
}

function getAverageRating() {
  if (!avaliacoesState.reviews.length) return 0;
  const total = avaliacoesState.reviews.reduce((sum, item) => sum + Number(item.rating || 0), 0);
  return total / avaliacoesState.reviews.length;
}

function getMetrics() {
  const avg = getAverageRating();
  const total = avaliacoesState.reviews.length + 124;
  const googleReviews = avaliacoesState.googleReviewsCount;

  return {
    average: avg.toFixed(1),
    total,
    googleReviews,
  };
}

function renderMetrics() {
  const metrics = getMetrics();

  return `
    <div class="grid-3 avaliacoes-metrics-grid">
      <div class="metric-card avaliacoes-metric-center">
        <div class="metric-label">Nota média</div>
        <div class="metric-value" style="color:#ffd700">${escapeHtml(metrics.average)}</div>
        <div class="stars">${renderStars(Math.round(Number(metrics.average)))}</div>
      </div>

      <div class="metric-card">
        <div class="metric-label">Total avaliações</div>
        <div class="metric-value">${escapeHtml(metrics.total)}</div>
        <div class="metric-sub color-up">↑ 8 este mês</div>
      </div>

      <div class="metric-card">
        <div class="metric-label">Google Reviews</div>
        <div class="metric-value" style="color:#00e676">${escapeHtml(metrics.googleReviews)}</div>
        <div class="metric-sub color-nt">enviados ao Google</div>
      </div>
    </div>
  `;
}

function renderReviewCard(review) {
  const borderColor = Number(review.rating || 0) >= 5 ? '#4fc3f7' : '#4fc3f7';

  return `
    <button
      type="button"
      class="review-card-button"
      data-review-id="${escapeHtml(review.id)}"
      title="Ver detalhes da avaliação de ${escapeHtml(review.clientName)}"
    >
      <div class="review-card" style="border-color:${borderColor}">
        <div class="review-top">
          <div class="review-name">${escapeHtml(review.clientName)}</div>
          <div class="stars">${renderStars(review.rating)}</div>
        </div>
        <div class="review-text">"${escapeHtml(review.text)}"</div>
        <div class="review-meta">
          ${escapeHtml(`Atendido por ${review.barberName} · ${review.dateLabel}`)}
        </div>
      </div>
    </button>
  `;
}

function renderReviewsList() {
  return avaliacoesState.reviews.map(renderReviewCard).join('');
}

function renderReviewDetails(review) {
  return `
    <div class="avaliacoes-modal-body">
      <div>
        <div class="modal-title" style="margin:0;">${escapeHtml(review.clientName)}</div>
        <div class="modal-sub" style="margin-top:4px;">Detalhes da avaliação</div>
      </div>

      <div class="avaliacoes-modal-grid">
        <div class="mini-card">
          <div class="mini-lbl">Nota</div>
          <div class="mini-val" style="color:#ffd700">${escapeHtml(review.rating)}</div>
        </div>
        <div class="mini-card">
          <div class="mini-lbl">Canal</div>
          <div class="mini-val" style="font-size:15px;">${escapeHtml(review.channel)}</div>
        </div>
        <div class="mini-card">
          <div class="mini-lbl">Atendido por</div>
          <div class="mini-val" style="font-size:15px;">${escapeHtml(review.barberName)}</div>
        </div>
        <div class="mini-card">
          <div class="mini-lbl">Publicado</div>
          <div class="mini-val" style="font-size:15px;color:${review.publishedToGoogle ? '#00e676' : '#f97316'}">
            ${escapeHtml(review.publishedToGoogle ? 'No Google' : 'Interna')}
          </div>
        </div>
      </div>

      <div class="avaliacoes-modal-info">
        <div class="avaliacoes-modal-info-row">
          <strong>Data:</strong> ${escapeHtml(review.dateLabel)}
        </div>
        <div class="avaliacoes-modal-info-row">
          <strong>Comentário:</strong> ${escapeHtml(review.text)}
        </div>
      </div>

      <div class="modal-buttons" style="margin-top:10px;">
        <button type="button" class="btn-cancel" id="avaliacoes-modal-close">Fechar</button>
        <button type="button" class="btn-save" id="avaliacoes-edit-button" data-review-id="${escapeHtml(review.id)}">Editar avaliação</button>
      </div>
    </div>
  `;
}

function renderReviewForm(mode, review = null) {
  const isEdit = mode === 'edit';
  const safeReview = review || {
    clientName: '',
    barberName: '',
    rating: 5,
    text: '',
    dateLabel: '',
    channel: 'Google',
    publishedToGoogle: true,
  };

  return `
    <div class="avaliacoes-modal-body">
      <div>
        <div class="modal-title" style="margin:0;">${isEdit ? 'Editar avaliação' : 'Nova avaliação'}</div>
        <div class="modal-sub" style="margin-top:4px;">
          ${isEdit ? 'Atualize os dados da avaliação.' : 'Preencha os dados para registrar uma nova avaliação.'}
        </div>
      </div>

      <form id="avaliacoes-form" class="avaliacoes-form">
        <div class="avaliacoes-form-grid">
          <div>
            <div class="color-section-label">Cliente</div>
            <input class="modal-input" name="clientName" type="text" value="${escapeHtml(safeReview.clientName)}" placeholder="Nome do cliente" />
          </div>

          <div>
            <div class="color-section-label">Barbeiro</div>
            <input class="modal-input" name="barberName" type="text" value="${escapeHtml(safeReview.barberName)}" placeholder="Nome do barbeiro" />
          </div>

          <div>
            <div class="color-section-label">Nota</div>
            <select class="modal-input" name="rating">
              <option value="5" ${Number(safeReview.rating) === 5 ? 'selected' : ''}>5</option>
              <option value="4" ${Number(safeReview.rating) === 4 ? 'selected' : ''}>4</option>
              <option value="3" ${Number(safeReview.rating) === 3 ? 'selected' : ''}>3</option>
              <option value="2" ${Number(safeReview.rating) === 2 ? 'selected' : ''}>2</option>
              <option value="1" ${Number(safeReview.rating) === 1 ? 'selected' : ''}>1</option>
            </select>
          </div>

          <div>
            <div class="color-section-label">Canal</div>
            <select class="modal-input" name="channel">
              <option value="Google" ${safeReview.channel === 'Google' ? 'selected' : ''}>Google</option>
              <option value="Interna" ${safeReview.channel === 'Interna' ? 'selected' : ''}>Interna</option>
              <option value="WhatsApp" ${safeReview.channel === 'WhatsApp' ? 'selected' : ''}>WhatsApp</option>
            </select>
          </div>

          <div>
            <div class="color-section-label">Data</div>
            <input class="modal-input" name="dateLabel" type="text" value="${escapeHtml(safeReview.dateLabel)}" placeholder="Ex.: Hoje 09:00" />
          </div>

          <div>
            <div class="color-section-label">Publicação</div>
            <select class="modal-input" name="publishedToGoogle">
              <option value="true" ${safeReview.publishedToGoogle ? 'selected' : ''}>Google</option>
              <option value="false" ${!safeReview.publishedToGoogle ? 'selected' : ''}>Somente interna</option>
            </select>
          </div>
        </div>

        <div>
          <div class="color-section-label">Comentário</div>
          <textarea class="modal-input avaliacoes-textarea" name="text" placeholder="Comentário da avaliação">${escapeHtml(safeReview.text)}</textarea>
        </div>

        <div id="avaliacoes-form-feedback" class="avaliacoes-form-feedback"></div>

        <div class="modal-buttons" style="margin-top:10px;">
          <button type="button" class="btn-cancel" id="${isEdit ? 'avaliacoes-form-back' : 'avaliacoes-form-cancel'}">
            ${isEdit ? 'Voltar' : 'Cancelar'}
          </button>
          <button type="submit" class="btn-save">
            ${isEdit ? 'Salvar alterações' : 'Criar avaliação'}
          </button>
        </div>
      </form>
    </div>
  `;
}

function setAvaliacoesFormFeedback(message, variant = 'neutral') {
  const el = document.getElementById('avaliacoes-form-feedback');
  if (!el) return;

  el.textContent = message || '';
  el.style.color =
    variant === 'error' ? '#ff8a8a' :
    variant === 'success' ? '#00e676' :
    '#5a6888';
}

function openReviewModal(reviewId) {
  avaliacoesState.activeReviewId = reviewId;
  avaliacoesState.modalMode = 'view';
  renderAvaliacoesModal();
}

function openEditReviewModal(reviewId) {
  avaliacoesState.activeReviewId = reviewId;
  avaliacoesState.modalMode = 'edit';
  renderAvaliacoesModal();
}

function openCreateReviewModal() {
  avaliacoesState.activeReviewId = null;
  avaliacoesState.modalMode = 'create';
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

function collectReviewFormData() {
  const form = document.getElementById('avaliacoes-form');
  const formData = new FormData(form);

  return {
    clientName: String(formData.get('clientName') || '').trim(),
    barberName: String(formData.get('barberName') || '').trim(),
    rating: Number(formData.get('rating') || 5),
    text: String(formData.get('text') || '').trim(),
    dateLabel: String(formData.get('dateLabel') || '').trim(),
    channel: String(formData.get('channel') || 'Google').trim(),
    publishedToGoogle: String(formData.get('publishedToGoogle') || 'true') === 'true',
  };
}

function handleReviewFormSubmit(event) {
  event.preventDefault();

  const data = collectReviewFormData();

  if (!data.clientName) {
    setAvaliacoesFormFeedback('Informe o nome do cliente.', 'error');
    return;
  }

  if (!data.barberName) {
    setAvaliacoesFormFeedback('Informe o nome do barbeiro.', 'error');
    return;
  }

  if (!data.text) {
    setAvaliacoesFormFeedback('Informe o comentário da avaliação.', 'error');
    return;
  }

  if (!data.dateLabel) {
    setAvaliacoesFormFeedback('Informe a data da avaliação.', 'error');
    return;
  }

  if (avaliacoesState.modalMode === 'create') {
    const newReview = {
      id: normalizeReviewId(data.clientName),
      ...data,
    };

    avaliacoesState.reviews = [newReview, ...avaliacoesState.reviews];
    if (newReview.publishedToGoogle) {
      avaliacoesState.googleReviewsCount += 1;
    }

    rerenderAvaliacoes();
    openReviewModal(newReview.id);
    return;
  }

  if (avaliacoesState.modalMode === 'edit' && avaliacoesState.activeReviewId) {
    const current = getReviewById(avaliacoesState.activeReviewId);
    if (!current) return;

    if (current.publishedToGoogle && !data.publishedToGoogle) {
      avaliacoesState.googleReviewsCount = Math.max(0, avaliacoesState.googleReviewsCount - 1);
    }

    if (!current.publishedToGoogle && data.publishedToGoogle) {
      avaliacoesState.googleReviewsCount += 1;
    }

    avaliacoesState.reviews = avaliacoesState.reviews.map((item) => {
      if (item.id !== avaliacoesState.activeReviewId) return item;
      return { ...item, ...data };
    });

    rerenderAvaliacoes();
    openReviewModal(avaliacoesState.activeReviewId);
  }
}

function renderAvaliacoesModal() {
  const modal = document.getElementById('avaliacoes-details-modal');
  const content = document.getElementById('avaliacoes-details-content');
  if (!modal || !content) return;

  if (avaliacoesState.modalMode === 'closed') {
    modal.classList.remove('open');
    modal.style.display = 'none';
    content.innerHTML = '';
    return;
  }

  const review = avaliacoesState.activeReviewId ? getReviewById(avaliacoesState.activeReviewId) : null;

  if ((avaliacoesState.modalMode === 'view' || avaliacoesState.modalMode === 'edit') && !review) {
    closeAvaliacoesModal();
    return;
  }

  if (avaliacoesState.modalMode === 'view') {
    content.innerHTML = renderReviewDetails(review);
  }

  if (avaliacoesState.modalMode === 'edit') {
    content.innerHTML = renderReviewForm('edit', review);
  }

  if (avaliacoesState.modalMode === 'create') {
    content.innerHTML = renderReviewForm('create');
  }

  modal.style.display = 'flex';
  modal.classList.add('open');

  bindAvaliacoesModalEvents();
}

function bindReviewEvents() {
  document.querySelectorAll('.review-card-button[data-review-id]').forEach((button) => {
    button.addEventListener('click', () => {
      openReviewModal(button.dataset.reviewId);
    });
  });
}

function bindAvaliacoesModalEvents() {
  document.getElementById('avaliacoes-modal-close')?.addEventListener('click', closeAvaliacoesModal);

  document.getElementById('avaliacoes-edit-button')?.addEventListener('click', () => {
    const button = document.getElementById('avaliacoes-edit-button');
    if (!button?.dataset.reviewId) return;
    openEditReviewModal(button.dataset.reviewId);
  });

  document.getElementById('avaliacoes-form-back')?.addEventListener('click', () => {
    if (!avaliacoesState.activeReviewId) return;
    openReviewModal(avaliacoesState.activeReviewId);
  });

  document.getElementById('avaliacoes-form-cancel')?.addEventListener('click', closeAvaliacoesModal);
  document.getElementById('avaliacoes-form')?.addEventListener('submit', handleReviewFormSubmit);
}

function bindAvaliacoesStaticEvents() {
  document.getElementById('avaliacoes-new-button')?.addEventListener('click', openCreateReviewModal);

  document.getElementById('avaliacoes-details-modal')?.addEventListener('click', (event) => {
    if (event.target?.id === 'avaliacoes-details-modal') {
      closeAvaliacoesModal();
    }
  });
}

function rerenderAvaliacoes() {
  const metrics = document.getElementById('avaliacoes-metrics');
  const list = document.getElementById('avaliacoes-reviews-list');

  if (metrics) metrics.innerHTML = renderMetrics();
  if (list) list.innerHTML = renderReviewsList();

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
      <button type="button" class="card-action" id="avaliacoes-new-button">+ Nova avaliação</button>
    </div>

    <div id="avaliacoes-reviews-list">
      ${renderReviewsList()}
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
  bindReviewEvents();
}
