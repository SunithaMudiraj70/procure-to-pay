import React, { useState } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import {
  ArrowLeft,
  Plus,
  Play,
  Award,
  ShoppingBag,
  Clock,
  AlertTriangle,
  CheckCircle2,
  AlertCircle,
  X,
  TrendingDown,
  Zap,
  Star,
  ExternalLink
} from 'lucide-react';
import {
  useRfqComparisonQuery,
  useAddQuoteMutation,
  useEvaluateRfqMutation,
  useAwardRfqMutation,
  useCreatePoFromRfqMutation
} from '../hooks/useRfqs.js';
import { useSuppliersQuery } from '../hooks/useSuppliers.js';
import { useSessionStore } from '../store/useSessionStore.js';
import StatusChip from '../components/StatusChip.jsx';
import Drawer from '../components/Drawer.jsx';
import Spinner from '../components/Spinner.jsx';
import { formatCurrency, formatDate } from '../lib/formatters.js';

export const RfqDetail = () => {
  const { rfqId } = useParams();
  const navigate = useNavigate();
  const currentUser = useSessionStore((state) => state.currentUser);
  const userRole = currentUser?.role;

  // Drawer & Modal state
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [awardModalOpen, setAwardModalOpen] = useState(false);
  const [selectedQuoteForAward, setSelectedQuoteForAward] = useState(null);
  const [awardRationale, setAwardRationale] = useState('');
  const [actionError, setActionError] = useState(null);

  // Add Quote form state
  const [supplierId, setSupplierId] = useState('');
  const [unitPrice, setUnitPrice] = useState(0);
  const [quantity, setQuantity] = useState(1);
  const [freightCost, setFreightCost] = useState(0);
  const [insuranceCost, setInsuranceCost] = useState(0);
  const [customsCost, setCustomsCost] = useState(0);
  const [leadTimeDays, setLeadTimeDays] = useState(14);
  const [validUntil, setValidUntil] = useState(
    new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0]
  );
  const [qualityRating, setQualityRating] = useState(4.5);
  const [complianceConfirmed, setComplianceConfirmed] = useState(true);

  // Queries
  const { data: comparisonData, isLoading, isError, error, refetch } = useRfqComparisonQuery(rfqId);
  const { data: suppliersData } = useSuppliersQuery();
  const suppliers = suppliersData?.data || [];

  // Mutations
  const addQuoteMutation = useAddQuoteMutation();
  const evaluateMutation = useEvaluateRfqMutation();
  const awardMutation = useAwardRfqMutation();
  const createPoMutation = useCreatePoFromRfqMutation();

  if (isLoading) {
    return (
      <div style={{ padding: '60px', textAlign: 'center' }}>
        <Spinner size="lg" message="Loading RFQ evaluation data..." />
      </div>
    );
  }

  if (isError || !comparisonData) {
    return (
      <div className="card" style={{ padding: '40px', textAlign: 'center' }}>
        <AlertTriangle size={36} color="var(--danger)" style={{ margin: '0 auto 12px' }} />
        <h3 style={{ fontSize: '1.25rem', marginBottom: '8px' }}>RFQ Not Found</h3>
        <p style={{ color: 'var(--text-muted)', marginBottom: '20px' }}>
          {error?.message || `Unable to load RFQ ${rfqId}`}
        </p>
        <Link to="/rfqs" className="btn btn-secondary">
          <ArrowLeft size={16} />
          <span>Back to RFQs</span>
        </Link>
      </div>
    );
  }

  const rfq = comparisonData.rfq || {};
  const quotes = comparisonData.quotes || [];
  const award = comparisonData.award || null;
  const minQuotes = comparisonData.min_quotes_required || rfq.min_quotes_required || 3;

  // Step tracker calculation
  const steps = [
    { key: 'issued', label: '1. RFQ Issued' },
    { key: 'quotes_received', label: '2. Quotes Received' },
    { key: 'evaluated', label: '3. Evaluated' },
    { key: 'awarded', label: '4. Awarded' },
    { key: 'po_issued', label: '5. PO Generated' }
  ];

  const getStepStatus = (stepKey) => {
    const current = rfq.status;
    const order = ['issued', 'quotes_received', 'evaluated', 'awarded', 'po_issued'];
    const currentIdx = order.indexOf(current);
    const stepIdx = order.indexOf(stepKey);

    if (currentIdx > stepIdx || current === 'po_issued') return 'completed';
    if (currentIdx === stepIdx) return 'current';
    return 'upcoming';
  };

  // Find lowest landed cost and fastest lead time for badges
  const validQuotes = quotes.filter((q) => Number(q.total_landed_cost || q.landed_cost) > 0);
  const lowestLandedCost = validQuotes.length > 0
    ? Math.min(...validQuotes.map((q) => Number(q.total_landed_cost || q.landed_cost)))
    : null;
  const fastestLeadTime = validQuotes.length > 0
    ? Math.min(...validQuotes.map((q) => Number(q.lead_time_days || 999)))
    : null;

  // Live landed cost in Add Quote drawer
  const liveTotalLandedCost =
    (Number(unitPrice) || 0) * (Number(quantity) || 1) +
    (Number(freightCost) || 0) +
    (Number(insuranceCost) || 0) +
    (Number(customsCost) || 0);

  const handleAddQuoteSubmit = async (e) => {
    e.preventDefault();
    setActionError(null);
    if (!supplierId) {
      setActionError('Please select a supplier.');
      return;
    }

    try {
      await addQuoteMutation.mutateAsync({
        rfqId,
        body: {
          supplier_id: supplierId,
          unit_price: Number(unitPrice),
          quantity: Number(quantity),
          freight_cost: Number(freightCost),
          insurance_cost: Number(insuranceCost),
          customs_cost: Number(customsCost),
          lead_time_days: Number(leadTimeDays),
          valid_until: validUntil,
          quality_rating: Number(qualityRating),
          compliance_confirmed: complianceConfirmed,
          currency_code: 'USD'
        }
      });
      setDrawerOpen(false);
      refetch();
    } catch (err) {
      setActionError(err.message || 'Failed to submit quote.');
    }
  };

  const handleRunEvaluation = async () => {
    setActionError(null);
    try {
      await evaluateMutation.mutateAsync(rfqId);
      refetch();
    } catch (err) {
      setActionError(err.message || 'Failed to run quote evaluation.');
    }
  };

  const openAwardDialog = (quote) => {
    setSelectedQuoteForAward(quote);
    setAwardRationale('');
    setAwardModalOpen(true);
    setActionError(null);
  };

  const handleConfirmAward = async (e) => {
    e.preventDefault();
    setActionError(null);

    const isLowest = Number(selectedQuoteForAward.total_landed_cost || selectedQuoteForAward.landed_cost) === lowestLandedCost;
    if (!isLowest && (!awardRationale || awardRationale.trim().length < 10)) {
      setActionError('Awarding a quote other than the lowest landed cost requires a comprehensive commercial rationale (min 10 characters).');
      return;
    }

    try {
      await awardMutation.mutateAsync({
        rfqId,
        body: {
          quote_id: selectedQuoteForAward.quote_id,
          award_rationale: awardRationale.trim() || undefined
        }
      });
      setAwardModalOpen(false);
      refetch();
    } catch (err) {
      setActionError(err.message || 'Failed to award RFQ.');
    }
  };

  const handleGeneratePo = async () => {
    setActionError(null);
    try {
      const res = await createPoMutation.mutateAsync(rfqId);
      navigate(`/purchase-orders/${res.po_id}`);
    } catch (err) {
      setActionError(err.message || 'Failed to generate purchase order.');
    }
  };

  const isProcOwner = userRole === 'process_owner' || userRole === 'system_admin';

  return (
    <div>
      {/* Back button */}
      <div style={{ marginBottom: '16px' }}>
        <Link to="/rfqs" style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', fontSize: '0.85rem', color: 'var(--text-muted)' }}>
          <ArrowLeft size={16} />
          <span>Back to RFQs</span>
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
            <span className="id-badge" style={{ fontSize: '0.95rem' }}>{rfq.rfq_id}</span>
            <StatusChip status={rfq.status} />
            <span className="badge badge-secondary">
              Closing: <strong className="date-num">{formatDate(rfq.closing_date)}</strong>
            </span>
          </div>

          <h2 style={{ fontSize: '1.4rem', fontWeight: 700, margin: 0, color: 'var(--text-main)' }}>
            {rfq.title || `RFQ for Requisition ${rfq.pr_id}`}
          </h2>

          <div style={{ display: 'flex', gap: '20px', fontSize: '0.825rem', color: 'var(--text-muted)', marginTop: '8px', flexWrap: 'wrap' }}>
            <span>Requisition: <Link to={`/requests/${rfq.pr_id}`} style={{ fontWeight: 600 }}>{rfq.pr_id}</Link></span>
            <span>Quotes Received: <strong>{quotes.length} of {minQuotes} min</strong></span>
            <span>Issued: <strong className="date-num">{formatDate(rfq.issue_date || rfq.created_at)}</strong></span>
          </div>
        </div>

        {/* Action Buttons */}
        <div style={{ display: 'flex', gap: '12px', alignItems: 'center' }}>
          {rfq.status !== 'awarded' && rfq.status !== 'po_issued' && (
            <button
              onClick={() => {
                setSupplierId(suppliers[0]?.supplier_id || '');
                setUnitPrice(100);
                setQuantity(1);
                setFreightCost(25);
                setInsuranceCost(10);
                setCustomsCost(15);
                setActionError(null);
                setDrawerOpen(true);
              }}
              disabled={!isProcOwner}
              className="btn btn-secondary"
              title={!isProcOwner ? 'Only a Procurement Lead can record quotes' : undefined}
            >
              <Plus size={16} />
              <span>Record Supplier Quote</span>
            </button>
          )}

          {quotes.length >= minQuotes && rfq.status !== 'awarded' && rfq.status !== 'po_issued' && (
            <button
              onClick={handleRunEvaluation}
              disabled={!isProcOwner || evaluateMutation.isPending}
              className="btn btn-primary"
            >
              <Play size={16} />
              <span>Run Scoring Evaluation</span>
            </button>
          )}

          {rfq.status === 'awarded' && (
            <button
              onClick={handleGeneratePo}
              disabled={!isProcOwner || createPoMutation.isPending}
              className="btn btn-primary"
            >
              <ShoppingBag size={16} />
              <span>Generate Purchase Order</span>
            </button>
          )}
        </div>
      </div>

      {/* Step Tracker */}
      <div
        className="card"
        style={{
          padding: '16px 24px',
          marginBottom: '24px',
          display: 'grid',
          gridTemplateColumns: 'repeat(5, 1fr)',
          gap: '12px'
        }}
      >
        {steps.map((s) => {
          const state = getStepStatus(s.key);
          const isComp = state === 'completed';
          const isCurr = state === 'current';

          return (
            <div
              key={s.key}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
                padding: '8px 12px',
                borderRadius: 'var(--radius-sm)',
                backgroundColor: isCurr ? 'var(--primary-soft)' : isComp ? 'var(--success-soft)' : 'var(--bg-surface-subtle)',
                color: isCurr ? 'var(--primary)' : isComp ? 'var(--success)' : 'var(--text-muted)',
                fontWeight: isCurr || isComp ? 700 : 500,
                fontSize: '0.8rem'
              }}
            >
              {isComp ? <CheckCircle2 size={16} /> : <Clock size={16} />}
              <span>{s.label}</span>
            </div>
          );
        })}
      </div>

      {/* Side-by-Side Comparison Table */}
      <div className="card" style={{ padding: '24px', marginBottom: '24px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
          <div>
            <h3 style={{ fontSize: '1.15rem', fontWeight: 700, margin: 0 }}>Quote Comparison & Score Matrix</h3>
            <p style={{ fontSize: '0.825rem', color: 'var(--text-muted)', margin: '4px 0 0' }}>
              Multi-criteria landed cost and lead time evaluation
            </p>
          </div>
          {quotes.length < minQuotes && (
            <div className="badge badge-warning" style={{ fontSize: '0.75rem', padding: '6px 10px' }}>
              <AlertTriangle size={14} />
              <span>Requires at least {minQuotes} quotes before formal award (Current: {quotes.length})</span>
            </div>
          )}
        </div>

        {quotes.length === 0 ? (
          <div style={{ padding: '40px', textAlign: 'center', color: 'var(--text-muted)', backgroundColor: 'var(--bg-surface-subtle)', borderRadius: 'var(--radius-md)' }}>
            <Scale size={32} color="var(--primary)" style={{ margin: '0 auto 8px', display: 'block' }} />
            <p style={{ margin: 0, fontWeight: 600 }}>No quotes recorded yet</p>
            <span style={{ fontSize: '0.825rem' }}>Click "Record Supplier Quote" above to input landed cost proposals.</span>
          </div>
        ) : (
          <div style={{ overflowX: 'auto' }}>
            <table className="app-table">
              <thead>
                <tr>
                  <th style={{ width: '80px' }}>Rank</th>
                  <th>Supplier</th>
                  <th style={{ textAlign: 'right' }}>Landed Cost</th>
                  <th style={{ textAlign: 'right' }}>Lead Time</th>
                  <th style={{ textAlign: 'center' }}>Quality / Compliance</th>
                  <th style={{ textAlign: 'center' }}>Total Score</th>
                  <th style={{ textAlign: 'center' }}>Status / Flags</th>
                  <th style={{ width: '120px', textAlign: 'right' }}>Action</th>
                </tr>
              </thead>
              <tbody>
                {quotes.map((quote, idx) => {
                  const landedCost = Number(quote.total_landed_cost || quote.landed_cost || 0);
                  const isLowestCost = landedCost === lowestLandedCost && lowestLandedCost > 0;
                  const isFastest = Number(quote.lead_time_days) === fastestLeadTime && fastestLeadTime > 0;
                  const isAwarded = rfq.awarded_quote_id === quote.quote_id || award?.quote_id === quote.quote_id;

                  // Warnings
                  const isExpired = quote.valid_until && new Date(quote.valid_until) < new Date();
                  const isInactive = quote.supplier_status === 'inactive';
                  const isRisk = quote.supplier_risk_flag || quote.supplier_risk_level === 'high';

                  return (
                    <tr
                      key={quote.quote_id}
                      style={{
                        backgroundColor: isAwarded ? 'var(--success-soft)' : undefined
                      }}
                    >
                      <td>
                        {quote.rank ? (
                          <span
                            className="badge"
                            style={{
                              backgroundColor: quote.rank === 1 ? 'var(--primary)' : 'var(--bg-surface-subtle)',
                              color: quote.rank === 1 ? 'white' : 'var(--text-main)',
                              fontWeight: 700
                            }}
                          >
                            #{quote.rank}
                          </span>
                        ) : (
                          <span style={{ color: 'var(--text-muted)' }}>—</span>
                        )}
                      </td>

                      <td>
                        <div>
                          <div style={{ fontWeight: 600, color: 'var(--text-main)' }}>{quote.supplier_name}</div>
                          <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                            Quote ID: <span style={{ fontFamily: 'var(--font-mono)' }}>{quote.quote_id}</span>
                          </div>
                        </div>
                      </td>

                      <td style={{ textAlign: 'right' }}>
                        <div className="tabular-nums" style={{ fontWeight: 700, fontSize: '0.95rem' }}>
                          {formatCurrency(landedCost)}
                        </div>
                        {isLowestCost && (
                          <span className="badge badge-success" style={{ fontSize: '0.675rem' }}>
                            <TrendingDown size={11} /> Lowest Landed Cost
                          </span>
                        )}
                      </td>

                      <td style={{ textAlign: 'right' }}>
                        <div className="tabular-nums" style={{ fontWeight: 600 }}>
                          {quote.lead_time_days} days
                        </div>
                        {isFastest && (
                          <span className="badge badge-primary" style={{ fontSize: '0.675rem' }}>
                            <Zap size={11} /> Fastest Delivery
                          </span>
                        )}
                      </td>

                      <td style={{ textAlign: 'center' }}>
                        <div style={{ display: 'inline-flex', alignItems: 'center', gap: '4px', fontSize: '0.825rem', fontWeight: 600 }}>
                          <Star size={13} fill="#F59E0B" color="#F59E0B" />
                          <span>{quote.quality_rating || 4.5} / 5.0</span>
                        </div>
                        <div>
                          {quote.compliance_confirmed ? (
                            <span style={{ fontSize: '0.7rem', color: 'var(--success)' }}>Compliant</span>
                          ) : (
                            <span style={{ fontSize: '0.7rem', color: 'var(--danger)' }}>Non-compliant</span>
                          )}
                        </div>
                      </td>

                      <td style={{ textAlign: 'center' }}>
                        {quote.score !== undefined && quote.score !== null ? (
                          <span className="tabular-nums" style={{ fontSize: '1.05rem', fontWeight: 800, color: 'var(--primary)' }}>
                            {Number(quote.score).toFixed(1)} / 100
                          </span>
                        ) : (
                          <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>Pending eval</span>
                        )}
                      </td>

                      <td style={{ textAlign: 'center' }}>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', alignItems: 'center' }}>
                          {isAwarded && <span className="badge badge-success">Awarded</span>}
                          {isExpired && <span className="badge badge-danger">Expired</span>}
                          {isInactive && <span className="badge badge-danger">Inactive Supplier</span>}
                          {isRisk && <span className="badge badge-warning">Risk Flag</span>}
                          {!isAwarded && !isExpired && !isInactive && !isRisk && (
                            <span className="badge badge-secondary">Valid</span>
                          )}
                        </div>
                      </td>

                      <td style={{ textAlign: 'right' }}>
                        {rfq.status !== 'awarded' && rfq.status !== 'po_issued' ? (
                          <button
                            onClick={() => openAwardDialog(quote)}
                            disabled={!isProcOwner}
                            className="btn btn-sm btn-primary"
                            title={!isProcOwner ? 'Only a Procurement Lead can award' : undefined}
                          >
                            <Award size={14} />
                            <span>Award</span>
                          </button>
                        ) : isAwarded ? (
                          <span style={{ fontWeight: 700, color: 'var(--success)', fontSize: '0.85rem' }}>✓ Awarded</span>
                        ) : null}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* ADD QUOTE DRAWER */}
      <Drawer
        isOpen={drawerOpen}
        onClose={() => setDrawerOpen(false)}
        title="Record Supplier Quote"
        width="540px"
      >
        <form onSubmit={handleAddQuoteSubmit} style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
          <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '16px', overflowY: 'auto', paddingRight: '4px' }}>
            <div className="form-group">
              <label className="form-label">Invited Supplier *</label>
              <select
                className="form-select"
                value={supplierId}
                onChange={(e) => setSupplierId(e.target.value)}
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

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '12px' }}>
              <div className="form-group">
                <label className="form-label">Unit Price ($) *</label>
                <input
                  type="number"
                  step="0.01"
                  min="0.01"
                  className="form-input"
                  value={unitPrice}
                  onChange={(e) => setUnitPrice(e.target.value)}
                  required
                />
              </div>

              <div className="form-group">
                <label className="form-label">Quantity *</label>
                <input
                  type="number"
                  min="1"
                  className="form-input"
                  value={quantity}
                  onChange={(e) => setQuantity(e.target.value)}
                  required
                />
              </div>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '12px' }}>
              <div className="form-group">
                <label className="form-label">Freight Cost ($)</label>
                <input
                  type="number"
                  step="0.01"
                  className="form-input"
                  value={freightCost}
                  onChange={(e) => setFreightCost(e.target.value)}
                />
              </div>

              <div className="form-group">
                <label className="form-label">Insurance ($)</label>
                <input
                  type="number"
                  step="0.01"
                  className="form-input"
                  value={insuranceCost}
                  onChange={(e) => setInsuranceCost(e.target.value)}
                />
              </div>

              <div className="form-group">
                <label className="form-label">Customs ($)</label>
                <input
                  type="number"
                  step="0.01"
                  className="form-input"
                  value={customsCost}
                  onChange={(e) => setCustomsCost(e.target.value)}
                />
              </div>
            </div>

            {/* Live Total Landed Cost Display */}
            <div
              style={{
                padding: '16px',
                borderRadius: 'var(--radius-md)',
                backgroundColor: 'var(--primary-soft)',
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center'
              }}
            >
              <span style={{ fontWeight: 600, color: 'var(--primary)' }}>Live Landed Cost Total:</span>
              <span className="tabular-nums" style={{ fontSize: '1.35rem', fontWeight: 800, color: 'var(--primary)' }}>
                {formatCurrency(liveTotalLandedCost)}
              </span>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '12px' }}>
              <div className="form-group">
                <label className="form-label">Lead Time (Days)</label>
                <input
                  type="number"
                  min="1"
                  className="form-input"
                  value={leadTimeDays}
                  onChange={(e) => setLeadTimeDays(e.target.value)}
                  required
                />
              </div>

              <div className="form-group">
                <label className="form-label">Quote Validity Expiry</label>
                <input
                  type="date"
                  className="form-input"
                  value={validUntil}
                  onChange={(e) => setValidUntil(e.target.value)}
                  required
                />
              </div>
            </div>

            <div className="form-group">
              <label className="form-label">Quality Rating (1.0 - 5.0)</label>
              <input
                type="number"
                step="0.1"
                min="1"
                max="5"
                className="form-input"
                value={qualityRating}
                onChange={(e) => setQualityRating(e.target.value)}
              />
            </div>

            <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer', fontSize: '0.85rem' }}>
              <input
                type="checkbox"
                checked={complianceConfirmed}
                onChange={(e) => setComplianceConfirmed(e.target.checked)}
              />
              <span>Supplier confirms full technical and legal compliance</span>
            </label>
          </div>

          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px', paddingTop: '16px', borderTop: '1px solid var(--border)', marginTop: '16px' }}>
            <button type="button" onClick={() => setDrawerOpen(false)} className="btn btn-secondary">
              Cancel
            </button>
            <button type="submit" disabled={addQuoteMutation.isPending} className="btn btn-primary">
              <span>Save Supplier Quote</span>
            </button>
          </div>
        </form>
      </Drawer>

      {/* AWARD DIALOG */}
      {awardModalOpen && selectedQuoteForAward && (
        <div className="modal-backdrop" onClick={() => setAwardModalOpen(false)}>
          <div className="modal-box" onClick={(e) => e.stopPropagation()} style={{ maxWidth: '540px', width: '92%' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px', borderBottom: '1px solid var(--border)', paddingBottom: '12px' }}>
              <div>
                <h3 style={{ margin: 0, fontSize: '1.15rem' }}>Award Sourcing Contract</h3>
                <p style={{ margin: '4px 0 0', fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                  Confirm supplier selection for {selectedQuoteForAward.supplier_name}
                </p>
              </div>
              <button onClick={() => setAwardModalOpen(false)} className="btn btn-secondary" style={{ padding: '4px' }}>
                <X size={18} />
              </button>
            </div>

            {Number(selectedQuoteForAward.total_landed_cost || selectedQuoteForAward.landed_cost) !== lowestLandedCost && (
              <div className="alert alert-warning" style={{ marginBottom: '16px' }}>
                <AlertTriangle size={18} style={{ flexShrink: 0 }} />
                <div style={{ fontSize: '0.825rem' }}>
                  <strong>Notice:</strong> This quote is not the lowest landed cost option. Policy requires entering a formal justification below before this award can proceed.
                </div>
              </div>
            )}

            <form onSubmit={handleConfirmAward}>
              <div style={{ backgroundColor: 'var(--bg-surface-subtle)', padding: '12px 16px', borderRadius: 'var(--radius-md)', marginBottom: '16px', fontSize: '0.85rem' }}>
                <div><strong>Supplier:</strong> {selectedQuoteForAward.supplier_name}</div>
                <div><strong>Total Landed Cost:</strong> {formatCurrency(selectedQuoteForAward.total_landed_cost || selectedQuoteForAward.landed_cost)}</div>
                <div><strong>Lead Time:</strong> {selectedQuoteForAward.lead_time_days} days</div>
              </div>

              <div className="form-group">
                <label className="form-label">
                  Award Rationale {Number(selectedQuoteForAward.total_landed_cost || selectedQuoteForAward.landed_cost) !== lowestLandedCost ? '*' : '(Optional)'}
                </label>
                <textarea
                  rows={3}
                  className="form-textarea"
                  placeholder="Explain why this supplier was selected (quality, faster lead time, track record)..."
                  value={awardRationale}
                  onChange={(e) => setAwardRationale(e.target.value)}
                  required={Number(selectedQuoteForAward.total_landed_cost || selectedQuoteForAward.landed_cost) !== lowestLandedCost}
                />
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px', marginTop: '20px', borderTop: '1px solid var(--border)', paddingTop: '16px' }}>
                <button type="button" onClick={() => setAwardModalOpen(false)} className="btn btn-secondary">
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={awardMutation.isPending}
                  className="btn btn-primary"
                >
                  <Award size={16} />
                  <span>Confirm Contract Award</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default RfqDetail;
