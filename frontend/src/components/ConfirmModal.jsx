import React from 'react';
import { useUiStore } from '../store/useUiStore.js';
import { AlertCircle, AlertTriangle } from 'lucide-react';

export const ConfirmModal = () => {
  const confirmDialog = useUiStore((state) => state.confirmDialog);
  const closeConfirm = useUiStore((state) => state.closeConfirm);

  if (!confirmDialog.isOpen) return null;

  const handleConfirm = () => {
    if (confirmDialog.onConfirm) {
      confirmDialog.onConfirm();
    }
    closeConfirm();
  };

  const handleCancel = () => {
    if (confirmDialog.onCancel) {
      confirmDialog.onCancel();
    }
    closeConfirm();
  };

  const isDanger = confirmDialog.variant === 'danger';
  const isWarning = confirmDialog.variant === 'warning';

  return (
    <div className="modal-overlay" onClick={handleCancel}>
      <div
        className="modal-content"
        onClick={(e) => e.stopPropagation()}
        style={{ maxWidth: '440px', padding: '24px' }}
      >
        <div style={{ display: 'flex', gap: '16px', alignItems: 'flex-start' }}>
          <div
            style={{
              width: '42px',
              height: '42px',
              borderRadius: 'var(--radius-full)',
              backgroundColor: isDanger ? 'var(--danger-soft)' : isWarning ? 'var(--warning-soft)' : 'var(--primary-soft)',
              color: isDanger ? 'var(--danger)' : isWarning ? 'var(--warning)' : 'var(--primary)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              flexShrink: 0
            }}
          >
            {isDanger ? <AlertCircle size={22} /> : <AlertTriangle size={22} />}
          </div>

          <div style={{ flex: 1 }}>
            <h3 style={{ fontSize: '1.125rem', fontWeight: 700, marginBottom: '8px' }}>
              {confirmDialog.title}
            </h3>
            <p style={{ fontSize: '0.875rem', color: 'var(--text-muted)', lineHeight: 1.5, marginBottom: '20px' }}>
              {confirmDialog.message}
            </p>

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px' }}>
              <button
                type="button"
                className="btn btn-secondary"
                onClick={handleCancel}
              >
                {confirmDialog.cancelText || 'Cancel'}
              </button>
              <button
                type="button"
                className={`btn ${isDanger ? 'btn-danger' : 'btn-primary'}`}
                onClick={handleConfirm}
              >
                {confirmDialog.confirmText || 'Confirm'}
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ConfirmModal;
