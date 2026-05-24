import { apiFetch, getPaymentLink, clearAuthToken, hasAuthToken } from '../services/api.js';

const LOGIN_PATH = '/app/login';
const APP_PATH = '/app';
const DEFAULT_PAY_BUTTON_TEXT = 'Pagar agora via PIX';

const POLL_INTERVAL_MS = 3000;
const POLL_MAX_ATTEMPTS = 12;

function redirectToLogin() {
  clearAuthToken();
  window.location.replace(LOGIN_PATH);
}

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

function getReturnParams() {
  const params = new URLSearchParams(window.location.search);

  return {
    mpStatus: String(params.get('mp_status') || '').toLowerCase(),
    status: String(params.get('status') || params.get('collection_status') || '').toLowerCase(),
    paymentId: String(params.get('payment_id') || params.get('collection_id') || '').trim(),
    externalReference: String(params.get('external_reference') || '').trim(),
    preferenceId: String(params.get('preference_id') || '').trim(),
  };
}

function getReturnStatus() {
  const { mpStatus, status } = getReturnParams();

  if (['success', 'approved'].includes(mpStatus) || status === 'approved') return 'success';
  if (['pending', 'in_process', 'authorized'].includes(mpStatus) || ['pending', 'in_process', 'authorized'].includes(status)) return 'pending';
  if (['failure', 'failed', 'rejected', 'cancelled', 'canceled'].includes(mpStatus) || ['rejected', 'cancelled', 'canceled'].includes(status)) return 'failure';

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

function setPayButtonLoading(isLoading, text = DEFAULT_PAY_BUTTON_TEXT) {
  const btn = document.getElementById('btnPagar');
  if (!btn) return;

  btn.disabled = Boolean(isLoading);
  btn.textContent = text;
}

function setReturnUi(status) {
  const badge = document.querySelector('.ass-badge');
  const title = document.querySelector('.ass-title');
  const subtitle = document.querySelector('.ass-subtitle');

  if (status === 'success') {
    if (badge) badge.innerHTML = '<span class="ass-badge__dot"></span> PAGAMENTO EM CONFIRMAÇÃO';
    if (title) title.textContent = 'Confirmando pagamento';
    if (subtitle) {
      subtitle.innerHTML = 'Recebemos o retorno do Mercado Pago.<br/>Estamos aguardando a confirmação automática para liberar seu painel.';
    }
    setAssinaturaMessage('Estamos validando sua assinatura. Isso pode levar alguns segundos.', 'pending');
    return;
  }

  if (status === 'pending') {
    if (badge) badge.innerHTML = '<span class="ass-badge__dot"></span> PAGAMENTO PENDENTE';
    if (title) title.textContent = 'Pagamento em processamento';
    if (subtitle) {
      subtitle.innerHTML = 'Seu pagamento ainda está em análise ou aguardando confirmação.<br/>Assim que o Mercado Pago confirmar, o painel será liberado.';
    }
    setAssinaturaMessage('Pagamento pendente. Vamos verificar a licença automaticamente por alguns instantes.', 'pending');
    return;
  }

  if (status === 'failure') {
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
    ''
  ).toLowerCase();
}

async function fetchLicenseStatus() {
  const data = await apiFetch('/api/auth/me');
  return {
    status: getLicenseStatus(data),
    payload: data,
  };
}

async function waitForLicenseActivation() {
  setPayButtonLoading(true, 'Verificando assinatura...');

  for (let attempt = 1; attempt <= POLL_MAX_ATTEMPTS; attempt++) {
    try {
      const { status } = await fetchLicenseStatus();

      if (status === 'active') {
        setAssinaturaMessage('Assinatura confirmada! Abrindo painel...', 'success');
        setTimeout(() => window.location.replace(APP_PATH), 600);
        return;
      }

      const remaining = POLL_MAX_ATTEMPTS - attempt;
      setAssinaturaMessage(
        remaining > 0
          ? `Pagamento ainda não confirmado. Nova verificação em alguns segundos... (${remaining})`
          : 'Pagamento ainda não confirmado automaticamente.',
        'pending'
      );
    } catch (error) {
      const message = error instanceof Error ? error.message : '';

      if (/401|403|não autenticado|unauthorized|forbidden/i.test(message)) {
        redirectToLogin();
        return;
      }

      setAssinaturaMessage('Não foi possível consultar a licença agora. Tentando novamente...', 'pending');
    }

    await sleep(POLL_INTERVAL_MS);
  }

  setPayButtonLoading(false, 'Verificar / pagar novamente');
  setAssinaturaMessage(
    'Seu pagamento pode estar em processamento. Se você já pagou via PIX, aguarde alguns instantes e clique em “Verificar / pagar novamente”.',
    'pending'
  );
}

async function handlePagar() {
  const err = document.getElementById('assinaturaError');

  if (err) {
    err.textContent = '';
    err.style.display = 'none';
  }

  try {
    if (!hasAuthToken()) {
      redirectToLogin();
      return;
    }

    const returnStatus = getReturnStatus();

    // Se voltou do Mercado Pago e ainda está na tela, primeiro tenta verificar se o webhook já liberou.
    if (returnStatus === 'success' || returnStatus === 'pending') {
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
    setAssinaturaMessage(error?.message || 'Erro ao gerar link. Tente novamente.', 'error');
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
    }
  }
}

document.addEventListener('DOMContentLoaded', init);
