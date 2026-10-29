import React from 'react';
import { formatDateTime } from '../lib/formatters.js';

export const Timeline = ({ events = [], emptyMessage = 'No timeline events recorded.' }) => {
  if (!events || events.length === 0) {
    return (
      <div
        style={{
          padding: '24px',
          textAlign: 'center',
          color: 'var(--text-muted)',
          fontSize: '0.875rem',
          backgroundColor: 'var(--bg-surface-subtle)',
          borderRadius: 'var(--radius-md)'
        }}
      >
        {emptyMessage}
      </div>
    );
  }

  return (
    <div style={{ position: 'relative', paddingLeft: '28px', margin: '16px 0' }}>
      {/* Vertical Track Line */}
      <div
        style={{
          position: 'absolute',
          left: '9px',
          top: '6px',
          bottom: '6px',
          width: '2px',
          backgroundColor: 'var(--border)'
        }}
      />

      {events.map((event, idx) => {
        const timeStr = formatDateTime(event.event_at || event.actual_date || event.created_at);
        const title = event.title || (event.from_status
          ? `${event.from_status} → ${event.to_status}`
          : event.to_status || event.status || 'Status update');

        return (
          <div
            key={event.event_id || event.delivery_id || idx}
            style={{
              position: 'relative',
              marginBottom: idx === events.length - 1 ? 0 : '20px'
            }}
          >
            {/* Dot marker */}
            <div
              style={{
                position: 'absolute',
                left: '-28px',
                top: '4px',
                width: '18px',
                height: '18px',
                borderRadius: '50%',
                backgroundColor: 'var(--bg-surface)',
                border: '2px solid var(--primary)',
                boxShadow: '0 0 0 3px var(--primary-soft)'
              }}
            />

            <div
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'baseline',
                gap: '12px',
                flexWrap: 'wrap'
              }}
            >
              <span
                style={{
                  fontSize: '0.875rem',
                  fontWeight: 600,
                  color: 'var(--text-main)',
                  textTransform: 'capitalize'
                }}
              >
                {title.replace(/_/g, ' ')}
              </span>
              <span
                className="date-num"
                style={{
                  fontSize: '0.75rem',
                  color: 'var(--text-muted)'
                }}
              >
                {timeStr}
              </span>
            </div>

            {(event.actor_name || event.reason || event.notes || event.carrier) && (
              <div
                style={{
                  marginTop: '4px',
                  fontSize: '0.8125rem',
                  color: 'var(--text-muted)',
                  lineHeight: 1.4
                }}
              >
                {event.actor_name && <span>By <strong>{event.actor_name}</strong>. </span>}
                {event.reason && <span>Reason: {event.reason} </span>}
                {event.notes && <span>{event.notes} </span>}
                {event.carrier && <span>Carrier: {event.carrier} {event.tracking_ref ? `(#${event.tracking_ref})` : ''}</span>}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
};

export default Timeline;
