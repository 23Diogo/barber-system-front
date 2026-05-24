import { apiFetch, getPaymentLink, clearAuthToken, hasAuthToken } from '../services/api.js';

const LOGIN_PATH = '/app/login';
const APP_PATH = '/app';
const DEFAULT_PAY_BUTTON_TEXT = 'Pagar agora via PIX';
const VERIFY_BUTTON_TEXT = 'Verificar assinatura';
const REPAY_BUTTON_TEXT = 'Pagar novamente';

const POLL_INTERVAL_MS = 3000;
const POLL_MAX_ATTEMPTS = 12;

let buttonMode = 'pay'; // pay | verify

function redirectToLogin() {
  clearAuthToken();
  window.location.replace(LOGIN_PATH);
}

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

function getReturnStatus() {
  const params = new URLSearchParams(window.location.search);

  const mpStatus = String(params.get('mp_status') || '').toLowerCase();
  const status = String(params.get('status') || params.get('collection_status') || '').toLowerCase();
  const paymentId = String(params.get('payment_id') || params.get('collection_id') || '').trim();

  if (['success', 'approved'].includes(mpStatus) || status === 'approved') return 'success';
  if (
    ['pending', 'in_process', 'authorized'].includes(mpStatus) ||
    ['pending', 'in_process', 'authorized'].includes(status)
  ) return 'pending';
  if (
    ['failure', 'failed', 'rejected', 'cancelled', 'canceled'].includes(mpStatus) ||
    ['rejected', 'cancelled', 'canceled', 'cancelled_by_user'].includes(status)
  ) return 'failure';

  if (paymentId && !status) return 'pending';

  return '';
}

function setAssinaturaMessage(message, variant = 'neutral') {
  const el = document.getElementById('assinaturaError');
  if (!el) return;

  el.textContent = message || '';
  el.style.display = message ? 'block' : 'none';

  el.classList.remove('is-error', 'is-success', 'is-pending', 'is-neutral');
  el.classList.add(`is-${variant}`);
}

function setPayButtonLoading(isLoading, text) {
  const btn = document.getElementById('btnPagar');
  if (!btn) return;

  btn.disabled = Boolean(isLoading);
  btn.textContent = text || (buttonMode === 'verify' ? VERIFY_BUTTON_TEXT : DEFAULT_PAY_BUTTON_TEXT);
}

function setButtonMode(mode) {
  buttonMode = mode === 'verify' ? 'verify' : 'pay';

  const btn = document.getElementById('btnPagar');
  if (!btn || btn.disabled) return;

  btn.textContent = buttonMode === 'verify' ? VERIFY_BUTTON_TEXT : DEFAULT_PAY_BUTTON_TEXT;
}

function setReturnUi(status) {
  const badge = document.querySelector('.ass-badge');
  const title = document.querySelector('.ass-title');
  const subtitle = document.querySelector('.ass-subtitle');

  if (status === 'success') {
    setButtonMode('verify');

    if (badge) badge.innerHTML = '<span class="ass-badge__dot"></span> PAGAMENTO EM CONFIRMAÇÃO';
    if (title) title.textContent = 'Confirmando pagamento';
    if (subtitle) {
      subtitle.innerHTML = 'Recebemos o retorno do Mercado Pago.<br/>Estamos confirmando sua assinatura no BarberFlow.';
    }

    setAssinaturaMessage('Estamos verificando sua assinatura automaticamente.', 'pending');
    return;
  }

  if (status === 'pending') {
    setButtonMode('verify');

    if (badge) badge.innerHTML = '<span class="ass-badge__dot"></span> PAGAMENTO PENDENTE';
    if (title) title.textContent = 'Pagamento em processamento';
    if (subtitle) {
      subtitle.innerHTML = 'Seu pagamento ainda pode estar em confirmação.<br/>Quando o Mercado Pago confirmar, o painel será liberado.';
    }

    setAssinaturaMessage('Pagamento pendente. Clique em verificar ou aguarde a confirmação automática.', 'pending');
    return;
  }

  if (status === 'failure') {
    setButtonMode('pay');

    if (badge) badge.innerHTML = '<span class="ass-badge__dot"></span> PAGAMENTO NÃO CONFIRMADO';
    if (title) title.textContent = 'Pagamento não confirmado';
    if (subtitle) {
      subtitle.innerHTML = 'Não foi possível confirmar o pagamento anterior.<br/>Você pode tentar novamente pelo botão abaixo.';
    }

    setAssinaturaMessage('O pagamento não foi aprovado ou foi cancelado. Tente novamente.', 'error');
  }
}

function getLicenseStatus(payload) {
  return String(
    payload?.license?.status ||
    payload?.licenseStatus ||
    payload?.barbershop?.plan_status ||
    payload?.status ||
    ''
  ).toLowerCase();
}

function canAccess(payload) {
  if (payload?.license?.canAccess === true) return true;
  if (payload?.canAccess === true) return true;

  const status = getLicenseStatus(payload);
  return status === 'active';
}

async function fetchLicenseStatus() {
  // Endpoint dedicado, sem cache e sem depender do /api/auth/me.
  // Evita 304 sem payload e evita ler estado velho depois do webhook.
  const payload = await apiFetch(`/api/auth/license-status?_=${Date.now()}`, {
    method: 'GET',
    cache: 'no-store',
    headers: {
      'Cache-Control': 'no-cache, no-store, must-revalidate',
      Pragma: 'no-cache',
      Expires: '0',
    },
    timeoutMs: 20000,
  });

  return {
    status: getLicenseStatus(payload),
    canAccess: canAccess(payload),
    payload,
  };
}

async function redirectIfLicenseActive() {
  const license = await fetchLicenseStatus();

  if (license.canAccess || license.status === 'active') {
    setAssinaturaMessage('Assinatura confirmada! Abrindo painel...', 'success');
    setPayButtonLoading(true, 'Abrindo painel...');

    setTimeout(() => {
      window.location.replace(APP_PATH);
    }, 450);

    return true;
  }

  return false;
}

async function waitForLicenseActivation() {
  setButtonMode('verify');
  setPayButtonLoading(true, 'Verificando assinatura...');

  for (let attempt = 1; attempt <= POLL_MAX_ATTEMPTS; attempt++) {
    try {
      const didRedirect = await redirectIfLicenseActive();
      if (didRedirect) return true;

      const remaining = POLL_MAX_ATTEMPTS - attempt;
      setAssinaturaMessage(
        remaining > 0
          ? `Pagamento ainda não confirmado no sistema. Nova verificação em alguns segundos... (${remaining})`
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

  setButtonMode('pay');
  setPayButtonLoading(false, REPAY_BUTTON_TEXT);
  setAssinaturaMessage(
    'Ainda não consegui confirmar a assinatura. Se você já pagou, aguarde alguns instantes e atualize a página. Se não pagou, tente novamente.',
    'pending'
  );

  return false;
}

async function handlePagar() {
  try {
    if (!hasAuthToken()) {
      redirectToLogin();
      return;
    }

    setAssinaturaMessage('');

    // Regra final: antes de gerar qualquer novo link, sempre consulta a licença.
    // Se o webhook já ativou, não cria cobrança duplicada e manda direto ao painel.
    setPayButtonLoading(true, 'Verificando assinatura...');
    const didRedirect = await redirectIfLicenseActive();
    if (didRedirect) return;

    if (buttonMode === 'verify') {
      await waitForLicenseActivation();
      return;
    }

    setPayButtonLoading(true, 'Gerando link...');

    const data = await getPaymentLink();

    if (!data?.paymentUrl) {
      throw new Error('Link de pagamento não gerado. Tente novamente.');
    }

    window.location.href = data.paymentUrl;
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Erro ao gerar link. Tente novamente.';

    if (/401|403|não autenticado|unauthorized|forbidden|sessão/i.test(message)) {
      redirectToLogin();
      return;
    }

    setAssinaturaMessage(message, 'error');
    setPayButtonLoading(false);
  }
}

function init() {
  if (!hasAuthToken()) {
    redirectToLogin();
    return;
  }

  const btnPagar = document.getElementById('btnPagar');
  const btnLogout = document.getElementById('btnLogout');
  const returnStatus = getReturnStatus();

  if (btnPagar) btnPagar.addEventListener('click', handlePagar);
  if (btnLogout) btnLogout.addEventListener('click', redirectToLogin);

  if (returnStatus) {
    setReturnUi(returnStatus);

    if (returnStatus === 'success' || returnStatus === 'pending') {
      waitForLicenseActivation();
      return;
    }
  }

  // Mesmo sem querystring do Mercado Pago, se o usuário cair nesta tela com a licença já ativa,
  // tira da tela de assinatura imediatamente.
  redirectIfLicenseActive().catch(() => {
    setButtonMode('pay');
    setPayButtonLoading(false, DEFAULT_PAY_BUTTON_TEXT);
  });
}

document.addEventListener('DOMContentLoaded', init);
