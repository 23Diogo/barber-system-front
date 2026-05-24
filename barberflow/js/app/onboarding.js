import { apiFetch, setAuthToken } from '../services/api.js';
import {
  getPasswordChecklist,
  getPasswordStrengthLabel,
  validateStrongPassword,
} from '../utils/password-policy.js';

function setFeedback(message, variant = 'neutral') {
  const el = document.getElementById('ob-feedback');
  if (!el) return;
  el.textContent = message || '';
  el.className = `ob-feedback is-${variant}`;
}

function escapeHtml(value) {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

function getPasswordContext() {
  return {
    name: document.getElementById('ob-owner-name')?.value?.trim() || '',
    email: document.getElementById('ob-email')?.value?.trim() || '',
    phone: document.getElementById('ob-phone')?.value?.trim() || '',
  };
}

function renderPasswordChecklist(password = '', context = {}) {
  const items = getPasswordChecklist(password, context);

  return `
    <div class="ob-password-strength-card">
      <div class="ob-password-strength-top">
        <span>Segurança da senha</span>
        <strong>${escapeHtml(getPasswordStrengthLabel(password, context))}</strong>
      </div>
      <div class="ob-password-checklist">
        ${items.map(item => `
          <div class="ob-password-check-item ${item.ok ? 'is-ok' : ''}">
            <span>${item.ok ? '✓' : '•'}</span>
            ${escapeHtml(item.label)}
          </div>
        `).join('')}
      </div>
    </div>
  `;
}

function ensurePasswordUi() {
  const passwordInput = document.getElementById('ob-password');
  if (!passwordInput) return;

  passwordInput.setAttribute('placeholder', 'Mínimo 8 caracteres, letras e números');

  let container = document.getElementById('ob-password-strength');
  if (!container) {
    container = document.createElement('div');
    container.id = 'ob-password-strength';
    passwordInput.insertAdjacentElement('afterend', container);
  }

  container.innerHTML = renderPasswordChecklist(passwordInput.value || '', getPasswordContext());
}

function bindPasswordUi() {
  ['ob-password', 'ob-owner-name', 'ob-email', 'ob-phone'].forEach((id) => {
    document.getElementById(id)?.addEventListener('input', ensurePasswordUi);
  });

  ensurePasswordUi();
}

function getRedirectAfterRegister(payload) {
  const licenseStatus = String(
    payload?.license?.status ||
    payload?.licenseStatus ||
    payload?.barbershop?.plan_status ||
    ''
  ).toLowerCase();

  if (
    payload?.requiresSubscription === true ||
    ['suspended', 'cancelled', 'canceled'].includes(licenseStatus)
  ) {
    return payload?.redirectTo || '/app/assinatura';
  }

  return '/app';
}

document.getElementById('ob-form')?.addEventListener('submit', async (event) => {
  event.preventDefault();

  const barbershopName    = document.getElementById('ob-barbershop-name')?.value?.trim() || '';
  const ownerName         = document.getElementById('ob-owner-name')?.value?.trim() || '';
  const phone             = document.getElementById('ob-phone')?.value?.trim() || '';
  const email             = document.getElementById('ob-email')?.value?.trim() || '';
  const password          = document.getElementById('ob-password')?.value || '';
  const passwordConfirm   = document.getElementById('ob-password-confirm')?.value || '';
  const btn               = event.target.querySelector('button[type="submit"]');

  if (!barbershopName) { setFeedback('Informe o nome da barbearia.', 'error'); return; }
  if (!ownerName)      { setFeedback('Informe seu nome.', 'error'); return; }
  if (!phone)          { setFeedback('Informe seu WhatsApp.', 'error'); return; }
  if (!email)          { setFeedback('Informe seu e-mail.', 'error'); return; }
  if (!password)       { setFeedback('Crie uma senha.', 'error'); return; }

  const passwordValidation = validateStrongPassword(password, {
    name: ownerName,
    email,
    phone,
  });

  if (!passwordValidation.ok) {
    setFeedback(passwordValidation.message, 'error');
    ensurePasswordUi();
    return;
  }

  if (password !== passwordConfirm) {
    setFeedback('As senhas não conferem.', 'error');
    return;
  }

  try {
    if (btn) btn.disabled = true;
    setFeedback('Criando sua conta...', 'neutral');

    const payload = await apiFetch('/api/auth/register', {
      method: 'POST',
      body: JSON.stringify({ barbershopName, ownerName, email, phone, password }),
    });

    if (payload?.token) {
      setAuthToken(payload.token);
    }

    const redirectTo = getRedirectAfterRegister(payload);
    const message = redirectTo.startsWith('/app/assinatura')
      ? 'Conta criada! Agora finalize a assinatura para liberar o painel.'
      : 'Conta criada com sucesso! Redirecionando...';

    setFeedback(message, 'success');

    setTimeout(() => {
      window.location.replace(redirectTo);
    }, 650);
  } catch (error) {
    setFeedback(error instanceof Error ? error.message : 'Não foi possível criar sua conta.', 'error');
    if (btn) btn.disabled = false;
  }
});

bindPasswordUi();
