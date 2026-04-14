export function bindSidebar(onNavigate) {
  document.querySelectorAll('.nav-item[data-nav-target]').forEach((item) => {
    item.addEventListener('click', () => {
      onNavigate(item.dataset.navTarget);
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
