import React, { useEffect, useRef, useState } from 'react';
import { QRCodeSVG } from 'qrcode.react';
import { validateDeviceId, watchDisplayAmount } from './remoteDisplay';

// Public page, no login. Open it at /display
//
//  1. First open: type the device ID. It is checked with GET /api/Display/Validate
//     and saved in this browser only if it exists.
//  2. Next opens: the saved ID is checked again and the page connects by itself.
//  3. While open, watchDisplayAmount() (remoteDisplay.js) asks GET /api/Display/GetAmount.
//     A non-zero amount draws the UPI QR with a countdown, zero shows "Welcome".

const STORE_KEY = 'displayPanelId';

// Same value as PAYMENT_WINDOW_SECONDS in PaymentsController: how long one QR stays valid.
const PAYMENT_WINDOW_SECONDS = 300;

// Your UPI details (same values as upiQrPayment.jsx)
const UPI_PAYEE_VPA = 'st386700@okaxis';
const UPI_PAYEE_NAME = 'Sumit Tiwari';
const UPI_AID = 'uGICAgIDf7Iz2NQ';

// The invoice number (when the server sends one) goes into the UPI note so the phone app
// can match the payment, but it is never shown on the screen.
const buildUpiLink = (amount, invoiceNumber) => {
  const parts = [
    `pa=${encodeURIComponent(UPI_PAYEE_VPA)}`,
    `pn=${encodeURIComponent(UPI_PAYEE_NAME)}`,
    `am=${Number(amount).toFixed(2)}`,
    'cu=INR'
  ];
  const note = String(invoiceNumber || '').replace(/[^A-Za-z0-9]/g, '').slice(0, 50);
  if (note) parts.push(`tn=${encodeURIComponent(note)}`);
  if (UPI_AID) parts.push(`aid=${encodeURIComponent(UPI_AID)}`);
  return `upi://pay?${parts.join('&')}`;
};

const formatClock = (total) => {
  const m = String(Math.floor(total / 60)).padStart(2, '0');
  const s = String(total % 60).padStart(2, '0');
  return `${m}:${s}`;
};

const loadId = () => {
  try { return (localStorage.getItem(STORE_KEY) || '').trim(); } catch { return ''; }
};
const saveId = (id) => {
  try { localStorage.setItem(STORE_KEY, id); } catch { /* private mode */ }
};
const clearId = () => {
  try { localStorage.removeItem(STORE_KEY); } catch { /* ignore */ }
};

// Current size of the visible screen, updated on resize / rotate
const useViewport = () => {
  const read = () => ({ w: window.innerWidth, h: window.innerHeight });
  const [v, setV] = useState(read);
  useEffect(() => {
    const on = () => setV(read());
    window.addEventListener('resize', on);
    window.addEventListener('orientationchange', on);
    return () => {
      window.removeEventListener('resize', on);
      window.removeEventListener('orientationchange', on);
    };
  }, []);
  return v;
};

export default function DisplayPanel() {
  const { w, h } = useViewport();

  const [id, setId] = useState(loadId);                          // the saved ID
  const [gate, setGate] = useState(id ? 'checking' : 'setup');   // setup | checking | offline | ready
  const [input, setInput] = useState('');
  const [formError, setFormError] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [retry, setRetry] = useState(0);
  const [online, setOnline] = useState(true);
  const [show, setShow] = useState({ amount: 0 });               // what GetAmount last returned
  const [secondsLeft, setSecondsLeft] = useState(PAYMENT_WINDOW_SECONDS);
  const endAtRef = useRef(0);

  const backToSetup = (message = '') => {
    clearId();
    setId('');
    setInput('');
    setFormError(message);
    setShow({ amount: 0 });
    setGate('setup');
  };

  // ── Check the saved ID on every start (it may have been removed from the database) ──
  useEffect(() => {
    if (!id) return undefined;
    const controller = new AbortController();
    setGate('checking');
    validateDeviceId(id, controller.signal).then((r) => {
      if (controller.signal.aborted) return;
      if (r === 'valid') setGate('ready');
      else if (r === 'invalid') backToSetup('This device ID is no longer valid. Enter a new one.');
      else setGate('offline');
    });
    return () => controller.abort();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id, retry]);

  // ── Form submit: validate, save, then the effect above takes over ──
  const submit = async (e) => {
    e.preventDefault();
    const value = input.trim();
    if (!value) {
      setFormError('Enter the device ID.');
      return;
    }
    setSubmitting(true);
    setFormError('');
    const r = await validateDeviceId(value);
    setSubmitting(false);
    if (r === 'valid') {
      saveId(value);
      setId(value);
    } else if (r === 'invalid') {
      setFormError('This device ID does not exist. Check it and try again.');
    } else {
      setFormError('Cannot reach the server. Check the internet and try again.');
    }
  };

  // ── Once connected: one call to the common function, it keeps asking GetAmount ──
  useEffect(() => {
    if (gate !== 'ready') return undefined;
    return watchDisplayAmount(id, {
      onAmount: (m) => {
        if (m.amount > 0) {                       // a new QR: restart the countdown
          endAtRef.current = Date.now() + PAYMENT_WINDOW_SECONDS * 1000;
          setSecondsLeft(PAYMENT_WINDOW_SECONDS);
        }
        setShow(m);
      },
      onStatus: setOnline,
      onInvalid: () => backToSetup('This device ID is no longer valid. Enter a new one.')
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [gate, id]);

  // ── Countdown while a QR is showing ──
  const counting = show.amount > 0;
  useEffect(() => {
    if (!counting) return undefined;
    const tick = () => setSecondsLeft(Math.max(0, Math.ceil((endAtRef.current - Date.now()) / 1000)));
    tick();
    const timer = setInterval(tick, 250);
    return () => clearInterval(timer);
  }, [counting, show]);

  const changeId = () => {
    if (window.confirm('Remove the saved device ID and enter a different one?')) backToSetup();
  };

  // ───────────── Screens ─────────────
  const page = { ...S.page, height: '100dvh', paddingTop: 'env(safe-area-inset-top)', paddingBottom: 'env(safe-area-inset-bottom)' };

  if (gate === 'setup') {
    return (
      <div style={page}>
        <form onSubmit={submit} style={S.form}>
          <div style={S.heading}>Customer display setup</div>
          <input
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="Device ID"
            autoFocus
            autoComplete="off"
            spellCheck={false}
            disabled={submitting}
            style={S.input}
          />
          {formError && <div style={S.error}>{formError}</div>}
          <button type="submit" disabled={submitting} style={S.btn}>
            {submitting ? 'Checking...' : 'Connect'}
          </button>
        </form>
      </div>
    );
  }

  if (gate === 'checking') {
    return <div style={page}><div style={S.msg}>Connecting...</div></div>;
  }

  if (gate === 'offline') {
    return (
      <div style={page}>
        <div style={S.msg}>
          Cannot reach the server.
          <div>
            <button style={S.btn} onClick={() => setRetry((n) => n + 1)}>Try again</button>
            <button style={{ ...S.btn, ...S.btnGhost }} onClick={changeId}>Change ID</button>
          </div>
        </div>
      </div>
    );
  }

  // ── Adaptive layout: everything is sized from the current screen ──
  const small = Math.min(w, h);
  const pad = Math.max(10, Math.round(small * 0.04));
  const landscape = w >= h * 1.15;                  // wide screens: QR left, text right

  const qrBox = landscape
    ? Math.min(h - 2 * pad, w * 0.52)               // the white card around the QR
    : Math.min(w - 2 * pad, h * 0.55);
  const qrSize = Math.max(100, Math.floor(qrBox - 16));   // the QR itself (card has 8px padding)
  const textW = landscape ? w - qrBox - 3 * pad : w - 2 * pad;

  const hasAmount = show.amount > 0;
  const expired = hasAmount && secondsLeft <= 0;
  const active = hasAmount && !expired;

  const amountStr = hasAmount ? `₹${Number(show.amount).toFixed(2)}` : '';
  const titleFont = Math.max(14, Math.min(textW / 14, h * 0.055));
  const amountFont = Math.max(
    24,
    Math.min(textW / (Math.max(amountStr.length, 4) * 0.6), landscape ? h * 0.2 : h * 0.12)
  );
  const timerFont = Math.max(20, amountFont * 0.5);
  const progress = (secondsLeft / PAYMENT_WINDOW_SECONDS) * 100;
  const low = secondsLeft <= 30;

  return (
    <div style={page} onDoubleClick={() => document.documentElement.requestFullscreen?.()}>
      <span style={{ ...S.dot, background: online ? '#2ecc71' : '#e74c3c' }} />

      <div style={S.controls}>
        <button style={S.ctrl} onClick={changeId}>Change ID</button>
      </div>

      {active && (
        <div
          style={{
            display: 'flex',
            flexDirection: landscape ? 'row' : 'column',
            alignItems: 'center',
            justifyContent: 'center',
            gap: pad,
            padding: pad,
            width: '100%',
            boxSizing: 'border-box',
            textAlign: landscape ? 'left' : 'center'
          }}
        >
          <div style={S.qr}>
            <QRCodeSVG
              value={buildUpiLink(show.amount, show.invoiceNumber)}
              size={qrSize}
              level="M"
              includeMargin
              style={{ display: 'block' }}
            />
          </div>
          <div style={{ minWidth: 0, width: landscape ? textW : undefined, maxWidth: textW }}>
            <div style={{ fontSize: titleFont, opacity: 0.85 }}>Scan to pay with UPI</div>
            <div style={{ fontSize: amountFont, fontWeight: 700, lineHeight: 1.15 }}>{amountStr}</div>
            <div style={{ fontSize: timerFont, fontWeight: 600, marginTop: pad / 2, color: low ? '#ff6b6b' : '#fff' }}>
              {formatClock(secondsLeft)}
            </div>
            <div style={S.bar}>
              <div style={{ ...S.barFill, width: `${progress}%`, background: low ? '#ff6b6b' : '#2ecc71' }} />
            </div>
          </div>
        </div>
      )}

      {expired && (
        <div style={{ ...S.msg, fontSize: Math.max(18, small * 0.06) }}>
          This QR has expired.
          <div style={{ fontSize: '0.7em', opacity: 0.7 }}>Please ask the cashier for a new one.</div>
        </div>
      )}

      {!hasAmount && (
        <div style={{ fontSize: Math.max(24, small * 0.09), opacity: 0.5 }}>Welcome</div>
      )}
    </div>
  );
}

const S = {
  page: {
    position: 'fixed', top: 0, left: 0, right: 0, background: '#111', color: '#fff',
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    font: '20px system-ui, sans-serif', boxSizing: 'border-box', overflow: 'hidden'
  },
  form: { display: 'flex', flexDirection: 'column', gap: 14, width: 'min(90vw, 360px)' },
  heading: { fontSize: 24, fontWeight: 600, textAlign: 'center', marginBottom: 4 },
  input: {
    padding: '12px 14px', fontSize: 18, borderRadius: 6, border: '1px solid #444',
    background: '#1c1c1c', color: '#fff', outline: 'none'
  },
  error: { color: '#ff6b6b', fontSize: 15 },
  msg: { textAlign: 'center', fontSize: 26, lineHeight: 1.6, padding: 16 },
  btn: {
    marginTop: 4, padding: '12px 18px', fontSize: 16, borderRadius: 6,
    border: 'none', cursor: 'pointer', background: '#2ecc71', color: '#111', fontWeight: 600
  },
  btnGhost: { background: '#333', color: '#fff', marginLeft: 10 },
  controls: { position: 'absolute', top: 6, left: 6, display: 'flex', gap: 4, zIndex: 2 },
  ctrl: {
    background: 'none', border: 'none', color: '#fff', opacity: 0.3,
    fontSize: 13, padding: '8px 10px', cursor: 'pointer'
  },
  qr: { background: '#fff', borderRadius: 12, padding: 8, lineHeight: 0, flex: '0 0 auto' },
  bar: { height: 6, borderRadius: 3, background: '#333', overflow: 'hidden', marginTop: 8 },
  barFill: { height: '100%', transition: 'width 0.25s linear' },
  dot: { position: 'absolute', top: 10, right: 10, width: 10, height: 10, borderRadius: '50%' }
};
