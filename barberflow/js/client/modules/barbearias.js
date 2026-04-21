import {
  getClientPortalContext,
  getClientProfile,
  logoutClient,
} from '../../services/client-auth.js';

const state = {
  context: null,
  profile: null,
};

function escapeHtml(value) {
  return String(value ?? '')
    .replace(/&/g, '&amp;').replace(/</g, '&lt;')
    .replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#039;');
}

function setFeedback(message, variant = 'neutral') {
  const el = document.getElementById('client-barbearias-feedback');
  if (!el) return;
  el.textContent = message || '';
  el.style.color = variant === 'error' ? '#ff7b91' : variant === 'success' ? '#00e676' : '#8fa3c7';
}

function renderHeader() {
  const container = document.getElementById('client-barbearias-header');
  if (!container) return;

  const profile  = state.profile || {};
  const shops    = Array.isArray(profile?.barbershops) ? profile.barbershops : [];
  const current  = state.context?.barbershop || {};

  container.innerHTML = `
    <div class="metric-card">
      <div class="metric-label">Barbearia atual</div>
      <div class="metric-value" style="font-size:16px;">${escapeHtml(current.name || '—')}</div>
      <div class="metric-sub color-nt">Sessão ativa</div>
    </div>
    <div class="metric-card">
      <div class="metric-label">Vinculadas</div>
      <div class="metric-value">${escapeHtml(String(shops.length || 1))}</div>
      <div class="metric-sub color-nt">Barbearias na sua conta</div>
    </div>
    <div class="metric-card">
      <div class="metric-label">Conta</div>
      <div class="metric-value" style="font-size:14px;">${escapeHtml(profile?.name || 'Cliente')}</div>
      <div class="metric-sub color-nt">Login único para todas</div>
    </div>
  `;
}

function renderCurrentBarbershop() {
  const container = document.getElementById('client-barbearias-current');
  if (!container) return;

  const barbershop = state.context?.barbershop || {};
  const address = [barbershop.address, barbershop.city, barbershop.state]
    .filter(Boolean).join(', ');

  const phone = barbershop.whatsapp || barbershop.phone || '';
  const digits = phone.replace(/\D/g, '');
  const waUrl  = digits ? `https://wa.me/${digits.startsWith('55') ? digits : '55' + digits}` : null;

  container.innerHTML = `
    <div style="border:1px solid rgba(0,230,118,.20);border-radius:18px;background:rgba(0,230,118,.04);padding:18px;display:grid;gap:12px;">
      <div style="display:flex;justify-content:space-between;align-items:flex-start;gap:12px;flex-wrap:wrap;">
        <div>
          <div style="font-size:18px;font-weight:800;color:#fff;">${escapeHtml(barbershop.name || 'Barbearia')}</div>
          <div style="margin-top:4px;color:#8fa3c7;">${escapeHtml(address || 'Endereço não informado')}</div>
        </div>
        <span style="padding:6px 12px;border-radius:999px;font-size:12px;font-weight:800;background:rgba(0,230,118,.12);color:#00e676;border:1px solid rgba(0,230,118,.20);">
          ● Sessão ativa
        </span>
      </div>

      ${barbershop.cancellation_hours != null ? `
      <div class="cfg-row">
        <div>
          <div class="cfg-label">Cancelamento</div>
          <div class="cfg-sub">Mínimo de ${escapeHtml(String(barbershop.cancellation_hours))} hora(s) de antecedência</div>
        </div>
        <span class="pill">Regra</span>
      </div>` : ''}

      ${barbershop.booking_advance_days != null ? `
      <div class="cfg-row">
        <div>
          <div class="cfg-label">Agendamento antecipado</div>
          <div class="cfg-sub">Até ${escapeHtml(String(barbershop.booking_advance_days))} dia(s) de antecedência</div>
        </div>
        <span class="pill">Agenda</span>
      </div>` : ''}

      ${waUrl ? `
      <div class="cfg-row">
        <div>
          <div class="cfg-label">WhatsApp</div>
          <div class="cfg-sub">${escapeHtml(phone)}</div>
        </div>
        <a href="${escapeHtml(waUrl)}" target="_blank" rel="noopener"
          style="padding:8px 14px;border-radius:10px;background:rgba(0,230,118,.12);color:#00e676;font-weight:800;font-size:12px;text-decoration:none;flex-shrink:0;">
          Abrir WhatsApp
        </a>
      </div>` : ''}
    </div>
  `;
}

function renderOtherBarbershops() {
  const container = document.getElementById('client-barbearias-others');
  if (!container) return;

  const profile  = state.profile || {};
  const shops    = Array.isArray(profile?.barbershops) ? profile.barbershops : [];
  const currentId = state.context?.barbershop?.id;

  // Filtra a barbearia atual
  const others = shops.filter(s => s?.id !== currentId && s?.id !== undefined);

  if (!others.length) {
    container.innerHTML = `
      <div class="cfg-row">
        <div>
          <div class="cfg-label">Nenhuma outra barbearia vinculada</div>
          <div class="cfg-sub">
            Quando você fizer login em outra barbearia parceira com a mesma conta,
            ela aparecerá aqui. Cada barbearia tem sua própria agenda, planos e histórico.
          </div>
        </div>
        <span class="pill">Em breve</span>
      </div>
    `;
    return;
  }

  container.innerHTML = `
    <div style="display:grid;gap:12px;">
      ${others.map(shop => `
        <div style="border:1px solid rgba(79,195,247,.12);border-radius:16px;background:rgba(255,255,255,.03);padding:16px;display:flex;justify-content:space-between;align-items:center;gap:12px;flex-wrap:wrap;">
          <div>
            <div style="font-size:15px;font-weight:800;color:#fff;">${escapeHtml(shop?.name || 'Barbearia')}</div>
            <div style="margin-top:4px;color:#8fa3c7;">${escapeHtml(shop?.city || 'Barbearia parceira')}</div>
          </div>
          <button type="button"
            data-switch-barbershop-slug="${escapeHtml(shop?.slug || '')}"
            style="min-height:40px;padding:0 14px;border-radius:10px;border:1px solid rgba(79,195,247,.20);background:rgba(79,195,247,.08);color:#7dd3fc;font:inherit;font-weight:800;cursor:pointer;flex-shrink:0;">
            Trocar para esta
          </button>
        </div>
      `).join('')}
    </div>
  `;

  container.querySelectorAll('[data-switch-barbershop-slug]').forEach(btn => {
    btn.addEventListener('click', () => {
      const slug = btn.getAttribute('data-switch-barbershop-slug');
      if (!slug) return;
      handleSwitchBarbershop(slug);
    });
  });
}

function handleSwitchBarbershop(slug) {
  const confirmed = window.confirm(
    'Para trocar de barbearia você precisará fazer login novamente com o slug desta barbearia. Deseja continuar?'
  );
  if (!confirmed) return;

  // Limpa sessão atual e redireciona para login com slug da nova barbearia
  logoutClient();
  const loginUrl = `/client/${encodeURIComponent(slug)}/login`;
  window.location.href = loginUrl;
}

export function renderClientBarbearias() {
  return `
    <div id="pages" style="display:block">
      <div class="page active">
        <div style="display:grid;gap:18px;">

          <div class="card">
            <div class="card-header">
              <div class="card-title">Minhas barbearias</div>
              <div class="card-action" data-client-route="home">Voltar ao início</div>
            </div>
            <div id="client-barbearias-feedback" style="min-height:20px;margin-bottom:4px;color:#8fa3c7;"></div>
            <div id="client-barbearias-header" class="grid-3"></div>
          </div>

          <div class="card">
            <div class="card-header">
              <div class="card-title">Barbearia atual</div>
            </div>
            <div id="client-barbearias-current"></div>
          </div>

          <div class="card">
            <div class="card-header">
              <div class="card-title">Outras barbearias vinculadas</div>
            </div>
            <div class="cfg-row" style="margin-bottom:8px;">
              <div>
                <div class="cfg-label">Como funciona</div>
                <div class="cfg-sub">
                  Sua conta é única. Cada barbearia tem seu próprio contexto de agenda,
                  planos e histórico. Para trocar, você faz login com o endereço da barbearia desejada.
                </div>
              </div>
              <span class="pill">Conta única</span>
            </div>
            <div id="client-barbearias-others"></div>
          </div>

        </div>
      </div>
    </div>
  `;
}

export function initClientBarbeariasPage() {
  (async () => {
    try {
      setFeedback('Carregando suas barbearias...', 'neutral');

      const [context] = await Promise.all([
        getClientPortalContext(),
      ]);

      state.context = context || null;
      state.profile = getClientProfile();

      renderHeader();
      renderCurrentBarbershop();
      renderOtherBarbershops();

      setFeedback('', 'neutral');
    } catch (error) {
      setFeedback(
        error instanceof Error ? error.message : 'Não foi possível carregar as barbearias.',
        'error'
      );
    }
  })();
}
