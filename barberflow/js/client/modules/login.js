import { loginClient } from '../../services/client-auth.js';

const SLUG_KEY = 'barberflow.inviteSlug';

function getInviteSlug() {
  try {
    return (sessionStorage.getItem(SLUG_KEY) || '').trim().toLowerCase();
  } catch {
    return '';
  }
}

function clearInviteSlug() {
  try {
    sessionStorage.removeItem(SLUG_KEY);
  } catch {}
}

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

export function renderClientLogin() {
  return `
    <form id="client-login-form" class="client-form">
      <div class="client-form-grid">
        <div class="client-form-field">
          <label class="client-form-label" for="client-login-identifier">
            WhatsApp ou e-mail
          </label>
          <input
            id="client-login-identifier"
            class="client-form-input"
            type="text"
            placeholder="Digite seu WhatsApp ou e-mail"
            autocomplete="username"
          />
        </div>

        <div class="client-form-field">
          <label class="client-form-label" for="client-login-password">
            Senha
          </label>
          <input
            id="client-login-password"
            class="client-form-input"
            type="password"
            placeholder="Digite sua senha"
            autocomplete="current-password"
          />
        </div>
      </div>

      <div class="client-form-actions">
        <button type="submit" class="btn-primary-gradient">
          Entrar
        </button>

        <button
          type="button"
          class="btn-cancel"
          id="go-client-forgot"
        >
          Esqueci minha senha
        </button>
      </div>

      <div class="client-form-footer">
        <span>Ainda não tem conta?</span>
        <button
          type="button"
          class="client-link-btn"
          id="go-client-register"
        >
          Criar conta
        </button>
      </div>
    </form>
  `;
}

export function initClientLoginPage({ navigate }) {
  const inviteSlug = getInviteSlug();

  if (inviteSlug) {
    setFeedback(
      'Convite identificado. Faça login para vincular esta barbearia à sua conta.',
      'neutral'
    );
  }

  document.getElementById('go-client-register')?.addEventListener('click', () => {
    navigate('cadastro');
  });

  document.getElementById('go-client-forgot')?.addEventListener('click', () => {
    navigate('recuperar-senha');
  });

  document.getElementById('client-login-form')?.addEventListener('submit', async (event) => {
    event.preventDefault();

    const identifier =
      document.getElementById('client-login-identifier')?.value?.trim() || '';
    const password =
      document.getElementById('client-login-password')?.value || '';

    const pendingSlug = getInviteSlug();

    if (!identifier) {
      setFeedback('Informe seu WhatsApp ou e-mail.', 'error');
      return;
    }

    if (!password) {
      setFeedback('Informe sua senha.', 'error');
      return;
    }

    try {
      setFeedback('Entrando...', 'neutral');

      const data = await loginClient({
        identifier,
        password,
        barbershopSlug: pendingSlug || undefined,
      });

      clearInviteSlug();

      setFeedback(`Bem-vindo, ${data?.client?.name || 'cliente'}.`, 'success');

      setTimeout(() => {
        navigate('home');
      }, 600);
    } catch (error) {
      setFeedback(
        error instanceof Error ? error.message : 'Não foi possível entrar.',
        'error'
      );
    }
  });
}
