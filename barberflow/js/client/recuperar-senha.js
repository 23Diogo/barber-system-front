import { forgotPasswordClient } from '/js/client-auth-api.js';

function setFeedback(message, variant = 'neutral') {
  const el = document.getElementById('client-feedback');
  if (!el) return;

  el.textContent = message || '';
  el.className = `client-feedback ${variant === 'error' ? 'is-error' : variant === 'success' ? 'is-success' : ''}`;
}

document.getElementById('go-client-login-back')?.addEventListener('click', () => {
  window.location.href = '/client/login/';
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
    setFeedback(error instanceof Error ? error.message : 'Não foi possível iniciar a recuperação.', 'error');
  }
});
