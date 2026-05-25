import {
  formatDateForApi,
  getApiBaseUrl,
  getAuthToken,
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
  subscriptionLookup: {},
  subscriptionErrors: {},
  consumptionRegistry: {},
  filters: {
    status: 'all',
    barber: 'all',
    focus: 'all',
  },
};

// ─── Formas de pagamento disponíveis ─────────────────────────────────────────
const PAYMENT_METHODS = [
  { value: 'pix',         label: 'Pix' },
  { value: 'cash',        label: 'Dinheiro' },
  { value: 'debit_card',  label: 'Débito' },
  { value: 'credit_card', label: 'Crédito' },
  { value: 'transfer',    label: 'Transferência' },
  { value: 'other',       label: 'Outro / Pix + Cartão' },
];

const AGENDA_TOAST_DURATION_MS = 4200;

// ─── API: finalizar atendimento ───────────────────────────────────────────────
async function apiCompleteAppointment(appointmentId, { paymentMethod, finalPrice }) {
  const apiUrl = getApiBaseUrl();
  const token = getAuthToken();

  const response = await fetch(`${apiUrl}/api/appointments/${appointmentId}/complete`, {
    method: 'PATCH',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({ paymentMethod, finalPrice }),
  });

  if (!response.ok) {
    const err = await response.json().catch(() => ({}));
    throw new Error(normalizeAgendaError(err.error || err.message || 'Erro ao finalizar atendimento.'));
  }

  return response.json();
}

function escapeHtml(value) {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

function getAgendaToastContainer() {
  let container = document.getElementById('agenda-toast-container');

  if (!container) {
    container = document.createElement('div');
    container.id = 'agenda-toast-container';
    container.className = 'agenda-toast-container';
    container.setAttribute('aria-live', 'polite');
    container.setAttribute('aria-atomic', 'false');
    document.body.appendChild(container);
  }

  return container;
}

function getAgendaToastMeta(variant) {
  const map = {
    success: { icon: '✓', title: 'Sucesso' },
    error:   { icon: '!', title: 'Erro' },
    warning: { icon: '!', title: 'Atenção' },
    info:    { icon: 'i', title: 'Informação' },
    neutral: { icon: '•', title: 'Agenda' },
  };

  return map[variant] || map.neutral;
}

function showAgendaToast(message, variant = 'neutral') {
  if (!message) return;

  const container = getAgendaToastContainer();
  const meta = getAgendaToastMeta(variant);
  const toast = document.createElement('div');

  toast.className = `agenda-toast agenda-toast--${variant}`;
  toast.setAttribute('role', variant === 'error' ? 'alert' : 'status');

  toast.innerHTML = `
    <div class="agenda-toast__icon">${escapeHtml(meta.icon)}</div>
    <div class="agenda-toast__content">
      <strong>${escapeHtml(meta.title)}</strong>
      <span>${escapeHtml(message)}</span>
    </div>
    <button type="button" class="agenda-toast__close" aria-label="Fechar aviso">×</button>
  `;

  toast.querySelector('.agenda-toast__close')?.addEventListener('click', () => {
    toast.classList.add('is-leaving');
    window.setTimeout(() => toast.remove(), 220);
  });

  container.appendChild(toast);

  requestAnimationFrame(() => toast.classList.add('is-visible'));

  window.setTimeout(() => {
    toast.classList.add('is-leaving');
    window.setTimeout(() => toast.remove(), 220);
  }, AGENDA_TOAST_DURATION_MS);

  window.__agendaToastTest = () => showAgendaToast('Toast da agenda funcionando.', 'success');
}

function normalizeAgendaError(error) {
  const raw = error instanceof Error ? error.message : String(error || '');
  const message = raw || 'Não foi possível concluir a ação.';

  const lower = message.toLowerCase();

  if (lower.includes('invalid input syntax for type uuid')) {
    return 'Selecione uma opção válida antes de continuar.';
  }

  if (lower.includes('violates not-null constraint') || lower.includes('null value in column')) {
    return 'Preencha os campos obrigatórios antes de salvar.';
  }

  if (lower.includes('foreign key') || lower.includes('violates foreign key constraint')) {
    return 'Um dos registros selecionados não foi encontrado. Atualize a tela e tente novamente.';
  }

  if (lower.includes('payment_method') || lower.includes('invalid input value for enum payment_method')) {
    return 'Selecione uma forma de pagamento válida.';
  }

  if (lower.includes('appointment_status') || lower.includes('invalid input value for enum appointment_status')) {
    return 'Selecione um status válido para o atendimento.';
  }

  if (lower.includes('failed to fetch') || lower.includes('networkerror')) {
    return 'Não foi possível conectar com a API. Verifique sua conexão e tente novamente.';
  }

  return message;
}

function getAgendaFieldWrapper(input) {
  if (!input) return null;
  return (
    input.closest('.agenda-field-block') ||
    input.closest('.agenda-finalization-field') ||
    input.closest('.agenda-filter-field') ||
    input.parentElement
  );
}

function clearAgendaFieldError(input) {
  if (!input) return;
  const wrapper = getAgendaFieldWrapper(input);

  input.classList.remove('agenda-input-invalid');
  input.removeAttribute('aria-invalid');

  if (wrapper) {
    wrapper.classList.remove('has-error');
    wrapper.querySelectorAll(`.agenda-field-error[data-for="${input.id}"]`).forEach((el) => el.remove());
  }
}

function clearAgendaValidation(scope = document) {
  scope.querySelectorAll('.agenda-input-invalid').forEach(clearAgendaFieldError);
  scope.querySelectorAll('.agenda-field-error').forEach((el) => el.remove());
  scope.querySelectorAll('.has-error').forEach((el) => el.classList.remove('has-error'));
}

function setAgendaFieldError(inputId, message) {
  const input = document.getElementById(inputId);
  if (!input) return;

  const wrapper = getAgendaFieldWrapper(input);

  input.classList.add('agenda-input-invalid');
  input.setAttribute('aria-invalid', 'true');

  if (wrapper) {
    wrapper.classList.add('has-error');

    let feedback = wrapper.querySelector(`.agenda-field-error[data-for="${input.id}"]`);
    if (!feedback) {
      feedback = document.createElement('div');
      feedback.className = 'agenda-field-error';
      feedback.dataset.for = input.id;
      wrapper.appendChild(feedback);
    }

    feedback.textContent = message;
  }
}

function focusFirstAgendaError(scope = document) {
  const first = scope.querySelector('.agenda-input-invalid');

  if (first) {
    first.scrollIntoView({ behavior: 'smooth', block: 'center' });
    window.setTimeout(() => first.focus?.(), 180);
  }
}

function getLocalDateTime(dateValue, timeValue) {
  if (!dateValue || !timeValue) return null;

  const date = new Date(`${dateValue}T${timeValue}:00`);
  return Number.isNaN(date.getTime()) ? null : date;
}

function validateCreateAppointmentForm() {
  const modal = document.getElementById('agenda-create-modal') || document;
  clearAgendaValidation(modal);

  const clientId  = document.getElementById('agenda-create-client')?.value || '';
  const barberId  = document.getElementById('agenda-create-barber')?.value || '';
  const serviceId = document.getElementById('agenda-create-service')?.value || '';
  const dateValue = document.getElementById('agenda-create-date')?.value || '';
  const timeValue = document.getElementById('agenda-create-time')?.value || '';

  const errors = [];

  if (!clientId)  errors.push(['agenda-create-client', 'Selecione o cliente.']);
  if (!barberId)  errors.push(['agenda-create-barber', 'Selecione o barbeiro.']);
  if (!serviceId) errors.push(['agenda-create-service', 'Selecione o serviço.']);
  if (!dateValue) errors.push(['agenda-create-date', 'Informe a data do atendimento.']);
  if (!timeValue) errors.push(['agenda-create-time', 'Informe o horário do atendimento.']);

  const scheduledAt = getLocalDateTime(dateValue, timeValue);

  if (dateValue && timeValue && !scheduledAt) {
    errors.push(['agenda-create-time', 'Informe uma data e horário válidos.']);
  }

  if (scheduledAt && scheduledAt.getTime() <= Date.now()) {
    errors.push(['agenda-create-time', 'Escolha um horário futuro.']);
  }

  if (!errors.length) return true;

  errors.forEach(([id, message]) => setAgendaFieldError(id, message));
  setCreateFeedback('Revise os campos obrigatórios antes de salvar.', 'error');
  showAgendaToast('Revise os campos obrigatórios do agendamento.', 'warning');
  focusFirstAgendaError(modal);

  return false;
}

function validateFinalizeAppointmentForm() {
  const panel = document.getElementById('agenda-finalization-panel') || document;
  clearAgendaValidation(panel);

  const paymentMethodEl = document.getElementById('agenda-payment-method');
  const discountEl = document.getElementById('agenda-discount-input');
  const paymentMethod = paymentMethodEl?.value || '';
  const discountRaw = String(discountEl?.value || '').trim();

  const errors = [];

  if (!paymentMethod) {
    errors.push(['agenda-payment-method', 'Selecione a forma de pagamento.']);
  }

  if (discountRaw && Number.isNaN(Number(discountRaw))) {
    errors.push(['agenda-discount-input', 'Informe um desconto válido.']);
  }

  if (!errors.length) return true;

  errors.forEach(([id, message]) => setAgendaFieldError(id, message));
  setAppointmentDetailsFeedback('Revise os campos obrigatórios antes de finalizar.', 'error');
  showAgendaToast('Revise os dados de finalização do atendimento.', 'warning');
  focusFirstAgendaError(panel);

  return false;
}

function markFieldFromApiError(message) {
  const lower = String(message || '').toLowerCase();

  if (lower.includes('cliente')) setAgendaFieldError('agenda-create-client', message);
  else if (lower.includes('barbeiro') || lower.includes('profissional')) setAgendaFieldError('agenda-create-barber', message);
  else if (lower.includes('serviço') || lower.includes('servico')) setAgendaFieldError('agenda-create-service', message);
  else if (lower.includes('data') || lower.includes('horário') || lower.includes('horario')) setAgendaFieldError('agenda-create-time', message);
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
  return (
    parts
      .slice(0, 2)
      .map((part) => part[0]?.toUpperCase() || '')
      .join('') || 'BF'
  );
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
    active: { label: 'Ativa', color: '#00e676', bg: 'rgba(0,230,118,.1)', border: 'rgba(0,230,118,.18)' },
    past_due: { label: 'Inadimplente', color: '#ff1744', bg: 'rgba(255,23,68,.1)', border: 'rgba(255,23,68,.18)' },
    paused: { label: 'Pausada', color: '#f97316', bg: 'rgba(249,115,22,.1)', border: 'rgba(249,115,22,.18)' },
    canceled: { label: 'Cancelada', color: '#5a6888', bg: 'rgba(90,104,136,.12)', border: 'rgba(90,104,136,.18)' },
    pending_activation: { label: 'Pendente', color: '#4fc3f7', bg: 'rgba(79,195,247,.1)', border: 'rgba(79,195,247,.18)' },
    trialing: { label: 'Trial', color: '#9c6fff', bg: 'rgba(156,111,255,.1)', border: 'rgba(156,111,255,.18)' },
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
    pending:    ['confirmed', 'in_progress', 'completed', 'cancelled', 'no_show'],
    confirmed:  ['in_progress', 'completed', 'cancelled', 'no_show'],
    in_progress:['completed', 'cancelled', 'no_show'],
    completed:  [],
    cancelled:  ['pending', 'confirmed'],
    no_show:    ['pending', 'confirmed'],
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

function getServiceBenefitRequirement(appointment) {
  const serviceName = getServiceName(appointment).toLowerCase();
  const hasHaircut = /(\bcorte\b|haircut|degrad[eê]|acabamento|pezinho|navalhado)/i.test(serviceName);
  const hasBeard = /(\bbarba\b|beard)/i.test(serviceName);
  if (hasHaircut && hasBeard) return { type: 'combo', needsHaircut: true, needsBeard: true, label: 'corte + barba' };
  if (hasHaircut) return { type: 'haircut', needsHaircut: true, needsBeard: false, label: 'corte' };
  if (hasBeard) return { type: 'beard', needsHaircut: false, needsBeard: true, label: 'barba' };
  return null;
}

function getSubscriptionActionState(subscription) {
  const status = subscription?.status || '';
  if (status === 'active' || status === 'trialing') return { canConsume: true, message: 'Benefícios disponíveis para consumo.' };
  if (status === 'past_due') return { canConsume: false, message: 'Consumo bloqueado: assinatura inadimplente.' };
  if (status === 'paused') return { canConsume: false, message: 'Consumo bloqueado: assinatura pausada.' };
  if (status === 'pending_activation') return { canConsume: false, message: 'Consumo bloqueado: assinatura aguardando ativação.' };
  return { canConsume: false, message: 'Cliente sem plano elegível para consumo.' };
}

function getCachedSubscriptionByClient(clientId) {
  if (!clientId) return null;
  return agendaState.subscriptionLookup[String(clientId)] || null;
}

function clearCachedSubscriptionByClient(clientId) {
  if (!clientId) return;
  delete agendaState.subscriptionLookup[String(clientId)];
  delete agendaState.subscriptionErrors[String(clientId)];
}

function getConsumedTypesForAppointment(appointmentId) {
  return Array.isArray(agendaState.consumptionRegistry[String(appointmentId)])
    ? agendaState.consumptionRegistry[String(appointmentId)]
    : [];
}

function markAppointmentBenefitAsConsumed(appointmentId, consumedType) {
  const key = String(appointmentId);
  const current = getConsumedTypesForAppointment(key);
  if (!current.includes(consumedType)) {
    agendaState.consumptionRegistry[key] = [...current, consumedType];
  }
}

function getConsumedTypeLabel(type) {
  const map = { haircut: 'corte', beard: 'barba' };
  return map[type] || type;
}

function evaluateSubscriptionForAppointment(subscription, appointment) {
  if (!subscription) {
    return {
      hasPlan: false, badges: [], canConsumeForAppointment: false, eligibleConsumeTypes: [],
      message: 'Cliente sem plano ativo para este atendimento.', messageVariant: 'neutral',
      shouldShowMessage: false, shouldHighlightRow: false, shouldBlockConsumption: false,
      requirement: getServiceBenefitRequirement(appointment), remainingHaircuts: 0, remainingBeards: 0,
    };
  }

  const cycle = getLatestSubscriptionCycle(subscription);
  const requirement = getServiceBenefitRequirement(appointment);
  const remainingHaircuts = Number(cycle?.remaining_haircuts || 0);
  const remainingBeards = Number(cycle?.remaining_beards || 0);
  const status = subscription?.status || '';
  const eligibleStatus = status === 'active' || status === 'trialing';
  const actionState = getSubscriptionActionState(subscription);

  const hasAnyBalance = remainingHaircuts > 0 || remainingBeards > 0;
  const hasRequiredHaircut = !requirement?.needsHaircut || remainingHaircuts > 0;
  const hasRequiredBeard = !requirement?.needsBeard || remainingBeards > 0;
  const hasRelevantBalance = requirement ? hasRequiredHaircut && hasRequiredBeard : hasAnyBalance;

  const eligibleConsumeTypes = [];
  if (eligibleStatus) {
    if (requirement) {
      if (requirement.needsHaircut && remainingHaircuts > 0) eligibleConsumeTypes.push('haircut');
      if (requirement.needsBeard && remainingBeards > 0) eligibleConsumeTypes.push('beard');
    } else {
      if (remainingHaircuts > 0) eligibleConsumeTypes.push('haircut');
      if (remainingBeards > 0) eligibleConsumeTypes.push('beard');
    }
  }

  const canConsumeForAppointment =
    eligibleStatus && (requirement ? hasRelevantBalance : eligibleConsumeTypes.length > 0);

  const badges = [{ label: 'Possui plano', variant: 'info' }];
  if (status === 'past_due') badges.push({ label: 'Inadimplente', variant: 'danger' });
  if (status === 'paused') badges.push({ label: 'Plano pausado', variant: 'warning' });
  if (eligibleStatus && hasRelevantBalance) badges.push({ label: 'Saldo disponível', variant: 'success' });

  let message = actionState.message;
  let messageVariant = eligibleStatus ? 'success' : 'danger';
  let shouldShowMessage = false;
  let shouldHighlightRow = false;
  let shouldBlockConsumption = !actionState.canConsume;

  if (!eligibleStatus) { shouldShowMessage = true; shouldHighlightRow = true; }
  else if (requirement && !hasRelevantBalance) {
    message = `Consumo bloqueado: saldo insuficiente para ${requirement.label}.`;
    messageVariant = 'warning'; shouldShowMessage = true; shouldHighlightRow = true; shouldBlockConsumption = true;
  } else if (!requirement && !hasAnyBalance) {
    message = 'Plano ativo, mas sem saldo disponível no ciclo atual.';
    messageVariant = 'warning'; shouldShowMessage = true; shouldHighlightRow = true; shouldBlockConsumption = true;
  } else if (requirement && hasRelevantBalance) {
    message = `Saldo disponível para este atendimento (${requirement.label}).`;
    messageVariant = 'success'; shouldShowMessage = false; shouldHighlightRow = false; shouldBlockConsumption = false;
  }

  if (status === 'past_due') { message = 'Consumo bloqueado: cliente inadimplente.'; messageVariant = 'danger'; shouldShowMessage = true; shouldHighlightRow = true; shouldBlockConsumption = true; }
  if (status === 'paused') { message = 'Consumo bloqueado: plano pausado.'; messageVariant = 'warning'; shouldShowMessage = true; shouldHighlightRow = true; shouldBlockConsumption = true; }
  if (status === 'pending_activation') { message = 'Consumo bloqueado: plano aguardando ativação.'; messageVariant = 'warning'; shouldShowMessage = true; shouldHighlightRow = true; shouldBlockConsumption = true; }
  if (status === 'canceled') { message = 'Consumo bloqueado: plano cancelado.'; messageVariant = 'danger'; shouldShowMessage = true; shouldHighlightRow = true; shouldBlockConsumption = true; }

  return {
    hasPlan: true, badges, canConsumeForAppointment, eligibleConsumeTypes,
    message, messageVariant, shouldShowMessage, shouldHighlightRow, shouldBlockConsumption,
    requirement, remainingHaircuts, remainingBeards,
  };
}

function getAppointmentUiContext(appointment) {
  const subscription = getCachedSubscriptionByClient(getClientId(appointment));
  const evaluation = evaluateSubscriptionForAppointment(subscription, appointment);
  const consumedTypes = getConsumedTypesForAppointment(appointment.id);
  const hasConsumedInPlan = consumedTypes.length > 0;
  return {
    subscription, evaluation, consumedTypes, hasConsumedInPlan,
    consumedLabel: consumedTypes.map(getConsumedTypeLabel).join(' + '),
    requiresAttention: evaluation.shouldBlockConsumption,
  };
}

function getAppointmentBillingContext(appointment, subscription = null) {
  const billingMode = String(appointment?.billing_mode || '').toLowerCase();
  const hasLinkedSubscription = Boolean(
    appointment?.subscription_id ||
    appointment?.subscription_cycle_id ||
    appointment?.subscription_consumption_id ||
    subscription
  );

  if (billingMode === 'subscription' || hasLinkedSubscription) {
    return {
      mode: 'subscription',
      label: 'Plano',
      icon: '✦',
      tone: 'success',
      description: 'Atendimento coberto por assinatura. Ao finalizar, o sistema consome o benefício e gera pontos de comissão.',
      paymentMethod: 'subscription',
      chargedAmount: 0,
    };
  }

  if (billingMode === 'cortesia' || appointment?.payment_method === 'cortesia') {
    return {
      mode: 'cortesia',
      label: 'Cortesia',
      icon: '🎁',
      tone: 'neutral',
      description: 'Atendimento sem cobrança financeira.',
      paymentMethod: 'cortesia',
      chargedAmount: 0,
    };
  }

  return {
    mode: 'avulso',
    label: 'Avulso',
    icon: '💳',
    tone: 'info',
    description: 'Atendimento avulso. Ao finalizar, informe a forma de pagamento para alimentar financeiro e comissão.',
    paymentMethod: '',
    chargedAmount: getServicePrice(appointment),
  };
}

function getBillingBadgeClass(tone) {
  const map = {
    success: 'agenda-badge--success',
    warning: 'agenda-badge--warning',
    danger: 'agenda-badge--danger',
    neutral: 'agenda-badge--neutral',
    info: 'agenda-badge--info',
  };
  return map[tone] || map.info;
}

function getAppointmentOperationalHint(appointment, ui) {
  const billing = getAppointmentBillingContext(appointment, ui.subscription);

  if (appointment.status === 'completed') {
    return { tone: 'success', text: billing.mode === 'subscription'
      ? 'Atendimento finalizado pelo plano. Benefício consumido e comissão preparada.'
      : 'Atendimento finalizado. Receita e comissão avulsa já podem entrar no financeiro.' };
  }

  if (appointment.status === 'cancelled') {
    return { tone: 'neutral', text: 'Atendimento cancelado. Se havia reserva de plano, o saldo deve ter sido liberado.' };
  }

  if (ui.requiresAttention) {
    return { tone: ui.evaluation.messageVariant || 'warning', text: ui.evaluation.message };
  }

  if (billing.mode === 'subscription') {
    return { tone: 'success', text: 'Este horário já está vinculado a um plano. Finalize como assinatura.' };
  }

  if (ui.evaluation.hasPlan && ui.evaluation.canConsumeForAppointment) {
    return { tone: 'success', text: 'Cliente tem plano elegível. O sistema pode reservar/consumir benefício.' };
  }

  return { tone: 'info', text: 'Atendimento avulso. Finalize informando pagamento para atualizar o financeiro.' };
}

function getScheduleHealth(summary, counters) {
  if (!summary.total) return { label: 'Sem operação', tone: 'neutral', text: 'Nenhum horário lançado para esta data.' };
  if (counters.blocked > 0) return { label: 'Atenção necessária', tone: 'danger', text: `${counters.blocked} atendimento(s) exigem revisão de plano ou saldo.` };
  if (summary.inProgress > 0) return { label: 'Barbearia em movimento', tone: 'info', text: `${summary.inProgress} atendimento(s) em andamento agora.` };
  if (summary.upcoming > 0) return { label: 'Dia preparado', tone: 'success', text: `${summary.upcoming} atendimento(s) ainda por realizar.` };
  if (summary.completed === summary.total) return { label: 'Dia fechado', tone: 'success', text: 'Todos os atendimentos do dia foram concluídos.' };
  return { label: 'Operação estável', tone: 'success', text: 'Nenhum alerta crítico na agenda.' };
}

function renderAgendaOperationHero(summary, counters) {
  const health = getScheduleHealth(summary, counters);
  const projected = Math.max(summary.receivable, 0);
  const openAmount = Math.max(summary.receivable - summary.received, 0);

  return `
    <div class="agenda-command-hero agenda-command-hero--${escapeHtml(health.tone)}">
      <div class="agenda-command-main">
        <div class="agenda-eyebrow">Torre de comando do dia</div>
        <h2>${escapeHtml(formatAgendaHeader(agendaState.currentDate))}</h2>
        <p>${escapeHtml(health.text)}</p>
        <div class="agenda-command-status">
          <span>${escapeHtml(health.label)}</span>
          <small>${summary.total} atendimento(s) no radar</small>
        </div>
      </div>

      <div class="agenda-command-grid">
        <div class="agenda-command-card">
          <small>Recebido</small>
          <strong class="color-up">${escapeHtml(formatCurrency(summary.received))}</strong>
          <span>finalizados</span>
        </div>
        <div class="agenda-command-card">
          <small>A receber</small>
          <strong>${escapeHtml(formatCurrency(openAmount))}</strong>
          <span>agenda aberta</span>
        </div>
        <div class="agenda-command-card">
          <small>Com plano</small>
          <strong>${counters.withPlan}</strong>
          <span>assinaturas</span>
        </div>
        <div class="agenda-command-card">
          <small>Alertas</small>
          <strong class="${counters.blocked ? 'color-dn' : 'color-up'}">${counters.blocked}</strong>
          <span>revisar</span>
        </div>
      </div>
    </div>
  `;
}

function getPlanBalanceSnapshot(subscription) {
  const cycle = getLatestSubscriptionCycle(subscription);
  if (!cycle) return null;

  const includedHaircuts = Number(cycle.included_haircuts || 0);
  const includedBeards = Number(cycle.included_beards || 0);
  const remainingHaircuts = Number(cycle.remaining_haircuts || 0);
  const remainingBeards = Number(cycle.remaining_beards || 0);

  return {
    includedHaircuts,
    includedBeards,
    remainingHaircuts,
    remainingBeards,
    usedHaircuts: Math.max(includedHaircuts - remainingHaircuts, 0),
    usedBeards: Math.max(includedBeards - remainingBeards, 0),
    totalIncluded: includedHaircuts + includedBeards,
    totalRemaining: remainingHaircuts + remainingBeards,
  };
}

function renderAgendaPlanMiniUsage(subscription) {
  const balance = getPlanBalanceSnapshot(subscription);
  if (!balance) return '';

  const totalUsed = Math.max(balance.totalIncluded - balance.totalRemaining, 0);
  const pct = balance.totalIncluded > 0 ? Math.min(100, Math.round((totalUsed / balance.totalIncluded) * 100)) : 0;

  return `
    <div class="agenda-mini-usage">
      <div class="agenda-mini-usage-head">
        <span>Uso do ciclo</span>
        <strong>${pct}%</strong>
      </div>
      <div class="agenda-mini-progress"><span style="width:${pct}%"></span></div>
      <div class="agenda-mini-usage-foot">
        <span>Cortes: ${balance.remainingHaircuts}/${balance.includedHaircuts}</span>
        <span>Barbas: ${balance.remainingBeards}/${balance.includedBeards}</span>
      </div>
    </div>
  `;
}


function createSummary(appointments) {
  return appointments.reduce(
    (acc, appointment) => {
      const meta = getStatusMeta(appointment.status);
      const price = getServicePrice(appointment);
      acc.total += 1;
      acc.receivable += price;
      if (meta.summaryBucket === 'completed') { acc.completed += 1; acc.received += price; }
      if (meta.summaryBucket === 'inProgress') acc.inProgress += 1;
      if (meta.summaryBucket === 'upcoming' || meta.summaryBucket === 'pending') acc.upcoming += 1;
      if (meta.summaryBucket === 'cancelled') { acc.cancelled += 1; acc.receivable -= price; }
      const barberName = getBarberName(appointment);
      if (!acc.byBarber[barberName]) acc.byBarber[barberName] = { name: barberName, appointments: 0, revenue: 0 };
      acc.byBarber[barberName].appointments += 1;
      if (appointment.status === 'completed') acc.byBarber[barberName].revenue += price;
      return acc;
    },
    { total: 0, completed: 0, inProgress: 0, upcoming: 0, cancelled: 0, received: 0, receivable: 0, byBarber: {} },
  );
}

function getAgendaCounters(appointments) {
  return appointments.reduce(
    (acc, appointment) => {
      const ui = getAppointmentUiContext(appointment);
      acc.total += 1;
      if (ui.evaluation.hasPlan) acc.withPlan += 1;
      if (ui.requiresAttention) acc.blocked += 1;
      if (ui.hasConsumedInPlan) acc.consumed += 1;
      return acc;
    },
    { total: 0, withPlan: 0, blocked: 0, consumed: 0 },
  );
}

function renderAppointmentBadges(ui, appointment = null) {
  const badges = [...ui.evaluation.badges];
  if (appointment) {
    const billing = getAppointmentBillingContext(appointment, ui.subscription);
    badges.unshift({ label: `${billing.icon} ${billing.label}`, variant: billing.tone });
  }
  if (ui.requiresAttention) badges.push({ label: 'Requer atenção', variant: ui.evaluation.messageVariant === 'danger' ? 'danger' : 'warning' });
  if (ui.hasConsumedInPlan) badges.push({ label: 'Consumido no plano', variant: 'neutral' });
  if (!badges.length) return '';
  return `
    <div class="agenda-badges">
      ${badges.map((badge) => `<span class="agenda-badge agenda-badge--${escapeHtml(badge.variant)}">${escapeHtml(badge.label)}</span>`).join('')}
    </div>
  `;
}

function renderAppointmentPlanAlert(ui) {
  if (!ui.evaluation.shouldShowMessage) return '';
  return `<div class="agenda-row-alert agenda-row-alert--${escapeHtml(ui.evaluation.messageVariant)}">${escapeHtml(ui.evaluation.message)}</div>`;
}

function renderAppointmentConsumedAlert(ui) {
  if (!ui.hasConsumedInPlan) return '';
  return `<div class="agenda-row-alert agenda-row-alert--neutral">Benefício já lançado neste atendimento: ${escapeHtml(ui.consumedLabel)}.</div>`;
}

function renderAppointmentRow(appointment) {
  const meta = getStatusMeta(appointment.status);
  const ui = getAppointmentUiContext(appointment);
  const billing = getAppointmentBillingContext(appointment, ui.subscription);
  const hint = getAppointmentOperationalHint(appointment, ui);
  const serviceText = `${escapeHtml(getServiceName(appointment))} · ${escapeHtml(getBarberName(appointment))}`;
  const priceLabel = billing.mode === 'subscription' ? 'Plano' : formatCurrency(getServicePrice(appointment));
  const rowClasses = [
    'appt-row',
    'agenda-premium-row',
    `agenda-premium-row--${billing.mode}`,
    ui.evaluation.shouldHighlightRow ? `appt-row--plan-${ui.evaluation.messageVariant}` : '',
    ui.hasConsumedInPlan ? 'appt-row--consumed' : '',
  ].filter(Boolean).join(' ');

  return `
    <div
      class="${rowClasses}"
      data-appointment-id="${escapeHtml(appointment.id)}"
      role="button"
      tabindex="0"
      title="Abrir comanda inteligente"
      style="border-color:${meta.border};"
    >
      <div class="agenda-time-stack">
        <div class="appt-time" style="color:${meta.text}">${escapeHtml(formatTime(appointment.scheduled_at))}</div>
        <small>${escapeHtml(formatTime(appointment.ends_at))}</small>
      </div>

      <div class="appt-info agenda-premium-info">
        <div class="agenda-row-topline">
          <div>
            <div class="appt-client">${escapeHtml(getClientName(appointment))}</div>
            <div class="appt-svc">${serviceText} · <strong>${escapeHtml(priceLabel)}</strong></div>
          </div>
          <div class="agenda-row-price">${escapeHtml(priceLabel)}</div>
        </div>

        ${renderAppointmentBadges(ui, appointment)}

        <div class="agenda-row-intel agenda-row-intel--${escapeHtml(hint.tone)}">
          ${escapeHtml(hint.text)}
        </div>

        ${renderAppointmentConsumedAlert(ui)}
      </div>

      <div class="agenda-row-status-stack">
        <div class="status-pill" style="background:${meta.pillBg};color:${meta.text}">${meta.label}</div>
        <small>${escapeHtml(billing.label)}</small>
      </div>
    </div>
  `;
}

function renderBarberPerformance(summary) {
  const rows = Object.values(summary.byBarber).sort((a, b) => b.appointments - a.appointments).slice(0, 4);
  if (!rows.length) return '<div class="row-sub" style="padding:8px 10px">Nenhum barbeiro com atendimento nesta data.</div>';

  const maxAppointments = Math.max(...rows.map((row) => row.appointments), 1);
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

function renderSummaryPanel(summary, counters) {
  const openAmount = Math.max(summary.receivable - summary.received, 0);
  const health = getScheduleHealth(summary, counters);

  return `
    <div class="agenda-side-panel">
      <div class="card-header"><div class="card-title">Pulso da operação</div></div>

      <div class="agenda-health-card agenda-health-card--${escapeHtml(health.tone)}">
        <span>${escapeHtml(health.label)}</span>
        <strong>${summary.total}</strong>
        <small>${escapeHtml(health.text)}</small>
      </div>

      <div class="agenda-side-grid">
        <div class="mini-card"><div class="mini-val" style="color:#00e676">${summary.completed}</div><div class="mini-lbl">Concluídos</div></div>
        <div class="mini-card"><div class="mini-val" style="color:#4fc3f7">${summary.inProgress}</div><div class="mini-lbl">Em andamento</div></div>
        <div class="mini-card"><div class="mini-val" style="color:#ffd700">${escapeHtml(formatCurrency(summary.received))}</div><div class="mini-lbl">Recebido</div></div>
        <div class="mini-card"><div class="mini-val" style="color:#c0cce8">${escapeHtml(formatCurrency(openAmount))}</div><div class="mini-lbl">A receber</div></div>
        <div class="mini-card"><div class="mini-val" style="font-size:16px;color:#4fc3f7">${counters.withPlan}</div><div class="mini-lbl">Com plano</div></div>
        <div class="mini-card"><div class="mini-val" style="font-size:16px;color:#ff6b81">${counters.blocked}</div><div class="mini-lbl">Alertas</div></div>
      </div>

      <div class="agenda-section-kicker">Ranking do dia</div>
      ${renderBarberPerformance(summary)}
    </div>
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
  const map = { dashboard: 'Dashboard', whatsapp: 'WhatsApp', walk_in: 'Walk-in', link: 'Link' };
  return map[source] || source || 'Não informado';
}

// ─── Painel de finalização (comanda) ─────────────────────────────────────────
function renderFinalizationPanel(appointment) {
  const actions = getAvailableStatusActions(appointment.status);
  if (!actions.includes('completed')) return '';

  const ui = getAppointmentUiContext(appointment);
  const billing = getAppointmentBillingContext(appointment, ui.subscription);
  const isSubscription = billing.mode === 'subscription';
  const basePrice = getServicePrice(appointment);
  const defaultPaymentMethod = isSubscription ? 'subscription' : '';

  const paymentOptions = [
    ...(isSubscription ? [{ value: 'subscription', label: 'Plano / assinatura' }] : []),
    ...PAYMENT_METHODS,
  ].map(
    (m) => `<option value="${escapeHtml(m.value)}" ${m.value === defaultPaymentMethod ? 'selected' : ''}>${escapeHtml(m.label)}</option>`
  ).join('');

  return `
    <div id="agenda-finalization-panel" class="agenda-finalization-panel agenda-finalization-panel--${escapeHtml(billing.mode)}">
      <div class="agenda-finalization-head">
        <div>
          <div class="agenda-section-kicker">Finalizar atendimento</div>
          <strong>${isSubscription ? 'Finalização por assinatura' : 'Recebimento avulso'}</strong>
          <span>${escapeHtml(billing.description)}</span>
        </div>
        <div class="agenda-finalization-badge ${getBillingBadgeClass(billing.tone)}">${escapeHtml(billing.icon)} ${escapeHtml(billing.label)}</div>
      </div>

      <div class="agenda-finalization-grid">
        <div class="agenda-finalization-field">
          <div class="agenda-input-label">Forma de pagamento *</div>
          <select id="agenda-payment-method" class="modal-input" style="margin:0;" data-agenda-required="true">
            <option value="">Selecione a forma de pagamento</option>
            ${paymentOptions}
          </select>
        </div>

        <div class="agenda-finalization-field">
          <div class="agenda-input-label">Desconto (R$)</div>
          <input
            id="agenda-discount-input"
            type="number"
            min="0"
            max="${basePrice}"
            step="0.01"
            value="0"
            class="modal-input"
            style="margin:0;"
            data-base-price="${basePrice}"
            ${isSubscription ? 'disabled' : ''}
            placeholder="0,00"
          />
        </div>

        <div class="agenda-finalization-field">
          <div class="agenda-input-label">${isSubscription ? 'Valor coberto' : 'Valor final'}</div>
          <div id="agenda-final-price-display" class="agenda-final-price">
            ${escapeHtml(formatCurrency(isSubscription ? 0 : basePrice))}
          </div>
        </div>
      </div>

      <button
        type="button"
        id="agenda-finalize-btn"
        data-appointment-id="${escapeHtml(String(appointment.id))}"
        data-base-price="${isSubscription ? 0 : basePrice}"
        class="agenda-finalize-btn"
      >
        ✓ Confirmar e finalizar ${isSubscription ? 'pelo plano' : 'atendimento'}
      </button>
    </div>
  `;
}

function renderStatusActions(appointment) {
  // "completed" é tratado pelo painel de finalização — removemos daqui para forçar
  // o preenchimento da forma de pagamento antes de concluir
  const actions = getAvailableStatusActions(appointment.status).filter(
    (s) => s !== 'completed',
  );

  if (!actions.length) {
    return `
      <div class="row-sub" style="padding:10px 12px;border:1px solid #1e2345;border-radius:10px;background:#0a0c1a;">
        Este agendamento está no status final.
      </div>
    `;
  }

  return `
    <div style="display:flex;flex-wrap:wrap;gap:8px;">
      ${actions.map((status) => {
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
              font-size:12px;
            "
          >
            ${escapeHtml(getStatusDisplayName(status))}
          </button>
        `;
      }).join('')}
    </div>
  `;
}

function renderConsumptionButtons(evaluation, subscription, appointment) {
  const consumedTypes = getConsumedTypesForAppointment(appointment.id);
  const availableTypes = evaluation.eligibleConsumeTypes.filter((type) => !consumedTypes.includes(type));
  if (appointment.status === 'cancelled' || appointment.status === 'no_show') return '';
  if (!evaluation.canConsumeForAppointment && !consumedTypes.length) return '';

  const buttons = [];
  if (availableTypes.includes('haircut')) {
    buttons.push(`
      <button type="button" class="agenda-consume-action"
        data-subscription-id="${escapeHtml(subscription.id)}"
        data-appointment-id="${escapeHtml(appointment.id)}"
        data-consumed-type="haircut"
        style="padding:8px 12px;border-radius:8px;border:1px solid rgba(0,230,118,.2);background:rgba(0,230,118,.1);color:#00e676;font-weight:700;cursor:pointer;font-size:12px;">
        Consumir corte do plano
      </button>
    `);
  }
  if (availableTypes.includes('beard')) {
    buttons.push(`
      <button type="button" class="agenda-consume-action"
        data-subscription-id="${escapeHtml(subscription.id)}"
        data-appointment-id="${escapeHtml(appointment.id)}"
        data-consumed-type="beard"
        style="padding:8px 12px;border-radius:8px;border:1px solid rgba(156,111,255,.2);background:rgba(156,111,255,.1);color:#9c6fff;font-weight:700;cursor:pointer;font-size:12px;">
        Consumir barba do plano
      </button>
    `);
  }

  const alreadyConsumedNote = consumedTypes.length
    ? `<div class="row-sub" style="padding:0;color:#5a6888;font-size:10px;">Já consumido neste atendimento: ${escapeHtml(consumedTypes.map(getConsumedTypeLabel).join(' + '))}.</div>`
    : '';

  if (!buttons.length) return alreadyConsumedNote;

  return `
    <div style="display:flex;flex-wrap:wrap;gap:8px;">${buttons.join('')}</div>
    ${alreadyConsumedNote}
    ${evaluation.requirement?.type === 'combo' && buttons.length >= 1
      ? '<div class="row-sub" style="padding:0;color:#5a6888;font-size:10px;">Atendimento combo detectado: lance corte e barba separadamente quando necessário.</div>'
      : ''}
  `;
}

function renderSubscriptionPanel(subscription, appointment) {
  const billing = getAppointmentBillingContext(appointment, subscription);

  if (!subscription) {
    return `
      <div class="agenda-subscription-panel agenda-subscription-panel--empty">
        <div class="agenda-section-kicker">Plano do cliente</div>
        <strong>Nenhum plano ativo encontrado</strong>
        <span>Este atendimento será tratado como avulso, salvo se houver cortesia ou ajuste manual.</span>
      </div>
    `;
  }

  const invoice = getLatestSubscriptionInvoice(subscription);
  const statusMeta = getSubscriptionStatusMeta(subscription.status);
  const invoiceMeta = getInvoiceStatusMeta(invoice?.status || 'pending');
  const evaluation = evaluateSubscriptionForAppointment(subscription, appointment);

  return `
    <div class="agenda-subscription-panel">
      <div class="agenda-subscription-top">
        <div>
          <div class="agenda-section-kicker">Plano do cliente</div>
          <strong>${escapeHtml(subscription?.plans?.name || 'Plano')}</strong>
          <span>Próxima cobrança: ${escapeHtml(formatDateDisplay(subscription.next_billing_at || subscription.current_period_end))}</span>
        </div>
        <span class="status-pill" style="background:${statusMeta.bg};color:${statusMeta.color};border:1px solid ${statusMeta.border};">
          ${statusMeta.label}
        </span>
      </div>

      ${renderAgendaPlanMiniUsage(subscription)}

      <div class="agenda-subscription-mini-grid">
        <div class="mini-card">
          <div class="mini-lbl">Saldo cortes</div>
          <div class="mini-val" style="font-size:16px;color:#00e676">${evaluation.remainingHaircuts}</div>
        </div>
        <div class="mini-card">
          <div class="mini-lbl">Saldo barbas</div>
          <div class="mini-val" style="font-size:16px;color:#9c6fff">${evaluation.remainingBeards}</div>
        </div>
        <div class="mini-card">
          <div class="mini-lbl">Fatura</div>
          <div class="mini-val" style="font-size:13px;color:${invoiceMeta.color}">${escapeHtml(invoiceMeta.label)}</div>
        </div>
        <div class="mini-card">
          <div class="mini-lbl">Cobrança</div>
          <div class="mini-val" style="font-size:13px;color:#c0cce8">${escapeHtml(formatDateDisplay(invoice?.due_at || subscription.next_billing_at || subscription.current_period_end))}</div>
        </div>
      </div>

      <div class="agenda-plan-message agenda-plan-message--${escapeHtml(evaluation.messageVariant)}">
        ${escapeHtml(evaluation.message)}
      </div>

      ${renderAppointmentConsumedAlert(getAppointmentUiContext(appointment))}
      ${renderConsumptionButtons(evaluation, subscription, appointment)}
    </div>
  `;
}

function renderAppointmentDetails(appointment, subscription = null) {
  const meta = getStatusMeta(appointment.status);
  const ui = getAppointmentUiContext(appointment);
  const billing = getAppointmentBillingContext(appointment, subscription);
  const hint = getAppointmentOperationalHint(appointment, { ...ui, subscription });
  const isFinalStatus = ['completed', 'cancelled', 'no_show'].includes(appointment.status);

  return `
    <div class="agenda-command-modal">
      <div class="agenda-modal-hero agenda-modal-hero--${escapeHtml(billing.mode)}">
        <div>
          <div class="agenda-eyebrow">Comanda inteligente</div>
          <h3>${escapeHtml(getClientName(appointment))}</h3>
          <p>${escapeHtml(hint.text)}</p>
          <div class="agenda-badges" style="margin-top:12px;">
            <span class="agenda-badge ${getBillingBadgeClass(billing.tone)}">${escapeHtml(billing.icon)} ${escapeHtml(billing.label)}</span>
            <span class="agenda-badge agenda-badge--neutral">${escapeHtml(getSourceLabel(appointment.source))}</span>
          </div>
        </div>
        <div class="agenda-modal-status">
          <span class="status-pill" style="background:${meta.pillBg};color:${meta.text};border:1px solid ${meta.border};">${meta.label}</span>
          <strong>${escapeHtml(formatTime(appointment.scheduled_at))}</strong>
          <small>${escapeHtml(formatTime(appointment.ends_at))}</small>
        </div>
      </div>

      <div class="agenda-modal-grid">
        <div class="mini-card">
          <div class="mini-lbl">Serviço</div>
          <div class="mini-val" style="font-size:14px;color:#e8f0fe">${escapeHtml(getServiceName(appointment))}</div>
        </div>
        <div class="mini-card">
          <div class="mini-lbl">Barbeiro</div>
          <div class="mini-val" style="font-size:14px;color:#e8f0fe">${escapeHtml(getBarberName(appointment))}</div>
        </div>
        <div class="mini-card">
          <div class="mini-lbl">${billing.mode === 'subscription' ? 'Coberto pelo plano' : 'Valor do serviço'}</div>
          <div class="mini-val" style="font-size:18px;color:${billing.mode === 'subscription' ? '#00e676' : '#4fc3f7'}">${escapeHtml(billing.mode === 'subscription' ? 'R$ 0,00' : formatCurrency(getServicePrice(appointment)))}</div>
        </div>
        <div class="mini-card">
          <div class="mini-lbl">Status operacional</div>
          <div class="mini-val" style="font-size:13px;color:${meta.text}">${escapeHtml(meta.label)}</div>
        </div>
      </div>

      <div>
        ${renderSubscriptionPanel(subscription, appointment)}
      </div>

      ${!isFinalStatus ? renderFinalizationPanel(appointment) : ''}

      <div class="agenda-other-actions">
        <div class="agenda-section-kicker">Outras ações</div>
        ${renderStatusActions(appointment)}
      </div>

      <div id="agenda-details-feedback" class="agenda-details-feedback"></div>

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
  el.style.color = variant === 'error' ? '#ff8a8a' : variant === 'success' ? '#00e676' : '#5a6888';
}

async function getAppointmentSubscription(appointment) {
  const clientId = getClientId(appointment);
  if (!clientId) return null;
  const cacheKey = String(clientId);
  if (Object.prototype.hasOwnProperty.call(agendaState.subscriptionLookup, cacheKey)) {
    return agendaState.subscriptionLookup[cacheKey];
  }
  const subscription = await getActiveSubscriptionByClient(clientId);
  agendaState.subscriptionLookup[cacheKey] = subscription || null;
  return agendaState.subscriptionLookup[cacheKey];
}

async function hydrateSubscriptionsForAppointments(appointments) {
  const uniqueClientIds = [...new Set(appointments.map(getClientId).filter(Boolean).map(String))];
  if (!uniqueClientIds.length) return;
  await Promise.all(
    uniqueClientIds.map(async (clientId) => {
      if (
        Object.prototype.hasOwnProperty.call(agendaState.subscriptionLookup, clientId) ||
        Object.prototype.hasOwnProperty.call(agendaState.subscriptionErrors, clientId)
      ) return;
      try {
        const subscription = await getActiveSubscriptionByClient(clientId);
        agendaState.subscriptionLookup[clientId] = subscription || null;
      } catch (error) {
        agendaState.subscriptionLookup[clientId] = null;
        agendaState.subscriptionErrors[clientId] = error instanceof Error ? error.message : 'Erro ao carregar plano.';
      }
    }),
  );
}

// ─── Finalizar atendimento ────────────────────────────────────────────────────
async function handleFinalizeAppointment(appointmentId, basePrice) {
  const paymentMethodEl = document.getElementById('agenda-payment-method');
  const discountEl      = document.getElementById('agenda-discount-input');
  const paymentMethod   = paymentMethodEl?.value || '';

  if (!validateFinalizeAppointmentForm()) return;

  const isSubscription = paymentMethod === 'subscription';
  const discountRaw = parseFloat(discountEl?.value || '0');
  const discount    = isSubscription ? 0 : (isNaN(discountRaw) || discountRaw < 0 ? 0 : Math.min(discountRaw, basePrice));
  const finalPrice  = isSubscription ? 0 : Math.max(basePrice - discount, 0);

  const btn = document.getElementById('agenda-finalize-btn');

  try {
    if (btn) { btn.setAttribute('disabled', 'disabled'); btn.textContent = 'Finalizando...'; }
    setAppointmentDetailsFeedback('Finalizando atendimento...', 'neutral');

    await apiCompleteAppointment(appointmentId, { paymentMethod, finalPrice });

    setAppointmentDetailsFeedback('Atendimento finalizado com sucesso!', 'success');
    showAgendaToast('Atendimento finalizado com sucesso.', 'success');

    setTimeout(async () => {
      closeAppointmentDetails();
      await loadAgendaForDate(agendaState.currentDate);
    }, 500);
  } catch (error) {
    const message = normalizeAgendaError(error);
    setAppointmentDetailsFeedback(message, 'error');
    showAgendaToast(message, 'error');
    if (btn) {
      btn.removeAttribute('disabled');
      btn.textContent = '✓ Confirmar e finalizar atendimento';
    }
  }
}

async function openAppointmentDetails(appointmentId) {
  const modal   = document.getElementById('agenda-details-modal');
  const content = document.getElementById('agenda-details-content');
  if (!modal || !content) return;

  const appointment = agendaState.currentAppointments.find(
    (item) => String(item.id) === String(appointmentId),
  );
  if (!appointment) return;

  content.innerHTML = `
    <div style="display:grid;gap:10px;">
      <div class="modal-title" style="margin:0;">${escapeHtml(getClientName(appointment))}</div>
      <div class="modal-sub">Carregando comanda...</div>
    </div>
  `;

  modal.style.display = 'flex';
  modal.classList.add('open');

  const bindModalEvents = () => {
    document.getElementById('agenda-details-close')?.addEventListener('click', closeAppointmentDetails);

    // Status rápido (não inclui completed)
    document.querySelectorAll('.agenda-status-action').forEach((button) => {
      button.addEventListener('click', () => {
        const nextStatus = button.dataset.status;
        const currentAppointmentId = button.dataset.appointmentId;
        if (!nextStatus || !currentAppointmentId) return;
        handleAppointmentStatusChange(currentAppointmentId, nextStatus);
      });
    });

    // Consumo de plano
    document.querySelectorAll('.agenda-consume-action').forEach((button) => {
      button.addEventListener('click', () => {
        const subscriptionId       = button.dataset.subscriptionId;
        const currentAppointmentId = button.dataset.appointmentId;
        const consumedType         = button.dataset.consumedType;
        if (!subscriptionId || !currentAppointmentId || !consumedType) return;
        handleConsumeSubscriptionBenefit(subscriptionId, currentAppointmentId, consumedType);
      });
    });

    // ── Painel de finalização ─────────────────────────────────────────────────
    const finalizeBtn       = document.getElementById('agenda-finalize-btn');
    const discountInput     = document.getElementById('agenda-discount-input');
    const finalPriceDisplay = document.getElementById('agenda-final-price-display');

    // Recalcula valor final em tempo real conforme desconto é digitado
    if (discountInput && finalPriceDisplay) {
      discountInput.addEventListener('input', () => {
        const base     = parseFloat(discountInput.dataset.basePrice || '0');
        const discount = parseFloat(discountInput.value || '0');
        const safe     = isNaN(discount) || discount < 0 ? 0 : Math.min(discount, base);
        const final    = Math.max(base - safe, 0);
        finalPriceDisplay.textContent = formatCurrency(final);
        finalPriceDisplay.style.color = safe > 0 ? '#ffd700' : '#00e676';
      });
    }

    document.getElementById('agenda-payment-method')?.addEventListener('change', (event) => {
      clearAgendaFieldError(event.target);
    });

    document.getElementById('agenda-discount-input')?.addEventListener('input', (event) => {
      clearAgendaFieldError(event.target);
    });

    if (finalizeBtn) {
      finalizeBtn.addEventListener('mouseenter', () => { if (!finalizeBtn.disabled) finalizeBtn.style.opacity = '.88'; });
      finalizeBtn.addEventListener('mouseleave', () => { finalizeBtn.style.opacity = '1'; });
      finalizeBtn.addEventListener('click', () => {
        const apptId    = finalizeBtn.dataset.appointmentId;
        const basePrice = parseFloat(finalizeBtn.dataset.basePrice || '0');
        if (apptId) handleFinalizeAppointment(apptId, basePrice);
      });
    }
  };

  try {
    const subscription = await getAppointmentSubscription(appointment);
    content.innerHTML  = renderAppointmentDetails(appointment, subscription);
    bindModalEvents();
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Não foi possível carregar o plano do cliente.';
    content.innerHTML = renderAppointmentDetails(appointment, null);
    setTimeout(() => setAppointmentDetailsFeedback(message, 'error'), 0);
    bindModalEvents();
  }
}

function closeAppointmentDetails() {
  const modal   = document.getElementById('agenda-details-modal');
  const content = document.getElementById('agenda-details-content');
  if (!modal) return;
  modal.classList.remove('open');
  modal.style.display = 'none';
  if (content) content.innerHTML = '';
}

function openCreateModal() {
  const modal = document.getElementById('agenda-create-modal');
  if (!modal) return;
  clearAgendaValidation(modal);
  setCreateFeedback('', 'neutral');
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
  if (!agendaState.cachedClients)  agendaState.cachedClients  = await getClients();
  if (!agendaState.cachedBarbers)  agendaState.cachedBarbers  = await getBarbers();
  if (!agendaState.cachedServices) agendaState.cachedServices = await getServices();
  return {
    clients:  Array.isArray(agendaState.cachedClients)  ? agendaState.cachedClients  : [],
    barbers:  Array.isArray(agendaState.cachedBarbers)  ? agendaState.cachedBarbers  : [],
    services: Array.isArray(agendaState.cachedServices) ? agendaState.cachedServices : [],
  };
}

async function populateCreateModal() {
  const clientSelect  = document.getElementById('agenda-create-client');
  const barberSelect  = document.getElementById('agenda-create-barber');
  const serviceSelect = document.getElementById('agenda-create-service');
  const dateInput     = document.getElementById('agenda-create-date');

  if (dateInput) dateInput.value = agendaState.currentDate;
  setCreateFeedback('Carregando opções...', 'neutral');

  try {
    const { clients, barbers, services } = await ensureCreateDependencies();
    if (clientSelect)  clientSelect.innerHTML  = '<option value="">Selecione o cliente</option>'  + renderModalSelectOptions(clients,  (i) => i.id, (i) => i.name || 'Cliente');
    if (barberSelect)  barberSelect.innerHTML  = '<option value="">Selecione o barbeiro</option>' + renderModalSelectOptions(barbers,  (i) => i.id, (i) => i?.users?.name || 'Barbeiro');
    if (serviceSelect) serviceSelect.innerHTML = '<option value="">Selecione o serviço</option>'  + renderModalSelectOptions(services, (i) => i.id, (i) => `${i.name || 'Serviço'} · ${formatCurrency(i.price)}`);
    setCreateFeedback('', 'neutral');
  } catch (error) {
    const message = normalizeAgendaError(error instanceof Error ? error.message : 'Não foi possível carregar as opções.');
    setCreateFeedback(message, 'error');
    showAgendaToast(message, 'error');
  }
}

async function handleCreateAppointment(event) {
  event.preventDefault();

  const form = document.getElementById('agenda-create-form');
  const submitBtn   = document.getElementById('agenda-create-submit');
  const clientId    = document.getElementById('agenda-create-client')?.value;
  const barberId    = document.getElementById('agenda-create-barber')?.value;
  const serviceId   = document.getElementById('agenda-create-service')?.value;
  const dateValue   = document.getElementById('agenda-create-date')?.value;
  const timeValue   = document.getElementById('agenda-create-time')?.value;
  const sourceValue = document.getElementById('agenda-create-source')?.value || 'dashboard';

  if (!validateCreateAppointmentForm()) return;

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
    showAgendaToast('Agendamento criado com sucesso.', 'success');
    agendaState.currentDate = dateValue;

    const pageDateInput = document.getElementById('agenda-date-input');
    if (pageDateInput) pageDateInput.value = dateValue;

    await loadAgendaForDate(dateValue);

    setTimeout(() => {
      closeCreateModal();
      setCreateFeedback('', 'neutral');
      clearAgendaValidation(form || document);
      if (form) form.reset();
      const modalDateInput = document.getElementById('agenda-create-date');
      if (modalDateInput) modalDateInput.value = agendaState.currentDate;
    }, 350);
  } catch (error) {
    const message = normalizeAgendaError(error);
    setCreateFeedback(message, 'error');
    markFieldFromApiError(message);
    showAgendaToast(message, 'error');
  } finally {
    submitBtn?.removeAttribute('disabled');
    if (submitBtn) submitBtn.textContent = 'Salvar agendamento';
  }
}

async function handleConsumeSubscriptionBenefit(subscriptionId, appointmentId, consumedType) {
  const buttons     = document.querySelectorAll('.agenda-consume-action');
  const appointment = agendaState.currentAppointments.find((item) => String(item.id) === String(appointmentId));

  try {
    buttons.forEach((button) => button.setAttribute('disabled', 'disabled'));
    setAppointmentDetailsFeedback('Consumindo benefício do plano...', 'neutral');

    await consumeSubscriptionBenefit(subscriptionId, {
      appointment_id: appointmentId,
      consumed_type:  consumedType,
      quantity:       1,
      notes:          'Consumo manual pela agenda',
    });

    markAppointmentBenefitAsConsumed(appointmentId, consumedType);
    if (appointment) clearCachedSubscriptionByClient(getClientId(appointment));

    setAppointmentDetailsFeedback('Benefício consumido com sucesso.', 'success');
    showAgendaToast('Benefício do plano consumido com sucesso.', 'success');
    await loadAgendaForDate(agendaState.currentDate);
    await openAppointmentDetails(appointmentId);
  } catch (error) {
    const message = normalizeAgendaError(error instanceof Error ? error.message : 'Não foi possível consumir o benefício.');
    setAppointmentDetailsFeedback(message, 'error');
    showAgendaToast(message, 'error');
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
    showAgendaToast('Status do atendimento atualizado.', 'success');
    closeAppointmentDetails();
    await loadAgendaForDate(agendaState.currentDate);
  } catch (error) {
    const message = normalizeAgendaError(error instanceof Error ? error.message : 'Não foi possível atualizar o status.');
    setAppointmentDetailsFeedback(message, 'error');
    showAgendaToast(message, 'error');
  } finally {
    buttons.forEach((button) => button.removeAttribute('disabled'));
  }
}

async function handleOpenCreateModal() {
  openCreateModal();
  await populateCreateModal();
}

function getBarberFilterOptions(appointments) {
  return [...new Set(appointments.map(getBarberName).filter(Boolean))].sort((a, b) => a.localeCompare(b));
}

function ensureValidAgendaFilters(appointments) {
  const barberOptions = getBarberFilterOptions(appointments);
  if (agendaState.filters.barber !== 'all' && !barberOptions.includes(agendaState.filters.barber)) {
    agendaState.filters.barber = 'all';
  }
}

function applyAgendaFilters(appointments) {
  return appointments.filter((appointment) => {
    const ui = getAppointmentUiContext(appointment);
    if (agendaState.filters.status !== 'all' && appointment.status !== agendaState.filters.status) return false;
    if (agendaState.filters.barber !== 'all' && getBarberName(appointment) !== agendaState.filters.barber) return false;
    if (agendaState.filters.focus === 'withPlan'  && !ui.evaluation.hasPlan)    return false;
    if (agendaState.filters.focus === 'blocked'   && !ui.requiresAttention)     return false;
    if (agendaState.filters.focus === 'consumed'  && !ui.hasConsumedInPlan)     return false;
    return true;
  });
}

function renderAgendaToolbar(appointments, counters, filteredCount) {
  const barberOptions = getBarberFilterOptions(appointments);
  const filters = [
    { key: 'all', label: 'Todos', count: counters.total },
    { key: 'withPlan', label: 'Planos', count: counters.withPlan },
    { key: 'blocked', label: 'Alertas', count: counters.blocked },
    { key: 'consumed', label: 'Consumidos', count: counters.consumed },
  ];

  return `
    <div class="agenda-toolbar agenda-toolbar-premium">
      <div class="agenda-focus-chips">
        ${filters.map((item) => `
          <button type="button" class="agenda-focus-chip ${agendaState.filters.focus === item.key ? 'is-active' : ''}" data-focus-filter="${escapeHtml(item.key)}">
            ${escapeHtml(item.label)} <span>${item.count}</span>
          </button>
        `).join('')}
      </div>

      <div class="agenda-filter-row agenda-filter-row-premium">
        <div class="agenda-filter-field">
          <label for="agenda-filter-status">Status</label>
          <select id="agenda-filter-status" class="agenda-filter-select">
            <option value="all"         ${agendaState.filters.status === 'all'         ? 'selected' : ''}>Todos os status</option>
            <option value="pending"     ${agendaState.filters.status === 'pending'     ? 'selected' : ''}>Agendado</option>
            <option value="confirmed"   ${agendaState.filters.status === 'confirmed'   ? 'selected' : ''}>Confirmado</option>
            <option value="in_progress" ${agendaState.filters.status === 'in_progress' ? 'selected' : ''}>Em andamento</option>
            <option value="completed"   ${agendaState.filters.status === 'completed'   ? 'selected' : ''}>Concluído</option>
            <option value="cancelled"   ${agendaState.filters.status === 'cancelled'   ? 'selected' : ''}>Cancelado</option>
            <option value="no_show"     ${agendaState.filters.status === 'no_show'     ? 'selected' : ''}>No-show</option>
          </select>
        </div>

        <div class="agenda-filter-field">
          <label for="agenda-filter-barber">Barbeiro</label>
          <select id="agenda-filter-barber" class="agenda-filter-select">
            <option value="all">Todos os barbeiros</option>
            ${barberOptions.map((b) => `<option value="${escapeHtml(b)}" ${agendaState.filters.barber === b ? 'selected' : ''}>${escapeHtml(b)}</option>`).join('')}
          </select>
        </div>
      </div>

      <div class="agenda-filter-result">
        Exibindo <strong>${filteredCount}</strong> de <strong>${appointments.length}</strong> atendimentos. Clique em um horário para abrir a comanda inteligente.
      </div>
    </div>
  `;
}

function renderFilteredEmptyState() {
  return `<div class="agenda-filter-empty">Nenhum atendimento encontrado com os filtros aplicados.</div>`;
}

function bindAgendaListInteractions() {
  document.getElementById('agenda-refresh-action')?.addEventListener('click', () => loadAgendaForDate(agendaState.currentDate));
  document.getElementById('agenda-new-action')?.addEventListener('click', handleOpenCreateModal);

  document.querySelectorAll('.appt-row[data-appointment-id]').forEach((row) => {
    row.addEventListener('click', () => openAppointmentDetails(row.dataset.appointmentId));
    row.addEventListener('keydown', (event) => {
      if (event.key === 'Enter' || event.key === ' ') {
        event.preventDefault();
        openAppointmentDetails(row.dataset.appointmentId);
      }
    });
  });

  document.getElementById('agenda-filter-status')?.addEventListener('change', (event) => {
    agendaState.filters.status = event.target.value || 'all';
    renderAgendaData();
  });

  document.getElementById('agenda-filter-barber')?.addEventListener('change', (event) => {
    agendaState.filters.barber = event.target.value || 'all';
    renderAgendaData();
  });

  document.querySelectorAll('[data-focus-filter]').forEach((button) => {
    button.addEventListener('click', () => {
      agendaState.filters.focus = button.dataset.focusFilter || 'all';
      renderAgendaData();
    });
  });
}

function renderAgendaData() {
  const listContainer    = document.getElementById('agenda-list-container');
  const summaryContainer = document.getElementById('agenda-summary-container');
  if (!listContainer || !summaryContainer) return;

  const appointments = Array.isArray(agendaState.currentAppointments) ? agendaState.currentAppointments : [];

  if (!appointments.length) {
    listContainer.innerHTML = `
      <div class="agenda-empty-premium">
        <div class="agenda-empty-orb">◌</div>
        <strong>Nenhum agendamento nesta data</strong>
        <span>Abra um horário manualmente ou escolha outro dia para ver a operação.</span>
        <button class="btn-primary-gradient" id="agenda-empty-new-action" type="button">+ Novo agendamento</button>
      </div>
    `;
    summaryContainer.innerHTML = `<div class="card">${renderSummaryPanel(createSummary([]), getAgendaCounters([]))}</div>`;
    document.getElementById('agenda-empty-new-action')?.addEventListener('click', handleOpenCreateModal);
    return;
  }

  ensureValidAgendaFilters(appointments);

  const counters             = getAgendaCounters(appointments);
  const summary              = createSummary(appointments);
  const filteredAppointments = applyAgendaFilters(appointments);

  listContainer.innerHTML = `
    ${renderAgendaOperationHero(summary, counters)}

    <div class="card agenda-list-card">
      <div class="card-header agenda-list-header">
        <div>
          <div class="card-title" id="agenda-current-date-label">Agenda operacional</div>
          <div class="row-sub" style="padding:4px 0 0;color:#5a6888;">Plano, pagamento, status e comanda no mesmo fluxo.</div>
        </div>
        <div class="agenda-header-actions">
          <button class="btn-primary-gradient" id="agenda-new-action" type="button">+ Novo agendamento</button>
          <button class="btn-primary-gradient" id="agenda-refresh-action" type="button">Atualizar</button>
        </div>
      </div>
      ${renderAgendaToolbar(appointments, counters, filteredAppointments.length)}
      <div class="agenda-timeline">
        ${filteredAppointments.length ? filteredAppointments.map(renderAppointmentRow).join('') : renderFilteredEmptyState()}
      </div>
    </div>
  `;

  summaryContainer.innerHTML = `<div class="card agenda-sticky-summary">${renderSummaryPanel(summary, counters)}</div>`;
  bindAgendaListInteractions();
}

async function loadAgendaForDate(dateValue) {
  agendaState.currentDate = dateValue;
  const listContainer    = document.getElementById('agenda-list-container');
  const summaryContainer = document.getElementById('agenda-summary-container');
  if (!listContainer || !summaryContainer) return;

  updateAgendaHeader(dateValue);

  const apiUrl = getApiBaseUrl();
  if (!apiUrl) {
    agendaState.currentAppointments = [];
    listContainer.innerHTML    = renderConfigHint('API não configurada', 'Informe a URL pública do backend para integrar a Agenda.', true);
    summaryContainer.innerHTML = renderEmptyState('Aguardando configuração da API.');
    return;
  }

  if (!hasAuthToken()) {
    agendaState.currentAppointments = [];
    listContainer.innerHTML    = renderConfigHint('Login pendente', 'Faça o login para liberar as rotas protegidas da Agenda.', true);
    summaryContainer.innerHTML = renderEmptyState('Aguardando autenticação.');
    return;
  }

  listContainer.innerHTML    = renderLoadingState();
  summaryContainer.innerHTML = renderLoadingState();

  try {
    const appointments      = await getAppointmentsByDate(dateValue);
    const safeAppointments  = Array.isArray(appointments) ? appointments : [];
    agendaState.currentAppointments = safeAppointments;
    await hydrateSubscriptionsForAppointments(safeAppointments);
    renderAgendaData();
  } catch (error) {
    agendaState.currentAppointments = [];
    const message = normalizeAgendaError(error instanceof Error ? error.message : 'Não foi possível carregar a agenda.');
    listContainer.innerHTML    = renderConfigHint('Erro ao consultar a agenda', message, true);
    summaryContainer.innerHTML = renderEmptyState('Sem resumo disponível.');
    showAgendaToast(message, 'error');
  }
}

export function renderAgenda() {
  const today = agendaState.currentDate || formatDateForApi(new Date());
  return /* html */ `
<section class="page-shell page--agenda">
  <div class="agenda-page-head">
    <div>
      <h1>Operação do dia</h1>
      <p>Controle horários, planos, recebimentos e comissões no mesmo painel.</p>
    </div>

    <div class="agenda-date-control">
      <button id="agenda-prev-day-action" type="button" class="agenda-date-nav">‹</button>
      <input id="agenda-date-input" type="date" value="${today}" />
      <button id="agenda-next-day-action" type="button" class="agenda-date-nav">›</button>
      <button id="agenda-today-action" type="button" class="agenda-date-soft">Hoje</button>
      <button id="agenda-create-cta" type="button" class="btn-primary-gradient">+ Novo</button>
      <button id="agenda-load-action" type="button" class="agenda-date-soft">Carregar</button>
    </div>
  </div>

  <div class="agenda-premium-grid">
    <div id="agenda-list-container"></div>
    <div id="agenda-summary-container"></div>
  </div>

  <div id="agenda-create-modal" class="modal-overlay" style="display:none;">
    <div class="modal agenda-create-premium-modal">
      <div class="agenda-modal-hero">
        <div>
          <div class="agenda-eyebrow">Novo horário</div>
          <h3>Criar agendamento</h3>
          <p>Selecione cliente, barbeiro, serviço e horário. Se o cliente tiver plano, o backend reserva automaticamente o benefício.</p>
        </div>
      </div>

      <form id="agenda-create-form">
        <div class="agenda-create-grid">
          <div class="agenda-field-block agenda-field-block--full">
            <label>Cliente</label>
            <select id="agenda-create-client" class="modal-input" data-agenda-required="true"><option value="">Selecione o cliente</option></select>
          </div>
          <div class="agenda-field-block">
            <label>Barbeiro</label>
            <select id="agenda-create-barber" class="modal-input" data-agenda-required="true"><option value="">Selecione o barbeiro</option></select>
          </div>
          <div class="agenda-field-block">
            <label>Serviço</label>
            <select id="agenda-create-service" class="modal-input" data-agenda-required="true"><option value="">Selecione o serviço</option></select>
          </div>
          <div class="agenda-field-block">
            <label>Data</label>
            <input id="agenda-create-date" class="modal-input" type="date" value="${today}" data-agenda-required="true" />
          </div>
          <div class="agenda-field-block">
            <label>Horário</label>
            <input id="agenda-create-time" class="modal-input" type="time" value="14:30" step="1800" data-agenda-required="true" />
          </div>
          <div class="agenda-field-block agenda-field-block--full">
            <label>Origem</label>
            <select id="agenda-create-source" class="modal-input">
              <option value="dashboard">Dashboard</option>
              <option value="whatsapp">WhatsApp</option>
              <option value="walk_in">Walk-in</option>
              <option value="link">Link</option>
            </select>
          </div>
        </div>

        <div id="agenda-create-feedback" class="agenda-details-feedback"></div>

        <div class="modal-buttons" style="margin-top:10px;">
          <button type="button" class="btn-cancel" id="agenda-create-cancel">Cancelar</button>
          <button type="submit" class="btn-save" id="agenda-create-submit">Salvar agendamento</button>
        </div>
      </form>
    </div>
  </div>

  <div id="agenda-details-modal" class="modal-overlay" style="display:none;">
    <div class="modal agenda-details-premium-modal">
      <div id="agenda-details-content"></div>
    </div>
  </div>
</section>
  `;
}

export function initAgendaPage() {
  const dateInput     = document.getElementById('agenda-date-input');
  const loadButton    = document.getElementById('agenda-load-action');
  const createButton  = document.getElementById('agenda-create-cta');
  const createForm    = document.getElementById('agenda-create-form');
  const createCancel  = document.getElementById('agenda-create-cancel');
  const modal         = document.getElementById('agenda-create-modal');
  const detailsModal  = document.getElementById('agenda-details-modal');
  const initialDate   = dateInput?.value || agendaState.currentDate || formatDateForApi(new Date());

  const loadCurrentSelection = () => {
    const selectedDate = dateInput?.value || formatDateForApi(new Date());
    loadAgendaForDate(selectedDate);
  };

  const todayButton = document.getElementById('agenda-today-action');
  const prevButton = document.getElementById('agenda-prev-day-action');
  const nextButton = document.getElementById('agenda-next-day-action');

  const moveDate = (days) => {
    const base = dateInput?.value || formatDateForApi(new Date());
    const [year, month, day] = base.split('-').map(Number);
    const date = new Date(year, month - 1, day);
    date.setDate(date.getDate() + days);
    const nextDate = formatDateForApi(date);
    if (dateInput) dateInput.value = nextDate;
    loadAgendaForDate(nextDate);
  };

  loadButton?.addEventListener('click', loadCurrentSelection);
  dateInput?.addEventListener('change', loadCurrentSelection);
  todayButton?.addEventListener('click', () => {
    const today = formatDateForApi(new Date());
    if (dateInput) dateInput.value = today;
    loadAgendaForDate(today);
  });
  prevButton?.addEventListener('click', () => moveDate(-1));
  nextButton?.addEventListener('click', () => moveDate(1));
  createButton?.addEventListener('click', handleOpenCreateModal);
  createForm?.addEventListener('submit', handleCreateAppointment);
  createForm?.addEventListener('input', (event) => clearAgendaFieldError(event.target));
  createForm?.addEventListener('change', (event) => clearAgendaFieldError(event.target));
  createCancel?.addEventListener('click', closeCreateModal);

  modal?.addEventListener('click', (event) => { if (event.target === modal) closeCreateModal(); });
  detailsModal?.addEventListener('click', (event) => { if (event.target === detailsModal) closeAppointmentDetails(); });

  loadAgendaForDate(initialDate);
}
