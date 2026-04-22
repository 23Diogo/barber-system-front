import {
  getClientPortalContext,
  getClientPortalServices,
  getClientPortalBarbers,
  getClientPortalAvailableSlots,
  createClientPortalAppointment,
  getClientProfile,
  loginClient,
  setClientToken,
  setClientProfile,
} from '../../services/client-auth.js';

// ─── State ────────────────────────────────────────────────────────────────────

const state = {
  step: 1,
  context: null,
  services: [],
  barbers: [],
  slots: [],
  linkedBarbershops: [],
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

// ─── Helpers ──────────────────────────────────────────────────────────────────

function esc(v) {
  return String(v ?? '').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;').replace(/'/g,'&#039;');
}

function formatCurrency(v) {
  return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(Number(v || 0));
}

function formatDuration(m) {
  const t = Number(m || 0);
  if (!t) return '';
  if (t < 60) return `${t} min`;
  const h = Math.floor(t / 60), r = t % 60;
  return r ? `${h}h ${r}min` : `${h}h`;
}

function formatDateTime(v) {
  if (!v) return '—';
  const d = new Date(v);
  if (isNaN(d)) return '—';
  return d.toLocaleString('pt-BR', { day:'2-digit', month:'2-digit', year:'numeric', hour:'2-digit', minute:'2-digit' });
}

function formatTime(v) {
  if (!v) return '—';
  const d = new Date(v);
  if (isNaN(d)) return v;
  return d.toLocaleTimeString('pt-BR', { hour:'2-digit', minute:'2-digit' });
}

function barberName(b) {
  const u = b?.user || b?.users || {};
  return u.name || 'Profissional';
}

function barberInitials(b) {
  return barberName(b).split(' ').slice(0,2).map(p => p[0]?.toUpperCase()||'').join('');
}

function setFeedback(msg, variant = 'neutral') {
  const el = document.getElementById('agendar-feedback');
  if (!el) return;
  el.textContent = msg || '';
  el.style.color = variant === 'error' ? '#ff7b91' : variant === 'success' ? '#00e676' : '#8fa3c7';
}

// ─── Re-render ────────────────────────────────────────────────────────────────

function rerender() {
  const steps = document.getElementById('agendar-steps');
  if (steps) steps.innerHTML = renderStepsHtml();

  const root = document.getElementById('agendar-root');
  if (root) {
    root.innerHTML = renderStepContent();
    bindEvents();
  }
}

// ─── Steps bar ────────────────────────────────────────────────────────────────

const STEPS = ['Serviço','Profissional','Data e hora','Confirmar'];

function renderStepsHtml() {
  return STEPS.map((label, i) => {
    const n = i + 1;
    const cls = n < state.step ? 'is-done' : n === state.step ? 'is-active' : '';
    const icon = n < state.step ? '✓' : String(n);
    return `
      ${i > 0 ? '<div class="agendar-step-sep"></div>' : ''}
      <div class="agendar-step ${cls}">
        <div class="agendar-step-num">${icon}</div>
        <div class="agendar-step-label">${esc(label)}</div>
      </div>`;
  }).join('');
}

// ─── Step content ─────────────────────────────────────────────────────────────

function renderStepContent() {
  const titles = [
    ['Escolha o serviço',      'Selecione o que você quer fazer'],
    ['Escolha o profissional', 'Quem vai te atender?'],
    ['Data e horário',         'Quando você quer ser atendido?'],
    ['Confirme sua reserva',   'Revise os detalhes antes de confirmar'],
  ];
  const [title, sub] = titles[state.step - 1];

  const canNext = (
    (state.step === 1 && !!state.selectedService) ||
    (state.step === 2 && !!state.selectedBarber) ||
    (state.step === 3 && !!state.selectedDate && !!state.selectedSlot)
  );

  return `
    <div class="card" style="display:grid;gap:18px;">
      <div id="agendar-feedback" class="agendar-feedback"></div>

      <div>
        <div class="agendar-section-title">${esc(title)}</div>
        <div class="agendar-section-sub">${esc(sub)}</div>
      </div>

      <div id="agendar-step-body">
        ${renderStepBody()}
      </div>

      <div class="agendar-nav">
        ${state.step > 1
          ? `<button type="button" class="agendar-btn-back" id="btn-back">← Voltar</button>`
          : `<div></div>`}
        ${state.step < 4
          ? `<button type="button" class="agendar-btn-next" id="btn-next" ${!canNext ? 'disabled' : ''}>Próximo →</button>`
          : `<button type="button" class="agendar-btn-confirm" id="btn-confirm" ${state.isSubmitting ? 'disabled' : ''}>
               ${state.isSubmitting ? 'Confirmando...' : '✓ Confirmar reserva'}
             </button>`}
      </div>
    </div>`;
}

function renderStepBody() {
  if (state.step === 1) return renderServices();
  if (state.step === 2) return renderBarbers();
  if (state.step === 3) return renderDateTime();
  return renderSummary();
}

// ─── Step 1 ───────────────────────────────────────────────────────────────────

function getCategoryIcon(category) {
  const map = {
    corte:      '✂️',
    barba:      '🪒',
    combo:      '✂️',
    coloracao:  '🎨',
    estetica:   '✨',
    tratamento: '💆',
    acabamento: '💈',
  };
  const key = String(category || '').toLowerCase()
    .normalize('NFD').replace(/[\u0300-\u036f]/g, '');
  return Object.entries(map).find(([k]) => key.includes(k))?.[1] || '✂️';
}

function renderServices() {
  if (state.isLoadingServices) return `<div class="agendar-empty"><strong>Carregando serviços...</strong></div>`;
  if (!state.services.length) return `
    <div class="agendar-empty">
      <strong>Nenhum serviço disponível</strong>
      A barbearia ainda não cadastrou serviços ativos.
    </div>`;

  return `<div class="agendar-cards">
    ${state.services.map(s => `
      <div class="agendar-card ${state.selectedService?.id === s.id ? 'is-selected' : ''}" data-srv="${esc(s.id)}">
        <div class="agendar-card-icon">${getCategoryIcon(s.category)}</div>
        <div class="agendar-card-name">${esc(s.name)}</div>
        <div class="agendar-card-meta">
          <div class="agendar-card-price">${esc(formatCurrency(s.price))}</div>
          ${s.duration_min ? `<div class="agendar-card-duration">${esc(formatDuration(s.duration_min))}</div>` : ''}
        </div>
        ${s.includedInPlan ? `<div class="agendar-card-badge">✓ Incluso no plano</div>` : ''}
      </div>`).join('')}
  </div>`;
}


// ─── Step 2 ───────────────────────────────────────────────────────────────────

function renderBarbers() {
  if (state.isLoadingBarbers) return `<div class="agendar-empty"><strong>Carregando profissionais...</strong></div>`;
  if (!state.barbers.length) return `
    <div class="agendar-empty">
      <strong>Nenhum profissional disponível</strong>
      Não há profissionais disponíveis para este serviço.
    </div>`;

  return `<div class="agendar-barber-cards">
    ${state.barbers.map(b => {
      const price = b.customPrice != null ? formatCurrency(b.customPrice)
        : state.selectedService ? formatCurrency(state.selectedService.price) : '';
      return `
        <div class="agendar-barber-card ${state.selectedBarber?.id === b.id ? 'is-selected' : ''}" data-barber="${esc(b.id)}">
          <div class="agendar-barber-avatar">${esc(barberInitials(b))}</div>
          <div class="agendar-barber-name">${esc(barberName(b))}</div>
          ${price ? `<div class="agendar-barber-price">${esc(price)}</div>` : ''}
        </div>`;
    }).join('')}
  </div>`;
}

// ─── Step 3 ───────────────────────────────────────────────────────────────────

function renderDateTime() {
  const days = Number(state.context?.barbershop?.booking_advance_days || 30);
  const today = new Date().toISOString().slice(0,10);
  const maxD  = new Date(); maxD.setDate(maxD.getDate() + days);
  const max   = maxD.toISOString().slice(0,10);

  const slotsHtml = state.isLoadingSlots
    ? `<div class="agendar-empty"><strong>Buscando horários...</strong></div>`
    : !state.selectedDate
    ? `<div class="agendar-empty"><strong>Selecione uma data</strong>Os horários disponíveis aparecerão aqui.</div>`
    : !state.slots.length
    ? `<div class="agendar-empty"><strong>Sem horários nesta data</strong>Tente outro dia ou outro profissional.</div>`
    : `<div class="agendar-slots">
        ${state.slots.map(slot => `
          <button type="button" class="agendar-slot-btn ${state.selectedSlot === slot ? 'is-selected':''}" data-slot="${esc(slot)}">
            ${esc(formatTime(slot))}
          </button>`).join('')}
       </div>`;

  return `
    <div style="display:grid;gap:18px;">
      <div>
        <div class="cfg-label" style="margin-bottom:8px;">📅 Data</div>
        <input type="date" id="agendar-date" class="agendar-date-input"
          value="${esc(state.selectedDate)}" min="${esc(today)}" max="${esc(max)}"/>
      </div>
      <div>
        <div class="cfg-label" style="margin-bottom:8px;">🕐 Horários disponíveis</div>
        ${slotsHtml}
      </div>
    </div>`;
}

// ─── Step 4 ───────────────────────────────────────────────────────────────────

function renderSummary() {
  const s = state.selectedService;
  const b = state.selectedBarber;
  const shop = state.context?.barbershop || {};
  const price = s?.includedInPlan ? 'Incluso no plano'
    : b?.customPrice != null ? formatCurrency(b.customPrice)
    : s ? formatCurrency(s.price) : '—';

  return `
    <div class="agendar-summary">
      <div class="agendar-summary-row">
        <div class="agendar-summary-label">Barbearia</div>
        <div class="agendar-summary-value">${esc(shop.name || '—')}</div>
      </div>
      <div class="agendar-summary-row">
        <div class="agendar-summary-label">Serviço</div>
        <div class="agendar-summary-value is-highlight">${esc(s?.name || '—')}</div>
      </div>
      <div class="agendar-summary-row">
        <div class="agendar-summary-label">Profissional</div>
        <div class="agendar-summary-value">${esc(barberName(b))}</div>
      </div>
      <div class="agendar-summary-row">
        <div class="agendar-summary-label">Data e hora</div>
        <div class="agendar-summary-value is-highlight">${esc(formatDateTime(state.selectedSlot))}</div>
      </div>
      <div class="agendar-summary-row">
        <div class="agendar-summary-label">Cobrança</div>
        <div class="agendar-summary-value">${esc(price)}</div>
      </div>
      <div style="display:grid;gap:6px;">
        <div class="cfg-label">📝 Observação (opcional)</div>
        <textarea id="agendar-notes" class="agendar-notes" maxlength="280"
          placeholder="Ex.: quero degradê mais baixo">${esc(state.notes)}</textarea>
        <div class="agendar-notes-count" id="agendar-notes-count">${state.notes.length}/280</div>
      </div>
    </div>`;
}

// ─── Bind events ──────────────────────────────────────────────────────────────

function bindEvents() {
  // Serviços
  document.querySelectorAll('[data-srv]').forEach(el => {
    el.addEventListener('click', () => {
      const id = el.getAttribute('data-srv');
      state.selectedService = state.services.find(s => s.id === id) || null;
      state.selectedBarber  = null;
      state.selectedDate    = '';
      state.selectedSlot    = '';
      state.slots           = [];
      rerender();
    });
  });

  // Barbeiros
  document.querySelectorAll('[data-barber]').forEach(el => {
    el.addEventListener('click', () => {
      const id = el.getAttribute('data-barber');
      state.selectedBarber = state.barbers.find(b => b.id === id) || null;
      state.selectedDate   = '';
      state.selectedSlot   = '';
      state.slots          = [];
      rerender();
    });
  });

  // Data
  document.getElementById('agendar-date')?.addEventListener('change', async e => {
    state.selectedDate   = e.target.value || '';
    state.selectedSlot   = '';
    state.slots          = [];
    state.isLoadingSlots = true;
    rerender();
    await loadSlots();
  });

  // Slots
  document.querySelectorAll('[data-slot]').forEach(el => {
    el.addEventListener('click', () => {
      state.selectedSlot = el.getAttribute('data-slot') || '';
      rerender();
    });
  });

  // Notas
  document.getElementById('agendar-notes')?.addEventListener('input', e => {
    state.notes = e.target.value || '';
    const c = document.getElementById('agendar-notes-count');
    if (c) c.textContent = `${state.notes.length}/280`;
  });

  // Próximo
  document.getElementById('btn-next')?.addEventListener('click', async () => {
    state.step++;
    if (state.step === 2) await loadBarbers();
    rerender();
  });

  // Voltar
  document.getElementById('btn-back')?.addEventListener('click', () => {
    state.step--;
    rerender();
  });

  // Confirmar
  document.getElementById('btn-confirm')?.addEventListener('click', handleSubmit);

  // Barbershop selector
  document.getElementById('client-barbershop-select')?.addEventListener('change', async e => {
    const slug = e.target.value;
    if (!slug || slug === state.context?.barbershop?.slug) return;
    await switchBarbershop(slug);
  });
}

// ─── API ──────────────────────────────────────────────────────────────────────

async function loadServices() {
  state.isLoadingServices = true;
  rerender();
  try {
    const payload = await getClientPortalServices();
    state.services = Array.isArray(payload?.items) ? payload.items : [];
  } catch { state.services = []; }
  state.isLoadingServices = false;
  rerender();
}

async function loadBarbers() {
  if (!state.selectedService) return;
  state.isLoadingBarbers = true;
  rerender();
  try {
    const payload = await getClientPortalBarbers({ serviceId: state.selectedService.id });
    state.barbers = Array.isArray(payload?.items) ? payload.items : [];
  } catch { state.barbers = []; }
  state.isLoadingBarbers = false;
  rerender();
}

async function loadSlots() {
  if (!state.selectedService || !state.selectedBarber || !state.selectedDate) {
    state.isLoadingSlots = false;
    rerender();
    return;
  }
  try {
    const payload = await getClientPortalAvailableSlots({
      serviceId: state.selectedService.id,
      barberId:  state.selectedBarber.id,
      date:      state.selectedDate,
    });
    state.slots = Array.isArray(payload?.slots) ? payload.slots : [];
  } catch { state.slots = []; }
  state.isLoadingSlots = false;
  rerender();
}

async function handleSubmit() {
  if (!state.selectedService || !state.selectedBarber || !state.selectedSlot) return;
  state.isSubmitting = true;
  rerender();
  setFeedback('Confirmando seu agendamento...', 'neutral');
  try {
    const res = await createClientPortalAppointment({
      serviceId:   state.selectedService.id,
      barberId:    state.selectedBarber.id,
      scheduledAt: state.selectedSlot,
      notes:       state.notes,
    });
    setFeedback(`✓ Agendado para ${formatDateTime(res?.appointment?.scheduled_at || state.selectedSlot)}`, 'success');
    setTimeout(() => {
      window.history.pushState({ clientRoute: 'agendamentos' }, '', '/client/agendamentos');
      window.dispatchEvent(new PopStateEvent('popstate'));
    }, 1000);
  } catch (err) {
    setFeedback(err instanceof Error ? err.message : 'Não foi possível confirmar.', 'error');
    state.isSubmitting = false;
    rerender();
  }
}

async function switchBarbershop(slug) {
  try {
    const profile    = getClientProfile();
    const identifier = profile?.email || profile?.whatsapp;
    if (!identifier) throw new Error('Sessão inválida.');
    const password = window.prompt('Digite sua senha para trocar de barbearia:');
    if (!password) {
      const sel = document.getElementById('client-barbershop-select');
      if (sel) sel.value = state.context?.barbershop?.slug || '';
      return;
    }
    const data = await loginClient({ identifier, password, barbershopSlug: slug });
    if (data?.token) setClientToken(data.token);
    if (data?.client) setClientProfile(data.client);
    state.step = 1; state.selectedService = null; state.selectedBarber = null;
    state.selectedDate = ''; state.selectedSlot = ''; state.slots = [];
    state.services = []; state.barbers = [];
    const context = await getClientPortalContext();
    state.context = context || null;
    state.linkedBarbershops = getClientProfile()?.barbershops || [];
    await loadServices();
  } catch (err) {
    const sel = document.getElementById('client-barbershop-select');
    if (sel) sel.value = state.context?.barbershop?.slug || '';
    setFeedback(err instanceof Error ? err.message : 'Erro ao trocar.', 'error');
  }
}

// ─── Barbershop selector ──────────────────────────────────────────────────────

function renderBarbershopSelectorHtml() {
  const shops     = state.linkedBarbershops;
  const currentId = state.context?.barbershop?.id;
  if (!shops || shops.length <= 1) return '';
  return `
    <div style="padding:12px 14px;border-radius:14px;background:rgba(79,195,247,.04);border:1px solid rgba(79,195,247,.12);display:grid;gap:8px;">
      <div class="cfg-label">🏪 Agendar em qual barbearia?</div>
      <select id="client-barbershop-select"
        style="min-height:44px;border-radius:10px;border:1px solid rgba(79,195,247,.20);background:rgba(79,195,247,.06);color:#f5f9ff;padding:0 12px;font:inherit;font-weight:700;">
        ${shops.map(s => `<option value="${esc(s.slug)}" ${s.id === currentId ? 'selected' : ''}>${esc(s.name)}${s.id === currentId ? ' ✓' : ''}</option>`).join('')}
      </select>
    </div>`;
}

// ─── Export ───────────────────────────────────────────────────────────────────

export function renderClientAgendar() {
  return `
    <div id="pages" style="display:block">
      <div class="page active">
        <div class="agendar-wizard">
          <div class="agendar-steps" id="agendar-steps">
            ${renderStepsHtml()}
          </div>
          ${renderBarbershopSelectorHtml()}
          <div id="agendar-root"></div>
        </div>
      </div>
    </div>`;
}

export function initClientAgendarPage({ navigate }) {
  const root = document.getElementById('agendar-root');
  if (root) { root.innerHTML = renderStepContent(); bindEvents(); }

  (async () => {
    try {
      setFeedback('Carregando...', 'neutral');
      const context = await getClientPortalContext();
      state.context = context || null;
      state.linkedBarbershops = getClientProfile()?.barbershops || [];
      rerender();
      await loadServices();
      setFeedback('', 'neutral');
    } catch (err) {
      setFeedback(err instanceof Error ? err.message : 'Erro ao carregar.', 'error');
    }
  })();
}
