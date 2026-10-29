import React, { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import {
  CheckCircle2,
  XCircle,
  Clock,
  MessageSquare,
  AlertCircle,
  X,
  History,
  Check
} from 'lucide-react';
import { useApprovalsQuery, useDecideApprovalMutation } from '../hooks/useApprovals.js';
import { useSessionStore } from '../store/useSessionStore.js';
import DataTable, { CopyableId } from '../components/DataTable.jsx';
import StatusChip from '../components/StatusChip.jsx';
import { formatCurrency, formatDate, formatDateTime } from '../lib/formatters.js';

export const Approvals = () => {
  const navigate = useNavigate();
  const currentUser = useSessionStore((state) => state.currentUser);
  const userRole = currentUser?.role;

  const [activeTab, setActiveTab] = useState('pending'); // 'pending' | 'history'
  const [page, setPage] = useState(1);
  const pageSize = 10;

  // Decision Modal state
  const [modalOpen, setModalOpen] = useState(false);
  const [activeApproval, setActiveApproval] = useState(null);
  const [decisionType, setDecisionType] = useState('approved'); // 'approved' | 'rejected'
  const [comments, setComments] = useState('');
  const [formError, setFormError] = useState(null);

  // Queries
  const { data: approvalsData, isLoading, refetch } = useApprovalsQuery({
    decision: activeTab === 'pending' ? 'pending' : undefined
  });

  const decideMutation = useDecideApprovalMutation();

  const rawList = Array.isArray(approvalsData) ? approvalsData : (approvalsData?.data || []);
  const total = approvalsData?.total || rawList.length;

  // Filter based on active tab
  const displayList = activeTab === 'pending'
    ? rawList.filter((a) => a.decision === 'pending')
    : rawList.filter((a) => a.decision !== 'pending');

  const openDecisionModal = (approval, type) => {
    setActiveApproval(approval);
    setDecisionType(type);
    setComments('');
    setFormError(null);
    setModalOpen(true);
  };

  const handleDecisionSubmit = async (e) => {
    e.preventDefault();
    setFormError(null);

    if (decisionType === 'rejected' && (!comments || comments.trim().length < 5)) {
      setFormError('Comments are strictly required when rejecting a requisition (minimum 5 characters).');
      return;
    }

    try {
      await decideMutation.mutateAsync({
        approvalId: activeApproval.approval_id,
        decision: decisionType,
        comments: comments.trim()
      });
      setModalOpen(false);
      refetch();
    } catch (err) {
      setFormError(err.message || 'Failed to record approval decision.');
    }
  };

  const pendingColumns = [
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
      key: 'pr_title',
      header: 'Requisition Title',
      sortable: true,
      render: (row) => (
        <div>
          <div style={{ fontWeight: 600, color: 'var(--text-main)' }}>{row.pr_title || row.title}</div>
          <div style={{ fontSize: '0.775rem', color: 'var(--text-muted)' }}>
            Requested by: {row.requester_name || row.requester_id} ({row.department_name})
          </div>
        </div>
      )
    },
    {
      key: 'approval_level',
      header: 'Governance Tier',
      align: 'center',
      render: (row) => (
        <span className="badge badge-primary">
          Tier {row.approval_level}
        </span>
      )
    },
    {
      key: 'pr_value',
      header: 'Total Value',
      align: 'right',
      tabular: true,
      sortable: true,
      render: (row) => (
        <span style={{ fontWeight: 700, color: 'var(--text-main)' }}>
          {formatCurrency(row.pr_value || row.total_amount || row.estimated_total, row.pr_currency || 'USD')}
        </span>
      )
    },
    {
      key: 'requested_at',
      header: 'Submitted',
      sortable: true,
      render: (row) => (
        <span className="date-num" style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
          {formatDate(row.requested_at || row.created_at)}
        </span>
      )
    },
    {
      key: 'actions',
      header: 'Actions',
      align: 'right',
      render: (row) => {
        const canDecide = userRole === 'approver' || userRole === 'system_admin';

        return (
          <div style={{ display: 'flex', gap: '8px', justifyContent: 'flex-end' }} onClick={(e) => e.stopPropagation()}>
            <button
              onClick={() => openDecisionModal(row, 'approved')}
              disabled={!canDecide}
              className="btn btn-sm"
              style={{
                backgroundColor: 'var(--success-soft)',
                color: 'var(--success)',
                border: '1px solid var(--success-border)'
              }}
              title={!canDecide ? 'Only an authorized Approver can approve' : undefined}
            >
              <Check size={14} />
              <span>Approve</span>
            </button>
            <button
              onClick={() => openDecisionModal(row, 'rejected')}
              disabled={!canDecide}
              className="btn btn-sm"
              style={{
                backgroundColor: 'var(--danger-soft)',
                color: 'var(--danger)',
                border: '1px solid var(--danger-border)'
              }}
              title={!canDecide ? 'Only an authorized Approver can reject' : undefined}
            >
              <XCircle size={14} />
              <span>Reject</span>
            </button>
          </div>
        );
      }
    }
  ];

  const historyColumns = [
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
      key: 'pr_title',
      header: 'Title & Requester',
      render: (row) => (
        <div>
          <div style={{ fontWeight: 600 }}>{row.pr_title || row.title}</div>
          <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
            {row.requester_name} • {row.department_name}
          </div>
        </div>
      )
    },
    {
      key: 'approval_level',
      header: 'Tier',
      align: 'center',
      render: (row) => <span className="badge badge-secondary">Tier {row.approval_level}</span>
    },
    {
      key: 'decision',
      header: 'Decision',
      align: 'center',
      render: (row) => <StatusChip status={row.decision} />
    },
    {
      key: 'approver_name',
      header: 'Decided By',
      render: (row) => (
        <div>
          <div style={{ fontSize: '0.825rem', fontWeight: 500 }}>{row.approver_name || 'Approver'}</div>
          {row.decided_at && (
            <div style={{ fontSize: '0.725rem', color: 'var(--text-muted)' }} className="date-num">
              {formatDateTime(row.decided_at)}
            </div>
          )}
        </div>
      )
    },
    {
      key: 'comments',
      header: 'Decision Notes',
      render: (row) => (
        <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)', fontStyle: row.comments ? 'italic' : 'normal' }}>
          {row.comments ? `"${row.comments}"` : '—'}
        </span>
      )
    }
  ];

  return (
    <div>
      {/* Top Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '24px' }}>
        <div>
          <h2 style={{ fontSize: '1.5rem', fontWeight: 700, margin: 0 }}>Approvals Workflow</h2>
          <p style={{ fontSize: '0.875rem', color: 'var(--text-muted)', margin: '4px 0 0' }}>
            Review, authorize, or reject purchase requisitions across governance tiers
          </p>
        </div>
      </div>

      {/* Tabs */}
      <div style={{ display: 'flex', gap: '8px', borderBottom: '1px solid var(--border)', marginBottom: '20px' }}>
        <button
          onClick={() => {
            setActiveTab('pending');
            setPage(1);
          }}
          style={{
            padding: '10px 16px',
            border: 'none',
            background: 'none',
            borderBottom: activeTab === 'pending' ? '2px solid var(--primary)' : '2px solid transparent',
            color: activeTab === 'pending' ? 'var(--primary)' : 'var(--text-muted)',
            fontWeight: activeTab === 'pending' ? 700 : 500,
            cursor: 'pointer',
            fontSize: '0.875rem',
            display: 'flex',
            alignItems: 'center',
            gap: '6px'
          }}
        >
          <Clock size={16} />
          <span>Waiting for Me ({rawList.filter((a) => a.decision === 'pending').length})</span>
        </button>

        <button
          onClick={() => {
            setActiveTab('history');
            setPage(1);
          }}
          style={{
            padding: '10px 16px',
            border: 'none',
            background: 'none',
            borderBottom: activeTab === 'history' ? '2px solid var(--primary)' : '2px solid transparent',
            color: activeTab === 'history' ? 'var(--primary)' : 'var(--text-muted)',
            fontWeight: activeTab === 'history' ? 700 : 500,
            cursor: 'pointer',
            fontSize: '0.875rem',
            display: 'flex',
            alignItems: 'center',
            gap: '6px'
          }}
        >
          <History size={16} />
          <span>Approval History</span>
        </button>
      </div>

      {/* Data Table */}
      <DataTable
        columns={activeTab === 'pending' ? pendingColumns : historyColumns}
        data={displayList}
        loading={isLoading}
        total={displayList.length}
        page={page}
        pageSize={pageSize}
        onPageChange={setPage}
        onRowClick={(row) => navigate(`/requests/${row.pr_id}`)}
        emptyTitle={activeTab === 'pending' ? 'No pending approvals' : 'No approval history'}
        emptyDescription={
          activeTab === 'pending'
            ? 'Great news! All submitted purchase requests in your queue have been processed.'
            : 'Completed approval decisions will appear here.'
        }
      />

      {/* DECISION MODAL */}
      {modalOpen && activeApproval && (
        <div className="modal-backdrop" onClick={() => setModalOpen(false)}>
          <div className="modal-box" onClick={(e) => e.stopPropagation()} style={{ maxWidth: '520px', width: '92%' }}>
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
                <h3 style={{ margin: 0, fontSize: '1.15rem' }}>
                  {decisionType === 'approved' ? 'Grant Requisition Approval' : 'Reject Purchase Requisition'}
                </h3>
                <p style={{ margin: '4px 0 0', fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                  Tier {activeApproval.approval_level} Review for {activeApproval.pr_id}
                </p>
              </div>
              <button onClick={() => setModalOpen(false)} className="btn btn-secondary" style={{ padding: '4px' }}>
                <X size={18} />
              </button>
            </div>

            {formError && (
              <div className="alert alert-error" style={{ marginBottom: '16px' }}>
                <AlertCircle size={18} style={{ flexShrink: 0 }} />
                <div style={{ fontSize: '0.825rem' }}>{formError}</div>
              </div>
            )}

            <form onSubmit={handleDecisionSubmit}>
              <div style={{ backgroundColor: 'var(--bg-surface-subtle)', padding: '12px 16px', borderRadius: 'var(--radius-md)', marginBottom: '16px', fontSize: '0.85rem' }}>
                <div><strong>Requisition:</strong> {activeApproval.pr_title || activeApproval.title}</div>
                <div style={{ marginTop: '4px' }}>
                  <strong>Value:</strong> {formatCurrency(activeApproval.pr_value || activeApproval.total_amount)}
                </div>
              </div>

              <div className="form-group">
                <label className="form-label">
                  {decisionType === 'rejected' ? 'Rejection Reason (Required) *' : 'Approval Comments (Optional)'}
                </label>
                <textarea
                  rows={3}
                  className="form-textarea"
                  placeholder={
                    decisionType === 'rejected'
                      ? 'Explain reason for rejection, missing information, or budget constraints...'
                      : 'Optional comments for requester and audit trail...'
                  }
                  value={comments}
                  onChange={(e) => setComments(e.target.value)}
                  required={decisionType === 'rejected'}
                />
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px', marginTop: '20px', borderTop: '1px solid var(--border)', paddingTop: '16px' }}>
                <button type="button" onClick={() => setModalOpen(false)} className="btn btn-secondary">
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={decideMutation.isPending}
                  className={`btn ${decisionType === 'approved' ? 'btn-primary' : 'btn-danger'}`}
                >
                  {decisionType === 'approved' ? 'Confirm Approval' : 'Confirm Rejection'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default Approvals;
