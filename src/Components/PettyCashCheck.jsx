import React, { useState, useEffect } from 'react';

const API_BASE_URL = 'https://dummypossetup.runasp.net';

function PettyCashCheck({ counterId, onAccepted }) {
  const [pettyCash, setPettyCash] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [accepting, setAccepting] = useState(false);

  useEffect(() => {
  const fetchPettyCash = async () => {
    setLoading(true);
    setError('');
    try {
      const response = await fetch(`${API_BASE_URL}/api/PettyCash/check/${counterId}`);
      const data = await response.json();

      if (!response.ok) {
        setError(data.message || 'Could not fetch petty cash.');
        return;
      }

      if (!data.hasPending) {
        // Nothing pending — skip straight through.
        onAccepted();
        return;
      }

      setPettyCash(data);
    } catch (err) {
      console.error('Petty cash fetch error:', err);
      setError('Could not reach the server. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  if (counterId) {
    fetchPettyCash();
  }
}, [counterId, onAccepted]);

  const handleAccept = async () => {
    setAccepting(true);
    setError('');
    try {
      const response = await fetch(`${API_BASE_URL}/api/PettyCash/accept`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ counterId: Number(counterId) })
      });
      const data = await response.json();

      if (!response.ok) {
        setError(data.message || 'Could not accept petty cash.');
        return;
      }

      onAccepted();
    } catch (err) {
      console.error('Petty cash accept error:', err);
      setError('Could not reach the server. Please try again.');
    } finally {
      setAccepting(false);
    }
  };

  return (
    <div style={styles.overlay}>
      <div style={styles.box}>
        <h2 style={styles.title}>Petty Cash Check</h2>

        {loading && <p>Checking petty cash...</p>}

        {!loading && error && <p style={styles.error}>{error}</p>}

        {!loading && !error && pettyCash && (
          <>
            <p style={styles.amount}>₹{Number(pettyCash.pettyCash).toFixed(2)}</p>
            <p style={styles.text}>Confirm you have received this amount to continue.</p>
            <button
              onClick={handleAccept}
              style={styles.button}
              disabled={accepting}
            >
              {accepting ? 'Accepting...' : 'Accept'}
            </button>
          </>
        )}
      </div>
    </div>
  );
}

const styles = {
  overlay: {
    position: 'fixed',
    top: 0,
    left: 0,
    width: '100vw',
    height: '100vh',
    backgroundColor: 'rgba(0, 0, 0, 0.85)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 9999
  },
  box: {
    backgroundColor: '#fff',
    padding: '2rem 2.5rem',
    borderRadius: '10px',
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    gap: '12px',
    minWidth: '320px',
    boxShadow: '0 10px 30px rgba(0,0,0,0.4)'
  },
  title: {
    margin: 0
  },
  amount: {
    fontSize: '2rem',
    fontWeight: 'bold',
    margin: '10px 0',
    color: '#0056b3'
  },
  text: {
    margin: 0,
    color: '#555',
    textAlign: 'center'
  },
  error: {
    color: '#dc3545',
    fontSize: '0.9rem',
    margin: 0
  },
  button: {
    marginTop: '10px',
    width: '100%',
    padding: '10px',
    backgroundColor: '#0056b3',
    color: '#fff',
    border: 'none',
    borderRadius: '6px',
    cursor: 'pointer',
    fontWeight: 'bold',
    fontSize: '1rem'
  }
};

export default PettyCashCheck;