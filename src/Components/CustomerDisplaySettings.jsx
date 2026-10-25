import React, { useState } from 'react';
import {
  MODES,
  loadSettings,
  saveSettings,
  listScreens,
  featuresFor,
  supportsScreenDetails
} from './customerDisplay';
import { getDeviceId, saveDeviceId, validateDeviceId } from './remoteDisplay';
import './upiQrPayment.css';

/**
 * Where should the UPI QR be shown to the customer?
 * The choice is saved on this computer.
 *
 * Props
 *  onClose()   close the window
 *  onSaved()   called after a successful save
 */
function CustomerDisplaySettings({ onClose, onSaved }) {
  const saved = loadSettings();
  const canDetect = supportsScreenDetails();

  const [mode, setMode] = useState(saved.mode);
  const [screen, setScreen] = useState(saved.screen);
  const [screens, setScreens] = useState(saved.screen ? [saved.screen] : []);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState({ text: '', error: false });

  // Customer panel (separate web page) device ID
  const [deviceId, setDeviceId] = useState(() => getDeviceId());
  const [validatedId, setValidatedId] = useState(() => getDeviceId()); // the saved one was checked when it was saved
  const [checking, setChecking] = useState(false);

  const tell = (text, error = false) => setMessage({ text, error });

  // Needs a click: the browser asks for "Window management" permission the first time.
  const detect = async () => {
    setBusy(true);
    tell('');
    try {
      const list = await listScreens();
      setScreens(list);

      const stillThere = screen && list.find((s) => s.id === screen.id);
      if (stillThere) {
        setScreen(stillThere);
      } else {
        // the customer screen is usually the smaller one that is not the POS screen
        const others = list.filter((s) => !s.isCurrent).sort((a, b) => a.width - b.width);
        setScreen(others[0] || null);
      }

      if (list.length < 2) {
        tell('Only one screen found. Connect the customer screen, press Win+P, choose Extend, then detect again.', true);
      } else {
        tell(`${list.length} screens found. Pick the customer screen.`);
      }
    } catch {
      tell('Screen detection was blocked. Allow "Window management" for this site and try again.', true);
    } finally {
      setBusy(false);
    }
  };

  // Checks the device ID with the server. Resolves to true when it exists.
  const checkDeviceId = async () => {
    const value = deviceId.trim();
    if (!value) {
      tell('Enter a device ID first.', true);
      return false;
    }
    setChecking(true);
    tell('');
    const result = await validateDeviceId(value);
    setChecking(false);
    if (result === 'valid') {
      setValidatedId(value);
      tell(`Device ID "${value}" is valid.`);
      return true;
    }
    if (result === 'invalid') {
      tell('This device ID does not exist.', true);
    } else {
      tell('Cannot reach the server. Check the internet and try again.', true);
    }
    return false;
  };

  // Opens a small test page where the QR will appear (runs inside the click)
  const test = () => {
    if (mode === MODES.WINDOW && !screen) {
      tell('Pick a screen first.', true);
      return;
    }
    const w = mode === MODES.WINDOW
      ? window.open('', '_blank', featuresFor(screen))
      : window.open('', '_blank');
    if (!w) {
      tell('Pop-up blocked. Allow pop-ups for this site and try again.', true);
      return;
    }
    w.document.title = 'Customer display test';
    w.document.body.style.cssText =
      'margin:0;height:100vh;display:flex;align-items:center;justify-content:center;' +
      'font:28px system-ui,sans-serif;background:#111;color:#fff;text-align:center';
    w.document.body.textContent = 'Customer display test';
    setTimeout(() => { try { w.close(); } catch { /* already closed */ } }, 4000);
    tell('A test page was opened for 4 seconds.');
  };

  const save = async () => {
    if (mode === MODES.WINDOW && !screen) {
      tell('Detect the screens and pick the customer screen first.', true);
      return;
    }

    // A device ID is only saved once the server has confirmed it exists.
    // An empty box removes the saved ID.
    const value = deviceId.trim();
    if (value && value !== validatedId) {
      const ok = await checkDeviceId();
      if (!ok) return;
    }

    saveDeviceId(value);
    saveSettings({ mode, screen });
    onSaved?.();
    onClose?.();
  };

  const radio = (value, title, text, disabled = false) => (
    <label className={`cds-option${mode === value ? ' cds-option--on' : ''}${disabled ? ' cds-option--off' : ''}`}>
      <input
        type="radio"
        name="cds-mode"
        checked={mode === value}
        disabled={disabled}
        onChange={() => { setMode(value); tell(''); }}
      />
      <span>
        <strong>{title}</strong>
        <small>{text}</small>
      </span>
    </label>
  );

  const idTrimmed = deviceId.trim();
  const idIsValid = idTrimmed !== '' && idTrimmed === validatedId;

  return (
    <div className="cds-overlay">
      <div className="cds-window" role="dialog" aria-modal="true">
        <div className="uqr-header">
          <h2>Customer display</h2>
          <button className="uqr-close" onClick={onClose} aria-label="Close">×</button>
        </div>
        <p className="cds-hint">
          Choose where the UPI QR is shown to the customer. This is saved on this computer.
        </p>

        {radio(
          MODES.PANEL,
          'This screen only',
          'No customer display. The QR, Accept and Cancel are all in the POS window.'
        )}
        {radio(
          MODES.WINDOW,
          'Customer screen (automatic)',
          canDetect
            ? 'Windows with Chrome or Edge. The QR opens by itself on the screen you pick below.'
            : 'Needs Chrome or Edge on a computer. Not available in this browser.',
          !canDetect
        )}
        {radio(
          MODES.TAB,
          'Separate tab (choose manually)',
          'The QR opens in a new tab. Drag it to the customer screen yourself.'
        )}

        {mode === MODES.WINDOW && (
          <div className="cds-screens">
            <button className="uqr-button" onClick={detect} disabled={busy}>
              {busy ? 'Detecting...' : 'Detect screens'}
            </button>

            {screens.map((s) => (
              <label key={s.id} className={`cds-screen${screen?.id === s.id ? ' cds-screen--on' : ''}`}>
                <input
                  type="radio"
                  name="cds-screen"
                  checked={screen?.id === s.id}
                  onChange={() => setScreen(s)}
                />
                <span>
                  <strong>{s.label}</strong>
                  <small>
                    {s.width}×{s.height}
                    {s.isPrimary ? ' · main screen' : ''}
                    {s.isCurrent ? ' · POS is on this screen' : ''}
                  </small>
                </span>
              </label>
            ))}

            {screens.length === 0 && (
              <p className="cds-hint">Press "Detect screens" with the customer screen connected.</p>
            )}
          </div>
        )}

        {/* Customer panel device ID: added here, checked with the server, saved on this computer */}
        <div className="cds-screens">
          <strong>Customer panel device ID (optional)</strong>
          <div style={{ display: 'flex', gap: 8 }}>
            <input
              type="text"
              value={deviceId}
              onChange={(e) => setDeviceId(e.target.value)}
              placeholder="e.g. COUNTER1"
              autoComplete="off"
              spellCheck={false}
              disabled={checking}
              style={{ flex: 1, padding: 8, border: '1px solid #ccc', borderRadius: 4 }}
            />
            <button className="uqr-button" onClick={checkDeviceId} disabled={checking || !idTrimmed}>
              {checking ? 'Checking...' : 'Validate'}
            </button>
          </div>
          <small className="cds-hint">
            {idIsValid
              ? '✓ Valid. It is saved on this computer when you press Save.'
              : 'The ID must exist in the database. It is checked when you press Validate or Save. Leave empty to remove it.'}
          </small>
        </div>

        {message.text && (
          <p className={message.error ? 'uqr-error' : 'uqr-status'}>{message.text}</p>
        )}

        <div className="uqr-actions cds-actions">
          {mode !== MODES.PANEL && (
            <button className="uqr-cancel" onClick={test}>Test</button>
          )}
          <button className="uqr-cancel" onClick={onClose}>Cancel</button>
          <button className="uqr-accept" onClick={save} disabled={checking}>Save</button>
        </div>

        <p className="cds-hint">
          If the customer screen is not connected when a payment starts, the QR is shown in the POS
          window and you can accept the payment there.
        </p>
      </div>
    </div>
  );
}

export default CustomerDisplaySettings;
