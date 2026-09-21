/**
 * MAP LIQUID 3 - Dark & Light Theme Controller
 * Handles user preference persistence, instant pre-render initialization,
 * UI sync (buttons, icons, labels, meta theme-color), and cross-tab sync.
 */

const THEME_STORAGE_KEY = 'mapliquid_theme';

export function getAppTheme() {
  const currentAttr = document.documentElement.getAttribute('data-theme');
  if (currentAttr === 'dark' || currentAttr === 'light') {
    return currentAttr;
  }
  const saved = localStorage.getItem(THEME_STORAGE_KEY);
  if (saved === 'dark' || saved === 'light') {
    return saved;
  }
  // Check system preference as default
  if (window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches) {
    return 'dark';
  }
  return 'light';
}

export function updateThemeUI(theme) {
  const isDark = theme === 'dark';

  // 1. Update theme-color meta tag for browser address bars
  let metaTheme = document.querySelector('meta[name="theme-color"]');
  if (!metaTheme) {
    metaTheme = document.createElement('meta');
    metaTheme.setAttribute('name', 'theme-color');
    document.head.appendChild(metaTheme);
  }
  metaTheme.setAttribute('content', isDark ? '#0b0f17' : '#ffffff');

  // 2. Update Header Toggle Button(s)
  const themeBtns = document.querySelectorAll('#themeToggleBtn, .btn-theme-toggle');
  themeBtns.forEach((btn) => {
    btn.setAttribute('title', isDark ? 'Beralih ke Tema Terang' : 'Beralih ke Tema Gelap');
    btn.setAttribute('aria-label', isDark ? 'Beralih ke Tema Terang' : 'Beralih ke Tema Gelap');
    
    const icon = btn.querySelector('.theme-icon') || btn.querySelector('#themeIcon');
    if (icon) {
      icon.textContent = isDark ? '☀️' : '🌙';
    }
    const text = btn.querySelector('.theme-text') || btn.querySelector('#themeText');
    if (text) {
      text.textContent = isDark ? 'Terang' : 'Gelap';
    }
  });

  // 3. Update Modal Toggle Button in Settings (if present)
  const modalThemeIcon = document.getElementById('modalThemeIcon');
  const modalThemeText = document.getElementById('modalThemeText');
  if (modalThemeIcon) {
    modalThemeIcon.textContent = isDark ? '☀️' : '🌙';
  }
  if (modalThemeText) {
    modalThemeText.textContent = isDark ? 'Beralih ke Tema Terang' : 'Beralih ke Tema Gelap';
  }
}

export function applyTheme(theme, showNotification = false) {
  const selectedTheme = theme === 'dark' ? 'dark' : 'light';
  document.documentElement.setAttribute('data-theme', selectedTheme);
  
  try {
    localStorage.setItem(THEME_STORAGE_KEY, selectedTheme);
    // Backward compatibility for standard 'theme' key
    localStorage.setItem('theme', selectedTheme);
  } catch (e) {
    console.warn('Unable to persist theme to localStorage:', e);
  }

  updateThemeUI(selectedTheme);

  if (showNotification && typeof window.showToast === 'function') {
    window.showToast(selectedTheme === 'dark' ? 'Tema Gelap diaktifkan' : 'Tema Terang diaktifkan', 'info');
  }
}

export function toggleAppTheme() {
  const current = getAppTheme();
  const next = current === 'dark' ? 'light' : 'dark';
  applyTheme(next, true);
  return next;
}

export function initTheme() {
  const activeTheme = getAppTheme();
  applyTheme(activeTheme, false);

  // Synchronize across multiple browser tabs
  window.addEventListener('storage', (e) => {
    if (e.key === THEME_STORAGE_KEY || e.key === 'theme') {
      const newTheme = e.newValue === 'dark' ? 'dark' : 'light';
      if (newTheme !== getAppTheme()) {
        applyTheme(newTheme, false);
      }
    }
  });
}

// Attach to window object for inline HTML event handler accessibility (onclick="toggleAppTheme()")
if (typeof window !== 'undefined') {
  window.getAppTheme = getAppTheme;
  window.applyTheme = applyTheme;
  window.toggleAppTheme = toggleAppTheme;
  window.initTheme = initTheme;
  window.updateThemeUI = updateThemeUI;
}

// Auto-run when module is loaded
if (typeof document !== 'undefined') {
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => initTheme());
  } else {
    initTheme();
  }
}

export default {
  getAppTheme,
  applyTheme,
  toggleAppTheme,
  initTheme,
  updateThemeUI
};
