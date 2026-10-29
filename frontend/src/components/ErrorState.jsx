import React from 'react';

export const ErrorState = ({
  title = 'Failed to load data',
  message,
  onRetry
}) => {
  return (
    <div style={{
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center',
      padding: '36px 24px',
      textAlign: 'center',
      background: 'rgba(239, 68, 68, 0.08)',
      border: '1px solid rgba(239, 68, 68, 0.25)',
      borderRadius: 'var(--radius-lg)',
      margin: '16px 0'
    }}>
      <div style={{
        fontSize: '2rem',
        marginBottom: '10px'
      }}>
        ⚠️
      </div>
      <h3 style={{
        fontSize: '1.05rem',
        fontWeight: 600,
        color: '#f87171',
        marginBottom: '6px'
      }}>
        {title}
      </h3>
      <p style={{
        fontSize: '0.875rem',
        color: '#fca5a5',
        maxWidth: '500px',
        lineHeight: 1.5,
        marginBottom: onRetry ? '16px' : 0
      }}>
        {message || 'An unexpected error occurred while communicating with the server.'}
      </p>
      {onRetry && (
        <button
          onClick={onRetry}
          style={{
            marginTop: '12px',
            padding: '8px 16px',
            backgroundColor: 'rgba(239, 68, 68, 0.2)',
            color: '#fff',
            border: '1px solid rgba(239, 68, 68, 0.4)',
            borderRadius: 'var(--radius-md)',
            cursor: 'pointer',
            fontSize: '0.85rem',
            fontWeight: 600
          }}
        >
          ↻ Try Again
        </button>
      )}
    </div>
  );
};

export default ErrorState;
