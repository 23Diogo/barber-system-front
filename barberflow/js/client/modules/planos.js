import {
  getClientPortalContext,
  getClientPortalPlans,
  getClientPortalSubscription,
  createClientPortalSubscriptionCheckout,
} from '../../services/client-auth.js';

const state = {
  context: null,
  plans: [],
  subscriptionPayload: null,
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
  const interval = String(plan?.billing_interval || 'month').toLowerCase();

  if (interval === 'year') {
    return count > 1 ? `A cada ${count} anos` : 'Anual';
  }

  if (interval === 'week') {
    return count > 1 ? `A cada ${count} semanas` : 'Semanal';
  }

  if (interval === 'day') {
    return count > 1 ? `A cada ${count} dias` : 'Diário';
  }

  return count > 1 ? `A cada ${count} meses` : 'Mensal';
}

function translateStatus(status) {
  const map = {
    active: 'Ativo',
    trialing: 'Em teste',
    pending_activation: 'Aguardando pagamento',
    pending: 'Pendente',
    past_due: 'Pagamento pendente',
    paused: 'Pausado',
    canceled: 'Cancelado',
    cancelled: 'Cancelado',
    expired: 'Expirado',
  };

  return map[String(status || '').toLowerCase()] || status || '-';
}

function getCurrentSubscription() {
  return state.subscriptionPayload?.subscription || null;
}

function getCurrentPlanId() {
  return getCurrentSubscription()?.plan_id || getCurrentSubscription()?.plans?.id || '';
}

function hasBlockingSubscription() {
  const status = String(getCurrentSubscription()?.status || '').toLowerCase();

  return [
    'active',
    'trialing',
    'pending_activation',
    'pending',
    'past_due',
    'paused',
  ].includes(status);
}

function resolveCheckoutUrl(result) {
  return (
    result?.checkout?.paymentUrl ||
    result?.checkout?.payment_url ||
    result?.checkout?.initPoint ||
    result?.checkout?.init_point ||
    result?.checkout?.sandboxInitPoint ||
    result?.checkout?.sandbox_init_point ||
    result?.paymentUrl ||
    result?.payment_url ||
    result?.initPoint ||
    result?.init_point ||
    result?.sandboxInitPoint ||
    result?.sandbox_init_point ||
    ''
  );
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

function goToClientRoute(route) {
  const path = `/client/${route}`;

  window.history.pushState({ clientRoute: route }, '', path);
  window.dispatchEvent(new PopStateEvent('popstate'));
}

function getPlanPrice(plan) {
  if (plan?.price != null) return Number(plan.price || 0);
  if (plan?.price_cents != null) return Number(plan.price_cents || 0) / 100;
  return 0;
}

function renderPlanBenefits(plan) {
  const entitlements = Array.isArray(plan?.plan_service_entitlements)
    ? plan.plan_service_entitlements
    : [];

  const rows = [];

  if (Number(plan?.included_haircuts || 0) > 0) {
    rows.push(`${Number(plan.included_haircuts || 0)} corte(s) incluído(s)`);
  }

  if (Number(plan?.included_beards || 0) > 0) {
    rows.push(`${Number(plan.included_beards || 0)} barba(s) incluída(s)`);
  }

  entitlements.forEach((item) => {
    const service = Array.isArray(item?.services) ? item.services[0] : item?.services;
    rows.push(`${Number(item?.included_quantity || 0)}x ${service?.name || 'Serviço'}`);
  });

  if (!rows.length) {
    rows.push('Plano sem benefícios configurados.');
  }

  return rows
    .map((row) => `<li style="overflow-wrap:anywhere;word-break:break-word;">${escapeHtml(row)}</li>`)
    .join('');
}

function renderPlanCard(plan) {
  const currentSubscription = getCurrentSubscription();
  const currentPlanId = getCurrentPlanId();
  const isCurrentPlan = Boolean(plan?.id && currentPlanId && plan.id === currentPlanId);
  const hasSubscription = hasBlockingSubscription();

  const disabled = hasSubscription || isCurrentPlan;

  const btnLabel = isCurrentPlan
    ? 'Plano atual'
    : hasSubscription
      ? 'Você já possui um plano'
      : 'Contratar plano';

  const status = String(currentSubscription?.status || '').toLowerCase();

  return `
    <div
      style="
        border:1px solid rgba(79,195,247,.12);
        border-radius:20px;
        background:rgba(255,255,255,.03);
        padding:18px;
        display:flex;
        flex-direction:column;
        gap:14px;
        min-width:0;
        height:100%;
        overflow:hidden;
      "
    >
      <div style="display:flex;justify-content:space-between;gap:12px;align-items:flex-start;min-width:0;">
        <div style="min-width:0;flex:1;">
          <div
            style="
              font-size:20px;
              font-weight:800;
              color:#fff;
              line-height:1.2;
              overflow-wrap:anywhere;
              word-break:break-word;
            "
          >
            ${escapeHtml(plan?.name || 'Plano')}
          </div>

          <div
            style="
              margin-top:6px;
              color:#8fa3c7;
              line-height:1.55;
              overflow-wrap:anywhere;
              word-break:break-word;
            "
          >
            ${escapeHtml(plan?.description || 'Sem descrição')}
          </div>
        </div>

        <span class="pill" style="flex-shrink:0;">${escapeHtml(formatInterval(plan))}</span>
      </div>

      <div style="display:flex;align-items:flex-end;gap:8px;flex-wrap:wrap;min-width:0;">
        <div
          style="
            font-size:28px;
            font-weight:900;
            color:#7dd3fc;
            line-height:1.1;
            overflow-wrap:anywhere;
            word-break:break-word;
          "
        >
          ${escapeHtml(formatCurrency(getPlanPrice(plan)))}
        </div>

        <div style="color:#8fa3c7;padding-bottom:4px;flex-shrink:0;">
          ${escapeHtml(formatInterval(plan))}
        </div>
      </div>

      <div style="display:grid;gap:10px;min-width:0;">
        <div class="cfg-row">
          <div style="min-width:0;">
            <div class="cfg-label">Benefícios</div>
            <div class="cfg-sub">O que entra neste plano</div>
          </div>
          <span class="pill">Plano</span>
        </div>

        <ul
          style="
            margin:0;
            padding-left:18px;
            color:#dce8ff;
            display:grid;
            gap:6px;
            min-width:0;
          "
        >
          ${renderPlanBenefits(plan)}
        </ul>
      </div>

      ${
        Number(plan?.signup_fee_cents || 0) > 0
          ? `
            <div class="cfg-row">
              <div style="min-width:0;">
                <div class="cfg-label">Taxa de adesão</div>
                <div class="cfg-sub">${escapeHtml(formatCurrency(Number(plan.signup_fee_cents) / 100))}</div>
              </div>
              <span class="pill">Adesão</span>
            </div>
          `
          : ''
      }

      ${
        disabled && hasSubscription && !isCurrentPlan
          ? `
            <div
              style="
                border:1px solid rgba(255,193,7,.16);
                background:rgba(255,193,7,.06);
                color:#ffd166;
                border-radius:14px;
                padding:10px 12px;
                font-size:13px;
                line-height:1.5;
              "
            >
              Sua assinatura atual está como ${escapeHtml(translateStatus(status))}. Para contratar outro plano, primeiro acompanhe ou regularize sua assinatura atual.
            </div>
          `
          : ''
      }

      <div style="margin-top:auto;display:flex;">
        ${
          disabled && hasSubscription
            ? `
              <button
                type="button"
                data-go-current-subscription="true"
                style="
                  width:100%;
                  min-height:50px;
                  border-radius:14px;
                  border:1px solid rgba(79,195,247,.20);
                  background:rgba(79,195,247,.08);
                  color:#7dd3fc;
                  font:inherit;
                  font-weight:800;
                  cursor:pointer;
                "
              >
                Ver meu plano
              </button>
            `
            : `
              <button
                type="button"
                data-plan-checkout-id="${escapeHtml(plan?.id)}"
                ${disabled ? 'disabled' : ''}
                style="
                  width:100%;
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
            `
        }
      </div>
    </div>
  `;
}

function renderHeader() {
  const meta = document.getElementById('client-planos-meta');

  if (!meta) return;

  const subscription = getCurrentSubscription();
  const activePlanName = subscription?.plans?.name || 'Nenhum plano ativo';
  const activeStatus = subscription?.status ? translateStatus(subscription.status) : 'Livre para contratar';

  meta.innerHTML = `
    <div class="metric-card">
      <div class="metric-label">Planos disponíveis</div>
      <div class="metric-value">${escapeHtml(String(state.plans.length))}</div>
      <div class="metric-sub color-nt">Barbearia atual</div>
    </div>

    <div class="metric-card">
      <div class="metric-label">Plano atual</div>
      <div class="metric-value" style="font-size:18px;">${escapeHtml(activePlanName)}</div>
      <div class="metric-sub color-nt">${escapeHtml(activeStatus)}</div>
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
    <div
      style="
        display:grid;
        grid-template-columns:repeat(auto-fit,minmax(320px,1fr));
        gap:16px;
        align-items:stretch;
      "
    >
      ${state.plans.map(renderPlanCard).join('')}
    </div>
  `;

  list.querySelectorAll('[data-go-current-subscription]').forEach((button) => {
    button.addEventListener('click', () => {
      goToClientRoute('assinatura');
    });
  });

  list.querySelectorAll('[data-plan-checkout-id]').forEach((button) => {
    button.addEventListener('click', async () => {
      const planId = button.getAttribute('data-plan-checkout-id');

      if (!planId) return;

      try {
        button.disabled = true;
        button.textContent = 'Criando contratação...';

        setFeedback('Criando sua contratação...', 'neutral');

        const result = await createClientPortalSubscriptionCheckout({ planId });
        const checkoutUrl = resolveCheckoutUrl(result);

        if (checkoutUrl) {
          setFeedback('Redirecionando para o Mercado Pago...', 'success');
          window.location.href = checkoutUrl;
          return;
        }

        setFeedback('Plano criado. Vamos abrir sua área do plano.', 'success');

        setTimeout(() => {
          goToClientRoute('assinatura');
        }, 700);
      } catch (error) {
        setFeedback(
          error instanceof Error ? error.message : 'Não foi possível contratar o plano.',
          'error'
        );

        button.disabled = false;
        button.textContent = 'Contratar plano';
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
      state.plans = Array.isArray(plansPayload?.items)
        ? plansPayload.items
        : Array.isArray(plansPayload)
          ? plansPayload
          : [];
      state.subscriptionPayload = subscriptionPayload || null;

      renderHeader();
      renderPlans();

      if (hasBlockingSubscription()) {
        setFeedback('Você já possui uma assinatura nesta barbearia. Acompanhe em Meu Plano.', 'neutral');
      } else {
        setFeedback('Escolha o plano ideal para continuar.', 'neutral');
      }
    } catch (error) {
      setFeedback(
        error instanceof Error ? error.message : 'Não foi possível carregar os planos.',
        'error'
      );
    }
  })();
}
