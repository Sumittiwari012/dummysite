const SETTINGS_KEY = 'customerDisplay';

export const MODES = Object.freeze({
  PANEL: 'panel',
  WINDOW: 'window',
  TAB: 'tab',
  REMOTE: 'remote'
});

export const loadSettings = () => {
  try {
    const saved = JSON.parse(localStorage.getItem(SETTINGS_KEY) || '{}');

    return {
      mode: Object.values(MODES).includes(saved.mode)
        ? saved.mode
        : MODES.PANEL,
      screen: saved.screen || ''
    };
  } catch {
    return { mode: MODES.PANEL, screen: '' };
  }
};

export const saveSettings = (settings) => {
  const safe = {
    mode: Object.values(MODES).includes(settings?.mode)
      ? settings.mode
      : MODES.PANEL,
    screen: settings?.screen || ''
  };

  localStorage.setItem(SETTINGS_KEY, JSON.stringify(safe));
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
  if (!supportsScreenDetails()) return [];

  try {
    const details = await window.getScreenDetails();

    return details.screens.map((screen, index) => ({
      id: `${screen.left},${screen.top},${screen.width},${screen.height}`,
      label: `Screen ${index + 1} — ${screen.width} × ${screen.height}`,
      left: screen.left,
      top: screen.top,
      width: screen.width,
      height: screen.height,
      isPrimary: !!screen.isPrimary
    }));
  } catch {
    return [];
  }
};

export const featuresFor = (screen) => {
  if (!screen) {
    return 'popup=yes,width=800,height=480';
  }

  return `popup=yes,left=${screen.left},top=${screen.top},width=${screen.width},height=${screen.height}`;
};

export const openCustomerWindow = () => {
  const { mode, screen } = loadSettings();

  if (mode === MODES.PANEL || mode === MODES.REMOTE) {
    return null;
  }

  if (mode === MODES.TAB) {
    return window.open('', '_blank') || null;
  }

  if (mode === MODES.WINDOW) {
    return window.open('', '_blank', featuresFor(screen)) || null;
  }

  return null;
};