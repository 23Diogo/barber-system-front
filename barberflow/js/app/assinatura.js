import { getPaymentLink, clearAuthToken, hasAuthToken } from '../services/api.js';

const LOGIN_PATH = '/app/login';

function redirectToLogin() {
  clearAuthToken();
  window.location.replace(LOGIN_PATH);
}

async function handlePagar() {
  const btn = document.getElementById('btnPagar');
  const err = document.getElementById('assinaturaError');

  if (!btn) return;

  err.textContent = '';
  err.style.display = 'none';
  btn.disabled = true;
  btn.textContent = 'Gerando link...';

  try {
    if (!hasAuthToken()) {
      redirectToLogin();
      return;
    }

    const data = await getPaymentLink();

    if (!data?.paymentUrl) {
      throw new Error('Link de pagamento não gerado. Tente novamente.');
    }

    window.location.href = data.paymentUrl;

  } catch (e) {
    err.textContent = e?.message || 'Erro ao gerar link. Tente novamente.';
    err.style.display = 'block';
    btn.disabled = false;
    btn.textContent = 'Pagar agora via PIX';
  }
}

function init() {
  if (!hasAuthToken()) {
    redirectToLogin();
    return;
  }

  const btnPagar   = document.getElementById('btnPagar');
  const btnLogout  = document.getElementById('btnLogout');

  if (btnPagar)  btnPagar.addEventListener('click', handlePagar);
  if (btnLogout) btnLogout.addEventListener('click', redirectToLogin);
}

document.addEventListener('DOMContentLoaded', init);
