import { requestClientPasswordReset } from '../../services/client-auth.js';

function setFeedback(message, variant = 'neutral') {
  const el = document.getElementById('client-feedback');
  if (!el) return;
  el.textContent = message || '';
  el.className = `client-feedback is-${variant}`;
}

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
