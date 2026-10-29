import React from 'react';
import { useUiStore } from '../store/useUiStore.js';
import { CheckCircle2, AlertTriangle, XCircle, Info, X } from 'lucide-react';

const icons = {
  success: <CheckCircle2 size={18} className="text-emerald-600 flex-shrink-0" style={{ color: 'var(--success)' }} />,
  warning: <AlertTriangle size={18} className="text-amber-600 flex-shrink-0" style={{ color: 'var(--warning)' }} />,
  error: <XCircle size={18} className="text-rose-600 flex-shrink-0" style={{ color: 'var(--danger)' }} />,
  info: <Info size={18} className="text-sky-600 flex-shrink-0" style={{ color: 'var(--primary)' }} />
};

export const ToastContainer = () => {
  const toasts = useUiStore((state) => state.toasts);
  const removeToast = useUiStore((state) => state.removeToast);

  if (toasts.length === 0) return null;

  return (
    <div
      style={{
        position: 'fixed',
        bottom: '24px',
        right: '24px',
        zIndex: 9999,
        display: 'flex',
        flexDirection: 'column',
        gap: '8px',
        maxWidth: '420px',
        width: '100%',
        pointerEvents: 'none'
      }}
    >
      {toasts.map((toast) => (
        <div
          key={toast.id}
          style={{
            pointerEvents: 'auto',
            display: 'flex',
            alignItems: 'flex-start',
            gap: '12px',
            backgroundColor: 'var(--bg-surface)',
            border: '1px solid var(--border)',
            borderRadius: 'var(--radius-lg)',
            boxShadow: '0 10px 25px -5px rgba(15, 23, 42, 0.15)',
            padding: '14px 16px',
            animation: 'scaleUp 0.15s ease-out'
          }}
        >
          {icons[toast.type] || icons.info}
          <div style={{ flex: 1, minWidth: 0 }}>
            {toast.title && (
              <h5 style={{ fontSize: '0.875rem', fontWeight: 600, color: 'var(--text-main)', marginBottom: '2px' }}>
                {toast.title}
              </h5>
            )}
            <p style={{ fontSize: '0.8125rem', color: 'var(--text-muted)', lineHeight: 1.4 }}>
              {toast.message}
            </p>
          </div>
          <button
            onClick={() => removeToast(toast.id)}
            style={{
              background: 'none',
              border: 'none',
              color: 'var(--text-subtle)',
              cursor: 'pointer',
              padding: '2px',
              display: 'flex',
              alignItems: 'center'
            }}
            aria-label="Dismiss"
          >
            <X size={16} />
          </button>
        </div>
      ))}
    </div>
  );
};

export default ToastContainer;
