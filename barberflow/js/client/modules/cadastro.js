import { clientRegister } from '../../services/client-auth.js';

function setFeedback(message, variant = 'neutral') {
  const el = document.getElementById('client-feedback');
  if (!el) return;

  el.textContent = message || '';
  el.className = `client-feedback is-${variant}`;
}

export function renderClientRegister() {
  return `
    <form id="client-register-form" class="client-form">
      <div class="client-field">
        <label class="client-label">Nome completo</label>
        <input class="client-input" id="client-register-name" type="text" placeholder="Seu nome" />
      </div>

      <div class="client-field">
        <label class="client-label">WhatsApp</label>
        <input class="client-input" id="client-register-whatsapp" type="text" placeholder="(11) 99999-9999" />
      </div>

      <div class="client-field">
        <label class="client-label">E-mail</label>
        <input class="client-input" id="client-register-email" type="email" placeholder="email@dominio.com" />
      </div>

      <div class="client-field">
        <label class="client-label">Senha</label>
        <input class="client-input" id="client-register-password" type="password" placeholder="Crie uma senha" />
      </div>

      <div class="client-field">
        <label class="client-label">Confirmar senha</label>
        <input class="client-input" id="client-register-password-confirm" type="password" placeholder="Repita a senha" />
      </div>

      <button type="submit" class="client-primary-btn">Criar conta</button>

      <div class="client-links">
        <button type="button" class="client-link-btn" id="go-client-login">Já tenho conta</button>
      </div>
    </form>
  `;
}

export function initClientRegisterPage({ navigate }) {
  document.getElementById('go-client-login')?.addEventListener('click', () => {
    navigate('login');
  });

  document.getElementById('client-register-form')?.addEventListener('submit', async (event) => {
    event.preventDefault();

    const name = document.getElementById('client-register-name')?.value?.trim() || '';
    const whatsapp = document.getElementById('client-register-whatsapp')?.value?.trim() || '';
    const email = document.getElementById('client-register-email')?.value?.trim() || '';
    const password = document.getElementById('client-register-password')?.value || '';
    const passwordConfirm = document.getElementById('client-register-password-confirm')?.value || '';

    if (!name) {
      setFeedback('Informe seu nome.', 'error');
      return;
    }

    if (!whatsapp) {
      setFeedback('Informe seu WhatsApp.', 'error');
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

    if (password !== passwordConfirm) {
      setFeedback('As senhas não conferem.', 'error');
      return;
    }

    try {
      setFeedback('Criando sua conta...', 'neutral');
      await clientRegister({ name, whatsapp, email, password });
      setFeedback('Conta criada com sucesso.', 'success');
      navigate('home');
    } catch (error) {
      setFeedback(error instanceof Error ? error.message : 'Não foi possível criar sua conta.', 'error');
    }
  });
}
