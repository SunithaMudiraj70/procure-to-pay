import React from 'react';
import { formatDateTime } from '../lib/formatters.js';
import { CheckCircle2, Clock, XCircle } from 'lucide-react';

const levelNames = {
  1: 'Dept Manager',
  2: 'Procurement Head',
  3: 'Finance Director',
  4: 'CFO'
};

export const Stepper = ({ requiredLevel = 1, approvals = [] }) => {
  const steps = [];
  const maxLevel = Math.max(1, Math.min(4, requiredLevel || 1));
  const safeApprovals = Array.isArray(approvals) ? approvals : [];

  for (let lvl = 1; lvl <= maxLevel; lvl++) {
    const approval = safeApprovals.find((a) => a?.approval_level === lvl);
    steps.push({
      level: lvl,
      name: levelNames[lvl] || `Level ${lvl}`,
      approval
    });
  }

  return (
    <div
      style={{
        display: 'grid',
        gridTemplateColumns: `repeat(${steps.length}, minmax(0, 1fr))`,
        gap: '12px',
        margin: '16px 0'
      }}
    >
      {steps.map((step) => {
        const decision = step.approval?.decision || 'pending';
        const isApproved = decision === 'approved';
        const isRejected = decision === 'rejected';

        let borderColor = 'var(--border)';
        let bgColor = 'var(--bg-surface-subtle)';
        let textColor = 'var(--text-muted)';
        let icon = <Clock size={16} color="var(--text-subtle)" />;

        if (isApproved) {
          borderColor = 'var(--success-border)';
          bgColor = 'var(--success-soft)';
          textColor = 'var(--success)';
          icon = <CheckCircle2 size={16} color="var(--success)" />;
        } else if (isRejected) {
          borderColor = 'var(--danger-border)';
          bgColor = 'var(--danger-soft)';
          textColor = 'var(--danger)';
          icon = <XCircle size={16} color="var(--danger)" />;
        }

        return (
          <div
            key={step.level}
            style={{
              backgroundColor: 'var(--bg-surface)',
              border: `1px solid ${borderColor}`,
              borderRadius: 'var(--radius-md)',
              padding: '14px',
              display: 'flex',
              flexDirection: 'column',
              gap: '6px'
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <span style={{ fontSize: '0.725rem', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase' }}>
                Tier {step.level}
              </span>
              <span
                style={{
                  fontSize: '0.725rem',
                  padding: '2px 8px',
                  borderRadius: 'var(--radius-full)',
                  backgroundColor: bgColor,
                  color: textColor,
                  fontWeight: 600,
                  textTransform: 'capitalize',
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '4px'
                }}
              >
                {icon}
                {decision}
              </span>
            </div>

            <div style={{ fontSize: '0.875rem', fontWeight: 600, color: 'var(--text-main)' }}>
              {step.name}
            </div>

            {step.approval?.approver_name && (
              <div style={{ fontSize: '0.775rem', color: 'var(--text-muted)' }}>
                Reviewer: <strong style={{ color: 'var(--text-main)' }}>{step.approval.approver_name}</strong>
              </div>
            )}

            {step.approval?.decided_at && (
              <div style={{ fontSize: '0.725rem', color: 'var(--text-subtle)' }} className="date-num">
                {formatDateTime(step.approval.decided_at)}
              </div>
            )}

            {step.approval?.comments && (
              <div
                style={{
                  marginTop: '4px',
                  fontSize: '0.75rem',
                  fontStyle: 'italic',
                  color: 'var(--text-muted)',
                  backgroundColor: 'var(--bg-surface-subtle)',
                  padding: '4px 8px',
                  borderRadius: 'var(--radius-sm)'
                }}
              >
                "{step.approval.comments}"
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
};

export default Stepper;
