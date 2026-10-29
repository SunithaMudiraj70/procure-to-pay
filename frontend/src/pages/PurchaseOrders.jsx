import React, { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { ShoppingBag, Search, Filter, Truck } from 'lucide-react';
import { usePurchaseOrdersQuery } from '../hooks/usePurchaseOrders.js';
import DataTable, { CopyableId } from '../components/DataTable.jsx';
import StatusChip from '../components/StatusChip.jsx';
import { formatCurrency, formatDate } from '../lib/formatters.js';

export const PurchaseOrders = () => {
  const navigate = useNavigate();

  const [statusFilter, setStatusFilter] = useState('');
  const [page, setPage] = useState(1);
  const pageSize = 10;

  const { data: poResponse, isLoading, refetch } = usePurchaseOrdersQuery({
    status: statusFilter || undefined,
    page,
    pageSize
  });

  const poList = Array.isArray(poResponse) ? poResponse : (poResponse?.data || []);
  const total = poResponse?.total || poList.length;

  const columns = [
    {
      key: 'po_id',
      header: 'PO ID',
      sortable: true,
      render: (row) => (
        <CopyableId
          id={row.po_id}
          linkTo={`/purchase-orders/${row.po_id}`}
          onClick={(e) => {
            e.stopPropagation();
            navigate(`/purchase-orders/${row.po_id}`);
          }}
        />
      )
    },
    {
      key: 'supplier_name',
      header: 'Supplier & Requisition',
      sortable: true,
      render: (row) => (
        <div>
          <div style={{ fontWeight: 600, color: 'var(--text-main)' }}>{row.supplier_name}</div>
          <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
            Requisition: <span style={{ fontFamily: 'var(--font-mono)' }}>{row.pr_id}</span>
          </div>
        </div>
      )
    },
    {
      key: 'issued_date',
      header: 'Issued Date',
      sortable: true,
      render: (row) => (
        <span className="date-num" style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
          {formatDate(row.issued_date || row.created_at)}
        </span>
      )
    },
    {
      key: 'expected_delivery_date',
      header: 'Expected Delivery',
      sortable: true,
      render: (row) => (
        <span className="date-num" style={{ fontSize: '0.8rem', fontWeight: 500 }}>
          {formatDate(row.expected_delivery_date)}
        </span>
      )
    },
    {
      key: 'total_amount',
      header: 'Total Value',
      align: 'right',
      tabular: true,
      sortable: true,
      render: (row) => (
        <span style={{ fontWeight: 700, color: 'var(--text-main)' }}>
          {formatCurrency(row.total_amount, row.currency_code)}
        </span>
      )
    },
    {
      key: 'delivery_progress_pct',
      header: 'Receipt Progress',
      align: 'center',
      render: (row) => {
        const pct = Math.min(100, Math.round(Number(row.delivery_progress_pct || 0)));
        const isComplete = pct >= 100;

        return (
          <div style={{ width: '130px', margin: '0 auto' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.7rem', marginBottom: '3px' }}>
              <span style={{ fontWeight: 600 }}>{pct}% Received</span>
              <span style={{ color: 'var(--text-muted)' }}>
                {row.total_qty_accepted || 0} / {row.total_qty_ordered || 0}
              </span>
            </div>
            <div style={{ height: '6px', backgroundColor: 'var(--bg-surface-subtle)', borderRadius: '9999px', overflow: 'hidden' }}>
              <div
                style={{
                  height: '100%',
                  width: `${pct}%`,
                  backgroundColor: isComplete ? 'var(--success)' : 'var(--primary)',
                  borderRadius: '9999px'
                }}
              />
            </div>
          </div>
        );
      }
    },
    {
      key: 'status',
      header: 'Status',
      align: 'center',
      render: (row) => <StatusChip status={row.status} />
    }
  ];

  return (
    <div>
      {/* Top Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '24px' }}>
        <div>
          <h2 style={{ fontSize: '1.5rem', fontWeight: 700, margin: 0 }}>Purchase Orders</h2>
          <p style={{ fontSize: '0.875rem', color: 'var(--text-muted)', margin: '4px 0 0' }}>
            Track legally binding supplier orders, delivery receipts, and fulfillment status
          </p>
        </div>

        <Link to="/deliveries" className="btn btn-secondary">
          <Truck size={16} />
          <span>View Delivery Logs</span>
        </Link>
      </div>

      {/* Filter Bar */}
      <div
        className="card"
        style={{
          padding: '16px 20px',
          marginBottom: '20px',
          display: 'flex',
          alignItems: 'center',
          gap: '16px'
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <Filter size={16} color="var(--text-muted)" />
          <span style={{ fontSize: '0.875rem', fontWeight: 600 }}>Status Filter:</span>
        </div>

        <select
          className="form-select"
          value={statusFilter}
          onChange={(e) => {
            setStatusFilter(e.target.value);
            setPage(1);
          }}
          style={{ width: '200px', height: '36px', fontSize: '0.825rem' }}
        >
          <option value="">All PO Statuses</option>
          <option value="issued">Issued (Awaiting Delivery)</option>
          <option value="partially_delivered">Partially Delivered</option>
          <option value="delivered">Fully Delivered</option>
          <option value="cancelled">Cancelled</option>
          <option value="closed">Closed</option>
        </select>
      </div>

      {/* DataTable */}
      <DataTable
        columns={columns}
        data={poList}
        loading={isLoading}
        total={total}
        page={page}
        pageSize={pageSize}
        onPageChange={setPage}
        onRowClick={(row) => navigate(`/purchase-orders/${row.po_id}`)}
        emptyTitle="No purchase orders found"
        emptyDescription="Purchase orders generated from awarded RFQs or approved single-source requests will appear here."
      />
    </div>
  );
};

export default PurchaseOrders;
