import {
  formatDateForApi,
  getApiBaseUrl,
  getAppointmentsByDate,
  hasAuthToken,
  getClients,
  getBarbers,
  getServices,
  createAppointment,
} from '../services/api.js';

const agendaState = {
  currentDate: formatDateForApi(new Date()),
  cachedClients: null,
  cachedBarbers: null,
  cachedServices: null,
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
  return date.toLocaleDateString('pt-BR', {
    weekday: 'long',
    day: '2-digit',
    month: 'long',
  }).replace(/^./, char => char.toUpperCase());
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

function getClientName(appointment) {
  return appointment?.clients?.name || appointment?.client_name || 'Cliente não informado';
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
  const parts = String(name || 'BF').trim().split(/\s+/).filter(Boolean);
  return parts.slice(0, 2).map(part => part[0]?.toUpperCase() || '').join('') || 'BF';
}

function getStatusMeta(status) {
  const map = {
    completed: { border: '#00e676', text: '#00e676', pillBg: 'rgba(0,230,118,.1)', label: '✓ Feito', summaryBucket: 'completed' },
    in_progress: { border: '#4fc3f7', text: '#4fc3f7', pillBg: 'rgba(79,195,247,.1)', label: '● Agora', summaryBucket: 'inProgress' },
    confirmed: { border: '#9c6fff', text: '#9c6fff', pillBg: 'rgba(156,111,255,.1)', label: 'Confirmado', summaryBucket: 'upcoming' },
    pending: { border: '#1e2345', text: '#c0cce8', pillBg: 'rgba(255,255,255,.04)', label: 'Agendado', summaryBucket: 'pending' },
    cancelled: { border: '#ff1744', text: '#ff1744', pillBg: 'rgba(255,23,68,.1)', label: 'Cancelado', summaryBucket: 'cancelled' },
    no_show: { border: '#f97316', text: '#f97316', pillBg: 'rgba(249,115,22,.1)', label: 'No-show', summaryBucket: 'cancelled' },
  };

  return map[status] || map.pending;
}

function createSummary(appointments) {
  return appointments.reduce((acc, appointment) => {
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
  }, {
    total: 0,
    completed: 0,
    inProgress: 0,
    upcoming: 0,
    cancelled: 0,
    received: 0,
    receivable: 0,
    byBarber: {},
  });
}

function renderAppointmentRow(appointment) {
  const meta = getStatusMeta(appointment.status);
  const serviceText = `${escapeHtml(getServiceName(appointment))} · ${escapeHtml(getBarberName(appointment))} · ${escapeHtml(formatCurrency(getServicePrice(appointment)))}`;

  return `
    <div class="appt-row" style="border-color:${meta.border}">
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
  const rows = Object.values(summary.byBarber).sort((a, b) => b.appointments - a.appointments).slice(0, 4);

  if (!rows.length) {
    return '<div class="row-sub" style="padding:8px 10px">Nenhum barbeiro com atendimento nesta data.</div>';
  }

  const maxAppointments = Math.max(...rows.map(row => row.appointments), 1);
  const gradients = [
    'linear-gradient(135deg,#ffd700,#ff8c00)',
    'linear-gradient(135deg,#6b6880,#3a3a4a)',
    'linear-gradient(135deg,#3b82f6,#1d4ed8)',
    'linear-gradient(135deg,#00b4ff,#6c3fff)',
  ];

  return rows.map((row, index) => {
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
  }).join('');
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
  return items.map(item => `<option value="${escapeHtml(getValue(item))}">${escapeHtml(getLabel(item))}</option>`).join('');
}

function openCreateModal() {
  document.getElementById('agenda-create-modal')?.classList.add('open');
}

function closeCreateModal() {
  document.getElementById('agenda-create-modal')?.classList.remove('open');
}

function setCreateFeedback(message, variant = 'neutral') {
  const el = document.getElementById('agenda-create-feedback');
  if (!el) return;
  el.textContent = message || '';
  el.dataset.variant = variant;
  el.style.color = variant === 'error' ? '#ff8a8a' : variant === 'success' ? '#00e676' : '#5a6888';
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
      clientSelect.innerHTML = '<option value="">Selecione o cliente</option>' + renderModalSelectOptions(clients, item => item.id, item => item.name || 'Cliente');
    }

    if (barberSelect) {
      barberSelect.innerHTML = '<option value="">Selecione o barbeiro</option>' + renderModalSelectOptions(
        barbers,
        item => item.id,
        item => item?.users?.name || 'Barbeiro'
      );
    }

    if (serviceSelect) {
      serviceSelect.innerHTML = '<option value="">Selecione o serviço</option>' + renderModalSelectOptions(
        services,
        item => item.id,
        item => `${item.name || 'Serviço'} · ${formatCurrency(item.price)}`
      );
    }

    setCreateFeedback('', 'neutral');
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Não foi possível carregar clientes, barbeiros e serviços.';
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
    const message = error instanceof Error ? error.message : 'Não foi possível criar o agendamento.';
    setCreateFeedback(message, 'error');
  } finally {
    submitBtn?.removeAttribute('disabled');
    if (submitBtn) submitBtn.textContent = 'Salvar agendamento';
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
    listContainer.innerHTML = renderConfigHint(
      'API não configurada',
      'Abra o login dev e informe a URL pública do backend no Railway para começar a integrar os menus.',
      true,
    );
    summaryContainer.innerHTML = renderEmptyState('Aguardando configuração da API.');
    return;
  }

  if (!hasAuthToken()) {
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
            <button class="card-action" id="agenda-new-action" type="button" style="padding:7px 12px;border:1px solid rgba(79,195,247,.18);border-radius:8px;background:rgba(79,195,247,.06);">+ Novo agendamento</button>
            <div class="card-action" id="agenda-refresh-action">Atualizar</div>
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
  } catch (error) {
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
          <input id="agenda-date-input" type="date" value="${today}" style="background:#0a0c1a;border:1px solid #1e2345;border-radius:8px;padding:8px 10px;color:#e8f0fe;font:inherit;min-width:160px;" />
          <button id="agenda-create-cta" type="button" style="padding:8px 12px;border:1px solid rgba(79,195,247,.18);border-radius:8px;background:rgba(79,195,247,.08);color:#4fc3f7;font-weight:600;cursor:pointer;">+ Novo agendamento</button>
          <div class="card-action" id="agenda-load-action" style="padding:8px 12px;border:1px solid #1e2345;border-radius:8px;background:#0a0c1a;cursor:pointer;">Carregar data</div>
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

  loadAgendaForDate(initialDate);
}
