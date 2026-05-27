import {
  getClientPortalContext,
  getClientProfile,
  logoutClient,
} from '../../services/client-auth.js';

const SLUG_KEY = 'barberflow.inviteSlug';

const state = {
  context: null,
  profile: null,
};

function escapeHtml(value) {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

function setFeedback(message, variant = 'neutral') {
  const el = document.getElementById('client-barbearias-feedback');

  if (!el) return;

  el.textContent = message || '';
  el.style.color =
    variant === 'error'
      ? '#ff7b91'
      : variant === 'success'
        ? '#00e676'
        : '#8fa3c7';
}

function getLinkedShops() {
  const profileShops = Array.isArray(state.profile?.barbershops)
    ? state.profile.barbershops
    : [];

  const contextShop = state.context?.barbershop;

  if (!profileShops.length && contextShop) {
    return [
      {
        ...contextShop,
        is_selected: true,
        is_active: true,
      },
    ];
  }

  return profileShops;
}

function getCurrentShop() {
  const shops = getLinkedShops();

  return (
    shops.find((shop) => shop?.is_selected === true) ||
    shops.find((shop) => shop?.id && shop.id === state.context?.barbershop?.id) ||
    state.context?.barbershop ||
    shops.find((shop) => shop?.is_active === true) ||
    shops[0] ||
    null
  );
}

function buildAddress(shop) {
  return [
    shop?.address,
    shop?.number,
    shop?.neighborhood,
    shop?.city,
    shop?.state,
  ]
    .filter(Boolean)
    .join(', ');
}

function phoneDigits(value) {
  return String(value || '').replace(/\D/g, '');
}

function buildWhatsAppUrl(value) {
  const digits = phoneDigits(value);

  if (!digits) return '';

  const finalDigits = digits.startsWith('55') ? digits : `55${digits}`;

  return `https://wa.me/${finalDigits}`;
}

function buildMapsUrl(shop) {
  const address = buildAddress(shop);

  if (!address) return '';

  return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(address)}`;
}

function saveInviteSlug(slug) {
  try {
    sessionStorage.setItem(SLUG_KEY, String(slug || '').trim().toLowerCase());
  } catch {
    // noop
  }
}

function switchToBarbershop(slug, name) {
  if (!slug) {
    setFeedback('Esta barbearia não possui slug de acesso configurado.', 'error');
    return;
  }

  const confirmed = window.confirm(
    `Para trocar para ${name || 'esta barbearia'}, você precisará fazer login novamente. Deseja continuar?`
  );

  if (!confirmed) return;

  saveInviteSlug(slug);
  logoutClient();

  window.location.href = '/client/login';
}

function statusLabel(shop) {
  if (shop?.is_selected) return 'Sessão atual';
  if (shop?.is_active === false) return 'Inativa';
  return 'Vinculada';
}

function statusColor(shop) {
  if (shop?.is_selected) return '#00e676';
  if (shop?.is_active === false) return '#ff8a80';
  return '#7dd3fc';
}

function renderHeader() {
  const container = document.getElementById('client-barbearias-header');

  if (!container) return;

  const shops = getLinkedShops();
  const current = getCurrentShop();

  container.innerHTML = `
    <div class="metric-card">
      <div class="metric-label">Barbearia atual</div>
      <div class="metric-value" style="font-size:16px;">
        ${escapeHtml(current?.name || 'Nenhuma selecionada')}
      </div>
      <div class="metric-sub color-nt">Sessão ativa</div>
    </div>

    <div class="metric-card">
      <div class="metric-label">Vinculadas</div>
      <div class="metric-value">${escapeHtml(String(shops.length || 0))}</div>
      <div class="metric-sub color-nt">Na sua conta</div>
    </div>

    <div class="metric-card">
      <div class="metric-label">Cliente</div>
      <div class="metric-value" style="font-size:14px;">
        ${escapeHtml(state.profile?.name || 'Cliente')}
      </div>
      <div class="metric-sub color-nt">Login único</div>
    </div>
  `;
}

function renderCurrentBarbershop() {
  const container = document.getElementById('client-barbearias-current');

  if (!container) return;

  const shop = getCurrentShop();

  if (!shop) {
    container.innerHTML = `
      <div class="cfg-row">
        <div>
          <div class="cfg-label">Nenhuma barbearia selecionada</div>
          <div class="cfg-sub">Faça login novamente usando o link enviado pela barbearia.</div>
        </div>
        <span class="pill">Sem sessão</span>
      </div>
    `;
    return;
  }

  const address = buildAddress(shop);
  const phone = shop?.whatsapp || shop?.phone || '';
  const waUrl = buildWhatsAppUrl(phone);
  const mapsUrl = buildMapsUrl(shop);

  container.innerHTML = `
    <div style="border:1px solid rgba(0,230,118,.20);border-radius:18px;background:rgba(0,230,118,.04);padding:18px;display:grid;gap:12px;">
      <div style="display:flex;justify-content:space-between;align-items:flex-start;gap:12px;flex-wrap:wrap;">
        <div style="min-width:0;">
          <div style="font-size:18px;font-weight:800;color:#fff;overflow-wrap:anywhere;">
            ${escapeHtml(shop.name || 'Barbearia')}
          </div>
          <div style="margin-top:4px;color:#8fa3c7;overflow-wrap:anywhere;">
            ${escapeHtml(address || 'Endereço não informado')}
          </div>
        </div>

        <span style="padding:6px 12px;border-radius:999px;font-size:12px;font-weight:800;background:rgba(0,230,118,.12);color:#00e676;border:1px solid rgba(0,230,118,.20);">
          ● Sessão atual
        </span>
      </div>

      ${
        shop?.cancellation_hours != null
          ? `
            <div class="cfg-row">
              <div>
                <div class="cfg-label">Cancelamento</div>
                <div class="cfg-sub">Mínimo de ${escapeHtml(String(shop.cancellation_hours))} hora(s) de antecedência.</div>
              </div>
              <span class="pill">Regra</span>
            </div>
          `
          : ''
      }

      ${
        shop?.booking_advance_days != null
          ? `
            <div class="cfg-row">
              <div>
                <div class="cfg-label">Agendamento antecipado</div>
                <div class="cfg-sub">Até ${escapeHtml(String(shop.booking_advance_days))} dia(s) de antecedência.</div>
              </div>
              <span class="pill">Agenda</span>
            </div>
          `
          : ''
      }

      ${
        phone
          ? `
            <div class="cfg-row">
              <div>
                <div class="cfg-label">Contato</div>
                <div class="cfg-sub">${escapeHtml(phone)}</div>
              </div>
              ${
                waUrl
                  ? `<a class="pill" href="${escapeHtml(waUrl)}" target="_blank" rel="noopener noreferrer" style="text-decoration:none;">WhatsApp</a>`
                  : '<span class="pill">Contato</span>'
              }
            </div>
          `
          : ''
      }

      ${
        mapsUrl
          ? `
            <div style="display:flex;justify-content:flex-end;gap:10px;flex-wrap:wrap;">
              <a
                href="${escapeHtml(mapsUrl)}"
                target="_blank"
                rel="noopener noreferrer"
                style="
                  min-height:42px;
                  padding:0 14px;
                  border-radius:12px;
                  border:1px solid rgba(79,195,247,.20);
                  background:rgba(79,195,247,.08);
                  color:#7dd3fc;
                  font:inherit;
                  font-weight:800;
                  text-decoration:none;
                  display:inline-flex;
                  align-items:center;
                "
              >
                Ver localização
              </a>
            </div>
          `
          : ''
      }
    </div>
  `;
}

function renderLinkedBarbershops() {
  const container = document.getElementById('client-barbearias-list');

  if (!container) return;

  const shops = getLinkedShops();

  if (!shops.length) {
    container.innerHTML = `
      <div class="cfg-row">
        <div>
          <div class="cfg-label">Nenhuma barbearia vinculada</div>
          <div class="cfg-sub">Use o link de cadastro enviado por uma barbearia para criar ou vincular sua conta.</div>
        </div>
        <span class="pill">Vazio</span>
      </div>
    `;
    return;
  }

  container.innerHTML = `
    <div style="display:grid;gap:12px;">
      ${shops.map((shop) => {
        const address = [shop?.city, shop?.state].filter(Boolean).join(' / ');
        const isSelected = shop?.is_selected === true;
        const color = statusColor(shop);

        return `
          <div
            style="
              border:1px solid ${isSelected ? 'rgba(0,230,118,.22)' : 'rgba(79,195,247,.12)'};
              border-radius:16px;
              background:${isSelected ? 'rgba(0,230,118,.04)' : 'rgba(255,255,255,.03)'};
              padding:16px;
              display:flex;
              justify-content:space-between;
              align-items:center;
              gap:12px;
              flex-wrap:wrap;
            "
          >
            <div style="min-width:0;">
              <div style="font-size:15px;font-weight:800;color:#fff;overflow-wrap:anywhere;">
                ${escapeHtml(shop?.name || 'Barbearia')}
              </div>
              <div style="margin-top:4px;color:#8fa3c7;overflow-wrap:anywhere;">
                ${escapeHtml(address || shop?.slug || 'Barbearia parceira')}
              </div>
              <div style="margin-top:6px;font-size:12px;color:${color};font-weight:800;">
                ${escapeHtml(statusLabel(shop))}
              </div>
            </div>

            ${
              isSelected
                ? `
                  <span class="pill" style="color:#00e676;background:rgba(0,230,118,.10);">
                    Atual
                  </span>
                `
                : `
                  <button
                    type="button"
                    data-switch-barbershop-slug="${escapeHtml(shop?.slug || '')}"
                    data-switch-barbershop-name="${escapeHtml(shop?.name || 'Barbearia')}"
                    style="
                      min-height:40px;
                      padding:0 14px;
                      border-radius:10px;
                      border:1px solid rgba(79,195,247,.20);
                      background:rgba(79,195,247,.08);
                      color:#7dd3fc;
                      font:inherit;
                      font-weight:800;
                      cursor:pointer;
                      flex-shrink:0;
                    "
                  >
                    Trocar para esta
                  </button>
                `
            }
          </div>
        `;
      }).join('')}
    </div>
  `;

  container.querySelectorAll('[data-switch-barbershop-slug]').forEach((button) => {
    button.addEventListener('click', () => {
      const slug = button.getAttribute('data-switch-barbershop-slug') || '';
      const name = button.getAttribute('data-switch-barbershop-name') || 'Barbearia';

      switchToBarbershop(slug, name);
    });
  });
}

function renderHowItWorks() {
  const container = document.getElementById('client-barbearias-help');

  if (!container) return;

  container.innerHTML = `
    <div style="display:grid;gap:12px;">
      <div class="cfg-row">
        <div>
          <div class="cfg-label">Como funciona</div>
          <div class="cfg-sub">Você usa uma conta de cliente, mas cada barbearia mantém agenda, planos e histórico separados.</div>
        </div>
        <span class="pill">Seguro</span>
      </div>

      <div class="cfg-row">
        <div>
          <div class="cfg-label">Troca de barbearia</div>
          <div class="cfg-sub">Ao trocar, o sistema pede novo login para garantir que os dados da sessão apontem para a barbearia correta.</div>
        </div>
        <span class="pill">Sessão</span>
      </div>

      <div class="cfg-row">
        <div>
          <div class="cfg-label">Planos e pagamentos</div>
          <div class="cfg-sub">Assinaturas, créditos e cobranças são exibidos apenas para a barbearia da sessão atual.</div>
        </div>
        <span class="pill">Plano</span>
      </div>
    </div>
  `;
}

async function loadBarbershops() {
  const [context, profile] = await Promise.all([
    getClientPortalContext(),
    Promise.resolve(getClientProfile()),
  ]);

  state.context = context || null;
  state.profile = profile || null;

  renderHeader();
  renderCurrentBarbershop();
  renderLinkedBarbershops();
  renderHowItWorks();
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

            <div id="client-barbearias-feedback" style="min-height:20px;margin-bottom:14px;color:#8fa3c7;"></div>
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
              <div class="card-title">Barbearias vinculadas</div>
            </div>

            <div id="client-barbearias-list"></div>
          </div>

          <div class="card">
            <div class="card-header">
              <div class="card-title">Entenda sua conta</div>
            </div>

            <div id="client-barbearias-help"></div>
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
      await loadBarbershops();
      setFeedback('', 'neutral');
    } catch (error) {
      setFeedback(
        error instanceof Error ? error.message : 'Não foi possível carregar suas barbearias.',
        'error'
      );
    }
  })();
}
