import { registerClient } from '../../services/client-auth.js';
import {
  renderClientPasswordChecklist,
  validateStrongPassword,
} from '../client-password-policy.js';

const SLUG_KEY = 'barberflow.inviteSlug';

function getSlugFromPath() {
  const match = window.location.pathname.match(/\/client\/cadastro\/([^/]+)\/?$/);
  return match ? decodeURIComponent(match[1]).trim().toLowerCase() : '';
}

function getSlugFromQuery() {
  const params = new URLSearchParams(window.location.search);
  return (params.get('slug') || params.get('barbershop') || '').trim().toLowerCase();
}

function getSlugFromCookie() {
  try {
    const match = document.cookie.match(/bf_invite_slug=([^;]+)/);
    return match ? decodeURIComponent(match[1]).trim().toLowerCase() : '';
  } catch {
    return '';
  }
}

function getSlug() {
  const slug =
    getSlugFromPath() ||
    getSlugFromQuery() ||
    getSlugFromCookie() ||
    (sessionStorage.getItem(SLUG_KEY) || '').trim().toLowerCase();

  if (slug) {
    try {
      sessionStorage.setItem(SLUG_KEY, slug);
    } catch {}
  }

  return slug;
}

function clearSlug() {
  try {
    sessionStorage.removeItem(SLUG_KEY);
    document.cookie = 'bf_invite_slug=; Path=/; Max-Age=0';
  } catch {}
}

const _slugOnLoad = getSlug();

function setFeedback(message, variant = 'neutral') {
  const el = document.getElementById('client-feedback');

  if (!el) return;

  el.textContent = message || '';
  el.className = `client-feedback ${
    variant === 'error'
      ? 'is-error'
      : variant === 'success'
        ? 'is-success'
        : ''
  }`;
}

function getPasswordContext() {
  return {
    name: document.getElementById('client-register-name')?.value?.trim() || '',
    email: document.getElementById('client-register-email')?.value?.trim() || '',
    whatsapp: document.getElementById('client-register-whatsapp')?.value?.trim() || '',
  };
}

function updatePasswordChecklist() {
  const password = document.getElementById('client-register-password')?.value || '';
  const container = document.getElementById('client-register-password-strength');

  if (!container) return;

  container.innerHTML = renderClientPasswordChecklist(password, getPasswordContext());
}

function bindPasswordChecklist() {
  [
    'client-register-name',
    'client-register-email',
    'client-register-whatsapp',
    'client-register-password',
  ].forEach((id) => {
    document.getElementById(id)?.addEventListener('input', updatePasswordChecklist);
  });

  updatePasswordChecklist();
}

export function renderClientRegister() {
  return `
    <form id="client-register-form" class="client-form">
      <div class="client-form-grid">
        <div class="client-form-field">
          <label class="client-form-label" for="client-register-name">Nome completo</label>
          <input
            id="client-register-name"
            class="client-form-input"
            type="text"
            placeholder="Digite seu nome completo"
            autocomplete="name"
          />
        </div>

        <div class="client-form-field">
          <label class="client-form-label" for="client-register-whatsapp">WhatsApp</label>
          <input
            id="client-register-whatsapp"
            class="client-form-input"
            type="text"
            placeholder="(11) 99999-9999"
            autocomplete="tel"
          />
        </div>

        <div class="client-form-field">
          <label class="client-form-label" for="client-register-email">E-mail</label>
          <input
            id="client-register-email"
            class="client-form-input"
            type="email"
            placeholder="seuemail@dominio.com"
            autocomplete="email"
          />
        </div>

        <div class="client-form-field">
          <label class="client-form-label" for="client-register-password">Senha</label>
          <input
            id="client-register-password"
            class="client-form-input"
            type="password"
            placeholder="Mínimo 8 caracteres, letras, números e símbolo"
            autocomplete="new-password"
          />
        </div>

        <div class="client-form-field">
          <label class="client-form-label" for="client-register-password-confirm">Confirmar senha</label>
          <input
            id="client-register-password-confirm"
            class="client-form-input"
            type="password"
            placeholder="Repita sua senha"
            autocomplete="new-password"
          />
        </div>
      </div>

      <div id="client-register-password-strength"></div>

      <div class="client-form-actions">
        <button type="submit" class="btn-primary-gradient">Criar conta</button>
        <button type="button" class="btn-cancel" id="go-client-login">Já tenho conta</button>
      </div>
    </form>
  `;
}

export function initClientRegisterPage({ navigate }) {
  bindPasswordChecklist();

  document.getElementById('go-client-login')?.addEventListener('click', () => {
    navigate('login');
  });

  document.getElementById('client-register-form')?.addEventListener('submit', async (event) => {
    event.preventDefault();

    const name = document.getElementById('client-register-name')?.value?.trim() || '';
    const whatsapp = document.getElementById('client-register-whatsapp')?.value?.trim() || '';
    const email = document.getElementById('client-register-email')?.value?.trim() || '';
    const password = document.getElementById('client-register-password')?.value || '';
    const confirmPassword = document.getElementById('client-register-password-confirm')?.value || '';
    const slug = getSlug();

    if (!name) {
      setFeedback('Informe seu nome.', 'error');
      return;
    }

    if (!whatsapp && !email) {
      setFeedback('Informe WhatsApp ou e-mail.', 'error');
      return;
    }

    if (!password) {
      setFeedback('Crie uma senha.', 'error');
      return;
    }

    const passwordValidation = validateStrongPassword(password, {
      name,
      email,
      whatsapp,
    });

    if (!passwordValidation.valid) {
      setFeedback(passwordValidation.message, 'error');
      updatePasswordChecklist();
      return;
    }

    if (password !== confirmPassword) {
      setFeedback('As senhas não conferem.', 'error');
      return;
    }

    if (!slug) {
      setFeedback('Link de cadastro inválido. Solicite um novo link ao seu barbeiro.', 'error');
      return;
    }

    try {
      const button = event.target.querySelector('button[type="submit"]');

      if (button) {
        button.disabled = true;
        button.textContent = 'Criando...';
      }

      setFeedback('Criando sua conta...', 'neutral');

      const data = await registerClient({
        name,
        whatsapp,
        email,
        password,
        barbershopSlug: slug,
      });

      clearSlug();

      setFeedback(`Conta criada! Bem-vindo, ${data?.client?.name || 'cliente'}!`, 'success');

      setTimeout(() => {
        navigate('home');
      }, 700);
    } catch (error) {
      setFeedback(
        error instanceof Error ? error.message : 'Não foi possível criar sua conta.',
        'error'
      );

      const button = event.target.querySelector('button[type="submit"]');

      if (button) {
        button.disabled = false;
        button.textContent = 'Criar conta';
      }
    }
  });
}
