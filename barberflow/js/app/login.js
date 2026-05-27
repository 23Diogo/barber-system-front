import { apiFetch, setAuthToken } from '../services/api.js';

const APP_LOGIN_PATH = '/app/login';
const APP_HOME_PATH = '/app';
const APP_SUBSCRIPTION_PATH = '/app/assinatura';

console.info('[BBarberFlow] owner login recovery loaded v4');

function setFeedback(message, variant = 'neutral') {
  const el = document.getElementById('app-feedback');
  if (!el) return;

  el.textContent = message || '';
  el.className = `ob-feedback is-${variant}`;
}

function getResetTokenFromUrl() {
  const params = new URLSearchParams(window.location.search);
  return String(params.get('token') || '').trim();
}

function isResetPasswordRoute() {
  return window.location.pathname === '/app/nova-senha' || Boolean(getResetTokenFromUrl());
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

function setAuthHeader(title, subtitle) {
  const titleEl = document.getElementById('app-auth-title');
  const subtitleEl = document.getElementById('app-auth-subtitle');

  if (titleEl) titleEl.textContent = title;
  if (subtitleEl) subtitleEl.textContent = subtitle;
}

function showView(viewName) {
  document.querySelectorAll('[data-auth-view]').forEach((el) => {
    el.hidden = el.dataset.authView !== viewName;
  });

  setFeedback('', 'neutral');

  if (viewName === 'login') {
    setAuthHeader('Entrar', 'Acesse o painel para gerenciar sua barbearia.');
  }

  if (viewName === 'forgot') {
    setAuthHeader('Recuperar senha', 'Vamos enviar um link seguro para você criar uma nova senha.');
  }

  if (viewName === 'sent') {
    setAuthHeader('Verifique seu e-mail', 'As instruções de recuperação foram enviadas.');
  }

  if (viewName === 'reset') {
    setAuthHeader('Criar nova senha', 'Defina uma nova senha para acessar o painel do dono.');
  }

  if (viewName === 'reset-success') {
    setAuthHeader('Senha redefinida', 'Sua senha foi atualizada com sucesso.');
  }
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

async function handleLoginSubmit(event) {
  event.preventDefault();

  const email = document.getElementById('app-login-email')?.value?.trim() || '';
  const password = document.getElementById('app-login-password')?.value || '';
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

    const sentEmail = document.getElementById('app-forgot-sent-email');
    if (sentEmail) sentEmail.textContent = email;

    showView('sent');
    setFeedback('Instruções enviadas. Confira seu e-mail.', 'success');
  } catch (error) {
    setFeedback(
      error instanceof Error ? error.message : 'Não foi possível iniciar a recuperação de senha.',
      'error'
    );
  } finally {
    setButtonLoading(button, false);
  }
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

    showView('reset-success');
    setFeedback('Senha redefinida com sucesso.', 'success');

    setTimeout(() => {
      window.location.href = APP_LOGIN_PATH;
    }, 1800);
  } catch (error) {
    setFeedback(
      error instanceof Error ? error.message : 'Não foi possível redefinir a senha.',
      'error'
    );
  } finally {
    setButtonLoading(button, false);
  }
}

function bindEvents() {
  document.getElementById('app-login-form')?.addEventListener('submit', handleLoginSubmit);
  document.getElementById('app-forgot-password-form')?.addEventListener('submit', handleForgotPasswordSubmit);
  document.getElementById('app-reset-password-form')?.addEventListener('submit', handleResetPasswordSubmit);

  document.getElementById('app-forgot-password-link')?.addEventListener('click', () => {
    const loginEmail = document.getElementById('app-login-email')?.value?.trim() || '';
    const forgotEmail = document.getElementById('app-forgot-email');

    if (forgotEmail && loginEmail) {
      forgotEmail.value = loginEmail;
    }

    showView('forgot');
  });

  document.getElementById('app-forgot-back')?.addEventListener('click', () => {
    showView('login');
  });

  document.getElementById('app-sent-back-login')?.addEventListener('click', () => {
    showView('login');
  });

  document.getElementById('app-sent-resend')?.addEventListener('click', () => {
    showView('forgot');
  });

  document.getElementById('app-reset-back')?.addEventListener('click', () => {
    window.location.href = APP_LOGIN_PATH;
  });

  document.getElementById('app-reset-success-login')?.addEventListener('click', () => {
    window.location.href = APP_LOGIN_PATH;
  });
}

function initOwnerLogin() {
  bindEvents();

  if (isResetPasswordRoute()) {
    if (!getResetTokenFromUrl()) {
      showView('reset');
      setFeedback('Link inválido ou expirado. Solicite uma nova recuperação de senha.', 'error');
      return;
    }

    showView('reset');
    return;
  }

  showView('login');
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initOwnerLogin);
} else {
  initOwnerLogin();
}
