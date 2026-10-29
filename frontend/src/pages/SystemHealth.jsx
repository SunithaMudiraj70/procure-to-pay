import React from 'react';
import useHealth from '../hooks/useHealth.js';

export default function SystemHealth() {
  const { apiHealth, dbHealth, loading, lastChecked, refetch } = useHealth();

  return (
    <div>
      <div style={{
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: '24px',
        flexWrap: 'wrap',
        gap: '12px'
      }}>
        <div>
          <h1 style={{ fontSize: '1.75rem', fontWeight: 700, marginBottom: '4px' }}>
            System Health & Diagnostics
          </h1>
          <p style={{ color: 'var(--text-secondary)', fontSize: '0.9rem' }}>
            Real-time connection verification for Express backend API, PostgreSQL connection pool, and Supabase service role client.
          </p>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
          <span style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>
            {lastChecked ? `Last checked: ${lastChecked}` : 'Checking...'}
          </span>
          <button
            className="btn-primary"
            onClick={refetch}
            disabled={loading}
          >
            <span className={loading ? 'spinning' : ''}>↻</span>
            {loading ? 'Testing...' : 'Refresh Diagnostics'}
          </button>
        </div>
      </div>

      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fit, minmax(340px, 1fr))',
        gap: '24px',
        marginBottom: '28px'
      }}>
        {/* Backend API Health Card */}
        <div className="info-card">
          <div style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            marginBottom: '16px'
          }}>
            <h3 style={{ fontSize: '1.1rem', fontWeight: 600 }}>Backend API Service</h3>
            {apiHealth.status === 'ok' && <span className="badge badge-ok">● Online</span>}
            {apiHealth.status === 'error' && <span className="badge badge-error">● Offline</span>}
            {apiHealth.status === 'checking' && <span className="badge badge-pending">● Checking</span>}
          </div>

          <div className="key-value-list">
            <div className="key-value-row">
              <span className="key-label">Endpoint Route</span>
              <span className="key-val" style={{ fontFamily: 'monospace' }}>GET /api/health</span>
            </div>
            <div className="key-value-row">
              <span className="key-label">Server Status</span>
              <span className="key-val">
                {apiHealth.status === 'ok' ? 'Healthy (200 OK)' : apiHealth.status === 'checking' ? 'Connecting...' : 'Disconnected'}
              </span>
            </div>
            {apiHealth.data?.timestamp && (
              <div className="key-value-row">
                <span className="key-label">Server Timestamp</span>
                <span className="key-val">{new Date(apiHealth.data.timestamp).toLocaleString()}</span>
              </div>
            )}
          </div>

          {apiHealth.error && (
            <div className="danger-badge" style={{ marginTop: '14px', width: '100%', boxSizing: 'border-box' }}>
              Connection Error: {apiHealth.error}
            </div>
          )}
        </div>

        {/* Database Connections Card */}
        <div className="info-card">
          <div style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            marginBottom: '16px'
          }}>
            <h3 style={{ fontSize: '1.1rem', fontWeight: 600 }}>Database & Supabase</h3>
            {dbHealth.status === 'ok' && <span className="badge badge-ok">● Connected</span>}
            {dbHealth.status === 'error' && <span className="badge badge-error">● Error</span>}
            {dbHealth.status === 'checking' && <span className="badge badge-pending">● Testing</span>}
          </div>

          <div className="key-value-list">
            <div className="key-value-row">
              <span className="key-label">PostgreSQL Pool (pg)</span>
              <span className="key-val">
                {dbHealth.data?.pg ? (
                  <span style={{ color: 'var(--status-success)', fontWeight: 600 }}>Connected (SELECT NOW())</span>
                ) : dbHealth.status === 'checking' ? (
                  'Testing pool...'
                ) : (
                  <span style={{ color: 'var(--status-error)' }}>Failed</span>
                )}
              </span>
            </div>

            <div className="key-value-row">
              <span className="key-label">Supabase Client (Admin)</span>
              <span className="key-val">
                {dbHealth.data?.supabase ? (
                  <span style={{ color: 'var(--status-success)', fontWeight: 600 }}>Verified (Auth Service)</span>
                ) : dbHealth.status === 'checking' ? (
                  'Testing client...'
                ) : (
                  <span style={{ color: 'var(--status-error)' }}>Failed</span>
                )}
              </span>
            </div>

            <div className="key-value-row">
              <span className="key-label">Endpoint Route</span>
              <span className="key-val" style={{ fontFamily: 'monospace' }}>GET /api/health/db</span>
            </div>
          </div>

          {dbHealth.error && (
            <div className="danger-badge" style={{ marginTop: '14px', width: '100%', boxSizing: 'border-box' }}>
              <div>Diagnostics Error: {dbHealth.error}</div>
              {dbHealth.data?.errors?.pg && <div>• Postgres: {dbHealth.data.errors.pg}</div>}
              {dbHealth.data?.errors?.supabase && <div>• Supabase: {dbHealth.data.errors.supabase}</div>}
            </div>
          )}
        </div>
      </div>

      <div className="info-card">
        <div className="info-card-title">
          <span>⚙️</span> Environment Architecture
        </div>
        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
          gap: '16px'
        }}>
          <div style={{ padding: '12px', background: 'rgba(0, 0, 0, 0.25)', borderRadius: 'var(--radius-sm)' }}>
            <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', textTransform: 'uppercase' }}>Frontend</div>
            <div style={{ fontSize: '0.9rem', fontWeight: 600 }}>React 18 + Vite (Port 5173)</div>
          </div>
          <div style={{ padding: '12px', background: 'rgba(0, 0, 0, 0.25)', borderRadius: 'var(--radius-sm)' }}>
            <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', textTransform: 'uppercase' }}>Backend API</div>
            <div style={{ fontSize: '0.9rem', fontWeight: 600 }}>Node 20 + Express (Port 5000)</div>
          </div>
          <div style={{ padding: '12px', background: 'rgba(0, 0, 0, 0.25)', borderRadius: 'var(--radius-sm)' }}>
            <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', textTransform: 'uppercase' }}>Database Engine</div>
            <div style={{ fontSize: '0.9rem', fontWeight: 600 }}>Supabase Hosted Postgres 15+</div>
          </div>
          <div style={{ padding: '12px', background: 'rgba(0, 0, 0, 0.25)', borderRadius: 'var(--radius-sm)' }}>
            <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', textTransform: 'uppercase' }}>Security</div>
            <div style={{ fontSize: '0.9rem', fontWeight: 600 }}>RLS Enforced (Service Role Only)</div>
          </div>
        </div>
      </div>
    </div>
  );
}
