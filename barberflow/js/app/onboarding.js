import { apiFetch, setAuthToken } from '../services/api.js';

function setFeedback(message, variant = 'neutral') {
  const el = document.getElementById('ob-feedback');
  if (!el) return;
  el.textContent = message || '';
  el.className = `ob-feedback is-${variant}`;
}

document.getElementById('ob-form')?.addEventListener('submit', async (event) => {
  event.preventDefault();

  const barbershopName    = document.getElementById('ob-barbershop-name')?.value?.trim() || '';
  const ownerName         = document.getElementById('ob-owner-name')?.value?.trim() || '';
  const phone             = document.getElementById('ob-phone')?.value?.trim() || '';
  const email             = document.getElementById('ob-email')?.value?.trim() || '';
  const password          = document.getElementById('ob-password')?.value || '';
  const passwordConfirm   = document.getElementById('ob-password-confirm')?.value || '';
  const btn               = event.target.querySelector('button[type="submit"]');

  if (!barbershopName) { setFeedback('Informe o nome da barbearia.', 'error'); return; }
  if (!ownerName)      { setFeedback('Informe seu nome.', 'error'); return; }
  if (!phone)          { setFeedback('Informe seu WhatsApp.', 'error'); return; }
  if (!email)          { setFeedback('Informe seu e-mail.', 'error'); return; }
  if (!password)       { setFeedback('Crie uma senha.', 'error'); return; }

  if (password.length < 6) {
    setFeedback('A senha deve ter pelo menos 6 caracteres.', 'error');
    return;
  }

  if (password !== passwordConfirm) {
    setFeedback('As senhas não conferem.', 'error');
    return;
  }

  try {
    if (btn) btn.disabled = true;
    setFeedback('Criando sua conta...', 'neutral');

    const payload = await apiFetch('/api/auth/register', {
      method: 'POST',
      body: JSON.stringify({ barbershopName, ownerName, email, phone, password }),
    });

    if (payload?.token) {
      setAuthToken(payload.token);
    }

    setFeedback('Conta criada com sucesso! Redirecionando...', 'success');

    setTimeout(() => {
      window.location.href = '/app';
    }, 1200);
  } catch (error) {
    setFeedback(error instanceof Error ? error.message : 'Não foi possível criar sua conta.', 'error');
    if (btn) btn.disabled = false;
  }
});
