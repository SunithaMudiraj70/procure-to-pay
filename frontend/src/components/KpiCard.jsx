import React from 'react';

export const KpiCard = ({
  title,
  value,
  caption,
  trend,
  trendType = 'neutral', // 'positive' | 'negative' | 'warning' | 'neutral'
  icon: Icon,
  iconColor = 'var(--primary)',
  iconBg = 'var(--primary-soft)',
  onClick
}) => {
  const getTrendStyle = () => {
    switch (trendType) {
      case 'positive':
        return { bg: 'var(--success-soft)', text: 'var(--success)' };
      case 'warning':
        return { bg: 'var(--warning-soft)', text: 'var(--warning)' };
      case 'negative':
        return { bg: 'var(--danger-soft)', text: 'var(--danger)' };
      default:
        return { bg: 'var(--bg-surface-subtle)', text: 'var(--text-muted)' };
    }
  };

  const trendStyle = getTrendStyle();

  return (
    <div
      onClick={onClick}
      className="card"
      style={{
        padding: '20px',
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'space-between',
        cursor: onClick ? 'pointer' : 'default',
        transition: 'transform 0.15s ease, box-shadow 0.15s ease'
      }}
    >
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: '12px' }}>
        <span style={{ fontSize: '0.85rem', fontWeight: 600, color: 'var(--text-muted)' }}>
          {title}
        </span>
        {Icon && (
          <div
            style={{
              width: '36px',
              height: '36px',
              borderRadius: 'var(--radius-md)',
              backgroundColor: iconBg,
              color: iconColor,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              flexShrink: 0
            }}
          >
            <Icon size={18} />
          </div>
        )}
      </div>

      <div>
        <div
          className="tabular-nums"
          style={{
            fontSize: '1.75rem',
            fontWeight: 700,
            color: 'var(--text-main)',
            letterSpacing: '-0.02em',
            lineHeight: 1.2
          }}
        >
          {value !== undefined && value !== null ? value : '—'}
        </div>

        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginTop: '10px', gap: '8px', flexWrap: 'wrap' }}>
          {caption && (
            <span style={{ fontSize: '0.775rem', color: 'var(--text-muted)' }}>
              {caption}
            </span>
          )}

          {trend && (
            <span
              style={{
                fontSize: '0.725rem',
                fontWeight: 600,
                padding: '2px 8px',
                borderRadius: 'var(--radius-full)',
                backgroundColor: trendStyle.bg,
                color: trendStyle.text,
                display: 'inline-flex',
                alignItems: 'center',
                gap: '4px'
              }}
            >
              {trend}
            </span>
          )}
        </div>
      </div>
    </div>
  );
};

export default KpiCard;
