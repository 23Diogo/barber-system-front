import { clientLogin } from '../../services/client-auth.js';

function escapeHtml(value) {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

function setFeedback(message, variant = 'neutral') {
  const el = document.getElementById('client-feedback');
  if (!el) return;

  el.textContent = message || '';
  el.className = `client-feedback is-${variant}`;
}

export function renderClientLogin() {
  return `
    <form id="client-login-form" class="client-form">
      <div class="client-field">
        <label class="client-label">WhatsApp ou e-mail</label>
        <input
          class="client-input"
          id="client-login-identifier"
          type="text"
          placeholder="(11) 99999-9999 ou email@dominio.com"
          autocomplete="username"
        />
      </div>

      <div class="client-field">
        <label class="client-label">Senha</label>
        <input
          class="client-input"
          id="client-login-password"
          type="password"
          placeholder="Digite sua senha"
          autocomplete="current-password"
        />
      </div>

      <button type="submit" class="client-primary-btn">Entrar</button>

      <div class="client-links">
        <button type="button" class="client-link-btn" id="go-client-register">Criar cadastro</button>
        <button type="button" class="client-link-btn" id="go-client-forgot">Esqueci minha senha</button>
      </div>
    </form>
  `;
}

export function initClientLoginPage({ navigate }) {
  document.getElementById('go-client-register')?.addEventListener('click', () => {
    navigate('cadastro');
  });

  document.getElementById('go-client-forgot')?.addEventListener('click', () => {
    navigate('recuperar-senha');
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
      const payload = await clientLogin({ identifier, password });
      const customerName = payload?.client?.name || 'Cliente';
      setFeedback(`Bem-vindo, ${escapeHtml(customerName)}.`, 'success');
      navigate('home');
    } catch (error) {
      setFeedback(error instanceof Error ? error.message : 'Não foi possível entrar.', 'error');
    }
  });
}
