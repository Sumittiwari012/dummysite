// ─────────────────────────────────────────────────────────────────────
// Customer display settings + helpers.
//
// Saved per computer/browser in localStorage ('customerDisplay'):
//   { mode: 'panel' | 'window' | 'tab', screen: {...} | null }
//
//  panel   QR is shown in the POS window itself (no customer display).
//          This is also what happens when no second screen is connected.
//  window  Windows / desktop Chrome or Edge: the QR opens as a popup
//          placed automatically on the saved customer screen.
//  tab     Android / other browsers: a normal new tab is opened and the
//          cashier moves or casts it to the customer screen by hand.
// ─────────────────────────────────────────────────────────────────────

const KEY = 'customerDisplay';

export const MODES = { PANEL: 'panel', WINDOW: 'window', TAB: 'tab' };

export const isAndroid = () => /Android/i.test(navigator.userAgent || '');

// Chrome / Edge on a desktop. Android Chrome and Firefox/Safari don't have it.
export const supportsScreenDetails = () => typeof window !== 'undefined' && 'getScreenDetails' in window;

export const loadSettings = () => {
  try {
    const s = JSON.parse(localStorage.getItem(KEY) || 'null');
    if (s && Object.values(MODES).includes(s.mode)) {
      return { mode: s.mode, screen: s.screen || null };
    }
  } catch { /* ignore a bad saved value */ }
  return { mode: MODES.PANEL, screen: null };
};

export const saveSettings = (settings) => {
  localStorage.setItem(KEY, JSON.stringify(settings));
};

export const describeSettings = (settings) => {
  if (settings.mode === MODES.WINDOW) {
    return settings.screen
      ? `${settings.screen.label} (${settings.screen.width}×${settings.screen.height})`
      : 'customer screen (not chosen yet)';
  }
  if (settings.mode === MODES.TAB) return 'separate tab (choose screen manually)';
  return 'this screen only';
};

const screenId = (s) => `${s.availLeft},${s.availTop},${s.availWidth},${s.availHeight}`;

// Must be called from a click (the browser asks for "Window management" permission).
export const listScreens = async () => {
  const details = await window.getScreenDetails();
  return details.screens.map((s, i) => ({
    id: screenId(s),
    label: s.label || `Screen ${i + 1}`,
    left: s.availLeft,
    top: s.availTop,
    width: s.availWidth,
    height: s.availHeight,
    isPrimary: !!s.isPrimary,
    isCurrent: s === details.currentScreen
  }));
};

export const featuresFor = (screen) =>
  `popup=yes,left=${screen.left},top=${screen.top},width=${screen.width},height=${screen.height}`;

// ── Live list of screens, so "is the customer screen still plugged in?" can be
//    answered instantly inside a click (window.open must run synchronously). ──
let cachedDetails = null;

export const warmScreenCache = async () => {
  if (!supportsScreenDetails() || !navigator.permissions?.query) return;
  for (const name of ['window-management', 'window-placement']) {
    try {
      const status = await navigator.permissions.query({ name });
      if (status.state === 'granted') {
        cachedDetails = await window.getScreenDetails();
      }
      return;
    } catch { /* try the older permission name */ }
  }
};

const savedScreenIsConnected = (saved) => {
  // No permission yet, so nothing to compare with: fall back to "is any extra screen connected"
  if (!cachedDetails) return window.screen.isExtended !== false;
  return cachedDetails.screens.some((s) => screenId(s) === saved.id);
};

/**
 * Opens the customer display according to the saved settings.
 * Call it directly inside a click handler, or pop-up blockers stop it.
 * Returns the new window, or null when the QR should be shown in the POS
 * window instead (panel mode, no second screen connected, pop-up blocked).
 */
export const openCustomerWindow = () => {
  const { mode, screen } = loadSettings();

  if (mode === MODES.PANEL) return null;

  if (mode === MODES.TAB) {
    return window.open('', '_blank') || null;
  }

  // mode === 'window'
  if (!screen) return null;                       // never set up
  if (!savedScreenIsConnected(screen)) return null; // customer screen is unplugged
  return window.open('', '_blank', featuresFor(screen)) || null;
};
