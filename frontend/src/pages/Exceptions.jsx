import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import {
  AlertTriangle,
  ShieldAlert,
  CheckCircle2,
  XCircle,
  Clock,
  Filter,
  Check,
  X,
  ExternalLink
} from 'lucide-react';
import { useExceptionsQuery, useViolationsQuery, useResolveExceptionMutation } from '../hooks/useExceptions.js';
import { useSessionStore } from '../store/useSessionStore.js';
import DataTable, { CopyableId } from '../components/DataTable.jsx';
import StatusChip from '../components/StatusChip.jsx';
import { formatDateTime } from '../lib/formatters.js';

export const Exceptions = () => {
  const currentUser = useSessionStore((state) => state.currentUser);
  const userRole = currentUser?.role;

  const [activeTab, setActiveTab] = useState('exceptions'); // 'exceptions' | 'violations'
  const [statusFilter, setStatusFilter] = useState('');
  const [page, setPage] = useState(1);
  const pageSize = 10;

  // Resolve / Waive Modal
  const [modalOpen, setModalOpen] = useState(false);
  const [selectedException, setSelectedException] = useState(null);
  const [resolveStatus, setResolveStatus] = useState('resolved'); // 'resolved' | 'waived'
  const [resolveNote, setResolveNote] = useState('');
  const [formError, setFormError] = useState(null);

  // Queries
  const { data: excResponse, isLoading: loadingExc, refetch: refetchExc } = useExceptionsQuery({
    status: statusFilter || undefined,
    page,
    pageSize
  });

  const { data: vioResponse, isLoading: loadingVio } = useViolationsQuery();

  const resolveMutation = useResolveExceptionMutation();

  const excList = Array.isArray(excResponse) ? excResponse : (excResponse?.data || []);
  const totalExc = excResponse?.total || excList.length;

  const vioList = Array.isArray(vioResponse) ? vioResponse : (vioResponse?.data || []);
  const totalVio = vioResponse?.total || vioList.length;

  const renderEntityLink = (entityType, entityId) => {
    if (!entityId) return '—';
    const id = String(entityId);

    if (id.startsWith('PR-') || entityType === 'purchase_request') {
      return <Link to={`/requests/${id}`} style={{ fontFamily: 'var(--font-mono)', fontWeight: 600 }}>{id}</Link>;
    }
    if (id.startsWith('PO-') || entityType === 'purchase_order') {
      return <Link to={`/purchase-orders/${id}`} style={{ fontFamily: 'var(--font-mono)', fontWeight: 600 }}>{id}</Link>;
    }
    if (id.startsWith('RFQ-') || entityType === 'rfq') {
      return <Link to={`/rfqs/${id}`} style={{ fontFamily: 'var(--font-mono)', fontWeight: 600 }}>{id}</Link>;
    }
    return <span style={{ fontFamily: 'var(--font-mono)' }}>{id}</span>;
  };

  const openResolveModal = (exc, status) => {
    setSelectedException(exc);
    setResolveStatus(status);
    setResolveNote('');
    setFormError(null);
    setModalOpen(true);
  };

  const handleResolveSubmit = async (e) => {
    e.preventDefault();
    setFormError(null);

    if (!resolveNote || resolveNote.trim().length < 5) {
      setFormError('Resolution explanation note is required (minimum 5 characters).');
      return;
    }

    try {
      await resolveMutation.mutateAsync({
        exceptionId: selectedException.exception_id,
        status: resolveStatus,
        note: resolveNote.trim()
      });
      setModalOpen(false);
      refetchExc();
    } catch (err) {
      setFormError(err.message || 'Failed to update exception status.');
    }
  };

  const canResolve = userRole === 'operations_analyst' || userRole === 'system_admin';

  const exceptionColumns = [
    {
      key: 'exception_id',
      header: 'Exception ID',
      sortable: true,
      render: (row) => (
        <CopyableId id={row.exception_id} />
      )
    },
    {
      key: 'rule_type',
      header: 'Rule Variance',
      sortable: true,
      render: (row) => (
        <div>
          <div style={{ fontWeight: 600, color: 'var(--text-main)' }}>{row.rule_type || row.issue_type || 'Variance'}</div>
          <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>{row.reason}</div>
        </div>
      )
    },
    {
      key: 'entity_id',
      header: 'Linked Record',
      render: (row) => renderEntityLink(row.entity_type, row.entity_id || row.source_id)
    },
    {
      key: 'severity',
      header: 'Severity',
      align: 'center',
      render: (row) => <StatusChip status={row.severity} size="sm" />
    },
    {
      key: 'status',
      header: 'Status',
      align: 'center',
      render: (row) => <StatusChip status={row.status} />
    },
    {
      key: 'created_at',
      header: 'Logged Date',
      render: (row) => (
        <span className="date-num" style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
          {formatDateTime(row.created_at)}
        </span>
      )
    },
    {
      key: 'actions',
      header: 'Action',
      align: 'right',
      render: (row) => {
        if (row.status !== 'open') {
          return <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>Processed</span>;
        }

        return (
          <div style={{ display: 'flex', gap: '6px', justifyContent: 'flex-end' }}>
            <button
              onClick={() => openResolveModal(row, 'resolved')}
              disabled={!canResolve}
              className="btn btn-secondary btn-sm"
              title={!canResolve ? 'Only an Operations Analyst can resolve' : undefined}
            >
              <Check size={13} />
              <span>Resolve</span>
            </button>
            <button
              onClick={() => openResolveModal(row, 'waived')}
              disabled={!canResolve}
              className="btn btn-secondary btn-sm"
              title={!canResolve ? 'Only an Operations Analyst can waive' : undefined}
            >
              <span>Waive</span>
            </button>
          </div>
        );
      }
    }
  ];

  const violationColumns = [
    {
      key: 'violation_id',
      header: 'Violation ID',
      render: (row) => <CopyableId id={row.violation_id || `VIO-${row.id}`} />
    },
    {
      key: 'rule_name',
      header: 'Automated Rule Name',
      render: (row) => (
        <div>
          <div style={{ fontWeight: 600 }}>{row.rule_name || row.title}</div>
          <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>{row.description}</div>
        </div>
      )
    },
    {
      key: 'entity_id',
      header: 'Target Record',
      render: (row) => renderEntityLink(row.entity_type, row.entity_id)
    },
    {
      key: 'detected_at',
      header: 'Detection Time',
      render: (row) => (
        <span className="date-num" style={{ fontSize: '0.75rem' }}>
          {formatDateTime(row.detected_at || row.created_at)}
        </span>
      )
    },
    {
      key: 'status',
      header: 'Status',
      align: 'center',
      render: (row) => <StatusChip status={row.status || 'flagged'} size="sm" />
    }
  ];

  return (
    <div>
      {/* Top Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '24px' }}>
        <div>
          <h2 style={{ fontSize: '1.5rem', fontWeight: 700, margin: 0 }}>Exceptions & Rule Violations</h2>
          <p style={{ fontSize: '0.875rem', color: 'var(--text-muted)', margin: '4px 0 0' }}>
            Identify commercial policy deviations, delivery variances, and governance non-compliance
          </p>
        </div>
      </div>

      {/* Tabs */}
      <div style={{ display: 'flex', gap: '8px', borderBottom: '1px solid var(--border)', marginBottom: '20px' }}>
        <button
          onClick={() => {
            setActiveTab('exceptions');
            setPage(1);
          }}
          style={{
            padding: '10px 16px',
            border: 'none',
            background: 'none',
            borderBottom: activeTab === 'exceptions' ? '2px solid var(--primary)' : '2px solid transparent',
            color: activeTab === 'exceptions' ? 'var(--primary)' : 'var(--text-muted)',
            fontWeight: activeTab === 'exceptions' ? 700 : 500,
            cursor: 'pointer',
            fontSize: '0.875rem',
            display: 'flex',
            alignItems: 'center',
            gap: '6px'
          }}
        >
          <AlertTriangle size={16} />
          <span>Registered Exceptions ({totalExc})</span>
        </button>

        <button
          onClick={() => {
            setActiveTab('violations');
            setPage(1);
          }}
          style={{
            padding: '10px 16px',
            border: 'none',
            background: 'none',
            borderBottom: activeTab === 'violations' ? '2px solid var(--primary)' : '2px solid transparent',
            color: activeTab === 'violations' ? 'var(--primary)' : 'var(--text-muted)',
            fontWeight: activeTab === 'violations' ? 700 : 500,
            cursor: 'pointer',
            fontSize: '0.875rem',
            display: 'flex',
            alignItems: 'center',
            gap: '6px'
          }}
        >
          <ShieldAlert size={16} />
          <span>Detected Rule Violations</span>
        </button>
      </div>

      {/* Filter Bar */}
      {activeTab === 'exceptions' && (
        <div
          className="card"
          style={{
            padding: '14px 20px',
            marginBottom: '20px',
            display: 'flex',
            alignItems: 'center',
            gap: '16px'
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <Filter size={16} color="var(--text-muted)" />
            <span style={{ fontSize: '0.85rem', fontWeight: 600 }}>Filter Status:</span>
          </div>

          <select
            className="form-select"
            value={statusFilter}
            onChange={(e) => {
              setStatusFilter(e.target.value);
              setPage(1);
            }}
            style={{ width: '160px', height: '34px', fontSize: '0.825rem' }}
          >
            <option value="">All Statuses</option>
            <option value="open">Open / Pending</option>
            <option value="resolved">Resolved</option>
            <option value="waived">Waived</option>
          </select>
        </div>
      )}

      {/* DataTable */}
      <DataTable
        columns={activeTab === 'exceptions' ? exceptionColumns : violationColumns}
        data={activeTab === 'exceptions' ? excList : vioList}
        loading={activeTab === 'exceptions' ? loadingExc : loadingVio}
        total={activeTab === 'exceptions' ? totalExc : totalVio}
        page={page}
        pageSize={pageSize}
        onPageChange={setPage}
        emptyTitle={activeTab === 'exceptions' ? 'No exceptions registered' : 'No rule violations detected'}
        emptyDescription="Great! All active purchase requests and orders comply with current procurement rules."
      />

      {/* RESOLVE / WAIVE MODAL */}
      {modalOpen && selectedException && (
        <div className="modal-backdrop" onClick={() => setModalOpen(false)}>
          <div className="modal-box" onClick={(e) => e.stopPropagation()} style={{ maxWidth: '520px', width: '92%' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px', borderBottom: '1px solid var(--border)', paddingBottom: '12px' }}>
              <div>
                <h3 style={{ margin: 0, fontSize: '1.15rem' }}>
                  {resolveStatus === 'resolved' ? 'Resolve Exception' : 'Waive Exception Policy'}
                </h3>
                <p style={{ margin: '4px 0 0', fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                  Action note required for {selectedException.exception_id}
                </p>
              </div>
              <button onClick={() => setModalOpen(false)} className="btn btn-secondary" style={{ padding: '4px' }}>
                <X size={18} />
              </button>
            </div>

            {formError && (
              <div className="alert alert-error" style={{ marginBottom: '16px' }}>
                <AlertTriangle size={18} style={{ flexShrink: 0 }} />
                <div style={{ fontSize: '0.825rem' }}>{formError}</div>
              </div>
            )}

            <form onSubmit={handleResolveSubmit}>
              <div style={{ backgroundColor: 'var(--bg-surface-subtle)', padding: '12px 16px', borderRadius: 'var(--radius-md)', marginBottom: '16px', fontSize: '0.85rem' }}>
                <div><strong>Issue:</strong> {selectedException.rule_type || selectedException.reason}</div>
                <div style={{ marginTop: '4px' }}>
                  <strong>Linked:</strong> {selectedException.entity_id} • Severity: {selectedException.severity}
                </div>
              </div>

              <div className="form-group">
                <label className="form-label">
                  Resolution / Waiver Justification Note (Required) *
                </label>
                <textarea
                  rows={3}
                  className="form-textarea"
                  placeholder="Detail the operational steps taken, audit justification, or corrective action..."
                  value={resolveNote}
                  onChange={(e) => setResolveNote(e.target.value)}
                  required
                />
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px', marginTop: '20px', borderTop: '1px solid var(--border)', paddingTop: '16px' }}>
                <button type="button" onClick={() => setModalOpen(false)} className="btn btn-secondary">
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={resolveMutation.isPending}
                  className="btn btn-primary"
                >
                  <Check size={16} />
                  <span>Confirm {resolveStatus === 'resolved' ? 'Resolution' : 'Waiver'}</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default Exceptions;
