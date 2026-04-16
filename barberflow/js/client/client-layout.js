function escapeHtml(value) {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

export function renderClientLayout(content, options = {}) {
  const {
    title = 'Portal do Cliente',
    subtitle = 'Acesse sua conta',
    showBack = false,
    showLogout = false,
    customerName = '',
  } = options;

  return `
    <div class="client-shell">
      <div class="client-bg-orb client-bg-orb--one"></div>
      <div class="client-bg-orb client-bg-orb--two"></div>

      <header class="client-header">
        <div class="client-brand">
          <div class="client-brand-mark">B</div>
          <div>
            <div class="client-brand-title">BarberFlow</div>
            <div class="client-brand-sub">Portal do Cliente</div>
          </div>
        </div>

        <div class="client-header-actions">
          ${showBack ? '<button type="button" class="client-header-btn" id="client-back-btn">Voltar</button>' : ''}
          ${showLogout ? '<button type="button" class="client-header-btn client-header-btn--danger" id="client-logout-btn">Sair</button>' : ''}
        </div>
      </header>

      <main class="client-main">
        <section class="client-card">
          <div class="client-card-top">
            <div>
              <h1 class="client-title">${escapeHtml(title)}</h1>
              <p class="client-subtitle">${escapeHtml(subtitle)}</p>
            </div>
            ${customerName ? `<div class="client-user-badge">${escapeHtml(customerName)}</div>` : ''}
          </div>

          <div id="client-feedback" class="client-feedback"></div>

          ${content}
        </section>
      </main>
    </div>
  `;
}
