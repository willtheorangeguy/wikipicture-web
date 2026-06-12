import { useState } from 'react';

const STORAGE_KEY = 'privacy-dismissed';

export function PrivacyBanner() {
  const [dismissed, setDismissed] = useState<boolean>(
    () => localStorage.getItem(STORAGE_KEY) === 'true'
  );

  if (dismissed) return null;

  const handleDismiss = () => {
    localStorage.setItem(STORAGE_KEY, 'true');
    setDismissed(true);
  };

  return (
    <div
      role="banner"
      style={{
        background: '#e3f2fd',
        borderBottom: '1px solid #bbdefb',
        padding: '0.55rem 1.5rem',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        gap: '1rem',
        fontSize: '0.85rem',
        color: '#0d47a1',
      }}
    >
      <span>
        🔒{' '}
        <strong>Your photos are processed securely</strong> and permanently deleted after 1 hour.
        We never store or share your images.
      </span>
      <button
        onClick={handleDismiss}
        aria-label="Dismiss privacy notice"
        style={{
          background: 'none',
          border: 'none',
          cursor: 'pointer',
          color: '#1565c0',
          fontSize: '1.1rem',
          lineHeight: 1,
          padding: '0.1rem 0.3rem',
          flexShrink: 0,
        }}
        onMouseOver={(e) => (e.currentTarget.style.color = '#0d47a1')}
        onMouseOut={(e) => (e.currentTarget.style.color = '#1565c0')}
      >
        ×
      </button>
    </div>
  );
}
