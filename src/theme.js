/**
 * MAP LIQUID 3 - Dark & Light Theme Controller
 * Handles user preference persistence, instant pre-render initialization,
 * UI sync (buttons, crisp SVGs, labels, meta theme-color), and cross-tab sync.
 */

const THEME_STORAGE_KEY = 'mapliquid_theme';

const SUN_SVG = `<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="5"></circle><line x1="12" y1="1" x2="12" y2="3"></line><line x1="12" y1="21" x2="12" y2="23"></line><line x1="4.22" y1="4.22" x2="5.64" y2="5.64"></line><line x1="18.36" y1="18.36" x2="19.78" y2="19.78"></line><line x1="1" y1="12" x2="3" y2="12"></line><line x1="21" y1="12" x2="23" y2="12"></line><line x1="4.22" y1="19.78" x2="5.64" y2="18.36"></line><line x1="18.36" y1="5.64" x2="19.78" y2="4.22"></line></svg>`;

const MOON_SVG = `<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"></path></svg>`;

export function getAppTheme() {
  if (typeof document !== 'undefined') {
    const currentAttr = document.documentElement.getAttribute('data-theme');
    if (currentAttr === 'dark' || currentAttr === 'light') {
      return currentAttr;
    }
  }
  try {
    const saved = localStorage.getItem(THEME_STORAGE_KEY) || localStorage.getItem('theme');
    if (saved === 'dark' || saved === 'light') {
      return saved;
    }
  } catch (e) {}

  // Check system preference as default
  if (typeof window !== 'undefined' && window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches) {
    return 'dark';
  }
  return 'light';
}

export function updateThemeUI(theme) {
  if (typeof document === 'undefined') return;
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
      icon.innerHTML = isDark ? SUN_SVG : MOON_SVG;
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
    modalThemeIcon.innerHTML = isDark ? SUN_SVG : MOON_SVG;
  }
  if (modalThemeText) {
    modalThemeText.textContent = isDark ? 'Beralih ke Tema Terang' : 'Beralih ke Tema Gelap';
  }
}

export function applyTheme(theme, showNotification = false) {
  const selectedTheme = theme === 'dark' ? 'dark' : 'light';
  if (typeof document !== 'undefined') {
    document.documentElement.setAttribute('data-theme', selectedTheme);
  }
  
  try {
    localStorage.setItem(THEME_STORAGE_KEY, selectedTheme);
    localStorage.setItem('theme', selectedTheme);
  } catch (e) {}

  updateThemeUI(selectedTheme);

  if (showNotification && typeof window !== 'undefined' && typeof window.showToast === 'function') {
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
  if (typeof window !== 'undefined') {
    window.addEventListener('storage', (e) => {
      if (e.key === THEME_STORAGE_KEY || e.key === 'theme') {
        const newTheme = e.newValue === 'dark' ? 'dark' : 'light';
        if (newTheme !== getAppTheme()) {
          applyTheme(newTheme, false);
        }
      }
    });
  }
}

// Attach to window object for inline HTML event handler accessibility (onclick="toggleAppTheme()")
if (typeof window !== 'undefined') {
  window.getAppTheme = getAppTheme;
  window.applyTheme = applyTheme;
  window.toggleAppTheme = toggleAppTheme;
  window.initTheme = initTheme;
  window.updateThemeUI = updateThemeUI;
}

// Auto-run when module is loaded or DOM is ready
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
