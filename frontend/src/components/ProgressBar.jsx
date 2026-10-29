import React from 'react';

export const ProgressBar = ({
  value = 0,
  max = 100,
  label,
  valueText,
  color = 'var(--accent-primary)',
  height = 8,
  segments = null
}) => {
  if (segments && Array.isArray(segments)) {
    const total = max || segments.reduce((sum, s) => sum + (s.value || 0), 0) || 1;
    return (
      <div style={{ width: '100%', margin: '4px 0' }}>
        {(label || valueText) && (
          <div style={{
            display: 'flex',
            justifyContent: 'space-between',
            fontSize: '0.8rem',
            marginBottom: '4px',
            color: 'var(--text-secondary)'
          }}>
            {label && <span>{label}</span>}
            {valueText && <span style={{ fontVariantNumeric: 'tabular-nums' }}>{valueText}</span>}
          </div>
        )}
        <div style={{
          width: '100%',
          height: `${height}px`,
          backgroundColor: 'rgba(255, 255, 255, 0.08)',
          borderRadius: `${height}px`,
          overflow: 'hidden',
          display: 'flex'
        }}>
          {segments.map((seg, idx) => {
            const pct = Math.max(0, Math.min(100, (seg.value / total) * 100));
            return (
              <div
                key={idx}
                title={`${seg.label || ''}: ${seg.value}`}
                style={{
                  width: `${pct}%`,
                  height: '100%',
                  backgroundColor: seg.color || color,
                  transition: 'width 0.3s ease'
                }}
              />
            );
          })}
        </div>
      </div>
    );
  }

  const pct = Math.max(0, Math.min(100, max > 0 ? (value / max) * 100 : 0));

  return (
    <div style={{ width: '100%', margin: '4px 0' }}>
      {(label || valueText) && (
        <div style={{
          display: 'flex',
          justifyContent: 'space-between',
          fontSize: '0.8rem',
          marginBottom: '4px',
          color: 'var(--text-secondary)'
        }}>
          {label && <span>{label}</span>}
          <span style={{ fontVariantNumeric: 'tabular-nums' }}>
            {valueText || `${pct.toFixed(0)}%`}
          </span>
        </div>
      )}
      <div style={{
        width: '100%',
        height: `${height}px`,
        backgroundColor: 'rgba(255, 255, 255, 0.08)',
        borderRadius: `${height}px`,
        overflow: 'hidden'
      }}>
        <div style={{
          width: `${pct}%`,
          height: '100%',
          backgroundColor: color,
          borderRadius: `${height}px`,
          transition: 'width 0.3s ease'
        }} />
      </div>
    </div>
  );
};

export default ProgressBar;
