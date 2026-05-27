import { resetPasswordClient } from '../../services/client-auth.js';
import {
  renderClientPasswordChecklist,
  validateStrongPassword,
} from '../client-password-policy.js';

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

function getTokenFromUrl() {
  const params = new URLSearchParams(window.location.search);
  return params.get('token') || '';
}

function updatePasswordChecklist() {
  const password = document.getElementById('client-nova-senha-password')?.value || '';
  const container = document.getElementById('client-nova-senha-password-strength');

  if (!container) return;

  container.innerHTML = renderClientPasswordChecklist(password);
}

function bindPasswordChecklist() {
  document
    .getElementById('client-nova-senha-password')
    ?.addEventListener('input', updatePasswordChecklist);

  updatePasswordChecklist();
}

export function renderClientNovaSenha() {
  return `
    <form id="client-nova-senha-form" class="client-form">
      <div class="client-form-grid">
        <div class="client-form-field">
          <label class="client-form-label" for="client-nova-senha-password">
            Nova senha
          </label>
          <input
            id="client-nova-senha-password"
            class="client-form-input"
            type="password"
            placeholder="Mínimo 8 caracteres, letras, números e símbolo"
            autocomplete="new-password"
          />
        </div>

        <div class="client-form-field">
          <label class="client-form-label" for="client-nova-senha-confirm">
            Confirmar nova senha
          </label>
          <input
            id="client-nova-senha-confirm"
            class="client-form-input"
            type="password"
            placeholder="Repita sua nova senha"
            autocomplete="new-password"
          />
        </div>
      </div>

      <div id="client-nova-senha-password-strength"></div>

      <div class="client-form-actions">
        <button type="submit" class="btn-primary-gradient">
          Redefinir senha
        </button>

        <button
          type="button"
          class="btn-cancel"
          id="go-client-login-from-reset"
        >
          Voltar para login
        </button>
      </div>
    </form>
  `;
}

export function initClientNovaSenhaPage({ navigate }) {
  const token = getTokenFromUrl();

  bindPasswordChecklist();

  if (!token) {
    setFeedback('Link inválido ou expirado. Solicite uma nova recuperação de senha.', 'error');
    document.getElementById('client-nova-senha-form')?.remove();
    return;
  }

  document.getElementById('go-client-login-from-reset')?.addEventListener('click', () => {
    navigate('login');
  });

  document.getElementById('client-nova-senha-form')?.addEventListener('submit', async (event) => {
    event.preventDefault();

    const newPassword = document.getElementById('client-nova-senha-password')?.value || '';
    const confirmPassword = document.getElementById('client-nova-senha-confirm')?.value || '';

    if (!newPassword) {
      setFeedback('Informe sua nova senha.', 'error');
      return;
    }

    const passwordValidation = validateStrongPassword(newPassword);

    if (!passwordValidation.valid) {
      setFeedback(passwordValidation.message, 'error');
      updatePasswordChecklist();
      return;
    }

    if (newPassword !== confirmPassword) {
      setFeedback('As senhas não conferem.', 'error');
      return;
    }

    try {
      const button = event.target.querySelector('button[type="submit"]');

      if (button) {
        button.disabled = true;
        button.textContent = 'Redefinindo...';
      }

      setFeedback('Redefinindo senha...', 'neutral');

      await resetPasswordClient({
        token,
        newPassword,
      });

      setFeedback('Senha redefinida com sucesso! Você já pode fazer login.', 'success');

      setTimeout(() => {
        navigate('login');
      }, 2000);
    } catch (error) {
      setFeedback(
        error instanceof Error ? error.message : 'Não foi possível redefinir a senha.',
        'error'
      );

      const button = event.target.querySelector('button[type="submit"]');

      if (button) {
        button.disabled = false;
        button.textContent = 'Redefinir senha';
      }
    }
  });
}
