import { clientLogin } from '../services/client-auth.js';

function setFeedback(message, variant = 'neutral') {
  const el = document.getElementById('client-feedback');
  if (!el) return;
  el.textContent = message || '';
  el.className = `client-feedback${variant !== 'neutral' ? ` is-${variant}` : ''}`;
}

function escapeHtml(value) {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

document.getElementById('client-login-form')?.addEventListener('submit', async (event) => {
  event.preventDefault();

  const identifier = document.getElementById('client-login-identifier')?.value?.trim() || '';
  const password   = document.getElementById('client-login-password')?.value || '';

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
    const payload = await clientLogin({ identifier, password });
    const customerName = payload?.client?.name || 'Cliente';
    setFeedback(`Bem-vindo, ${escapeHtml(customerName)}.`, 'success');
    window.location.href = '/client/home/';
  } catch (error) {
    setFeedback(error instanceof Error ? error.message : 'Não foi possível entrar.', 'error');
  }
});
