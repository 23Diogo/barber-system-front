import { apiFetch } from '../services/api.js';

// ─── Badge de novos clientes ──────────────────────────────────────────────────

const NEW_CLIENTS_KEY = 'barberflow_clients_last_seen';
let _badgeInterval   = null;

function _getLastSeen() {
  return localStorage.getItem(NEW_CLIENTS_KEY) || null;
}

function _setLastSeen() {
  localStorage.setItem(NEW_CLIENTS_KEY, new Date().toISOString());
}

function _getBadgeEl() {
  return document.getElementById('nav-badge-clientes');
}

function _renderBadge(count) {
  const navItem = document.querySelector('.nav-item[data-nav-target="clientes"]');
  if (!navItem) return;

  let badge = _getBadgeEl();

  if (!badge) {
    badge = document.createElement('span');
    badge.id = 'nav-badge-clientes';
    badge.style.cssText = `
      display: inline-flex;
      align-items: center;
      justify-content: center;
      min-width: 18px;
      height: 18px;
      padding: 0 5px;
      border-radius: 9px;
      background: #ff1744;
      color: #fff;
      font-size: 10px;
      font-weight: 800;
      line-height: 1;
      margin-left: auto;
      flex-shrink: 0;
      box-shadow: 0 0 8px rgba(255,23,68,.5);
      animation: badgePulse 1.8s ease-in-out infinite;
    `;

    // injeta animação uma vez
    if (!document.getElementById('badge-pulse-style')) {
      const style = document.createElement('style');
      style.id = 'badge-pulse-style';
      style.textContent = `
        @keyframes badgePulse {
          0%, 100% { box-shadow: 0 0 6px rgba(255,23,68,.4); }
          50%       { box-shadow: 0 0 14px rgba(255,23,68,.8); }
        }
      `;
      document.head.appendChild(style);
    }

    navItem.appendChild(badge);
  }

  if (count > 0) {
    badge.textContent  = count > 99 ? '99+' : String(count);
    badge.style.display = 'inline-flex';
  } else {
    badge.style.display = 'none';
  }
}

function clearNewClientsBadge() {
  _setLastSeen();
  const badge = _getBadgeEl();
  if (badge) badge.style.display = 'none';
}

async function _checkNewClients() {
  try {
    const lastSeen = _getLastSeen();
    if (!lastSeen) {
      // primeira vez: só registra o momento atual, sem mostrar badge
      _setLastSeen();
      return;
    }

    const data = await apiFetch(`/api/clients/new-count?since=${encodeURIComponent(lastSeen)}`);
    const count = Number(data?.count ?? 0);
    _renderBadge(count);
  } catch {
    // silencioso — não quebra a sidebar se a API falhar
  }
}

function initNewClientsBadge() {
  // checa imediatamente e depois a cada 60s
  _checkNewClients();
  if (_badgeInterval) clearInterval(_badgeInterval);
  _badgeInterval = setInterval(_checkNewClients, 60_000);
}

// ─── Logout ───────────────────────────────────────────────────────────────────

const AUTH_STORAGE_KEYS = [
  'barberflow.authToken',
  'barberflow.user',
  'barberflow.barbershop',
  'barberflow.authUser',
  'barberflow.auth.user',
  'barberflow.authBarbershop',
  'barberflow.license',
  'barberflow.devAuth',
];

function clearAuthStorage() {
  AUTH_STORAGE_KEYS.forEach((key) => {
    try { localStorage.removeItem(key); } catch {}
  });

  // Limpa variações futuras de autenticação sem apagar preferências visuais/widgets.
  try {
    Object.keys(localStorage).forEach((key) => {
      const normalized = key.toLowerCase();
      const isBarberFlowKey = normalized.startsWith('barberflow.');
      const looksLikeAuth =
        normalized.includes('authtoken') ||
        normalized.includes('token') ||
        normalized.includes('auth') ||
        normalized.includes('session') ||
        normalized.includes('license');

      if (isBarberFlowKey && looksLikeAuth) {
        localStorage.removeItem(key);
      }
    });
  } catch {}

  try { sessionStorage.clear(); } catch {}
}

export function logout() {
  clearAuthStorage();

  // Se algum dia a rota mudar, basta definir window.BARBERFLOW_LOGIN_URL antes do app iniciar.
  const loginUrl = window.BARBERFLOW_LOGIN_URL || '/login';
  window.location.replace(loginUrl);
}

function ensureLogoutButton() {
  const footer = document.querySelector('.sidebar-footer');
  if (!footer || document.getElementById('sidebar-logout-button')) return;

  const button = document.createElement('button');
  button.type = 'button';
  button.id = 'sidebar-logout-button';
  button.className = 'sidebar-logout-btn';
  button.setAttribute('aria-label', 'Sair do sistema');
  button.innerHTML = `
    <svg class="sidebar-logout-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
      <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/>
      <path d="M16 17l5-5-5-5"/>
      <path d="M21 12H9"/>
    </svg>
    <span class="sidebar-logout-text">Sair do sistema</span>
    <span class="sidebar-logout-hint">Logout</span>
  `;

  button.addEventListener('click', logout);
  footer.appendChild(button);
}

// ─── Sidebar ──────────────────────────────────────────────────────────────────

export function bindSidebar(onNavigate) {
  ensureLogoutButton();

  document.querySelectorAll('.nav-item[data-nav-target]').forEach((item) => {
    item.addEventListener('click', () => {
      const target = item.dataset.navTarget;

      // limpa badge ao entrar na página de clientes
      if (target === 'clientes') clearNewClientsBadge();

      onNavigate(target);
    });
  });
}

export function updateActiveNav(pageId) {
  document.querySelectorAll('.nav-item[data-nav-target]').forEach((item) => {
    item.classList.toggle('active', item.dataset.navTarget === pageId);
  });
}

export function findNavItemByPageId(pageId) {
  return document.querySelector(`.nav-item[data-nav-target="${pageId}"]`);
}

export { initNewClientsBadge, clearNewClientsBadge };
