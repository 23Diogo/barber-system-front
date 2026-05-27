import { apiFetch, setAuthToken } from '../services/api.js';

const APP_LOGIN_PATH = '/app/login';
const APP_HOME_PATH = '/app';
const APP_SUBSCRIPTION_PATH = '/app/assinatura';

console.info('[BBarberFlow] owner login recovery loaded v3');

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

function ownerInputStyle() {
  return [
    'width:100%',
    'min-height:52px',
    'border-radius:16px',
    'border:1px solid rgba(79,195,247,.18)',
    'background:rgba(7,12,28,.72)',
    'box-shadow:inset 0 0 0 1px rgba(255,255,255,.02)',
    'color:#e8f0fe',
    'padding:0 16px',
    'font:inherit',
    'font-size:15px',
    'box-sizing:border-box',
    'outline:none',
  ].join(';');
}

function primaryButtonStyle() {
  return [
    'width:100%',
    'min-height:52px',
    'padding:0 18px',
    'border-radius:16px',
    'border:0',
    'background:linear-gradient(135deg,#5dc8ff 0%,#2f8cff 55%,#1468ff 100%)',
    'box-shadow:0 16px 34px rgba(47,140,255,.25)',
    'color:#fff',
    'font:inherit',
    'font-size:15px',
    'font-weight:900',
    'cursor:pointer',
  ].join(';');
}

function secondaryButtonStyle() {
  return [
    'width:100%',
    'min-height:48px',
    'padding:0 18px',
    'border-radius:16px',
    'border:1px solid rgba(79,195,247,.20)',
    'background:rgba(79,195,247,.06)',
    'color:#7dd3fc',
    'font:inherit',
    'font-size:14px',
    'font-weight:800',
    'cursor:pointer',
  ].join(';');
}

function linkButtonStyle() {
  return [
    'appearance:none',
    'border:0',
    'background:transparent',
    'color:#4fc3f7',
    'font:inherit',
    'font-size:13px',
    'font-weight:800',
    'cursor:pointer',
    'padding:6px 0',
    'text-align:right',
  ].join(';');
}

function authCardHtml(title, subtitle, innerHtml) {
  return `
    <div
      style="
        width:min(100%, 380px);
        margin:0 auto;
        display:grid;
        gap:18px;
      "
    >
      <div
        style="
          border:1px solid rgba(79,195,247,.16);
          background:linear-gradient(180deg, rgba(10,16,36,.86), rgba(7,11,26,.74));
          box-shadow:0 24px 70px rgba(0,0,0,.22), 0 0 80px rgba(79,195,247,.06);
          border-radius:24px;
          padding:24px;
          display:grid;
          gap:18px;
          backdrop-filter:blur(14px);
        "
      >
        <div style="display:grid;gap:8px;">
          <div
            style="
              display:inline-flex;
              width:max-content;
              align-items:center;
              gap:8px;
              padding:7px 10px;
              border-radius:999px;
              border:1px solid rgba(79,195,247,.18);
              background:rgba(79,195,247,.07);
              color:#7dd3fc;
              font-size:11px;
              font-weight:900;
              letter-spacing:.08em;
              text-transform:uppercase;
            "
          >
            Segurança da conta
          </div>

          <div style="font-size:24px;font-weight:900;color:#e8f0fe;line-height:1.15;">
            ${escapeHtml(title)}
          </div>

          <div style="color:#8fa3c7;font-size:14px;line-height:1.55;">
            ${escapeHtml(subtitle)}
          </div>
        </div>

        ${innerHtml}
      </div>
    </div>
  `;
}

function ensureAuthShell() {
  let shell = document.getElementById('app-auth-flow');

  if (!shell) {
    const form = getLoginForm();

    shell = document.createElement('div');
    shell.id = 'app-auth-flow';

    if (form?.parentElement) {
      form.insertAdjacentElement('afterend', shell);
    } else {
      document.body.appendChild(shell);
    }
  }

  shell.style.cssText = [
    'width:100%',
    'max-width:100%',
    'display:grid',
    'justify-items:center',
    'margin-top:18px',
  ].join(';');

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
    shell.removeAttribute('style');
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
    <button type="button" id="app-forgot-password-link" style="${linkButtonStyle()}">
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

  shell.innerHTML = authCardHtml(
    'Recuperar senha',
    'Digite o e-mail do dono. Se a conta existir, enviaremos um link seguro para redefinir a senha.',
    `
      <form id="app-forgot-password-form" style="display:grid;gap:16px;">
        <div style="display:grid;gap:8px;">
          <label
            for="app-forgot-email"
            style="font-size:11px;font-weight:900;color:#8fa3c7;letter-spacing:.10em;text-transform:uppercase;"
          >
            E-mail de acesso
          </label>

          <input
            id="app-forgot-email"
            type="email"
            placeholder="seu-email@dominio.com"
            autocomplete="email"
            value="${escapeHtml(email)}"
            style="${ownerInputStyle()}"
          />
        </div>

        <div
          style="
            border:1px solid rgba(255,193,7,.16);
            background:rgba(255,193,7,.06);
            color:#ffd166;
            border-radius:16px;
            padding:12px;
            font-size:12px;
            line-height:1.55;
          "
        >
          Por segurança, não informamos se o e-mail existe ou não. Verifique sua caixa de entrada e spam.
        </div>

        <div style="display:grid;gap:10px;">
          <button type="submit" style="${primaryButtonStyle()}">
            Enviar instruções
          </button>

          <button type="button" id="app-forgot-back" style="${secondaryButtonStyle()}">
            Voltar para login
          </button>
        </div>
      </form>
    `
  );

  setFeedback('', 'neutral');

  document.getElementById('app-forgot-back')?.addEventListener('click', () => {
    showLoginForm();
  });

  document.getElementById('app-forgot-password-form')?.addEventListener('submit', handleForgotPasswordSubmit);
}

function renderForgotPasswordSent(email) {
  const shell = ensureAuthShell();

  shell.innerHTML = authCardHtml(
    'Verifique seu e-mail',
    'Se encontramos uma conta com esse e-mail, enviamos um link para redefinir sua senha.',
    `
      <div style="display:grid;gap:16px;">
        <div
          style="
            width:58px;
            height:58px;
            border-radius:20px;
            display:flex;
            align-items:center;
            justify-content:center;
            background:rgba(0,230,118,.10);
            border:1px solid rgba(0,230,118,.24);
            color:#00e676;
            font-size:28px;
            font-weight:900;
          "
        >
          ✓
        </div>

        <div
          style="
            border:1px solid rgba(79,195,247,.16);
            background:rgba(79,195,247,.05);
            color:#dce8ff;
            border-radius:16px;
            padding:12px;
            font-size:13px;
            line-height:1.55;
            overflow-wrap:anywhere;
          "
        >
          Enviamos as instruções para:
          <strong style="color:#7dd3fc;">${escapeHtml(email)}</strong>
        </div>

        <div style="color:#8fa3c7;font-size:13px;line-height:1.65;">
          Abra o e-mail e clique no botão de redefinição. O link levará para a tela
          <strong style="color:#dce8ff;">Criar nova senha</strong>.
        </div>

        <div style="display:grid;gap:10px;">
          <button type="button" id="app-sent-back-login" style="${primaryButtonStyle()}">
            Voltar para login
          </button>

          <button type="button" id="app-sent-resend" style="${secondaryButtonStyle()}">
            Enviar novamente
          </button>
        </div>
      </div>
    `
  );

  setFeedback('Instruções enviadas. Confira seu e-mail.', 'success');

  document.getElementById('app-sent-back-login')?.addEventListener('click', () => {
    showLoginForm();
  });

  document.getElementById('app-sent-resend')?.addEventListener('click', () => {
    renderForgotPasswordScreen();
    const input = document.getElementById('app-forgot-email');
    if (input) input.value = email;
  });
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

    renderForgotPasswordSent(email);
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

  shell.innerHTML = authCardHtml(
    'Criar nova senha',
    'Defina uma nova senha para voltar a acessar o painel do dono.',
    `
      <form id="app-reset-password-form" style="display:grid;gap:16px;">
        <div style="display:grid;gap:8px;">
          <label
            for="app-reset-password"
            style="font-size:11px;font-weight:900;color:#8fa3c7;letter-spacing:.10em;text-transform:uppercase;"
          >
            Nova senha
          </label>

          <input
            id="app-reset-password"
            type="password"
            placeholder="Mínimo 8 caracteres, letras e números"
            autocomplete="new-password"
            style="${ownerInputStyle()}"
          />
        </div>

        <div style="display:grid;gap:8px;">
          <label
            for="app-reset-password-confirm"
            style="font-size:11px;font-weight:900;color:#8fa3c7;letter-spacing:.10em;text-transform:uppercase;"
          >
            Confirmar nova senha
          </label>

          <input
            id="app-reset-password-confirm"
            type="password"
            placeholder="Repita a nova senha"
            autocomplete="new-password"
            style="${ownerInputStyle()}"
          />
        </div>

        <div
          style="
            border:1px solid rgba(79,195,247,.16);
            border-radius:16px;
            background:rgba(79,195,247,.05);
            padding:12px;
            color:#8fa3c7;
            font-size:12px;
            line-height:1.6;
          "
        >
          Use pelo menos 8 caracteres, misturando letras e números. Evite nome, telefone ou sequências óbvias.
        </div>

        <div style="display:grid;gap:10px;">
          <button type="submit" style="${primaryButtonStyle()}">
            Redefinir senha
          </button>

          <button type="button" id="app-reset-back" style="${secondaryButtonStyle()}">
            Voltar para login
          </button>
        </div>
      </form>
    `
  );

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

function renderResetPasswordSuccess() {
  const shell = ensureAuthShell();

  shell.innerHTML = authCardHtml(
    'Senha redefinida',
    'Sua nova senha foi salva com sucesso. Agora você já pode entrar no painel do dono.',
    `
      <div style="display:grid;gap:16px;">
        <div
          style="
            width:58px;
            height:58px;
            border-radius:20px;
            display:flex;
            align-items:center;
            justify-content:center;
            background:rgba(0,230,118,.10);
            border:1px solid rgba(0,230,118,.24);
            color:#00e676;
            font-size:28px;
            font-weight:900;
          "
        >
          ✓
        </div>

        <button type="button" id="app-reset-success-login" style="${primaryButtonStyle()}">
          Ir para login
        </button>
      </div>
    `
  );

  setFeedback('Senha redefinida com sucesso.', 'success');

  document.getElementById('app-reset-success-login')?.addEventListener('click', () => {
    window.location.href = APP_LOGIN_PATH;
  });

  setTimeout(() => {
    window.location.href = APP_LOGIN_PATH;
  }, 1800);
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

    renderResetPasswordSuccess();
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
