// Shared helpers for the customer display panel (used by the POS and by DisplayPanel.jsx).
const KEY = 'customerDisplayDeviceId';
const BASE = 'https://gripstyleapi.runasp.net/api';
const DISPLAY_API = `${BASE}/Display`;
const PAYMENTS_API = `${BASE}/Payments`;

// ── Device id saved on the POS computer ──
export const getDeviceId = () => (localStorage.getItem(KEY) || '').trim();

export const saveDeviceId = (id) => {
  const v = (id || '').trim();
  if (v) localStorage.setItem(KEY, v);
  else localStorage.removeItem(KEY);
};

// ── GET /api/Display/Validate ──
// Resolves to 'valid' | 'invalid' | 'offline'
export const validateDeviceId = async (id, signal) => {
  try {
    const res = await fetch(`${DISPLAY_API}/Validate?id=${encodeURIComponent(id)}`, {
      cache: 'no-store',
      signal
    });
    if (res.ok) return 'valid';
    if (res.status === 404) return 'invalid';
    return 'offline';
  } catch {
    return 'offline';
  }
};

// ── GET /api/Display/GetAmount (one call) ──
// Resolves to
//   { status: 'ok', amount, invoiceNumber? }   the device has an amount to show
//   { status: 'none' }                         the amount is zero (nothing to do)
//   { status: 'invalid' }                      the device id does not exist
//   { status: 'offline' }                      the server could not be reached
export const getDisplayAmount = async (id, signal) => {
  try {
    const res = await fetch(`${DISPLAY_API}/GetAmount?id=${encodeURIComponent(id)}`, {
      cache: 'no-store',
      signal
    });
    if (res.status === 204) return { status: 'none' };
    if (res.status === 404) return { status: 'invalid' };
    if (!res.ok) return { status: 'offline' };
    const body = await res.json();
    const amount = Number(body?.amount) || 0;
    if (amount <= 0) return { status: 'none' };
    return { status: 'ok', amount, invoiceNumber: body?.invoiceNumber || '' };
  } catch {
    return { status: 'offline' };
  }
};

// ── COMMON FUNCTION: call it once, it keeps asking the server by itself ──
//
//   const stop = watchDisplayAmount(deviceId, {
//     onAmount:  ({ amount, invoiceNumber }) => ...,   // only when the value CHANGES (amount 0 = clear)
//     onStatus:  (online) => ...,                      // optional: true / false
//     onInvalid: () => ...,                            // optional: the id no longer exists (watching stops)
//     intervalMs: 1000                                 // optional: gap between calls
//   });
//   stop();   // when done
//
// The next call is only made after the previous one has answered, so calls never
// pile up. While the server is unreachable it slows down (up to 5 seconds) and
// speeds up again by itself when the connection is back.
export const watchDisplayAmount = (deviceId, { onAmount, onStatus, onInvalid, intervalMs = 1000 } = {}) => {
  const controller = new AbortController();
  let stopped = false;
  let timer = null;
  let failures = 0;
  let last;                        // undefined, so the first answer is always reported

  const stop = () => {
    stopped = true;
    clearTimeout(timer);
    controller.abort();
  };

  const tick = async () => {
    const r = await getDisplayAmount(deviceId, controller.signal);
    if (stopped) return;

    if (r.status === 'invalid') {
      onInvalid?.();
      stop();
      return;
    }

    if (r.status === 'offline') {
      failures += 1;
      onStatus?.(false);
    } else {
      failures = 0;
      onStatus?.(true);
      const key = r.status === 'ok' ? `${r.amount}|${r.invoiceNumber}` : '0';
      if (key !== last) {
        last = key;
        onAmount?.(r.status === 'ok'
          ? { amount: r.amount, invoiceNumber: r.invoiceNumber }
          : { amount: 0 });
      }
    }

    const wait = failures ? Math.min(intervalMs * (failures + 1), 5000) : intervalMs;
    timer = setTimeout(tick, wait);
  };

  tick();
  return stop;
};

// ── POST /api/Payments/SetDisplayAmount (for the POS, later) ──
// amount > 0 shows a QR on the panel, amount 0 clears it. Resolves to true when accepted.
export const setDisplayAmount = async (deviceId, amount, keepalive = false) => {
  if (!deviceId) return false;
  try {
    const res = await fetch(`${PAYMENTS_API}/SetDisplayAmount`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ deviceId, amount: Math.round(Number(amount) * 100) / 100 }),
      keepalive
    });
    return res.ok;
  } catch {
    return false;
  }
};
