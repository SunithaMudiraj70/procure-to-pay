import React, { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { Truck, Search, Filter, AlertTriangle, CheckCircle2, Clock } from 'lucide-react';
import { usePurchaseOrdersQuery } from '../hooks/usePurchaseOrders.js';
import DataTable, { CopyableId } from '../components/DataTable.jsx';
import StatusChip from '../components/StatusChip.jsx';
import { formatDate } from '../lib/formatters.js';

export const Deliveries = () => {
  const navigate = useNavigate();
  const [filterStatus, setFilterStatus] = useState('all');

  const { data: poResponse, isLoading, refetch } = usePurchaseOrdersQuery({ pageSize: 100 });
  const poList = Array.isArray(poResponse) ? poResponse : (poResponse?.data || []);

  // Filter deliveries
  const filteredList = poList.filter((po) => {
    if (filterStatus === 'pending') return po.status === 'issued';
    if (filterStatus === 'partial') return po.status === 'partially_delivered';
    if (filterStatus === 'delivered') return po.status === 'delivered';
    return true;
  });

  const columns = [
    {
      key: 'po_id',
      header: 'Purchase Order',
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
            PR: <span style={{ fontFamily: 'var(--font-mono)' }}>{row.pr_id}</span>
          </div>
        </div>
      )
    },
    {
      key: 'expected_delivery_date',
      header: 'Scheduled Date',
      sortable: true,
      render: (row) => (
        <span className="date-num" style={{ fontSize: '0.825rem' }}>
          {formatDate(row.expected_delivery_date)}
        </span>
      )
    },
    {
      key: 'delivery_status',
      header: 'Delivery Status & Marker',
      align: 'center',
      render: (row) => {
        const isLate = row.expected_delivery_date && new Date(row.expected_delivery_date) < new Date() && row.status !== 'delivered';
        const isPartial = row.status === 'partially_delivered';
        const isDelivered = row.status === 'delivered';

        if (isLate) {
          return (
            <span className="badge badge-danger">
              <AlertTriangle size={12} />
              <span>Late Delivery</span>
            </span>
          );
        }

        if (isPartial) {
          return (
            <span className="badge badge-warning">
              <Clock size={12} />
              <span>Partial ({row.delivery_progress_pct}%)</span>
            </span>
          );
        }

        if (isDelivered) {
          return (
            <span className="badge badge-success">
              <CheckCircle2 size={12} />
              <span>Completed</span>
            </span>
          );
        }

        return (
          <span className="badge badge-primary">
            <span>Scheduled</span>
          </span>
        );
      }
    },
    {
      key: 'quantities',
      header: 'Received / Ordered',
      align: 'right',
      render: (row) => (
        <div className="tabular-nums" style={{ fontSize: '0.85rem' }}>
          <strong style={{ color: 'var(--success)' }}>{row.total_qty_accepted || 0}</strong> / {row.total_qty_ordered || 0}
        </div>
      )
    },
    {
      key: 'actions',
      header: 'Action',
      align: 'right',
      render: (row) => (
        <Link
          to={`/purchase-orders/${row.po_id}`}
          className="btn btn-secondary btn-sm"
          onClick={(e) => e.stopPropagation()}
        >
          <Truck size={14} />
          <span>Inspect Receipt</span>
        </Link>
      )
    }
  ];

  return (
    <div>
      {/* Top Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '24px' }}>
        <div>
          <h2 style={{ fontSize: '1.5rem', fontWeight: 700, margin: 0 }}>Goods Deliveries & Fulfillment</h2>
          <p style={{ fontSize: '0.875rem', color: 'var(--text-muted)', margin: '4px 0 0' }}>
            Monitor scheduled vs actual deliveries, receipt quantities, and shipment fulfillment across purchase orders
          </p>
        </div>
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
          <span style={{ fontSize: '0.875rem', fontWeight: 600 }}>Filter by Fulfillment State:</span>
        </div>

        <select
          className="form-select"
          value={filterStatus}
          onChange={(e) => setFilterStatus(e.target.value)}
          style={{ width: '220px', height: '36px', fontSize: '0.825rem' }}
        >
          <option value="all">All Delivery Orders</option>
          <option value="pending">Awaiting First Receipt</option>
          <option value="partial">Partially Received</option>
          <option value="delivered">Fully Delivered</option>
        </select>
      </div>

      {/* DataTable */}
      <DataTable
        columns={columns}
        data={filteredList}
        loading={isLoading}
        total={filteredList.length}
        onRowClick={(row) => navigate(`/purchase-orders/${row.po_id}`)}
        emptyTitle="No deliveries matching criteria"
        emptyDescription="Purchase orders with delivery schedules will be tracked here."
      />
    </div>
  );
};

export default Deliveries;
