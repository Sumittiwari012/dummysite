import React, { useEffect, useState } from 'react';

import {
  MODES,
  loadSettings,
  saveSettings,
  listScreens,
  supportsScreenDetails
} from './customerDisplay';

import {
  getDeviceId,
  saveDeviceId,
  validateDeviceId
} from './remoteDisplay';

const choices = [
  [
    MODES.PANEL,
    'This screen only',
    'Show the QR in the cashier window.'
  ],
  [
    MODES.WINDOW,
    'Separate window',
    'Open the customer display in another window.'
  ],
  [
    MODES.TAB,
    'New tab',
    'Open the customer display in a new browser tab.'
  ],
  [
    MODES.REMOTE,
    'Customer panel (Android / separate device)',
    'Display the payment amount on a registered customer device.'
  ]
];

export default function CustomerDisplaySettings() {
  const initial = loadSettings();

  const [mode, setMode] = useState(initial.mode);
  const [screen, setScreen] = useState(initial.screen);
  const [screens, setScreens] = useState([]);
  const [deviceId, setDeviceId] = useState(getDeviceId());
  const [status, setStatus] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    let active = true;

    listScreens().then((items) => {
      if (active) setScreens(items);
    });

    return () => {
      active = false;
    };
  }, []);

  const handleSave = async () => {
    setSaving(true);
    setStatus('');

    if (mode === MODES.REMOTE) {
      const result = await validateDeviceId(deviceId);

      if (result !== 'valid') {
        setStatus(
          result === 'invalid'
            ? 'Device ID not found. Check the registered ID.'
            : 'Unable to connect to the display server.'
        );

        setSaving(false);
        return;
      }

      saveDeviceId(deviceId);
    } else {
      saveDeviceId('');
    }

    saveSettings({
      mode,
      screen: mode === MODES.WINDOW ? screen : ''
    });

    setStatus('Settings saved.');
    setSaving(false);
  };

  return (
    <section style={styles.card}>
      <h2 style={styles.heading}>Customer display settings</h2>

      <p style={styles.description}>
        Choose where customers will see their UPI payment QR.
      </p>

      <div style={styles.options}>
        {choices.map(([value, title, description]) => (
          <label
            key={value}
            style={{
              ...styles.option,
              borderColor: mode === value ? '#2563eb' : '#d1d5db'
            }}
          >
            <input
              type="radio"
              name="customer-display-mode"
              value={value}
              checked={mode === value}
              onChange={() => setMode(value)}
            />

            <span>
              <strong>{title}</strong>
              <small style={styles.small}>{description}</small>
            </span>
          </label>
        ))}
      </div>

      {mode === MODES.WINDOW && supportsScreenDetails() && (
        <label style={styles.field}>
          <span>Preferred screen</span>

          <select
            value={screen}
            onChange={(event) => setScreen(event.target.value)}
            style={styles.input}
          >
            <option value="">Default popup position</option>

            {screens.map((item) => (
              <option key={item.id} value={item.id}>
                {item.label}
              </option>
            ))}
          </select>
        </label>
      )}

      {mode === MODES.REMOTE && (
        <label style={styles.field}>
          <span>Customer panel device ID</span>

          <input
            value={deviceId}
            onChange={(event) => setDeviceId(event.target.value)}
            placeholder="Enter registered DeviceId"
            autoComplete="off"
            spellCheck={false}
            style={styles.input}
          />

          <small style={styles.small}>
            Enter the device ID registered in your backend database.
          </small>
        </label>
      )}

      <div style={styles.footer}>
        <button
          type="button"
          onClick={handleSave}
          disabled={saving}
          style={styles.button}
        >
          {saving ? 'Checking…' : 'Save settings'}
        </button>

        {status && <span role="status">{status}</span>}
      </div>
    </section>
  );
}

const styles = {
  card: {
    maxWidth: 680,
    padding: 20,
    border: '1px solid #e5e7eb',
    borderRadius: 12,
    background: '#fff',
    color: '#111827'
  },
  heading: {
    margin: '0 0 6px',
    fontSize: 21
  },
  description: {
    margin: '0 0 18px',
    color: '#6b7280'
  },
  options: {
    display: 'grid',
    gap: 10
  },
  option: {
    display: 'flex',
    alignItems: 'flex-start',
    gap: 10,
    border: '1px solid',
    borderRadius: 8,
    padding: 12,
    cursor: 'pointer'
  },
  small: {
    display: 'block',
    marginTop: 4,
    color: '#6b7280',
    fontSize: 12
  },
  field: {
    display: 'grid',
    gap: 7,
    marginTop: 18,
    fontWeight: 600
  },
  input: {
    padding: '10px 12px',
    border: '1px solid #d1d5db',
    borderRadius: 7,
    font: 'inherit',
    background: '#fff',
    color: '#111827'
  },
  footer: {
    display: 'flex',
    flexWrap: 'wrap',
    alignItems: 'center',
    gap: 12,
    marginTop: 20
  },
  button: {
    padding: '10px 16px',
    border: 0,
    borderRadius: 7,
    background: '#2563eb',
    color: '#fff',
    fontWeight: 600,
    cursor: 'pointer'
  }
};