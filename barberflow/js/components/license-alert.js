import { apiFetch } from '../services/api.js';

const TOAST_SESSION_KEY = 'bbarberflow.platformPixReminder.toastShown';
const REFRESH_INTERVAL_MS = 5 * 60 * 1000;

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

function escapeHtml(value) {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

function shouldShowGlobalAlert(alert) {
  if (!alert?.show) return false;
  if (String(alert.paymentMode || '').toLowerCase() !== 'pix_manual') return false;

  const days = Number(alert.daysToExpire);
  if (!Number.isFinite(days)) return true;

  return days <= 3;
}

function getOrCreateRoot() {
  let root = document.getElementById('bfLicenseAlertRoot');

  if (!root) {
    root = document.createElement('div');
    root.id = 'bfLicenseAlertRoot';
    root.setAttribute('aria-live', 'polite');
    root.setAttribute('aria-atomic', 'true');
    document.body.appendChild(root);
  }

  return root;
}

function removeAlert() {
  const root = document.getElementById('bfLicenseAlertRoot');
  if (root) root.remove();
  document.body.classList.remove('has-license-alert');
}

function showMiniToast(alert) {
  try {
    if (sessionStorage.getItem(TOAST_SESSION_KEY) === 'true') return;
    sessionStorage.setItem(TOAST_SESSION_KEY, 'true');
  } catch {
    // sem sessionStorage, segue sem travar
  }

  const toast = document.createElement('div');
  toast.className = `bf-license-toast bf-license-toast--${escapeHtml(alert.level || 'warning')}`;
  toast.innerHTML = `
    <div class="bf-license-toast__icon">⚡</div>
    <div>
      <strong>${escapeHtml(alert.title || 'Assinatura via Pix vence em breve')}</strong>
      <span>${escapeHtml(alert.message || 'Gere um Pix para manter o acesso ativo.')}</span>
    </div>
  `;

  document.body.appendChild(toast);
  requestAnimationFrame(() => toast.classList.add('is-visible'));

  window.setTimeout(() => {
    toast.classList.remove('is-visible');
    window.setTimeout(() => toast.remove(), 240);
  }, 5200);
}

function renderAlert(alert) {
  if (!shouldShowGlobalAlert(alert)) {
    removeAlert();
    return;
  }

  const root = getOrCreateRoot();
  const level = String(alert.level || 'warning').toLowerCase();
  const actionLabel = alert.actionLabel || 'Gerar Pix agora';
  const dueDate = alert.dueDateLabel || '';

  root.className = `bf-license-alert bf-license-alert--${escapeHtml(level)}`;
  root.innerHTML = `
    <div class="bf-license-alert__pulse" aria-hidden="true"></div>
    <div class="bf-license-alert__icon">⚡</div>
    <div class="bf-license-alert__content">
      <strong>${escapeHtml(alert.title || 'Sua assinatura via Pix vence em breve')}</strong>
      <span>${escapeHtml(alert.message || 'Gere um novo Pix para manter o acesso ativo ao BBarberFlow.')}</span>
      ${dueDate ? `<small>Vencimento: ${escapeHtml(dueDate)}</small>` : ''}
    </div>
    <button type="button" class="bf-license-alert__btn" id="bfLicenseAlertPixBtn">
      ${escapeHtml(actionLabel)}
    </button>
  `;

  document.body.classList.add('has-license-alert');
  showMiniToast(alert);

  const button = document.getElementById('bfLicenseAlertPixBtn');
  if (button) {
    button.addEventListener('click', async () => {
      const original = button.textContent;
      button.disabled = true;
      button.textContent = 'Gerando Pix...';

      try {
        const payload = await apiFetch('/api/platform-license/pix-payment', {
          method: 'POST',
          body: JSON.stringify({ source: 'global_license_banner' }),
          timeoutMs: 30000,
        });

        const checkoutUrl = getCheckoutUrl(payload);
        if (!checkoutUrl) throw new Error('Link de pagamento não retornado pela API.');

        window.location.href = checkoutUrl;
      } catch (error) {
        button.disabled = false;
        button.textContent = original || actionLabel;
        showMiniToast({
          level: 'danger',
          title: 'Não foi possível gerar o Pix',
          message: error?.message || 'Tente novamente em alguns instantes.',
          paymentMode: 'pix_manual',
          daysToExpire: 0,
          show: true,
        });
      }
    });
  }
}

async function refreshLicenseAlert() {
  try {
    const payload = await apiFetch('/api/platform-license/status', { timeoutMs: 12000 });
    renderAlert(payload?.renewalAlert || null);
  } catch (error) {
    // Não bloqueia o painel por falha de alerta. Rotas suspensas já são tratadas no apiFetch.
    console.warn('⚠️ [license-alert] Não foi possível consultar alerta de licença:', error?.message || error);
  }
}

export function initLicenseAlert() {
  refreshLicenseAlert();

  window.clearInterval(window.__bfLicenseAlertInterval);
  window.__bfLicenseAlertInterval = window.setInterval(refreshLicenseAlert, REFRESH_INTERVAL_MS);

  window.addEventListener('focus', refreshLicenseAlert);
  window.addEventListener('bbarberflow:license-alert-refresh', refreshLicenseAlert);
}
