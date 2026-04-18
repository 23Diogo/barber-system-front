import { apiFetch, setAuthToken } from '../services/api.js';

function setFeedback(message, variant = 'neutral') {
  const el = document.getElementById('app-feedback');
  if (!el) return;
  el.textContent = message || '';
  el.className = `ob-feedback is-${variant}`;
}

document.getElementById('app-login-form')?.addEventListener('submit', async (event) => {
  event.preventDefault();

  const email    = document.getElementById('app-login-email')?.value?.trim() || '';
  const password = document.getElementById('app-login-password')?.value || '';
  const btn      = event.target.querySelector('button[type="submit"]');

  if (!email)    { setFeedback('Informe seu e-mail.', 'error'); return; }
  if (!password) { setFeedback('Informe sua senha.', 'error'); return; }

  try {
    if (btn) btn.disabled = true;
    setFeedback('Entrando...', 'neutral');

    const payload = await apiFetch('/api/auth/login', {
      method: 'POST',
      body: JSON.stringify({ email, password }),
    });

    if (payload?.token) {
      setAuthToken(payload.token);
    }

    setFeedback('Login realizado com sucesso!', 'success');
    window.location.href = '/app';
  } catch (error) {
    setFeedback(error instanceof Error ? error.message : 'Não foi possível entrar.', 'error');
    if (btn) btn.disabled = false;
  }
});
