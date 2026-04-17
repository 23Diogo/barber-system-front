import {
  getClientPortalProfile,
  updateClientPortalProfile,
  changeClientPortalPassword,
} from '../../services/client-auth.js';

const state = {
  profile: null,
};

function escapeHtml(value) {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

function setFeedback(targetId, message, variant = 'neutral') {
  const el = document.getElementById(targetId);
  if (!el) return;

  el.textContent = message || '';
  el.className = `client-feedback-banner ${
    variant === 'error'
      ? 'is-error'
      : variant === 'success'
        ? 'is-success'
        : ''
  }`;
}

function getValue(id) {
  return document.getElementById(id)?.value?.trim() || '';
}

function renderProfileState() {
  const profileBox = document.getElementById('client-dados-profile-state');
  if (!profileBox) return;

  const client = state.profile?.client || {};
  const security = state.profile?.security || {};

  profileBox.innerHTML = `
    <div class="client-info-box">
      <div class="client-info-title">E-mail protegido</div>
      <div class="client-info-value">${escapeHtml(client.email || '-')}</div>
      <div class="client-help-note">
        ${escapeHtml(security.emailReason || 'Seu e-mail é protegido por segurança.')}
      </div>
    </div>
  `;

  const nameInput = document.getElementById('client-profile-name');
  const whatsappInput = document.getElementById('client-profile-whatsapp');
  const emailInput = document.getElementById('client-profile-email');

  if (nameInput) nameInput.value = client.name || '';
  if (whatsappInput) whatsappInput.value = client.whatsapp || '';
  if (emailInput) emailInput.value = client.email || '';
}

async function loadProfile() {
  const payload = await getClientPortalProfile();
  state.profile = payload || null;
  renderProfileState();
}

async function handleProfileSave() {
  const name = getValue('client-profile-name');
  const whatsapp = getValue('client-profile-whatsapp');

  if (!name) {
    setFeedback('client-profile-feedback', 'Informe seu nome.', 'error');
    return;
  }

  if (!whatsapp) {
    setFeedback('client-profile-feedback', 'Informe seu telefone/WhatsApp.', 'error');
    return;
  }

  try {
    const button = document.getElementById('client-profile-save-btn');
    if (button) button.disabled = true;

    setFeedback('client-profile-feedback', 'Salvando seus dados...', 'neutral');

    const payload = await updateClientPortalProfile({
      name,
      whatsapp,
    });

    state.profile = payload || null;
    renderProfileState();

    setFeedback('client-profile-feedback', 'Seus dados foram atualizados com sucesso.', 'success');
  } catch (error) {
    setFeedback(
      'client-profile-feedback',
      error instanceof Error ? error.message : 'Não foi possível atualizar seus dados.',
      'error'
    );
  } finally {
    const button = document.getElementById('client-profile-save-btn');
    if (button) button.disabled = false;
  }
}

async function handlePasswordChange() {
  const currentPassword = document.getElementById('client-password-current')?.value || '';
  const newPassword = document.getElementById('client-password-new')?.value || '';
  const confirmPassword = document.getElementById('client-password-confirm')?.value || '';

  if (!currentPassword) {
    setFeedback('client-password-feedback', 'Informe sua senha atual.', 'error');
    return;
  }

  if (!newPassword) {
    setFeedback('client-password-feedback', 'Informe a nova senha.', 'error');
    return;
  }

  if (newPassword.length < 6) {
    setFeedback('client-password-feedback', 'A nova senha deve ter pelo menos 6 caracteres.', 'error');
    return;
  }

  if (newPassword !== confirmPassword) {
    setFeedback('client-password-feedback', 'A confirmação da nova senha não confere.', 'error');
    return;
  }

  try {
    const button = document.getElementById('client-password-save-btn');
    if (button) button.disabled = true;

    setFeedback('client-password-feedback', 'Alterando sua senha...', 'neutral');

    await changeClientPortalPassword({
      currentPassword,
      newPassword,
      confirmPassword,
    });

    document.getElementById('client-password-current').value = '';
    document.getElementById('client-password-new').value = '';
    document.getElementById('client-password-confirm').value = '';

    setFeedback('client-password-feedback', 'Sua senha foi alterada com sucesso.', 'success');
  } catch (error) {
    setFeedback(
      'client-password-feedback',
      error instanceof Error ? error.message : 'Não foi possível alterar sua senha.',
      'error'
    );
  } finally {
    const button = document.getElementById('client-password-save-btn');
    if (button) button.disabled = false;
  }
}

export function renderClientDados() {
  return `
    <div id="pages" style="display:block">
      <div class="page active">
        <div class="client-portal-grid">
          <div class="card client-section-card">
            <div class="card-header">
              <div class="card-title">Meus dados</div>
              <div class="card-action" data-client-route="home">Voltar ao início</div>
            </div>

            <div id="client-profile-feedback" class="client-feedback-banner"></div>

            <div class="client-form-grid-two">
              <div class="client-form-field">
                <label class="client-form-label" for="client-profile-name">Nome</label>
                <input
                  id="client-profile-name"
                  class="client-form-input"
                  type="text"
                  placeholder="Seu nome"
                  autocomplete="name"
                />
              </div>

              <div class="client-form-field">
                <label class="client-form-label" for="client-profile-whatsapp">Telefone / WhatsApp</label>
                <input
                  id="client-profile-whatsapp"
                  class="client-form-input"
                  type="text"
                  placeholder="(11) 99999-9999"
                  autocomplete="tel"
                />
              </div>
            </div>

            <div class="client-form-field">
              <label class="client-form-label" for="client-profile-email">E-mail</label>
              <input
                id="client-profile-email"
                class="client-form-input client-input-readonly"
                type="email"
                disabled
                readonly
              />
            </div>

            <div id="client-dados-profile-state" class="client-portal-stack"></div>

            <div class="client-action-row">
              <button
                id="client-profile-save-btn"
                type="button"
                class="btn-primary-gradient"
              >
                Salvar dados
              </button>
            </div>
          </div>

          <div class="card client-section-card">
            <div class="card-header">
              <div class="card-title">Segurança</div>
            </div>

            <div class="client-help-note" style="margin-bottom:14px;">
              Para proteger sua conta, o e-mail fica bloqueado nesta área. Caso precise alterar esse dado no futuro, o ideal é usar um fluxo seguro de validação.
            </div>

            <div id="client-password-feedback" class="client-feedback-banner"></div>

            <div class="client-form-field">
              <label class="client-form-label" for="client-password-current">Senha atual</label>
              <input
                id="client-password-current"
                class="client-form-input"
                type="password"
                placeholder="Digite sua senha atual"
                autocomplete="current-password"
              />
            </div>

            <div class="client-form-field">
              <label class="client-form-label" for="client-password-new">Nova senha</label>
              <input
                id="client-password-new"
                class="client-form-input"
                type="password"
                placeholder="Digite sua nova senha"
                autocomplete="new-password"
              />
            </div>

            <div class="client-form-field">
              <label class="client-form-label" for="client-password-confirm">Confirmar nova senha</label>
              <input
                id="client-password-confirm"
                class="client-form-input"
                type="password"
                placeholder="Repita sua nova senha"
                autocomplete="new-password"
              />
            </div>

            <div class="client-action-row">
              <button
                id="client-password-save-btn"
                type="button"
                class="btn-primary-gradient"
              >
                Alterar senha
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  `;
}

export function initClientDadosPage() {
  (async () => {
    try {
      setFeedback('client-profile-feedback', 'Carregando seus dados...', 'neutral');
      await loadProfile();
      setFeedback('client-profile-feedback', 'Seus dados foram carregados.', 'neutral');
    } catch (error) {
      setFeedback(
        'client-profile-feedback',
        error instanceof Error ? error.message : 'Não foi possível carregar seus dados.',
        'error'
      );
    }
  })();

  document.getElementById('client-profile-save-btn')?.addEventListener('click', () => {
    handleProfileSave();
  });

  document.getElementById('client-password-save-btn')?.addEventListener('click', () => {
    handlePasswordChange();
  });
}
