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
      return { status: 'ok', amount: 0 };
    }

    if (!response.ok) {
      return { status: 'offline' };
    }

    const body = await response.json();

    return {
      status: 'ok',
      amount: Number(body.amount || 0)
    };
  } catch (error) {
    return {
      status: error?.name === 'AbortError' ? 'aborted' : 'offline'
    };
  }
};

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
  let lastAmount = null;
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

      if (result.amount !== lastAmount) {
        lastAmount = result.amount;
        onAmount?.(result.amount);
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

export const setDisplayAmount = async (
  deviceId,
  amount,
  keepalive = false
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
        amount: Math.round(numericAmount * 100) / 100
      }),
      keepalive
    });

    return response.ok;
  } catch {
    return false;
  }
};