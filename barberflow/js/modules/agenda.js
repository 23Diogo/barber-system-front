import {
  formatDateForApi,
  getApiBaseUrl,
  getAppointmentsByDate,
  hasAuthToken,
  getClients,
  getBarbers,
  getServices,
  createAppointment,
  updateAppointmentStatus,
  getActiveSubscriptionByClient,
  consumeSubscriptionBenefit,
} from '../services/api.js';

const agendaState = {
  currentDate: formatDateForApi(new Date()),
  cachedClients: null,
  cachedBarbers: null,
  cachedServices: null,
  currentAppointments: [],
};

function escapeHtml(value) {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

function formatAgendaHeader(dateValue) {
  const [year, month, day] = dateValue.split('-').map(Number);
  const date = new Date(year, month - 1, day);
  return date
    .toLocaleDateString('pt-BR', {
      weekday: 'long',
      day: '2-digit',
      month: 'long',
    })
    .replace(/^./, (char) => char.toUpperCase());
}

function formatTime(value) {
  if (!value) return '--:--';
  return new Date(value).toLocaleTimeString('pt-BR', {
    hour: '2-digit',
    minute: '2-digit',
  });
}

function formatCurrency(value) {
  return new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL',
  }).format(Number(value || 0));
}

function formatDateDisplay(value) {
  if (!value) return '—';

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return String(value);

  return date.toLocaleDateString('pt-BR');
}

function getClientName(appointment) {
  return appointment?.clients?.name || appointment?.client_name || 'Cliente não informado';
}

function getClientId(appointment) {
  return appointment?.client_id || appointment?.clients?.id || null;
}

function getServiceName(appointment) {
  return appointment?.services?.name || appointment?.service_name || 'Serviço não informado';
}

function getServicePrice(appointment) {
  return Number(appointment?.final_price ?? appointment?.price ?? appointment?.services?.price ?? 0);
}

function getBarberName(appointment) {
  const nestedUsers = appointment?.barber_profiles?.users;
  if (Array.isArray(nestedUsers)) return nestedUsers[0]?.name || 'Barbeiro';
  if (nestedUsers?.name) return nestedUsers.name;
  return appointment?.barber_name || 'Barbeiro';
}

function getBarberInitials(name) {
  const parts = String(name || 'BF')
    .trim()
    .split(/\s+/)
    .filter(Boolean);

  return parts
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() || '')
    .join('') || 'BF';
}

function getStatusMeta(status) {
  const map = {
    completed: {
      border: '#00e676',
      text: '#00e676',
      pillBg: 'rgba(0,230,118,.1)',
      label: '✓ Feito',
      summaryBucket: 'completed',
    },
    in_progress: {
      border: '#4fc3f7',
      text: '#4fc3f7',
      pillBg: 'rgba(79,195,247,.1)',
      label: '● Agora',
      summaryBucket: 'inProgress',
    },
    confirmed: {
      border: '#9c6fff',
      text: '#9c6fff',
      pillBg: 'rgba(156,111,255,.1)',
      label: 'Confirmado',
      summaryBucket: 'upcoming',
    },
    pending: {
      border: '#1e2345',
      text: '#c0cce8',
      pillBg: 'rgba(255,255,255,.04)',
      label: 'Agendado',
      summaryBucket: 'pending',
    },
    cancelled: {
      border: '#ff1744',
      text: '#ff1744',
      pillBg: 'rgba(255,23,68,.1)',
      label: 'Cancelado',
      summaryBucket: 'cancelled',
    },
    no_show: {
      border: '#f97316',
      text: '#f97316',
      pillBg: 'rgba(249,115,22,.1)',
      label: 'No-show',
      summaryBucket: 'cancelled',
    },
  };

  return map[status] || map.pending;
}

function getSubscriptionStatusMeta(status) {
  const map = {
    active: {
      label: 'Ativa',
      color: '#00e676',
      bg: 'rgba(0,230,118,.1)',
      border: 'rgba(0,230,118,.18)',
    },
    past_due: {
      label: 'Inadimplente',
      color: '#ff1744',
      bg: 'rgba(255,23,68,.1)',
      border: 'rgba(255,23,68,.18)',
    },
    paused: {
      label: 'Pausada',
      color: '#f97316',
      bg: 'rgba(249,115,22,.1)',
      border: 'rgba(249,115,22,.18)',
    },
    canceled: {
      label: 'Cancelada',
      color: '#5a6888',
      bg: 'rgba(90,104,136,.12)',
      border: 'rgba(90,104,136,.18)',
    },
    pending_activation: {
      label: 'Pendente',
      color: '#4fc3f7',
      bg: 'rgba(79,195,247,.1)',
      border: 'rgba(79,195,247,.18)',
    },
    trialing: {
      label: 'Trial',
      color: '#9c6fff',
      bg: 'rgba(156,111,255,.1)',
      border: 'rgba(156,111,255,.18)',
    },
  };

  return map[status] || map.active;
}

function getInvoiceStatusMeta(status) {
  const map = {
    paid: { label: 'Pago', color: '#00e676' },
    failed: { label: 'Falhou', color: '#ff1744' },
    pending: { label: 'Pendente', color: '#f97316' },
    canceled: { label: 'Cancelado', color: '#5a6888' },
    refunded: { label: 'Estornado', color: '#9c6fff' },
    expired: { label: 'Expirado', color: '#f97316' },
  };

  return map[status] || map.pending;
}

function getStatusDisplayName(status) {
  return getStatusMeta(status).label;
}

function getAvailableStatusActions(currentStatus) {
  const transitions = {
    pending: ['confirmed', 'in_progress', 'completed', 'cancelled', 'no_show'],
    confirmed: ['in_progress', 'completed', 'cancelled', 'no_show'],
    in_progress: ['completed', 'cancelled', 'no_show'],
    completed: [],
    cancelled: ['pending', 'confirmed'],
    no_show: ['pending', 'confirmed'],
  };

  return (
    transitions[currentStatus] ||
    ['pending', 'confirmed', 'in_progress', 'completed', 'cancelled', 'no_show'].filter(
      (status) => status !== currentStatus,
    )
  );
}

function getLatestSubscriptionCycle(subscription) {
  const cycles = Array.isArray(subscription?.subscription_cycles)
    ? [...subscription.subscription_cycles]
    : [];

  if (!cycles.length) return null;

  cycles.sort((a, b) => Number(b?.cycle_number || 0) - Number(a?.cycle_number || 0));
  return cycles[0] || null;
}

function getLatestSubscriptionInvoice(subscription) {
  const invoices = Array.isArray(subscription?.subscription_invoices)
    ? [...subscription.subscription_invoices]
    : [];

  if (!invoices.length) return null;

  invoices.sort((a, b) => {
    const aTime = new Date(a?.created_at || a?.due_at || 0).getTime();
    const bTime = new Date(b?.created_at || b?.due_at || 0).getTime();
    return bTime - aTime;
  });

  return invoices[0] || null;
}

function getSubscriptionActionState(subscription) {
  const status = subscription?.status || '';

  if (status === 'active' || status === 'trialing') {
    return { canConsume: true, message: 'Benefícios disponíveis para consumo.' };
  }

  if (status === 'past_due') {
    return { canConsume: false, message: 'Consumo bloqueado: assinatura inadimplente.' };
  }

  if (status === 'paused') {
    return { canConsume: false, message: 'Consumo bloqueado: assinatura pausada.' };
  }

  if (status === 'pending_activation') {
    return { canConsume: false, message: 'Consumo bloqueado: assinatura aguardando ativação.' };
  }

  return { canConsume: false, message: 'Cliente sem plano elegível para consumo.' };
}

function createSummary(appointments) {
  return appointments.reduce(
    (acc, appointment) => {
      const meta = getStatusMeta(appointment.status);
      const price = getServicePrice(appointment);

      acc.total += 1;
      acc.receivable += price;

      if (meta.summaryBucket === 'completed') {
        acc.completed += 1;
        acc.received += price;
      }

      if (meta.summaryBucket === 'inProgress') acc.inProgress += 1;
      if (meta.summaryBucket === 'upcoming' || meta.summaryBucket === 'pending') acc.upcoming += 1;

      if (meta.summaryBucket === 'cancelled') {
        acc.cancelled += 1;
        acc.receivable -= price;
      }

      const barberName = getBarberName(appointment);
      if (!acc.byBarber[barberName]) {
        acc.byBarber[barberName] = { name: barberName, appointments: 0, revenue: 0 };
      }

      acc.byBarber[barberName].appointments += 1;
      if (appointment.status === 'completed') acc.byBarber[barberName].revenue += price;

      return acc;
    },
    {
      total: 0,
      completed: 0,
      inProgress: 0,
      upcoming: 0,
      cancelled: 0,
      received: 0,
      receivable: 0,
      byBarber: {},
    },
  );
}

function renderAppointmentRow(appointment) {
  const meta = getStatusMeta(appointment.status);
  const serviceText = `${escapeHtml(getServiceName(appointment))} · ${escapeHtml(getBarberName(appointment))} · ${escapeHtml(formatCurrency(getServicePrice(appointment)))}`;

  return `
    <div
      class="appt-row"
      data-appointment-id="${escapeHtml(appointment.id)}"
      role="button"
      tabindex="0"
      title="Ver detalhes do agendamento"
      style="border-color:${meta.border};cursor:pointer;"
    >
      <div class="appt-time" style="color:${meta.text}">${escapeHtml(formatTime(appointment.scheduled_at))}</div>
      <div class="appt-info">
        <div class="appt-client">${escapeHtml(getClientName(appointment))}</div>
        <div class="appt-svc">${serviceText}</div>
      </div>
      <div class="status-pill" style="background:${meta.pillBg};color:${meta.text}">${meta.label}</div>
    </div>
  `;
}

function renderBarberPerformance(summary) {
  const rows = Object.values(summary.byBarber)
    .sort((a, b) => b.appointments - a.appointments)
    .slice(0, 4);

  if (!rows.length) {
    return '<div class="row-sub" style="padding:8px 10px">Nenhum barbeiro com atendimento nesta data.</div>';
  }

  const maxAppointments = Math.max(...rows.map((row) => row.appointments), 1);
  const gradients = [
    'linear-gradient(135deg,#ffd700,#ff8c00)',
    'linear-gradient(135deg,#6b6880,#3a3a4a)',
    'linear-gradient(135deg,#3b82f6,#1d4ed8)',
    'linear-gradient(135deg,#00b4ff,#6c3fff)',
  ];

  return rows
    .map((row, index) => {
      const width = Math.max((row.appointments / maxAppointments) * 100, 15);
      return `
      <div class="row-item">
        <div class="row-avatar" style="background:${gradients[index % gradients.length]};color:${index === 0 ? '#000' : '#fff'}">${escapeHtml(getBarberInitials(row.name))}</div>
        <div class="row-info">
          <div class="row-name">${escapeHtml(row.name)} — ${row.appointments} atend.</div>
          <div class="row-prog"><div class="row-fill" style="width:${width}%"></div></div>
        </div>
        <div class="row-value">${escapeHtml(formatCurrency(row.revenue))}</div>
      </div>
    `;
    })
    .join('');
}

function renderSummaryPanel(summary) {
  return `
    <div class="card-header"><div class="card-title">Resumo do Dia</div></div>
    <div style="display:grid;grid-template-columns:1fr 1fr;gap:8px;margin-bottom:14px">
      <div class="mini-card"><div class="mini-val" style="color:#00e676">${summary.completed}</div><div class="mini-lbl">Concluídos</div></div>
      <div class="mini-card"><div class="mini-val" style="color:#4fc3f7">${summary.inProgress}</div><div class="mini-lbl">Em andamento</div></div>
      <div class="mini-card"><div class="mini-val" style="color:#ffd700">${escapeHtml(formatCurrency(summary.received))}</div><div class="mini-lbl">Recebido</div></div>
      <div class="mini-card"><div class="mini-val" style="color:#5a6888">${escapeHtml(formatCurrency(Math.max(summary.receivable - summary.received, 0)))}</div><div class="mini-lbl">A receber</div></div>
    </div>
    <div style="font-size:10px;font-weight:700;letter-spacing:.1em;text-transform:uppercase;color:#3a4568;margin-bottom:8px">Por barbeiro</div>
    ${renderBarberPerformance(summary)}
  `;
}

function renderEmptyState(message) {
  return `
    <div class="card">
      <div class="card-header"><div class="card-title">Agenda</div></div>
      <div class="row-sub" style="padding:12px 4px;color:#5a6888">${escapeHtml(message)}</div>
    </div>
  `;
}

function renderLoadingState() {
  return `
    <div class="card">
      <div class="card-header"><div class="card-title">Agenda</div></div>
      <div class="row-sub" style="padding:12px 4px;color:#5a6888">Carregando agendamentos...</div>
    </div>
  `;
}

function renderConfigHint(title, body, showAuthButton = false) {
  return `
    <div class="card">
      <div class="card-header"><div class="card-title">Agenda conectada</div></div>
      <div class="row-sub" style="padding:4px 4px 0;color:#c0cce8;font-size:11px;font-weight:600">${escapeHtml(title)}</div>
      <div class="row-sub" style="padding:8px 4px 4px;color:#5a6888;line-height:1.6">${escapeHtml(body)}</div>
      ${showAuthButton ? '<button class="dev-auth-inline-btn" type="button" data-open-auth-modal="true">Conectar API agora</button>' : ''}
    </div>
  `;
}

function renderModalSelectOptions(items, getValue, getLabel) {
  return items
    .map((item) => `<option value="${escapeHtml(getValue(item))}">${escapeHtml(getLabel(item))}</option>`)
    .join('');
}

function getSourceLabel(source) {
  const map = {
    dashboard: 'Dashboard',
    whatsapp: 'WhatsApp',
    walk_in: 'Walk-in',
    link: 'Link',
  };

  return map[source] || source || 'Não informado';
}

function renderStatusActions(appointment) {
  const actions = getAvailableStatusActions(appointment.status);

  if (!actions.length) {
    return `
      <div class="row-sub" style="padding:10px 12px;border:1px solid #1e2345;border-radius:10px;background:#0a0c1a;">
        Este agendamento já está finalizado neste status.
      </div>
    `;
  }

  return `
    <div style="display:flex;flex-wrap:wrap;gap:8px;">
      ${actions
        .map((status) => {
          const meta = getStatusMeta(status);

          return `
          <button
            type="button"
            class="agenda-status-action"
            data-status="${escapeHtml(status)}"
            data-appointment-id="${escapeHtml(appointment.id)}"
            style="
              padding:8px 12px;
              border-radius:8px;
              border:1px solid ${meta.border};
              background:${meta.pillBg};
              color:${meta.text};
              font-weight:700;
              cursor:pointer;
            "
          >
            ${escapeHtml(getStatusDisplayName(status))}
          </button>
        `;
        })
        .join('')}
    </div>
  `;
}

function renderSubscriptionPanel(subscription, appointment) {
  if (!subscription) {
    return `
      <div class="row-sub" style="padding:10px 12px;border:1px solid #1e2345;border-radius:10px;background:#0a0c1a;">
        <strong style="color:#c0cce8;">Plano do cliente:</strong> Nenhum plano ativo encontrado.
      </div>
    `;
  }

  const cycle = getLatestSubscriptionCycle(subscription);
  const invoice = getLatestSubscriptionInvoice(subscription);
  const actionState = getSubscriptionActionState(subscription);
  const statusMeta = getSubscriptionStatusMeta(subscription.status);
  const invoiceMeta = getInvoiceStatusMeta(invoice?.status || 'pending');

  const remainingHaircuts = Number(cycle?.remaining_haircuts || 0);
  const remainingBeards = Number(cycle?.remaining_beards || 0);

  const canShowConsumeButtons =
    actionState.canConsume &&
    appointment.status !== 'cancelled' &&
    appointment.status !== 'no_show';

  return `
    <div style="display:grid;grid-template-columns:1fr;gap:8px;">
      <div class="row-sub" style="padding:10px 12px;border:1px solid ${statusMeta.border};border-radius:10px;background:#0a0c1a;">
        <div style="display:flex;align-items:center;justify-content:space-between;gap:12px;flex-wrap:wrap;">
          <strong style="color:#c0cce8;">Plano do cliente:</strong>
          <span class="status-pill" style="background:${statusMeta.bg};color:${statusMeta.color};border:1px solid ${statusMeta.border};">
            ${statusMeta.label}
          </span>
        </div>
        <div style="margin-top:8px;color:#c0cce8;">
          ${escapeHtml(subscription?.plans?.name || 'Plano')}
        </div>
        <div style="margin-top:6px;color:#5a6888;font-size:10px;line-height:1.5;">
          Próxima cobrança: ${escapeHtml(formatDateDisplay(subscription.next_billing_at || subscription.current_period_end))}
          · Última fatura: <span style="color:${invoiceMeta.color};font-weight:700;">${escapeHtml(invoiceMeta.label)}</span>
        </div>
      </div>

      <div style="display:grid;grid-template-columns:1fr 1fr;gap:8px;">
        <div class="mini-card">
          <div class="mini-lbl">Saldo de cortes</div>
          <div class="mini-val" style="font-size:16px;color:#00e676">${remainingHaircuts}</div>
        </div>
        <div class="mini-card">
          <div class="mini-lbl">Saldo de barbas</div>
          <div class="mini-val" style="font-size:16px;color:#9c6fff">${remainingBeards}</div>
        </div>
      </div>

      <div class="row-sub" style="padding:10px 12px;border:1px solid #1e2345;border-radius:10px;background:#0a0c1a;">
        ${escapeHtml(actionState.message)}
      </div>

      ${
        canShowConsumeButtons
          ? `
            <div style="display:flex;flex-wrap:wrap;gap:8px;">
              ${
                remainingHaircuts > 0
                  ? `
                    <button
                      type="button"
                      class="agenda-consume-action"
                      data-subscription-id="${escapeHtml(subscription.id)}"
                      data-appointment-id="${escapeHtml(appointment.id)}"
                      data-consumed-type="haircut"
                      style="padding:8px 12px;border-radius:8px;border:1px solid rgba(0,230,118,.2);background:rgba(0,230,118,.1);color:#00e676;font-weight:700;cursor:pointer;"
                    >
                      Consumir corte do plano
                    </button>
                  `
                  : ''
              }
              ${
                remainingBeards > 0
                  ? `
                    <button
                      type="button"
                      class="agenda-consume-action"
                      data-subscription-id="${escapeHtml(subscription.id)}"
                      data-appointment-id="${escapeHtml(appointment.id)}"
                      data-consumed-type="beard"
                      style="padding:8px 12px;border-radius:8px;border:1px solid rgba(156,111,255,.2);background:rgba(156,111,255,.1);color:#9c6fff;font-weight:700;cursor:pointer;"
                    >
                      Consumir barba do plano
                    </button>
                  `
                  : ''
              }
            </div>
          `
          : ''
      }
    </div>
  `;
}

function renderAppointmentDetails(appointment, subscription = null) {
  const meta = getStatusMeta(appointment.status);

  return `
    <div style="display:grid;grid-template-columns:1fr;gap:10px;">
      <div style="display:flex;align-items:center;justify-content:space-between;gap:12px;flex-wrap:wrap;">
        <div>
          <div class="modal-title" style="margin:0;">${escapeHtml(getClientName(appointment))}</div>
          <div class="modal-sub" style="margin-top:4px;">Detalhes do agendamento</div>
        </div>
        <div class="status-pill" style="background:${meta.pillBg};color:${meta.text};border:1px solid ${meta.border};">
          ${meta.label}
        </div>
      </div>

      <div style="display:grid;grid-template-columns:1fr 1fr;gap:10px;">
        <div class="mini-card">
          <div class="mini-lbl">Horário</div>
          <div class="mini-val" style="font-size:18px;">${escapeHtml(formatTime(appointment.scheduled_at))}</div>
        </div>
        <div class="mini-card">
          <div class="mini-lbl">Valor</div>
          <div class="mini-val" style="font-size:18px;">${escapeHtml(formatCurrency(getServicePrice(appointment)))}</div>
        </div>
      </div>

      <div style="display:grid;grid-template-columns:1fr;gap:8px;">
        <div class="row-sub" style="padding:10px 12px;border:1px solid #1e2345;border-radius:10px;background:#0a0c1a;">
          <strong style="color:#c0cce8;">Serviço:</strong> ${escapeHtml(getServiceName(appointment))}
        </div>
        <div class="row-sub" style="padding:10px 12px;border:1px solid #1e2345;border-radius:10px;background:#0a0c1a;">
          <strong style="color:#c0cce8;">Barbeiro:</strong> ${escapeHtml(getBarberName(appointment))}
        </div>
        <div class="row-sub" style="padding:10px 12px;border:1px solid #1e2345;border-radius:10px;background:#0a0c1a;">
          <strong style="color:#c0cce8;">Origem:</strong> ${escapeHtml(getSourceLabel(appointment.source))}
        </div>
        <div class="row-sub" style="padding:10px 12px;border:1px solid #1e2345;border-radius:10px;background:#0a0c1a;">
          <strong style="color:#c0cce8;">Status atual:</strong> ${escapeHtml(getStatusDisplayName(appointment.status))}
        </div>
      </div>

      <div style="margin-top:4px;">
        <div style="font-size:11px;font-weight:700;letter-spacing:.08em;text-transform:uppercase;color:#5a6888;margin-bottom:8px;">
          Plano do cliente
        </div>
        ${renderSubscriptionPanel(subscription, appointment)}
      </div>

      <div style="margin-top:4px;">
        <div style="font-size:11px;font-weight:700;letter-spacing:.08em;text-transform:uppercase;color:#5a6888;margin-bottom:8px;">
          Alterar status
        </div>
        ${renderStatusActions(appointment)}
      </div>

      <div id="agenda-details-feedback" style="min-height:18px;font-size:10px;color:#5a6888;"></div>

      <div class="modal-buttons" style="margin-top:6px;">
        <button type="button" class="btn-cancel" id="agenda-details-close">Fechar</button>
      </div>
    </div>
  `;
}

function setAppointmentDetailsFeedback(message, variant = 'neutral') {
  const el = document.getElementById('agenda-details-feedback');
  if (!el) return;

  el.textContent = message || '';
  el.style.color =
    variant === 'error'
      ? '#ff8a8a'
      : variant === 'success'
        ? '#00e676'
        : '#5a6888';
}

async function getAppointmentSubscription(appointment) {
  const clientId = getClientId(appointment);
  if (!clientId) return null;
  return getActiveSubscriptionByClient(clientId);
}

async function openAppointmentDetails(appointmentId) {
  const modal = document.getElementById('agenda-details-modal');
  const content = document.getElementById('agenda-details-content');
  if (!modal || !content) return;

  const appointment = agendaState.currentAppointments.find(
    (item) => String(item.id) === String(appointmentId),
  );

  if (!appointment) return;

  content.innerHTML = `
    <div style="display:grid;gap:10px;">
      <div class="modal-title" style="margin:0;">${escapeHtml(getClientName(appointment))}</div>
      <div class="modal-sub">Carregando detalhes do agendamento...</div>
    </div>
  `;

  modal.style.display = 'flex';
  modal.classList.add('open');

  try {
    const subscription = await getAppointmentSubscription(appointment);
    content.innerHTML = renderAppointmentDetails(appointment, subscription);

    document.getElementById('agenda-details-close')?.addEventListener('click', closeAppointmentDetails);

    document.querySelectorAll('.agenda-status-action').forEach((button) => {
      button.addEventListener('click', () => {
        const nextStatus = button.dataset.status;
        const currentAppointmentId = button.dataset.appointmentId;

        if (!nextStatus || !currentAppointmentId) return;
        handleAppointmentStatusChange(currentAppointmentId, nextStatus);
      });
    });

    document.querySelectorAll('.agenda-consume-action').forEach((button) => {
      button.addEventListener('click', () => {
        const subscriptionId = button.dataset.subscriptionId;
        const currentAppointmentId = button.dataset.appointmentId;
        const consumedType = button.dataset.consumedType;

        if (!subscriptionId || !currentAppointmentId || !consumedType) return;

        handleConsumeSubscriptionBenefit(subscriptionId, currentAppointmentId, consumedType);
      });
    });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : 'Não foi possível carregar o plano do cliente.';
    content.innerHTML = renderAppointmentDetails(appointment, null);

    setTimeout(() => {
      setAppointmentDetailsFeedback(message, 'error');
    }, 0);

    document.getElementById('agenda-details-close')?.addEventListener('click', closeAppointmentDetails);

    document.querySelectorAll('.agenda-status-action').forEach((button) => {
      button.addEventListener('click', () => {
        const nextStatus = button.dataset.status;
        const currentAppointmentId = button.dataset.appointmentId;

        if (!nextStatus || !currentAppointmentId) return;
        handleAppointmentStatusChange(currentAppointmentId, nextStatus);
      });
    });
  }
}

function closeAppointmentDetails() {
  const modal = document.getElementById('agenda-details-modal');
  const content = document.getElementById('agenda-details-content');
  if (!modal) return;

  modal.classList.remove('open');
  modal.style.display = 'none';

  if (content) content.innerHTML = '';
}

function openCreateModal() {
  const modal = document.getElementById('agenda-create-modal');
  if (!modal) return;

  modal.classList.add('open');
  modal.style.display = 'flex';
}

function closeCreateModal() {
  const modal = document.getElementById('agenda-create-modal');
  if (!modal) return;

  modal.classList.remove('open');
  modal.style.display = 'none';
}

function setCreateFeedback(message, variant = 'neutral') {
  const el = document.getElementById('agenda-create-feedback');
  if (!el) return;
  el.textContent = message || '';
  el.dataset.variant = variant;
  el.style.color =
    variant === 'error'
      ? '#ff8a8a'
      : variant === 'success'
        ? '#00e676'
        : '#5a6888';
}

function updateAgendaHeader(dateValue) {
  const title = document.getElementById('agenda-current-date-label');
  if (title) title.textContent = `Agenda — ${formatAgendaHeader(dateValue)}`;
}

function toScheduledAtIso(dateValue, timeValue) {
  const localDate = new Date(`${dateValue}T${timeValue}:00`);
  return localDate.toISOString();
}

async function ensureCreateDependencies() {
  if (!agendaState.cachedClients) agendaState.cachedClients = await getClients();
  if (!agendaState.cachedBarbers) agendaState.cachedBarbers = await getBarbers();
  if (!agendaState.cachedServices) agendaState.cachedServices = await getServices();

  return {
    clients: Array.isArray(agendaState.cachedClients) ? agendaState.cachedClients : [],
    barbers: Array.isArray(agendaState.cachedBarbers) ? agendaState.cachedBarbers : [],
    services: Array.isArray(agendaState.cachedServices) ? agendaState.cachedServices : [],
  };
}

async function populateCreateModal() {
  const clientSelect = document.getElementById('agenda-create-client');
  const barberSelect = document.getElementById('agenda-create-barber');
  const serviceSelect = document.getElementById('agenda-create-service');
  const dateInput = document.getElementById('agenda-create-date');

  if (dateInput) dateInput.value = agendaState.currentDate;

  setCreateFeedback('Carregando opções...', 'neutral');

  try {
    const { clients, barbers, services } = await ensureCreateDependencies();

    if (clientSelect) {
      clientSelect.innerHTML =
        '<option value="">Selecione o cliente</option>' +
        renderModalSelectOptions(clients, (item) => item.id, (item) => item.name || 'Cliente');
    }

    if (barberSelect) {
      barberSelect.innerHTML =
        '<option value="">Selecione o barbeiro</option>' +
        renderModalSelectOptions(
          barbers,
          (item) => item.id,
          (item) => item?.users?.name || 'Barbeiro',
        );
    }

    if (serviceSelect) {
      serviceSelect.innerHTML =
        '<option value="">Selecione o serviço</option>' +
        renderModalSelectOptions(
          services,
          (item) => item.id,
          (item) => `${item.name || 'Serviço'} · ${formatCurrency(item.price)}`,
        );
    }

    setCreateFeedback('', 'neutral');
  } catch (error) {
    const message =
      error instanceof Error
        ? error.message
        : 'Não foi possível carregar clientes, barbeiros e serviços.';
    setCreateFeedback(message, 'error');
  }
}

async function handleCreateAppointment(event) {
  event.preventDefault();

  const submitBtn = document.getElementById('agenda-create-submit');
  const clientId = document.getElementById('agenda-create-client')?.value;
  const barberId = document.getElementById('agenda-create-barber')?.value;
  const serviceId = document.getElementById('agenda-create-service')?.value;
  const dateValue = document.getElementById('agenda-create-date')?.value;
  const timeValue = document.getElementById('agenda-create-time')?.value;
  const sourceValue = document.getElementById('agenda-create-source')?.value || 'dashboard';

  if (!clientId || !barberId || !serviceId || !dateValue || !timeValue) {
    setCreateFeedback('Preencha cliente, barbeiro, serviço, data e horário.', 'error');
    return;
  }

  try {
    submitBtn?.setAttribute('disabled', 'disabled');
    if (submitBtn) submitBtn.textContent = 'Salvando...';

    await createAppointment({
      clientId,
      barberId,
      serviceId,
      scheduledAt: toScheduledAtIso(dateValue, timeValue),
      source: sourceValue,
    });

    setCreateFeedback('Agendamento criado com sucesso.', 'success');
    agendaState.currentDate = dateValue;

    const pageDateInput = document.getElementById('agenda-date-input');
    if (pageDateInput) pageDateInput.value = dateValue;

    await loadAgendaForDate(dateValue);

    setTimeout(() => {
      closeCreateModal();
      setCreateFeedback('', 'neutral');
      const form = document.getElementById('agenda-create-form');
      if (form) form.reset();
      const modalDateInput = document.getElementById('agenda-create-date');
      if (modalDateInput) modalDateInput.value = agendaState.currentDate;
    }, 350);
  } catch (error) {
    const message =
      error instanceof Error ? error.message : 'Não foi possível criar o agendamento.';
    setCreateFeedback(message, 'error');
  } finally {
    submitBtn?.removeAttribute('disabled');
    if (submitBtn) submitBtn.textContent = 'Salvar agendamento';
  }
}

async function handleConsumeSubscriptionBenefit(subscriptionId, appointmentId, consumedType) {
  const buttons = document.querySelectorAll('.agenda-consume-action');

  try {
    buttons.forEach((button) => button.setAttribute('disabled', 'disabled'));
    setAppointmentDetailsFeedback('Consumindo benefício do plano...', 'neutral');

    await consumeSubscriptionBenefit(subscriptionId, {
      appointment_id: appointmentId,
      consumed_type: consumedType,
      quantity: 1,
      notes: 'Consumo manual pela agenda',
    });

    setAppointmentDetailsFeedback('Benefício consumido com sucesso.', 'success');

    await loadAgendaForDate(agendaState.currentDate);
    await openAppointmentDetails(appointmentId);
  } catch (error) {
    const message =
      error instanceof Error
        ? error.message
        : 'Não foi possível consumir o benefício do plano.';
    setAppointmentDetailsFeedback(message, 'error');
  } finally {
    buttons.forEach((button) => button.removeAttribute('disabled'));
  }
}

async function handleAppointmentStatusChange(appointmentId, status) {
  const buttons = document.querySelectorAll('.agenda-status-action');

  try {
    buttons.forEach((button) => button.setAttribute('disabled', 'disabled'));
    setAppointmentDetailsFeedback('Atualizando status...', 'neutral');

    await updateAppointmentStatus(appointmentId, status);

    setAppointmentDetailsFeedback('Status atualizado com sucesso.', 'success');

    closeAppointmentDetails();
    await loadAgendaForDate(agendaState.currentDate);
  } catch (error) {
    const message =
      error instanceof Error ? error.message : 'Não foi possível atualizar o status.';
    setAppointmentDetailsFeedback(message, 'error');
  } finally {
    buttons.forEach((button) => button.removeAttribute('disabled'));
  }
}

async function handleOpenCreateModal() {
  openCreateModal();
  await populateCreateModal();
}

async function loadAgendaForDate(dateValue) {
  agendaState.currentDate = dateValue;

  const listContainer = document.getElementById('agenda-list-container');
  const summaryContainer = document.getElementById('agenda-summary-container');
  if (!listContainer || !summaryContainer) return;

  updateAgendaHeader(dateValue);

  const apiUrl = getApiBaseUrl();
  if (!apiUrl) {
    agendaState.currentAppointments = [];
    listContainer.innerHTML = renderConfigHint(
      'API não configurada',
      'Abra o login dev e informe a URL pública do backend no Railway para começar a integrar os menus.',
      true,
    );
    summaryContainer.innerHTML = renderEmptyState('Aguardando configuração da API.');
    return;
  }

  if (!hasAuthToken()) {
    agendaState.currentAppointments = [];
    listContainer.innerHTML = renderConfigHint(
      'Login de desenvolvimento pendente',
      'Faça o login dev com o e-mail do usuário cadastrado no backend para liberar as rotas protegidas da Agenda.',
      true,
    );
    summaryContainer.innerHTML = renderEmptyState('Aguardando autenticação para exibir a agenda real.');
    return;
  }

  listContainer.innerHTML = renderLoadingState();
  summaryContainer.innerHTML = renderLoadingState();

  try {
    const appointments = await getAppointmentsByDate(dateValue);
    const safeAppointments = Array.isArray(appointments) ? appointments : [];
    agendaState.currentAppointments = safeAppointments;

    if (!safeAppointments.length) {
      listContainer.innerHTML = renderEmptyState('Nenhum agendamento encontrado para a data selecionada.');
      summaryContainer.innerHTML = renderEmptyState('Sem dados para resumir nesta data.');
      return;
    }

    const summary = createSummary(safeAppointments);

    listContainer.innerHTML = `
      <div class="card">
        <div class="card-header">
          <div class="card-title" id="agenda-current-date-label">Agenda — ${escapeHtml(formatAgendaHeader(dateValue))}</div>
          <div style="display:flex;align-items:center;gap:8px;flex-wrap:wrap;">
            <button class="btn-primary-gradient" id="agenda-new-action" type="button">
              + Novo agendamento
            </button>
            <button class="btn-primary-gradient" id="agenda-refresh-action" type="button">
              Atualizar
            </button>
          </div>
        </div>
        ${safeAppointments.map(renderAppointmentRow).join('')}
      </div>
    `;

    summaryContainer.innerHTML = `<div class="card">${renderSummaryPanel(summary)}</div>`;

    document.getElementById('agenda-refresh-action')?.addEventListener('click', () => {
      loadAgendaForDate(dateValue);
    });

    document.getElementById('agenda-new-action')?.addEventListener('click', handleOpenCreateModal);

    document.querySelectorAll('.appt-row[data-appointment-id]').forEach((row) => {
      row.addEventListener('click', () => {
        openAppointmentDetails(row.dataset.appointmentId);
      });

      row.addEventListener('keydown', (event) => {
        if (event.key === 'Enter' || event.key === ' ') {
          event.preventDefault();
          openAppointmentDetails(row.dataset.appointmentId);
        }
      });
    });
  } catch (error) {
    agendaState.currentAppointments = [];
    const message = error instanceof Error ? error.message : 'Não foi possível carregar a agenda.';
    listContainer.innerHTML = renderConfigHint('Erro ao consultar a agenda', message, true);
    summaryContainer.innerHTML = renderEmptyState('Sem resumo disponível por causa do erro de integração.');
  }
}

export function renderAgenda() {
  const today = agendaState.currentDate || formatDateForApi(new Date());

  return /* html */ `
<section class="page-shell page--agenda">
  <div class="grid-2">
    <div>
      <div style="display:flex;align-items:center;justify-content:space-between;gap:12px;margin-bottom:10px;flex-wrap:wrap;">
        <div class="card-title" id="agenda-current-date-label">Agenda — ${escapeHtml(formatAgendaHeader(today))}</div>
        <div style="display:flex;align-items:center;gap:8px;flex-wrap:wrap;">
          <input
            id="agenda-date-input"
            type="date"
            value="${today}"
            style="background:#0a0c1a;border:1px solid #1e2345;border-radius:8px;padding:8px 10px;color:#e8f0fe;font:inherit;min-width:160px;"
          />
          <button id="agenda-create-cta" type="button" class="btn-primary-gradient">
            + Novo agendamento
          </button>
          <button id="agenda-load-action" type="button" class="btn-primary-gradient">
            Carregar data
          </button>
        </div>
      </div>
      <div id="agenda-list-container"></div>
    </div>
    <div id="agenda-summary-container"></div>
  </div>

  <div id="agenda-create-modal" class="modal-overlay" style="display:none;">
    <div class="modal" style="width:min(92vw, 520px);">
      <div class="modal-title">Novo agendamento</div>
      <div class="modal-sub">Preencha os dados abaixo para incluir um horário real na agenda.</div>
      <form id="agenda-create-form">
        <div style="display:grid;grid-template-columns:1fr;gap:10px;">
          <select id="agenda-create-client" class="modal-input"><option value="">Selecione o cliente</option></select>
          <select id="agenda-create-barber" class="modal-input"><option value="">Selecione o barbeiro</option></select>
          <select id="agenda-create-service" class="modal-input"><option value="">Selecione o serviço</option></select>
          <div style="display:grid;grid-template-columns:1fr 1fr;gap:10px;">
            <input id="agenda-create-date" class="modal-input" type="date" value="${today}" />
            <input id="agenda-create-time" class="modal-input" type="time" value="14:30" step="1800" />
          </div>
          <select id="agenda-create-source" class="modal-input">
            <option value="dashboard">Dashboard</option>
            <option value="whatsapp">WhatsApp</option>
            <option value="walk_in">Walk-in</option>
            <option value="link">Link</option>
          </select>
        </div>
        <div id="agenda-create-feedback" style="min-height:20px;font-size:10px;color:#5a6888;margin:10px 0 4px;"></div>
        <div class="modal-buttons" style="margin-top:10px;">
          <button type="button" class="btn-cancel" id="agenda-create-cancel">Cancelar</button>
          <button type="submit" class="btn-save" id="agenda-create-submit">Salvar agendamento</button>
        </div>
      </form>
    </div>
  </div>

  <div id="agenda-details-modal" class="modal-overlay" style="display:none;">
    <div class="modal" style="width:min(92vw, 520px);">
      <div id="agenda-details-content"></div>
    </div>
  </div>
</section>
  `;
}

export function initAgendaPage() {
  const dateInput = document.getElementById('agenda-date-input');
  const loadButton = document.getElementById('agenda-load-action');
  const createButton = document.getElementById('agenda-create-cta');
  const createForm = document.getElementById('agenda-create-form');
  const createCancel = document.getElementById('agenda-create-cancel');
  const modal = document.getElementById('agenda-create-modal');
  const detailsModal = document.getElementById('agenda-details-modal');
  const initialDate = dateInput?.value || agendaState.currentDate || formatDateForApi(new Date());

  const loadCurrentSelection = () => {
    const selectedDate = dateInput?.value || formatDateForApi(new Date());
    loadAgendaForDate(selectedDate);
  };

  loadButton?.addEventListener('click', loadCurrentSelection);
  dateInput?.addEventListener('change', loadCurrentSelection);
  createButton?.addEventListener('click', handleOpenCreateModal);
  createForm?.addEventListener('submit', handleCreateAppointment);
  createCancel?.addEventListener('click', closeCreateModal);

  modal?.addEventListener('click', (event) => {
    if (event.target === modal) closeCreateModal();
  });

  detailsModal?.addEventListener('click', (event) => {
    if (event.target === detailsModal) closeAppointmentDetails();
  });

  loadAgendaForDate(initialDate);
}
