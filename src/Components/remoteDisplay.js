const DEVICE_KEY = 'customerDisplayDeviceId';

const API_BASE = 'https://gripstyleapi.runasp.net/api';
const DISPLAY_API = `${API_BASE}/Display`;
const PAYMENTS_API = `${API_BASE}/Payments`;

export const getDeviceId = () => {
  try {
    return (localStorage.getItem(DEVICE_KEY) || '').trim();
  } catch {
    return '';
  }
};

export const saveDeviceId = (id) => {
  const value = String(id || '').trim();

  try {
    if (value) {
      localStorage.setItem(DEVICE_KEY, value);
    } else {
      localStorage.removeItem(DEVICE_KEY);
    }
  } catch {
    // Storage may be unavailable.
  }

  return value;
};

export const validateDeviceId = async (id, signal) => {
  const deviceId = String(id || '').trim();

  if (!deviceId) return 'invalid';

  try {
    const response = await fetch(
      `${DISPLAY_API}/Validate?id=${encodeURIComponent(deviceId)}`,
      { cache: 'no-store', signal }
    );

    if (response.ok) return 'valid';
    if (response.status === 404) return 'invalid';

    return 'offline';
  } catch {
    return 'offline';
  }
};

export const getDisplayAmount = async (id, signal) => {
  const deviceId = String(id || '').trim();

  if (!deviceId) return { status: 'invalid' };

  try {
    const response = await fetch(
      `${DISPLAY_API}/GetAmount?id=${encodeURIComponent(deviceId)}`,
      { cache: 'no-store', signal }
    );

    if (response.status === 404) {
      return { status: 'invalid' };
    }

    if (response.status === 204) {
      return { status: 'ok', amount: 0, paid: false, invoiceNumber: '' };
    }

    if (!response.ok) {
      return { status: 'offline' };
    }

    const body = await response.json();

    return {
      status: 'ok',
      amount: Number(body.amount || 0),
      paid: Boolean(body.paid),
      invoiceNumber: String(body.invoiceNumber || '')
    };
  } catch (error) {
    return {
      status: error?.name === 'AbortError' ? 'aborted' : 'offline'
    };
  }
};

// Common function: call it once, it keeps asking GetAmount by itself.
//   onAmount({ amount, paid, invoiceNumber })  only when something CHANGES (amount 0 = clear, paid = payment done)
//   onStatus(online)      true / false
//   onInvalid()           the device id no longer exists (watching stops)
// Returns a stop() function.
export const watchDisplayAmount = (
  deviceId,
  {
    onAmount,
    onStatus,
    onInvalid,
    intervalMs = 1000
  } = {}
) => {
  let stopped = false;
  let timer = null;
  let lastKey = null;
  let failures = 0;
  let inFlight = false;

  const poll = async () => {
    if (stopped || inFlight) return;

    inFlight = true;
    const result = await getDisplayAmount(deviceId);
    inFlight = false;

    if (stopped || result.status === 'aborted') return;

    if (result.status === 'invalid') {
      onInvalid?.();
      return;
    }

    if (result.status === 'offline') {
      failures++;
      onStatus?.(false);
    } else {
      failures = 0;
      onStatus?.(true);

      const key = `${result.amount}|${result.paid ? 1 : 0}|${result.invoiceNumber}`;

      if (key !== lastKey) {
        lastKey = key;
        // the panel expects an object; paid = the payment just completed (show the smiley)
        onAmount?.({ amount: result.amount, paid: result.paid, invoiceNumber: result.invoiceNumber });
      }
    }

    timer = setTimeout(
      poll,
      failures ? Math.min(5000, intervalMs * (failures + 1)) : intervalMs
    );
  };

  poll();

  return () => {
    stopped = true;
    if (timer) clearTimeout(timer);
  };
};

// POS side: amount > 0 shows a QR on the panel, amount 0 clears it.
// invoiceNumber is stored with the amount so the panel can put it in the QR's UPI note
// (it is never shown on the panel screen).
export const setDisplayAmount = async (
  deviceId,
  amount,
  keepalive = false,
  invoiceNumber = ''
) => {
  const id = String(deviceId || '').trim();
  const numericAmount = Number(amount);

  if (!id || !Number.isFinite(numericAmount) || numericAmount < 0) {
    return false;
  }

  try {
    const response = await fetch(`${PAYMENTS_API}/SetDisplayAmount`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        deviceId: id,
        amount: Math.round(numericAmount * 100) / 100,
        invoiceNumber: String(invoiceNumber || '')
      }),
      keepalive
    });

    return response.ok;
  } catch {
    return false;
  }
};

// POS side: tell the panel the payment succeeded so it shows the smiley.
// Follow it with setDisplayAmount(deviceId, 0) to clear the panel afterwards.
export const setDisplayPaid = async (deviceId) => {
  const id = String(deviceId || '').trim();

  if (!id) return false;

  try {
    const response = await fetch(`${PAYMENTS_API}/SetDisplayAmount`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ deviceId: id, amount: 0, paid: true })
    });

    return response.ok;
  } catch {
    return false;
  }
};