import {
  getClientPortalAppointments,
  cancelClientPortalAppointment,
  getClientPortalContext,
  rateClientPortalAppointment,
} from '../../services/client-auth.js';

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
  return new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL',
  }).format(Number(value || 0));
}

function formatDateTime(value) {
  if (!value) return '-';

  const match = String(value).match(/^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})/);

  if (match) {
    return `${match[3]}/${match[2]}/${match[1]} ${match[4]}:${match[5]}`;
  }

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) return '-';

  return date.toLocaleString('pt-BR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    timeZone: 'America/Sao_Paulo',
  });
}

function formatStatus(status) {
  const map = {
    pending: 'Pendente',
    confirmed: 'Confirmado',
    in_progress: 'Em atendimento',
    completed: 'Concluído',
    cancelled: 'Cancelado',
    canceled: 'Cancelado',
    no_show: 'Não compareceu',
  };

  return map[String(status || '').toLowerCase()] || status || '-';
}

function statusStyles(status) {
  const key = String(status || '').toLowerCase();

  if (key === 'confirmed') {
    return 'background:rgba(0,230,118,.10);color:#00e676;border:1px solid rgba(0,230,118,.18);';
  }

  if (key === 'pending') {
    return 'background:rgba(255,193,7,.10);color:#ffd166;border:1px solid rgba(255,193,7,.18);';
  }

  if (['cancelled', 'canceled', 'no_show'].includes(key)) {
    return 'background:rgba(255,82,82,.10);color:#ff8a80;border:1px solid rgba(255,82,82,.18);';
  }

  if (key === 'completed') {
    return 'background:rgba(79,195,247,.10);color:#7dd3fc;border:1px solid rgba(79,195,247,.18);';
  }

  return 'background:rgba(255,255,255,.06);color:#dce8ff;border:1px solid rgba(255,255,255,.12);';
}

function setFeedback(message, variant = 'neutral') {
  const el = document.getElementById('client-agendamentos-feedback');

  if (!el) return;

  el.textContent = message || '';
  el.style.color =
    variant === 'error'
      ? '#ff7b91'
      : variant === 'success'
        ? '#00e676'
        : '#8fa3c7';
}

function getScheduledAt(item) {
  return item?.scheduled_at || item?.scheduledAt || item?.date || item?.datetime || '';
}

function getServiceName(item) {
  return (
    item?.services?.name ||
    item?.service?.name ||
    item?.service_name ||
    item?.service ||
    'Serviço'
  );
}

function getBarberName(item) {
  return (
    item?.barber_profiles?.users?.name ||
    item?.barber_profiles?.user?.name ||
    item?.barber?.name ||
    item?.barber_name ||
    'Profissional'
  );
}

function getAppointmentAmount(item) {
  if (item?.charged_amount_cents != null) return Number(item.charged_amount_cents || 0) / 100;
  if (item?.charged_amount != null) return Number(item.charged_amount || 0);
  if (item?.final_price != null) return Number(item.final_price || 0);
  if (item?.price != null) return Number(item.price || 0);
  return 0;
}

function isSubscriptionAppointment(item) {
  return (
    String(item?.billing_mode || '').toLowerCase() === 'subscription' ||
    Boolean(item?.subscription_consumption_id) ||
    Boolean(item?.subscription_id)
  );
}

function billingLabel(item) {
  if (isSubscriptionAppointment(item)) {
    return {
      title: 'Coberto por plano',
      detail: 'Este atendimento está vinculado aos créditos da assinatura.',
      pill: 'Plano',
      color: '#00e676',
    };
  }

  return {
    title: formatCurrency(getAppointmentAmount(item)),
    detail: 'Atendimento avulso.',
    pill: 'Avulso',
    color: '#7dd3fc',
  };
}

function getCancellationHours() {
  return Number(
    state.context?.barbershop?.cancellation_hours ??
    state.context?.barbershop?.min_cancel_hours ??
    0
  );
}

function canCancelByTime(item) {
  const status = String(item?.status || '').toLowerCase();

  if (!['pending', 'confirmed'].includes(status)) {
    return {
      canCancel: false,
      reason: 'Somente agendamentos pendentes ou confirmados podem ser cancelados.',
    };
  }

  const scheduledAt = getScheduledAt(item);
  const date = scheduledAt ? new Date(scheduledAt) : null;

  if (!date || Number.isNaN(date.getTime())) {
    return {
      canCancel: true,
      reason: '',
    };
  }

  const hours = getCancellationHours();
  const diffMs = date.getTime() - Date.now();
  const minMs = hours * 60 * 60 * 1000;

  if (hours > 0 && diffMs < minMs) {
    return {
      canCancel: false,
      reason: `Cancelamento permitido até ${hours}h antes do horário.`,
    };
  }

  if (diffMs <= 0) {
    return {
      canCancel: false,
      reason: 'Horário já iniciado ou encerrado.',
    };
  }

  return {
    canCancel: true,
    reason: '',
  };
}

function renderStars(count) {
  let output = '';

  for (let i = 1; i <= 5; i += 1) {
    output += i <= Number(count || 0) ? '★' : '☆';
  }

  return output;
}

function renderRatingSection(item) {
  const status = String(item?.status || '').toLowerCase();

  if (status !== 'completed') return '';

  const id = escapeHtml(item.id);
  const alreadyRated = item.rating != null;

  if (alreadyRated) {
    return `
      <div style="border-top:1px solid rgba(79,195,247,.10);padding-top:12px;display:flex;align-items:center;gap:10px;flex-wrap:wrap;">
        <span style="font-size:18px;color:#ffd166;letter-spacing:2px">${escapeHtml(renderStars(item.rating))}</span>
        <span style="font-size:13px;color:#8fa3c7">${escapeHtml(item.rating_comment || 'Avaliação enviada')}</span>
      </div>
    `;
  }

  const stars = [1, 2, 3, 4, 5].map((star) => `
    <button
      type="button"
      class="rating-star"
      data-star="${star}"
      data-appt="${id}"
      style="font-size:24px;background:none;border:none;cursor:pointer;color:#555;padding:0;line-height:1;"
    >
      ★
    </button>
  `).join('');

  return `
    <div style="border-top:1px solid rgba(79,195,247,.10);padding-top:12px;">
      <div id="rating-section-${id}" style="display:none;flex-direction:column;gap:10px;">
        <div style="display:flex;gap:6px;align-items:center;">
          ${stars}
          <input type="hidden" id="rating-val-${id}" value="0" />
        </div>

        <textarea
          id="rating-comment-${id}"
          placeholder="Comentário opcional..."
          rows="2"
          style="width:100%;background:rgba(255,255,255,.05);border:1px solid rgba(79,195,247,.18);border-radius:10px;color:#fff;font:inherit;font-size:13px;padding:8px 10px;resize:vertical;box-sizing:border-box;"
        ></textarea>

        <div style="display:flex;gap:8px;justify-content:flex-end;">
          <button
            type="button"
            data-rating-cancel="${id}"
            style="padding:6px 14px;border-radius:10px;border:1px solid rgba(255,255,255,.12);background:transparent;color:#8fa3c7;font:inherit;font-size:13px;cursor:pointer;"
          >
            Cancelar
          </button>

          <button
            type="button"
            data-rating-submit="${id}"
            style="padding:6px 14px;border-radius:10px;border:0;background:rgba(79,195,247,.18);color:#7dd3fc;font:inherit;font-size:13px;font-weight:700;cursor:pointer;"
          >
            Enviar avaliação
          </button>
        </div>
      </div>

      <button
        type="button"
        data-rating-open="${id}"
        style="font-size:13px;padding:6px 14px;border-radius:10px;border:1px solid rgba(255,193,7,.25);background:rgba(255,193,7,.08);color:#ffd166;font:inherit;font-weight:700;cursor:pointer;"
      >
        Avaliar atendimento
      </button>
    </div>
  `;
}

function renderAppointmentCard(item, allowCancel) {
  const id = escapeHtml(item?.id || '');
  const billing = billingLabel(item);
  const cancelState = canCancelByTime(item);
  const canCancel = allowCancel && cancelState.canCancel;

  return `
    <div style="border:1px solid rgba(79,195,247,.12);border-radius:18px;background:rgba(255,255,255,.03);padding:16px;display:grid;gap:12px;">
      <div style="display:flex;justify-content:space-between;gap:12px;align-items:flex-start;flex-wrap:wrap;">
        <div>
          <div style="font-size:17px;font-weight:800;color:#fff;">${escapeHtml(getServiceName(item))}</div>
          <div style="margin-top:4px;color:#8fa3c7;">${escapeHtml(formatDateTime(getScheduledAt(item)))}</div>
        </div>

        <span style="padding:6px 10px;border-radius:999px;font-size:12px;font-weight:800;${statusStyles(item?.status)}">
          ${escapeHtml(formatStatus(item?.status))}
        </span>
      </div>

      <div class="cfg-row">
        <div>
          <div class="cfg-label">Profissional</div>
          <div class="cfg-sub">${escapeHtml(getBarberName(item))}</div>
        </div>
        <span class="pill">Barbeiro</span>
      </div>

      <div class="cfg-row">
        <div>
          <div class="cfg-label">${escapeHtml(billing.title)}</div>
          <div class="cfg-sub">${escapeHtml(billing.detail)}</div>
        </div>
        <span class="pill" style="color:${billing.color};">${escapeHtml(billing.pill)}</span>
      </div>

      ${
        item?.notes
          ? `
            <div class="cfg-row">
              <div>
                <div class="cfg-label">Observação</div>
                <div class="cfg-sub">${escapeHtml(item.notes)}</div>
              </div>
              <span class="pill">Nota</span>
            </div>
          `
          : ''
      }

      ${
        allowCancel
          ? `
            <div style="display:flex;justify-content:space-between;gap:10px;align-items:center;flex-wrap:wrap;">
              <div style="font-size:12px;color:#8fa3c7;">
                ${escapeHtml(cancelState.reason || `Cancelamento permitido respeitando ${getCancellationHours()}h de antecedência.`)}
              </div>

              <button
                type="button"
                data-cancel-appt="${id}"
                ${canCancel ? '' : 'disabled'}
                style="
                  min-height:38px;
                  padding:0 14px;
                  border-radius:12px;
                  border:1px solid rgba(255,82,82,.20);
                  background:${canCancel ? 'rgba(255,82,82,.08)' : 'rgba(255,255,255,.04)'};
                  color:${canCancel ? '#ff8a80' : '#6b7280'};
                  font:inherit;
                  font-size:13px;
                  font-weight:800;
                  cursor:${canCancel ? 'pointer' : 'not-allowed'};
                "
              >
                Cancelar
              </button>
            </div>
          `
          : ''
      }

      ${renderRatingSection(item)}
    </div>
  `;
}

function renderList(containerId, items, emptyTitle, emptySubtitle, allowCancel) {
  const container = document.getElementById(containerId);

  if (!container) return;

  if (!items.length) {
    container.innerHTML = `
      <div class="cfg-row">
        <div>
          <div class="cfg-label">${escapeHtml(emptyTitle)}</div>
          <div class="cfg-sub">${escapeHtml(emptySubtitle)}</div>
        </div>
        <span class="pill">Vazio</span>
      </div>
    `;
    return;
  }

  container.innerHTML = `
    <div style="display:grid;gap:14px;">
      ${items.map((item) => renderAppointmentCard(item, allowCancel)).join('')}
    </div>
  `;
}

function splitAppointments(payload) {
  if (payload && Array.isArray(payload.upcoming) && Array.isArray(payload.history)) {
    return {
      upcoming: payload.upcoming,
      history: payload.history,
    };
  }

  const items = Array.isArray(payload)
    ? payload
    : Array.isArray(payload?.items)
      ? payload.items
      : [];

  const upcoming = [];
  const history = [];

  items.forEach((item) => {
    const status = String(item?.status || '').toLowerCase();
    const date = new Date(getScheduledAt(item));
    const isFuture = !Number.isNaN(date.getTime()) && date.getTime() >= Date.now();

    if (['pending', 'confirmed', 'in_progress'].includes(status) && isFuture) {
      upcoming.push(item);
    } else {
      history.push(item);
    }
  });

  return { upcoming, history };
}

function renderHeaderMeta() {
  const container = document.getElementById('client-agendamentos-meta');

  if (!container) return;

  const cancellationHours = getCancellationHours();

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

function bindCancelActions() {
  document.querySelectorAll('[data-cancel-appt]').forEach((button) => {
    button.addEventListener('click', async () => {
      const appointmentId = button.getAttribute('data-cancel-appt');

      if (!appointmentId) return;

      const cancellationHours = getCancellationHours();
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
        setFeedback(
          error instanceof Error ? error.message : 'Não foi possível cancelar.',
          'error'
        );

        button.disabled = false;
      }
    });
  });
}

function bindRatingActions() {
  document.querySelectorAll('[data-rating-open]').forEach((button) => {
    button.addEventListener('click', () => {
      const id = button.getAttribute('data-rating-open');
      const section = document.getElementById(`rating-section-${id}`);

      if (!section) return;

      section.style.display = 'flex';
      button.style.display = 'none';
    });
  });

  document.querySelectorAll('[data-rating-cancel]').forEach((button) => {
    button.addEventListener('click', () => {
      const id = button.getAttribute('data-rating-cancel');
      const section = document.getElementById(`rating-section-${id}`);
      const opener = document.querySelector(`[data-rating-open="${CSS.escape(id)}"]`);

      if (section) section.style.display = 'none';
      if (opener) opener.style.display = '';
    });
  });

  document.querySelectorAll('.rating-star').forEach((button) => {
    button.addEventListener('click', () => {
      const appointmentId = button.getAttribute('data-appt');
      const rating = Number(button.getAttribute('data-star') || 0);
      const input = document.getElementById(`rating-val-${appointmentId}`);

      if (input) input.value = String(rating);

      document.querySelectorAll(`.rating-star[data-appt="${CSS.escape(appointmentId)}"]`).forEach((starButton) => {
        const current = Number(starButton.getAttribute('data-star') || 0);
        starButton.style.color = current <= rating ? '#ffd166' : '#555';
      });
    });
  });

  document.querySelectorAll('[data-rating-submit]').forEach((button) => {
    button.addEventListener('click', async () => {
      const appointmentId = button.getAttribute('data-rating-submit');
      const rating = Number(document.getElementById(`rating-val-${appointmentId}`)?.value || 0);
      const comment = document.getElementById(`rating-comment-${appointmentId}`)?.value?.trim() || '';

      if (!appointmentId) return;

      if (!rating || rating < 1 || rating > 5) {
        setFeedback('Selecione uma nota de 1 a 5 estrelas.', 'error');
        return;
      }

      try {
        button.disabled = true;
        setFeedback('Enviando avaliação...', 'neutral');

        await rateClientPortalAppointment(appointmentId, {
          rating,
          comment,
        });

        setFeedback('Avaliação enviada com sucesso.', 'success');
        await loadAppointments();
      } catch (error) {
        setFeedback(
          error instanceof Error ? error.message : 'Não foi possível enviar sua avaliação.',
          'error'
        );

        button.disabled = false;
      }
    });
  });
}

async function loadAppointments() {
  const [context, appointmentsPayload] = await Promise.all([
    getClientPortalContext(),
    getClientPortalAppointments(),
  ]);

  const split = splitAppointments(appointmentsPayload);

  state.context = context || null;
  state.upcoming = split.upcoming;
  state.history = split.history;

  renderHeaderMeta();

  renderList(
    'client-upcoming-list',
    state.upcoming,
    'Nenhum próximo agendamento',
    'Seus próximos horários aparecerão aqui.',
    true
  );

  renderList(
    'client-history-list',
    state.history,
    'Nenhum histórico ainda',
    'Quando houver atendimentos concluídos ou cancelados, eles aparecerão aqui.',
    false
  );

  bindCancelActions();
  bindRatingActions();
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
      setFeedback(
        error instanceof Error ? error.message : 'Não foi possível carregar os agendamentos.',
        'error'
      );
    }
  })();
}
