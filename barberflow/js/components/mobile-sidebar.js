// ─── Sidebar mobile toggle ────────────────────────────────────────────────────

export function initMobileSidebar() {
  const topbar = document.querySelector('.topbar');
  const sidebar = document.querySelector('.sidebar');
  if (!topbar || !sidebar) return;

  const toggle =
    document.getElementById('sidebarToggle') ||
    document.querySelector('.sidebar-toggle');

  const backdrop =
    document.getElementById('sidebarBackdrop') ||
    document.querySelector('.sidebar-backdrop');

  if (!toggle || !backdrop) return;

  function openSidebar() {
    sidebar.classList.add('is-open');
    backdrop.classList.add('is-open');
    document.body.style.overflow = 'hidden';
  }

  function closeSidebar() {
    sidebar.classList.remove('is-open');
    backdrop.classList.remove('is-open');
    document.body.style.overflow = '';
  }

  toggle.addEventListener('click', () => {
    if (sidebar.classList.contains('is-open')) {
      closeSidebar();
    } else {
      openSidebar();
    }
  });

  backdrop.addEventListener('click', closeSidebar);

  sidebar.querySelectorAll('.nav-item, .sidebar-logout-btn').forEach(item => {
    item.addEventListener('click', () => {
      if (window.innerWidth <= 768) {
        closeSidebar();
      }
    });
  });

  window.addEventListener('resize', () => {
    if (window.innerWidth > 768) {
      closeSidebar();
    }
  });
}
