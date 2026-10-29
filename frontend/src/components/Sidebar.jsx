import React from 'react';
import { NavLink } from 'react-router-dom';
import {
  LayoutDashboard,
  FileText,
  Scale,
  CheckSquare,
  ShoppingBag,
  Truck,
  Building2,
  Wallet,
  AlertTriangle,
  BarChart3,
  Settings,
  Layers
} from 'lucide-react';
import { useSessionStore } from '../store/useSessionStore.js';

const allNavItems = [
  {
    path: '/',
    label: 'Dashboard',
    icon: LayoutDashboard,
    roles: ['requester', 'approver', 'process_owner', 'operations_analyst', 'system_admin']
  },
  {
    path: '/requests',
    label: 'Purchase Requests',
    icon: FileText,
    roles: ['requester', 'approver', 'process_owner', 'system_admin']
  },
  {
    path: '/rfqs',
    label: 'RFQs & Quotes',
    icon: Scale,
    roles: ['process_owner', 'system_admin']
  },
  {
    path: '/approvals',
    label: 'Approvals',
    icon: CheckSquare,
    roles: ['approver', 'requester', 'process_owner', 'system_admin']
  },
  {
    path: '/purchase-orders',
    label: 'Purchase Orders',
    icon: ShoppingBag,
    roles: ['process_owner', 'operations_analyst', 'system_admin']
  },
  {
    path: '/deliveries',
    label: 'Deliveries',
    icon: Truck,
    roles: ['operations_analyst', 'system_admin']
  },
  {
    path: '/suppliers',
    label: 'Suppliers',
    icon: Building2,
    roles: ['process_owner', 'system_admin']
  },
  {
    path: '/budgets',
    label: 'Budgets',
    icon: Wallet,
    roles: ['process_owner', 'system_admin']
  },
  {
    path: '/exceptions',
    label: 'Exceptions',
    icon: AlertTriangle,
    roles: ['operations_analyst', 'system_admin']
  },
  {
    path: '/reports',
    label: 'Reports',
    icon: BarChart3,
    roles: ['process_owner', 'operations_analyst', 'system_admin']
  }
];

export const Sidebar = ({ isOpen, onClose }) => {
  const currentUser = useSessionStore((state) => state.currentUser);
  const userRole = currentUser?.role || 'requester';

  // Display all core procurement workflow pages for seamless navigation
  const visibleNavItems = allNavItems;

  return (
    <>
      {/* Mobile/Tablet Backdrop */}
      {isOpen && (
        <div
          onClick={onClose}
          className="sidebar-backdrop"
          style={{
            position: 'fixed',
            inset: 0,
            backgroundColor: 'rgba(15, 23, 42, 0.4)',
            backdropFilter: 'blur(3px)',
            zIndex: 40
          }}
        />
      )}

      <aside
        className={`app-sidebar ${isOpen ? 'open' : ''}`}
        style={{
          width: '260px',
          backgroundColor: 'var(--bg-surface)',
          borderRight: '1px solid var(--border)',
          display: 'flex',
          flexDirection: 'column',
          height: '100vh',
          position: 'sticky',
          top: 0,
          zIndex: 50,
          flexShrink: 0
        }}
      >
        {/* Brand / Logo */}
        <div
          style={{
            padding: '20px 20px',
            borderBottom: '1px solid var(--border)',
            display: 'flex',
            alignItems: 'center',
            gap: '12px'
          }}
        >
          <div
            style={{
              width: '38px',
              height: '38px',
              borderRadius: 'var(--radius-md)',
              background: 'linear-gradient(135deg, #2563EB 0%, #0EA5E9 100%)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: '#FFFFFF',
              boxShadow: '0 4px 12px rgba(37, 99, 235, 0.25)'
            }}
          >
            <Layers size={22} />
          </div>
          <div>
            <div
              style={{
                fontSize: '1.05rem',
                fontWeight: 700,
                color: 'var(--text-main)',
                letterSpacing: '-0.02em',
                lineHeight: 1.2
              }}
            >
              ProcureFlow
            </div>
            <div
              style={{
                fontSize: '0.725rem',
                color: 'var(--text-muted)',
                fontWeight: 500
              }}
            >
              Enterprise Procurement
            </div>
          </div>
        </div>

        {/* Navigation List */}
        <nav
          style={{
            padding: '16px 12px',
            flex: 1,
            overflowY: 'auto',
            display: 'flex',
            flexDirection: 'column',
            gap: '4px'
          }}
        >
          {visibleNavItems.map((item) => {
            const Icon = item.icon;
            return (
              <NavLink
                key={item.path}
                to={item.path}
                end={item.path === '/'}
                onClick={onClose}
                className={({ isActive }) => `sidebar-link ${isActive ? 'active' : ''}`}
                style={({ isActive }) => ({
                  display: 'flex',
                  alignItems: 'center',
                  gap: '12px',
                  padding: '9px 12px',
                  borderRadius: 'var(--radius-md)',
                  color: isActive ? 'var(--primary)' : 'var(--text-muted)',
                  backgroundColor: isActive ? 'var(--primary-soft)' : 'transparent',
                  fontWeight: isActive ? 600 : 500,
                  fontSize: '0.875rem',
                  textDecoration: 'none',
                  transition: 'all 0.15s ease'
                })}
              >
                {({ isActive }) => (
                  <>
                    <Icon size={18} color={isActive ? 'var(--primary)' : 'var(--text-muted)'} />
                    <span>{item.label}</span>
                  </>
                )}
              </NavLink>
            );
          })}
        </nav>

        {/* Bottom Section: Settings */}
        <div
          style={{
            padding: '12px',
            borderTop: '1px solid var(--border)',
            backgroundColor: 'var(--bg-surface)'
          }}
        >
          <NavLink
            to="/settings"
            onClick={onClose}
            className={({ isActive }) => `sidebar-link ${isActive ? 'active' : ''}`}
            style={({ isActive }) => ({
              display: 'flex',
              alignItems: 'center',
              gap: '12px',
              padding: '9px 12px',
              borderRadius: 'var(--radius-md)',
              color: isActive ? 'var(--primary)' : 'var(--text-muted)',
              backgroundColor: isActive ? 'var(--primary-soft)' : 'transparent',
              fontWeight: isActive ? 600 : 500,
              fontSize: '0.875rem',
              textDecoration: 'none',
              transition: 'all 0.15s ease'
            })}
          >
            {({ isActive }) => (
              <>
                <Settings size={18} color={isActive ? 'var(--primary)' : 'var(--text-muted)'} />
                <span>Settings</span>
              </>
            )}
          </NavLink>
        </div>
      </aside>
    </>
  );
};

export default Sidebar;
