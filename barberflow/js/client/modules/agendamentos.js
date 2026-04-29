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
  return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(Number(value || 0));
}

function formatDateTime(value) {
  if (!value) return '-';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '-';
  return date.toLocaleString('pt-BR', {
    day: '2-digit', month: '2-digit', year: 'numeric',
    hour: '2-digit', minute: '2-digit',
  });
}

function formatStatus(status) {
  const map = {
    confirmed: 'Confirmado',
    pending: 'Pendente',
    cancelled: 'Cancelado',
    completed: 'Concluido',
  };
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

function setFeedback(message, variant) {
  const el = document.getElementById('client-agendamentos-feedback');
  if (!el) return;
  el.textContent = message || '';
  el.style.color = variant === 'error' ? '#ff7b91' : variant === 'success' ? '#00e676' : '#8fa3c7';
}

function infoRow(label, value, pill) {
  return '<div class="cfg-row">'
    + '<div>'
    + '<div class="cfg-label">' + escapeHtml(label) + '</div>'
    + '<div style="font-size:15px;color:#fff;margin-top:2px;font-weight:500;">' + value + '</div>'
    + '</div>'
    + '<span class="pill">' + escapeHtml(pill) + '</span>'
    + '</div>';
}

function renderStars(count) {
  var s = '';
  for (var i = 1; i <= 5; i++) {
    s += i <= count ? '\u2605' : '\u2606';
  }
  return s;
}

function renderRatingSection(item) {
  var isCompleted = String(item && item.status || '').toLowerCase() === 'completed';
  if (!isCompleted) return '';

  var alreadyRated = item.rating != null;
  var id = escapeHtml(item.id);

  if (alreadyRated) {
    return '<div style="border-top:1px solid rgba(79,195,247,.10);padding-top:12px;display:flex;align-items:center;gap:10px;flex-wrap:wrap;">'
      + '<span style="font-size:18px;color:#ffd166;letter-spacing:2px">' + renderStars(item.rating) + '</span>'
      + '<span style="font-size:13px;color:#8fa3c7">' + (item.rating_comment ? escapeHtml(item.rating_comment) : 'Avaliacao enviada') + '</span>'
      + '</div>';
  }

  var stars = '';
  for (var n = 1; n <= 5; n++) {
    stars += '<button type="button" class="rating-star" data-star="' + n + '" data-appt="' + id + '"'
      + ' style="font-size:24px;background:none;border:none;cursor:pointer;color:#555;padding:0;line-height:1;">'
      + '\u2605</button>';
  }

  return '<div style="border-top:1px solid rgba(79,195,247,.10);padding-top:12px;">'
    + '<div id="rating-section-' + id + '" style="display:none;flex-direction:column;gap:10px;">'
    + '<div style="display:flex;gap:6px;align-items:center;">'
    + stars
    + '<input type="hidden" id="rating-val-' + id + '" value="0" />'
    + '</div>'
    + '<textarea id="rating-comment-' + id + '" placeholder="Comentario opcional..." rows="2"'
    + ' style="width:100%;background:rgba(255,255,255,.05);border:1px solid rgba(79,195,247,.18);border-radius:10px;color:#fff;font:inherit;font-size:13px;padding:8px 10px;resize:vertical;box-sizing:border-box;"></textarea>'
    + '<div style="display:flex;gap:8px;justify-content:flex-end;">'
    + '<button type="button" data-rating-cancel="' + id + '"'
    + ' style="padding:6px 14px;border-radius:10px;border:1px solid rgba(255,255,255,.12);background:transparent;color:#8fa3c7;font:inherit;font-size:13px;cursor:pointer;">Cancelar</button>'
    + '<button type="button" data-rating-submit="' + id + '"'
    + ' style="padding:6px 14px;border-radius:10px;border:0;background:rgba(79,195,247,.18);color:#7dd3fc;font:inherit;font-size:13px;font-weight:700;cursor:pointer;">Enviar avaliacao</button>'
    + '</div>'
    + '</div>'
    + '<button type="button" data-rating-open="' + id + '"'
    + ' style="font-size:13px;padding:6px 14px;border-radius:10px;border:1px solid rgba(255,193,7,.25);background:rgba(255,193,7,.08);color:#ffd166;font:inherit;cursor:pointer;">'
    + '\u2605 Avaliar atendimento</button>'
    + '</div>';
}

function renderAppointmentCard(item, options) {
  var allowCancel = options && options.allowCancel;
  var barberUser = Array.isArray(item && item.barber_profiles && item.barber_profiles.users)
    ? item.barber_profiles.users[0]
    : (item && item.barber_profiles && item.barber_profiles.users) || {};

  var billingLabel = item && item.billing_mode === 'subscription'
    ? 'Incluido no plano'
    : 'Cobranca avulsa - ' + formatCurrency((item && (item.final_price || item.price)) || 0);

  var notesLabel = item && item.notes ? escapeHtml(item.notes) : 'Sem observacao';

  var html = '<div style="border:1px solid rgba(79,195,247,.12);border-radius:18px;background:rgba(255,255,255,.03);padding:16px;display:grid;gap:12px;">';

  html += '<div style="display:flex;justify-content:space-between;gap:12px;align-items:flex-start;flex-wrap:wrap;">';
  html += '<div>';
  html += '<div style="font-size:17px;font-weight:800;color:#fff;">' + escapeHtml((item && item.services && item.services.name) || 'Servico') + '</div>';
  html += '<div style="color:#8fa3c7;margin-top:4px;">' + escapeHtml(formatDateTime(item && item.scheduled_at)) + '</div>';
  html += '</div>';
  html += '<span style="padding:6px 10px;border-radius:999px;font-size:12px;font-weight:800;' + statusStyles(item && item.status) + '">';
  html += escapeHtml(formatStatus(item && item.status));
  html += '</span></div>';

  html += infoRow('Profissional', escapeHtml((barberUser && barberUser.name) || 'Profissional'), 'Agenda');
  html += infoRow('Cobranca', escapeHtml(billingLabel), (item && item.billing_mode) || 'avulso');
  html += infoRow('Observacao', notesLabel, 'Notas');

  if (item && item.cancelled_reason) {
    html += infoRow('Motivo do cancelamento', escapeHtml(item.cancelled_reason), 'Cancelado');
  }

  html += renderRatingSection(item);

  if (allowCancel) {
    html += '<div style="display:flex;justify-content:flex-end;">';
    html += '<button type="button" data-cancel-appointment-id="' + escapeHtml(item.id) + '"';
    html += ' style="min-height:42px;padding:0 14px;border-radius:12px;border:1px solid rgba(255,82,82,.20);background:rgba(255,82,82,.08);color:#ff8a80;font:inherit;font-weight:800;cursor:pointer;">';
    html += 'Cancelar agendamento</button></div>';
  }

  html += '</div>';
  return html;
}

function renderList(targetId, items, emptyTitle, emptyText, allowCancel) {
  var container = document.getElementById(targetId);
  if (!container) return;

  if (!items.length) {
    container.innerHTML = '<div class="cfg-row"><div>'
      + '<div class="cfg-label">' + escapeHtml(emptyTitle) + '</div>'
      + '<div class="cfg-sub">' + escapeHtml(emptyText) + '</div>'
      + '</div><span class="pill">Vazio</span></div>';
    return;
  }

  var html = '<div style="display:grid;gap:14px;">';
  for (var i = 0; i < items.length; i++) {
    html += renderAppointmentCard(items[i], { allowCancel: allowCancel });
  }
  html += '</div>';
  container.innerHTML = html;
}

function updateStarColors(apptId, selectedVal) {
  var stars = document.querySelectorAll('.rating-star[data-appt="' + apptId + '"]');
  for (var i = 0; i < stars.length; i++) {
    stars[i].style.color = Number(stars[i].getAttribute('data-star')) <= selectedVal ? '#ffd166' : '#555';
  }
}

function bindRatingActions() {
  var openBtns = document.querySelectorAll('[data-rating-open]');
  for (var i = 0; i < openBtns.length; i++) {
    (function(btn) {
      btn.addEventListener('click', function() {
        var id = btn.getAttribute('data-rating-open');
        var section = document.getElementById('rating-section-' + id);
        if (section) { section.style.display = 'flex'; btn.style.display = 'none'; }
      });
    })(openBtns[i]);
  }

  var cancelBtns = document.querySelectorAll('[data-rating-cancel]');
  for (var i = 0; i < cancelBtns.length; i++) {
    (function(btn) {
      btn.addEventListener('click', function() {
        var id = btn.getAttribute('data-rating-cancel');
        var section = document.getElementById('rating-section-' + id);
        var openBtn = document.querySelector('[data-rating-open="' + id + '"]');
        if (section) section.style.display = 'none';
        if (openBtn) openBtn.style.display = '';
      });
    })(cancelBtns[i]);
  }

  var stars = document.querySelectorAll('.rating-star');
  for (var i = 0; i < stars.length; i++) {
    (function(star) {
      star.addEventListener('click', function() {
        var id  = star.getAttribute('data-appt');
        var val = Number(star.getAttribute('data-star'));
        var input = document.getElementById('rating-val-' + id);
        if (input) input.value = String(val);
        updateStarColors(id, val);
      });
      star.addEventListener('mouseenter', function() {
        var id  = star.getAttribute('data-appt');
        var val = Number(star.getAttribute('data-star'));
        updateStarColors(id, val);
      });
      star.addEventListener('mouseleave', function() {
        var id    = star.getAttribute('data-appt');
        var input = document.getElementById('rating-val-' + id);
        updateStarColors(id, Number((input && input.value) || 0));
      });
    })(stars[i]);
  }

  var submitBtns = document.querySelectorAll('[data-rating-submit]');
  for (var i = 0; i < submitBtns.length; i++) {
    (function(btn) {
      btn.addEventListener('click', async function() {
        var id      = btn.getAttribute('data-rating-submit');
        var input   = document.getElementById('rating-val-' + id);
        var rating  = Number((input && input.value) || 0);
        var textarea = document.getElementById('rating-comment-' + id);
        var comment = (textarea && textarea.value && textarea.value.trim()) || '';

        if (!rating || rating < 1 || rating > 5) {
          setFeedback('Selecione uma nota de 1 a 5 estrelas.', 'error');
          return;
        }

        try {
          btn.disabled = true;
          setFeedback('Enviando avaliacao...', 'neutral');
          await rateClientPortalAppointment(id, { rating: rating, comment: comment });
          setFeedback('Avaliacao enviada com sucesso!', 'success');
          await loadAppointments();
        } catch (error) {
          setFeedback(error instanceof Error ? error.message : 'Nao foi possivel enviar a avaliacao.', 'error');
          btn.disabled = false;
        }
      });
    })(submitBtns[i]);
  }
}

function bindCancelActions() {
  var buttons = document.querySelectorAll('[data-cancel-appointment-id]');
  for (var i = 0; i < buttons.length; i++) {
    (function(button) {
      button.addEventListener('click', async function() {
        var appointmentId = button.getAttribute('data-cancel-appointment-id');
        if (!appointmentId) return;

        var cancellationHours = Number((state.context && state.context.barbershop && state.context.barbershop.cancellation_hours) || 0);
        var reason = window.prompt(
          'Informe um motivo curto para o cancelamento.\nRegra atual: minimo de ' + cancellationHours + ' hora(s) de antecedencia.',
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
          setFeedback(error instanceof Error ? error.message : 'Nao foi possivel cancelar.', 'error');
          button.disabled = false;
        }
      });
    })(buttons[i]);
  }
}

async function loadAppointments() {
  var results = await Promise.all([
    getClientPortalContext(),
    getClientPortalAppointments(),
  ]);

  state.context  = results[0] || null;
  state.upcoming = Array.isArray(results[1] && results[1].upcoming) ? results[1].upcoming : [];
  state.history  = Array.isArray(results[1] && results[1].history)  ? results[1].history  : [];

  renderHeaderMeta();
  renderList('client-upcoming-list', state.upcoming, 'Nenhum proximo agendamento', 'Seus proximos horarios aparecerao aqui.', true);
  renderList('client-history-list',  state.history,  'Nenhum historico ainda',     'Quando houver atendimentos concluidos ou cancelados, eles aparecerao aqui.', false);
  bindCancelActions();
  bindRatingActions();
}

function renderHeaderMeta() {
  var container = document.getElementById('client-agendamentos-meta');
  if (!container) return;

  var cancellationHours = Number((state.context && state.context.barbershop && state.context.barbershop.cancellation_hours) || 0);

  container.innerHTML = '<div class="metric-card">'
    + '<div class="metric-label">Proximos</div>'
    + '<div class="metric-value">' + escapeHtml(String(state.upcoming.length)) + '</div>'
    + '<div class="metric-sub color-nt">Horarios futuros</div>'
    + '</div>'
    + '<div class="metric-card">'
    + '<div class="metric-label">Historico</div>'
    + '<div class="metric-value">' + escapeHtml(String(state.history.length)) + '</div>'
    + '<div class="metric-sub color-nt">Concluidos e cancelados</div>'
    + '</div>'
    + '<div class="metric-card">'
    + '<div class="metric-label">Cancelamento</div>'
    + '<div class="metric-value">' + escapeHtml(String(cancellationHours)) + 'h</div>'
    + '<div class="metric-sub color-nt">Antecedencia minima</div>'
    + '</div>';
}

export function renderClientAgendamentos() {
  return '<div id="pages" style="display:block"><div class="page active"><div style="display:grid;gap:18px;">'
    + '<div class="card"><div class="card-header">'
    + '<div class="card-title">Meus agendamentos</div>'
    + '<div class="card-action" data-client-route="agendar">Novo agendamento</div>'
    + '</div>'
    + '<div id="client-agendamentos-feedback" style="min-height:20px;margin-bottom:14px;color:#8fa3c7;"></div>'
    + '<div id="client-agendamentos-meta" class="grid-3"></div>'
    + '</div>'
    + '<div class="card"><div class="card-header"><div class="card-title">Proximos horarios</div></div>'
    + '<div id="client-upcoming-list"></div></div>'
    + '<div class="card"><div class="card-header"><div class="card-title">Historico</div></div>'
    + '<div id="client-history-list"></div></div>'
    + '</div></div></div>';
}

export function initClientAgendamentosPage() {
  (async function() {
    try {
      setFeedback('Carregando seus agendamentos...', 'neutral');
      await loadAppointments();
      setFeedback('Seus agendamentos foram carregados.', 'neutral');
    } catch (error) {
      setFeedback(error instanceof Error ? error.message : 'Nao foi possivel carregar os agendamentos.', 'error');
    }
  })();
}
