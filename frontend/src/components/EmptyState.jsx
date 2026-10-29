import React from 'react';

export const EmptyState = ({
  icon,
  title = 'No records found',
  description = 'There is currently no data available. Run the data generator or check back after transactions occur.',
  actionLabel,
  onAction
}) => {
  return (
    <div style={{
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center',
      padding: '48px 24px',
      textAlign: 'center',
      background: 'var(--bg-surface-subtle, #f8fafc)',
      border: '1px dashed var(--border, #e2e8f0)',
      borderRadius: 'var(--radius-lg)',
      margin: '16px 0'
    }}>
      <div style={{
        fontSize: '2.5rem',
        marginBottom: '12px',
        opacity: 0.8
      }}>
        {icon || '📭'}
      </div>
      <h3 style={{
        fontSize: '1.1rem',
        fontWeight: 600,
        color: 'var(--text-primary)',
        marginBottom: '6px'
      }}>
        {title}
      </h3>
      <p style={{
        fontSize: '0.9rem',
        color: 'var(--text-secondary)',
        maxWidth: '440px',
        lineHeight: 1.5,
        marginBottom: actionLabel ? '16px' : 0
      }}>
        {description}
      </p>
      {actionLabel && onAction && (
        <button
          onClick={onAction}
          className="btn-primary"
          style={{ marginTop: '16px' }}
        >
          {actionLabel}
        </button>
      )}
    </div>
  );
};

export default EmptyState;
