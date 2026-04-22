function escapeHtml(value) {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

function getInitials(name = '') {
  const parts = String(name || '')
    .trim()
    .split(/\s+/)
    .filter(Boolean);

  if (!parts.length) return 'CL';

  return parts
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() || '')
    .join('');
}

function renderClientNavItem({ route, label, icon, isActive = false, badge = '' }) {
  return `
    <div
      class="nav-item ${isActive ? 'active' : ''}"
      data-client-route="${escapeHtml(route)}"
      role="button"
      tabindex="0"
      aria-label="${escapeHtml(label)}"
    >
      ${icon}
      ${escapeHtml(label)}
      ${badge ? `<span class="nav-badge">${escapeHtml(badge)}</span>` : ''}
    </div>
  `;
}

function renderMenuIcon() {
  return `
    <svg fill="none" height="18" stroke="currentColor" stroke-width="2.2" viewBox="0 0 24 24" width="18" aria-hidden="true">
      <line x1="4" y1="6" x2="20" y2="6"></line>
      <line x1="4" y1="12" x2="20" y2="12"></line>
      <line x1="4" y1="18" x2="20" y2="18"></line>
    </svg>
  `;
}

function renderCloseIcon() {
  return `
    <svg fill="none" height="18" stroke="currentColor" stroke-width="2.2" viewBox="0 0 24 24" width="18" aria-hidden="true">
      <line x1="18" y1="6" x2="6" y2="18"></line>
      <line x1="6" y1="6" x2="18" y2="18"></line>
    </svg>
  `;
}

export function renderClientLayout(content, options = {}) {
  const {
    variant = 'auth',
    title = 'Portal do Cliente',
    subtitle = 'Acesse sua conta',
    showBack = false,
    showLogout = false,
    customerName = '',
    currentRoute = 'login',
    activeBarbershopName = 'Nenhuma barbearia selecionada',
  } = options;

  const safeCustomerName = escapeHtml(customerName);
  const initials = getInitials(customerName);

  if (variant === 'dashboard') {
    return `
      <div class="app client-dashboard-app">
        <button
          type="button"
          class="client-sidebar-overlay"
          id="client-sidebar-overlay"
          aria-label="Fechar menu lateral"
        ></button>

        <aside
          class="sidebar client-dashboard-sidebar"
          id="client-dashboard-sidebar"
          aria-label="Menu da área do cliente"
          aria-hidden="true"
        >
          <button
            type="button"
            class="client-sidebar-close-btn"
            id="client-sidebar-close-btn"
            aria-label="Fechar menu"
          >
            ${renderCloseIcon()}
          </button>

          <div class="logo-area">
            <div class="logo-mark">
              <span class="logo-mark-text">B</span>
            </div>

            <div class="logo-info">
              <div class="name">BarberFlow</div>
              <div class="shop">Área do Cliente</div>
              <div class="badge">CLIENT</div>
            </div>
          </div>

          <nav class="nav">
            <div class="nav-group-label">Principal</div>

            ${renderClientNavItem({
              route: 'home',
              label: 'Início',
              isActive: currentRoute === 'home',
              icon: `
                <svg class="nav-icon" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24">
                  <rect x="3" y="3" width="7" height="7" rx="1"></rect>
                  <rect x="14" y="3" width="7" height="7" rx="1"></rect>
                  <rect x="3" y="14" width="7" height="7" rx="1"></rect>
                  <rect x="14" y="14" width="7" height="7" rx="1"></rect>
                </svg>
              `,
            })}

            ${renderClientNavItem({
              route: 'agendar',
              label: 'Agendar horário',
              isActive: currentRoute === 'agendar',
              icon: `
                <svg class="nav-icon" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24">
                  <rect x="3" y="4" width="18" height="18" rx="2"></rect>
                  <line x1="16" y1="2" x2="16" y2="6"></line>
                  <line x1="8" y1="2" x2="8" y2="6"></line>
                  <line x1="3" y1="10" x2="21" y2="10"></line>
                </svg>
              `,
            })}

            ${renderClientNavItem({
              route: 'agendamentos',
              label: 'Meus agendamentos',
              isActive: currentRoute === 'agendamentos',
              icon: `
                <svg class="nav-icon" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24">
                  <path d="M8 6h13"></path>
                  <path d="M8 12h13"></path>
                  <path d="M8 18h13"></path>
                  <path d="M3 6h.01"></path>
                  <path d="M3 12h.01"></path>
                  <path d="M3 18h.01"></path>
                </svg>
              `,
            })}

            <div class="nav-group-label">Planos</div>

            ${renderClientNavItem({
              route: 'planos',
              label: 'Contratar plano',
              isActive: currentRoute === 'planos',
              icon: `
                <svg class="nav-icon" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24">
                  <path d="M12 1v22"></path>
                  <path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"></path>
                </svg>
              `,
            })}

            ${renderClientNavItem({
              route: 'assinatura',
              label: 'Meu plano',
              isActive: currentRoute === 'assinatura',
              icon: `
                <svg class="nav-icon" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24">
                  <path d="M20 6 9 17l-5-5"></path>
                </svg>
              `,
            })}

            <div class="nav-group-label">Conta</div>

            ${renderClientNavItem({
              route: 'barbearias',
              label: 'Minhas barbearias',
              isActive: currentRoute === 'barbearias',
              icon: `
                <svg class="nav-icon" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24">
                  <path d="M3 21h18"></path>
                  <path d="M5 21V7l7-4 7 4v14"></path>
                  <path d="M9 9h6"></path>
                </svg>
              `,
            })}

            ${renderClientNavItem({
              route: 'dados',
              label: 'Meus dados',
              isActive: currentRoute === 'dados',
              icon: `
                <svg class="nav-icon" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24">
                  <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"></path>
                  <circle cx="12" cy="7" r="4"></circle>
                </svg>
              `,
            })}

            ${renderClientNavItem({
              route: 'pagamentos',
              label: 'Pagamentos',
              isActive: currentRoute === 'pagamentos',
              icon: `
                <svg class="nav-icon" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24">
                  <rect x="2" y="5" width="20" height="14" rx="2"></rect>
                  <line x1="2" y1="10" x2="22" y2="10"></line>
                </svg>
              `,
            })}

            ${renderClientNavItem({
              route: 'suporte',
              label: 'Suporte',
              isActive: currentRoute === 'suporte',
              icon: `
                <svg class="nav-icon" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24">
                  <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"></path>
                </svg>
              `,
            })}
          </nav>

          <div class="sidebar-footer">
            <div class="user-card">
              <div class="avatar">${escapeHtml(initials)}</div>
              <div>
                <div style="font-size:11px;font-weight:600">${safeCustomerName || 'Cliente'}</div>
                <div style="font-size:9px;color:#3a4568">Portal do cliente</div>
              </div>
            </div>

            <div
              class="theme-btn"
              id="client-logout-btn"
              role="button"
              tabindex="0"
              aria-label="Sair da conta"
            >
              <span>🚪 Sair da conta</span>
            </div>
          </div>
        </aside>

        <div class="main client-dashboard-main">
          <div class="topbar client-dashboard-topbar">
            <div class="client-topbar-leading">
              <button
                type="button"
                class="client-mobile-menu-btn"
                id="client-mobile-menu-btn"
                aria-label="Abrir menu"
                aria-expanded="false"
                aria-controls="client-dashboard-sidebar"
              >
                ${renderMenuIcon()}
              </button>

              <div class="topbar-title" id="pageTitle">${escapeHtml(title)}</div>
            </div>

            <div class="search-box client-dashboard-search-box">
              <svg fill="none" height="12" stroke="currentColor" stroke-width="2.5" viewBox="0 0 24 24" width="12">
                <circle cx="11" cy="11" r="8"></circle>
                <line x1="21" y1="21" x2="16.65" y2="16.65"></line>
              </svg>
              Barbearia atual: ${escapeHtml(activeBarbershopName)}
            </div>

            <div class="client-topbar-actions">
              <div class="notif-btn" title="Notificações">
                <svg fill="none" height="14" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24" width="14">
                  <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"></path>
                  <path d="M13.73 21a2 2 0 0 1-3.46 0"></path>
                </svg>
                <div class="notif-dot"></div>
              </div>

              <div class="avatar">${escapeHtml(initials)}</div>
            </div>
          </div>

          <div class="content client-dashboard-content">
            ${content}
          </div>
        </div>
      </div>
    `;
  }

  const authBrandRoutes = new Set(['login', 'cadastro', 'recuperar-senha']);
  const shouldShowAuthHero = authBrandRoutes.has(currentRoute);
  const shouldShowAuthHeader = showBack || showLogout;

  return `
    <div class="client-shell">
      <div class="client-bg-orb client-bg-orb--one"></div>
      <div class="client-bg-orb client-bg-orb--two"></div>

      ${shouldShowAuthHeader ? `
        <header class="client-header client-header--auth-actions-only">
          <div class="client-header-actions">
            ${showBack ? '<button type="button" class="client-header-btn" id="client-back-btn">Voltar</button>' : ''}
            ${showLogout ? '<button type="button" class="client-header-btn client-header-btn--danger" id="client-logout-btn">Sair</button>' : ''}
          </div>
        </header>
      ` : ''}

      <main class="client-main">
        <section class="client-card ${shouldShowAuthHero ? 'client-card--login' : ''}">
          ${shouldShowAuthHero ? `
            <div class="client-login-brand-hero" aria-label="BarberFlow">
              <div class="client-login-brand-mark">B</div>
              <div class="client-login-brand-wordmark">
                <span class="client-login-brand-wordmark-main">Barber</span><span class="client-login-brand-wordmark-accent">Flow</span>
              </div>
            </div>
          ` : ''}

          <div class="client-card-top ${shouldShowAuthHero ? 'client-card-top--login' : ''}">
            <div>
              <h1 class="client-title">${escapeHtml(title)}</h1>
              <p class="client-subtitle">${escapeHtml(subtitle)}</p>
            </div>
            ${customerName ? `<div class="client-user-badge">${safeCustomerName}</div>` : ''}
          </div>

          <div id="client-feedback" class="client-feedback"></div>

          ${content}
        </section>
      </main>
    </div>
  `;
}
