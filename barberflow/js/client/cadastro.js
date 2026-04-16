import { registerClient } from '/js/client-auth-api.js';

function setFeedback(message, variant = 'neutral') {
  const el = document.getElementById('client-feedback');
  if (!el) return;

  el.textContent = message || '';
  el.className = `client-feedback ${variant === 'error' ? 'is-error' : variant === 'success' ? 'is-success' : ''}`;
}

document.getElementById('go-client-login')?.addEventListener('click', () => {
  window.location.href = '/client/login/';
});

document.getElementById('client-register-form')?.addEventListener('submit', async (event) => {
  event.preventDefault();

  const name = document.getElementById('client-register-name')?.value?.trim() || '';
  const whatsapp = document.getElementById('client-register-whatsapp')?.value?.trim() || '';
  const email = document.getElementById('client-register-email')?.value?.trim() || '';
  const password = document.getElementById('client-register-password')?.value || '';
  const confirmPassword = document.getElementById('client-register-password-confirm')?.value || '';

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

  if (password.length < 6) {
    setFeedback('A senha deve ter pelo menos 6 caracteres.', 'error');
    return;
  }

  if (password !== confirmPassword) {
    setFeedback('As senhas não conferem.', 'error');
    return;
  }

  try {
    setFeedback('Criando sua conta...', 'neutral');

    const data = await registerClient({
      name,
      whatsapp,
      email,
      password,
    });

    setFeedback(`Conta criada com sucesso. Bem-vindo, ${data?.client?.name || 'cliente'}.`, 'success');

    setTimeout(() => {
      window.location.href = '/client/home/';
    }, 700);
  } catch (error) {
    setFeedback(error instanceof Error ? error.message : 'Não foi possível criar sua conta.', 'error');
  }
});
