import { apiFetch, clearAuthToken, hasAuthToken } from './services/api.js';

const LOGIN_PATH = '/app/login';
const APP_PATH = '/app';
const POLL_INTERVAL_MS = 3000;
const POLL_MAX_ATTEMPTS = 14;

function redirectToLogin() {
  clearAuthToken();
  window.location.replace(LOGIN_PATH);
}

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

function formatDate(value) {
  if (!value) return '';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '';
  return new Intl.DateTimeFormat('pt-BR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  }).format(date);
}

function getReturnStatus() {
  const params = new URLSearchParams(window.location.search);
  const mpStatus = String(params.get('mp_status') || '').toLowerCase();
  const status = String(params.get('status') || params.get('collection_status') || '').toLowerCase();
  const paymentId = String(params.get('payment_id') || params.get('collection_id') || '').trim();

  if (
    ['success', 'approved', 'assinatura', 'troca_cartao', 'pix_sucesso'].includes(mpStatus) ||
    ['success', 'approved', 'assinatura', 'troca_cartao', 'pix_sucesso'].includes(status)
  ) return 'success';

  if (
    ['pending', 'in_process', 'authorized', 'pix_pendente'].includes(mpStatus) ||
    ['pending', 'in_process', 'authorized', 'pix_pendente'].includes(status)
  ) return 'pending';

  if (
    ['failure', 'failed', 'rejected', 'cancelled', 'canceled', 'pix_falha'].includes(mpStatus) ||
    ['rejected', 'cancelled', 'canceled', 'cancelled_by_user', 'pix_falha'].includes(status)
  ) return 'failure';

  if (paymentId && !status) return 'pending';
  return '';
}

function getCheckoutUrl(payload) {
  return (
    payload?.paymentUrl ||
    payload?.initPoint ||
    payload?.init_point ||
    payload?.sandboxInitPoint ||
    payload?.sandbox_init_point ||
    payload?.nextPaymentUrl ||
    null
  );
}

function formatMoney(value) {
  const amount = Number(value || 89.90);
  return new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL',
  }).format(Number.isFinite(amount) ? amount : 89.90);
}

function splitAmount(value) {
  const formatted = formatMoney(value).replace('R$', '').trim();
  const [reais, cents = '00'] = formatted.split(',');
  return { reais, cents: `,${cents}` };
}

function getLicense(payload) {
  return payload?.license || payload?.payload?.license || {};
}

function getShop(payload) {
  return payload?.shop || payload?.barbershop || payload?.payload?.shop || {};
}

function getLicenseStatus(payload) {
  const license = getLicense(payload);
  const shop = getShop(payload);

  return String(
    license?.status ||
    payload?.status ||
    payload?.licenseStatus ||
    shop?.plan_status ||
    ''
  ).toLowerCase();
}

function canAccess(payload) {
  if (payload?.license?.canAccess === true || payload?.canAccess === true) return true;
  const status = getLicenseStatus(payload);
  return ['active', 'trial', 'past_due'].includes(status);
}

function hasCancelledRecurrence(payload) {
  const license = getLicense(payload);
  return Boolean(license?.cancel_at_period_end);
}

function shouldRedirectToPanel(payload) {
  return canAccess(payload) && !hasCancelledRecurrence(payload);
}

function setText(id, value) {
  const el = document.getElementById(id);
  if (el) el.textContent = value || '';
}

function setAssinaturaMessage(message, variant = 'neutral') {
  const el = document.getElementById('assinaturaError');
  if (!el) return;

  el.textContent = message || '';
  el.style.display = message ? 'block' : 'none';
  el.classList.remove('is-error', 'is-success', 'is-pending', 'is-neutral');
  el.classList.add(`is-${variant}`);
}

function setButtonLoading(button, isLoading, text = 'Aguarde...') {
  if (!button) return;

  if (isLoading) {
    button.dataset.originalText = button.textContent || '';
    button.disabled = true;
    button.textContent = text;
    return;
  }

  button.disabled = false;
  button.textContent = button.dataset.originalText || button.textContent || 'Continuar';
}

function setAllActionsLoading(isLoading, sourceButton = null, text = 'Aguarde...') {
  ['btnCardSubscription', 'btnPixPayment', 'btnVerify'].forEach((id) => {
    const btn = document.getElementById(id);
    if (!btn) return;

    if (sourceButton && btn === sourceButton) {
      setButtonLoading(btn, isLoading, text);
    } else {
      btn.disabled = Boolean(isLoading);
    }

    if (!isLoading && btn !== sourceButton) btn.disabled = false;
  });
}

function setHealthUi(status, payload = {}) {
  const license = getLicense(payload);
  const periodEnd = formatDate(license?.current_period_end || payload?.canAccessUntil);

  if (license?.cancel_at_period_end && periodEnd) {
    setText('assAccessStatus', 'Recorrência cancelada');
    setText('assAccessDetail', `Acesso ativo até ${periodEnd}. Ative uma nova forma de pagamento para continuar depois.`);
    return;
  }

  if (['active', 'trial'].includes(status)) {
    setText('assAccessStatus', 'Ativo');
    setText('assAccessDetail', periodEnd ? `Liberado até ${periodEnd}` : 'Acesso liberado');
    return;
  }

  if (status === 'past_due') {
    setText('assAccessStatus', 'Pendente');
    setText('assAccessDetail', periodEnd ? `Regularize até o vencimento. Período atual até ${periodEnd}` : 'Regularize para evitar bloqueio.');
    return;
  }

  if (status === 'pending') {
    setText('assAccessStatus', 'Aguardando');
    setText('assAccessDetail', 'Pagamento em confirmação pelo Mercado Pago.');
    return;
  }

  if (status === 'cancelled' || status === 'canceled') {
    setText('assAccessStatus', 'Cancelado');
    setText('assAccessDetail', 'Escolha uma forma de pagamento para reativar.');
    return;
  }

  setText('assAccessStatus', 'Bloqueado');
  setText('assAccessDetail', 'Regularize a assinatura para voltar ao painel.');
}


function renderRenewalAlert(payload = {}) {
  const alert = payload?.renewalAlert || null;
  const card = document.querySelector('.ass-card');
  const price = document.querySelector('.ass-price');
  if (!card || !price) return;

  let el = document.getElementById('assRenewalAlert');

  if (!alert?.show) {
    if (el) el.remove();
    return;
  }

  if (!el) {
    el = document.createElement('section');
    el.id = 'assRenewalAlert';
    price.insertAdjacentElement('afterend', el);
  }

  const level = String(alert.level || 'warning').toLowerCase();
  const actionLabel = alert.actionLabel || 'Gerar Pix da mensalidade';
  const dueDate = alert.dueDateLabel || formatDate(alert.dueDate);

  el.className = `ass-renewal-alert ass-renewal-alert--${level}`;
  el.innerHTML = `
    <div class="ass-renewal-alert__icon">⚡</div>
    <div class="ass-renewal-alert__content">
      <strong>${alert.title || 'Sua assinatura via Pix vence em breve'}</strong>
      <span>${alert.message || 'Gere um novo Pix para continuar usando o BBarberFlow sem interrupções.'}</span>
      ${dueDate ? `<small>Vencimento: ${dueDate}</small>` : ''}
    </div>
    <button type="button" class="ass-renewal-alert__btn" id="btnRenewalPix">${actionLabel}</button>
  `;

  el.querySelector('#btnRenewalPix')?.addEventListener('click', () => {
    document.getElementById('btnPixPayment')?.click();
  });
}

function setStatusUi(status, payload = null) {
  const badge = document.getElementById('assBadge') || document.querySelector('.ass-badge');
  const title = document.querySelector('.ass-title');
  const subtitle = document.querySelector('.ass-subtitle');
  const license = getLicense(payload || {});
  const amount = license?.amount || payload?.amount || 89.90;
  const { reais, cents } = splitAmount(amount);

  const amountEl = document.getElementById('assAmount');
  const centsEl = document.getElementById('assCents');
  if (amountEl) amountEl.textContent = reais;
  if (centsEl) centsEl.textContent = cents;

  if (badge) {
    badge.classList.remove('is-active', 'is-pending');
  }

  setHealthUi(status, payload || {});
  renderRenewalAlert(payload || {});

  if (license?.cancel_at_period_end && ['active', 'trial'].includes(status)) {
    if (badge) {
      badge.classList.add('is-pending');
      badge.innerHTML = '<span class="ass-badge__dot"></span> RECORRÊNCIA CANCELADA';
    }
    if (title) title.textContent = 'Sua recorrência foi cancelada';
    if (subtitle) {
      const periodEnd = formatDate(license?.current_period_end);
      subtitle.innerHTML = periodEnd
        ? `Seu acesso continua ativo até ${periodEnd}.<br/>Ative cartão recorrente ou Pix mensal para manter o BBarberFlow depois desse período.`
        : 'Seu acesso atual segue ativo. Ative uma nova forma de pagamento para continuar depois.';
    }
    return;
  }

  if (['active', 'trial'].includes(status)) {
    if (badge) {
      badge.classList.add('is-active');
      badge.innerHTML = '<span class="ass-badge__dot"></span> ASSINATURA ATIVA';
    }
    if (title) title.textContent = 'Assinatura confirmada';
    if (subtitle) subtitle.innerHTML = 'Seu acesso ao BBarberFlow está ativo.<br/>Abrindo o painel do dono.';
    return;
  }

  if (status === 'past_due') {
    if (badge) {
      badge.classList.add('is-pending');
      badge.innerHTML = '<span class="ass-badge__dot"></span> PAGAMENTO PENDENTE';
    }
    if (title) title.textContent = 'Regularize sua assinatura';
    if (subtitle) subtitle.innerHTML = 'Identificamos uma pendência de pagamento.<br/>Regularize até o vencimento para evitar suspensão.';
    return;
  }

  if (status === 'cancelled' || status === 'canceled') {
    if (badge) badge.innerHTML = '<span class="ass-badge__dot"></span> ASSINATURA CANCELADA';
    if (title) title.textContent = 'Assinatura cancelada';
    if (subtitle) subtitle.innerHTML = 'Escolha cartão recorrente ou Pix mensal para reativar o acesso.';
    return;
  }

  if (status === 'pending') {
    if (badge) {
      badge.classList.add('is-pending');
      badge.innerHTML = '<span class="ass-badge__dot"></span> AGUARDANDO PAGAMENTO';
    }
    if (title) title.textContent = 'Pagamento em confirmação';
    if (subtitle) subtitle.innerHTML = 'Assim que o Mercado Pago confirmar, seu painel será liberado.';
    return;
  }

  if (badge) badge.innerHTML = '<span class="ass-badge__dot"></span> ASSINATURA SUSPENSA';
  if (title) title.textContent = 'Acesso bloqueado';
  if (subtitle) subtitle.innerHTML = 'Sua barbearia está temporariamente bloqueada.<br/>Regularize o pagamento para voltar a atender.';
}

async function fetchPlatformLicenseStatus() {
  return apiFetch(`/api/platform-license/status?_=${Date.now()}`, {
    method: 'GET',
    cache: 'no-store',
    headers: {
      'Cache-Control': 'no-cache, no-store, must-revalidate',
      Pragma: 'no-cache',
      Expires: '0',
    },
    timeoutMs: 20000,
  });
}

async function redirectIfLicenseActive() {
  const payload = await fetchPlatformLicenseStatus();
  const status = getLicenseStatus(payload);
  setStatusUi(status, payload);

  if (shouldRedirectToPanel(payload)) {
    setAssinaturaMessage('Assinatura confirmada! Abrindo painel...', 'success');
    setAllActionsLoading(true, null, 'Abrindo painel...');

    setTimeout(() => {
      window.location.replace(APP_PATH);
    }, 450);

    return true;
  }

  if (canAccess(payload) && hasCancelledRecurrence(payload)) {
    setAssinaturaMessage('Seu acesso segue ativo até o fim do período pago, mas a recorrência está cancelada.', 'pending');
  }

  return false;
}

async function waitForLicenseActivation() {
  const verifyBtn = document.getElementById('btnVerify');
  setButtonLoading(verifyBtn, true, 'Verificando...');

  for (let attempt = 1; attempt <= POLL_MAX_ATTEMPTS; attempt++) {
    try {
      const didRedirect = await redirectIfLicenseActive();
      if (didRedirect) return true;

      const remaining = POLL_MAX_ATTEMPTS - attempt;
      setAssinaturaMessage(
        remaining > 0
          ? `Pagamento ainda não confirmado. Nova verificação em alguns segundos... (${remaining})`
          : 'Pagamento ainda não confirmado no sistema.',
        'pending'
      );
    } catch (error) {
      const message = error instanceof Error ? error.message : '';
      if (/401|403|não autenticado|unauthorized|forbidden|sessão/i.test(message)) {
        redirectToLogin();
        return false;
      }
      setAssinaturaMessage('Não foi possível consultar a assinatura agora. Tentando novamente...', 'pending');
    }

    await sleep(POLL_INTERVAL_MS);
  }

  setButtonLoading(verifyBtn, false);
  setAssinaturaMessage('Ainda não consegui confirmar a assinatura. Se você já pagou, aguarde alguns instantes e tente verificar novamente.', 'pending');
  return false;
}

async function startCheckout(endpoint, sourceButton, loadingText) {
  try {
    if (!hasAuthToken()) {
      redirectToLogin();
      return;
    }

    setAssinaturaMessage('');
    setAllActionsLoading(true, sourceButton, 'Verificando assinatura...');

    const payloadStatus = await fetchPlatformLicenseStatus();
    const currentStatus = getLicenseStatus(payloadStatus);
    setStatusUi(currentStatus, payloadStatus);

    if (shouldRedirectToPanel(payloadStatus)) {
      setAssinaturaMessage('Sua assinatura já está ativa. Abrindo painel...', 'success');
      setTimeout(() => window.location.replace(APP_PATH), 450);
      return;
    }

    setAllActionsLoading(true, sourceButton, loadingText);

    const payload = await apiFetch(endpoint, {
      method: 'POST',
      body: JSON.stringify({}),
      timeoutMs: 30000,
    });

    const checkoutUrl = getCheckoutUrl(payload);
    if (!checkoutUrl) {
      throw new Error('Link de pagamento não retornado. Tente novamente.');
    }

    window.location.href = checkoutUrl;
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Erro ao gerar pagamento. Tente novamente.';

    if (/401|403|não autenticado|unauthorized|forbidden|sessão/i.test(message)) {
      redirectToLogin();
      return;
    }

    setAssinaturaMessage(message, 'error');
    setAllActionsLoading(false, sourceButton);
  }
}

function setReturnUi(status) {
  if (status === 'success') {
    setStatusUi('pending');
    setAssinaturaMessage('Recebemos o retorno do Mercado Pago. Verificando sua assinatura automaticamente.', 'pending');
    return;
  }

  if (status === 'pending') {
    setStatusUi('pending');
    setAssinaturaMessage('Pagamento pendente. Clique em verificar ou aguarde a confirmação automática.', 'pending');
    return;
  }

  if (status === 'failure') {
    setStatusUi('suspended');
    setAssinaturaMessage('O pagamento não foi aprovado ou foi cancelado. Tente novamente.', 'error');
  }
}

function init() {
  if (!hasAuthToken()) {
    redirectToLogin();
    return;
  }

  const btnCard = document.getElementById('btnCardSubscription');
  const btnPix = document.getElementById('btnPixPayment');
  const btnVerify = document.getElementById('btnVerify');
  const btnLogout = document.getElementById('btnLogout');
  const returnStatus = getReturnStatus();

  btnCard?.addEventListener('click', () => startCheckout('/api/platform-license/card-subscription', btnCard, 'Gerando assinatura...'));
  btnPix?.addEventListener('click', () => startCheckout('/api/platform-license/pix-payment', btnPix, 'Gerando Pix...'));
  btnVerify?.addEventListener('click', waitForLicenseActivation);
  btnLogout?.addEventListener('click', redirectToLogin);

  if (returnStatus) {
    setReturnUi(returnStatus);
    if (returnStatus === 'success' || returnStatus === 'pending') {
      waitForLicenseActivation();
      return;
    }
  }

  redirectIfLicenseActive().catch(() => {
    setStatusUi('suspended');
    setAllActionsLoading(false);
  });
}

document.addEventListener('DOMContentLoaded', init);
