import React from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import AppShell from './components/AppShell.jsx';
import Dashboard from './pages/Dashboard.jsx';
import Requests from './pages/Requests.jsx';
import NewRequestWizard from './pages/NewRequestWizard.jsx';
import RequestDetail from './pages/RequestDetail.jsx';
import Rfqs from './pages/Rfqs.jsx';
import RfqDetail from './pages/RfqDetail.jsx';
import Approvals from './pages/Approvals.jsx';
import PurchaseOrders from './pages/PurchaseOrders.jsx';
import PurchaseOrderDetail from './pages/PurchaseOrderDetail.jsx';
import Deliveries from './pages/Deliveries.jsx';
import Suppliers from './pages/Suppliers.jsx';
import Budgets from './pages/Budgets.jsx';
import Exceptions from './pages/Exceptions.jsx';
import Reports from './pages/Reports.jsx';
import Settings from './pages/Settings.jsx';

export default function App() {
  return (
    <BrowserRouter>
      <AppShell>
        <Routes>
          <Route path="/" element={<Dashboard />} />
          <Route path="/requests" element={<Requests />} />
          <Route path="/requests/new" element={<NewRequestWizard />} />
          <Route path="/requests/:prId" element={<RequestDetail />} />
          <Route path="/rfqs" element={<Rfqs />} />
          <Route path="/rfqs/:rfqId" element={<RfqDetail />} />
          <Route path="/approvals" element={<Approvals />} />
          <Route path="/purchase-orders" element={<PurchaseOrders />} />
          <Route path="/purchase-orders/:poId" element={<PurchaseOrderDetail />} />
          <Route path="/deliveries" element={<Deliveries />} />
          <Route path="/suppliers" element={<Suppliers />} />
          <Route path="/budgets" element={<Budgets />} />
          <Route path="/exceptions" element={<Exceptions />} />
          <Route path="/reports" element={<Reports />} />
          <Route path="/settings" element={<Settings />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </AppShell>
    </BrowserRouter>
  );
}
