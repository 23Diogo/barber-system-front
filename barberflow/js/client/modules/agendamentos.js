import {
  getClientPortalAppointments,
  cancelClientPortalAppointment,
  getClientPortalContext,
} from '../../services/client-auth.js';

const API_BASE = () => String(window.__API_BASE__ || '').replace(/\/$/, '');

const state = {
  upcoming: [],
  history: [],
  context: null,
};

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

function formatDateTime(value) {
  if (!value) return '-';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '-';
  return date.toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' });
}

function formatStatus(status) {
  const map = { confirmed: 'Confirmado', pending: 'Pendente', cancelled: 'Cancelado', completed: 'Concluído' };
  return map[String(status || '').toLowerCase()] || status || '-';
}

function statusStyles(status) {
  const key = String(status || '').toLowerCase();
  if (key === 'confirmed') return 'background:rgba(0,230,118,.10);color:#00e676;border:1px solid rgba(0,230,118,.18);';
  if (key === 'pending')   return 'background:rgba(255,193,7,.10);color:#ffd166;border:1px solid rgba(255,193,7,.18);';
  if (key === 'cancelled') return 'background:rgba(255,82,82,.10);color:#ff8a80;border:1px solid rgba(255,82,82,.18);';
  if (key === 'completed') return 'background:rgba(79,195,247,.10);color:#7dd3fc;border:1px solid rgba(79,195,247,.18);';
  return 'background:rgba(255,255,255,.06);color:#dce8ff;border:1px solid rgba(255,255,255,.12);';
}

function setFeedback(message, variant = 'neutral') {
  const el = document.getElementById('client-agendamentos-feedback');
  if (!el) return;
  el.textContent = message || '';
  el.style.color = variant === 'error' ? '#ff7b91' : variant === 'success' ? '#00e676' : '#8fa3c7';
}

// ─── Info row — label + valor em branco e maior ───────────────────────────────

function infoRow(label, value, pill) {
  return `
    <div class="cfg-row">
      <div>
        <div class="cfg-label">${escapeHtml(label)}</div>
        <div style="font-size:15px;color:#fff;margin-top:2px;font-weight:500;">${value}</div>
      </div>
      <span class="pill">${escapeHtml(pill)}</span>
    </div>
  `;
}

// ─── Rating inline ────────────────────────────────────────────────────────────

function renderRatingSection(item) {
  const isCompleted = String(item?.status || '').toLowerCase() === 'completed';
  if (!isCompleted) return '';

  const alreadyRated = item?.rating != null;
  const appointmentId = escapeHtml(item.id);

  if (alreadyRated) {
    const stars = '★'.repeat(item.rating) + '☆'.repeat(5 - item.rating);
    return `
      <div style="border-top:1px solid rgba(79,195,247,.10);padding-top:12px;display:flex;align-items:center;gap:10px;flex-wrap:wrap;">
        <span style="font-size:18px;color:#ffd166;letter-spacing:2px">${stars}</span>
        <span style="font-size:13px;color:#8fa3c7">${item.rating_comment ? escapeHtml(item.rating_comment) : 'Avaliação enviada'}</span>
      </div>
    `;
  }

  return `
    <div style="border-top:1px solid rgba(79,195,247,.10);padding-top:12px;">
      <div id="rating-section-${appointmentId}" style="display:none;gap:10px;flex-direction:column;">
        <div style="display:flex;gap:6px;align-items:center;" id="stars-${appointmentId}">
          ${[1,2,3,4,5].map(n => `
            <button type="button" data-star="${n}" data-appt="${appointmentId}"
              style="font-size:24px;background:none;border:none;cursor:pointer;color:#555;padding:0;line-height:1;transition:color .15s"
              onmouseover="document.querySelectorAll('[data-appt=\\'${appointmentId}\\'][data-star]').forEach(s=>s.style.color=Number(s.dataset.star)<=${n}?'#ffd166':'#555')"
              onmouseleave="this.closest('[id]') && document.querySelectorAll('[data-appt=\\'${appointmentId}\\'][data-star]').forEach(s=>s.style.color=Number(s.dataset.star)<=(Number(document.getElementById('rating-val-${appointmentId}')?.value||0))?'#ffd166':'#555')"
            >★</button>
          `).join('')}
          <input type="hidden" id="rating-val-${appointmentId}" value="0" />
        </div>
        <textarea id="rating-comment-${appointmentId}" placeholder="Comentário opcional..." rows="2"
          style="width:100%;background:rgba(255,255,255,.05);border:1px solid rgba(79,195,247,.18);border-radius:10px;color:#fff;font:inherit;font-size:13px;padding:8px 10px;resize:vertical;box-sizing:border-box;"></textarea>
        <div style="display:flex;gap:8px;justify-content:flex-end;">
          <button type="button" data-rating-cancel="${appointmentId}"
            style="padding:6px 14px;border-radius:10px;border:1px solid rgba(255,255,255,.12);background:transparent;color:#8fa3c7;font:inherit;font-size:13px;cursor:pointer;">
            Cancelar
          </button>
          <button type="button" data-rating-submit="${appointmentId}"
            style="padding:6px 14px;border-radius:10px;border:0;background:rgba(79,195,247,.18);color:#7dd3fc;font:inherit;font-size:13px;font-weight:700;cursor:pointer;">
            Enviar avaliação
          </button>
        </div>
      </div>
      <button type="button" data-rating-open="${appointmentId}"
        style="font-size:13px;padding:6px 14px;border-radius:10px;border:1px solid rgba(255,193,7,.25);background:rgba(255,193,7,.08);color:#ffd166;font:inherit;cursor:pointer;">
        ★ Avaliar atendimento
      </button>
    </div>
  `;
}

// ─── Card de agendamento ──────────────────────────────────────────────────────

function renderAppointmentCard(item, { allowCancel = false } = {}) {
  const barberUser = Array.isArray(item?.barber_profiles?.users)
    ? item.barber_profiles.users[0]
    : item?.barber_profiles?.users || {};

  const billingLabel = item?.billing_mode === 'subscription'
    ? 'Incluído no plano'
    : `Cobrança avulsa • ${formatCurrency(item?.final_price || item?.price || 0)}`;

  const notesLabel = item?.notes ? escapeHtml(item.notes) : 'Sem observação';

  return `
    <div style="border:1px solid rgba(79,195,247,.12);border-radius:18px;background:rgba(255,255,255,.03);padding:16px;display:grid;gap:12px;">
      <div style="display:flex;justify-content:space-between;gap:12px;align-items:flex-start;flex-wrap:wrap;">
        <div>
          <div style="font-size:17px;font-weight:800;color:#fff;">${escapeHtml(item?.services?.name || 'Serviço')}</div>
          <div style="color:#8fa3c7;margin-top:4px;">${escapeHtml(formatDateTime(item?.scheduled_at))}</div>
        </div>
        <span style="padding:6px 10px;border-radius:999px;font-size:12px;font-weight:800;${statusStyles(item?.status)}">
          ${escapeHtml(formatStatus(item?.status))}
        </span>
      </div>

      ${infoRow('Profissional', escapeHtml(barberUser?.name || 'Profissional'), 'Agenda')}
      ${infoRow('Cobrança', escapeHtml(billingLabel), item?.billing_mode || 'avulso')}
      ${infoRow('Observação', notesLabel, 'Notas')}

      ${item?.cancelled_reason ? infoRow('Motivo do cancelamento', escapeHtml(item.cancelled_reason), 'Cancelado') : ''}

      ${renderRatingSection(item)}

      ${allowCancel ? `
        <div style="display:flex;justify-content:flex-end;">
          <button type="button" data-cancel-appointment-id="${escapeHtml(item.id)}"
            style="min-height:42px;padding:0 14px;border-radius:12px;border:1px solid rgba(255,82,82,.20);background:rgba(255,82,82,.08);color:#ff8a80;font:inherit;font-weight:800;cursor:pointer;">
            Cancelar agendamento
          </button>
        </div>
      ` : ''}
    </div>
  `;
}

function renderList(targetId, items, emptyTitle, emptyText, allowCancel = false) {
  const container = document.getElementById(targetId);
  if (!container) return;

  if (!items.length) {
    container.innerHTML = `
      <div class="cfg-row">
        <div>
          <div class="cfg-label">${escapeHtml(emptyTitle)}</div>
          <div class="cfg-sub">${escapeHtml(emptyText)}</div>
        </div>
        <span class="pill">Vazio</span>
      </div>
    `;
    return;
  }

  container.innerHTML = `<div style="display:grid;gap:14px;">${items.map(item => renderAppointmentCard(item, { allowCancel })).join('')}</div>`;
}

// ─── Rating: bind events ──────────────────────────────────────────────────────

function bindRatingActions() {
  // Abrir formulário
  document.querySelectorAll('[data-rating-open]').forEach(btn => {
    btn.addEventListener('click', () => {
      const id = btn.getAttribute('data-rating-open');
      const section = document.getElementById(`rating-section-${id}`);
      if (section) { section.style.display = 'flex'; btn.style.display = 'none'; }
    });
  });

  // Cancelar
  document.querySelectorAll('[data-rating-cancel]').forEach(btn => {
    btn.addEventListener('click', () => {
      const id = btn.getAttribute('data-rating-cancel');
      const section = document.getElementById(`rating-section-${id}`);
      const openBtn = document.querySelector(`[data-rating-open="${id}"]`);
      if (section) section.style.display = 'none';
      if (openBtn) openBtn.style.display = '';
    });
  });

  // Selecionar estrela
  document.querySelectorAll('[data-star]').forEach(star => {
    star.addEventListener('click', () => {
      const id = star.getAttribute('data-appt');
      const val = Number(star.getAttribute('data-star'));
      const input = document.getElementById(`rating-val-${id}`);
      if (input) input.value = String(val);
      document.querySelectorAll(`[data-appt="${id}"][data-star]`).forEach(s => {
        s.style.color = Number(s.getAttribute('data-star')) <= val ? '#ffd166' : '#555';
      });
    });
  });

  // Enviar avaliação
  document.querySelectorAll('[data-rating-submit]').forEach(btn => {
    btn.addEventListener('click', async () => {
      const id = btn.getAttribute('data-rating-submit');
      const rating = Number(document.getElementById(`rating-val-${id}`)?.value || 0);
      const comment = document.getElementById(`rating-comment-${id}`)?.value?.trim() || '';

      if (!rating || rating < 1 || rating > 5) {
        setFeedback('Selecione uma nota de 1 a 5 estrelas.', 'error');
        return;
      }

      try {
        btn.disabled = true;
        setFeedback('Enviando avaliação...', 'neutral');

        const token = localStorage.getItem('barberflow.clientToken') || '';
        const res = await fetch(`${API_BASE()}/api/client-portal/appointments/${id}/rate`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
          body: JSON.stringify({ rating, comment }),
        });

        if (!res.ok) {
          const err = await res.json().catch(() => ({}));
          throw new Error(err?.error || `Erro ${res.status}`);
        }

        setFeedback('Avaliação enviada com sucesso!', 'success');
        await loadAppointments();
      } catch (error) {
        setFeedback(error instanceof Error ? error.message : 'Não foi possível enviar a avaliação.', 'error');
        btn.disabled = false;
      }
    });
  });
}

function bindCancelActions() {
  document.querySelectorAll('[data-cancel-appointment-id]').forEach((button) => {
    button.addEventListener('click', async () => {
      const appointmentId = button.getAttribute('data-cancel-appointment-id');
      if (!appointmentId) return;

      const cancellationHours = Number(state.context?.barbershop?.cancellation_hours || 0);
      const reason = window.prompt(
        `Informe um motivo curto para o cancelamento.\nRegra atual: mínimo de ${cancellationHours} hora(s) de antecedência.`,
        'Cancelado pelo cliente'
      );
      if (reason === null) return;

      try {
        button.disabled = true;
        setFeedback('Cancelando agendamento...', 'neutral');
        await cancelClientPortalAppointment(appointmentId, reason);
        setFeedback('Agendamento cancelado com sucesso.', 'success');
        await loadAppointments();
      } catch (error) {
        setFeedback(error instanceof Error ? error.message : 'Não foi possível cancelar o agendamento.', 'error');
        button.disabled = false;
      }
    });
  });
}

async function loadAppointments() {
  const [context, appointments] = await Promise.all([
    getClientPortalContext(),
    getClientPortalAppointments(),
  ]);

  state.context = context || null;
  state.upcoming = Array.isArray(appointments?.upcoming) ? appointments.upcoming : [];
  state.history = Array.isArray(appointments?.history) ? appointments.history : [];

  renderHeaderMeta();
  renderList('client-upcoming-list', state.upcoming, 'Nenhum próximo agendamento', 'Seus próximos horários aparecerão aqui.', true);
  renderList('client-history-list', state.history, 'Nenhum histórico ainda', 'Quando houver atendimentos concluídos ou cancelados, eles aparecerão aqui.', false);

  bindCancelActions();
  bindRatingActions();
}

function renderHeaderMeta() {
  const container = document.getElementById('client-agendamentos-meta');
  if (!container) return;

  const cancellationHours = Number(state.context?.barbershop?.cancellation_hours || 0);

  container.innerHTML = `
    <div class="metric-card">
      <div class="metric-label">Próximos</div>
      <div class="metric-value">${escapeHtml(String(state.upcoming.length))}</div>
      <div class="metric-sub color-nt">Horários futuros</div>
    </div>
    <div class="metric-card">
      <div class="metric-label">Histórico</div>
      <div class="metric-value">${escapeHtml(String(state.history.length))}</div>
      <div class="metric-sub color-nt">Concluídos e cancelados</div>
    </div>
    <div class="metric-card">
      <div class="metric-label">Cancelamento</div>
      <div class="metric-value">${escapeHtml(String(cancellationHours))}h</div>
      <div class="metric-sub color-nt">Antecedência mínima</div>
    </div>
  `;
}

export function renderClientAgendamentos() {
  return `
    <div id="pages" style="display:block">
      <div class="page active">
        <div style="display:grid;gap:18px;">
          <div class="card">
            <div class="card-header">
              <div class="card-title">Meus agendamentos</div>
              <div class="card-action" data-client-route="agendar">Novo agendamento</div>
            </div>
            <div id="client-agendamentos-feedback" style="min-height:20px;margin-bottom:14px;color:#8fa3c7;"></div>
            <div id="client-agendamentos-meta" class="grid-3"></div>
          </div>

          <div class="card">
            <div class="card-header">
              <div class="card-title">Próximos horários</div>
            </div>
            <div id="client-upcoming-list"></div>
          </div>

          <div class="card">
            <div class="card-header">
              <div class="card-title">Histórico</div>
            </div>
            <div id="client-history-list"></div>
          </div>
        </div>
      </div>
    </div>
  `;
}

export function initClientAgendamentosPage() {
  (async () => {
    try {
      setFeedback('Carregando seus agendamentos...', 'neutral');
      await loadAppointments();
      setFeedback('Seus agendamentos foram carregados.', 'neutral');
    } catch (error) {
      setFeedback(error instanceof Error ? error.message : 'Não foi possível carregar os agendamentos.', 'error');
    }
  })();
}
