import { registerClient } from '../../services/client-auth.js';

function setFeedback(message, variant = 'neutral') {
  const el = document.getElementById('client-feedback');
  if (!el) return;

  el.textContent = message || '';
  el.className = `client-feedback ${
    variant === 'error'
      ? 'is-error'
      : variant === 'success'
        ? 'is-success'
        : ''
  }`;
}

export function renderClientRegister() {
  return `
    <form id="client-register-form" class="client-form">
      <div class="client-form-grid">
        <div class="client-form-field">
          <label class="client-form-label" for="client-register-name">
            Nome completo
          </label>
          <input
            id="client-register-name"
            class="client-form-input"
            type="text"
            placeholder="Digite seu nome completo"
            autocomplete="name"
          />
        </div>

        <div class="client-form-field">
          <label class="client-form-label" for="client-register-whatsapp">
            WhatsApp
          </label>
          <input
            id="client-register-whatsapp"
            class="client-form-input"
            type="text"
            placeholder="(11) 99999-9999"
            autocomplete="tel"
          />
        </div>

        <div class="client-form-field">
          <label class="client-form-label" for="client-register-email">
            E-mail
          </label>
          <input
            id="client-register-email"
            class="client-form-input"
            type="email"
            placeholder="seuemail@dominio.com"
            autocomplete="email"
          />
        </div>

        <div class="client-form-field">
          <label class="client-form-label" for="client-register-password">
            Senha
          </label>
          <input
            id="client-register-password"
            class="client-form-input"
            type="password"
            placeholder="Crie uma senha"
            autocomplete="new-password"
          />
        </div>

        <div class="client-form-field">
          <label class="client-form-label" for="client-register-password-confirm">
            Confirmar senha
          </label>
          <input
            id="client-register-password-confirm"
            class="client-form-input"
            type="password"
            placeholder="Repita sua senha"
            autocomplete="new-password"
          />
        </div>
      </div>

      <div class="client-form-actions">
        <button type="submit" class="btn-primary-gradient">
          Criar conta
        </button>

        <button
          type="button"
          class="btn-cancel"
          id="go-client-login"
        >
          Já tenho conta
        </button>
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

    const name =
      document.getElementById('client-register-name')?.value?.trim() || '';
    const whatsapp =
      document.getElementById('client-register-whatsapp')?.value?.trim() || '';
    const email =
      document.getElementById('client-register-email')?.value?.trim() || '';
    const password =
      document.getElementById('client-register-password')?.value || '';
    const confirmPassword =
      document.getElementById('client-register-password-confirm')?.value || '';

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

      setFeedback(
        `Conta criada com sucesso. Bem-vindo, ${data?.client?.name || 'cliente'}.`,
        'success'
      );

      setTimeout(() => {
        navigate('home');
      }, 700);
    } catch (error) {
      setFeedback(
        error instanceof Error ? error.message : 'Não foi possível criar sua conta.',
        'error'
      );
    }
  });
}
