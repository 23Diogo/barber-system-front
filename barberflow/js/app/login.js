import { apiFetch, setAuthToken } from '../services/api.js';

const APP_LOGIN_PATH = '/app/login';
const APP_HOME_PATH = '/app';
const APP_SUBSCRIPTION_PATH = '/app/assinatura';

console.info('[BBarberFlow] owner login recovery loaded v2');

function setFeedback(message, variant = 'neutral') {
  const el = document.getElementById('app-feedback');
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

function getResetTokenFromUrl() {
  const params = new URLSearchParams(window.location.search);
  return String(params.get('token') || '').trim();
}

function isResetPasswordRoute() {
  return window.location.pathname === '/app/nova-senha' || Boolean(getResetTokenFromUrl());
}

function getLoginForm() {
  return document.getElementById('app-login-form');
}

function getLoginEmailInput() {
  return document.getElementById('app-login-email');
}

function getLoginPasswordInput() {
  return document.getElementById('app-login-password');
}

function getSubmitButton(form) {
  return form?.querySelector('button[type="submit"]') || null;
}

function setButtonLoading(button, loading, loadingText = 'Aguarde...') {
  if (!button) return;

  if (loading) {
    button.dataset.originalText = button.textContent || '';
    button.disabled = true;
    button.textContent = loadingText;
    return;
  }

  button.disabled = false;
  button.textContent = button.dataset.originalText || button.textContent || 'Enviar';
}

function validatePassword(password) {
  const value = String(password || '');

  if (value.length < 8) {
    return 'A senha deve ter pelo menos 8 caracteres.';
  }

  if (!/[A-Za-zÀ-ÿ]/.test(value)) {
    return 'A senha deve conter pelo menos uma letra.';
  }

  if (!/\d/.test(value)) {
    return 'A senha deve conter pelo menos um número.';
  }

  if (/(.)\1{5,}/.test(value.toLowerCase())) {
    return 'Evite sequências repetidas como 111111 ou aaaaaa.';
  }

  return '';
}

function ensureAuthShell() {
  let shell = document.getElementById('app-auth-flow');

  if (shell) return shell;

  const form = getLoginForm();

  shell = document.createElement('div');
  shell.id = 'app-auth-flow';

  if (form?.parentElement) {
    form.insertAdjacentElement('afterend', shell);
  } else {
    document.body.appendChild(shell);
  }

  return shell;
}

function hideLoginForm() {
  const form = getLoginForm();

  if (form) {
    form.style.display = 'none';
  }
}

function showLoginForm() {
  const form = getLoginForm();
  const shell = document.getElementById('app-auth-flow');

  if (shell) {
    shell.innerHTML = '';
  }

  if (form) {
    form.style.display = '';
  }

  setFeedback('', 'neutral');
}

function getEmailForRecovery() {
  return getLoginEmailInput()?.value?.trim() || '';
}

function ensureForgotPasswordLink() {
  const form = getLoginForm();

  if (!form) {
    console.warn('[BBarberFlow] app-login-form não encontrado para inserir Esqueci minha senha.');
    return false;
  }

  if (document.getElementById('app-forgot-password-link')) {
    return true;
  }

  const wrapper = document.createElement('div');
  wrapper.id = 'app-forgot-password-row';
  wrapper.style.cssText = [
    'display:flex',
    'justify-content:flex-end',
    'align-items:center',
    'width:100%',
    'margin:10px 0 8px',
  ].join(';');

  wrapper.innerHTML = `
    <button
      type="button"
      id="app-forgot-password-link"
      style="
        appearance:none;
        border:0;
        background:transparent;
        color:#4fc3f7;
        font:inherit;
        font-size:13px;
        font-weight:800;
        cursor:pointer;
        padding:6px 0;
        text-align:right;
      "
    >
      Esqueci minha senha
    </button>
  `;

  const submitButton = getSubmitButton(form);
  const existingFooter = form.querySelector('.client-form-footer, .ob-form-footer, [data-auth-footer]');

  if (existingFooter) {
    existingFooter.insertAdjacentElement('beforebegin', wrapper);
  } else if (submitButton) {
    submitButton.insertAdjacentElement('afterend', wrapper);
  } else {
    form.appendChild(wrapper);
  }

  document.getElementById('app-forgot-password-link')?.addEventListener('click', () => {
    renderForgotPasswordScreen();
  });

  console.info('[BBarberFlow] Esqueci minha senha inserido no login do dono.');
  return true;
}

function renderForgotPasswordScreen() {
  hideLoginForm();

  const shell = ensureAuthShell();
  const email = getEmailForRecovery();

  shell.innerHTML = `
    <form id="app-forgot-password-form" style="display:grid;gap:16px;">
      <div style="display:grid;gap:6px;">
        <div style="font-size:22px;font-weight:900;color:#e8f0fe;">Recuperar senha</div>
        <div style="color:#8fa3c7;font-size:14px;line-height:1.55;">
          Informe o e-mail do dono cadastrado. Se ele existir na base, enviaremos um link para criar uma nova senha.
        </div>
      </div>

      <div style="display:grid;gap:8px;">
        <label for="app-forgot-email" style="font-size:12px;font-weight:800;color:#8fa3c7;letter-spacing:.08em;text-transform:uppercase;">E-mail</label>
        <input
          id="app-forgot-email"
          type="email"
          placeholder="seu-email@dominio.com"
          autocomplete="email"
          value="${escapeHtml(email)}"
          style="
            width:100%;
            min-height:50px;
            border-radius:14px;
            border:1px solid rgba(79,195,247,.18);
            background:rgba(7,12,28,.72);
            color:#e8f0fe;
            padding:0 16px;
            font:inherit;
            box-sizing:border-box;
            outline:none;
          "
        />
      </div>

      <div style="display:flex;gap:10px;flex-wrap:wrap;justify-content:flex-end;">
        <button
          type="button"
          id="app-forgot-back"
          style="
            min-height:44px;
            padding:0 16px;
            border-radius:12px;
            border:1px solid rgba(255,255,255,.12);
            background:rgba(255,255,255,.04);
            color:#8fa3c7;
            font:inherit;
            font-weight:800;
            cursor:pointer;
          "
        >
          Voltar para login
        </button>

        <button
          type="submit"
          style="
            min-height:44px;
            padding:0 16px;
            border-radius:12px;
            border:0;
            background:linear-gradient(135deg,#5dc8ff 0%,#2f8cff 55%,#1468ff 100%);
            color:#fff;
            font:inherit;
            font-weight:900;
            cursor:pointer;
          "
        >
          Enviar instruções
        </button>
      </div>
    </form>
  `;

  setFeedback('', 'neutral');

  document.getElementById('app-forgot-back')?.addEventListener('click', () => {
    showLoginForm();
  });

  document.getElementById('app-forgot-password-form')?.addEventListener('submit', handleForgotPasswordSubmit);
}

async function handleForgotPasswordSubmit(event) {
  event.preventDefault();

  const form = event.currentTarget;
  const email = document.getElementById('app-forgot-email')?.value?.trim() || '';
  const button = getSubmitButton(form);

  if (!email) {
    setFeedback('Informe seu e-mail.', 'error');
    return;
  }

  try {
    setButtonLoading(button, true, 'Enviando...');
    setFeedback('Enviando instruções...', 'neutral');

    await apiFetch('/api/auth/forgot-password', {
      method: 'POST',
      body: JSON.stringify({ email }),
    });

    setFeedback(
      'Se o e-mail estiver cadastrado, você receberá as instruções para redefinir sua senha em breve.',
      'success'
    );
  } catch (error) {
    setFeedback(
      error instanceof Error ? error.message : 'Não foi possível iniciar a recuperação de senha.',
      'error'
    );
  } finally {
    setButtonLoading(button, false);
  }
}

function renderResetPasswordScreen() {
  hideLoginForm();

  const token = getResetTokenFromUrl();
  const shell = ensureAuthShell();

  shell.innerHTML = `
    <form id="app-reset-password-form" style="display:grid;gap:16px;">
      <div style="display:grid;gap:6px;">
        <div style="font-size:22px;font-weight:900;color:#e8f0fe;">Criar nova senha</div>
        <div style="color:#8fa3c7;font-size:14px;line-height:1.55;">
          Defina uma nova senha para acessar o painel do dono.
        </div>
      </div>

      <div style="display:grid;gap:8px;">
        <label for="app-reset-password" style="font-size:12px;font-weight:800;color:#8fa3c7;letter-spacing:.08em;text-transform:uppercase;">Nova senha</label>
        <input
          id="app-reset-password"
          type="password"
          placeholder="Mínimo 8 caracteres, letras e números"
          autocomplete="new-password"
          style="
            width:100%;
            min-height:50px;
            border-radius:14px;
            border:1px solid rgba(79,195,247,.18);
            background:rgba(7,12,28,.72);
            color:#e8f0fe;
            padding:0 16px;
            font:inherit;
            box-sizing:border-box;
            outline:none;
          "
        />
      </div>

      <div style="display:grid;gap:8px;">
        <label for="app-reset-password-confirm" style="font-size:12px;font-weight:800;color:#8fa3c7;letter-spacing:.08em;text-transform:uppercase;">Confirmar nova senha</label>
        <input
          id="app-reset-password-confirm"
          type="password"
          placeholder="Repita a nova senha"
          autocomplete="new-password"
          style="
            width:100%;
            min-height:50px;
            border-radius:14px;
            border:1px solid rgba(79,195,247,.18);
            background:rgba(7,12,28,.72);
            color:#e8f0fe;
            padding:0 16px;
            font:inherit;
            box-sizing:border-box;
            outline:none;
          "
        />
      </div>

      <div
        style="
          border:1px solid rgba(79,195,247,.16);
          border-radius:14px;
          background:rgba(79,195,247,.05);
          padding:12px;
          color:#8fa3c7;
          font-size:12px;
          line-height:1.6;
        "
      >
        Use pelo menos 8 caracteres, misturando letras e números. Evite nome, telefone ou sequências óbvias.
      </div>

      <div style="display:flex;gap:10px;flex-wrap:wrap;justify-content:flex-end;">
        <button
          type="button"
          id="app-reset-back"
          style="
            min-height:44px;
            padding:0 16px;
            border-radius:12px;
            border:1px solid rgba(255,255,255,.12);
            background:rgba(255,255,255,.04);
            color:#8fa3c7;
            font:inherit;
            font-weight:800;
            cursor:pointer;
          "
        >
          Voltar para login
        </button>

        <button
          type="submit"
          style="
            min-height:44px;
            padding:0 16px;
            border-radius:12px;
            border:0;
            background:linear-gradient(135deg,#5dc8ff 0%,#2f8cff 55%,#1468ff 100%);
            color:#fff;
            font:inherit;
            font-weight:900;
            cursor:pointer;
          "
        >
          Redefinir senha
        </button>
      </div>
    </form>
  `;

  if (!token) {
    setFeedback('Link inválido ou expirado. Solicite uma nova recuperação de senha.', 'error');
    document.getElementById('app-reset-password-form')?.querySelector('button[type="submit"]')?.setAttribute('disabled', 'disabled');
  } else {
    setFeedback('', 'neutral');
  }

  document.getElementById('app-reset-back')?.addEventListener('click', () => {
    window.location.href = APP_LOGIN_PATH;
  });

  document.getElementById('app-reset-password-form')?.addEventListener('submit', handleResetPasswordSubmit);
}

async function handleResetPasswordSubmit(event) {
  event.preventDefault();

  const form = event.currentTarget;
  const button = getSubmitButton(form);
  const token = getResetTokenFromUrl();
  const newPassword = document.getElementById('app-reset-password')?.value || '';
  const confirmPassword = document.getElementById('app-reset-password-confirm')?.value || '';

  if (!token) {
    setFeedback('Link inválido ou expirado. Solicite uma nova recuperação de senha.', 'error');
    return;
  }

  if (!newPassword) {
    setFeedback('Informe a nova senha.', 'error');
    return;
  }

  const passwordError = validatePassword(newPassword);
  if (passwordError) {
    setFeedback(passwordError, 'error');
    return;
  }

  if (newPassword !== confirmPassword) {
    setFeedback('As senhas não conferem.', 'error');
    return;
  }

  try {
    setButtonLoading(button, true, 'Redefinindo...');
    setFeedback('Redefinindo senha...', 'neutral');

    await apiFetch('/api/auth/reset-password', {
      method: 'POST',
      body: JSON.stringify({
        token,
        newPassword,
      }),
    });

    setFeedback('Senha redefinida com sucesso! Você já pode fazer login.', 'success');

    setTimeout(() => {
      window.location.href = APP_LOGIN_PATH;
    }, 1600);
  } catch (error) {
    setFeedback(
      error instanceof Error ? error.message : 'Não foi possível redefinir a senha.',
      'error'
    );
  } finally {
    setButtonLoading(button, false);
  }
}

async function handleLoginSubmit(event) {
  event.preventDefault();

  const email = getLoginEmailInput()?.value?.trim() || '';
  const password = getLoginPasswordInput()?.value || '';
  const btn = getSubmitButton(event.target);

  if (!email) {
    setFeedback('Informe seu e-mail.', 'error');
    return;
  }

  if (!password) {
    setFeedback('Informe sua senha.', 'error');
    return;
  }

  try {
    setButtonLoading(btn, true, 'Entrando...');
    setFeedback('Entrando...', 'neutral');

    const payload = await apiFetch('/api/auth/login', {
      method: 'POST',
      body: JSON.stringify({
        email,
        password,
      }),
    });

    if (payload?.token) {
      setAuthToken(payload.token);
    }

    setFeedback('Login realizado com sucesso!', 'success');

    const licenseStatus = payload?.license?.status;

    if (licenseStatus === 'suspended' || licenseStatus === 'cancelled') {
      window.location.href = APP_SUBSCRIPTION_PATH;
      return;
    }

    window.location.href = APP_HOME_PATH;
  } catch (error) {
    setFeedback(error instanceof Error ? error.message : 'Não foi possível entrar.', 'error');
    setButtonLoading(btn, false);
  }
}

function bindLoginSubmitOnce() {
  const form = getLoginForm();

  if (!form || form.dataset.ownerLoginBound === 'true') return false;

  form.dataset.ownerLoginBound = 'true';
  form.addEventListener('submit', handleLoginSubmit);

  return true;
}

function initOwnerLoginRecovery() {
  if (isResetPasswordRoute()) {
    renderResetPasswordScreen();
    return true;
  }

  const form = getLoginForm();

  if (!form) return false;

  bindLoginSubmitOnce();
  ensureForgotPasswordLink();

  return true;
}

function bootstrapOwnerLoginRecovery() {
  if (initOwnerLoginRecovery()) return;

  let attempts = 0;
  const maxAttempts = 50;

  const timer = window.setInterval(() => {
    attempts += 1;

    if (initOwnerLoginRecovery() || attempts >= maxAttempts) {
      window.clearInterval(timer);
    }
  }, 100);
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', bootstrapOwnerLoginRecovery);
} else {
  bootstrapOwnerLoginRecovery();
}
