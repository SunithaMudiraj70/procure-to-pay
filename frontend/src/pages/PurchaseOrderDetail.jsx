import React, { useState } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import {
  ArrowLeft,
  Truck,
  XCircle,
  AlertTriangle,
  CheckCircle2,
  Package,
  Calendar,
  AlertCircle,
  X,
  History,
  FileText
} from 'lucide-react';
import {
  usePurchaseOrderDetailQuery,
  useRecordDeliveryMutation,
  useCancelPoMutation
} from '../hooks/usePurchaseOrders.js';
import { useSessionStore } from '../store/useSessionStore.js';
import StatusChip from '../components/StatusChip.jsx';
import Drawer from '../components/Drawer.jsx';
import Timeline from '../components/Timeline.jsx';
import Spinner from '../components/Spinner.jsx';
import { formatCurrency, formatDate, formatDateTime } from '../lib/formatters.js';

export const PurchaseOrderDetail = () => {
  const { poId } = useParams();
  const navigate = useNavigate();
  const currentUser = useSessionStore((state) => state.currentUser);
  const userRole = currentUser?.role;

  // Drawer & Modal state
  const [deliveryDrawerOpen, setDeliveryDrawerOpen] = useState(false);
  const [cancelModalOpen, setCancelModalOpen] = useState(false);
  const [cancelReason, setCancelReason] = useState('');
  const [actionError, setActionError] = useState(null);

  // Delivery form state
  const [deliveryDate, setDeliveryDate] = useState(new Date().toISOString().split('T')[0]);
  const [carrier, setCarrier] = useState('');
  const [trackingRef, setTrackingRef] = useState('');
  const [deliveryNotes, setDeliveryNotes] = useState('');
  const [lineQuantities, setLineQuantities] = useState({});

  // Queries
  const { data: po, isLoading, isError, error, refetch } = usePurchaseOrderDetailQuery(poId);

  // Mutations
  const recordDeliveryMutation = useRecordDeliveryMutation();
  const cancelPoMutation = useCancelPoMutation();

  if (isLoading) {
    return (
      <div style={{ padding: '60px', textAlign: 'center' }}>
        <Spinner size="lg" message="Loading purchase order details..." />
      </div>
    );
  }

  if (isError || !po) {
    return (
      <div className="card" style={{ padding: '40px', textAlign: 'center' }}>
        <AlertTriangle size={36} color="var(--danger)" style={{ margin: '0 auto 12px' }} />
        <h3 style={{ fontSize: '1.25rem', marginBottom: '8px' }}>Purchase Order Not Found</h3>
        <p style={{ color: 'var(--text-muted)', marginBottom: '20px' }}>
          {error?.message || `Unable to load PO ${poId}`}
        </p>
        <Link to="/purchase-orders" className="btn btn-secondary">
          <ArrowLeft size={16} />
          <span>Back to Purchase Orders</span>
        </Link>
      </div>
    );
  }

  const lines = po.lines || [];
  const deliveries = po.deliveries || [];
  const isCancelled = po.status === 'cancelled';
  const isDelivered = po.status === 'delivered';

  const canRecordDelivery = (userRole === 'operations_analyst' || userRole === 'system_admin') && !isCancelled && !isDelivered;
  const canCancelPo = (userRole === 'process_owner' || userRole === 'system_admin') && !isCancelled && !isDelivered;

  // Open delivery drawer and initialize line receipt fields with remaining outstanding
  const openDeliveryDrawer = () => {
    const initial = {};
    lines.forEach((l) => {
      const outstanding = Number(l.qty_outstanding !== undefined ? l.qty_outstanding : l.quantity);
      initial[l.po_line_id] = {
        delivered: outstanding > 0 ? outstanding : 0,
        rejected: 0,
        maxAllowed: outstanding
      };
    });
    setLineQuantities(initial);
    setCarrier('FedEx Logistics');
    setTrackingRef(`TRK-${Math.floor(100000 + Math.random() * 900000)}`);
    setDeliveryNotes('');
    setActionError(null);
    setDeliveryDrawerOpen(true);
  };

  const handleDeliverySubmit = async (e) => {
    e.preventDefault();
    setActionError(null);

    // Validate quantities against outstanding
    const linePayload = [];
    for (const line of lines) {
      const lineData = lineQuantities[line.po_line_id] || { delivered: 0, rejected: 0 };
      const delivered = Number(lineData.delivered) || 0;
      const rejected = Number(lineData.rejected) || 0;
      const outstanding = Number(line.qty_outstanding !== undefined ? line.qty_outstanding : line.quantity);

      if (delivered > outstanding) {
        setActionError(`Line ${line.line_no}: Delivered quantity (${delivered}) exceeds outstanding balance (${outstanding}).`);
        return;
      }

      if (delivered > 0 || rejected > 0) {
        linePayload.push({
          po_line_id: line.po_line_id,
          qty_delivered: delivered,
          qty_rejected: rejected
        });
      }
    }

    if (linePayload.length === 0) {
      setActionError('Please specify delivered quantity for at least one item line.');
      return;
    }

    try {
      await recordDeliveryMutation.mutateAsync({
        poId,
        body: {
          delivery_date: deliveryDate,
          carrier: carrier.trim() || undefined,
          tracking_ref: trackingRef.trim() || undefined,
          notes: deliveryNotes.trim() || undefined,
          lines: linePayload
        }
      });
      setDeliveryDrawerOpen(false);
      refetch();
    } catch (err) {
      setActionError(err.message || 'Failed to record delivery.');
    }
  };

  const handleCancelSubmit = async (e) => {
    e.preventDefault();
    setActionError(null);
    if (!cancelReason || cancelReason.trim().length < 5) {
      setActionError('Cancellation reason must be at least 5 characters.');
      return;
    }

    try {
      await cancelPoMutation.mutateAsync({
        poId,
        reason: cancelReason.trim()
      });
      setCancelModalOpen(false);
      refetch();
    } catch (err) {
      setActionError(err.message || 'Failed to cancel purchase order.');
    }
  };

  // Convert deliveries to timeline format
  const deliveryTimelineEvents = deliveries.map((d) => ({
    delivery_id: d.delivery_id,
    title: `Delivery Receipt: ${d.delivery_id}`,
    actual_date: d.actual_delivery_date || d.delivery_date || d.created_at,
    actor_name: d.received_by_name || 'Receiving Dock',
    carrier: d.carrier,
    tracking_ref: d.tracking_ref,
    notes: d.notes,
    reason: `${d.lines?.length || 0} line items received`
  }));

  return (
    <div>
      {/* Back button */}
      <div style={{ marginBottom: '16px' }}>
        <Link to="/purchase-orders" style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', fontSize: '0.85rem', color: 'var(--text-muted)' }}>
          <ArrowLeft size={16} />
          <span>Back to Purchase Orders</span>
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
            <span className="id-badge" style={{ fontSize: '0.95rem' }}>{po.po_id}</span>
            <StatusChip status={po.status} />
            <span className="badge badge-secondary" style={{ textTransform: 'capitalize' }}>
              Type: {po.po_type?.replace(/_/g, ' ')}
            </span>
          </div>

          <h2 style={{ fontSize: '1.4rem', fontWeight: 700, margin: 0, color: 'var(--text-main)' }}>
            Supplier: {po.supplier_name}
          </h2>

          <div style={{ display: 'flex', gap: '20px', fontSize: '0.825rem', color: 'var(--text-muted)', marginTop: '8px', flexWrap: 'wrap' }}>
            <span>Requisition: <Link to={`/requests/${po.pr_id}`} style={{ fontWeight: 600 }}>{po.pr_id}</Link></span>
            <span>Issued: <strong className="date-num">{formatDate(po.issued_date || po.created_at)}</strong></span>
            <span>Expected Delivery: <strong className="date-num">{formatDate(po.expected_delivery_date)}</strong></span>
            <span>Department: <strong>{po.department_name}</strong></span>
          </div>
        </div>

        {/* Header Actions */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <div style={{ textAlign: 'right', paddingRight: '8px' }}>
            <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', textTransform: 'uppercase' }}>Total Commitment</div>
            <div className="tabular-nums" style={{ fontSize: '1.6rem', fontWeight: 800, color: 'var(--primary)' }}>
              {formatCurrency(po.total_amount, po.currency_code)}
            </div>
          </div>

          {canRecordDelivery && (
            <button onClick={openDeliveryDrawer} className="btn btn-primary">
              <Truck size={16} />
              <span>Record Delivery Receipt</span>
            </button>
          )}

          {canCancelPo && (
            <button onClick={() => setCancelModalOpen(true)} className="btn btn-danger">
              <XCircle size={16} />
              <span>Cancel PO</span>
            </button>
          )}
        </div>
      </div>

      {/* Main Content Layout */}
      <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: '24px' }}>
        {/* Left Column: Lines & Progress Bars */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
          {/* PO Lines with Receipt Progress */}
          <div className="card">
            <h3 style={{ fontSize: '1.05rem', fontWeight: 700, marginBottom: '16px' }}>
              Purchase Order Lines & Receipt Progress
            </h3>

            <div style={{ overflowX: 'auto' }}>
              <table className="app-table">
                <thead>
                  <tr>
                    <th style={{ width: '40px' }}>#</th>
                    <th>Item Code & Description</th>
                    <th style={{ textAlign: 'right' }}>Ordered</th>
                    <th style={{ textAlign: 'right' }}>Accepted</th>
                    <th style={{ textAlign: 'right' }}>Outstanding</th>
                    <th style={{ width: '140px', textAlign: 'center' }}>Progress</th>
                  </tr>
                </thead>
                <tbody>
                  {lines.map((l) => {
                    const ordered = Number(l.quantity || l.qty_ordered || 0);
                    const accepted = Number(l.qty_accepted || 0);
                    const outstanding = Number(l.qty_outstanding !== undefined ? l.qty_outstanding : ordered - accepted);
                    const pct = ordered > 0 ? Math.min(100, Math.round((accepted / ordered) * 100)) : 0;
                    const isComplete = pct >= 100;

                    return (
                      <tr key={l.po_line_id || l.line_no}>
                        <td>{l.line_no}</td>
                        <td>
                          <div style={{ fontWeight: 600, color: 'var(--text-main)' }}>{l.item_code}</div>
                          <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>{l.description}</div>
                        </td>
                        <td style={{ textAlign: 'right' }} className="tabular-nums">{ordered} {l.uom || 'EA'}</td>
                        <td style={{ textAlign: 'right', color: 'var(--success)', fontWeight: 600 }} className="tabular-nums">
                          {accepted}
                        </td>
                        <td style={{ textAlign: 'right', color: outstanding > 0 ? 'var(--warning)' : 'var(--text-muted)', fontWeight: 600 }} className="tabular-nums">
                          {outstanding}
                        </td>
                        <td style={{ textAlign: 'center' }}>
                          <div style={{ width: '100px', margin: '0 auto' }}>
                            <div style={{ fontSize: '0.7rem', fontWeight: 600, marginBottom: '2px' }} className="tabular-nums">
                              {pct}%
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
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>

          {/* Deliveries Timeline */}
          <div className="card">
            <h3 style={{ fontSize: '1.05rem', fontWeight: 700, marginBottom: '12px' }}>
              Recorded Delivery Receipts & Goods Inspection
            </h3>
            <Timeline events={deliveryTimelineEvents} emptyMessage="No delivery receipts recorded yet for this order." />
          </div>
        </div>

        {/* Right Column: Supplier & Commercial Details */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
          <div className="card">
            <h4 style={{ fontSize: '0.95rem', fontWeight: 700, marginBottom: '12px' }}>Supplier Information</h4>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', fontSize: '0.85rem' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span style={{ color: 'var(--text-muted)' }}>Name:</span>
                <span style={{ fontWeight: 600 }}>{po.supplier_name}</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span style={{ color: 'var(--text-muted)' }}>Supplier Code:</span>
                <span style={{ fontFamily: 'var(--font-mono)' }}>{po.supplier_code}</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span style={{ color: 'var(--text-muted)' }}>Supplier Risk:</span>
                <span className="badge badge-secondary" style={{ textTransform: 'capitalize' }}>
                  {po.supplier_risk_level || 'Low'}
                </span>
              </div>
            </div>
          </div>

          <div className="card">
            <h4 style={{ fontSize: '0.95rem', fontWeight: 700, marginBottom: '12px' }}>Commercial Terms</h4>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', fontSize: '0.85rem' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span style={{ color: 'var(--text-muted)' }}>Currency:</span>
                <span style={{ fontWeight: 600 }}>{po.currency_code || 'USD'}</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span style={{ color: 'var(--text-muted)' }}>Subtotal:</span>
                <span className="tabular-nums" style={{ fontWeight: 600 }}>{formatCurrency(po.subtotal)}</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', borderTop: '1px solid var(--border)', paddingTop: '8px' }}>
                <span style={{ color: 'var(--text-main)', fontWeight: 600 }}>Total Order Value:</span>
                <span className="tabular-nums" style={{ fontWeight: 800, color: 'var(--primary)' }}>
                  {formatCurrency(po.total_amount)}
                </span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* RECORD DELIVERY DRAWER */}
      <Drawer
        isOpen={deliveryDrawerOpen}
        onClose={() => setDeliveryDrawerOpen(false)}
        title="Record Goods Delivery Receipt"
        width="600px"
      >
        <form onSubmit={handleDeliverySubmit} style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
          <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '16px', overflowY: 'auto', paddingRight: '4px' }}>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '12px' }}>
              <div className="form-group">
                <label className="form-label">Delivery Date *</label>
                <input
                  type="date"
                  className="form-input"
                  value={deliveryDate}
                  onChange={(e) => setDeliveryDate(e.target.value)}
                  required
                />
              </div>

              <div className="form-group">
                <label className="form-label">Carrier / Courier</label>
                <input
                  type="text"
                  className="form-input"
                  placeholder="e.g. FedEx, DHL, Internal"
                  value={carrier}
                  onChange={(e) => setCarrier(e.target.value)}
                />
              </div>
            </div>

            <div className="form-group">
              <label className="form-label">Tracking / Delivery Note Ref</label>
              <input
                type="text"
                className="form-input"
                placeholder="e.g. TRK-882910"
                value={trackingRef}
                onChange={(e) => setTrackingRef(e.target.value)}
              />
            </div>

            {/* Per-line delivery inputs */}
            <div>
              <label className="form-label" style={{ marginBottom: '8px' }}>
                Delivered & Rejected Quantities (Blocked above outstanding)
              </label>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                {lines.map((line) => {
                  const state = lineQuantities[line.po_line_id] || { delivered: 0, rejected: 0, maxAllowed: 0 };
                  const maxAllowed = state.maxAllowed || 0;

                  return (
                    <div
                      key={line.po_line_id}
                      style={{
                        padding: '12px',
                        border: '1px solid var(--border)',
                        borderRadius: 'var(--radius-md)',
                        backgroundColor: 'var(--bg-surface-subtle)'
                      }}
                    >
                      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px' }}>
                        <div>
                          <strong style={{ fontSize: '0.85rem' }}>{line.item_code}</strong> - {line.description}
                        </div>
                        <span className="badge badge-secondary">
                          Outstanding: {maxAllowed} {line.uom || 'EA'}
                        </span>
                      </div>

                      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '12px' }}>
                        <div>
                          <label style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Delivered Qty</label>
                          <input
                            type="number"
                            min="0"
                            max={maxAllowed}
                            className="form-input"
                            style={{ height: '34px', fontSize: '0.825rem' }}
                            value={state.delivered}
                            onChange={(e) => {
                              const val = Math.min(maxAllowed, Math.max(0, Number(e.target.value)));
                              setLineQuantities({
                                ...lineQuantities,
                                [line.po_line_id]: { ...state, delivered: val }
                              });
                            }}
                          />
                        </div>

                        <div>
                          <label style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Rejected Qty (Damaged)</label>
                          <input
                            type="number"
                            min="0"
                            className="form-input"
                            style={{ height: '34px', fontSize: '0.825rem' }}
                            value={state.rejected}
                            onChange={(e) => {
                              const val = Math.max(0, Number(e.target.value));
                              setLineQuantities({
                                ...lineQuantities,
                                [line.po_line_id]: { ...state, rejected: val }
                              });
                            }}
                          />
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            <div className="form-group">
              <label className="form-label">Inspection & Receiving Notes</label>
              <textarea
                rows={2}
                className="form-textarea"
                placeholder="Condition of packaging, serial numbers, dock bay location..."
                value={deliveryNotes}
                onChange={(e) => setDeliveryNotes(e.target.value)}
              />
            </div>
          </div>

          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px', paddingTop: '16px', borderTop: '1px solid var(--border)', marginTop: '16px' }}>
            <button type="button" onClick={() => setDeliveryDrawerOpen(false)} className="btn btn-secondary">
              Cancel
            </button>
            <button type="submit" disabled={recordDeliveryMutation.isPending} className="btn btn-primary">
              <Truck size={16} />
              <span>Confirm Goods Receipt</span>
            </button>
          </div>
        </form>
      </Drawer>

      {/* CANCEL PO MODAL */}
      {cancelModalOpen && (
        <div className="modal-backdrop" onClick={() => setCancelModalOpen(false)}>
          <div className="modal-box" onClick={(e) => e.stopPropagation()} style={{ maxWidth: '500px', width: '92%' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px', borderBottom: '1px solid var(--border)', paddingBottom: '12px' }}>
              <div>
                <h3 style={{ margin: 0, fontSize: '1.15rem', color: 'var(--danger)' }}>Cancel Purchase Order</h3>
                <p style={{ margin: '4px 0 0', fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                  This action is irreversible and releases reserved budget funds.
                </p>
              </div>
              <button onClick={() => setCancelModalOpen(false)} className="btn btn-secondary" style={{ padding: '4px' }}>
                <X size={18} />
              </button>
            </div>

            <form onSubmit={handleCancelSubmit}>
              <div className="form-group">
                <label className="form-label">Cancellation Reason *</label>
                <textarea
                  rows={3}
                  className="form-textarea"
                  placeholder="Explain why this order is being cancelled..."
                  value={cancelReason}
                  onChange={(e) => setCancelReason(e.target.value)}
                  required
                />
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px', marginTop: '20px', borderTop: '1px solid var(--border)', paddingTop: '16px' }}>
                <button type="button" onClick={() => setCancelModalOpen(false)} className="btn btn-secondary">
                  Back
                </button>
                <button
                  type="submit"
                  disabled={cancelPoMutation.isPending}
                  className="btn btn-danger"
                >
                  <XCircle size={16} />
                  <span>Confirm Cancellation</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default PurchaseOrderDetail;
