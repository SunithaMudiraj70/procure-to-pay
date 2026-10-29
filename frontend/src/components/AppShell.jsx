import React, { useState } from 'react';
import Sidebar from './Sidebar.jsx';
import TopBar from './TopBar.jsx';
import ToastContainer from './ToastContainer.jsx';
import ConfirmModal from './ConfirmModal.jsx';
import ErrorBoundary from './ErrorBoundary.jsx';

export const AppShell = ({ children }) => {
  const [sidebarOpen, setSidebarOpen] = useState(false);

  return (
    <div style={{ display: 'flex', minHeight: '100vh', backgroundColor: 'var(--bg-app)' }}>
      {/* Sidebar */}
      <Sidebar isOpen={sidebarOpen} onClose={() => setSidebarOpen(false)} />

      {/* Main Column */}
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', minWidth: 0 }}>
        {/* TopBar with search, notifications, switch user */}
        <TopBar onToggleSidebar={() => setSidebarOpen(!sidebarOpen)} />

        {/* Content area */}
        <main
          style={{
            flex: 1,
            padding: '24px 32px 48px',
            maxWidth: '1440px',
            width: '100%',
            margin: '0 auto',
            boxSizing: 'border-box'
          }}
        >
          <ErrorBoundary>
            {children}
          </ErrorBoundary>
        </main>
      </div>

      {/* Global Overlays */}
      <ToastContainer />
      <ConfirmModal />
    </div>
  );
};

export default AppShell;
