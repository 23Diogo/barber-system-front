function isClientArea() {
  const path = window.location.pathname;
  return path === '/client' || path.startsWith('/client/');
}

async function initClientApp() {
  const { initClientRouter } = await import('./client/client-router.js');
  initClientRouter();
}

async function initAdminApp() {
  const [
    { bindSidebar },
    { initThemeToggle },
    { initModal },
    { initWidgets },
    { initDevAuth },
    { initDashboard },
    { navigate, initRouter },
  ] = await Promise.all([
    import('./components/sidebar.js'),
    import('./components/theme-toggle.js'),
    import('./components/modal.js'),
    import('./components/widgets.js'),
    import('./components/dev-auth.js'),
    import('./modules/dashboard.js'),
    import('./router.js'),
  ]);

  bindSidebar(navigate);
  initThemeToggle();
  initModal();
  initDashboard();
  initWidgets();
  initRouter();
  initDevAuth();
}

window.addEventListener('DOMContentLoaded', async () => {
  try {
    if (isClientArea()) {
      await initClientApp();
      return;
    }

    await initAdminApp();
  } catch (error) {
    console.error('Erro ao iniciar o BarberFlow:', error);
  }
});
