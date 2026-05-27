import {
  getClientPortalContext,
  getClientProfile,
} from '../../services/client-auth.js';

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
  const el = document.getElementById('client-suporte-feedback');

  if (!el) return;

  el.textContent = message || '';
  el.style.color =
    variant === 'error'
      ? '#ff7b91'
      : variant === 'success'
        ? '#00e676'
        : '#8fa3c7';
}

function phoneDigits(value) {
  return String(value || '').replace(/\D/g, '');
}

function buildWhatsAppUrl(value, message = '') {
  const digits = phoneDigits(value);

  if (!digits) return '';

  const finalDigits = digits.startsWith('55') ? digits : `55${digits}`;
  const encodedMessage = message ? `?text=${encodeURIComponent(message)}` : '';

  return `https://wa.me/${finalDigits}${encodedMessage}`;
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

function buildMapsUrl(shop) {
  const address = buildAddress(shop);

  if (!address) return '';

  return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(address)}`;
}

function getShop() {
  return state.context?.barbershop || {};
}

function getClientName() {
  return state.profile?.name || state.context?.client?.name || 'Cliente';
}

function getSupportMessage() {
  const shop = getShop();
  const clientName = getClientName();

  return `Olá! Sou ${clientName} e preciso de ajuda no portal da ${shop?.name || 'barbearia'}.`;
}

function renderHeader() {
  const container = document.getElementById('client-suporte-header');

  if (!container) return;

  const shop = getShop();
  const phone = shop?.whatsapp || shop?.phone || '';
  const address = buildAddress(shop);

  container.innerHTML = `
    <div class="metric-card">
      <div class="metric-label">Barbearia</div>
      <div class="metric-value" style="font-size:16px;">
        ${escapeHtml(shop?.name || 'Barbearia')}
      </div>
      <div class="metric-sub color-nt">Atendimento da sessão atual</div>
    </div>

    <div class="metric-card">
      <div class="metric-label">Contato</div>
      <div class="metric-value" style="font-size:16px;">
        ${escapeHtml(phone || 'Não informado')}
      </div>
      <div class="metric-sub color-nt">WhatsApp / telefone</div>
    </div>

    <div class="metric-card">
      <div class="metric-label">Localização</div>
      <div class="metric-value" style="font-size:14px;">
        ${escapeHtml(address || 'Não informado')}
      </div>
      <div class="metric-sub color-nt">Endereço da barbearia</div>
    </div>
  `;
}

function renderQuickActions() {
  const container = document.getElementById('client-suporte-actions');

  if (!container) return;

  const shop = getShop();
  const phone = shop?.whatsapp || shop?.phone || '';
  const email = shop?.email || shop?.contact_email || '';
  const waUrl = buildWhatsAppUrl(phone, getSupportMessage());
  const mapsUrl = buildMapsUrl(shop);

  container.innerHTML = `
    <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(220px,1fr));gap:14px;">
      <div style="border:1px solid rgba(79,195,247,.12);border-radius:18px;background:rgba(255,255,255,.03);padding:16px;display:grid;gap:12px;">
        <div>
          <div style="font-size:16px;font-weight:800;color:#fff;">Falar no WhatsApp</div>
          <div style="margin-top:4px;color:#8fa3c7;font-size:13px;line-height:1.5;">
            Tire dúvidas sobre horários, cancelamentos e atendimento.
          </div>
        </div>

        ${
          waUrl
            ? `
              <a
                href="${escapeHtml(waUrl)}"
                target="_blank"
                rel="noopener noreferrer"
                style="
                  min-height:42px;
                  padding:0 14px;
                  border-radius:12px;
                  border:0;
                  background:linear-gradient(135deg,#00e676,#10b981);
                  color:#06120b;
                  font:inherit;
                  font-weight:900;
                  text-decoration:none;
                  display:inline-flex;
                  align-items:center;
                  justify-content:center;
                "
              >
                Abrir WhatsApp
              </a>
            `
            : `
              <button
                type="button"
                disabled
                style="
                  min-height:42px;
                  padding:0 14px;
                  border-radius:12px;
                  border:1px solid rgba(255,255,255,.10);
                  background:rgba(255,255,255,.04);
                  color:#6b7280;
                  font:inherit;
                  font-weight:800;
                  cursor:not-allowed;
                "
              >
                WhatsApp não informado
              </button>
            `
        }
      </div>

      <div style="border:1px solid rgba(79,195,247,.12);border-radius:18px;background:rgba(255,255,255,.03);padding:16px;display:grid;gap:12px;">
        <div>
          <div style="font-size:16px;font-weight:800;color:#fff;">Enviar e-mail</div>
          <div style="margin-top:4px;color:#8fa3c7;font-size:13px;line-height:1.5;">
            Use quando precisar registrar uma solicitação com mais detalhes.
          </div>
        </div>

        ${
          email
            ? `
              <a
                href="mailto:${escapeHtml(email)}?subject=${encodeURIComponent('Suporte portal cliente')}&body=${encodeURIComponent(getSupportMessage())}"
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
                  justify-content:center;
                "
              >
                Enviar e-mail
              </a>
            `
            : `
              <button
                type="button"
                disabled
                style="
                  min-height:42px;
                  padding:0 14px;
                  border-radius:12px;
                  border:1px solid rgba(255,255,255,.10);
                  background:rgba(255,255,255,.04);
                  color:#6b7280;
                  font:inherit;
                  font-weight:800;
                  cursor:not-allowed;
                "
              >
                E-mail não informado
              </button>
            `
        }
      </div>

      <div style="border:1px solid rgba(79,195,247,.12);border-radius:18px;background:rgba(255,255,255,.03);padding:16px;display:grid;gap:12px;">
        <div>
          <div style="font-size:16px;font-weight:800;color:#fff;">Ver localização</div>
          <div style="margin-top:4px;color:#8fa3c7;font-size:13px;line-height:1.5;">
            Confira o endereço antes do atendimento.
          </div>
        </div>

        ${
          mapsUrl
            ? `
              <a
                href="${escapeHtml(mapsUrl)}"
                target="_blank"
                rel="noopener noreferrer"
                style="
                  min-height:42px;
                  padding:0 14px;
                  border-radius:12px;
                  border:1px solid rgba(156,111,255,.22);
                  background:rgba(156,111,255,.08);
                  color:#d8b4fe;
                  font:inherit;
                  font-weight:800;
                  text-decoration:none;
                  display:inline-flex;
                  align-items:center;
                  justify-content:center;
                "
              >
                Abrir mapa
              </a>
            `
            : `
              <button
                type="button"
                disabled
                style="
                  min-height:42px;
                  padding:0 14px;
                  border-radius:12px;
                  border:1px solid rgba(255,255,255,.10);
                  background:rgba(255,255,255,.04);
                  color:#6b7280;
                  font:inherit;
                  font-weight:800;
                  cursor:not-allowed;
                "
              >
                Endereço não informado
              </button>
            `
        }
      </div>
    </div>
  `;
}

function renderGuides() {
  const container = document.getElementById('client-suporte-guides');

  if (!container) return;

  const cancellationHours =
    getShop()?.cancellation_hours ??
    getShop()?.min_cancel_hours ??
    null;

  container.innerHTML = `
    <div style="display:grid;gap:12px;">
      <div class="cfg-row">
        <div>
          <div class="cfg-label">Agendar horário</div>
          <div class="cfg-sub">Acesse Agendar, escolha serviço, profissional, data e confirme sua reserva.</div>
        </div>
        <span class="pill">Agenda</span>
      </div>

      <div class="cfg-row">
        <div>
          <div class="cfg-label">Cancelar agendamento</div>
          <div class="cfg-sub">
            ${
              cancellationHours != null
                ? `Cancelamento permitido respeitando mínimo de ${escapeHtml(String(cancellationHours))}h de antecedência.`
                : 'Use Meus agendamentos para cancelar, respeitando as regras da barbearia.'
            }
          </div>
        </div>
        <span class="pill">Regra</span>
      </div>

      <div class="cfg-row">
        <div>
          <div class="cfg-label">Plano e créditos</div>
          <div class="cfg-sub">Acesse Meu Plano para acompanhar status, créditos disponíveis e histórico de cobranças.</div>
        </div>
        <span class="pill">Assinatura</span>
      </div>

      <div class="cfg-row">
        <div>
          <div class="cfg-label">Dados da conta</div>
          <div class="cfg-sub">Em Meus Dados você pode atualizar telefone e senha. O e-mail fica protegido por segurança.</div>
        </div>
        <span class="pill">Conta</span>
      </div>
    </div>
  `;
}

function renderFaq() {
  const container = document.getElementById('client-suporte-faq');

  if (!container) return;

  container.innerHTML = `
    <div style="display:grid;gap:12px;">
      <details style="border:1px solid rgba(79,195,247,.12);border-radius:14px;background:rgba(255,255,255,.03);padding:14px;">
        <summary style="cursor:pointer;font-weight:800;color:#fff;">Meu plano não apareceu como ativo. O que faço?</summary>
        <div style="margin-top:10px;color:#8fa3c7;line-height:1.6;font-size:14px;">
          A confirmação pode levar alguns instantes após o pagamento. Acesse Meu Plano e toque em Atualizar status. Se continuar pendente, fale com a barbearia.
        </div>
      </details>

      <details style="border:1px solid rgba(79,195,247,.12);border-radius:14px;background:rgba(255,255,255,.03);padding:14px;">
        <summary style="cursor:pointer;font-weight:800;color:#fff;">Consigo usar a mesma conta em mais de uma barbearia?</summary>
        <div style="margin-top:10px;color:#8fa3c7;line-height:1.6;font-size:14px;">
          Sim. Sua conta pode ter vínculos com mais de uma barbearia. Cada sessão carrega agenda, planos e histórico da barbearia selecionada.
        </div>
      </details>

      <details style="border:1px solid rgba(79,195,247,.12);border-radius:14px;background:rgba(255,255,255,.03);padding:14px;">
        <summary style="cursor:pointer;font-weight:800;color:#fff;">Meu atendimento foi coberto pelo plano?</summary>
        <div style="margin-top:10px;color:#8fa3c7;line-height:1.6;font-size:14px;">
          Em Meus Agendamentos, os atendimentos vinculados à assinatura aparecem como Coberto por plano. O abatimento final acontece no fechamento do atendimento pela barbearia.
        </div>
      </details>

      <details style="border:1px solid rgba(79,195,247,.12);border-radius:14px;background:rgba(255,255,255,.03);padding:14px;">
        <summary style="cursor:pointer;font-weight:800;color:#fff;">Preciso alterar meu e-mail?</summary>
        <div style="margin-top:10px;color:#8fa3c7;line-height:1.6;font-size:14px;">
          Por segurança, o e-mail fica protegido no portal. Entre em contato com a barbearia para solicitar orientação.
        </div>
      </details>
    </div>
  `;
}

async function loadSupport() {
  const [context, profile] = await Promise.all([
    getClientPortalContext(),
    Promise.resolve(getClientProfile()),
  ]);

  state.context = context || null;
  state.profile = profile || null;

  renderHeader();
  renderQuickActions();
  renderGuides();
  renderFaq();
}

export function renderClientSuporte() {
  return `
    <div id="pages" style="display:block">
      <div class="page active">
        <div style="display:grid;gap:18px;">
          <div class="card">
            <div class="card-header">
              <div class="card-title">Suporte</div>
              <div class="card-action" data-client-route="home">Voltar ao início</div>
            </div>

            <div id="client-suporte-feedback" style="min-height:20px;margin-bottom:14px;color:#8fa3c7;"></div>
            <div id="client-suporte-header" class="grid-3"></div>
          </div>

          <div class="card">
            <div class="card-header">
              <div class="card-title">Canais rápidos</div>
            </div>

            <div id="client-suporte-actions"></div>
          </div>

          <div class="card">
            <div class="card-header">
              <div class="card-title">Ajuda rápida</div>
            </div>

            <div id="client-suporte-guides"></div>
          </div>

          <div class="card">
            <div class="card-header">
              <div class="card-title">Dúvidas frequentes</div>
            </div>

            <div id="client-suporte-faq"></div>
          </div>
        </div>
      </div>
    </div>
  `;
}

export function initClientSuportePage() {
  (async () => {
    try {
      setFeedback('Carregando suporte...', 'neutral');
      await loadSupport();
      setFeedback('', 'neutral');
    } catch (error) {
      setFeedback(
        error instanceof Error ? error.message : 'Não foi possível carregar o suporte.',
        'error'
      );
    }
  })();
}
