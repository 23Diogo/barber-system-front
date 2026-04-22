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

const state = {
  context: null,
  services: [],
  barbers: [],
  linkedBarbershops: [],
  selectedServiceId: '',
  selectedBarberId: '',
  selectedDate: '',
  selectedSlot: '',
  isSwitchingBarbershop: false,
};

function escapeHtml(value) {
  return String(value ?? '')
    .replace(/&/g, '&amp;').replace(/</g, '&lt;')
    .replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#039;');
}

function formatCurrency(value) {
  return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(Number(value || 0));
}

function formatDuration(minutes) {
  const total = Number(minutes || 0);
  if (!total) return '-';
  if (total < 60) return `${total} min`;
  const hours = Math.floor(total / 60);
  const mins  = total % 60;
  if (!mins) return `${hours}h`;
  return `${hours}h ${mins}min`;
}

function formatDateTime(value) {
  if (!value) return '-';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '-';
  return date.toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' });
}

function getSelectedService() {
  return state.services.find(item => item.id === state.selectedServiceId) || null;
}

function getSelectedBarber() {
  return state.barbers.find(item => item.id === state.selectedBarberId) || null;
}

function getNotesValue() {
  return document.getElementById('client-agendar-notes')?.value?.trim() || '';
}

function setFeedback(message, variant = 'neutral') {
  const el = document.getElementById('client-agendar-feedback');
  if (!el) return;
  el.textContent = message || '';
  el.style.color = variant === 'error' ? '#ff7b91' : variant === 'success' ? '#00e676' : '#8fa3c7';
}

// ─── Dropdown de barbearia ─────────────────────────────────────────────────────

function renderBarbershopSelector() {
  const container = document.getElementById('client-agendar-barbershop-selector');
  if (!container) return;

  const shops = state.linkedBarbershops;
  const currentId = state.context?.barbershop?.id;

  // Só mostra se tiver mais de uma barbearia vinculada
  if (!shops || shops.length <= 1) {
    container.innerHTML = '';
    return;
  }

  container.innerHTML = `
    <div class="cfg-row" style="flex-wrap:wrap;gap:10px;">
      <div style="flex:1;">
        <div class="cfg-label">🏪 Selecionar barbearia</div>
        <div class="cfg-sub">Você tem vínculo com ${escapeHtml(String(shops.length))} barbearias. Escolha em qual quer agendar.</div>
      </div>
    </div>
    <select id="client-barbershop-select"
      style="width:100%;min-height:50px;border-radius:14px;border:1px solid rgba(79,195,247,.28);background:rgba(79,195,247,.06);color:#f5f9ff;padding:0 14px;font:inherit;font-weight:700;">
      ${shops.map(shop => `
        <option value="${escapeHtml(shop.slug)}" ${shop.id === currentId ? 'selected' : ''}>
          ${escapeHtml(shop.name)}${shop.id === currentId ? ' (atual)' : ''}
        </option>
      `).join('')}
    </select>
    <div id="client-barbershop-switch-feedback" style="min-height:14px;font-size:11px;color:#8fa3c7;"></div>
  `;

  document.getElementById('client-barbershop-select')?.addEventListener('change', async (event) => {
    const slug = event.target.value;
    if (!slug || slug === state.context?.barbershop?.slug) return;
    await switchBarbershop(slug);
  });
}

async function switchBarbershop(slug) {
  const fb = document.getElementById('client-barbershop-switch-feedback');
  if (fb) fb.textContent = 'Trocando barbearia...';

  state.isSwitchingBarbershop = true;

  try {
    const profile = getClientProfile();
    const identifier = profile?.email || profile?.whatsapp;
    if (!identifier) throw new Error('Sessão inválida. Faça login novamente.');

    // Mostra campo de senha para confirmar troca
    renderPasswordConfirm(slug, identifier);
  } catch (error) {
    if (fb) fb.textContent = error instanceof Error ? error.message : 'Erro ao trocar barbearia.';
    state.isSwitchingBarbershop = false;
  }
}

function renderPasswordConfirm(slug, identifier) {
  const container = document.getElementById('client-agendar-barbershop-selector');
  if (!container) return;

  const shop = state.linkedBarbershops.find(s => s.slug === slug);

  container.innerHTML += `
    <div id="client-switch-confirm-box"
      style="border:1px solid rgba(79,195,247,.20);border-radius:14px;background:rgba(79,195,247,.06);padding:14px;display:grid;gap:10px;margin-top:8px;">
      <div class="cfg-label">Confirme sua senha para agendar em ${escapeHtml(shop?.name || slug)}</div>
      <input id="client-switch-password" type="password" placeholder="Sua senha"
        style="min-height:44px;border-radius:10px;border:1px solid rgba(79,195,247,.16);background:rgba(255,255,255,.04);color:#f5f9ff;padding:0 12px;font:inherit;width:100%;box-sizing:border-box;"/>
      <div id="client-switch-error" style="min-height:14px;font-size:11px;color:#ff7b91;"></div>
      <div style="display:flex;gap:10px;flex-wrap:wrap;">
        <button type="button" id="client-switch-confirm-btn"
          style="min-height:40px;padding:0 16px;border-radius:10px;border:0;background:linear-gradient(135deg,#5dc8ff,#1468ff);color:#fff;font:inherit;font-weight:800;cursor:pointer;">
          Confirmar troca
        </button>
        <button type="button" id="client-switch-cancel-btn"
          style="min-height:40px;padding:0 14px;border-radius:10px;border:1px solid rgba(79,195,247,.16);background:rgba(255,255,255,.04);color:#dce8ff;font:inherit;font-weight:700;cursor:pointer;">
          Cancelar
        </button>
      </div>
    </div>
  `;

  document.getElementById('client-switch-cancel-btn')?.addEventListener('click', () => {
    state.isSwitchingBarbershop = false;
    // Reverte o select para a barbearia atual
    const sel = document.getElementById('client-barbershop-select');
    if (sel) sel.value = state.context?.barbershop?.slug || '';
    document.getElementById('client-switch-confirm-box')?.remove();
  });

  document.getElementById('client-switch-confirm-btn')?.addEventListener('click', async () => {
    const password = document.getElementById('client-switch-password')?.value || '';
    const errEl    = document.getElementById('client-switch-error');

    if (!password) {
      if (errEl) errEl.textContent = 'Informe sua senha.';
      return;
    }

    const btn = document.getElementById('client-switch-confirm-btn');
    if (btn) btn.disabled = true;
    if (errEl) errEl.textContent = '';

    try {
      setFeedback('Trocando para a barbearia selecionada...', 'neutral');

      const data = await loginClient({
        identifier,
        password,
        barbershopSlug: slug,
      });

      if (data?.token) setClientToken(data.token);
      if (data?.client) setClientProfile(data.client);

      // Recarrega o contexto da nova barbearia
      resetAgendamentoState();
      const context = await getClientPortalContext();
      state.context = context || null;
      state.linkedBarbershops = getClientProfile()?.barbershops || [];

      renderBarbershopSelector();
      renderContextBlock();
      updateDateLimits();
      await loadServices();
      renderSlots([], false);

      document.getElementById('client-switch-confirm-box')?.remove();
      state.isSwitchingBarbershop = false;

      setFeedback(`Agendando em ${escapeHtml(state.context?.barbershop?.name || slug)}.`, 'success');
    } catch (error) {
      if (errEl) errEl.textContent = error instanceof Error ? error.message : 'Senha incorreta.';
      if (btn) btn.disabled = false;
    }
  });
}

function resetAgendamentoState() {
  state.services         = [];
  state.barbers          = [];
  state.selectedServiceId = '';
  state.selectedBarberId  = '';
  state.selectedDate      = '';
  state.selectedSlot      = '';

  const dateInput = document.getElementById('client-agendar-date');
  if (dateInput) dateInput.value = '';
}

// ─── Context block ─────────────────────────────────────────────────────────────

function renderContextBlock() {
  const container = document.getElementById('client-agendar-context');
  if (!container) return;

  const barbershop   = state.context?.barbershop || {};
  const subscription = state.context?.subscription || null;

  container.innerHTML = `
    <div class="cfg-row">
      <div>
        <div class="cfg-label">Barbearia atual</div>
        <div class="cfg-sub">${escapeHtml(barbershop.name || 'Barbearia')}</div>
      </div>
      <span class="pill">Portal atual</span>
    </div>

    <div class="cfg-row">
      <div>
        <div class="cfg-label">Antecedência máxima</div>
        <div class="cfg-sub">${escapeHtml(String(barbershop.booking_advance_days || 30))} dia(s)</div>
      </div>
      <span class="pill">Agenda</span>
    </div>

    <div class="cfg-row">
      <div>
        <div class="cfg-label">Cancelamento</div>
        <div class="cfg-sub">Até ${escapeHtml(String(barbershop.cancellation_hours || 0))} hora(s) antes</div>
      </div>
      <span class="pill">Regra</span>
    </div>

    <div class="cfg-row">
      <div>
        <div class="cfg-label">Plano ativo</div>
        <div class="cfg-sub">${escapeHtml(subscription?.planName || 'Nenhum plano ativo')}</div>
      </div>
      <span class="pill">${escapeHtml(subscription?.status || 'Sem plano')}</span>
    </div>
  `;
}

function populateServices() {
  const select = document.getElementById('client-agendar-service');
  if (!select) return;

  select.innerHTML = [
    '<option value="">Selecione um serviço</option>',
    ...state.services.map(service => {
      const tag = service.includedInPlan ? ' • incluído no plano' : '';
      return `<option value="${escapeHtml(service.id)}">${escapeHtml(service.name)} • ${escapeHtml(formatCurrency(service.price))} • ${escapeHtml(formatDuration(service.duration_min))}${escapeHtml(tag)}</option>`;
    }),
  ].join('');
  select.value = state.selectedServiceId || '';
}

function populateBarbers() {
  const select = document.getElementById('client-agendar-barber');
  if (!select) return;

  select.innerHTML = [
    '<option value="">Selecione um profissional</option>',
    ...state.barbers.map(barber => {
      const user  = barber.user || barber.users || {};
      const extra = barber.customPrice != null ? ` • preço personalizado ${formatCurrency(barber.customPrice)}` : '';
      return `<option value="${escapeHtml(barber.id)}">${escapeHtml(user.name || 'Profissional')}${escapeHtml(extra)}</option>`;
    }),
  ].join('');
  select.value = state.selectedBarberId || '';
}

function renderServiceMeta() {
  const container = document.getElementById('client-agendar-service-meta');
  if (!container) return;

  const service = getSelectedService();

  if (!service) {
    container.innerHTML = `
      <div class="cfg-row">
        <div><div class="cfg-label">Serviço</div><div class="cfg-sub">Selecione um serviço para ver duração, preço e cobertura do plano.</div></div>
        <span class="pill">Pendente</span>
      </div>`;
    return;
  }

  container.innerHTML = `
    <div class="cfg-row">
      <div><div class="cfg-label">Duração</div><div class="cfg-sub">${escapeHtml(formatDuration(service.duration_min))}</div></div>
      <span class="pill">Tempo</span>
    </div>
    <div class="cfg-row">
      <div><div class="cfg-label">Preço base</div><div class="cfg-sub">${escapeHtml(formatCurrency(service.price))}</div></div>
      <span class="pill">Preço</span>
    </div>
    <div class="cfg-row">
      <div>
        <div class="cfg-label">Plano</div>
        <div class="cfg-sub">
          ${service.includedInPlan
            ? `Incluído no plano${service.planRemainingQuantity != null ? ` • saldo ${service.planRemainingQuantity}` : ''}`
            : 'Cobrança avulsa'}
        </div>
      </div>
      <span class="pill">${service.includedInPlan ? 'Incluso' : 'Avulso'}</span>
    </div>`;
}

function renderSlots(slots = [], loading = false) {
  const container = document.getElementById('client-agendar-slots');
  if (!container) return;

  if (loading) {
    container.innerHTML = `<div class="cfg-row"><div><div class="cfg-label">Horários</div><div class="cfg-sub">Buscando horários disponíveis...</div></div><span class="pill">Carregando</span></div>`;
    return;
  }

  if (!state.selectedServiceId || !state.selectedBarberId || !state.selectedDate) {
    container.innerHTML = `<div class="cfg-row"><div><div class="cfg-label">Horários</div><div class="cfg-sub">Escolha serviço, profissional e data para liberar os horários.</div></div><span class="pill">Aguardando</span></div>`;
    return;
  }

  if (!slots.length) {
    container.innerHTML = `<div class="cfg-row"><div><div class="cfg-label">Horários</div><div class="cfg-sub">Nenhum horário disponível para esta combinação.</div></div><span class="pill">Sem vagas</span></div>`;
    return;
  }

  container.innerHTML = `
    <div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(140px,1fr));gap:10px;">
      ${slots.map(slot => {
        const active = state.selectedSlot === slot;
        const date   = new Date(slot);
        const label  = Number.isNaN(date.getTime()) ? slot : date.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
        return `
          <button type="button" class="client-slot-btn" data-slot-value="${escapeHtml(slot)}"
            style="min-height:46px;border-radius:12px;border:1px solid ${active ? 'rgba(79,195,247,.48)' : 'rgba(79,195,247,.18)'};background:${active ? 'rgba(79,195,247,.14)' : 'rgba(255,255,255,.04)'};color:${active ? '#7dd3fc' : '#dce8ff'};font:inherit;font-weight:700;cursor:pointer;">
            ${escapeHtml(label)}
          </button>`;
      }).join('')}
    </div>`;

  container.querySelectorAll('[data-slot-value]').forEach(button => {
    button.addEventListener('click', () => {
      state.selectedSlot = button.getAttribute('data-slot-value') || '';
      renderSlots(slots, false);
      renderSummary();
    });
  });
}

function renderSummary() {
  const container = document.getElementById('client-agendar-summary');
  if (!container) return;

  const service    = getSelectedService();
  const barber     = getSelectedBarber();
  const barberUser = barber?.user || barber?.users || {};
  const notes      = getNotesValue();

  const effectivePrice = service?.includedInPlan ? 0
    : barber?.customPrice != null ? Number(barber.customPrice)
    : Number(service?.price || 0);

  container.innerHTML = `
    <div class="cfg-row">
      <div><div class="cfg-label">Barbearia</div><div class="cfg-sub">${escapeHtml(state.context?.barbershop?.name || '—')}</div></div>
      <span class="pill">Local</span>
    </div>
    <div class="cfg-row">
      <div><div class="cfg-label">Serviço</div><div class="cfg-sub">${escapeHtml(service?.name || 'Selecione')}</div></div>
      <span class="pill">${escapeHtml(formatDuration(service?.duration_min || 0))}</span>
    </div>
    <div class="cfg-row">
      <div><div class="cfg-label">Profissional</div><div class="cfg-sub">${escapeHtml(barberUser?.name || 'Selecione')}</div></div>
      <span class="pill">Barbeiro</span>
    </div>
    <div class="cfg-row">
      <div><div class="cfg-label">Horário</div><div class="cfg-sub">${escapeHtml(formatDateTime(state.selectedSlot))}</div></div>
      <span class="pill">Reserva</span>
    </div>
    <div class="cfg-row">
      <div>
        <div class="cfg-label">Cobrança</div>
        <div class="cfg-sub">${service?.includedInPlan ? 'Incluído no plano' : `Cobrança avulsa • ${formatCurrency(effectivePrice)}`}</div>
      </div>
      <span class="pill">${service?.includedInPlan ? 'Plano' : 'Avulso'}</span>
    </div>
    <div class="cfg-row">
      <div><div class="cfg-label">Observação</div><div class="cfg-sub">${escapeHtml(notes || 'Nenhuma observação')}</div></div>
      <span class="pill">${escapeHtml(String(notes.length))}/280</span>
    </div>`;
}

function updateDateLimits() {
  const input = document.getElementById('client-agendar-date');
  const days  = Number(state.context?.barbershop?.booking_advance_days || 30);
  if (!input) return;

  const today   = new Date();
  const maxDate = new Date();
  maxDate.setDate(maxDate.getDate() + days);

  input.min = today.toISOString().slice(0, 10);
  input.max = maxDate.toISOString().slice(0, 10);
}

async function loadServices() {
  const payload = await getClientPortalServices();
  state.services = Array.isArray(payload?.items) ? payload.items : [];
  populateServices();
  renderServiceMeta();
  renderSummary();
}

async function loadBarbers() {
  state.barbers          = [];
  state.selectedBarberId = '';
  state.selectedSlot     = '';
  populateBarbers();
  renderSlots([], false);
  renderSummary();

  if (!state.selectedServiceId) return;

  const payload = await getClientPortalBarbers({ serviceId: state.selectedServiceId });
  state.barbers = Array.isArray(payload?.items) ? payload.items : [];
  populateBarbers();
  renderSummary();
}

async function loadSlots() {
  state.selectedSlot = '';
  renderSummary();
  renderSlots([], true);

  if (!state.selectedServiceId || !state.selectedBarberId || !state.selectedDate) {
    renderSlots([], false);
    return;
  }

  const payload = await getClientPortalAvailableSlots({
    serviceId: state.selectedServiceId,
    barberId:  state.selectedBarberId,
    date:      state.selectedDate,
  });

  renderSlots(Array.isArray(payload?.slots) ? payload.slots : [], false);
}

async function handleSubmit(navigate) {
  const service = getSelectedService();
  const barber  = getSelectedBarber();
  const notes   = getNotesValue();

  if (!service)              { setFeedback('Selecione um serviço.', 'error'); return; }
  if (!barber)               { setFeedback('Selecione um profissional.', 'error'); return; }
  if (!state.selectedDate)   { setFeedback('Selecione uma data.', 'error'); return; }
  if (!state.selectedSlot)   { setFeedback('Selecione um horário.', 'error'); return; }

  try {
    const submitBtn = document.getElementById('client-agendar-submit');
    if (submitBtn) submitBtn.disabled = true;

    setFeedback('Confirmando seu agendamento...', 'neutral');

    const response = await createClientPortalAppointment({
      serviceId:   state.selectedServiceId,
      barberId:    state.selectedBarberId,
      scheduledAt: state.selectedSlot,
      notes,
    });

    setFeedback(
      `Agendamento confirmado para ${formatDateTime(response?.appointment?.scheduled_at || state.selectedSlot)}.`,
      'success'
    );

    setTimeout(() => navigate('agendamentos'), 800);
  } catch (error) {
    setFeedback(error instanceof Error ? error.message : 'Não foi possível confirmar o agendamento.', 'error');
  } finally {
    const submitBtn = document.getElementById('client-agendar-submit');
    if (submitBtn) submitBtn.disabled = false;
  }
}

// ─── Render ───────────────────────────────────────────────────────────────────

export function renderClientAgendar() {
  return `
    <div id="pages" style="display:block">
      <div class="page active">
        <div style="display:grid;grid-template-columns:minmax(0,1.25fr) minmax(340px,.75fr);gap:18px;align-items:start;">
          <div class="card">
            <div class="card-header">
              <div class="card-title">Agendar horário</div>
              <div class="card-action" data-client-route="agendamentos">Ver meus agendamentos</div>
            </div>

            <div id="client-agendar-feedback" style="min-height:20px;margin-bottom:14px;color:#8fa3c7;"></div>

            <div style="display:grid;gap:14px;">
              <!-- Seletor de barbearia (aparece só se tiver múltiplas) -->
              <div id="client-agendar-barbershop-selector" style="display:grid;gap:10px;"></div>

              <div id="client-agendar-context" style="display:grid;gap:12px;"></div>

              <div style="display:grid;gap:8px;">
                <label style="font-size:12px;font-weight:700;color:#dbe7ff;">Serviço</label>
                <select id="client-agendar-service"
                  style="min-height:50px;border-radius:14px;border:1px solid rgba(79,195,247,.16);background:rgba(255,255,255,.04);color:#f5f9ff;padding:0 14px;font:inherit;"></select>
              </div>

              <div id="client-agendar-service-meta" style="display:grid;gap:12px;"></div>

              <div style="display:grid;grid-template-columns:1fr 1fr;gap:14px;">
                <div style="display:grid;gap:8px;">
                  <label style="font-size:12px;font-weight:700;color:#dbe7ff;">Profissional</label>
                  <select id="client-agendar-barber"
                    style="min-height:50px;border-radius:14px;border:1px solid rgba(79,195,247,.16);background:rgba(255,255,255,.04);color:#f5f9ff;padding:0 14px;font:inherit;"></select>
                </div>
                <div style="display:grid;gap:8px;">
                  <label style="font-size:12px;font-weight:700;color:#dbe7ff;">Data</label>
                  <input id="client-agendar-date" type="date"
                    style="min-height:50px;border-radius:14px;border:1px solid rgba(79,195,247,.16);background:rgba(255,255,255,.04);color:#f5f9ff;padding:0 14px;font:inherit;"/>
                </div>
              </div>

              <div style="display:grid;gap:8px;">
                <label style="font-size:12px;font-weight:700;color:#dbe7ff;">Horários disponíveis</label>
                <div id="client-agendar-slots" style="display:grid;gap:12px;"></div>
              </div>

              <div style="display:grid;gap:8px;">
                <label style="font-size:12px;font-weight:700;color:#dbe7ff;">Observação curta</label>
                <textarea id="client-agendar-notes" maxlength="280" placeholder="Ex.: quero degradê mais baixo"
                  style="min-height:92px;border-radius:14px;border:1px solid rgba(79,195,247,.16);background:rgba(255,255,255,.04);color:#f5f9ff;padding:14px;font:inherit;resize:vertical;"></textarea>
              </div>

              <div style="display:flex;gap:12px;flex-wrap:wrap;">
                <button id="client-agendar-submit" type="button"
                  style="min-height:50px;padding:0 18px;border-radius:14px;border:0;background:linear-gradient(135deg,#5dc8ff 0%,#2f8cff 55%,#1468ff 100%);color:#fff;font:inherit;font-weight:800;cursor:pointer;">
                  Confirmar reserva
                </button>
                <button type="button" data-client-route="home"
                  style="min-height:50px;padding:0 18px;border-radius:14px;border:1px solid rgba(79,195,247,.16);background:rgba(255,255,255,.04);color:#dce8ff;font:inherit;font-weight:700;cursor:pointer;">
                  Voltar
                </button>
              </div>
            </div>
          </div>

          <div class="card">
            <div class="card-header">
              <div class="card-title">Resumo da reserva</div>
            </div>
            <div id="client-agendar-summary" style="display:grid;gap:12px;"></div>
          </div>
        </div>
      </div>
    </div>
  `;
}

// ─── Init ─────────────────────────────────────────────────────────────────────

export function initClientAgendarPage({ navigate }) {
  const serviceSelect = document.getElementById('client-agendar-service');
  const barberSelect  = document.getElementById('client-agendar-barber');
  const dateInput     = document.getElementById('client-agendar-date');
  const notesInput    = document.getElementById('client-agendar-notes');
  const submitBtn     = document.getElementById('client-agendar-submit');

  (async () => {
    try {
      setFeedback('Carregando agenda...', 'neutral');

      const context = await getClientPortalContext();
      state.context = context || null;

      // Carrega barbearias vinculadas do perfil local
      const profile = getClientProfile();
      state.linkedBarbershops = Array.isArray(profile?.barbershops) ? profile.barbershops : [];

      renderBarbershopSelector();
      renderContextBlock();
      updateDateLimits();
      await loadServices();
      renderSlots([], false);

      setFeedback('Escolha serviço, profissional, data e horário.', 'neutral');
    } catch (error) {
      setFeedback(error instanceof Error ? error.message : 'Não foi possível carregar a agenda.', 'error');
    }
  })();

  serviceSelect?.addEventListener('change', async event => {
    state.selectedServiceId = event.target.value || '';
    state.selectedBarberId  = '';
    state.selectedDate      = '';
    state.selectedSlot      = '';
    if (dateInput) dateInput.value = '';

    renderServiceMeta();
    renderSummary();

    try {
      if (!state.selectedServiceId) {
        state.barbers = [];
        populateBarbers();
        renderSlots([], false);
        return;
      }
      setFeedback('Carregando profissionais...', 'neutral');
      await loadBarbers();
      setFeedback('Agora escolha o profissional e a data.', 'neutral');
    } catch (error) {
      setFeedback(error instanceof Error ? error.message : 'Não foi possível carregar os profissionais.', 'error');
    }
  });

  barberSelect?.addEventListener('change', async event => {
    state.selectedBarberId = event.target.value || '';
    state.selectedSlot     = '';
    renderSummary();
    try {
      await loadSlots();
      setFeedback('Selecione um horário disponível.', 'neutral');
    } catch (error) {
      setFeedback(error instanceof Error ? error.message : 'Não foi possível carregar os horários.', 'error');
    }
  });

  dateInput?.addEventListener('change', async event => {
    state.selectedDate = event.target.value || '';
    state.selectedSlot = '';
    renderSummary();
    try {
      await loadSlots();
      setFeedback('Selecione um horário disponível.', 'neutral');
    } catch (error) {
      setFeedback(error instanceof Error ? error.message : 'Não foi possível carregar os horários.', 'error');
    }
  });

  notesInput?.addEventListener('input', () => renderSummary());
  submitBtn?.addEventListener('click', () => handleSubmit(navigate));
}
