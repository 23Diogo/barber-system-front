import {
  getClientPortalContext,
  getClientPortalPlans,
  getClientPortalSubscription,
  createClientPortalSubscriptionCheckout,
} from '../../services/client-auth.js';

const state = {
  context: null,
  plans: [],
  subscription: null,
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
  const amount = Number(value || 0);
  return new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL',
  }).format(amount);
}

function formatInterval(plan) {
  const count = Number(plan?.billing_interval_count || 1);
  const interval = String(plan?.billing_interval || 'month');

  if (interval === 'year') {
    return count > 1 ? `A cada ${count} anos` : 'Anual';
  }

  return count > 1 ? `A cada ${count} meses` : 'Mensal';
}

function setFeedback(message, variant = 'neutral') {
  const el = document.getElementById('client-planos-feedback');
  if (!el) return;

  el.textContent = message || '';
  el.style.color =
    variant === 'error'
      ? '#ff7b91'
      : variant === 'success'
        ? '#00e676'
        : '#8fa3c7';
}

function renderPlanBenefits(plan) {
  const entitlements = Array.isArray(plan?.plan_service_entitlements)
    ? plan.plan_service_entitlements
    : [];

  const rows = [];

  if (Number(plan?.included_haircuts || 0) > 0) {
    rows.push(`<li>${escapeHtml(String(plan.included_haircuts))} corte(s) incluído(s)</li>`);
  }

  if (Number(plan?.included_beards || 0) > 0) {
    rows.push(`<li>${escapeHtml(String(plan.included_beards))} barba(s) incluída(s)</li>`);
  }

  entitlements.forEach((item) => {
    const service = Array.isArray(item?.services) ? item.services[0] : item?.services;
    rows.push(
      `<li>${escapeHtml(String(item?.included_quantity || 0))}x ${escapeHtml(service?.name || 'Serviço')}</li>`
    );
  });

  if (!rows.length) {
    rows.push('<li>Plano sem benefícios configurados.</li>');
  }

  return rows.join('');
}

function renderPlanCard(plan) {
  const hasSubscription = Boolean(state.subscription?.subscription);
  const isCurrentPlan = Boolean(plan?.isCurrentPlan);

  const disabled = hasSubscription || isCurrentPlan;
  const btnLabel = isCurrentPlan
    ? 'Plano atual'
    : hasSubscription
      ? 'Já existe um plano'
      : 'Contratar plano';

  return `
    <div
      style="
        border:1px solid rgba(79,195,247,.12);
        border-radius:20px;
        background:rgba(255,255,255,.03);
        padding:18px;
        display:grid;
        gap:14px;
      "
    >
      <div style="display:flex;justify-content:space-between;gap:12px;align-items:flex-start;">
        <div>
          <div style="font-size:20px;font-weight:800;color:#fff;">
            ${escapeHtml(plan?.name || 'Plano')}
          </div>
          <div style="margin-top:6px;color:#8fa3c7;">
            ${escapeHtml(plan?.description || 'Sem descrição')}
          </div>
        </div>

        <span class="pill">${escapeHtml(formatInterval(plan))}</span>
      </div>

      <div style="display:flex;align-items:flex-end;gap:8px;">
        <div style="font-size:28px;font-weight:900;color:#7dd3fc;">
          ${escapeHtml(formatCurrency(plan?.price))}
        </div>
        <div style="color:#8fa3c7;padding-bottom:4px;">
          ${escapeHtml(formatInterval(plan))}
        </div>
      </div>

      <div style="display:grid;gap:10px;">
        <div class="cfg-row">
          <div>
            <div class="cfg-label">Benefícios</div>
            <div class="cfg-sub">O que entra neste plano</div>
          </div>
          <span class="pill">Plano</span>
        </div>

        <ul style="margin:0;padding-left:18px;color:#dce8ff;display:grid;gap:6px;">
          ${renderPlanBenefits(plan)}
        </ul>
      </div>

      ${
        Number(plan?.signup_fee_cents || 0) > 0
          ? `
            <div class="cfg-row">
              <div>
                <div class="cfg-label">Taxa de adesão</div>
                <div class="cfg-sub">${escapeHtml(formatCurrency(Number(plan.signup_fee_cents) / 100))}</div>
              </div>
              <span class="pill">Adesão</span>
            </div>
          `
          : ''
      }

      <button
        type="button"
        data-plan-checkout-id="${escapeHtml(plan?.id)}"
        ${disabled ? 'disabled' : ''}
        style="
          min-height:50px;
          border-radius:14px;
          border:${disabled ? '1px solid rgba(255,255,255,.10)' : '0'};
          background:${disabled ? 'rgba(255,255,255,.05)' : 'linear-gradient(135deg,#5dc8ff 0%,#2f8cff 55%,#1468ff 100%)'};
          color:${disabled ? '#8fa3c7' : '#fff'};
          font:inherit;
          font-weight:800;
          cursor:${disabled ? 'not-allowed' : 'pointer'};
        "
      >
        ${escapeHtml(btnLabel)}
      </button>
    </div>
  `;
}

function renderHeader() {
  const meta = document.getElementById('client-planos-meta');
  if (!meta) return;

  const activePlanName =
    state.subscription?.subscription?.plans?.name ||
    'Nenhum plano ativo';

  meta.innerHTML = `
    <div class="metric-card">
      <div class="metric-label">Planos disponíveis</div>
      <div class="metric-value">${escapeHtml(String(state.plans.length))}</div>
      <div class="metric-sub color-nt">Barbearia atual</div>
    </div>

    <div class="metric-card">
      <div class="metric-label">Plano atual</div>
      <div class="metric-value" style="font-size:18px;">${escapeHtml(activePlanName)}</div>
      <div class="metric-sub color-nt">Cliente</div>
    </div>

    <div class="metric-card">
      <div class="metric-label">Barbearia</div>
      <div class="metric-value" style="font-size:18px;">${escapeHtml(state.context?.barbershop?.name || 'Portal')}</div>
      <div class="metric-sub color-nt">Contexto atual</div>
    </div>
  `;
}

function renderPlans() {
  const list = document.getElementById('client-planos-list');
  if (!list) return;

  if (!state.plans.length) {
    list.innerHTML = `
      <div class="cfg-row">
        <div>
          <div class="cfg-label">Nenhum plano disponível</div>
          <div class="cfg-sub">Quando a barbearia cadastrar planos ativos, eles aparecerão aqui.</div>
        </div>
        <span class="pill">Vazio</span>
      </div>
    `;
    return;
  }

  list.innerHTML = `
    <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(300px,1fr));gap:16px;">
      ${state.plans.map(renderPlanCard).join('')}
    </div>
  `;

  list.querySelectorAll('[data-plan-checkout-id]').forEach((button) => {
    button.addEventListener('click', async () => {
      const planId = button.getAttribute('data-plan-checkout-id');
      if (!planId) return;

      try {
        button.disabled = true;
        setFeedback('Criando sua contratação...', 'neutral');

        const result = await createClientPortalSubscriptionCheckout({ planId });
        const paymentUrl = result?.checkout?.paymentUrl || '';

        if (paymentUrl) {
          setFeedback('Redirecionando para o pagamento...', 'success');
          window.location.href = paymentUrl;
          return;
        }

        setFeedback('Plano criado com sucesso. Vamos abrir sua área do plano.', 'success');

        setTimeout(() => {
          window.history.pushState({ clientRoute: 'assinatura' }, '', '/client/assinatura');
          window.dispatchEvent(new PopStateEvent('popstate'));
        }, 700);
      } catch (error) {
        setFeedback(
          error instanceof Error ? error.message : 'Não foi possível contratar o plano.',
          'error'
        );
      } finally {
        button.disabled = false;
      }
    });
  });
}

export function renderClientPlanos() {
  return `
    <div id="pages" style="display:block">
      <div class="page active">
        <div style="display:grid;gap:18px;">
          <div class="card">
            <div class="card-header">
              <div class="card-title">Contratar plano</div>
              <div class="card-action" data-client-route="assinatura">Ver meu plano</div>
            </div>

            <div id="client-planos-feedback" style="min-height:20px;margin-bottom:14px;color:#8fa3c7;"></div>
            <div id="client-planos-meta" class="grid-3"></div>
          </div>

          <div class="card">
            <div class="card-header">
              <div class="card-title">Planos disponíveis</div>
            </div>

            <div id="client-planos-list"></div>
          </div>
        </div>
      </div>
    </div>
  `;
}

export function initClientPlanosPage() {
  (async () => {
    try {
      setFeedback('Carregando planos...', 'neutral');

      const [context, plansPayload, subscriptionPayload] = await Promise.all([
        getClientPortalContext(),
        getClientPortalPlans(),
        getClientPortalSubscription(),
      ]);

      state.context = context || null;
      state.plans = Array.isArray(plansPayload?.items) ? plansPayload.items : [];
      state.subscription = subscriptionPayload || null;

      renderHeader();
      renderPlans();

      setFeedback('Escolha o plano ideal para continuar.', 'neutral');
    } catch (error) {
      setFeedback(
        error instanceof Error ? error.message : 'Não foi possível carregar os planos.',
        'error'
      );
    }
  })();
}
