import { resetPasswordClient } from '../../services/client-auth.js';

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
            placeholder="Digite sua nova senha"
            autocomplete="new-password"
            minlength="6"
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
            minlength="6"
          />
        </div>
      </div>
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

    const newPassword =
      document.getElementById('client-nova-senha-password')?.value || '';
    const confirmPassword =
      document.getElementById('client-nova-senha-confirm')?.value || '';

    if (!newPassword) {
      setFeedback('Informe sua nova senha.', 'error');
      return;
    }

    if (newPassword.length < 6) {
      setFeedback('A senha deve ter pelo menos 6 caracteres.', 'error');
      return;
    }

    if (newPassword !== confirmPassword) {
      setFeedback('As senhas não conferem.', 'error');
      return;
    }

    try {
      setFeedback('Redefinindo senha...', 'neutral');
      await resetPasswordClient({ token, newPassword });
      setFeedback('Senha redefinida com sucesso! Você já pode fazer login.', 'success');

      setTimeout(() => {
        navigate('login');
      }, 2000);
    } catch (error) {
      setFeedback(
        error instanceof Error ? error.message : 'Não foi possível redefinir a senha.',
        'error'
      );
    }
  });
}
