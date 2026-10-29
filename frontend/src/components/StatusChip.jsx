import React from 'react';

const statusThemes = {
  // Positive / Success
  approved: { bg: '#DCFCE7', text: '#16A34A', border: '#BBF7D0' },
  awarded: { bg: '#DCFCE7', text: '#16A34A', border: '#BBF7D0' },
  delivered: { bg: '#DCFCE7', text: '#16A34A', border: '#BBF7D0' },
  resolved: { bg: '#DCFCE7', text: '#16A34A', border: '#BBF7D0' },
  active: { bg: '#DCFCE7', text: '#16A34A', border: '#BBF7D0' },
  ok: { bg: '#DCFCE7', text: '#16A34A', border: '#BBF7D0' },
  low: { bg: '#DCFCE7', text: '#16A34A', border: '#BBF7D0' },

  // Warnings / Pending / In Progress
  pending: { bg: '#FEF3C7', text: '#D97706', border: '#FDE68A' },
  pending_approval: { bg: '#FEF3C7', text: '#D97706', border: '#FDE68A' },
  partially_delivered: { bg: '#FEF3C7', text: '#D97706', border: '#FDE68A' },
  open: { bg: '#FEF3C7', text: '#D97706', border: '#FDE68A' },
  medium: { bg: '#FEF3C7', text: '#D97706', border: '#FDE68A' },
  under_review: { bg: '#FEF3C7', text: '#D97706', border: '#FDE68A' },

  // Primary / Blue states
  submitted: { bg: '#DBEAFE', text: '#2563EB', border: '#BFDBFE' },
  rfq_issued: { bg: '#DBEAFE', text: '#2563EB', border: '#BFDBFE' },
  issued: { bg: '#DBEAFE', text: '#2563EB', border: '#BFDBFE' },
  po_issued: { bg: '#E0F2FE', text: '#0284C7', border: '#BAE6FD' },
  quotes_received: { bg: '#E0F2FE', text: '#0284C7', border: '#BAE6FD' },
  evaluated: { bg: '#E0E7FF', text: '#4338CA', border: '#C7D2FE' },
  onboarding: { bg: '#DBEAFE', text: '#2563EB', border: '#BFDBFE' },

  // Danger / Negative states
  rejected: { bg: '#FEE2E2', text: '#DC2626', border: '#FECACA' },
  cancelled: { bg: '#F1F5F9', text: '#64748B', border: '#E2E8F0' },
  closed: { bg: '#F1F5F9', text: '#64748B', border: '#E2E8F0' },
  inactive: { bg: '#F1F5F9', text: '#64748B', border: '#E2E8F0' },
  blacklisted: { bg: '#FEE2E2', text: '#DC2626', border: '#FECACA' },
  high: { bg: '#FEE2E2', text: '#DC2626', border: '#FECACA' },
  critical: { bg: '#FEE2E2', text: '#B91C1C', border: '#FECACA' },
  waived: { bg: '#F1F5F9', text: '#64748B', border: '#E2E8F0' },
  expired: { bg: '#FEE2E2', text: '#DC2626', border: '#FECACA' },
  draft: { bg: '#F1F5F9', text: '#64748B', border: '#CBD5E1' }
};

export const StatusChip = ({ status, label, size = 'md' }) => {
  if (!status) return null;
  const key = String(status).toLowerCase();
  const theme = statusThemes[key] || {
    bg: '#F1F5F9',
    text: '#475569',
    border: '#E2E8F0'
  };

  const displayText = label || String(status).replace(/_/g, ' ');

  const style = {
    display: 'inline-flex',
    alignItems: 'center',
    gap: '6px',
    padding: size === 'sm' ? '2px 8px' : '4px 10px',
    borderRadius: '9999px',
    fontSize: size === 'sm' ? '0.725rem' : '0.775rem',
    fontWeight: 600,
    textTransform: 'capitalize',
    letterSpacing: '0.01em',
    whiteSpace: 'nowrap',
    backgroundColor: theme.bg,
    color: theme.text,
    border: `1px solid ${theme.border}`
  };

  const dotStyle = {
    width: '6px',
    height: '6px',
    borderRadius: '50%',
    backgroundColor: theme.text
  };

  return (
    <span style={style}>
      <span style={dotStyle} />
      {displayText}
    </span>
  );
};

export default StatusChip;
