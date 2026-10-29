import React, { useState } from 'react';
import {
  User,
  ShieldCheck,
  Bell,
  Activity,
  Info,
  CheckCircle2,
  RefreshCw,
  Scale,
  Users
} from 'lucide-react';
import { useSessionStore } from '../store/useSessionStore.js';
import { useUiStore } from '../store/useUiStore.js';
import { useLookupsQuery, useUsersQuery } from '../hooks/useLookups.js';
import api from '../lib/api.js';
import { formatCurrency, formatPercent, formatDateTime } from '../lib/formatters.js';

export const Settings = () => {
  const currentUser = useSessionStore((state) => state.currentUser);
  const setUser = useSessionStore((state) => state.setUser);

  const notificationPrefs = useUiStore((state) => state.notificationPrefs);
  const updateNotificationPref = useUiStore((state) => state.updateNotificationPref);

  const [activeTab, setActiveTab] = useState('profile'); // 'profile' | 'policy' | 'notifications' | 'status' | 'about'
  const [healthStatus, setHealthStatus] = useState({ app: 'Operational', db: 'Connected', lastChecked: new Date() });
  const [checkingHealth, setCheckingHealth] = useState(false);

  const { data: lookupsData, isLoading: loadingLookups } = useLookupsQuery();
  const rawUsers = Array.isArray(usersData) ? usersData : (Array.isArray(usersData?.data) ? usersData.data : (Array.isArray(usersData?.users) ? usersData.users : []));
  const fallbackUsers = [
    { requester_id: 'RQT-000001', full_name: 'Eleanor Vance (CFO)', role: 'approver', approval_level: 4, department_id: 'DEP-007', email: 'eleanor.vance.cfo@enterprise.com' },
    { requester_id: 'RQT-000002', full_name: 'Marcus Sterling (Finance Dir)', role: 'approver', approval_level: 3, department_id: 'DEP-007', email: 'marcus.sterling.fd@enterprise.com' },
    { requester_id: 'RQT-000003', full_name: 'Sarah Jenkins (Procurement Head)', role: 'approver', approval_level: 2, department_id: 'DEP-010', email: 'sarah.jenkins.proc@enterprise.com' },
    { requester_id: 'RQT-000004', full_name: 'Lauren Nash (Dept Manager)', role: 'approver', approval_level: 1, department_id: 'DEP-001', email: 'lauren.nash@enterprise.com' },
    { requester_id: 'RQT-000015', full_name: 'Alice Requester', role: 'requester', approval_level: null, department_id: 'DEP-001', email: 'alice.requester@enterprise.com' },
    { requester_id: 'RQT-000029', full_name: 'Jessica Stevens (Ops Analyst)', role: 'operations_analyst', approval_level: null, department_id: 'DEP-009', email: 'jessica.stevens@enterprise.com' },
    { requester_id: 'RQT-000035', full_name: 'Heather Navarro (Admin)', role: 'system_admin', approval_level: null, department_id: 'DEP-005', email: 'heather.navarro@enterprise.com' }
  ];

  const users = (rawUsers.length > 0 ? rawUsers : fallbackUsers).map((u) => ({
    id: u.requester_id || u.id,
    name: u.full_name || u.name || 'Enterprise User',
    role: u.role || 'requester',
    approval_level: u.approval_level || u.approvalLevel,
    department_id: u.department_id || u.departmentId,
    email: u.email
  }));
  const thresholds = lookupsData?.thresholds || [];
  const policy = lookupsData?.policy || {
    competitive_threshold: 5000,
    min_quotes: 3,
    quote_validity_days: 30,
    score_weights: { cost: 0.5, lead_time: 0.25, quality: 0.15, compliance: 0.1 }
  };

  const checkHealth = async () => {
    setCheckingHealth(true);
    try {
      await api.get('/health');
      setHealthStatus({ app: 'Operational', db: 'Connected', lastChecked: new Date() });
    } catch {
      setHealthStatus({ app: 'Degraded', db: 'Reconnecting', lastChecked: new Date() });
    } finally {
      setCheckingHealth(false);
    }
  };

  const formatRoleName = (role) => {
    switch (role) {
      case 'requester': return 'Purchase Requester';
      case 'approver': return 'Business Approver';
      case 'process_owner': return 'Procurement Lead';
      case 'operations_analyst': return 'Operations Analyst';
      case 'system_admin': return 'System Administrator';
      default: return role || 'User';
    }
  };

  return (
    <div style={{ maxWidth: '1000px', margin: '0 auto' }}>
      {/* Top Header */}
      <div style={{ marginBottom: '24px' }}>
        <h2 style={{ fontSize: '1.5rem', fontWeight: 700, margin: 0 }}>System Settings & Policy Governance</h2>
        <p style={{ fontSize: '0.875rem', color: 'var(--text-muted)', margin: '4px 0 0' }}>
          Configure user identity, inspect organizational approval rules, and monitor operational service status
        </p>
      </div>

      {/* Settings Tab Navigation */}
      <div style={{ display: 'flex', gap: '8px', borderBottom: '1px solid var(--border)', marginBottom: '24px', flexWrap: 'wrap' }}>
        {[
          { id: 'profile', label: 'Profile & Role', icon: User },
          { id: 'policy', label: 'Approval Policy', icon: ShieldCheck },
          { id: 'notifications', label: 'Notifications', icon: Bell },
          { id: 'status', label: 'Service Status', icon: Activity },
          { id: 'about', label: 'About', icon: Info }
        ].map((t) => {
          const isActive = activeTab === t.id;
          const Icon = t.icon;

          return (
            <button
              key={t.id}
              onClick={() => setActiveTab(t.id)}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
                padding: '10px 16px',
                border: 'none',
                background: 'none',
                borderBottom: isActive ? '2px solid var(--primary)' : '2px solid transparent',
                color: isActive ? 'var(--primary)' : 'var(--text-muted)',
                fontWeight: isActive ? 700 : 500,
                cursor: 'pointer',
                fontSize: '0.875rem'
              }}
            >
              <Icon size={16} />
              <span>{t.label}</span>
            </button>
          );
        })}
      </div>

      {/* TAB 1: PROFILE & ROLE */}
      {activeTab === 'profile' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
          {/* Current Profile Card */}
          <div className="card" style={{ padding: '24px' }}>
            <h3 style={{ fontSize: '1.15rem', fontWeight: 700, marginBottom: '16px' }}>Current Active Session</h3>
            <div style={{ display: 'flex', alignItems: 'center', gap: '16px', marginBottom: '20px' }}>
              <div
                style={{
                  width: '56px',
                  height: '56px',
                  borderRadius: '50%',
                  backgroundColor: 'var(--primary)',
                  color: 'white',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontWeight: 800,
                  fontSize: '1.4rem'
                }}
              >
                {currentUser?.name ? currentUser.name.charAt(0).toUpperCase() : 'U'}
              </div>
              <div>
                <div style={{ fontSize: '1.15rem', fontWeight: 700 }}>{currentUser?.name}</div>
                <div style={{ fontSize: '0.825rem', color: 'var(--text-muted)' }}>{currentUser?.email}</div>
                <div style={{ marginTop: '4px', display: 'flex', gap: '6px' }}>
                  <span className="badge badge-primary">{formatRoleName(currentUser?.role)}</span>
                  {currentUser?.approval_level && (
                    <span className="badge badge-secondary">Governance Level {currentUser.approval_level}</span>
                  )}
                  {currentUser?.department_id && (
                    <span className="badge badge-secondary">Department: {currentUser.department_id}</span>
                  )}
                </div>
              </div>
            </div>
          </div>

          {/* Quick Switch User Grid */}
          <div className="card" style={{ padding: '24px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
              <div>
                <h3 style={{ fontSize: '1.15rem', fontWeight: 700, margin: 0 }}>Switch User Identity</h3>
                <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)', margin: '4px 0 0' }}>
                  Select another employee account to test role permissions, notifications, and workflows
                </p>
              </div>
              <span className="badge badge-secondary">{users.length} available</span>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: '12px' }}>
              {users.map((u) => {
                const isSelected = currentUser?.id === u.id;

                return (
                  <div
                    key={u.id}
                    onClick={() => setUser(u)}
                    style={{
                      padding: '12px',
                      borderRadius: 'var(--radius-md)',
                      border: isSelected ? '2px solid var(--primary)' : '1px solid var(--border)',
                      backgroundColor: isSelected ? 'var(--primary-soft)' : 'var(--bg-surface)',
                      cursor: 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      transition: 'all 0.15s ease'
                    }}
                  >
                    <div>
                      <div style={{ fontWeight: 600, fontSize: '0.875rem' }}>{u.name}</div>
                      <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                        {formatRoleName(u.role)} {u.approval_level ? `• Lvl ${u.approval_level}` : ''}
                      </div>
                    </div>
                    {isSelected && (
                      <span className="badge badge-primary" style={{ fontSize: '0.7rem' }}>Active</span>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}

      {/* TAB 2: APPROVAL POLICY */}
      {activeTab === 'policy' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
          {/* Policy Parameters Card */}
          <div className="card" style={{ padding: '24px' }}>
            <h3 style={{ fontSize: '1.15rem', fontWeight: 700, marginBottom: '16px' }}>Core Policy Parameters</h3>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '16px' }}>
              <div style={{ padding: '16px', backgroundColor: 'var(--bg-surface-subtle)', borderRadius: 'var(--radius-md)' }}>
                <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Competitive RFQ Threshold</div>
                <div className="tabular-nums" style={{ fontSize: '1.35rem', fontWeight: 800, color: 'var(--primary)', marginTop: '4px' }}>
                  {formatCurrency(policy.competitive_threshold || 5000)}
                </div>
                <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)', marginTop: '4px' }}>
                  Requisitions exceeding this value require competitive supplier sourcing.
                </div>
              </div>

              <div style={{ padding: '16px', backgroundColor: 'var(--bg-surface-subtle)', borderRadius: 'var(--radius-md)' }}>
                <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Minimum Quotes Required</div>
                <div className="tabular-nums" style={{ fontSize: '1.35rem', fontWeight: 800, color: 'var(--primary)', marginTop: '4px' }}>
                  {policy.min_quotes || 3} Valid Quotes
                </div>
                <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)', marginTop: '4px' }}>
                  Required before commercial contract award can be finalized.
                </div>
              </div>

              <div style={{ padding: '16px', backgroundColor: 'var(--bg-surface-subtle)', borderRadius: 'var(--radius-md)' }}>
                <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Quote Validity Window</div>
                <div className="tabular-nums" style={{ fontSize: '1.35rem', fontWeight: 800, color: 'var(--primary)', marginTop: '4px' }}>
                  {policy.quote_validity_days || 30} Days
                </div>
                <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)', marginTop: '4px' }}>
                  Quotes older than this limit are flagged as expired.
                </div>
              </div>
            </div>

            {/* Score Weights */}
            <div style={{ marginTop: '20px' }}>
              <h4 style={{ fontSize: '0.95rem', fontWeight: 600, marginBottom: '10px' }}>
                Multi-Criteria Sourcing Evaluation Weights
              </h4>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '10px' }}>
                <div style={{ padding: '10px', border: '1px solid var(--border)', borderRadius: 'var(--radius-sm)', textAlign: 'center' }}>
                  <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Landed Cost</div>
                  <strong className="tabular-nums">{Math.round((policy.score_weights?.cost || 0.5) * 100)}%</strong>
                </div>
                <div style={{ padding: '10px', border: '1px solid var(--border)', borderRadius: 'var(--radius-sm)', textAlign: 'center' }}>
                  <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Lead Time</div>
                  <strong className="tabular-nums">{Math.round((policy.score_weights?.lead_time || 0.25) * 100)}%</strong>
                </div>
                <div style={{ padding: '10px', border: '1px solid var(--border)', borderRadius: 'var(--radius-sm)', textAlign: 'center' }}>
                  <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Supplier Quality</div>
                  <strong className="tabular-nums">{Math.round((policy.score_weights?.quality || 0.15) * 100)}%</strong>
                </div>
                <div style={{ padding: '10px', border: '1px solid var(--border)', borderRadius: 'var(--radius-sm)', textAlign: 'center' }}>
                  <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Compliance</div>
                  <strong className="tabular-nums">{Math.round((policy.score_weights?.compliance || 0.1) * 100)}%</strong>
                </div>
              </div>
            </div>
          </div>

          {/* Governance Tiers Table */}
          <div className="card" style={{ padding: '24px' }}>
            <h3 style={{ fontSize: '1.15rem', fontWeight: 700, marginBottom: '16px' }}>Approval Hierarchy Thresholds</h3>
            <table className="app-table">
              <thead>
                <tr>
                  <th>Tier Level</th>
                  <th>Governance Authority</th>
                  <th style={{ textAlign: 'right' }}>Minimum Amount</th>
                  <th style={{ textAlign: 'right' }}>Maximum Amount</th>
                </tr>
              </thead>
              <tbody>
                {(thresholds.length > 0 ? thresholds : [
                  { level: 1, name: 'Department Manager', approver_role: 'approver', min_amount: 0, max_amount: 10000 },
                  { level: 2, name: 'Procurement Head', approver_role: 'approver', min_amount: 10000, max_amount: 50000 },
                  { level: 3, name: 'Finance Director', approver_role: 'approver', min_amount: 50000, max_amount: 100000 },
                  { level: 4, name: 'Chief Financial Officer (CFO)', approver_role: 'approver', min_amount: 100000, max_amount: 99999999 }
                ]).map((t) => (
                  <tr key={t.level}>
                    <td>
                      <span className="badge badge-primary">Tier {t.level}</span>
                    </td>
                    <td style={{ fontWeight: 600 }}>{t.name}</td>
                    <td style={{ textAlign: 'right' }} className="tabular-nums">{formatCurrency(t.min_amount)}</td>
                    <td style={{ textAlign: 'right' }} className="tabular-nums">
                      {t.max_amount > 5000000 ? 'No Upper Limit' : formatCurrency(t.max_amount)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* TAB 3: NOTIFICATIONS */}
      {activeTab === 'notifications' && (
        <div className="card" style={{ padding: '24px' }}>
          <h3 style={{ fontSize: '1.15rem', fontWeight: 700, marginBottom: '8px' }}>Notification Preferences</h3>
          <p style={{ fontSize: '0.825rem', color: 'var(--text-muted)', marginBottom: '24px' }}>
            Configure client alerts for approval events, order fulfillment, and delivery updates
          </p>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
            {[
              {
                key: 'emailOnApproval',
                title: 'Approval Requests & Decisions',
                desc: 'Receive alerts when requisitions are submitted for your tier or when your request is decided.'
              },
              {
                key: 'emailOnDelivery',
                title: 'Goods Delivery Receipts',
                desc: 'Notify requester and lead when goods are received or variances are recorded.'
              },
              {
                key: 'browserAlerts',
                title: 'In-App Desktop Banners',
                desc: 'Show real-time browser desktop push notifications for urgent action items.'
              },
              {
                key: 'weeklyDigest',
                title: 'Weekly Sourcing & Spend Digest',
                desc: 'Executive summary report delivered weekly tracking departmental spend.'
              }
            ].map((pref) => {
              const checked = Boolean(notificationPrefs[pref.key]);

              return (
                <div
                  key={pref.key}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    paddingBottom: '16px',
                    borderBottom: '1px solid var(--border)'
                  }}
                >
                  <div style={{ maxWidth: '640px' }}>
                    <div style={{ fontWeight: 600, fontSize: '0.9rem' }}>{pref.title}</div>
                    <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginTop: '2px' }}>{pref.desc}</div>
                  </div>

                  <label style={{ position: 'relative', display: 'inline-block', width: '44px', height: '24px' }}>
                    <input
                      type="checkbox"
                      checked={checked}
                      onChange={(e) => updateNotificationPref(pref.key, e.target.checked)}
                      style={{ opacity: 0, width: 0, height: 0 }}
                    />
                    <span
                      style={{
                        position: 'absolute',
                        cursor: 'pointer',
                        inset: 0,
                        backgroundColor: checked ? 'var(--primary)' : 'var(--border)',
                        borderRadius: '24px',
                        transition: '0.2s'
                      }}
                    >
                      <span
                        style={{
                          position: 'absolute',
                          height: '18px',
                          width: '18px',
                          left: checked ? '22px' : '3px',
                          bottom: '3px',
                          backgroundColor: 'white',
                          borderRadius: '50%',
                          transition: '0.2s'
                        }}
                      />
                    </span>
                  </label>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* TAB 4: SERVICE STATUS */}
      {activeTab === 'status' && (
        <div className="card" style={{ padding: '24px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
            <div>
              <h3 style={{ fontSize: '1.15rem', fontWeight: 700, margin: 0 }}>Service Health & Availability</h3>
              <p style={{ fontSize: '0.825rem', color: 'var(--text-muted)', margin: '4px 0 0' }}>
                Operational state of business services and connected enterprise data storage
              </p>
            </div>

            <button
              onClick={checkHealth}
              disabled={checkingHealth}
              className="btn btn-secondary btn-sm"
            >
              <RefreshCw size={14} className={checkingHealth ? 'spin' : ''} />
              <span>Refresh Status</span>
            </button>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '16px', marginBottom: '20px' }}>
            <div style={{ padding: '20px', borderRadius: 'var(--radius-md)', border: '1px solid var(--border)', backgroundColor: 'var(--bg-surface-subtle)' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '8px' }}>
                <CheckCircle2 size={18} color="var(--success)" />
                <span style={{ fontWeight: 700 }}>Application Service</span>
              </div>
              <div style={{ fontSize: '1.1rem', fontWeight: 800, color: 'var(--success)' }}>
                {healthStatus.app}
              </div>
              <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: '4px' }}>
                Web frontend & API workflow orchestration runtime
              </div>
            </div>

            <div style={{ padding: '20px', borderRadius: 'var(--radius-md)', border: '1px solid var(--border)', backgroundColor: 'var(--bg-surface-subtle)' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '8px' }}>
                <CheckCircle2 size={18} color="var(--success)" />
                <span style={{ fontWeight: 700 }}>Data Service</span>
              </div>
              <div style={{ fontSize: '1.1rem', fontWeight: 800, color: 'var(--success)' }}>
                {healthStatus.db}
              </div>
              <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: '4px' }}>
                Relational ledger and audit event storage
              </div>
            </div>
          </div>

          <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
            Last health verification: <strong className="date-num">{formatDateTime(healthStatus.lastChecked)}</strong>
          </div>
        </div>
      )}

      {/* TAB 5: ABOUT */}
      {activeTab === 'about' && (
        <div className="card" style={{ padding: '24px' }}>
          <h3 style={{ fontSize: '1.15rem', fontWeight: 700, marginBottom: '16px' }}>About ProcureFlow</h3>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', fontSize: '0.875rem' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '1px solid var(--border)', paddingBottom: '8px' }}>
              <span style={{ color: 'var(--text-muted)' }}>Application Name:</span>
              <span style={{ fontWeight: 600 }}>ProcureFlow Enterprise Sourcing</span>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '1px solid var(--border)', paddingBottom: '8px' }}>
              <span style={{ color: 'var(--text-muted)' }}>Release Version:</span>
              <span style={{ fontWeight: 600 }}>2026.2.0</span>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '1px solid var(--border)', paddingBottom: '8px' }}>
              <span style={{ color: 'var(--text-muted)' }}>Data Generation Seed:</span>
              <span style={{ fontFamily: 'var(--font-mono)' }}>{policy.data_generation_seed || 'SEED-2026-P2P'}</span>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '1px solid var(--border)', paddingBottom: '8px' }}>
              <span style={{ color: 'var(--text-muted)' }}>Last Data Load Date:</span>
              <span style={{ fontWeight: 600 }} className="date-num">
                {policy.last_data_load_date ? formatDateTime(policy.last_data_load_date) : 'Live Operational Database'}
              </span>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default Settings;
