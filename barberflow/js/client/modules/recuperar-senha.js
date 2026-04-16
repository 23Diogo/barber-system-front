import { requestClientPasswordReset } from '../../services/client-auth.js';

function setFeedback(message, variant = 'neutral') {
  const el = document.getElementById('client-feedback');
  if (!el) return;

  el.textContent = message || '';
  el.className = `client-feedback is-${variant}`;
}

export function renderClientForgotPassword() {
  return `
    <form id="client-forgot-form" class="client-form">
      <div class="client-field">
        <label class="client-label">WhatsApp ou e-mail</label>
        <input
          class="client-input"
          id="client-forgot-identifier"
          type="text"
          placeholder="Informe seu WhatsApp ou e-mail"
        />
      </div>

      <button type="submit" class="client-primary-btn">Enviar instruções</button>

      <div class="client-links">
        <button type="button" class="client-link-btn" id="go-client-login-from-forgot">Voltar para login</button>
      </div>
    </form>
  `;
}

export function initClientForgotPasswordPage({ navigate }) {
  document.getElementById('go-client-login-from-forgot')?.addEventListener('click', () => {
    navigate('login');
  });

  document.getElementById('client-forgot-form')?.addEventListener('submit', async (event) => {
    event.preventDefault();

    const identifier = document.getElementById('client-forgot-identifier')?.value?.trim() || '';

    if (!identifier) {
      setFeedback('Informe seu WhatsApp ou e-mail.', 'error');
      return;
    }

    try {
      setFeedback('Enviando instruções...', 'neutral');
      await requestClientPasswordReset({ identifier });
      setFeedback('Se os dados estiverem corretos, você receberá as instruções para redefinir sua senha.', 'success');
    } catch (error) {
      setFeedback(error instanceof Error ? error.message : 'Não foi possível iniciar a recuperação.', 'error');
    }
  });
}
