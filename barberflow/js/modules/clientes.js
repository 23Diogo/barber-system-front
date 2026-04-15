import {
  hasApiConfig,
  hasAuthToken,
  getClients,
  getClientById,
  createClient,
  updateClient,
  getSubscriptions,
  getSubscriptionById,
  activateSubscription,
  pauseSubscription,
  reactivateSubscription,
  cancelSubscription,
  markInvoicePaid,
  markInvoiceFailed,
  cancelInvoice,
} from '../services/api.js';

const CLIENT_NAME_MAX_LENGTH = 100;
const CLIENT_PHONE_MAX_LENGTH = 20;
const CLIENT_WHATSAPP_MAX_LENGTH = 20;
const CLIENT_NOTES_MAX_LENGTH = 500;

const clientesState = {
  items: [],
  searchTerm: '',
  isLoading: false,
  isLoaded: false,
  modalMode: 'closed', // closed | view | edit | create
  activeClientId: null,
  detailClient: null,
  detailSubscription: null,
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

function formatCompactCurrency(value) {
  const amount = Number(value || 0);
  if (amount >= 1000) return `R$${amount.toFixed(1)}k`;
  return formatCurrency(amount);
}

function formatDateDisplay(value) {
  if (!value) return '—';

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return String(value);

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

function normalizeClientStatusFromApi(client) {
  if (client?.is_vip) return 'vip';
  if (client?.is_active === false) return 'inactive';
  return 'active';
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

function getAppointmentStatusMeta(status) {
  const map = {
    completed: { label: 'Feito', color: '#00e676', bg: 'rgba(0,230,118,.1)' },
    in_progress: { label: 'Em andamento', color: '#4fc3f7', bg: 'rgba(79,195,247,.1)' },
    confirmed: { label: 'Confirmado', color: '#9c6fff', bg: 'rgba(156,111,255,.1)' },
    pending: { label: 'Agendado', color: '#c0cce8', bg: 'rgba(255,255,255,.04)' },
    cancelled: { label: 'Cancelado', color: '#ff1744', bg: 'rgba(255,23,68,.1)' },
    no_show: { label: 'No-show', color: '#f97316', bg: 'rgba(249,115,22,.1)' },
  };

  return map[status] || map.pending;
}

function getClientStatusMeta(status) {
  const map = {
    vip: {
      label: '✦ VIP',
      text: '#ffd700',
      bg: 'rgba(255,215,0,.1)',
    },
    active: {
      label: 'Ativo',
      text: '#00e676',
      bg: 'rgba(0,230,118,.1)',
    },
    inactive: {
      label: 'Inativo',
      text: '#f97316',
      bg: 'rgba(249,115,22,.1)',
    },
  };

  return map[status] || map.active;
}

function getLatestCycle(subscription) {
  const cycles = Array.isArray(subscription?.subscription_cycles)
    ? [...subscription.subscription_cycles]
    : [];

  if (!cycles.length) return null;

  cycles.sort((a, b) => Number(b?.cycle_number || 0) - Number(a?.cycle_number || 0));
  return cycles[0] || null;
}

function getLatestInvoice(subscription) {
  const invoices = Array.isArray(subscription?.subscription_invoices)
    ? [...subscription.subscription_invoices]
    : [];

  if (!invoices.length) return null;

  invoices.sort((a, b) => {
    const aDate = new Date(a?.created_at || a?.due_at || 0).getTime();
    const bDate = new Date(b?.created_at || b?.due_at || 0).getTime();
    return bDate - aDate;
  });

  return invoices[0] || null;
}

function getLatestAppointment(appointments = []) {
  const safeAppointments = Array.isArray(appointments) ? [...appointments] : [];
  if (!safeAppointments.length) return null;

  safeAppointments.sort((a, b) => {
    const aDate = new Date(a?.scheduled_at || 0).getTime();
    const bDate = new Date(b?.scheduled_at || 0).getTime();
    return bDate - aDate;
  });

  return safeAppointments[0] || null;
}

function getAppointmentBarberName(appointment) {
  const nestedUsers = appointment?.barber_profiles?.users;
  if (Array.isArray(nestedUsers)) return nestedUsers[0]?.name || 'Barbeiro';
  if (nestedUsers?.name) return nestedUsers.name;
  return 'Barbeiro';
}

function getAppointmentServiceName(appointment) {
  return appointment?.services?.name || appointment?.service_name || 'Serviço';
}

function mapClientSummaryFromApi(client) {
  return {
    id: client.id,
    name: client.name || 'Cliente',
    phone: client.phone || '',
    whatsapp: client.whatsapp || client.phone || '',
    lastService: client.last_service_name || client.lastService || '—',
    lastCut: client.last_visit_at ? formatDateDisplay(client.last_visit_at) : (client.lastCut || '—'),
    visits: Number(client.visits || client.total_visits || client.completed_appointments_count || 0),
    totalSpent: Number(client.total_spent || client.totalSpent || 0),
    status: normalizeClientStatusFromApi(client),
    notes: client.notes || '',
    raw: client,
  };
}

function mapClientDetailFromApi(client) {
  const appointments = Array.isArray(client?.appointments) ? [...client.appointments] : [];

  appointments.sort((a, b) => {
    const aDate = new Date(a?.scheduled_at || 0).getTime();
    const bDate = new Date(b?.scheduled_at || 0).getTime();
    return bDate - aDate;
  });

  const completedAppointments = appointments.filter((item) => item.status === 'completed');
  const latestAppointment = getLatestAppointment(appointments);

  const visits = completedAppointments.length || Number(client.visits || client.total_visits || 0);
  const totalSpent = completedAppointments.reduce((sum, item) => sum + Number(item.final_price || 0), 0)
    || Number(client.total_spent || 0);

  return {
    id: client.id,
    name: client.name || 'Cliente',
    phone: client.phone || '',
    whatsapp: client.whatsapp || client.phone || '',
    status: normalizeClientStatusFromApi(client),
    notes: client.notes || '',
    lastService: latestAppointment ? getAppointmentServiceName(latestAppointment) : '—',
    lastCut: latestAppointment ? formatDateTimeDisplay(latestAppointment.scheduled_at) : '—',
    visits,
    totalSpent,
    appointments,
    raw: client,
  };
}

function mapSubscriptionDetail(subscription) {
  const latestCycle = getLatestCycle(subscription);
  const latestInvoice = getLatestInvoice(subscription);

  return {
    id: subscription.id,
    planName: subscription?.plans?.name || 'Plano',
    status: subscription.status || 'pending_activation',
    nextBillingAt: formatDateDisplay(subscription.next_billing_at || subscription.current_period_end),
    paymentMethod: subscription.payment_method_label || latestInvoice?.payment_method || '—',
    remainingHaircuts: Number(latestCycle?.remaining_haircuts || 0),
    remainingBeards: Number(latestCycle?.remaining_beards || 0),
    lastInvoiceStatus: latestInvoice?.status || 'pending',
    raw: subscription,
  };
}

function getClientById(clientId) {
  return clientesState.items.find((item) => item.id === clientId) || null;
}

function getFilteredClients() {
  const term = clientesState.searchTerm.trim().toLowerCase();
  if (!term) return clientesState.items;

  return clientesState.items.filter((client) => {
    return [
      client.name,
      client.phone,
      client.whatsapp,
      client.lastService,
      client.lastCut,
      getClientStatusMeta(client.status).label,
    ]
      .join(' ')
      .toLowerCase()
      .includes(term);
  });
}

function getSubscriptionActionButtons(subscription) {
  const buttons = [];

  if (subscription.status === 'pending_activation') {
    buttons.push({ action: 'activate', label: 'Ativar assinatura' });
    buttons.push({ action: 'cancel', label: 'Cancelar assinatura' });
  }

  if (subscription.status === 'active' || subscription.status === 'trialing') {
    buttons.push({ action: 'pause', label: 'Pausar assinatura' });
    buttons.push({ action: 'cancel', label: 'Cancelar assinatura' });
  }

  if (subscription.status === 'paused') {
    buttons.push({ action: 'reactivate', label: 'Reativar assinatura' });
    buttons.push({ action: 'cancel', label: 'Cancelar assinatura' });
  }

  if (subscription.status === 'past_due') {
    buttons.push({ action: 'activate', label: 'Marcar como ativa' });
    buttons.push({ action: 'pause', label: 'Pausar assinatura' });
    buttons.push({ action: 'cancel', label: 'Cancelar assinatura' });
  }

  return buttons;
}

function getInvoiceActionButtons(invoice) {
  const buttons = [];

  if (invoice.status === 'pending') {
    buttons.push({ action: 'markPaid', label: 'Marcar paga' });
    buttons.push({ action: 'markFailed', label: 'Marcar falha' });
    buttons.push({ action: 'cancel', label: 'Cancelar' });
  }

  if (invoice.status === 'failed') {
    buttons.push({ action: 'markPaid', label: 'Marcar paga' });
    buttons.push({ action: 'cancel', label: 'Cancelar' });
  }

  return buttons;
}

function renderClientStatusPill(status) {
  const meta = getClientStatusMeta(status);

  return `
    <span class="pill" style="background:${meta.bg};color:${meta.text}">
      ${meta.label}
    </span>
  `;
}

function renderClientRow(client) {
  return `
    <tr class="client-row" data-client-id="${escapeHtml(client.id)}" tabindex="0" role="button" title="Ver detalhes de ${escapeHtml(client.name)}">
      <td>
        <div class="client-name">${escapeHtml(client.name)}</div>
        <div class="client-service">${escapeHtml(client.lastService)}</div>
      </td>
      <td class="client-muted">${escapeHtml(client.whatsapp || client.phone || '—')}</td>
      <td>${escapeHtml(client.lastCut)}</td>
      <td>${escapeHtml(client.visits)}</td>
      <td class="client-spent ${client.status === 'vip' ? 'is-vip' : client.status === 'active' ? 'is-active' : 'is-inactive'}">
        ${escapeHtml(formatCurrency(client.totalSpent))}
      </td>
      <td>${renderClientStatusPill(client.status)}</td>
    </tr>
  `;
}

function renderClientsTableBody() {
  const clients = getFilteredClients();

  if (!clients.length) {
    return `
      <tr>
        <td colspan="6" class="clients-empty">
          Nenhum cliente encontrado para a busca informada.
        </td>
      </tr>
    `;
  }

  return clients.map(renderClientRow).join('');
}

function renderClientAppointments(detailClient) {
  const appointments = Array.isArray(detailClient?.appointments) ? detailClient.appointments.slice(0, 6) : [];

  if (!appointments.length) {
    return `
      <div class="clients-modal-info-row">
        Nenhum atendimento encontrado para este cliente.
      </div>
    `;
  }

  return `
    <div class="clients-history-list">
      ${appointments.map((appointment) => {
        const meta = getAppointmentStatusMeta(appointment.status);
        return `
          <div class="clients-history-row">
            <div class="clients-history-main">
              <div class="clients-history-title">${escapeHtml(getAppointmentServiceName(appointment))}</div>
              <div class="clients-history-sub">
                ${escapeHtml(formatDateTimeDisplay(appointment.scheduled_at))}
                · ${escapeHtml(getAppointmentBarberName(appointment))}
                · ${escapeHtml(formatCurrency(appointment.final_price || 0))}
              </div>
            </div>
            <div class="clients-history-side">
              <span class="clients-status-chip" style="background:${meta.bg};color:${meta.color};">
                ${escapeHtml(meta.label)}
              </span>
            </div>
          </div>
        `;
      }).join('')}
    </div>
  `;
}

function renderClientConsumptions(subscription) {
  const consumptions = Array.isArray(subscription?.raw?.subscription_consumptions)
    ? [...subscription.raw.subscription_consumptions]
    : [];

  consumptions.sort((a, b) => {
    const aDate = new Date(a?.created_at || 0).getTime();
    const bDate = new Date(b?.created_at || 0).getTime();
    return bDate - aDate;
  });

  if (!consumptions.length) {
    return `
      <div class="clients-modal-info-row">
        Nenhum consumo registrado para esta assinatura.
      </div>
    `;
  }

  return `
    <div class="clients-history-list">
      ${consumptions.slice(0, 6).map((consumption) => `
        <div class="clients-history-row">
          <div class="clients-history-main">
            <div class="clients-history-title">${escapeHtml(consumption?.services?.name || consumption.consumed_type || 'Consumo')}</div>
            <div class="clients-history-sub">
              ${escapeHtml(formatDateTimeDisplay(consumption.created_at))}
              · Quantidade: ${escapeHtml(consumption.quantity || 1)}
              · ${escapeHtml(consumption.notes || 'Sem observações')}
            </div>
          </div>
        </div>
      `).join('')}
    </div>
  `;
}

function renderClientInvoices(subscription) {
  const invoices = Array.isArray(subscription?.raw?.subscription_invoices)
    ? [...subscription.raw.subscription_invoices]
    : [];

  invoices.sort((a, b) => {
    const aDate = new Date(a?.created_at || a?.due_at || 0).getTime();
    const bDate = new Date(b?.created_at || b?.due_at || 0).getTime();
    return bDate - aDate;
  });

  if (!invoices.length) {
    return `
      <div class="clients-modal-info-row">
        Nenhuma cobrança encontrada para esta assinatura.
      </div>
    `;
  }

  return `
    <div class="clients-invoice-list">
      ${invoices.map((invoice) => {
        const invoiceMeta = getInvoiceStatusMeta(invoice.status);
        const actionButtons = getInvoiceActionButtons(invoice);

        return `
          <div class="clients-invoice-row">
            <div class="clients-invoice-main">
              <div class="clients-invoice-title">${escapeHtml(formatCurrency((invoice.amount_cents || 0) / 100))}</div>
              <div class="clients-invoice-sub">
                Vencimento: ${escapeHtml(formatDateDisplay(invoice.due_at))}
                · Motivo: ${escapeHtml(invoice.billing_reason || '—')}
                · Gateway: ${escapeHtml(invoice.gateway_provider || '—')}
              </div>

              ${actionButtons.length ? `
                <div class="clients-action-grid clients-action-grid--nested">
                  ${actionButtons.map((button) => `
                    <button
                      type="button"
                      class="clients-action-btn clients-invoice-action"
                      data-invoice-id="${escapeHtml(invoice.id)}"
                      data-action="${escapeHtml(button.action)}"
                    >
                      ${escapeHtml(button.label)}
                    </button>
                  `).join('')}
                </div>
              ` : ''}
            </div>

            <div class="clients-invoice-side">
              <span class="clients-status-chip" style="background:rgba(255,255,255,.04);color:${invoiceMeta.color};">
                ${escapeHtml(invoiceMeta.label)}
              </span>
            </div>
          </div>
        `;
      }).join('')}
    </div>
  `;
}

function renderClientSubscription(subscription) {
  if (!subscription) {
    return `
      <div class="clients-modal-info-row">
        Este cliente não possui assinatura cadastrada no momento.
      </div>
    `;
  }

  const statusMeta = getSubscriptionStatusMeta(subscription.status);
  const invoiceMeta = getInvoiceStatusMeta(subscription.lastInvoiceStatus);
  const actionButtons = getSubscriptionActionButtons(subscription);

  return `
    <div class="clients-subscription-box">
      <div class="clients-subscription-header">
        <div>
          <div class="clients-subscription-title">${escapeHtml(subscription.planName)}</div>
          <div class="clients-subscription-sub">
            Próxima cobrança: ${escapeHtml(subscription.nextBillingAt)}
            · Pagamento: ${escapeHtml(subscription.paymentMethod)}
          </div>
        </div>

        <span class="clients-status-chip" style="background:${statusMeta.bg};color:${statusMeta.color};border:1px solid ${statusMeta.border};">
          ${escapeHtml(statusMeta.label)}
        </span>
      </div>

      <div class="clients-subscription-grid">
        <div class="mini-card">
          <div class="mini-lbl">Saldo de cortes</div>
          <div class="mini-val" style="font-size:16px;color:#00e676">${escapeHtml(subscription.remainingHaircuts)}</div>
        </div>
        <div class="mini-card">
          <div class="mini-lbl">Saldo de barbas</div>
          <div class="mini-val" style="font-size:16px;color:#9c6fff">${escapeHtml(subscription.remainingBeards)}</div>
        </div>
      </div>

      <div class="clients-modal-info-row">
        <strong>Última cobrança:</strong>
        <span style="color:${invoiceMeta.color};font-weight:700;">${escapeHtml(invoiceMeta.label)}</span>
      </div>

      <div>
        <div class="clients-section-title">Ações da assinatura</div>
        ${
          actionButtons.length
            ? `
              <div class="clients-action-grid">
                ${actionButtons.map((button) => `
                  <button
                    type="button"
                    class="clients-action-btn clients-subscription-action"
                    data-subscription-id="${escapeHtml(subscription.id)}"
                    data-action="${escapeHtml(button.action)}"
                  >
                    ${escapeHtml(button.label)}
                  </button>
                `).join('')}
              </div>
            `
            : `
              <div class="clients-modal-info-row">
                Nenhuma ação disponível para o status atual.
              </div>
            `
        }
      </div>
    </div>
  `;
}

function renderClientDetails(detailClient, subscription) {
  const statusMeta = getClientStatusMeta(detailClient.status);

  return `
    <div class="clients-modal-body">
      <div>
        <div class="modal-title" style="margin:0;">${escapeHtml(detailClient.name)}</div>
        <div class="modal-sub" style="margin-top:4px;">Ficha do cliente</div>
      </div>

      <div class="clients-modal-grid">
        <div class="mini-card">
          <div class="mini-lbl">Visitas</div>
          <div class="mini-val" style="color:#4fc3f7">${escapeHtml(detailClient.visits)}</div>
        </div>
        <div class="mini-card">
          <div class="mini-lbl">Total gasto</div>
          <div class="mini-val" style="color:#ffd700">${escapeHtml(formatCompactCurrency(detailClient.totalSpent))}</div>
        </div>
        <div class="mini-card">
          <div class="mini-lbl">Último atendimento</div>
          <div class="mini-val" style="font-size:15px;">${escapeHtml(detailClient.lastCut)}</div>
        </div>
        <div class="mini-card">
          <div class="mini-lbl">Status do cliente</div>
          <div class="mini-val" style="font-size:15px;color:${statusMeta.text}">
            ${escapeHtml(statusMeta.label)}
          </div>
        </div>
      </div>

      <div class="clients-modal-info">
        <div class="clients-modal-info-row">
          <strong>WhatsApp:</strong> ${escapeHtml(detailClient.whatsapp || '—')}
        </div>
        <div class="clients-modal-info-row">
          <strong>Telefone:</strong> ${escapeHtml(detailClient.phone || '—')}
        </div>
        <div class="clients-modal-info-row">
          <strong>Serviço mais recente:</strong> ${escapeHtml(detailClient.lastService)}
        </div>
        <div class="clients-modal-info-row">
          <strong>Observações:</strong> ${escapeHtml(detailClient.notes || '—')}
        </div>
      </div>

      <div>
        <div class="clients-section-title">Assinatura</div>
        ${renderClientSubscription(subscription)}
      </div>

      <div>
        <div class="clients-section-title">Cobranças</div>
        ${renderClientInvoices(subscription)}
      </div>

      <div>
        <div class="clients-section-title">Consumos da assinatura</div>
        ${renderClientConsumptions(subscription)}
      </div>

      <div>
        <div class="clients-section-title">Histórico de atendimentos</div>
        ${renderClientAppointments(detailClient)}
      </div>

      <div id="client-detail-feedback" class="clients-form-feedback"></div>

      <div class="modal-buttons" style="margin-top:10px;">
        <button type="button" class="btn-cancel" id="client-modal-close">Fechar</button>
        <button type="button" class="btn-save" id="client-edit-button" data-client-id="${escapeHtml(detailClient.id)}">Editar informações</button>
      </div>
    </div>
  `;
}

function renderClientForm(mode, client = null) {
  const isEdit = mode === 'edit';
  const safeClient = client || {
    name: '',
    phone: '',
    whatsapp: '',
    status: 'active',
    notes: '',
  };

  return `
    <div class="clients-modal-body">
      <div>
        <div class="modal-title" style="margin:0;">${isEdit ? 'Editar cliente' : 'Novo cliente'}</div>
        <div class="modal-sub" style="margin-top:4px;">
          ${isEdit ? 'Atualize os dados principais do cliente.' : 'Preencha os dados para cadastrar um novo cliente.'}
        </div>
      </div>

      <form id="client-form" class="clients-form">
        <div class="clients-form-grid">
          <div>
            <div class="color-section-label">Nome</div>
            <input class="modal-input" id="client-name-input" name="name" type="text" maxlength="${CLIENT_NAME_MAX_LENGTH}" value="${escapeHtml(safeClient.name)}" placeholder="Nome do cliente" />
            <div class="clients-field-counter-wrap"><span id="client-name-counter">0 / ${CLIENT_NAME_MAX_LENGTH}</span></div>
          </div>

          <div>
            <div class="color-section-label">WhatsApp</div>
            <input class="modal-input" id="client-whatsapp-input" name="whatsapp" type="text" maxlength="${CLIENT_WHATSAPP_MAX_LENGTH}" value="${escapeHtml(safeClient.whatsapp)}" placeholder="(11) 99999-9999" />
            <div class="clients-field-counter-wrap"><span id="client-whatsapp-counter">0 / ${CLIENT_WHATSAPP_MAX_LENGTH}</span></div>
          </div>

          <div>
            <div class="color-section-label">Telefone</div>
            <input class="modal-input" id="client-phone-input" name="phone" type="text" maxlength="${CLIENT_PHONE_MAX_LENGTH}" value="${escapeHtml(safeClient.phone)}" placeholder="(11) 99999-9999" />
            <div class="clients-field-counter-wrap"><span id="client-phone-counter">0 / ${CLIENT_PHONE_MAX_LENGTH}</span></div>
          </div>

          <div>
            <div class="color-section-label">Status</div>
            <select class="modal-input" name="status">
              <option value="vip" ${safeClient.status === 'vip' ? 'selected' : ''}>VIP</option>
              <option value="active" ${safeClient.status === 'active' ? 'selected' : ''}>Ativo</option>
              <option value="inactive" ${safeClient.status === 'inactive' ? 'selected' : ''}>Inativo</option>
            </select>
          </div>
        </div>

        <div>
          <div class="color-section-label">Observações</div>
          <textarea class="modal-input clients-textarea" id="client-notes-input" name="notes" maxlength="${CLIENT_NOTES_MAX_LENGTH}" placeholder="Observações do cliente">${escapeHtml(safeClient.notes)}</textarea>
          <div class="clients-field-counter-wrap"><span id="client-notes-counter">0 / ${CLIENT_NOTES_MAX_LENGTH}</span></div>
        </div>

        <div id="client-form-feedback" class="clients-form-feedback"></div>

        <div class="modal-buttons" style="margin-top:10px;">
          <button type="button" class="btn-cancel" id="${isEdit ? 'client-form-back' : 'client-form-cancel'}">
            ${isEdit ? 'Voltar' : 'Cancelar'}
          </button>
          <button type="submit" class="btn-save">
            ${isEdit ? 'Salvar alterações' : 'Cadastrar cliente'}
          </button>
        </div>
      </form>
    </div>
  `;
}

function renderClientModalLoading() {
  return `
    <div class="clients-modal-body">
      <div>
        <div class="modal-title" style="margin:0;">Carregando cliente...</div>
        <div class="modal-sub" style="margin-top:4px;">Buscando ficha completa e assinatura.</div>
      </div>
    </div>
  `;
}

function setClientFormFeedback(message, variant = 'neutral') {
  const el = document.getElementById('client-form-feedback');
  if (!el) return;

  el.textContent = message || '';
  el.style.color =
    variant === 'error' ? '#ff8a8a' :
    variant === 'success' ? '#00e676' :
    '#5a6888';
}

function setClientDetailFeedback(message, variant = 'neutral') {
  const el = document.getElementById('client-detail-feedback');
  if (!el) return;

  el.textContent = message || '';
  el.style.color =
    variant === 'error' ? '#ff8a8a' :
    variant === 'success' ? '#00e676' :
    '#5a6888';
}

function updateCounter(inputId, counterId, maxLength) {
  const input = document.getElementById(inputId);
  const counter = document.getElementById(counterId);
  if (!input || !counter) return;

  if (input.value.length > maxLength) {
    input.value = input.value.slice(0, maxLength);
  }

  counter.textContent = `${input.value.length} / ${maxLength}`;
}

function bindCounter(inputId, counterId, maxLength) {
  const input = document.getElementById(inputId);
  if (!input) return;

  const sync = () => updateCounter(inputId, counterId, maxLength);
  input.addEventListener('input', sync);
  sync();
}

function initClientFormEnhancements() {
  bindCounter('client-name-input', 'client-name-counter', CLIENT_NAME_MAX_LENGTH);
  bindCounter('client-phone-input', 'client-phone-counter', CLIENT_PHONE_MAX_LENGTH);
  bindCounter('client-whatsapp-input', 'client-whatsapp-counter', CLIENT_WHATSAPP_MAX_LENGTH);
  bindCounter('client-notes-input', 'client-notes-counter', CLIENT_NOTES_MAX_LENGTH);
}

async function loadClientsData() {
  const tbody = document.getElementById('clients-table-body');
  if (!tbody) return;

  if (!hasApiConfig()) {
    clientesState.items = [];
    clientesState.isLoaded = false;
    tbody.innerHTML = `
      <tr><td colspan="6" class="clients-empty">API não configurada. Abra o login dev para conectar o backend.</td></tr>
    `;
    return;
  }

  if (!hasAuthToken()) {
    clientesState.items = [];
    clientesState.isLoaded = false;
    tbody.innerHTML = `
      <tr><td colspan="6" class="clients-empty">Login pendente. Faça a autenticação para carregar os clientes reais.</td></tr>
    `;
    return;
  }

  clientesState.isLoading = true;
  tbody.innerHTML = `
    <tr><td colspan="6" class="clients-empty">Carregando clientes...</td></tr>
  `;

  try {
    const payload = await getClients();
    const safeItems = Array.isArray(payload) ? payload.map(mapClientSummaryFromApi) : [];
    clientesState.items = safeItems;
    clientesState.isLoaded = true;
    rerenderClientesTable();
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Não foi possível carregar os clientes.';
    tbody.innerHTML = `
      <tr><td colspan="6" class="clients-empty">${escapeHtml(message)}</td></tr>
    `;
  } finally {
    clientesState.isLoading = false;
  }
}

async function loadClientDetails(clientId) {
  try {
    const [clientPayload, subscriptionsPayload] = await Promise.all([
      getClientById(clientId),
      getSubscriptions({ client_id: clientId }),
    ]);

    const detailClient = mapClientDetailFromApi(clientPayload);

    let detailSubscription = null;
    if (Array.isArray(subscriptionsPayload) && subscriptionsPayload.length) {
      const latestSubscription = subscriptionsPayload[0];
      const subscriptionPayload = await getSubscriptionById(latestSubscription.id);
      detailSubscription = mapSubscriptionDetail(subscriptionPayload);
    }

    if (clientesState.activeClientId !== clientId) return;

    clientesState.detailClient = detailClient;
    clientesState.detailSubscription = detailSubscription;
    renderClientModal();
  } catch (error) {
    if (clientesState.activeClientId !== clientId) return;

    const fallbackClient = getClientById(clientId);
    clientesState.detailClient = fallbackClient
      ? {
          ...fallbackClient,
          appointments: [],
          raw: fallbackClient.raw || {},
        }
      : null;
    clientesState.detailSubscription = null;
    renderClientModal();

    const message = error instanceof Error ? error.message : 'Não foi possível carregar a ficha do cliente.';
    setTimeout(() => {
      setClientDetailFeedback(message, 'error');
    }, 0);
  }
}

function openClientModal(clientId) {
  clientesState.activeClientId = clientId;
  clientesState.detailClient = null;
  clientesState.detailSubscription = null;
  clientesState.modalMode = 'view';
  renderClientModal();
  loadClientDetails(clientId);
}

function openCreateClientModal() {
  clientesState.activeClientId = null;
  clientesState.detailClient = null;
  clientesState.detailSubscription = null;
  clientesState.modalMode = 'create';
  renderClientModal();
}

function openEditClientModal(clientId) {
  clientesState.activeClientId = clientId;
  clientesState.modalMode = 'edit';
  renderClientModal();
}

function closeClientModal() {
  const modal = document.getElementById('client-details-modal');
  const content = document.getElementById('client-details-content');
  if (!modal) return;

  clientesState.modalMode = 'closed';
  clientesState.activeClientId = null;
  clientesState.detailClient = null;
  clientesState.detailSubscription = null;
  modal.classList.remove('open');
  modal.style.display = 'none';

  if (content) content.innerHTML = '';
}

function collectClientFormData() {
  const form = document.getElementById('client-form');
  const formData = new FormData(form);

  return {
    name: String(formData.get('name') || '').trim(),
    phone: String(formData.get('phone') || '').trim(),
    whatsapp: String(formData.get('whatsapp') || '').trim(),
    status: String(formData.get('status') || 'active').trim(),
    notes: String(formData.get('notes') || '').trim(),
  };
}

async function handleClientFormSubmit(event) {
  event.preventDefault();

  const data = collectClientFormData();

  if (!data.name) {
    setClientFormFeedback('Informe o nome do cliente.', 'error');
    return;
  }

  if (data.name.length > CLIENT_NAME_MAX_LENGTH) {
    setClientFormFeedback(`O nome deve ter no máximo ${CLIENT_NAME_MAX_LENGTH} caracteres.`, 'error');
    return;
  }

  if (data.whatsapp.length > CLIENT_WHATSAPP_MAX_LENGTH) {
    setClientFormFeedback(`O WhatsApp deve ter no máximo ${CLIENT_WHATSAPP_MAX_LENGTH} caracteres.`, 'error');
    return;
  }

  if (data.phone.length > CLIENT_PHONE_MAX_LENGTH) {
    setClientFormFeedback(`O telefone deve ter no máximo ${CLIENT_PHONE_MAX_LENGTH} caracteres.`, 'error');
    return;
  }

  if (data.notes.length > CLIENT_NOTES_MAX_LENGTH) {
    setClientFormFeedback(`As observações devem ter no máximo ${CLIENT_NOTES_MAX_LENGTH} caracteres.`, 'error');
    return;
  }

  const payload = {
    name: data.name,
    phone: data.phone || null,
    whatsapp: data.whatsapp || null,
    notes: data.notes || null,
    is_active: data.status !== 'inactive',
    is_vip: data.status === 'vip',
  };

  try {
    setClientFormFeedback(
      clientesState.modalMode === 'edit' ? 'Salvando alterações...' : 'Criando cliente...',
      'neutral'
    );

    if (clientesState.modalMode === 'create') {
      const createdClient = await createClient(payload);
      await loadClientsData();
      openClientModal(createdClient.id);
      return;
    }

    if (clientesState.modalMode === 'edit' && clientesState.activeClientId) {
      await updateClient(clientesState.activeClientId, payload);
      await loadClientsData();
      openClientModal(clientesState.activeClientId);
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Não foi possível salvar o cliente.';
    setClientFormFeedback(message, 'error');
  }
}

async function handleSubscriptionAction(subscriptionId, action) {
  const buttons = document.querySelectorAll('.clients-subscription-action');

  try {
    buttons.forEach((button) => button.setAttribute('disabled', 'disabled'));
    setClientDetailFeedback('Executando ação na assinatura...', 'neutral');

    if (action === 'activate') {
      await activateSubscription(subscriptionId);
    }

    if (action === 'pause') {
      await pauseSubscription(subscriptionId);
    }

    if (action === 'reactivate') {
      await reactivateSubscription(subscriptionId);
    }

    if (action === 'cancel') {
      await cancelSubscription(subscriptionId);
    }

    if (!clientesState.activeClientId) return;

    await loadClientsData();
    await loadClientDetails(clientesState.activeClientId);

    setTimeout(() => {
      setClientDetailFeedback('Assinatura atualizada com sucesso.', 'success');
    }, 0);
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Não foi possível atualizar a assinatura.';
    setClientDetailFeedback(message, 'error');
  } finally {
    buttons.forEach((button) => button.removeAttribute('disabled'));
  }
}

async function handleInvoiceAction(invoiceId, action) {
  const buttons = document.querySelectorAll('.clients-invoice-action');

  try {
    buttons.forEach((button) => button.setAttribute('disabled', 'disabled'));
    setClientDetailFeedback('Executando ação na cobrança...', 'neutral');

    if (action === 'markPaid') {
      await markInvoicePaid(invoiceId);
    }

    if (action === 'markFailed') {
      await markInvoiceFailed(invoiceId);
    }

    if (action === 'cancel') {
      await cancelInvoice(invoiceId);
    }

    if (!clientesState.activeClientId) return;

    await loadClientsData();
    await loadClientDetails(clientesState.activeClientId);

    setTimeout(() => {
      setClientDetailFeedback('Cobrança atualizada com sucesso.', 'success');
    }, 0);
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Não foi possível atualizar a cobrança.';
    setClientDetailFeedback(message, 'error');
  } finally {
    buttons.forEach((button) => button.removeAttribute('disabled'));
  }
}

function renderClientModal() {
  const modal = document.getElementById('client-details-modal');
  const content = document.getElementById('client-details-content');
  if (!modal || !content) return;

  if (clientesState.modalMode === 'closed') {
    modal.classList.remove('open');
    modal.style.display = 'none';
    content.innerHTML = '';
    return;
  }

  const summaryClient = clientesState.activeClientId ? getClientById(clientesState.activeClientId) : null;
  const detailClient = clientesState.detailClient || summaryClient;

  if (clientesState.modalMode === 'view') {
    content.innerHTML = detailClient
      ? renderClientDetails(detailClient, clientesState.detailSubscription)
      : renderClientModalLoading();
  }

  if (clientesState.modalMode === 'edit') {
    content.innerHTML = renderClientForm('edit', detailClient);
  }

  if (clientesState.modalMode === 'create') {
    content.innerHTML = renderClientForm('create');
  }

  modal.style.display = 'flex';
  modal.classList.add('open');

  bindClientModalEvents();
  initClientFormEnhancements();
}

function bindClientsRowsEvents() {
  document.querySelectorAll('.client-row[data-client-id]').forEach((row) => {
    row.addEventListener('click', () => {
      openClientModal(row.dataset.clientId);
    });

    row.addEventListener('keydown', (event) => {
      if (event.key === 'Enter' || event.key === ' ') {
        event.preventDefault();
        openClientModal(row.dataset.clientId);
      }
    });
  });
}

function bindClientModalEvents() {
  document.getElementById('client-modal-close')?.addEventListener('click', closeClientModal);

  document.getElementById('client-edit-button')?.addEventListener('click', () => {
    if (!clientesState.activeClientId) return;
    openEditClientModal(clientesState.activeClientId);
  });

  document.getElementById('client-form-back')?.addEventListener('click', () => {
    if (!clientesState.activeClientId) return;
    openClientModal(clientesState.activeClientId);
  });

  document.getElementById('client-form-cancel')?.addEventListener('click', closeClientModal);
  document.getElementById('client-form')?.addEventListener('submit', handleClientFormSubmit);

  document.querySelectorAll('.clients-subscription-action').forEach((button) => {
    button.addEventListener('click', () => {
      const subscriptionId = button.dataset.subscriptionId;
      const action = button.dataset.action;
      if (!subscriptionId || !action) return;
      handleSubscriptionAction(subscriptionId, action);
    });
  });

  document.querySelectorAll('.clients-invoice-action').forEach((button) => {
    button.addEventListener('click', () => {
      const invoiceId = button.dataset.invoiceId;
      const action = button.dataset.action;
      if (!invoiceId || !action) return;
      handleInvoiceAction(invoiceId, action);
    });
  });
}

function bindClientesStaticEvents() {
  document.getElementById('client-new-button')?.addEventListener('click', openCreateClientModal);

  document.getElementById('client-search-input')?.addEventListener('input', (event) => {
    clientesState.searchTerm = event.target.value || '';
    rerenderClientesTable();
  });

  document.getElementById('client-details-modal')?.addEventListener('click', (event) => {
    if (event.target?.id === 'client-details-modal') {
      closeClientModal();
    }
  });
}

function rerenderClientesTable() {
  const tbody = document.getElementById('clients-table-body');
  if (!tbody) return;

  tbody.innerHTML = renderClientsTableBody();
  bindClientsRowsEvents();
}

export function renderClientes() {
  return /* html */ `
<section class="page-shell page--clientes">
  <div class="clients-toolbar">
    <div class="clients-search-wrap">
      <span class="clients-search-icon">🔍</span>
      <input
        id="client-search-input"
        class="clients-search-input"
        type="text"
        placeholder="Buscar por nome, telefone ou WhatsApp..."
        value="${escapeHtml(clientesState.searchTerm)}"
      />
    </div>

    <button type="button" class="btn-primary-gradient" id="client-new-button">
      + Novo cliente
    </button>
  </div>

  <div class="card">
    <table class="data-table clients-table">
      <thead>
        <tr>
          <th>Cliente</th>
          <th>WhatsApp</th>
          <th>Último corte</th>
          <th>Visitas</th>
          <th>Total gasto</th>
          <th>Status</th>
        </tr>
      </thead>
      <tbody id="clients-table-body">
        <tr>
          <td colspan="6" class="clients-empty">Carregando clientes...</td>
        </tr>
      </tbody>
    </table>
  </div>

  <div id="client-details-modal" class="modal-overlay" style="display:none;">
    <div class="modal" style="width:min(92vw, 820px);">
      <div id="client-details-content"></div>
    </div>
  </div>
</section>
  `;
}

export function initClientesPage() {
  bindClientesStaticEvents();
  bindClientsRowsEvents();
  loadClientsData();
}
