import {
  getClientPortalContext,
  getClientPortalServices,
  getClientPortalBarbers,
  getClientPortalAvailableSlots,
  createClientPortalAppointment,
  getClientPortalSubscription,
} from '../../services/client-auth.js';

const state = {
  step: 1,
  context: null,
  services: [],
  barbers: [],
  slots: [],
  subscriptionPayload: null,
  selectedService: null,
  selectedBarber: null,
  selectedDate: '',
  selectedSlot: '',
  notes: '',
  isLoadingServices: false,
  isLoadingBarbers: false,
  isLoadingSlots: false,
  isSubmitting: false,
};

const STEPS = ['Serviço', 'Profissional', 'Data e hora', 'Confirmar'];

function escapeHtml(value) {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

function normalizeText(value) {
  return String(value || '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '');
}

function formatCurrency(value) {
  return new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL',
  }).format(Number(value || 0));
}

function formatDuration(minutes) {
  const total = Number(minutes || 0);

  if (!total) return '';

  if (total < 60) return `${total} min`;

  const hours = Math.floor(total / 60);
  const rest = total % 60;

  return rest ? `${hours}h ${rest}min` : `${hours}h`;
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

function formatTime(value) {
  if (!value) return '-';

  const match = String(value).match(/T(\d{2}:\d{2})/);

  if (match) return match[1];

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) return '-';

  return date.toLocaleTimeString('pt-BR', {
    hour: '2-digit',
    minute: '2-digit',
    timeZone: 'America/Sao_Paulo',
  });
}

function todayInputValue() {
  return new Date().toISOString().slice(0, 10);
}

function addDaysToInputDate(days) {
  const date = new Date();
  date.setDate(date.getDate() + Number(days || 0));
  return date.toISOString().slice(0, 10);
}

function getBookingAdvanceDays() {
  return Number(
    state.context?.barbershop?.booking_advance_days ??
    state.context?.barbershop?.agenda_open_days ??
    state.context?.barbershop?.bookingAdvanceDays ??
    30
  );
}

function getCategoryIcon(category) {
  const key = normalizeText(category);

  if (key.includes('barba')) return '🪒';
  if (key.includes('combo')) return '💈';
  if (key.includes('color')) return '🎨';
  if (key.includes('estetica')) return '✨';
  if (key.includes('tratamento')) return '💆';
  if (key.includes('acabamento')) return '💈';

  return '✂️';
}

function barberName(barber) {
  const user = barber?.user || barber?.users || {};
  return user.name || barber?.name || 'Profissional';
}

function barberInitials(barber) {
  return barberName(barber)
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() || '')
    .join('') || 'BF';
}

function setFeedback(message, variant = 'neutral') {
  const el = document.getElementById('agendar-feedback');

  if (!el) return;

  el.textContent = message || '';
  el.style.color =
    variant === 'error'
      ? '#ff7b91'
      : variant === 'success'
        ? '#00e676'
        : '#8fa3c7';
}

function getCurrentSubscription() {
  return state.subscriptionPayload?.subscription || null;
}

function getCurrentCycle() {
  return state.subscriptionPayload?.currentCycle || null;
}

function isSubscriptionActive() {
  const status = String(getCurrentSubscription()?.status || '').toLowerCase();
  return ['active', 'trialing'].includes(status);
}

function getServiceIdFromBalance(balance) {
  return (
    balance?.service_id ||
    balance?.serviceId ||
    balance?.services?.id ||
    (Array.isArray(balance?.services) ? balance.services[0]?.id : '') ||
    ''
  );
}

function getServiceCoverageInfo(service) {
  if (!service || !isSubscriptionActive()) {
    return {
      canUsePlan: false,
      label: 'Avulso',
      detail: 'Este serviço será cobrado como atendimento avulso.',
    };
  }

  const cycle = getCurrentCycle();
  const balances = Array.isArray(cycle?.subscription_cycle_service_balances)
    ? cycle.subscription_cycle_service_balances
    : [];

  const directBalance = balances.find((balance) => {
    return String(getServiceIdFromBalance(balance)) === String(service.id);
  });

  if (directBalance) {
    const remaining = Number(directBalance.remaining_quantity ?? 0);
    const reserved = Number(directBalance.reserved_quantity ?? 0);

    if (remaining > 0) {
      return {
        canUsePlan: true,
        label: 'Pode usar plano',
        detail: `${remaining} crédito(s) disponível(is) para este serviço. Reservados: ${reserved}.`,
      };
    }

    return {
      canUsePlan: false,
      label: 'Sem crédito',
      detail: 'Seu plano existe, mas não há crédito disponível para este serviço.',
    };
  }

  const category = normalizeText(service.category || service.name);

  if (category.includes('corte')) {
    const remaining = Number(cycle?.remaining_haircuts ?? 0);
    if (remaining > 0) {
      return {
        canUsePlan: true,
        label: 'Pode usar plano',
        detail: `${remaining} corte(s) disponível(is) no ciclo atual.`,
      };
    }
  }

  if (category.includes('barba')) {
    const remaining = Number(cycle?.remaining_beards ?? 0);
    if (remaining > 0) {
      return {
        canUsePlan: true,
        label: 'Pode usar plano',
        detail: `${remaining} barba(s) disponível(is) no ciclo atual.`,
      };
    }
  }

  return {
    canUsePlan: false,
    label: 'Avulso',
    detail: 'O backend confirmará se existe cobertura de plano no momento da reserva.',
  };
}

function normalizeListPayload(payload) {
  if (Array.isArray(payload)) return payload;
  if (Array.isArray(payload?.items)) return payload.items;
  if (Array.isArray(payload?.data)) return payload.data;
  return [];
}

function resetFromStep(step) {
  if (step <= 1) {
    state.selectedBarber = null;
    state.selectedDate = '';
    state.selectedSlot = '';
    state.slots = [];
  }

  if (step <= 2) {
    state.selectedDate = '';
    state.selectedSlot = '';
    state.slots = [];
  }

  if (step <= 3) {
    state.selectedSlot = '';
  }
}

function renderStepsHtml() {
  return STEPS.map((label, index) => {
    const number = index + 1;
    const cls =
      number < state.step
        ? 'is-done'
        : number === state.step
          ? 'is-active'
          : '';
    const icon = number < state.step ? '✓' : String(number);

    return `
      ${index > 0 ? '<div class="agendar-step-sep"></div>' : ''}
      <div class="agendar-step ${cls}">
        <div class="agendar-step-num">${escapeHtml(icon)}</div>
        <div class="agendar-step-label">${escapeHtml(label)}</div>
      </div>
    `;
  }).join('');
}

function renderStepContent() {
  const titles = [
    ['Escolha o serviço', 'Selecione o que você quer fazer'],
    ['Escolha o profissional', 'Quem vai te atender?'],
    ['Data e horário', 'Quando você quer ser atendido?'],
    ['Confirme sua reserva', 'Revise os detalhes antes de confirmar'],
  ];

  const [title, subtitle] = titles[state.step - 1];

  const canNext =
    (state.step === 1 && Boolean(state.selectedService)) ||
    (state.step === 2 && Boolean(state.selectedBarber)) ||
    (state.step === 3 && Boolean(state.selectedDate && state.selectedSlot));

  return `
    <div class="card" style="display:grid;gap:18px;">
      <div id="agendar-feedback" class="agendar-feedback"></div>

      <div>
        <div class="agendar-section-title">${escapeHtml(title)}</div>
        <div class="agendar-section-sub">${escapeHtml(subtitle)}</div>
      </div>

      <div id="agendar-step-body">
        ${renderStepBody()}
      </div>

      <div class="agendar-nav">
        ${
          state.step > 1
            ? '<button type="button" class="agendar-btn-back" id="btn-back">← Voltar</button>'
            : '<div></div>'
        }

        ${
          state.step < 4
            ? `
              <button type="button" class="agendar-btn-next" id="btn-next" ${!canNext ? 'disabled' : ''}>
                Próximo →
              </button>
            `
            : `
              <button type="button" class="agendar-btn-confirm" id="btn-confirm" ${state.isSubmitting ? 'disabled' : ''}>
                ${state.isSubmitting ? 'Confirmando...' : '✓ Confirmar reserva'}
              </button>
            `
        }
      </div>
    </div>
  `;
}

function renderStepBody() {
  if (state.step === 1) return renderServices();
  if (state.step === 2) return renderBarbers();
  if (state.step === 3) return renderDateTime();
  return renderSummary();
}

function renderServices() {
  if (state.isLoadingServices) {
    return '<div class="agendar-empty"><strong>Carregando serviços...</strong></div>';
  }

  if (!state.services.length) {
    return `
      <div class="agendar-empty">
        <strong>Nenhum serviço disponível</strong>
        <span>Quando a barbearia ativar serviços, eles aparecerão aqui.</span>
      </div>
    `;
  }

  return `
    <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(240px,1fr));gap:14px;">
      ${state.services.map((service) => {
        const selected = state.selectedService?.id === service.id;
        const coverage = getServiceCoverageInfo(service);

        return `
          <button
            type="button"
            class="agendar-option-card ${selected ? 'is-selected' : ''}"
            data-service-id="${escapeHtml(service.id)}"
            style="
              text-align:left;
              border-radius:18px;
              border:1px solid ${selected ? 'rgba(79,195,247,.55)' : 'rgba(79,195,247,.14)'};
              background:${selected ? 'rgba(79,195,247,.10)' : 'rgba(255,255,255,.03)'};
              padding:16px;
              color:inherit;
              cursor:pointer;
              display:grid;
              gap:10px;
              min-width:0;
            "
          >
            <div style="display:flex;justify-content:space-between;gap:10px;align-items:flex-start;">
              <div style="font-size:28px;">${escapeHtml(getCategoryIcon(service.category || service.name))}</div>
              <span class="pill" style="${coverage.canUsePlan ? 'color:#00e676;background:rgba(0,230,118,.10);' : ''}">
                ${escapeHtml(coverage.label)}
              </span>
            </div>

            <div>
              <div style="font-size:17px;font-weight:800;color:#fff;line-height:1.25;overflow-wrap:anywhere;">
                ${escapeHtml(service.name || 'Serviço')}
              </div>
              <div style="margin-top:5px;color:#8fa3c7;font-size:13px;line-height:1.5;">
                ${escapeHtml(service.description || coverage.detail)}
              </div>
            </div>

            <div style="display:flex;justify-content:space-between;gap:10px;align-items:center;flex-wrap:wrap;">
              <strong style="color:#7dd3fc;font-size:18px;">${escapeHtml(formatCurrency(service.price))}</strong>
              <span style="color:#8fa3c7;font-size:13px;">${escapeHtml(formatDuration(service.duration_min))}</span>
            </div>
          </button>
        `;
      }).join('')}
    </div>
  `;
}

function renderBarbers() {
  if (state.isLoadingBarbers) {
    return '<div class="agendar-empty"><strong>Carregando profissionais...</strong></div>';
  }

  if (!state.selectedService) {
    return `
      <div class="agendar-empty">
        <strong>Escolha um serviço primeiro</strong>
        <span>Depois disso vamos listar os profissionais disponíveis.</span>
      </div>
    `;
  }

  if (!state.barbers.length) {
    return `
      <div class="agendar-empty">
        <strong>Nenhum profissional disponível</strong>
        <span>Não encontramos profissionais disponíveis para este serviço.</span>
      </div>
    `;
  }

  return `
    <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(240px,1fr));gap:14px;">
      ${state.barbers.map((barber) => {
        const selected = state.selectedBarber?.id === barber.id;

        return `
          <button
            type="button"
            data-barber-id="${escapeHtml(barber.id)}"
            style="
              text-align:left;
              border-radius:18px;
              border:1px solid ${selected ? 'rgba(79,195,247,.55)' : 'rgba(79,195,247,.14)'};
              background:${selected ? 'rgba(79,195,247,.10)' : 'rgba(255,255,255,.03)'};
              padding:16px;
              color:inherit;
              cursor:pointer;
              display:flex;
              gap:12px;
              align-items:center;
              min-width:0;
            "
          >
            <div
              style="
                width:48px;
                height:48px;
                border-radius:16px;
                display:flex;
                align-items:center;
                justify-content:center;
                background:linear-gradient(135deg,#4fc3f7,#6c3fff);
                color:#fff;
                font-weight:900;
                flex-shrink:0;
              "
            >
              ${escapeHtml(barberInitials(barber))}
            </div>

            <div style="min-width:0;">
              <div style="font-size:16px;font-weight:800;color:#fff;overflow-wrap:anywhere;">
                ${escapeHtml(barberName(barber))}
              </div>
              <div style="margin-top:4px;color:#8fa3c7;font-size:13px;">
                ${barber.is_accepting === false ? 'Agenda indisponível' : 'Disponível para agendamento'}
              </div>
            </div>
          </button>
        `;
      }).join('')}
    </div>
  `;
}

function renderDateTime() {
  const minDate = todayInputValue();
  const maxDate = addDaysToInputDate(getBookingAdvanceDays());

  return `
    <div style="display:grid;gap:16px;">
      <div class="client-form-field">
        <label class="client-form-label" for="client-schedule-date">Data</label>
        <input
          id="client-schedule-date"
          class="client-form-input"
          type="date"
          min="${escapeHtml(minDate)}"
          max="${escapeHtml(maxDate)}"
          value="${escapeHtml(state.selectedDate)}"
        />
      </div>

      <div id="client-slots-area">
        ${renderSlots()}
      </div>
    </div>
  `;
}

function renderSlots() {
  if (!state.selectedDate) {
    return `
      <div class="agendar-empty">
        <strong>Escolha uma data</strong>
        <span>Os horários disponíveis aparecerão aqui.</span>
      </div>
    `;
  }

  if (state.isLoadingSlots) {
    return '<div class="agendar-empty"><strong>Carregando horários...</strong></div>';
  }

  if (!state.slots.length) {
    return `
      <div class="agendar-empty">
        <strong>Nenhum horário disponível</strong>
        <span>Tente outra data ou profissional.</span>
      </div>
    `;
  }

  return `
    <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(110px,1fr));gap:10px;">
      ${state.slots.map((slot) => {
        const selected = state.selectedSlot === slot;

        return `
          <button
            type="button"
            data-slot="${escapeHtml(slot)}"
            style="
              min-height:44px;
              border-radius:12px;
              border:1px solid ${selected ? 'rgba(79,195,247,.55)' : 'rgba(79,195,247,.14)'};
              background:${selected ? 'rgba(79,195,247,.16)' : 'rgba(255,255,255,.03)'};
              color:${selected ? '#7dd3fc' : '#dce8ff'};
              font:inherit;
              font-weight:800;
              cursor:pointer;
            "
          >
            ${escapeHtml(formatTime(slot))}
          </button>
        `;
      }).join('')}
    </div>
  `;
}

function renderSummary() {
  const coverage = getServiceCoverageInfo(state.selectedService);

  return `
    <div style="display:grid;gap:14px;">
      <div class="cfg-row">
        <div>
          <div class="cfg-label">Serviço</div>
          <div class="cfg-sub">${escapeHtml(state.selectedService?.name || '-')}</div>
        </div>
        <span class="pill">${escapeHtml(formatCurrency(state.selectedService?.price || 0))}</span>
      </div>

      <div class="cfg-row">
        <div>
          <div class="cfg-label">Profissional</div>
          <div class="cfg-sub">${escapeHtml(barberName(state.selectedBarber))}</div>
        </div>
        <span class="pill">Barbeiro</span>
      </div>

      <div class="cfg-row">
        <div>
          <div class="cfg-label">Data e horário</div>
          <div class="cfg-sub">${escapeHtml(formatDateTime(state.selectedSlot))}</div>
        </div>
        <span class="pill">Agenda</span>
      </div>

      <div
        style="
          border:1px solid ${coverage.canUsePlan ? 'rgba(0,230,118,.22)' : 'rgba(255,193,7,.18)'};
          background:${coverage.canUsePlan ? 'rgba(0,230,118,.06)' : 'rgba(255,193,7,.06)'};
          color:${coverage.canUsePlan ? '#00e676' : '#ffd166'};
          border-radius:14px;
          padding:12px;
          font-size:13px;
          line-height:1.55;
        "
      >
        <strong>${escapeHtml(coverage.label)}:</strong> ${escapeHtml(coverage.detail)}
      </div>

      <div class="client-form-field">
        <label class="client-form-label" for="client-schedule-notes">Observações</label>
        <textarea
          id="client-schedule-notes"
          class="client-form-input"
          rows="3"
          placeholder="Alguma observação para a barbearia?"
          style="resize:vertical;"
        >${escapeHtml(state.notes)}</textarea>
      </div>
    </div>
  `;
}

function rerender() {
  const steps = document.getElementById('agendar-steps');

  if (steps) {
    steps.innerHTML = renderStepsHtml();
  }

  const root = document.getElementById('agendar-root');

  if (root) {
    root.innerHTML = renderStepContent();
    bindEvents();
  }
}

async function loadServicesAndContext() {
  state.isLoadingServices = true;
  rerender();

  try {
    const [context, servicesPayload, subscriptionPayload] = await Promise.all([
      getClientPortalContext(),
      getClientPortalServices(),
      getClientPortalSubscription(),
    ]);

    state.context = context || null;
    state.services = normalizeListPayload(servicesPayload);
    state.subscriptionPayload = subscriptionPayload || null;
  } finally {
    state.isLoadingServices = false;
    rerender();
  }
}

async function loadBarbers() {
  if (!state.selectedService?.id) return;

  state.isLoadingBarbers = true;
  rerender();

  try {
    const payload = await getClientPortalBarbers({
      serviceId: state.selectedService.id,
    });

    state.barbers = normalizeListPayload(payload);
  } finally {
    state.isLoadingBarbers = false;
    rerender();
  }
}

async function loadSlots() {
  if (!state.selectedService?.id || !state.selectedBarber?.id || !state.selectedDate) return;

  state.isLoadingSlots = true;
  rerender();

  try {
    const payload = await getClientPortalAvailableSlots({
      serviceId: state.selectedService.id,
      barberId: state.selectedBarber.id,
      date: state.selectedDate,
    });

    state.slots = normalizeListPayload(payload);
  } finally {
    state.isLoadingSlots = false;
    rerender();
  }
}

async function submitAppointment(navigate) {
  if (!state.selectedService || !state.selectedBarber || !state.selectedSlot) {
    setFeedback('Revise serviço, profissional e horário antes de confirmar.', 'error');
    return;
  }

  try {
    state.isSubmitting = true;
    rerender();
    setFeedback('Confirmando sua reserva...', 'neutral');

    const notes = document.getElementById('client-schedule-notes')?.value?.trim() || '';

    const result = await createClientPortalAppointment({
      serviceId: state.selectedService.id,
      barberId: state.selectedBarber.id,
      scheduledAt: state.selectedSlot,
      notes,
    });

    const billing = result?.billing || {};
    const billingMode = billing?.billingMode || billing?.billing_mode || result?.billing_mode || '';

    if (String(billingMode).toLowerCase() === 'subscription') {
      setFeedback('Reserva confirmada. Este atendimento foi vinculado ao seu plano.', 'success');
    } else {
      setFeedback('Reserva confirmada com sucesso.', 'success');
    }

    setTimeout(() => {
      navigate('agendamentos');
    }, 900);
  } catch (error) {
    setFeedback(
      error instanceof Error ? error.message : 'Não foi possível confirmar sua reserva.',
      'error'
    );
  } finally {
    state.isSubmitting = false;
    rerender();
  }
}

function bindEvents() {
  document.querySelectorAll('[data-service-id]').forEach((button) => {
    button.addEventListener('click', () => {
      const serviceId = button.getAttribute('data-service-id');
      state.selectedService = state.services.find((service) => String(service.id) === String(serviceId)) || null;
      resetFromStep(1);
      rerender();
    });
  });

  document.querySelectorAll('[data-barber-id]').forEach((button) => {
    button.addEventListener('click', () => {
      const barberId = button.getAttribute('data-barber-id');
      state.selectedBarber = state.barbers.find((barber) => String(barber.id) === String(barberId)) || null;
      resetFromStep(2);
      rerender();
    });
  });

  document.getElementById('client-schedule-date')?.addEventListener('change', async (event) => {
    state.selectedDate = event.target.value || '';
    state.selectedSlot = '';
    await loadSlots();
  });

  document.querySelectorAll('[data-slot]').forEach((button) => {
    button.addEventListener('click', () => {
      state.selectedSlot = button.getAttribute('data-slot') || '';
      rerender();
    });
  });

  document.getElementById('client-schedule-notes')?.addEventListener('input', (event) => {
    state.notes = event.target.value || '';
  });

  document.getElementById('btn-back')?.addEventListener('click', () => {
    state.step = Math.max(1, state.step - 1);
    rerender();
  });

  document.getElementById('btn-next')?.addEventListener('click', async () => {
    if (state.step === 1 && state.selectedService) {
      state.step = 2;
      await loadBarbers();
      return;
    }

    if (state.step === 2 && state.selectedBarber) {
      state.step = 3;
      rerender();
      return;
    }

    if (state.step === 3 && state.selectedDate && state.selectedSlot) {
      state.step = 4;
      rerender();
    }
  });
}

export function renderClientAgendar() {
  return `
    <div id="pages" style="display:block">
      <div class="page active">
        <div style="display:grid;gap:18px;">
          <div class="card">
            <div class="card-header">
              <div class="card-title">Agendar horário</div>
              <div class="card-action" data-client-route="agendamentos">Meus agendamentos</div>
            </div>

            <div id="agendar-steps" class="agendar-steps">
              ${renderStepsHtml()}
            </div>
          </div>

          <div id="agendar-root">
            ${renderStepContent()}
          </div>
        </div>
      </div>
    </div>
  `;
}

export function initClientAgendarPage({ navigate }) {
  state.step = 1;
  state.services = [];
  state.barbers = [];
  state.slots = [];
  state.subscriptionPayload = null;
  state.selectedService = null;
  state.selectedBarber = null;
  state.selectedDate = '';
  state.selectedSlot = '';
  state.notes = '';
  state.isSubmitting = false;

  bindEvents();

  loadServicesAndContext().catch((error) => {
    setFeedback(
      error instanceof Error ? error.message : 'Não foi possível carregar o agendamento.',
      'error'
    );
  });

  document.getElementById('agendar-root')?.addEventListener('click', (event) => {
    if (event.target?.id === 'btn-confirm') {
      submitAppointment(navigate);
    }
  });
}
