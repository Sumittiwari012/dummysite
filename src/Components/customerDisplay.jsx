const SETTINGS_KEY = 'customerDisplay';

let screenCache = [];
let screenCacheReady = false;

export const MODES = Object.freeze({
  PANEL: 'panel',
  WINDOW: 'window',
  TAB: 'tab',
  REMOTE: 'remote'
});

export const loadSettings = () => {
  try {
    const saved = JSON.parse(
      localStorage.getItem(SETTINGS_KEY) || '{}'
    );

    return {
      mode: Object.values(MODES).includes(saved.mode)
        ? saved.mode
        : MODES.PANEL,
      screen: saved.screen || ''
    };
  } catch {
    return {
      mode: MODES.PANEL,
      screen: ''
    };
  }
};

export const saveSettings = (settings) => {
  const safe = {
    mode: Object.values(MODES).includes(settings?.mode)
      ? settings.mode
      : MODES.PANEL,
    screen: settings?.screen || ''
  };

  try {
    localStorage.setItem(SETTINGS_KEY, JSON.stringify(safe));
  } catch {
    // Browser storage may be unavailable.
  }

  return safe;
};

export const describeSettings = (settings = loadSettings()) => {
  switch (settings.mode) {
    case MODES.WINDOW:
      return 'separate browser window';

    case MODES.TAB:
      return 'new browser tab';

    case MODES.REMOTE:
      return 'customer panel (separate device)';

    default:
      return 'this screen only';
  }
};

export const supportsScreenDetails = () =>
  typeof window !== 'undefined' &&
  typeof window.getScreenDetails === 'function';

export const listScreens = async () => {
  if (!supportsScreenDetails()) {
    return [];
  }

  try {
    const details = await window.getScreenDetails();

    return details.screens.map((screen, index) => ({
      id: `${screen.left},${screen.top},${screen.width},${screen.height}`,
      label: `Screen ${index + 1} — ${screen.width} × ${screen.height}`,
      left: screen.left,
      top: screen.top,
      width: screen.width,
      height: screen.height,
      isPrimary: Boolean(screen.isPrimary)
    }));
  } catch {
    return [];
  }
};

// Refresh the screen cache before the cashier opens a customer window.
// Only runs in "separate window" mode, and only when the browser has already been
// given permission, so it never shows a permission prompt by itself.
export const warmScreenCache = async () => {
  if (!supportsScreenDetails() || loadSettings().mode !== MODES.WINDOW) {
    return screenCache;
  }

  if (!navigator.permissions?.query) {
    return screenCache;
  }

  for (const name of ['window-management', 'window-placement']) {
    try {
      const status = await navigator.permissions.query({ name });

      if (status.state === 'granted') {
        screenCache = await listScreens();
        screenCacheReady = true;
      }

      return screenCache;
    } catch {
      // Try the older permission name.
    }
  }

  return screenCache;
};

const getSavedScreen = (screenId) => {
  if (!screenId) {
    return null;
  }

  // The saved setting stores screen coordinates as a comma-separated ID.
  const cached = screenCache.find((screen) => screen.id === screenId);

  if (cached) {
    return cached;
  }

  const values = screenId.split(',').map(Number);

  if (
    values.length !== 4 ||
    values.some((value) => !Number.isFinite(value))
  ) {
    return null;
  }

  const [left, top, width, height] = values;

  return { left, top, width, height };
};

export const featuresFor = (screen) => {
  if (!screen) {
    return 'popup=yes,width=800,height=480';
  }

  return [
    'popup=yes',
    `left=${screen.left}`,
    `top=${screen.top}`,
    `width=${screen.width}`,
    `height=${screen.height}`
  ].join(',');
};

export const openCustomerWindow = () => {
  const { mode, screen } = loadSettings();

  if (
    typeof window === 'undefined' ||
    typeof window.open !== 'function'
  ) {
    return null;
  }

  // These modes use the current screen or a separate device.
  if (mode === MODES.PANEL || mode === MODES.REMOTE) {
    return null;
  }

  if (mode === MODES.TAB) {
    return window.open('', '_blank') || null;
  }

  if (mode === MODES.WINDOW) {
    // The saved customer screen is no longer connected: return null so the QR
    // is shown in the POS window instead of opening on the wrong screen.
    if (screen && screenCacheReady && !screenCache.some((s) => s.id === screen)) {
      return null;
    }

    return window.open('', '_blank', featuresFor(getSavedScreen(screen))) || null;
  }

  return null;
};