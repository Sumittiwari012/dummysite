import React, { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { QRCodeSVG } from 'qrcode.react';
import { MODES, loadSettings, openCustomerWindow } from './customerDisplay';
import './upiQrPayment.css';

// ── Config ────────────────────────────────────────────────────────────
// Must be the SAME backend (and database) the phone app talks to: the
// "payment received" call from the phone and the held WaitForPayment call
// from this window have to meet inside the same server process.
const UPI_API_BASE_URL = 'https://gripstyleapi.runasp.net';
const UPI_GATEWAY_ID = 1;   // id of the registered UPI phone (MRegisteredPhNumberGateway.Id)
const UPI_PAYEE_VPA = 'st386700@okaxis';
const UPI_PAYEE_NAME = 'Sumit Tiwari';
// Optional extras. Leave both EMPTY unless you copied them from a real QR of THIS
// same VPA (they must belong together, or Google Pay may refuse the QR).
//  UPI_AID  Google Pay's merchant profile id (the aid= value on a QR made by Google Pay).
//  UPI_MCC  merchant category code (mc=). When set, a unique tr= reference is added too.
const UPI_AID = 'uGICAgIDf7Iz2NQ';   // from the Google Pay QR of st386700@okaxis; set '' to leave it out
const UPI_MCC = '';

const API = `${UPI_API_BASE_URL}/api/Payments`;
const JSON_HEADERS = { 'Content-Type': 'application/json' };

// The transaction note (tn) carries the invoice number with every special
// character removed, so only letters and digits are left. That makes it easy to
// compare with the invoice. e.g. "MFS-1306-2026/27" becomes "MFS1306202627".
const cleanNote = (note) =>
  String(note ?? '').replace(/[^A-Za-z0-9]/g, '').slice(0, 50);

// upi://pay?pa=...&pn=...&am=50.00&cu=INR[&tn=...][&mc=...&tr=...][&aid=...]
// encodeURIComponent (not URLSearchParams) so spaces become %20, not "+".
const buildUpiLink = ({ amount, note, ref }) => {
  const parts = [
    `pa=${encodeURIComponent(UPI_PAYEE_VPA)}`,
    `pn=${encodeURIComponent(UPI_PAYEE_NAME)}`,
    `am=${Number(amount).toFixed(2)}`,
    'cu=INR'
  ];
  const safeNote = cleanNote(note);
  if (safeNote) parts.push(`tn=${encodeURIComponent(safeNote)}`);
  if (UPI_MCC) {
    parts.push(`mc=${encodeURIComponent(UPI_MCC)}`);
    // unique reference per payment, letters and digits only
    parts.push(`tr=${encodeURIComponent(ref || '')}`);
  }
  if (UPI_AID) parts.push(`aid=${encodeURIComponent(UPI_AID)}`);
  return `upi://pay?${parts.join('&')}`;
};

// The API answers with JSON objects, JSON strings (BadRequest("...")) or nothing.
const readBody = async (res) => {
  const text = await res.text();
  if (!text) return '';
  try { return JSON.parse(text); } catch { return text; }
};

const errorText = (body, fallback) => {
  if (!body) return fallback;
  if (typeof body === 'string') return body;
  return body.message || body.title || fallback;
};

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

const formatClock = (totalSeconds) => {
  const m = String(Math.floor(totalSeconds / 60)).padStart(2, '0');
  const s = String(totalSeconds % 60).padStart(2, '0');
  return `${m}:${s}`;
};

/**
 * Two views of the same payment:
 *
 *  - CUSTOMER DISPLAY: a separate window/tab (opened by the parent with
 *    openCustomerWindow()) that shows only the amount, the QR code, the
 *    countdown and the result. No buttons.
 *  - OPERATOR PANEL: an overlay in the POS window with the status, Accept and
 *    Cancel. This is the only place the cashier controls the payment.
 *
 * If there is no customer display (panel mode, no second screen connected,
 * pop-up blocked, or the display was closed), the QR is shown in the
 * operator panel instead, right above Accept, so the payment can still be
 * taken and accepted from the one window.
 *
 * Props
 *  amount, invoiceNumber, customerName, gatewayId
 *  targetWindow           window opened by the parent for the customer display (or null)
 *  onDisplayWindowChange  (win) called when the display is re-opened, so the
 *                         parent can close it later
 *  onPaid(info)           once, when paid (auto-matched or Accept): { amount, payerName, requestId }
 *  onClose()              close everything (the parent should also close the display window)
 */
function UpiQrPayment({
  amount,
  invoiceNumber,
  customerName,
  gatewayId,
  targetWindow,
  onDisplayWindowChange,
  onPaid,
  onClose
}) {
  const customerId = UPI_GATEWAY_ID;

  // The saved choice: 'panel' | 'window' | 'tab'
  const [displayMode] = useState(() => loadSettings().mode);

  // creating | waiting | paid | expired | error
  const [phase, setPhase] = useState('creating');
  const [qrAmount, setQrAmount] = useState(null);
  const [secondsLeft, setSecondsLeft] = useState(0);
  const [windowSeconds, setWindowSeconds] = useState(0);
  const [payerName, setPayerName] = useState('');
  const [error, setError] = useState('');
  const [attempt, setAttempt] = useState(0);
  const [isClosing, setIsClosing] = useState(false);
  const [confirmingAccept, setConfirmingAccept] = useState(false);
  const [acceptedManually, setAcceptedManually] = useState(false);

  // Customer display window
  const [displayWin, setDisplayWin] = useState(
    targetWindow && !targetWindow.closed ? targetWindow : null
  );
  const [portalEl, setPortalEl] = useState(null);
  // Size of the customer display window (a 5-inch screen is about 800x480)
  const [dispSize, setDispSize] = useState({ w: 800, h: 480 });

  const requestIdRef = useRef(null);
  const endAtRef = useRef(0);
  const settledRef = useRef(false);     // paid, or already cancelled: nothing left to clean up
  const paidFiredRef = useRef(false);   // onPaid must fire only once (auto-match OR manual accept)
  const onPaidRef = useRef(onPaid);
  onPaidRef.current = onPaid;
  const onCloseRef = useRef(onClose);
  onCloseRef.current = onClose;

  const cancelRequest = (requestId, keepalive = false) =>
    fetch(`${API}/CancelPaymentRequest`, {
      method: 'POST',
      headers: JSON_HEADERS,
      body: JSON.stringify({ customerId, requestId }),
      keepalive
    });

  // Single place that marks the payment as paid
  const completePaid = ({ amount: paidAmount, payerName: who, requestId, manual = false }) => {
    if (paidFiredRef.current) return;
    paidFiredRef.current = true;
    settledRef.current = true;
    setPayerName(who || '');
    setAcceptedManually(manual);
    setPhase('paid');
    onPaidRef.current?.({ amount: paidAmount, payerName: who || '', requestId });
  };

  // ── Prepare the customer display window ──
  useEffect(() => {
    if (!displayWin) {
      setPortalEl(null);
      return undefined;
    }
    if (displayWin.closed) {
      setDisplayWin(null);
      return undefined;
    }
    const doc = displayWin.document;
    doc.title = `Customer display - UPI${invoiceNumber ? ` - ${invoiceNumber}` : ''}`;
    doc.body.style.margin = '0';
    doc.body.style.overflow = 'hidden';
    // copy the app's CSS into the new window
    document.querySelectorAll('link[rel="stylesheet"], style').forEach((n) => {
      doc.head.appendChild(n.cloneNode(true));
    });
    const el = doc.createElement('div');
    doc.body.appendChild(el);
    setPortalEl(el);

    // Keep the QR sized to whatever screen the display is on
    const measure = () => setDispSize({ w: displayWin.innerWidth, h: displayWin.innerHeight });
    measure();
    displayWin.addEventListener('resize', measure);

    // If the window is closed by hand the payment keeps going; the QR then
    // shows in the operator panel.
    const poll = setInterval(() => {
      if (displayWin.closed) {
        clearInterval(poll);
        setDisplayWin(null);
      }
    }, 500);

    return () => {
      clearInterval(poll);
      try { displayWin.removeEventListener('resize', measure); } catch { /* gone */ }
      try { el.remove(); } catch { /* window already gone */ }
      setPortalEl(null);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [displayWin]);

  // Re-open the customer display (called from a click, so pop-ups are allowed)
  const openDisplay = () => {
    const win = openCustomerWindow();
    if (!win) {
      setError('No customer screen available. The QR stays in this window.');
      return;
    }
    setError('');
    onDisplayWindowChange?.(win);
    setDisplayWin(win);
  };

  // ── Create the request, then wait for the payment ──
  useEffect(() => {
    let disposed = false;
    const controller = new AbortController();
    const { signal } = controller;

    settledRef.current = false;
    paidFiredRef.current = false;
    requestIdRef.current = null;
    setPhase('creating');
    setError('');
    setPayerName('');
    setConfirmingAccept(false);
    setAcceptedManually(false);

    const run = async () => {
      if (!customerId) {
        setError('UPI is not set up on this counter (gateway id missing).');
        setPhase('error');
        return;
      }

      // 1) Register the amount; the server starts the payment window now.
      let created;
      try {
        const res = await fetch(`${API}/CreatePaymentRequest`, {
          method: 'POST',
          headers: JSON_HEADERS,
          body: JSON.stringify({
            customerId,
            name: customerName || '',
            // The payment is matched to this request by invoice number
            invoiceNumber: invoiceNumber || '',
            // UPI only carries 2 decimals; the server must store exactly what the QR shows
            amount: Math.round(Number(amount) * 100) / 100
          }),
          signal
        });
        const body = await readBody(res);
        if (!res.ok) throw new Error(errorText(body, `Could not create the QR (${res.status}).`));
        created = body;
      } catch (err) {
        if (disposed) return;
        setError(err.message || 'Could not reach the server.');
        setPhase('error');
        return;
      }

      // The window was closed while the request was being created.
      if (disposed) {
        cancelRequest(created.requestId, true).catch(() => {});
        return;
      }

      requestIdRef.current = created.requestId;
      endAtRef.current = Date.now() + created.windowSeconds * 1000;
      setQrAmount(created.amount);
      setWindowSeconds(created.windowSeconds);
      setSecondsLeft(created.windowSeconds);
      setPhase('waiting');

      // 2) Wait. The server holds each call for up to ~50s and answers
      //    "pending" if nothing happened, so just ask again.
      let failures = 0;
      while (!disposed) {
        try {
          const res = await fetch(`${API}/WaitForPayment/${created.requestId}`, { signal });
          const body = await readBody(res);
          if (!res.ok || typeof body !== 'object' || !body.status) {
            throw new Error(errorText(body, `Waiting failed (${res.status}).`));
          }
          failures = 0;

          if (body.status === 'pending') {
            // Re-sync the countdown with the server's clock.
            if (typeof body.secondsLeft === 'number') {
              endAtRef.current = Date.now() + body.secondsLeft * 1000;
            }
            setPhase((p) => (p === 'expired' ? 'waiting' : p));
            continue;
          }

          if (body.status === 'paid') {
            completePaid({
              amount: body.amount ?? created.amount,
              payerName: body.payerName || '',
              requestId: created.requestId
            });
          } else if (body.status === 'expired') {
            setPhase('expired');
          } else {
            // cancelled / not_found: the request is gone
            settledRef.current = true;
            onCloseRef.current?.();
          }
          return;
        } catch (err) {
          if (disposed) return;
          failures += 1;
          if (failures >= 5) {
            setError('Lost connection to the server. Check the internet and try again.');
            setPhase('error');
            return;
          }
          await sleep(3000);
        }
      }
    };

    run();

    return () => {
      disposed = true;
      controller.abort();   // also tells the server to stop holding the call
      // Window closed or retried without paying: free the amount so the next
      // QR for the same amount is not seen as a clash.
      if (!settledRef.current && requestIdRef.current) {
        cancelRequest(requestIdRef.current, true).catch(() => {});
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [attempt]);

  // ── Countdown (uses the display window's own timer when there is one, so it
  //    isn't throttled while that window is in front and the POS is behind) ──
  useEffect(() => {
    if (phase !== 'waiting') return undefined;
    const host = displayWin && !displayWin.closed ? displayWin : window;
    const tick = () => {
      const left = Math.max(0, Math.ceil((endAtRef.current - Date.now()) / 1000));
      setSecondsLeft(left);
      // Keep listening: a payment a few seconds late can still be matched
      // by the server's clock tolerance. Retry cleans the old request up.
      if (left === 0) setPhase((p) => (p === 'waiting' ? 'expired' : p));
    };
    tick();
    const timer = host.setInterval(tick, 250);
    return () => host.clearInterval(timer);
  }, [phase, displayWin]);

  // ── Smiley, then close ──
  useEffect(() => {
    if (phase !== 'paid') return undefined;
    const timer = setTimeout(() => onCloseRef.current?.(), 2500);
    return () => clearTimeout(timer);
  }, [phase]);

  // ── Operator: Cancel ──
  const handleClose = async () => {
    if (phase === 'paid' || !requestIdRef.current) {
      onClose?.();
      return;
    }
    setIsClosing(true);
    try {
      const res = await cancelRequest(requestIdRef.current);
      if (!res.ok) {
        // e.g. the payment landed a moment ago: stay open, the wait will report it
        setError(errorText(await readBody(res), 'Could not cancel the payment.'));
        return;
      }
      settledRef.current = true;
      onClose?.();
    } catch {
      setError('Could not reach the server to cancel. Try again.');
    } finally {
      setIsClosing(false);
    }
  };

  // ── Operator: Accept (the money was received) ──
  const handleAccept = async () => {
    if (!requestIdRef.current) return;
    setIsClosing(true);
    setError('');
    try {
      const res = await fetch(`${API}/ConfirmPayment`, {
        method: 'POST',
        headers: JSON_HEADERS,
        body: JSON.stringify({
          customerId,
          requestId: requestIdRef.current,
          payerName: 'Manual'
        })
      });
      const body = await readBody(res);
      if (!res.ok) {
        // e.g. "already completed": the payment just matched automatically and
        // the wait call will report it, so just show the message.
        setError(errorText(body, 'Could not accept the payment.'));
        return;
      }
      completePaid({
        amount: body?.amount ?? qrAmount ?? amount,
        payerName: '',
        requestId: requestIdRef.current,
        manual: true
      });
    } catch {
      setError('Could not reach the server to accept. Try again.');
    } finally {
      setIsClosing(false);
      setConfirmingAccept(false);
    }
  };

  const shownAmount = Number(qrAmount ?? amount);
  const upiLink = buildUpiLink({
    amount: shownAmount,
    note: invoiceNumber,
    ref: requestIdRef.current ? `REQ${requestIdRef.current}` : ''
  });
  const progress = windowSeconds > 0 ? (secondsLeft / windowSeconds) * 100 : 0;
  const canAccept = (phase === 'waiting' || phase === 'expired') && !!requestIdRef.current;
  const timerBlock = (
    <>
      <div className={`uqr-timer${secondsLeft <= 30 ? ' uqr-timer--low' : ''}`}>
        {formatClock(secondsLeft)}
      </div>
      <div className="uqr-bar">
        <div className="uqr-bar-fill" style={{ width: `${progress}%` }} />
      </div>
    </>
  );

  // ── CUSTOMER DISPLAY: QR and result only, no buttons ──
  // Wide small screens (like a 5-inch 800x480): QR on the left, details on the
  // right. The QR is sized from the window so it always fits.
  const landscape = dispSize.w >= dispSize.h * 1.3;
  const qrSize = landscape
    ? Math.max(160, Math.min(dispSize.h - 40, Math.floor(dispSize.w * 0.5)))
    : Math.max(160, Math.min(dispSize.w - 60, Math.floor(dispSize.h * 0.5)));

  const customerInfo = (
    <>
      <div className="uqr-display-title">Scan to pay with UPI</div>
      <div className="uqr-display-amount">₹{shownAmount.toFixed(2)}</div>
      {invoiceNumber && <div className="uqr-invoice">Invoice {invoiceNumber}</div>}
    </>
  );

  const customerView = (
    <div
      className="uqr-display"
      onDoubleClick={(e) => e.currentTarget.ownerDocument.documentElement.requestFullscreen?.()}
    >
      {phase === 'waiting' ? (
        <div className={`uqr-display-card${landscape ? ' uqr-display-card--wide' : ''}`}>
          <div className="uqr-qr">
            <QRCodeSVG value={upiLink} size={qrSize} level="M" includeMargin />
          </div>
          <div className="uqr-display-info">
            {customerInfo}
            {timerBlock}
            <p className="uqr-status">Open any UPI app and scan this code</p>
          </div>
        </div>
      ) : (
        <div className="uqr-display-card">
          {phase === 'paid' ? (
            <div className="uqr-paid">
              <div className="uqr-smiley" role="img" aria-label="Payment received">😊</div>
              <p className="uqr-status">Payment received. Thank you!</p>
            </div>
          ) : (
            <>
              {customerInfo}
              {(phase === 'creating' || phase === 'error') && (
                <p className="uqr-status">Please wait...</p>
              )}
              {phase === 'expired' && (
                <p className="uqr-status">This QR has expired. Please ask the cashier for a new one.</p>
              )}
            </>
          )}
        </div>
      )}
    </div>
  );

  // ── OPERATOR PANEL: status, Accept, Cancel (and the QR when there is no display) ──
  const operatorPanel = (
    <div className="uqr-overlay">
      <div className="uqr-window" role="dialog" aria-modal="true">
        <div className="uqr-header">
          <h2>UPI Payment</h2>
        </div>

        <div className="uqr-amount">₹{shownAmount.toFixed(2)}</div>
        {invoiceNumber && <div className="uqr-invoice">Invoice {invoiceNumber}</div>}

        {phase === 'creating' && <p className="uqr-status">Creating QR code...</p>}

        {phase === 'waiting' && (
          <>
            {displayWin ? (
              <p className="uqr-note">The QR code is showing on the customer display.</p>
            ) : (
              <>
                <div className="uqr-qr">
                  <QRCodeSVG value={upiLink} size={260} level="M" includeMargin />
                </div>
                {displayMode !== MODES.PANEL && (
                  <p className="uqr-note">No customer screen is connected, so the QR is shown here.</p>
                )}
              </>
            )}
            {timerBlock}
            <p className="uqr-status">Waiting for the customer to pay...</p>
          </>
        )}

        {phase === 'paid' && (
          <div className="uqr-paid">
            <div className="uqr-smiley" role="img" aria-label="Payment received">😊</div>
            <p className="uqr-status">
              {acceptedManually
                ? 'Payment accepted'
                : `Payment received${payerName ? ` from ${payerName}` : ''}`}
            </p>
          </div>
        )}

        {phase === 'expired' && (
          <div className="uqr-expired">
            <p className="uqr-status">The time ran out and no payment was received.</p>
            <button className="uqr-button" onClick={() => setAttempt((a) => a + 1)}>
              Generate new QR
            </button>
          </div>
        )}

        {phase === 'error' && (
          <div className="uqr-expired">
            <p className="uqr-error">{error}</p>
            <button className="uqr-button" onClick={() => setAttempt((a) => a + 1)}>
              Try again
            </button>
          </div>
        )}

        {(phase === 'waiting' || phase === 'expired') && error && <p className="uqr-error">{error}</p>}

        {phase !== 'paid' && !displayWin && displayMode !== MODES.PANEL && (
          <button className="uqr-link" onClick={openDisplay}>
            Open customer display
          </button>
        )}

        {canAccept && (
          confirmingAccept ? (
            <div className="uqr-accept-confirm">
              <p className="uqr-status">Have you received ₹{shownAmount.toFixed(2)}?</p>
              <div className="uqr-actions">
                <button className="uqr-cancel" onClick={() => setConfirmingAccept(false)} disabled={isClosing}>
                  No
                </button>
                <button className="uqr-accept" onClick={handleAccept} disabled={isClosing}>
                  {isClosing ? 'Accepting...' : 'Yes, accept'}
                </button>
              </div>
            </div>
          ) : (
            <button className="uqr-accept" onClick={() => setConfirmingAccept(true)} disabled={isClosing}>
              Accept payment
            </button>
          )
        )}

        {phase !== 'paid' && (
          <button className="uqr-cancel" onClick={handleClose} disabled={isClosing}>
            {isClosing ? 'Please wait...' : 'Cancel payment'}
          </button>
        )}
      </div>
    </div>
  );

  return (
    <>
      {operatorPanel}
      {displayWin && portalEl ? createPortal(customerView, portalEl) : null}
    </>
  );
}

export default UpiQrPayment;