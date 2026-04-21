import { getClientPortalContext } from '../../services/client-auth.js';

const state = {
  context: null,
};

function escapeHtml(value) {
  return String(value ?? '')
    .replace(/&/g, '&amp;').replace(/</g, '&lt;')
    .replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#039;');
}

function setFeedback(message, variant = 'neutral') {
  const el = document.getElementById('client-suporte-feedback');
  if (!el) return;
  el.textContent = message || '';
  el.style.color = variant === 'error' ? '#ff7b91' : variant === 'success' ? '#00e676' : '#8fa3c7';
}

function formatPhone(value) {
  const digits = String(value || '').replace(/\D/g, '');
  if (!digits) return null;
  // Remove código do país se começar com 55
  const local = digits.startsWith('55') && digits.length > 11 ? digits.slice(2) : digits;
  if (local.length === 11) return `(${local.slice(0,2)}) ${local.slice(2,7)}-${local.slice(7)}`;
  if (local.length === 10) return `(${local.slice(0,2)}) ${local.slice(2,6)}-${local.slice(6)}`;
  return digits;
}

function buildWhatsappUrl(value) {
  const digits = String(value || '').replace(/\D/g, '');
  if (!digits) return null;
  const number = digits.startsWith('55') ? digits : `55${digits}`;
  return `https://wa.me/${number}`;
}

function renderContent() {
  const container = document.getElementById('client-suporte-content');
  if (!container) return;

  const barbershop = state.context?.barbershop || {};
  const whatsapp   = barbershop.whatsapp || barbershop.phone || '';
  const waUrl      = buildWhatsappUrl(whatsapp);
  const waFormatted = formatPhone(whatsapp);

  const address = [barbershop.address, barbershop.city, barbershop.state]
    .filter(Boolean).join(', ');

  const cancelHours = Number(barbershop.cancellation_hours || 0);
  const advanceDays = Number(barbershop.booking_advance_days || 30);

  container.innerHTML = `
    <div class="card">
      <div class="card-header">
        <div class="card-title">Contato da barbearia</div>
      </div>

      <div class="cfg-row">
        <div>
          <div class="cfg-label">🏪 ${escapeHtml(barbershop.name || 'Barbearia')}</div>
          <div class="cfg-sub">${escapeHtml(address || 'Endereço não informado')}</div>
        </div>
        <span class="pill">Local</span>
      </div>

      ${waUrl ? `
      <div class="cfg-row">
        <div>
          <div class="cfg-label">📱 WhatsApp</div>
          <div class="cfg-sub">${escapeHtml(waFormatted || whatsapp)}</div>
        </div>
        <a href="${escapeHtml(waUrl)}" target="_blank" rel="noopener"
          style="padding:8px 14px;border-radius:10px;background:rgba(0,230,118,.12);color:#00e676;font-weight:800;font-size:12px;text-decoration:none;flex-shrink:0;">
          Abrir WhatsApp
        </a>
      </div>` : `
      <div class="cfg-row">
        <div>
          <div class="cfg-label">📱 WhatsApp</div>
          <div class="cfg-sub">Não configurado pela barbearia.</div>
        </div>
        <span class="pill">Indisponível</span>
      </div>`}

      ${barbershop.email ? `
      <div class="cfg-row">
        <div>
          <div class="cfg-label">📧 E-mail</div>
          <div class="cfg-sub">${escapeHtml(barbershop.email)}</div>
        </div>
        <a href="mailto:${escapeHtml(barbershop.email)}"
          style="padding:8px 14px;border-radius:10px;background:rgba(79,195,247,.10);color:#7dd3fc;font-weight:800;font-size:12px;text-decoration:none;flex-shrink:0;">
          Enviar e-mail
        </a>
      </div>` : ''}
    </div>

    <div class="card">
      <div class="card-header">
        <div class="card-title">Perguntas frequentes</div>
      </div>

      <div class="cfg-row">
        <div>
          <div class="cfg-label">Como agendar um horário?</div>
          <div class="cfg-sub">Vá em "Agendar horário", escolha o serviço, profissional, data e horário disponível. Depois clique em confirmar.</div>
        </div>
        <span class="pill">Agenda</span>
      </div>

      <div class="cfg-row">
        <div>
          <div class="cfg-label">Como cancelar um agendamento?</div>
          <div class="cfg-sub">Em "Meus agendamentos", clique em "Cancelar agendamento" no horário desejado. O cancelamento deve ser feito com pelo menos ${escapeHtml(String(cancelHours))} hora(s) de antecedência.</div>
        </div>
        <span class="pill">Regra</span>
      </div>

      <div class="cfg-row">
        <div>
          <div class="cfg-label">Com quanto tempo posso agendar?</div>
          <div class="cfg-sub">Você pode agendar com até ${escapeHtml(String(advanceDays))} dia(s) de antecedência.</div>
        </div>
        <span class="pill">Agenda</span>
      </div>

      <div class="cfg-row">
        <div>
          <div class="cfg-label">Como funciona o plano de assinatura?</div>
          <div class="cfg-sub">O plano inclui serviços com quantidades definidas por ciclo mensal. Após contratar, os saldos ficam disponíveis na tela "Meu plano".</div>
        </div>
        <span class="pill">Planos</span>
      </div>

      <div class="cfg-row">
        <div>
          <div class="cfg-label">Como alterar minha senha?</div>
          <div class="cfg-sub">Em "Meus dados", na seção Segurança, informe sua senha atual e a nova senha para alterar.</div>
        </div>
        <span class="pill">Conta</span>
      </div>

      <div class="cfg-row">
        <div>
          <div class="cfg-label">Como recuperar minha senha?</div>
          <div class="cfg-sub">Na tela de login, clique em "Esqueci minha senha" e siga as instruções enviadas para o seu e-mail.</div>
        </div>
        <span class="pill">Acesso</span>
      </div>
    </div>
  `;
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
            <div id="client-suporte-feedback" style="min-height:20px;margin-bottom:4px;color:#8fa3c7;"></div>
          </div>
          <div id="client-suporte-content" style="display:grid;gap:18px;"></div>
        </div>
      </div>
    </div>
  `;
}

export function initClientSuportePage() {
  (async () => {
    try {
      setFeedback('Carregando informações...', 'neutral');
      const context = await getClientPortalContext();
      state.context = context || null;
      renderContent();
      setFeedback('', 'neutral');
    } catch (error) {
      setFeedback(
        error instanceof Error ? error.message : 'Não foi possível carregar o suporte.',
        'error'
      );
    }
  })();
}
