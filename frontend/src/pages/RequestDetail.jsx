import React, { useState } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import {
  ArrowLeft,
  Send,
  Scale,
  ShoppingBag,
  Clock,
  CheckCircle2,
  AlertTriangle,
  FileText,
  History,
  AlertCircle,
  X,
  ExternalLink
} from 'lucide-react';
import {
  useRequestDetailQuery,
  useRequestAuditQuery,
  useSubmitRequestMutation,
  useCreateRfqMutation,
  useCreateSingleSourcePoMutation
} from '../hooks/useRequests.js';
import { useSuppliersQuery } from '../hooks/useSuppliers.js';
import { useSessionStore } from '../store/useSessionStore.js';
import StatusChip from '../components/StatusChip.jsx';
import Stepper from '../components/Stepper.jsx';
import Timeline from '../components/Timeline.jsx';
import Spinner from '../components/Spinner.jsx';
import { formatCurrency, formatDate } from '../lib/formatters.js';

export const RequestDetail = () => {
  const { prId } = useParams();
  const navigate = useNavigate();
  const currentUser = useSessionStore((state) => state.currentUser);
  const role = currentUser?.role || 'requester';

  const [activeTab, setActiveTab] = useState('overview'); // 'overview' | 'audit' | 'exceptions'
  const [showRfqModal, setShowRfqModal] = useState(false);
  const [showSinglePoModal, setShowSinglePoModal] = useState(false);
  const [actionError, setActionError] = useState(null);

  // RFQ modal state
  const [selectedSuppliers, setSelectedSuppliers] = useState([]);
  const [closingDate, setClosingDate] = useState(
    new Date(Date.now() + 14 * 24 * 60 * 60 * 1000).toISOString().split('T')[0]
  );

  // Single Source PO modal state
  const [singleSupplierId, setSingleSupplierId] = useState('');
  const [expectedDeliveryDate, setExpectedDeliveryDate] = useState(
    new Date(Date.now() + 21 * 24 * 60 * 60 * 1000).toISOString().split('T')[0]
  );

  // Queries
  const { data: request, isLoading, isError, error, refetch } = useRequestDetailQuery(prId);
  const { data: auditData } = useRequestAuditQuery(prId);
  const { data: suppliersData } = useSuppliersQuery({ status: 'active' });

  const suppliers = suppliersData?.data || [];

  // Mutations
  const submitRequestMutation = useSubmitRequestMutation();
  const createRfqMutation = useCreateRfqMutation();
  const createSinglePoMutation = useCreateSingleSourcePoMutation();

  if (isLoading) {
    return (
      <div style={{ padding: '60px', textAlign: 'center' }}>
        <Spinner size="lg" message="Loading requisition details..." />
      </div>
    );
  }

  if (isError || !request) {
    return (
      <div className="card" style={{ padding: '40px', textAlign: 'center' }}>
        <AlertTriangle size={36} color="var(--danger)" style={{ margin: '0 auto 12px' }} />
        <h3 style={{ fontSize: '1.25rem', marginBottom: '8px' }}>Requisition Not Found</h3>
        <p style={{ color: 'var(--text-muted)', marginBottom: '20px' }}>
          {error?.message || `Unable to load purchase request ${prId}`}
        </p>
        <Link to="/requests" className="btn btn-secondary">
          <ArrowLeft size={16} />
          <span>Back to Requisitions</span>
        </Link>
      </div>
    );
  }

  const lines = request.lines || [];
  const approvals = request.approvals || [];
  const statusEvents = request.status_events || [];
  const auditEvents = auditData?.audit || statusEvents;
  const linkedRfqs = request.linked_rfqs || [];
  const linkedPos = request.linked_pos || [];
  const isSingleSource = request.procurement_type === 'single_source';

  // Sourcing category from first line
  const primaryCategory = lines[0]?.category;
  const filteredSuppliers = primaryCategory
    ? suppliers.filter((s) => !s.category || s.category === primaryCategory || s.categories?.includes(primaryCategory))
    : suppliers;

  const handleToggleSupplier = (id) => {
    if (selectedSuppliers.includes(id)) {
      setSelectedSuppliers(selectedSuppliers.filter((s) => s !== id));
    } else {
      setSelectedSuppliers([...selectedSuppliers, id]);
    }
  };

  const handleCreateRfq = async (e) => {
    e.preventDefault();
    setActionError(null);
    if (selectedSuppliers.length < 3) {
      setActionError('Policy requires selecting at least 3 suppliers for competitive RFQ.');
      return;
    }

    try {
      const res = await createRfqMutation.mutateAsync({
        prId,
        body: {
          closing_date: closingDate,
          supplier_ids: selectedSuppliers
        }
      });
      setShowRfqModal(false);
      navigate(`/rfqs/${res.rfq_id}`);
    } catch (err) {
      setActionError(err.message || 'Failed to issue RFQ.');
    }
  };

  const handleCreateSinglePo = async (e) => {
    e.preventDefault();
    setActionError(null);
    if (!singleSupplierId) {
      setActionError('Please select a supplier for the purchase order.');
      return;
    }

    try {
      const res = await createSinglePoMutation.mutateAsync({
        prId,
        body: {
          supplier_id: singleSupplierId,
          expected_delivery_date: expectedDeliveryDate
        }
      });
      setShowSinglePoModal(false);
      navigate(`/purchase-orders/${res.po_id}`);
    } catch (err) {
      setActionError(err.message || 'Failed to issue single source PO.');
    }
  };

  const handleSubmitDraft = async () => {
    try {
      await submitRequestMutation.mutateAsync({
        prId,
        body: {}
      });
      refetch();
    } catch (err) {
      setActionError(err.message || 'Failed to submit request for approval.');
    }
  };

  // Next action button configuration
  const renderNextActionButton = () => {
    if (request.status === 'draft') {
      const canSubmit = role === 'requester' || role === 'system_admin';
      return (
        <button
          onClick={handleSubmitDraft}
          disabled={!canSubmit || submitRequestMutation.isPending}
          className="btn btn-primary"
          title={!canSubmit ? 'Only the requester can submit this draft' : undefined}
        >
          <Send size={16} />
          <span>Submit for Approval</span>
        </button>
      );
    }

    if (request.status === 'approved') {
      const isProcOwner = role === 'process_owner' || role === 'system_admin';

      if (isSingleSource) {
        return (
          <button
            onClick={() => setShowSinglePoModal(true)}
            disabled={!isProcOwner}
            className="btn btn-primary"
            title={!isProcOwner ? 'Only a Procurement Lead can generate PO' : undefined}
          >
            <ShoppingBag size={16} />
            <span>Generate Single-Source PO</span>
          </button>
        );
      }

      return (
        <button
          onClick={() => setShowRfqModal(true)}
          disabled={!isProcOwner}
          className="btn btn-primary"
          title={!isProcOwner ? 'Only a Procurement Lead can issue RFQs' : undefined}
        >
          <Scale size={16} />
          <span>Issue RFQ to Suppliers</span>
        </button>
      );
    }

    return null;
  };

  return (
    <div>
      {/* Back button */}
      <div style={{ marginBottom: '16px' }}>
        <Link to="/requests" style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', fontSize: '0.85rem', color: 'var(--text-muted)' }}>
          <ArrowLeft size={16} />
          <span>Back to Purchase Requests</span>
        </Link>
      </div>

      {/* Action Error Banner */}
      {actionError && (
        <div className="alert alert-error" style={{ marginBottom: '20px' }}>
          <AlertCircle size={20} style={{ flexShrink: 0 }} />
          <div>{actionError}</div>
        </div>
      )}

      {/* Header Banner */}
      <div
        className="card"
        style={{
          padding: '24px 28px',
          marginBottom: '24px',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          gap: '20px',
          flexWrap: 'wrap'
        }}
      >
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '8px' }}>
            <span className="id-badge" style={{ fontSize: '0.95rem' }}>{request.pr_id}</span>
            <StatusChip status={request.status} />
            <span className="badge badge-secondary" style={{ textTransform: 'capitalize' }}>
              {request.procurement_type?.replace(/_/g, ' ')}
            </span>
            <span className="badge badge-secondary" style={{ textTransform: 'capitalize' }}>
              Priority: {request.priority}
            </span>
          </div>

          <h2 style={{ fontSize: '1.4rem', fontWeight: 700, margin: 0, color: 'var(--text-main)' }}>
            {request.title}
          </h2>

          <div style={{ display: 'flex', gap: '20px', fontSize: '0.825rem', color: 'var(--text-muted)', marginTop: '8px', flexWrap: 'wrap' }}>
            <span>Department: <strong style={{ color: 'var(--text-main)' }}>{request.department_name}</strong></span>
            <span>Requester: <strong style={{ color: 'var(--text-main)' }}>{request.requester_name || request.requester_id}</strong></span>
            <span>Needed by: <strong style={{ color: 'var(--text-main)' }} className="date-num">{formatDate(request.needed_by_date)}</strong></span>
            <span>Created: <strong style={{ color: 'var(--text-main)' }} className="date-num">{formatDate(request.created_at)}</strong></span>
          </div>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
          <div style={{ textAlign: 'right', paddingRight: '8px' }}>
            <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', textTransform: 'uppercase' }}>Estimated Total</div>
            <div className="tabular-nums" style={{ fontSize: '1.6rem', fontWeight: 800, color: 'var(--primary)' }}>
              {formatCurrency(request.estimated_total, request.currency_code)}
            </div>
          </div>
          {renderNextActionButton()}
        </div>
      </div>

      {/* Tabs navigation */}
      <div style={{ display: 'flex', gap: '8px', borderBottom: '1px solid var(--border)', marginBottom: '24px' }}>
        <button
          onClick={() => setActiveTab('overview')}
          style={{
            padding: '10px 16px',
            border: 'none',
            background: 'none',
            borderBottom: activeTab === 'overview' ? '2px solid var(--primary)' : '2px solid transparent',
            color: activeTab === 'overview' ? 'var(--primary)' : 'var(--text-muted)',
            fontWeight: activeTab === 'overview' ? 700 : 500,
            cursor: 'pointer',
            fontSize: '0.875rem'
          }}
        >
          Requisition Details
        </button>

        <button
          onClick={() => setActiveTab('audit')}
          style={{
            padding: '10px 16px',
            border: 'none',
            background: 'none',
            borderBottom: activeTab === 'audit' ? '2px solid var(--primary)' : '2px solid transparent',
            color: activeTab === 'audit' ? 'var(--primary)' : 'var(--text-muted)',
            fontWeight: activeTab === 'audit' ? 700 : 500,
            cursor: 'pointer',
            fontSize: '0.875rem',
            display: 'flex',
            alignItems: 'center',
            gap: '6px'
          }}
        >
          <History size={16} />
          <span>Audit Trail ({auditEvents.length})</span>
        </button>
      </div>

      {/* TAB 1: OVERVIEW */}
      {activeTab === 'overview' && (
        <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: '24px' }}>
          {/* Left Column: Line Items & Approvals */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
            {/* Line Items Table */}
            <div className="card">
              <h3 style={{ fontSize: '1.05rem', fontWeight: 700, marginBottom: '16px' }}>Requisition Line Items</h3>
              <div style={{ overflowX: 'auto' }}>
                <table className="app-table">
                  <thead>
                    <tr>
                      <th style={{ width: '40px' }}>#</th>
                      <th>Item Code</th>
                      <th>Description</th>
                      <th>Category</th>
                      <th style={{ textAlign: 'right' }}>Qty</th>
                      <th style={{ textAlign: 'right' }}>Unit Cost</th>
                      <th style={{ textAlign: 'right' }}>Total</th>
                    </tr>
                  </thead>
                  <tbody>
                    {lines.map((l) => (
                      <tr key={l.pr_line_id || l.line_no}>
                        <td>{l.line_no}</td>
                        <td style={{ fontFamily: 'var(--font-mono)', fontSize: '0.8rem', fontWeight: 600 }}>{l.item_code}</td>
                        <td style={{ fontWeight: 500 }}>{l.description}</td>
                        <td>
                          <span className="badge badge-secondary">{l.category}</span>
                        </td>
                        <td style={{ textAlign: 'right' }} className="tabular-nums">{l.quantity} {l.uom || 'EA'}</td>
                        <td style={{ textAlign: 'right' }} className="tabular-nums">{formatCurrency(l.estimated_unit_cost)}</td>
                        <td style={{ textAlign: 'right', fontWeight: 600 }} className="tabular-nums">
                          {formatCurrency(l.line_total || l.quantity * l.estimated_unit_cost)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Approval Stepper */}
            <div className="card">
              <h3 style={{ fontSize: '1.05rem', fontWeight: 700, marginBottom: '8px' }}>Approval Status & Governance</h3>
              <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginBottom: '16px' }}>
                Required Level: Tier {request.approval_level || 1} • Based on total requisition value
              </p>
              <Stepper requiredLevel={request.approval_level || 1} approvals={approvals} />
            </div>

            {/* Justification Box */}
            <div className="card">
              <h3 style={{ fontSize: '1.05rem', fontWeight: 700, marginBottom: '12px' }}>Business Justification</h3>
              <p style={{ fontSize: '0.875rem', lineHeight: 1.6, color: 'var(--text-main)', margin: 0 }}>
                {request.justification || 'No justification entered.'}
              </p>
              {request.single_source_justification && (
                <div style={{ marginTop: '16px', padding: '12px 16px', backgroundColor: 'var(--warning-soft)', borderRadius: 'var(--radius-md)', border: '1px solid var(--warning-border)' }}>
                  <div style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--warning)', textTransform: 'uppercase' }}>
                    Single-Source Justification
                  </div>
                  <div style={{ fontSize: '0.825rem', color: 'var(--text-main)', marginTop: '4px' }}>
                    {request.single_source_justification}
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Right Column: Financial Reservation & Linked Records */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
            {/* Budget Reservation Info */}
            <div className="card">
              <h4 style={{ fontSize: '0.95rem', fontWeight: 700, marginBottom: '12px' }}>Budget Reservation</h4>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', fontSize: '0.85rem' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span style={{ color: 'var(--text-muted)' }}>Department Budget:</span>
                  <span style={{ fontWeight: 600 }}>{request.department_name}</span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span style={{ color: 'var(--text-muted)' }}>Fiscal Year:</span>
                  <span style={{ fontWeight: 600 }}>{request.fiscal_year || 2026}</span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span style={{ color: 'var(--text-muted)' }}>Reserved Amount:</span>
                  <span className="tabular-nums" style={{ fontWeight: 700, color: 'var(--primary)' }}>
                    {formatCurrency(request.estimated_total)}
                  </span>
                </div>
                {request.override_reason && (
                  <div style={{ marginTop: '8px', padding: '8px 12px', backgroundColor: 'var(--warning-soft)', borderRadius: 'var(--radius-sm)', fontSize: '0.75rem' }}>
                    <strong>Budget Override Note:</strong> {request.override_reason}
                  </div>
                )}
              </div>
            </div>

            {/* Linked RFQs */}
            <div className="card">
              <h4 style={{ fontSize: '0.95rem', fontWeight: 700, marginBottom: '12px' }}>Linked RFQs</h4>
              {linkedRfqs.length === 0 ? (
                <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>No RFQ issued yet for this requisition.</div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                  {linkedRfqs.map((rfq) => (
                    <Link
                      key={rfq.rfq_id}
                      to={`/rfqs/${rfq.rfq_id}`}
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        padding: '10px 12px',
                        borderRadius: 'var(--radius-md)',
                        border: '1px solid var(--border)',
                        backgroundColor: 'var(--bg-surface-subtle)',
                        textDecoration: 'none'
                      }}
                    >
                      <div>
                        <span style={{ fontFamily: 'var(--font-mono)', fontWeight: 600, color: 'var(--primary)' }}>{rfq.rfq_id}</span>
                        <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Closing: {formatDate(rfq.closing_date)}</div>
                      </div>
                      <StatusChip status={rfq.status} size="sm" />
                    </Link>
                  ))}
                </div>
              )}
            </div>

            {/* Linked Purchase Orders */}
            <div className="card">
              <h4 style={{ fontSize: '0.95rem', fontWeight: 700, marginBottom: '12px' }}>Linked Purchase Orders</h4>
              {linkedPos.length === 0 ? (
                <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>No purchase orders generated yet.</div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                  {linkedPos.map((po) => (
                    <Link
                      key={po.po_id}
                      to={`/purchase-orders/${po.po_id}`}
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        padding: '10px 12px',
                        borderRadius: 'var(--radius-md)',
                        border: '1px solid var(--border)',
                        backgroundColor: 'var(--bg-surface-subtle)',
                        textDecoration: 'none'
                      }}
                    >
                      <div>
                        <span style={{ fontFamily: 'var(--font-mono)', fontWeight: 600, color: 'var(--primary)' }}>{po.po_id}</span>
                        <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>{po.supplier_name}</div>
                      </div>
                      <StatusChip status={po.status} size="sm" />
                    </Link>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* TAB 2: AUDIT TRAIL */}
      {activeTab === 'audit' && (
        <div className="card">
          <h3 style={{ fontSize: '1.05rem', fontWeight: 700, marginBottom: '8px' }}>Requisition History & Audit Trail</h3>
          <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginBottom: '20px' }}>
            Immutable append-only record of every workflow event, state transition, and user actor
          </p>
          <Timeline events={auditEvents} />
        </div>
      )}

      {/* MODAL: CREATE RFQ */}
      {showRfqModal && (
        <div className="modal-backdrop" onClick={() => setShowRfqModal(false)}>
          <div className="modal-box" onClick={(e) => e.stopPropagation()} style={{ maxWidth: '640px', width: '92%' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px', borderBottom: '1px solid var(--border)', paddingBottom: '12px' }}>
              <div>
                <h3 style={{ margin: 0, fontSize: '1.15rem' }}>Issue Request For Quotation (RFQ)</h3>
                <p style={{ margin: '4px 0 0', fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                  Invite at least 3 active suppliers to submit competitive quotes
                </p>
              </div>
              <button onClick={() => setShowRfqModal(false)} className="btn btn-secondary" style={{ padding: '4px' }}>
                <X size={18} />
              </button>
            </div>

            <form onSubmit={handleCreateRfq}>
              <div className="form-group">
                <label className="form-label">RFQ Closing Date</label>
                <input
                  type="date"
                  className="form-input"
                  value={closingDate}
                  onChange={(e) => setClosingDate(e.target.value)}
                  required
                />
              </div>

              <div className="form-group">
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                  <label className="form-label" style={{ margin: 0 }}>
                    Select Suppliers ({selectedSuppliers.length} selected / min 3 required)
                  </label>
                  {primaryCategory && (
                    <span className="badge badge-primary">Filtered by: {primaryCategory}</span>
                  )}
                </div>

                <div style={{ maxHeight: '240px', overflowY: 'auto', border: '1px solid var(--border)', borderRadius: 'var(--radius-md)', padding: '8px' }}>
                  {filteredSuppliers.map((s) => {
                    const isSelected = selectedSuppliers.includes(s.supplier_id);
                    const isRiskFlagged = s.risk_flag || s.risk_level === 'high' || s.risk_level === 'critical';

                    return (
                      <div
                        key={s.supplier_id}
                        onClick={() => handleToggleSupplier(s.supplier_id)}
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'space-between',
                          padding: '8px 12px',
                          borderRadius: 'var(--radius-sm)',
                          backgroundColor: isSelected ? 'var(--primary-soft)' : 'transparent',
                          cursor: 'pointer',
                          marginBottom: '4px'
                        }}
                      >
                        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                          <input
                            type="checkbox"
                            checked={isSelected}
                            onChange={() => {}}
                            style={{ cursor: 'pointer' }}
                          />
                          <div>
                            <div style={{ fontSize: '0.85rem', fontWeight: 600 }}>{s.name}</div>
                            <div style={{ fontSize: '0.725rem', color: 'var(--text-muted)' }}>{s.supplier_code} • {s.category || 'General'}</div>
                          </div>
                        </div>

                        {isRiskFlagged && (
                          <span className="badge badge-warning" style={{ fontSize: '0.7rem' }}>
                            <AlertTriangle size={12} />
                            <span>Risk Flagged</span>
                          </span>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px', marginTop: '20px', borderTop: '1px solid var(--border)', paddingTop: '16px' }}>
                <button type="button" onClick={() => setShowRfqModal(false)} className="btn btn-secondary">
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={selectedSuppliers.length < 3 || createRfqMutation.isPending}
                  className="btn btn-primary"
                >
                  <Scale size={16} />
                  <span>Issue RFQ</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL: SINGLE SOURCE PO */}
      {showSinglePoModal && (
        <div className="modal-backdrop" onClick={() => setShowSinglePoModal(false)}>
          <div className="modal-box" onClick={(e) => e.stopPropagation()} style={{ maxWidth: '520px', width: '92%' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px', borderBottom: '1px solid var(--border)', paddingBottom: '12px' }}>
              <div>
                <h3 style={{ margin: 0, fontSize: '1.15rem' }}>Issue Single-Source Purchase Order</h3>
                <p style={{ margin: '4px 0 0', fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                  Direct commitment of approved single-source requisition
                </p>
              </div>
              <button onClick={() => setShowSinglePoModal(false)} className="btn btn-secondary" style={{ padding: '4px' }}>
                <X size={18} />
              </button>
            </div>

            <form onSubmit={handleCreateSinglePo}>
              <div className="form-group">
                <label className="form-label">Approved Supplier</label>
                <select
                  className="form-select"
                  value={singleSupplierId}
                  onChange={(e) => setSingleSupplierId(e.target.value)}
                  required
                >
                  <option value="">Select Supplier</option>
                  {suppliers.map((s) => (
                    <option key={s.supplier_id} value={s.supplier_id}>
                      {s.name} ({s.supplier_code})
                    </option>
                  ))}
                </select>
              </div>

              <div className="form-group">
                <label className="form-label">Expected Delivery Date</label>
                <input
                  type="date"
                  className="form-input"
                  value={expectedDeliveryDate}
                  onChange={(e) => setExpectedDeliveryDate(e.target.value)}
                  required
                />
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px', marginTop: '20px', borderTop: '1px solid var(--border)', paddingTop: '16px' }}>
                <button type="button" onClick={() => setShowSinglePoModal(false)} className="btn btn-secondary">
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={!singleSupplierId || createSinglePoMutation.isPending}
                  className="btn btn-primary"
                >
                  <ShoppingBag size={16} />
                  <span>Generate Purchase Order</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default RequestDetail;
