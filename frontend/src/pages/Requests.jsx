import React, { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { Plus, Search, Filter, UserCheck, RotateCw } from 'lucide-react';
import { useRequestsQuery } from '../hooks/useRequests.js';
import { useLookupsQuery } from '../hooks/useLookups.js';
import { useSessionStore } from '../store/useSessionStore.js';
import DataTable, { CopyableId } from '../components/DataTable.jsx';
import StatusChip from '../components/StatusChip.jsx';
import { formatCurrency, formatDate } from '../lib/formatters.js';

export const Requests = () => {
  const navigate = useNavigate();
  const currentUser = useSessionStore((state) => state.currentUser);

  const [search, setSearch] = useState('');
  const [status, setStatus] = useState('');
  const [department, setDepartment] = useState('');
  const [onlyMyRequests, setOnlyMyRequests] = useState(false);
  const [page, setPage] = useState(1);
  const pageSize = 10;

  const { data: lookupsData } = useLookupsQuery();
  const departments = lookupsData?.departments || [];

  const filters = {
    page,
    pageSize,
    status: status || undefined,
    department: department || undefined,
    q: search || undefined,
    all: !onlyMyRequests ? true : undefined,
    requester_id: onlyMyRequests ? (currentUser?.id || currentUser?.requester_id) : undefined
  };

  const { data: reqResponse, isLoading, isError, refetch } = useRequestsQuery(filters);

  const rawList = Array.isArray(reqResponse) ? reqResponse : (reqResponse?.data || []);
  const total = reqResponse?.total || rawList.length;

  const columns = [
    {
      key: 'pr_id',
      header: 'Requisition ID',
      sortable: true,
      render: (row) => (
        <CopyableId
          id={row.pr_id}
          linkTo={`/requests/${row.pr_id}`}
          onClick={(e) => {
            e.stopPropagation();
            navigate(`/requests/${row.pr_id}`);
          }}
        />
      )
    },
    {
      key: 'title',
      header: 'Title & Justification',
      sortable: true,
      render: (row) => (
        <div>
          <div style={{ fontWeight: 600, color: 'var(--text-main)' }}>{row.title}</div>
          <div style={{ fontSize: '0.775rem', color: 'var(--text-muted)', marginTop: '2px' }}>
            Needed by: <span className="date-num">{formatDate(row.needed_by_date)}</span>
          </div>
        </div>
      )
    },
    {
      key: 'department_name',
      header: 'Department',
      sortable: true,
      render: (row) => (
        <span style={{ fontSize: '0.825rem', color: 'var(--text-muted)' }}>
          {row.department_name || 'General'}
        </span>
      )
    },
    {
      key: 'requester_name',
      header: 'Requester',
      sortable: true,
      render: (row) => (
        <div>
          <div style={{ fontSize: '0.825rem', fontWeight: 500 }}>{row.requester_name || row.requester_id}</div>
          {row.requester_id === currentUser?.id && (
            <span className="badge badge-primary" style={{ fontSize: '0.65rem' }}>You</span>
          )}
        </div>
      )
    },
    {
      key: 'estimated_total',
      header: 'Est. Total',
      align: 'right',
      tabular: true,
      sortable: true,
      render: (row) => (
        <div style={{ fontWeight: 700, color: 'var(--text-main)' }}>
          {formatCurrency(row.estimated_total, row.currency_code)}
        </div>
      )
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
          <h2 style={{ fontSize: '1.5rem', fontWeight: 700, margin: 0 }}>Purchase Requests</h2>
          <p style={{ fontSize: '0.875rem', color: 'var(--text-muted)', margin: '4px 0 0' }}>
            Manage, approve, and track employee procurement requisitions
          </p>
        </div>

        <Link to="/requests/new" className="btn btn-primary">
          <Plus size={16} />
          <span>New Purchase Request</span>
        </Link>
      </div>

      {/* Filter and Search Bar */}
      <div
        className="card"
        style={{
          padding: '16px 20px',
          marginBottom: '20px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: '16px',
          flexWrap: 'wrap'
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px', flex: 1, minWidth: '280px' }}>
          <div style={{ position: 'relative', width: '100%', maxWidth: '320px' }}>
            <Search size={16} style={{ position: 'absolute', left: '10px', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
            <input
              type="text"
              className="form-input"
              placeholder="Filter by title or keyword..."
              value={search}
              onChange={(e) => {
                setSearch(e.target.value);
                setPage(1);
              }}
              style={{ paddingLeft: '32px', height: '36px' }}
            />
          </div>

          <select
            className="form-select"
            value={status}
            onChange={(e) => {
              setStatus(e.target.value);
              setPage(1);
            }}
            style={{ width: '160px', height: '36px', fontSize: '0.825rem' }}
          >
            <option value="">All Statuses</option>
            <option value="draft">Draft</option>
            <option value="submitted">Submitted</option>
            <option value="approved">Approved</option>
            <option value="rejected">Rejected</option>
            <option value="rfq_issued">RFQ Issued</option>
            <option value="po_issued">PO Issued</option>
            <option value="cancelled">Cancelled</option>
          </select>

          <select
            className="form-select"
            value={department}
            onChange={(e) => {
              setDepartment(e.target.value);
              setPage(1);
            }}
            style={{ width: '180px', height: '36px', fontSize: '0.825rem' }}
          >
            <option value="">All Departments</option>
            {departments.map((d) => (
              <option key={d.department_id || d.name} value={d.name || d.department_id}>
                {d.name}
              </option>
            ))}
          </select>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
          <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer', fontSize: '0.85rem', fontWeight: 600 }}>
            <input
              type="checkbox"
              checked={onlyMyRequests}
              onChange={(e) => {
                setOnlyMyRequests(e.target.checked);
                setPage(1);
              }}
            />
            <span>My requests only</span>
          </label>

          <button
            onClick={() => refetch()}
            className="btn btn-secondary btn-sm"
            title="Refresh"
            aria-label="Refresh requests"
          >
            <RotateCw size={14} />
          </button>
        </div>
      </div>

      {/* Requests Data Table */}
      <DataTable
        columns={columns}
        data={rawList}
        loading={isLoading}
        total={total}
        page={page}
        pageSize={pageSize}
        onPageChange={setPage}
        onRowClick={(row) => navigate(`/requests/${row.pr_id}`)}
        emptyTitle="No purchase requests found"
        emptyDescription="Get started by creating a new requisition or adjust your filter parameters."
      />
    </div>
  );
};

export default Requests;
