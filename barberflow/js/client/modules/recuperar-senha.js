import { forgotPasswordClient } from '../../services/client-auth.js';

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

export function renderClientForgotPassword() {
  return `
    <form id="client-forgot-form" class="client-form">
      <div class="client-form-grid">
        <div class="client-form-field">
          <label class="client-form-label" for="client-forgot-identifier">
            WhatsApp ou e-mail
          </label>
          <input
            id="client-forgot-identifier"
            class="client-form-input"
            type="text"
            placeholder="Digite seu WhatsApp ou e-mail"
            autocomplete="username"
          />
        </div>
      </div>

      <div class="client-form-actions">
        <button type="submit" class="btn-primary-gradient">
          Enviar instruções
        </button>

        <button
          type="button"
          class="btn-cancel"
          id="go-client-login-back"
        >
          Voltar para login
        </button>
      </div>
    </form>
  `;
}

export function initClientForgotPasswordPage({ navigate }) {
  document.getElementById('go-client-login-back')?.addEventListener('click', () => {
    navigate('login');
  });

  document.getElementById('client-forgot-form')?.addEventListener('submit', async (event) => {
    event.preventDefault();

    const identifier =
      document.getElementById('client-forgot-identifier')?.value?.trim() || '';

    if (!identifier) {
      setFeedback('Informe seu WhatsApp ou e-mail.', 'error');
      return;
    }

    try {
      setFeedback('Enviando instruções...', 'neutral');

      const data = await forgotPasswordClient({ identifier });

      if (data?.debugResetToken) {
        setFeedback(`Modo debug ativo. Token de reset: ${data.debugResetToken}`, 'success');
        return;
      }

      setFeedback(
        'Se os dados estiverem corretos, você receberá as instruções para redefinir sua senha.',
        'success'
      );
    } catch (error) {
      setFeedback(
        error instanceof Error
          ? error.message
          : 'Não foi possível iniciar a recuperação.',
        'error'
      );
    }
  });
}
