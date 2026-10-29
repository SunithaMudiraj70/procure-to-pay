import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useForm, useFieldArray } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import {
  FileText,
  ListPlus,
  CheckCircle2,
  AlertTriangle,
  ArrowRight,
  ArrowLeft,
  Trash2,
  Plus,
  Save,
  Send,
  AlertCircle,
  X
} from 'lucide-react';
import { useRequestDraftStore } from '../store/useRequestDraftStore.js';
import { useLookupsQuery } from '../hooks/useLookups.js';
import { useRequestPreviewQuery, useCreateRequestMutation, useSubmitRequestMutation } from '../hooks/useRequests.js';
import Stepper from '../components/Stepper.jsx';
import Spinner from '../components/Spinner.jsx';
import { formatCurrency } from '../lib/formatters.js';

// Validation schemas for the steps
const detailsSchema = z.object({
  title: z.string().min(5, 'Title must be at least 5 characters'),
  budgetId: z.string().min(1, 'Please select a department budget'),
  procurementType: z.enum(['competitive', 'single_source']),
  priority: z.enum(['low', 'normal', 'high', 'urgent']),
  neededByDate: z.string().min(1, 'Needed-by date is required'),
  justification: z.string().min(10, 'Justification must be at least 10 characters')
});

export const NewRequestWizard = () => {
  const navigate = useNavigate();

  // Draft state from Zustand store
  const step = useRequestDraftStore((state) => state.step);
  const setStep = useRequestDraftStore((state) => state.setStep);
  const draftDetails = useRequestDraftStore((state) => state.details);
  const updateDetails = useRequestDraftStore((state) => state.updateDetails);
  const draftLines = useRequestDraftStore((state) => state.lines);
  const setLines = useRequestDraftStore((state) => state.setLines);
  const addDraftLine = useRequestDraftStore((state) => state.addLine);
  const removeDraftLine = useRequestDraftStore((state) => state.removeLine);
  const updateDraftLine = useRequestDraftStore((state) => state.updateLine);
  const resetDraft = useRequestDraftStore((state) => state.resetDraft);

  // Lookups data
  const { data: lookupsData } = useLookupsQuery();
  const rawBudgets = lookupsData?.budgets || [];
  const rawCategories = lookupsData?.categories || [];

  const defaultCategories = [
    'Hardware',
    'Software',
    'Cloud Infrastructure',
    'Consulting',
    'Office Supplies',
    'Facilities',
    'Logistics',
    'Security Services'
  ];

  const categories = (rawCategories.length > 0 ? rawCategories : defaultCategories).map((c) => {
    if (typeof c === 'string') return { id: c, name: c };
    return { id: c.name || c.category_id || c.category || c.id, name: c.name || c.category || c.id };
  });

  const fallbackBudgets = [
    { budget_id: 'BUD-2026-0001', department_name: 'Information Technology', category: 'Hardware', available_amount: 1250000 },
    { budget_id: 'BUD-2026-0002', department_name: 'Software Engineering', category: 'Software', available_amount: 850000 },
    { budget_id: 'BUD-2026-0003', department_name: 'Facilities & Workplace', category: 'Facilities', available_amount: 500000 },
    { budget_id: 'BUD-2026-0004', department_name: 'Marketing & Growth', category: 'Consulting', available_amount: 600000 },
    { budget_id: 'BUD-2026-0005', department_name: 'Supply Chain Operations', category: 'Logistics', available_amount: 750000 }
  ];
  const budgets = rawBudgets.length > 0 ? rawBudgets : fallbackBudgets;

  // Mutations
  const createRequestMutation = useCreateRequestMutation();
  const submitRequestMutation = useSubmitRequestMutation();

  // Backend 422 error banner state
  const [backendError, setBackendError] = useState(null);

  // Review step overrides
  const [overrideReason, setOverrideReason] = useState('');
  const [duplicateConfirmed, setDuplicateConfirmed] = useState(false);

  // Setup form for Step 1
  const {
    register,
    handleSubmit,
    watch,
    setValue,
    formState: { errors }
  } = useForm({
    resolver: zodResolver(detailsSchema),
    defaultValues: draftDetails,
    mode: 'onTouched'
  });

  const watchProcurementType = watch('procurementType');
  const watchBudgetId = watch('budgetId');

  // Calculate totals from lines
  const grandTotal = draftLines.reduce((sum, line) => {
    const qty = Number(line.quantity) || 0;
    const cost = Number(line.estimatedUnitCost) || 0;
    return sum + qty * cost;
  }, 0);

  // Fetch live preview in step 3
  const { data: previewData, isLoading: loadingPreview } = useRequestPreviewQuery(
    { total: grandTotal, budgetId: draftDetails.budgetId || watchBudgetId },
    { enabled: step === 3 && grandTotal > 0 }
  );

  const availableBudget = previewData?.availableBudget ?? previewData?.available_budget ?? 0;
  const isOverBudget = previewData?.wouldExceedBudget ?? previewData?.is_over_budget ?? (availableBudget <= 0 || availableBudget < grandTotal);
  const duplicateCandidates = previewData?.duplicateCandidates ?? previewData?.duplicate_candidates ?? [];
  const requiredLevel = previewData?.requiredLevel ?? previewData?.required_level ?? 1;

  const handleNextStep1 = (data) => {
    updateDetails({
      ...data,
      singleSourceJustification: data.procurementType === 'single_source' ? data.justification : null
    });
    setBackendError(null);
    setStep(2);
  };

  const handleNextStep2 = () => {
    // Validate line items
    const invalidLines = draftLines.filter(
      (line) => !line.itemCode || !line.description || !line.category || Number(line.quantity) <= 0 || Number(line.estimatedUnitCost) <= 0
    );
    if (invalidLines.length > 0) {
      setBackendError('Please fill in all line item fields with valid codes, categories, quantities and costs.');
      return;
    }
    setBackendError(null);
    setStep(3);
  };

  const handleSaveDraft = async () => {
    setBackendError(null);
    if (!draftDetails.budgetId) {
      setBackendError('Please select a Department Budget in Step 1 before saving.');
      return;
    }
    try {
      const payload = {
        title: draftDetails.title || 'Untitled Request',
        budgetId: draftDetails.budgetId,
        budget_id: draftDetails.budgetId,
        procurementType: draftDetails.procurementType,
        procurement_type: draftDetails.procurementType,
        priority: draftDetails.priority,
        justification: draftDetails.justification,
        singleSourceJustification: draftDetails.procurementType === 'single_source' ? draftDetails.justification : null,
        single_source_justification: draftDetails.procurementType === 'single_source' ? draftDetails.justification : null,
        currencyCode: 'USD',
        currency_code: 'USD',
        lines: draftLines.map((l, idx) => ({
          line_no: idx + 1,
          itemCode: l.itemCode,
          item_code: l.itemCode,
          description: l.description,
          category: l.category,
          quantity: Number(l.quantity),
          estimatedUnitCost: Number(l.estimatedUnitCost),
          estimated_unit_cost: Number(l.estimatedUnitCost),
          uom: l.uom || 'EA'
        }))
      };

      const result = await createRequestMutation.mutateAsync(payload);
      resetDraft();
      navigate(`/requests/${result.pr_id}`);
    } catch (err) {
      setBackendError(err.message || 'Failed to save draft request.');
    }
  };

  const handleSubmitRequest = async () => {
    setBackendError(null);
    if (!draftDetails.budgetId) {
      setBackendError('Department budget is missing. Please return to Step 1 and select a Department Budget.');
      return;
    }

    if (isOverBudget && (!overrideReason || overrideReason.trim().length < 5)) {
      setBackendError('This request exceeds the available department budget. Please provide a formal Override Reason below (minimum 5 characters) before submitting.');
      return;
    }

    if (duplicateCandidates.length > 0 && !duplicateConfirmed) {
      setBackendError('Potential duplicate requests were detected. Please review and confirm checkbox before submission.');
      return;
    }

    try {
      // 1. Create draft request
      const payload = {
        title: draftDetails.title,
        budgetId: draftDetails.budgetId,
        budget_id: draftDetails.budgetId,
        procurementType: draftDetails.procurementType,
        procurement_type: draftDetails.procurementType,
        priority: draftDetails.priority,
        justification: draftDetails.justification,
        singleSourceJustification: draftDetails.procurementType === 'single_source' ? draftDetails.justification : null,
        single_source_justification: draftDetails.procurementType === 'single_source' ? draftDetails.justification : null,
        currencyCode: 'USD',
        currency_code: 'USD',
        lines: draftLines.map((l, idx) => ({
          line_no: idx + 1,
          itemCode: l.itemCode,
          item_code: l.itemCode,
          description: l.description,
          category: l.category,
          quantity: Number(l.quantity),
          estimatedUnitCost: Number(l.estimatedUnitCost),
          estimated_unit_cost: Number(l.estimatedUnitCost),
          uom: l.uom || 'EA'
        }))
      };

      const created = await createRequestMutation.mutateAsync(payload);

      // 2. Submit for approval
      await submitRequestMutation.mutateAsync({
        prId: created.pr_id,
        body: {
          overrideReason: overrideReason || undefined,
          override_reason: overrideReason || undefined,
          confirmDuplicate: duplicateConfirmed,
          duplicate_confirmed: duplicateConfirmed
        }
      });

      resetDraft();
      navigate(`/requests/${created.pr_id}`);
    } catch (err) {
      setBackendError(err.message || 'Failed to submit request.');
    }
  };

  return (
    <div style={{ maxWidth: '1000px', margin: '0 auto' }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '24px' }}>
        <div>
          <h2 style={{ fontSize: '1.5rem', fontWeight: 700, margin: 0 }}>New Purchase Request</h2>
          <p style={{ fontSize: '0.875rem', color: 'var(--text-muted)', margin: '4px 0 0' }}>
            Follow the 3-step wizard to create and submit a compliant procurement requisition
          </p>
        </div>
        <button
          onClick={() => {
            if (confirm('Discard changes and reset this draft?')) {
              resetDraft();
              navigate('/requests');
            }
          }}
          className="btn btn-ghost btn-sm"
        >
          Discard Draft
        </button>
      </div>

      {/* 422 Friendly Error Banner */}
      {backendError && (
        <div className="alert alert-error" style={{ marginBottom: '20px' }}>
          <AlertCircle size={20} style={{ flexShrink: 0 }} />
          <div style={{ flex: 1 }}>
            <div style={{ fontWeight: 600 }}>Validation Alert</div>
            <div>{backendError}</div>
          </div>
        </div>
      )}

      {/* Wizard Step Indicators */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(3, 1fr)',
          gap: '12px',
          marginBottom: '28px'
        }}
      >
        {[
          { num: 1, label: '1. Request Details', icon: FileText },
          { num: 2, label: '2. Line Items', icon: ListPlus },
          { num: 3, label: '3. Preview & Submit', icon: CheckCircle2 }
        ].map((s) => {
          const isActive = step === s.num;
          const isDone = step > s.num;
          const Icon = s.icon;

          return (
            <div
              key={s.num}
              onClick={() => {
                if (isDone) setStep(s.num);
              }}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '10px',
                padding: '12px 16px',
                borderRadius: 'var(--radius-md)',
                backgroundColor: isActive ? 'var(--primary-soft)' : 'var(--bg-surface)',
                border: isActive
                  ? '2px solid var(--primary)'
                  : isDone
                  ? '1px solid var(--success-border)'
                  : '1px solid var(--border)',
                cursor: isDone ? 'pointer' : 'default',
                transition: 'all 0.15s ease'
              }}
            >
              <div
                style={{
                  width: '28px',
                  height: '28px',
                  borderRadius: '50%',
                  backgroundColor: isActive ? 'var(--primary)' : isDone ? 'var(--success)' : 'var(--bg-surface-subtle)',
                  color: isActive || isDone ? 'white' : 'var(--text-muted)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontWeight: 700,
                  fontSize: '0.8rem'
                }}
              >
                {isDone ? '✓' : s.num}
              </div>
              <span
                style={{
                  fontSize: '0.875rem',
                  fontWeight: isActive ? 700 : 500,
                  color: isActive ? 'var(--primary)' : isDone ? 'var(--text-main)' : 'var(--text-muted)'
                }}
              >
                {s.label}
              </span>
            </div>
          );
        })}
      </div>

      {/* Wizard Steps Content */}
      <div className="card" style={{ padding: '32px' }}>
        {backendError && (
          <div
            style={{
              padding: '12px 16px',
              marginBottom: '20px',
              borderRadius: 'var(--radius-md)',
              backgroundColor: 'var(--danger-soft)',
              border: '1px solid var(--danger-border)',
              color: 'var(--danger)',
              fontSize: '0.875rem',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              gap: '12px'
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <AlertTriangle size={18} />
              <span>{backendError}</span>
            </div>
            <button
              type="button"
              onClick={() => setBackendError(null)}
              style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--danger)', padding: 0 }}
            >
              <X size={16} />
            </button>
          </div>
        )}
        {/* STEP 1: DETAILS */}
        {step === 1 && (
          <form onSubmit={handleSubmit(handleNextStep1)}>
            <h3 style={{ fontSize: '1.15rem', fontWeight: 700, marginBottom: '20px' }}>
              Step 1: Requisition Overview
            </h3>

            <div className="form-group">
              <label className="form-label">
                Requisition Title *
                {errors.title && <span className="form-error">{errors.title.message}</span>}
              </label>
              <input
                type="text"
                className={`form-input ${errors.title ? 'has-error' : ''}`}
                placeholder="e.g. Q4 Data Center Cloud Migration Server Licences"
                {...register('title')}
              />
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '16px' }}>
              <div className="form-group">
                <label className="form-label">
                  Department Budget *
                  {errors.budgetId && <span className="form-error">{errors.budgetId.message}</span>}
                </label>
                <select className={`form-select ${errors.budgetId ? 'has-error' : ''}`} {...register('budgetId')}>
                  <option value="">Select Department Budget</option>
                  {budgets.map((b) => (
                    <option key={b.budget_id} value={b.budget_id}>
                      {b.department_name || b.name || 'Department'} {b.category ? `• ${b.category}` : ''} (Avail: {formatCurrency(b.available_amount ?? b.allocated_amount ?? 500000)})
                    </option>
                  ))}
                </select>
              </div>

              <div className="form-group">
                <label className="form-label">Procurement Sourcing Method</label>
                <select className="form-select" {...register('procurementType')}>
                  <option value="competitive">Competitive Sourcing (Standard RFQ)</option>
                  <option value="single_source">Single-Source Sourcing (Exception)</option>
                </select>
              </div>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '16px' }}>
              <div className="form-group">
                <label className="form-label">Priority Level</label>
                <select className="form-select" {...register('priority')}>
                  <option value="low">Low Priority</option>
                  <option value="normal">Normal Priority</option>
                  <option value="high">High Priority</option>
                  <option value="urgent">Urgent</option>
                </select>
              </div>

              <div className="form-group">
                <label className="form-label">
                  Needed-by Date *
                  {errors.neededByDate && <span className="form-error">{errors.neededByDate.message}</span>}
                </label>
                <input
                  type="date"
                  className={`form-input ${errors.neededByDate ? 'has-error' : ''}`}
                  {...register('neededByDate')}
                />
              </div>
            </div>

            <div className="form-group">
              <label className="form-label">
                {watchProcurementType === 'single_source' ? 'Business & Single-Source Justification *' : 'Business Justification *'}
                {errors.justification && <span className="form-error">{errors.justification.message}</span>}
              </label>
              <textarea
                rows={4}
                className={`form-textarea ${errors.justification ? 'has-error' : ''}`}
                placeholder={
                  watchProcurementType === 'single_source'
                    ? "Explain the business necessity AND the justification for single-source procurement (e.g. sole OEM provider, proprietary technology, emergency repair)..."
                    : "Explain the business necessity and expected operational benefits of this requisition..."
                }
                {...register('justification')}
              />
              {watchProcurementType === 'single_source' && (
                <div style={{ marginTop: '6px', fontSize: '0.8rem', color: '#b45309', display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <AlertCircle size={14} />
                  <span>This single justification will serve as the formal compliance rationale for single-source approval.</span>
                </div>
              )}
            </div>

            <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '28px' }}>
              <button type="submit" className="btn btn-primary">
                <span>Continue to Line Items</span>
                <ArrowRight size={16} />
              </button>
            </div>
          </form>
        )}

        {/* STEP 2: LINE ITEMS */}
        {step === 2 && (
          <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
              <div>
                <h3 style={{ fontSize: '1.15rem', fontWeight: 700, margin: 0 }}>Step 2: Line Items</h3>
                <p style={{ fontSize: '0.825rem', color: 'var(--text-muted)', margin: '4px 0 0' }}>
                  Specify the items, quantities, and estimated unit costs for live financial calculation
                </p>
              </div>
              <button
                type="button"
                onClick={() => addDraftLine()}
                className="btn btn-secondary btn-sm"
              >
                <Plus size={15} />
                <span>Add Line Item</span>
              </button>
            </div>

            {/* Table of Line Items */}
            <div style={{ overflowX: 'auto', marginBottom: '20px' }}>
              <table className="app-table">
                <thead>
                  <tr>
                    <th style={{ width: '40px' }}>#</th>
                    <th style={{ width: '130px' }}>Item Code</th>
                    <th>Description</th>
                    <th style={{ width: '140px' }}>Category</th>
                    <th style={{ width: '80px', textAlign: 'right' }}>Qty</th>
                    <th style={{ width: '120px', textAlign: 'right' }}>Unit Cost ($)</th>
                    <th style={{ width: '120px', textAlign: 'right' }}>Total ($)</th>
                    <th style={{ width: '50px' }}></th>
                  </tr>
                </thead>
                <tbody>
                  {draftLines.map((line, idx) => {
                    const lineTotal = (Number(line.quantity) || 0) * (Number(line.estimatedUnitCost) || 0);

                    return (
                      <tr key={idx}>
                        <td style={{ fontWeight: 600, color: 'var(--text-muted)' }}>{idx + 1}</td>
                        <td>
                          <input
                            type="text"
                            className="form-input"
                            style={{ padding: '6px 8px', fontSize: '0.8rem' }}
                            placeholder="e.g. SRV-01"
                            value={line.itemCode || ''}
                            onChange={(e) => updateDraftLine(idx, { itemCode: e.target.value })}
                          />
                        </td>
                        <td>
                          <input
                            type="text"
                            className="form-input"
                            style={{ padding: '6px 8px', fontSize: '0.8rem' }}
                            placeholder="Detailed item description"
                            value={line.description || ''}
                            onChange={(e) => updateDraftLine(idx, { description: e.target.value })}
                          />
                        </td>
                        <td>
                          <select
                            className="form-select"
                            style={{ padding: '6px 8px', fontSize: '0.8rem' }}
                            value={line.category || ''}
                            onChange={(e) => updateDraftLine(idx, { category: e.target.value })}
                          >
                            <option value="">Select Category</option>
                            {categories.map((c) => (
                              <option key={c.id} value={c.name}>
                                {c.name}
                              </option>
                            ))}
                          </select>
                        </td>
                        <td>
                          <input
                            type="number"
                            min="1"
                            className="form-input"
                            style={{ padding: '6px 8px', fontSize: '0.8rem', textAlign: 'right' }}
                            value={line.quantity || ''}
                            onChange={(e) => updateDraftLine(idx, { quantity: Number(e.target.value) })}
                          />
                        </td>
                        <td>
                          <input
                            type="number"
                            step="0.01"
                            min="0"
                            className="form-input"
                            style={{ padding: '6px 8px', fontSize: '0.8rem', textAlign: 'right' }}
                            value={line.estimatedUnitCost || ''}
                            onChange={(e) => updateDraftLine(idx, { estimatedUnitCost: Number(e.target.value) })}
                          />
                        </td>
                        <td style={{ textAlign: 'right', fontWeight: 600 }} className="tabular-nums">
                          {formatCurrency(lineTotal)}
                        </td>
                        <td>
                          {draftLines.length > 1 && (
                            <button
                              type="button"
                              onClick={() => removeDraftLine(idx)}
                              style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--danger)' }}
                              title="Remove line"
                            >
                              <Trash2 size={16} />
                            </button>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            {/* Live Grand Total Bar */}
            <div
              style={{
                display: 'flex',
                justifyContent: 'flex-end',
                alignItems: 'center',
                padding: '16px 20px',
                backgroundColor: 'var(--primary-soft)',
                borderRadius: 'var(--radius-md)',
                gap: '16px',
                marginBottom: '28px'
              }}
            >
              <span style={{ fontSize: '1rem', fontWeight: 600, color: 'var(--text-main)' }}>
                Estimated Grand Total:
              </span>
              <span
                className="tabular-nums"
                style={{ fontSize: '1.5rem', fontWeight: 800, color: 'var(--primary)' }}
              >
                {formatCurrency(grandTotal)}
              </span>
            </div>

            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
              <button type="button" onClick={() => setStep(1)} className="btn btn-secondary">
                <ArrowLeft size={16} />
                <span>Back to Details</span>
              </button>

              <button type="button" onClick={handleNextStep2} className="btn btn-primary">
                <span>Review Live Preview</span>
                <ArrowRight size={16} />
              </button>
            </div>
          </div>
        )}

        {/* STEP 3: LIVE PREVIEW & SUBMISSION */}
        {step === 3 && (
          <div>
            <h3 style={{ fontSize: '1.15rem', fontWeight: 700, marginBottom: '8px' }}>
              Step 3: Verification & Preview
            </h3>
            <p style={{ fontSize: '0.825rem', color: 'var(--text-muted)', marginBottom: '24px' }}>
              Review the automated compliance checks, required approval path, and duplicate analysis
            </p>

            {loadingPreview ? (
              <div style={{ padding: '40px', textAlign: 'center' }}>
                <Spinner size="md" message="Running live approval and budget preview..." />
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
                {/* 1. Summary Header Card */}
                <div
                  style={{
                    backgroundColor: 'var(--bg-surface-subtle)',
                    padding: '16px 20px',
                    borderRadius: 'var(--radius-md)',
                    border: '1px solid var(--border)',
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center'
                  }}
                >
                  <div>
                    <div style={{ fontSize: '1.05rem', fontWeight: 700 }}>{draftDetails.title}</div>
                    <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginTop: '2px' }}>
                      {draftDetails.procurementType === 'competitive' ? 'Competitive Sourcing' : 'Single-Source Sourcing'} • {draftLines.length} line items
                    </div>
                  </div>
                  <div style={{ textAlign: 'right' }}>
                    <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', textTransform: 'uppercase' }}>Grand Total</div>
                    <div className="tabular-nums" style={{ fontSize: '1.4rem', fontWeight: 800, color: 'var(--primary)' }}>
                      {formatCurrency(grandTotal)}
                    </div>
                  </div>
                </div>

                {/* 2. Required Approval Stepper Preview */}
                <div>
                  <h4 style={{ fontSize: '0.95rem', fontWeight: 600, marginBottom: '8px' }}>
                    Required Approval Hierarchy (Tier {requiredLevel})
                  </h4>
                  <Stepper requiredLevel={requiredLevel} approvals={[]} />
                </div>

                {/* 3. Budget Status & Over-budget Warning */}
                <div
                  style={{
                    padding: '16px',
                    borderRadius: 'var(--radius-md)',
                    border: isOverBudget ? '1px solid var(--warning-border)' : '1px solid var(--success-border)',
                    backgroundColor: isOverBudget ? 'var(--warning-soft)' : 'var(--success-soft)'
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '8px' }}>
                    {isOverBudget ? (
                      <AlertTriangle size={20} color="var(--warning)" />
                    ) : (
                      <CheckCircle2 size={20} color="var(--success)" />
                    )}
                    <span style={{ fontWeight: 700, fontSize: '0.9rem', color: isOverBudget ? 'var(--warning)' : 'var(--success)' }}>
                      {isOverBudget ? 'Budget Overrun Detected' : 'Sufficient Department Budget Available'}
                    </span>
                  </div>

                  <div style={{ fontSize: '0.825rem', color: 'var(--text-main)', marginBottom: '8px' }}>
                    Available Budget: <strong>{formatCurrency(availableBudget || 0)}</strong> • Request Total: <strong>{formatCurrency(grandTotal)}</strong>
                  </div>

                  {isOverBudget && (
                    <div style={{ marginTop: '12px' }}>
                      <label className="form-label" style={{ color: 'var(--warning)' }}>
                        Override Reason Required *
                      </label>
                      <input
                        type="text"
                        className="form-input"
                        placeholder="Provide formal business reason explaining the budget overrun exception..."
                        value={overrideReason}
                        onChange={(e) => setOverrideReason(e.target.value)}
                      />
                    </div>
                  )}
                </div>

                {/* 4. Potential Duplicate Warning */}
                {duplicateCandidates.length > 0 && (
                  <div
                    style={{
                      padding: '16px',
                      borderRadius: 'var(--radius-md)',
                      border: '1px solid var(--danger-border)',
                      backgroundColor: 'var(--danger-soft)'
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '8px' }}>
                      <AlertCircle size={20} color="var(--danger)" />
                      <span style={{ fontWeight: 700, fontSize: '0.9rem', color: 'var(--danger)' }}>
                        Potential Duplicate Requisitions Found
                      </span>
                    </div>

                    <p style={{ fontSize: '0.8rem', color: '#991B1B', margin: '0 0 10px' }}>
                      Found {duplicateCandidates.length} similar existing requests with matching amounts or titles.
                    </p>

                    <div style={{ maxHeight: '120px', overflowY: 'auto', marginBottom: '12px' }}>
                      {duplicateCandidates.map((d) => (
                        <div key={d.pr_id} style={{ fontSize: '0.75rem', padding: '4px 0', borderBottom: '1px dashed var(--danger-border)' }}>
                          <strong>{d.pr_id}</strong>: {d.title} ({formatCurrency(d.estimated_total)}) - Status: {d.status}
                        </div>
                      ))}
                    </div>

                    <label style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '0.825rem', fontWeight: 600, cursor: 'pointer' }}>
                      <input
                        type="checkbox"
                        checked={duplicateConfirmed}
                        onChange={(e) => setDuplicateConfirmed(e.target.checked)}
                      />
                      <span>I have verified that this is NOT an unintended duplicate requisition</span>
                    </label>
                  </div>
                )}

                {/* Action Buttons */}
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '16px', borderTop: '1px solid var(--border)', paddingTop: '20px' }}>
                  <button type="button" onClick={() => setStep(2)} className="btn btn-secondary">
                    <ArrowLeft size={16} />
                    <span>Back to Line Items</span>
                  </button>

                  <div style={{ display: 'flex', gap: '12px' }}>
                    <button
                      type="button"
                      onClick={handleSaveDraft}
                      disabled={createRequestMutation.isPending}
                      className="btn btn-secondary"
                    >
                      <Save size={16} />
                      <span>Save as Draft</span>
                    </button>

                    <button
                      type="button"
                      onClick={handleSubmitRequest}
                      disabled={submitRequestMutation.isPending || createRequestMutation.isPending}
                      className="btn btn-primary"
                    >
                      <Send size={16} />
                      <span>Submit for Approval</span>
                    </button>
                  </div>
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
};

export default NewRequestWizard;
