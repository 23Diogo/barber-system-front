import { state, resetAuthState, setAuthState } from '../state.js';
import {
  clearAuthToken,
  getApiBaseUrl,
  getAuthToken,
  getMe,
  loginWithEmail,
  setApiBaseUrl,
} from '../services/api.js';
import { getItem, setItem } from '../utils/storage.js';
import { refreshCurrentPage } from '../router.js';

const DEV_EMAIL_KEY = 'barberflow.devEmail';

function getInitials(name) {
  return String(name || 'BF')
    .trim()
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() || '')
    .join('') || 'BF';
}

function getBarbershopName(barbershop) {
  if (!barbershop) return null;
  if (Array.isArray(barbershop)) return barbershop[0]?.name || null;
  return barbershop.name || null;
}

function lockApp() {
  document.body.classList.add('auth-locked');
}

function unlockApp() {
  document.body.classList.remove('auth-locked');
}

function syncGateState() {
  if (state.auth.isAuthenticated) unlockApp();
  else lockApp();
}

function openAuthModal() {
  document.getElementById('authModal')?.classList.add('open');
  const apiInput = document.getElementById('authApiUrlInput');
  const emailInput = document.getElementById('authEmailInput');
  if (apiInput) apiInput.value = state.auth.apiBaseUrl || getApiBaseUrl() || '';
  if (emailInput) emailInput.value = state.auth.devEmail || getItem(DEV_EMAIL_KEY, '') || '';
  updateAuthModalState();
  syncGateState();
}

function closeAuthModal(force = false) {
  if (!force && !state.auth.isAuthenticated) return;
  document.getElementById('authModal')?.classList.remove('open');
}

function setAuthFeedback(message, variant = 'neutral') {
  const el = document.getElementById('authFeedback');
  if (!el) return;
  el.textContent = message || '';
  el.dataset.variant = variant;
}

function updateAuthUI() {
  const isConnected = state.auth.isAuthenticated;
  const userName = state.auth.user?.name || 'Diogo Barbeiro';
  const userRole = state.auth.user?.role || 'Modo desenvolvimento';
  const barbershopName = getBarbershopName(state.auth.barbershop) || state.shopName;

  const chip = document.getElementById('authStatusChip');
  if (chip) {
    chip.textContent = isConnected ? 'API conectada' : 'Login obrigatório';
    chip.classList.toggle('is-connected', isConnected);
  }

  const openBtn = document.getElementById('openAuthModalBtn');
  if (openBtn) {
    openBtn.textContent = isConnected ? '⚙️ Sessão ativa' : '🔐 Entrar';
    openBtn.classList.toggle('is-connected', isConnected);
  }

  const shopSub = document.getElementById('shopSub');
  if (shopSub) {
    shopSub.textContent = isConnected && barbershopName ? barbershopName : state.shopName;
  }

  const sidebarUserName = document.getElementById('sidebarUserName');
  if (sidebarUserName) sidebarUserName.textContent = isConnected ? userName : 'Acesso necessário';

  const sidebarUserRole = document.getElementById('sidebarUserRole');
  if (sidebarUserRole) sidebarUserRole.textContent = isConnected ? userRole : 'Faça login para liberar o sistema';

  ['sidebarAvatar', 'topAvatar'].forEach((id) => {
    const el = document.getElementById(id);
    if (el && !state.uploadedLogo) el.textContent = getInitials(userName);
  });

  const helper = document.getElementById('authHelperText');
  if (helper) {
    helper.textContent = isConnected
      ? `Conectado como ${userName} em ${barbershopName}. Você pode abrir este modal novamente para trocar a conexão ou sair.`
      : 'Informe a URL da API e o e-mail cadastrado. Sem autenticação, o BarberFlow permanece bloqueado.';
  }

  syncGateState();
}

function updateAuthModalState() {
  const status = document.getElementById('authCurrentStatus');
  const disconnectBtn = document.getElementById('authDisconnectBtn');
  const cancelBtn = document.getElementById('authCancelBtn');
  const isConnected = state.auth.isAuthenticated;

  if (status) {
    status.textContent = isConnected
      ? `Conectado com ${state.auth.user?.email || state.auth.devEmail || 'usuário atual'}`
      : 'Aguardando autenticação';
  }

  if (disconnectBtn) disconnectBtn.style.display = isConnected ? 'inline-flex' : 'none';
  if (cancelBtn) cancelBtn.style.display = isConnected ? 'inline-flex' : 'none';
}

async function hydrateSessionFromStoredToken() {
  const apiBaseUrl = getApiBaseUrl();
  const token = getAuthToken();
  const devEmail = getItem(DEV_EMAIL_KEY, '');

  setAuthState({ apiBaseUrl, token, devEmail, hydrated: true });

  if (!apiBaseUrl || !token) {
    updateAuthUI();
    updateAuthModalState();
    openAuthModal();
    return;
  }

  try {
    const me = await getMe();
    setAuthState({
      isAuthenticated: true,
      user: me,
      barbershop: me?.barbershops || null,
      hydrated: true,
    });
    setAuthFeedback('', 'neutral');
    updateAuthUI();
    updateAuthModalState();
    closeAuthModal(true);
  } catch (error) {
    clearAuthToken();
    resetAuthState();
    setAuthState({ apiBaseUrl, devEmail, hydrated: true });
    setAuthFeedback('Sua sessão expirou ou está inválida. Entre novamente para continuar.', 'error');
    updateAuthUI();
    updateAuthModalState();
    openAuthModal();
  }
}

async function handleAuthSubmit(event) {
  event.preventDefault();

  const apiUrlInput = document.getElementById('authApiUrlInput');
  const emailInput = document.getElementById('authEmailInput');
  const connectBtn = document.getElementById('authConnectBtn');

  const apiUrl = apiUrlInput?.value?.trim() || '';
  const email = emailInput?.value?.trim() || '';

  if (!apiUrl) {
    setAuthFeedback('Informe a URL pública da API no Railway.', 'error');
    return;
  }

  if (!email) {
    setAuthFeedback('Informe o e-mail do usuário/barbearia cadastrado no backend.', 'error');
    return;
  }

  try {
    if (connectBtn) {
      connectBtn.setAttribute('disabled', 'disabled');
      connectBtn.textContent = 'Conectando...';
    }

    const normalizedUrl = setApiBaseUrl(apiUrl);
    setItem(DEV_EMAIL_KEY, email);

    const payload = await loginWithEmail(email);
    const me = await getMe();

    setAuthState({
      apiBaseUrl: normalizedUrl,
      token: payload?.token || getAuthToken(),
      devEmail: email,
      isAuthenticated: true,
      user: payload?.user || me,
      barbershop: payload?.barbershop || me?.barbershops || null,
      hydrated: true,
    });

    setAuthFeedback('Login realizado com sucesso. O sistema foi liberado.', 'success');
    updateAuthUI();
    updateAuthModalState();
    refreshCurrentPage();
    setTimeout(() => closeAuthModal(true), 350);
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Não foi possível autenticar.';
    setAuthFeedback(message, 'error');
    updateAuthUI();
    updateAuthModalState();
    openAuthModal();
  } finally {
    if (connectBtn) {
      connectBtn.removeAttribute('disabled');
      connectBtn.textContent = 'Entrar e liberar sistema';
    }
  }
}

function handleDisconnect() {
  clearAuthToken();
  resetAuthState();
  setAuthState({ apiBaseUrl: getApiBaseUrl(), devEmail: getItem(DEV_EMAIL_KEY, '') || '', hydrated: true });
  setAuthFeedback('Sessão removida. Faça login novamente para continuar.', 'neutral');
  updateAuthUI();
  updateAuthModalState();
  refreshCurrentPage();
  openAuthModal();
}

export function initDevAuth() {
  document.addEventListener('click', (event) => {
    if (event.target.closest('[data-open-auth-modal]')) {
      openAuthModal();
    }
  });

  const authModal = document.getElementById('authModal');
  authModal?.addEventListener('click', (event) => {
    if (event.target === authModal && state.auth.isAuthenticated) closeAuthModal(true);
  });

  document.getElementById('authCancelBtn')?.addEventListener('click', () => closeAuthModal(true));
  document.getElementById('authDisconnectBtn')?.addEventListener('click', handleDisconnect);
  document.getElementById('authForm')?.addEventListener('submit', handleAuthSubmit);

  window.addEventListener('barberflow:open-auth', openAuthModal);

  hydrateSessionFromStoredToken();
}
