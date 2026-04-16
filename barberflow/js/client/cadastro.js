import { clientRegister } from '../../services/client-auth.js';

function setFeedback(message, variant = 'neutral') {
  const el = document.getElementById('client-feedback');
  if (!el) return;
  el.textContent = message || '';
  el.className = `client-feedback is-${variant}`;
}

document.getElementById('client-register-form')?.addEventListener('submit', async (event) => {
  event.preventDefault();

  const name            = document.getElementById('client-register-name')?.value?.trim() || '';
  const whatsapp        = document.getElementById('client-register-whatsapp')?.value?.trim() || '';
  const email           = document.getElementById('client-register-email')?.value?.trim() || '';
  const password        = document.getElementById('client-register-password')?.value || '';
  const passwordConfirm = document.getElementById('client-register-password-confirm')?.value || '';

  if (!name)     { setFeedback('Informe seu nome.', 'error'); return; }
  if (!whatsapp) { setFeedback('Informe seu WhatsApp.', 'error'); return; }
  if (!password) { setFeedback('Crie uma senha.', 'error'); return; }

  if (password.length < 6) {
    setFeedback('A senha deve ter pelo menos 6 caracteres.', 'error');
    return;
  }

  if (password !== passwordConfirm) {
    setFeedback('As senhas não conferem.', 'error');
    return;
  }

  try {
    setFeedback('Criando sua conta...', 'neutral');
    await clientRegister({ name, whatsapp, email, password });
    setFeedback('Conta criada com sucesso!', 'success');
    window.location.href = '/client/home/';
  } catch (error) {
    setFeedback(error instanceof Error ? error.message : 'Não foi possível criar sua conta.', 'error');
  }
});
