import { state } from '../state.js';
import { getItem, setItem } from '../utils/storage.js';

const THEME_STORAGE_KEY = 'barberflow-theme';

export function applyTheme(isDark) {
  state.darkMode = isDark;

  const dot = document.getElementById('themeDot');
  const label = document.getElementById('themeLabel');

  if (isDark) {
    document.body.classList.remove('light-theme');
    if (label) label.textContent = '🌙 Tema escuro';
    if (dot) {
      dot.style.transform = 'translateX(0)';
      dot.style.background = '#fff';
    }
    setItem(THEME_STORAGE_KEY, 'dark');
  } else {
    document.body.classList.add('light-theme');
    if (label) label.textContent = '☀️ Tema claro';
    if (dot) {
      dot.style.transform = 'translateX(15px)';
      dot.style.background = '#111827';
    }
    setItem(THEME_STORAGE_KEY, 'light');
  }
}

export function toggleTheme() {
  applyTheme(!state.darkMode);
}

export function initThemeToggle() {
  const savedTheme = getItem(THEME_STORAGE_KEY, 'dark');
  applyTheme(savedTheme !== 'light');

  const button = document.getElementById('themeToggleBtn');
  if (button) {
    button.addEventListener('click', toggleTheme);
  }
}
