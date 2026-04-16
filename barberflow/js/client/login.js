import { loginClient } from '/js/client-auth-api.js';

function setFeedback(message, variant = 'neutral') {
  const el = document.getElementById('client-feedback');
  if (!el) return;

  el.textContent = message || '';
  el.className = `client-feedback ${variant === 'error' ? 'is-error' : variant === 'success' ? 'is-success' : ''}`;
}

document.getElementById('go-client-register')?.addEventListener('click', () => {
  window.location.href = '/client/cadastro/';
});

document.getElementById('go-client-forgot')?.addEventListener('click', () => {
  window.location.href = '/client/recuperar-senha/';
});

document.getElementById('client-login-form')?.addEventListener('submit', async (event) => {
  event.preventDefault();

  const identifier = document.getElementById('client-login-identifier')?.value?.trim() || '';
  const password = document.getElementById('client-login-password')?.value || '';

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
    });

    setFeedback(`Bem-vindo, ${data?.client?.name || 'cliente'}.`, 'success');

    setTimeout(() => {
      window.location.href = '/client/home/';
    }, 600);
  } catch (error) {
    setFeedback(error instanceof Error ? error.message : 'Não foi possível entrar.', 'error');
  }
});
