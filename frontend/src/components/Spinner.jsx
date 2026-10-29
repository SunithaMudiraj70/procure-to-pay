import React from 'react';

export const Spinner = ({ size = 'md', message }) => {
  const sizePx = size === 'sm' ? 18 : size === 'lg' ? 36 : 24;

  return (
    <div style={{
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center',
      padding: '32px 16px',
      gap: '12px',
      color: 'var(--text-secondary)'
    }}>
      <div style={{
        width: `${sizePx}px`,
        height: `${sizePx}px`,
        border: '3px solid rgba(255, 255, 255, 0.1)',
        borderTopColor: 'var(--accent-primary)',
        borderRadius: '50%',
        animation: 'spin 0.8s linear infinite'
      }} />
      {message && <span style={{ fontSize: '0.875rem' }}>{message}</span>}
    </div>
  );
};

export default Spinner;
