import React, { useState, useRef, useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useQueryClient } from '@tanstack/react-query';
import { Search, Bell, User, CheckCircle2, ChevronDown, Settings as SettingsIcon, LogOut, ArrowRight, X } from 'lucide-react';
import { useSessionStore } from '../store/useSessionStore.js';
import { useUsersQuery } from '../hooks/useLookups.js';
import { useApprovalsQuery } from '../hooks/useApprovals.js';
import { useRequestsQuery } from '../hooks/useRequests.js';
import { useRfqsQuery } from '../hooks/useRfqs.js';
import { usePurchaseOrdersQuery } from '../hooks/usePurchaseOrders.js';
import { useExceptionsQuery } from '../hooks/useExceptions.js';

const ensureArray = (val) => {
  if (Array.isArray(val)) return val;
  if (Array.isArray(val?.data)) return val.data;
  return [];
};

export const TopBar = ({ onToggleSidebar }) => {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const currentUser = useSessionStore((state) => state.currentUser);
  const setUser = useSessionStore((state) => state.setUser);

  const [searchQuery, setSearchQuery] = useState('');
  const [showNotifications, setShowNotifications] = useState(false);
  const [showUserMenu, setShowUserMenu] = useState(false);
  const [showSwitchModal, setShowSwitchModal] = useState(false);

  const notifRef = useRef(null);
  const userMenuRef = useRef(null);

  const { data: usersData } = useUsersQuery();
  const rawUsers = ensureArray(usersData);

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
    name: u.full_name || u.name || 'User',
    role: u.role || 'requester',
    approval_level: u.approval_level || u.approvalLevel,
    department_id: u.department_id || u.departmentId,
    department_name: u.department_name,
    email: u.email
  }));

  // Notifications queries based on role
  const { data: approvalsData } = useApprovalsQuery({ status: 'pending' });
  const { data: requestsData } = useRequestsQuery();
  const { data: rfqsData } = useRfqsQuery();
  const { data: poData } = usePurchaseOrdersQuery();
  const { data: exceptionsData } = useExceptionsQuery({ status: 'open' });

  // Calculate pending items for current role
  const getPendingNotifications = () => {
    const items = [];
    const role = currentUser?.role;

    if (role === 'approver') {
      const myApprovals = ensureArray(approvalsData);
      myApprovals.slice(0, 5).forEach((appr) => {
        items.push({
          id: appr.approval_id,
          title: `Approval Required: ${appr.pr_id}`,
          desc: `Level ${appr.approval_level} review for ${appr.department_name || 'Department'}`,
          link: '/approvals',
          badge: 'Pending Review'
        });
      });
    } else if (role === 'requester') {
      const allReqs = ensureArray(requestsData);
      const drafts = allReqs.filter((r) => r.status === 'draft' && r.requester_id === currentUser.id);
      drafts.slice(0, 5).forEach((r) => {
        items.push({
          id: r.pr_id,
          title: `Draft Request: ${r.pr_id}`,
          desc: r.title,
          link: `/requests/${r.pr_id}`,
          badge: 'Draft'
        });
      });
    } else if (role === 'process_owner') {
      const allReqs = ensureArray(requestsData);
      const approvedAwaitingRfq = allReqs.filter((r) => r.status === 'approved');
      approvedAwaitingRfq.slice(0, 3).forEach((r) => {
        items.push({
          id: r.pr_id,
          title: `Ready for RFQ: ${r.pr_id}`,
          desc: r.title,
          link: `/requests/${r.pr_id}`,
          badge: 'Approved'
        });
      });

      const allRfqs = ensureArray(rfqsData);
      const readyToAward = allRfqs.filter((rfq) => rfq.status === 'evaluated');
      readyToAward.slice(0, 3).forEach((rfq) => {
        items.push({
          id: rfq.rfq_id,
          title: `Evaluated RFQ: ${rfq.rfq_id}`,
          desc: `Ready for award decision`,
          link: `/rfqs/${rfq.rfq_id}`,
          badge: 'Evaluated'
        });
      });
    } else if (role === 'operations_analyst') {
      const allPos = ensureArray(poData);
      const openPos = allPos.filter((po) => po.status === 'issued' || po.status === 'partially_delivered');
      openPos.slice(0, 3).forEach((po) => {
        items.push({
          id: po.po_id,
          title: `PO Delivery Pending: ${po.po_id}`,
          desc: `Supplier: ${po.supplier_name}`,
          link: `/purchase-orders/${po.po_id}`,
          badge: po.status
        });
      });

      const openExc = ensureArray(exceptionsData);
      openExc.slice(0, 3).forEach((exc) => {
        items.push({
          id: exc.exception_id,
          title: `Open Exception: ${exc.exception_id}`,
          desc: exc.rule_type || exc.reason,
          link: '/exceptions',
          badge: exc.severity
        });
      });
    }

    return items;
  };


  const notifications = getPendingNotifications();

  // Close dropdowns on outside click
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (notifRef.current && !notifRef.current.contains(event.target)) {
        setShowNotifications(false);
      }
      if (userMenuRef.current && !userMenuRef.current.contains(event.target)) {
        setShowUserMenu(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleSearchSubmit = (e) => {
    e.preventDefault();
    const query = searchQuery.trim().toUpperCase();
    if (!query) return;

    if (query.startsWith('PR-') || query.startsWith('PR')) {
      const id = query.startsWith('PR-') ? query : `PR-${query.replace('PR', '').trim()}`;
      navigate(`/requests/${id}`);
    } else if (query.startsWith('RFQ-') || query.startsWith('RFQ')) {
      const id = query.startsWith('RFQ-') ? query : `RFQ-${query.replace('RFQ', '').trim()}`;
      navigate(`/rfqs/${id}`);
    } else if (query.startsWith('PO-') || query.startsWith('PO')) {
      const id = query.startsWith('PO-') ? query : `PO-${query.replace('PO', '').trim()}`;
      navigate(`/purchase-orders/${id}`);
    } else {
      // Default to requests search
      navigate(`/requests?q=${encodeURIComponent(query)}`);
    }
    setSearchQuery('');
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

  const groupedUsers = users.reduce((acc, u) => {
    const r = u.role || 'other';
    if (!acc[r]) acc[r] = [];
    acc[r].push(u);
    return acc;
  }, {});

  return (
    <>
      <header className="topbar">
        {/* Left Side: Mobile Menu + Search */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '16px', flex: 1, maxWidth: '680px' }}>
          <button
            onClick={onToggleSidebar}
            className="sidebar-toggle-btn"
            aria-label="Toggle navigation"
            style={{
              display: 'none',
              background: 'transparent',
              border: 'none',
              cursor: 'pointer',
              padding: '6px',
              borderRadius: 'var(--radius-sm)',
              color: 'var(--text-muted)'
            }}
          >
            ☰
          </button>

          <form onSubmit={handleSearchSubmit} style={{ position: 'relative', width: '100%', display: 'flex', alignItems: 'center' }}>
            <Search
              size={16}
              style={{
                position: 'absolute',
                left: '14px',
                top: '50%',
                transform: 'translateY(-50%)',
                color: 'var(--text-muted)',
                pointerEvents: 'none'
              }}
            />
            <input
              type="text"
              className="form-input"
              placeholder="Search by ID (e.g. PR-2026-..., RFQ-..., PO-...), supplier name, or requisition..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              style={{
                width: '100%',
                paddingLeft: '40px',
                paddingRight: '16px',
                backgroundColor: 'var(--bg-app)',
                borderColor: 'var(--border)',
                borderRadius: '9999px',
                height: '40px',
                fontSize: '0.875rem',
                boxShadow: 'inset 0 1px 2px rgba(0,0,0,0.02)'
              }}
            />
          </form>
        </div>

        {/* Right Side: Notifications & User Menu */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          {/* Notification Bell */}
          <div ref={notifRef} style={{ position: 'relative' }}>
            <button
              onClick={() => setShowNotifications(!showNotifications)}
              className="btn btn-secondary"
              aria-label="Notifications"
              style={{
                padding: '8px 10px',
                position: 'relative',
                backgroundColor: showNotifications ? 'var(--primary-soft)' : 'var(--bg-surface)'
              }}
            >
              <Bell size={18} color={showNotifications ? 'var(--primary)' : 'var(--text-main)'} />
              {notifications.length > 0 && (
                <span
                  style={{
                    position: 'absolute',
                    top: '-4px',
                    right: '-4px',
                    backgroundColor: 'var(--danger)',
                    color: 'white',
                    fontSize: '0.65rem',
                    fontWeight: 700,
                    borderRadius: '9999px',
                    height: '18px',
                    minWidth: '18px',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    padding: '0 4px',
                    boxShadow: '0 0 0 2px var(--bg-surface)'
                  }}
                >
                  {notifications.length}
                </span>
              )}
            </button>

            {/* Notification Dropdown */}
            {showNotifications && (
              <div
                className="dropdown-menu"
                style={{
                  position: 'absolute',
                  right: 0,
                  top: 'calc(100% + 8px)',
                  width: '320px',
                  backgroundColor: 'var(--bg-surface)',
                  borderRadius: 'var(--radius-lg)',
                  boxShadow: 'var(--shadow-modal)',
                  border: '1px solid var(--border)',
                  zIndex: 100,
                  overflow: 'hidden'
                }}
              >
                <div
                  style={{
                    padding: '12px 16px',
                    borderBottom: '1px solid var(--border)',
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    backgroundColor: 'var(--bg-surface-subtle)'
                  }}
                >
                  <span style={{ fontWeight: 600, fontSize: '0.875rem' }}>Action Items</span>
                  <span className="badge badge-primary">{notifications.length} pending</span>
                </div>

                <div style={{ maxHeight: '300px', overflowY: 'auto' }}>
                  {notifications.length === 0 ? (
                    <div style={{ padding: '24px 16px', textAlign: 'center', color: 'var(--text-muted)', fontSize: '0.85rem' }}>
                      <CheckCircle2 size={24} color="var(--success)" style={{ margin: '0 auto 8px', display: 'block' }} />
                      You're all caught up! No items currently awaiting your action.
                    </div>
                  ) : (
                    notifications.map((item) => (
                      <div
                        key={item.id}
                        onClick={() => {
                          setShowNotifications(false);
                          navigate(item.link);
                        }}
                        style={{
                          padding: '12px 16px',
                          borderBottom: '1px solid var(--border)',
                          cursor: 'pointer',
                          transition: 'background-color 0.15s ease'
                        }}
                        onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = 'var(--bg-surface-hover)')}
                        onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = 'transparent')}
                      >
                        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '4px' }}>
                          <span style={{ fontWeight: 600, fontSize: '0.825rem', color: 'var(--primary)' }}>{item.title}</span>
                          <span className="badge badge-secondary" style={{ fontSize: '0.65rem' }}>{item.badge}</span>
                        </div>
                        <p style={{ margin: 0, fontSize: '0.775rem', color: 'var(--text-muted)' }}>{item.desc}</p>
                      </div>
                    ))
                  )}
                </div>
              </div>
            )}
          </div>

          {/* User Profile / Menu */}
          <div ref={userMenuRef} style={{ position: 'relative' }}>
            <button
              onClick={() => setShowUserMenu(!showUserMenu)}
              className="btn btn-secondary"
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
                padding: '6px 12px',
                backgroundColor: showUserMenu ? 'var(--primary-soft)' : 'var(--bg-surface)'
              }}
            >
              <div
                style={{
                  width: '28px',
                  height: '28px',
                  borderRadius: '50%',
                  backgroundColor: 'var(--primary)',
                  color: 'white',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontWeight: 700,
                  fontSize: '0.8rem'
                }}
              >
                {currentUser?.name ? currentUser.name.charAt(0).toUpperCase() : 'U'}
              </div>
              <div style={{ textAlign: 'left', lineHeight: 1.2 }}>
                <div style={{ fontSize: '0.825rem', fontWeight: 600 }}>{currentUser?.name || 'Guest User'}</div>
                <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>{formatRoleName(currentUser?.role)}</div>
              </div>
              <ChevronDown size={14} color="var(--text-muted)" />
            </button>

            {/* User Dropdown */}
            {showUserMenu && (
              <div
                className="dropdown-menu"
                style={{
                  position: 'absolute',
                  right: 0,
                  top: 'calc(100% + 8px)',
                  width: '240px',
                  backgroundColor: 'var(--bg-surface)',
                  borderRadius: 'var(--radius-lg)',
                  boxShadow: 'var(--shadow-modal)',
                  border: '1px solid var(--border)',
                  zIndex: 100,
                  padding: '6px 0'
                }}
              >
                <div style={{ padding: '10px 16px', borderBottom: '1px solid var(--border)' }}>
                  <div style={{ fontSize: '0.85rem', fontWeight: 600 }}>{currentUser?.name}</div>
                  <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>{currentUser?.email}</div>
                  <div style={{ marginTop: '4px' }}>
                    <span className="badge badge-primary">{formatRoleName(currentUser?.role)}</span>
                  </div>
                </div>

                <div style={{ padding: '4px' }}>
                  <button
                    onClick={() => {
                      setShowUserMenu(false);
                      setShowSwitchModal(true);
                    }}
                    style={{
                      width: '100%',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '8px',
                      padding: '8px 12px',
                      background: 'none',
                      border: 'none',
                      textAlign: 'left',
                      fontSize: '0.825rem',
                      color: 'var(--text-main)',
                      cursor: 'pointer',
                      borderRadius: 'var(--radius-sm)'
                    }}
                    onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = 'var(--bg-surface-hover)')}
                    onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = 'transparent')}
                  >
                    <User size={15} color="var(--primary)" />
                    <span>Switch user / role</span>
                  </button>

                  <Link
                    to="/settings"
                    onClick={() => setShowUserMenu(false)}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '8px',
                      padding: '8px 12px',
                      fontSize: '0.825rem',
                      color: 'var(--text-main)',
                      textDecoration: 'none',
                      borderRadius: 'var(--radius-sm)'
                    }}
                    onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = 'var(--bg-surface-hover)')}
                    onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = 'transparent')}
                  >
                    <SettingsIcon size={15} color="var(--text-muted)" />
                    <span>Settings & Policy</span>
                  </Link>
                </div>
              </div>
            )}
          </div>
        </div>
      </header>

      {/* Switch User Modal */}
      {showSwitchModal && (
        <div className="modal-backdrop" onClick={() => setShowSwitchModal(false)}>
          <div
            className="modal-box"
            onClick={(e) => e.stopPropagation()}
            style={{ maxWidth: '640px', width: '92%' }}
          >
            <div
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                marginBottom: '16px',
                borderBottom: '1px solid var(--border)',
                paddingBottom: '12px'
              }}
            >
              <div>
                <h3 style={{ margin: 0, fontSize: '1.15rem' }}>Switch Active User</h3>
                <p style={{ margin: '4px 0 0', fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                  Change user role to test workflows, permissions, and dashboards
                </p>
              </div>
              <button
                onClick={() => setShowSwitchModal(false)}
                className="btn btn-secondary"
                style={{ padding: '4px', borderRadius: '50%' }}
              >
                <X size={18} />
              </button>
            </div>

            <div style={{ maxHeight: '420px', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '16px' }}>
              {Object.keys(groupedUsers).length === 0 ? (
                <div style={{ padding: '24px', textAlign: 'center', color: 'var(--text-muted)' }}>
                  Loading available users...
                </div>
              ) : (
                Object.entries(groupedUsers).map(([roleKey, roleUsers]) => (
                  <div key={roleKey}>
                    <div
                      style={{
                        fontSize: '0.75rem',
                        fontWeight: 700,
                        textTransform: 'uppercase',
                        letterSpacing: '0.05em',
                        color: 'var(--text-muted)',
                        marginBottom: '8px'
                      }}
                    >
                      {formatRoleName(roleKey)} ({roleUsers.length})
                    </div>
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: '8px' }}>
                      {roleUsers.map((u) => {
                        const isCurrent = currentUser?.id === u.id;
                        return (
                          <div
                            key={u.id}
                            onClick={() => {
                              setUser(u);
                              setShowSwitchModal(false);
                              queryClient.invalidateQueries();
                            }}
                            style={{
                              padding: '10px 12px',
                              borderRadius: 'var(--radius-md)',
                              border: isCurrent ? '2px solid var(--primary)' : '1px solid var(--border)',
                              backgroundColor: isCurrent ? 'var(--primary-soft)' : 'var(--bg-surface)',
                              cursor: 'pointer',
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'space-between',
                              transition: 'all 0.15s ease'
                            }}
                            onMouseEnter={(e) => {
                              if (!isCurrent) e.currentTarget.style.backgroundColor = 'var(--bg-surface-hover)';
                            }}
                            onMouseLeave={(e) => {
                              if (!isCurrent) e.currentTarget.style.backgroundColor = 'var(--bg-surface)';
                            }}
                          >
                            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                              <div
                                style={{
                                  width: '32px',
                                  height: '32px',
                                  borderRadius: '50%',
                                  backgroundColor: isCurrent ? 'var(--primary)' : 'var(--border)',
                                  color: isCurrent ? 'white' : 'var(--text-main)',
                                  display: 'flex',
                                  alignItems: 'center',
                                  justifyContent: 'center',
                                  fontWeight: 600,
                                  fontSize: '0.85rem'
                                }}
                              >
                                {u.name ? u.name.charAt(0).toUpperCase() : 'U'}
                              </div>
                              <div>
                                <div style={{ fontSize: '0.85rem', fontWeight: 600 }}>{u.name}</div>
                                <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                                  {u.id} {u.department_id ? `• ${u.department_id}` : ''} {u.approval_level ? `• Lvl ${u.approval_level}` : ''}
                                </div>
                              </div>
                            </div>
                            {isCurrent && (
                              <span className="badge badge-primary" style={{ fontSize: '0.7rem' }}>Active</span>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  </div>
                ))
              )}
            </div>

            <div style={{ marginTop: '16px', display: 'flex', justifyContent: 'flex-end', borderTop: '1px solid var(--border)', paddingTop: '12px' }}>
              <button onClick={() => setShowSwitchModal(false)} className="btn btn-secondary">
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
};

export default TopBar;
