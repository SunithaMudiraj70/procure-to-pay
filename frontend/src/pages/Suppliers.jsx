import React, { useState } from 'react';
import { Building2, Search, Filter, AlertTriangle, Star, CheckCircle2, Award, Clock, Plus, X } from 'lucide-react';
import { useSuppliersQuery, useCreateSupplierMutation } from '../hooks/useSuppliers.js';
import { useLookupsQuery } from '../hooks/useLookups.js';
import DataTable, { CopyableId } from '../components/DataTable.jsx';
import StatusChip from '../components/StatusChip.jsx';
import Drawer from '../components/Drawer.jsx';
import { formatPercent } from '../lib/formatters.js';

export const Suppliers = () => {
  const [statusFilter, setStatusFilter] = useState('');
  const [riskFilter, setRiskFilter] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('');
  const [search, setSearch] = useState('');

  // Drawer state
  const [selectedSupplier, setSelectedSupplier] = useState(null);
  const [drawerOpen, setDrawerOpen] = useState(false);

  // Create Supplier Modal state
  const [createModalOpen, setCreateModalOpen] = useState(false);
  const [supplierCode, setSupplierCode] = useState('');
  const [supplierName, setSupplierName] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('Hardware');
  const [countryCode, setCountryCode] = useState('US');
  const [currency, setCurrency] = useState('USD');
  const [paymentTerms, setPaymentTerms] = useState(30);
  const [supplierStatus, setSupplierStatus] = useState('active');
  const [riskLevel, setRiskLevel] = useState('low');
  const [riskFlag, setRiskFlag] = useState(false);
  const [riskReason, setRiskReason] = useState('');
  const [formError, setFormError] = useState(null);

  const { data: lookupsData } = useLookupsQuery();
  const availableCategories = lookupsData?.categories || [
    'Hardware', 'Software', 'Cloud Infrastructure', 'Consulting', 'Office Supplies', 'Facilities', 'Logistics'
  ];

  const createSupplierMutation = useCreateSupplierMutation();

  const { data: supplierResponse, isLoading, refetch } = useSuppliersQuery({
    status: statusFilter || undefined,
    risk: riskFilter || undefined,
    q: search || undefined
  });

  const supplierList = Array.isArray(supplierResponse) ? supplierResponse : (supplierResponse?.data || []);

  const handleOpenDetail = (supplier) => {
    setSelectedSupplier(supplier);
    setDrawerOpen(true);
  };

  const handleCreateSupplierSubmit = async (e) => {
    e.preventDefault();
    setFormError(null);

    const code = supplierCode.trim().toUpperCase();
    if (!code || code.length < 3 || code.length > 10) {
      setFormError('Supplier code must be between 3 and 10 alphanumeric characters (e.g. DELL, ORCL).');
      return;
    }
    if (!supplierName.trim()) {
      setFormError('Supplier company name is required.');
      return;
    }
    if (riskFlag && (!riskReason || !riskReason.trim())) {
      setFormError('A risk justification reason is required when a risk flag is raised.');
      return;
    }

    try {
      await createSupplierMutation.mutateAsync({
        supplier_code: code,
        name: supplierName.trim(),
        country_code: countryCode.trim().toUpperCase() || 'US',
        default_currency: currency,
        payment_terms_days: Number(paymentTerms) || 30,
        status: supplierStatus,
        risk_level: riskLevel,
        risk_flag: riskFlag,
        risk_reason: riskFlag ? riskReason.trim() : null,
        categories: [selectedCategory]
      });

      setCreateModalOpen(false);
      setSupplierCode('');
      setSupplierName('');
      setRiskFlag(false);
      setRiskReason('');
      refetch();
    } catch (err) {
      setFormError(err.message || 'Failed to onboard supplier.');
    }
  };

  const columns = [
    {
      key: 'name',
      header: 'Supplier & Code',
      sortable: true,
      render: (row) => (
        <div>
          <div style={{ fontWeight: 600, color: 'var(--text-main)' }}>{row.name}</div>
          <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
            <span style={{ fontFamily: 'var(--font-mono)' }}>{row.supplier_code}</span> • {row.country_code || 'US'}
          </div>
        </div>
      )
    },
    {
      key: 'category',
      header: 'Category',
      sortable: true,
      render: (row) => <span className="badge badge-secondary">{row.category || 'General'}</span>
    },
    {
      key: 'status',
      header: 'Status',
      align: 'center',
      render: (row) => <StatusChip status={row.status} />
    },
    {
      key: 'risk_level',
      header: 'Risk Scorecard',
      align: 'center',
      render: (row) => {
        const isRiskFlag = row.risk_flag || row.risk_level === 'high' || row.risk_level === 'critical';
        return (
          <div style={{ display: 'inline-flex', alignItems: 'center', gap: '6px' }}>
            <StatusChip status={row.risk_level} size="sm" />
            {isRiskFlag && (
              <span className="badge badge-warning" title="Flagged for commercial review">
                <AlertTriangle size={11} /> Flag
              </span>
            )}
          </div>
        );
      }
    },
    {
      key: 'rating',
      header: 'Quality Rating',
      align: 'center',
      render: (row) => (
        <div style={{ display: 'inline-flex', alignItems: 'center', gap: '4px', fontWeight: 600 }}>
          <Star size={13} fill="#F59E0B" color="#F59E0B" />
          <span className="tabular-nums">{row.rating ? Number(row.rating).toFixed(1) : '4.6'}</span>
        </div>
      )
    },
    {
      key: 'on_time_delivery_pct',
      header: 'On-Time Fulfillment',
      align: 'right',
      tabular: true,
      render: (row) => (
        <span style={{ fontWeight: 600, color: 'var(--success)' }}>
          {formatPercent(row.on_time_delivery_pct || 96.5)}
        </span>
      )
    },
    {
      key: 'actions',
      header: 'Scorecard',
      align: 'right',
      render: (row) => (
        <button
          onClick={(e) => {
            e.stopPropagation();
            handleOpenDetail(row);
          }}
          className="btn btn-secondary btn-sm"
        >
          View Scorecard
        </button>
      )
    }
  ];

  return (
    <div>
      {/* Top Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '24px' }}>
        <div>
          <h2 style={{ fontSize: '1.5rem', fontWeight: 700, margin: 0 }}>Supplier Scorecards</h2>
          <p style={{ fontSize: '0.875rem', color: 'var(--text-muted)', margin: '4px 0 0' }}>
            Manage accredited suppliers, evaluate fulfillment SLAs, and track compliance risks
          </p>
        </div>
        <button
          onClick={() => {
            setFormError(null);
            setCreateModalOpen(true);
          }}
          className="btn btn-primary"
        >
          <Plus size={16} />
          <span>Add Supplier</span>
        </button>
      </div>

      {/* Filter Bar */}
      <div
        className="card"
        style={{
          padding: '16px 20px',
          marginBottom: '20px',
          display: 'flex',
          alignItems: 'center',
          gap: '16px',
          flexWrap: 'wrap'
        }}
      >
        <div style={{ position: 'relative', width: '100%', maxWidth: '280px' }}>
          <Search size={16} style={{ position: 'absolute', left: '10px', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
          <input
            type="text"
            className="form-input"
            placeholder="Search by supplier name or code..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            style={{ paddingLeft: '32px', height: '36px' }}
          />
        </div>

        <select
          className="form-select"
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
          style={{ width: '160px', height: '36px', fontSize: '0.825rem' }}
        >
          <option value="">All Statuses</option>
          <option value="active">Active</option>
          <option value="inactive">Inactive</option>
          <option value="onboarding">Onboarding</option>
          <option value="blacklisted">Blacklisted</option>
        </select>

        <select
          className="form-select"
          value={riskFilter}
          onChange={(e) => setRiskFilter(e.target.value)}
          style={{ width: '160px', height: '36px', fontSize: '0.825rem' }}
        >
          <option value="">All Risk Tiers</option>
          <option value="low">Low Risk</option>
          <option value="medium">Medium Risk</option>
          <option value="high">High Risk</option>
        </select>
      </div>

      {/* DataTable */}
      <DataTable
        columns={columns}
        data={supplierList}
        loading={isLoading}
        total={supplierList.length}
        onRowClick={handleOpenDetail}
        emptyTitle="No suppliers matching filters"
        emptyDescription="Try clearing your search query or selecting all status options."
      />

      {/* SUPPLIER DETAIL DRAWER */}
      {selectedSupplier && (
        <Drawer
          isOpen={drawerOpen}
          onClose={() => setDrawerOpen(false)}
          title={`Supplier Scorecard: ${selectedSupplier.name}`}
          width="500px"
        >
          <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
              <span className="id-badge">{selectedSupplier.supplier_code}</span>
              <StatusChip status={selectedSupplier.status} />
              <StatusChip status={selectedSupplier.risk_level} size="sm" />
            </div>

            {/* Scorecard KPI Cards */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '12px' }}>
              <div style={{ padding: '16px', backgroundColor: 'var(--bg-surface-subtle)', borderRadius: 'var(--radius-md)' }}>
                <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>On-Time Delivery SLA</div>
                <div className="tabular-nums" style={{ fontSize: '1.4rem', fontWeight: 800, color: 'var(--success)' }}>
                  {formatPercent(selectedSupplier.on_time_delivery_pct || 96.5)}
                </div>
              </div>

              <div style={{ padding: '16px', backgroundColor: 'var(--bg-surface-subtle)', borderRadius: 'var(--radius-md)' }}>
                <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Quality Rating</div>
                <div className="tabular-nums" style={{ fontSize: '1.4rem', fontWeight: 800, color: 'var(--primary)', display: 'flex', alignItems: 'center', gap: '4px' }}>
                  <Star size={18} fill="#F59E0B" color="#F59E0B" />
                  <span>{selectedSupplier.rating ? Number(selectedSupplier.rating).toFixed(1) : '4.6'}</span>
                </div>
              </div>
            </div>

            {/* Overview Attributes */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', fontSize: '0.85rem' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '1px solid var(--border)', paddingBottom: '8px' }}>
                <span style={{ color: 'var(--text-muted)' }}>Primary Category:</span>
                <span style={{ fontWeight: 600 }}>{selectedSupplier.category || 'General Services'}</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '1px solid var(--border)', paddingBottom: '8px' }}>
                <span style={{ color: 'var(--text-muted)' }}>Country:</span>
                <span style={{ fontWeight: 600 }}>{selectedSupplier.country_code || 'US'}</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '1px solid var(--border)', paddingBottom: '8px' }}>
                <span style={{ color: 'var(--text-muted)' }}>Payment Terms:</span>
                <span style={{ fontWeight: 600 }}>{selectedSupplier.payment_terms || 'Net 30 Days'}</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '1px solid var(--border)', paddingBottom: '8px' }}>
                <span style={{ color: 'var(--text-muted)' }}>Risk Flag:</span>
                <span style={{ fontWeight: 600, color: selectedSupplier.risk_flag ? 'var(--danger)' : 'var(--success)' }}>
                  {selectedSupplier.risk_flag ? 'Attention Required' : 'Cleared / Normal'}
                </span>
              </div>
            </div>

            <div style={{ marginTop: '16px', display: 'flex', justifyContent: 'flex-end' }}>
              <button onClick={() => setDrawerOpen(false)} className="btn btn-secondary">
                Close
              </button>
            </div>
          </div>
        </Drawer>
      )}

      {/* CREATE SUPPLIER MODAL */}
      {createModalOpen && (
        <div className="modal-backdrop" onClick={() => setCreateModalOpen(false)}>
          <div
            className="modal-box"
            onClick={(e) => e.stopPropagation()}
            style={{ maxWidth: '580px', width: '92%' }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px', borderBottom: '1px solid var(--border)', paddingBottom: '12px' }}>
              <div>
                <h3 style={{ margin: 0, fontSize: '1.15rem' }}>Onboard Accredited Supplier</h3>
                <p style={{ margin: '4px 0 0', fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                  Register a verified vendor for RFQ invitations, quotes, and contract purchase orders
                </p>
              </div>
              <button onClick={() => setCreateModalOpen(false)} className="btn btn-secondary" style={{ padding: '4px', borderRadius: '50%' }}>
                <X size={18} />
              </button>
            </div>

            {formError && (
              <div style={{ padding: '10px 14px', backgroundColor: 'var(--danger-soft)', border: '1px solid var(--danger-border)', color: 'var(--danger)', borderRadius: 'var(--radius-md)', fontSize: '0.825rem', marginBottom: '16px' }}>
                {formError}
              </div>
            )}

            <form onSubmit={handleCreateSupplierSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 2fr', gap: '12px' }}>
                <div className="form-group" style={{ margin: 0 }}>
                  <label className="form-label">Supplier Code *</label>
                  <input
                    type="text"
                    className="form-input"
                    placeholder="e.g. DELL"
                    maxLength={10}
                    value={supplierCode}
                    onChange={(e) => setSupplierCode(e.target.value.toUpperCase())}
                    required
                  />
                </div>
                <div className="form-group" style={{ margin: 0 }}>
                  <label className="form-label">Legal Company Name *</label>
                  <input
                    type="text"
                    className="form-input"
                    placeholder="e.g. Dell Global Technologies Inc"
                    value={supplierName}
                    onChange={(e) => setSupplierName(e.target.value)}
                    required
                  />
                </div>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                <div className="form-group" style={{ margin: 0 }}>
                  <label className="form-label">Primary Supply Category *</label>
                  <select
                    className="form-select"
                    value={selectedCategory}
                    onChange={(e) => setSelectedCategory(e.target.value)}
                    required
                  >
                    {availableCategories.map((c) => {
                      const name = typeof c === 'string' ? c : (c.name || c.category);
                      return <option key={name} value={name}>{name}</option>;
                    })}
                  </select>
                </div>

                <div className="form-group" style={{ margin: 0 }}>
                  <label className="form-label">Country & Currency</label>
                  <div style={{ display: 'flex', gap: '8px' }}>
                    <input
                      type="text"
                      className="form-input"
                      placeholder="US"
                      maxLength={2}
                      value={countryCode}
                      onChange={(e) => setCountryCode(e.target.value.toUpperCase())}
                      style={{ width: '60px', textAlign: 'center' }}
                      required
                    />
                    <select
                      className="form-select"
                      value={currency}
                      onChange={(e) => setCurrency(e.target.value)}
                      style={{ flex: 1 }}
                    >
                      <option value="USD">USD ($)</option>
                      <option value="EUR">EUR (€)</option>
                      <option value="GBP">GBP (£)</option>
                    </select>
                  </div>
                </div>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                <div className="form-group" style={{ margin: 0 }}>
                  <label className="form-label">Payment Terms (Days)</label>
                  <input
                    type="number"
                    min="0"
                    max="180"
                    className="form-input"
                    value={paymentTerms}
                    onChange={(e) => setPaymentTerms(e.target.value)}
                    required
                  />
                </div>

                <div className="form-group" style={{ margin: 0 }}>
                  <label className="form-label">Status & Initial Risk</label>
                  <div style={{ display: 'flex', gap: '8px' }}>
                    <select
                      className="form-select"
                      value={supplierStatus}
                      onChange={(e) => setSupplierStatus(e.target.value)}
                      style={{ flex: 1 }}
                    >
                      <option value="active">Active</option>
                      <option value="onboarding">Onboarding</option>
                      <option value="inactive">Inactive</option>
                    </select>
                    <select
                      className="form-select"
                      value={riskLevel}
                      onChange={(e) => setRiskLevel(e.target.value)}
                      style={{ flex: 1 }}
                    >
                      <option value="low">Low Risk</option>
                      <option value="medium">Medium Risk</option>
                      <option value="high">High Risk</option>
                    </select>
                  </div>
                </div>
              </div>

              <div style={{ padding: '10px 12px', backgroundColor: 'var(--bg-surface-subtle)', borderRadius: 'var(--radius-sm)' }}>
                <label style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '0.825rem', fontWeight: 600, cursor: 'pointer' }}>
                  <input
                    type="checkbox"
                    checked={riskFlag}
                    onChange={(e) => setRiskFlag(e.target.checked)}
                  />
                  <span>Flag this supplier for commercial/governance risk review</span>
                </label>
                {riskFlag && (
                  <div style={{ marginTop: '8px' }}>
                    <input
                      type="text"
                      className="form-input"
                      placeholder="Specify formal risk reason (e.g. sole proprietorship, single geography, credit rating)..."
                      value={riskReason}
                      onChange={(e) => setRiskReason(e.target.value)}
                      style={{ fontSize: '0.8rem' }}
                    />
                  </div>
                )}
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px', marginTop: '12px', borderTop: '1px solid var(--border)', paddingTop: '14px' }}>
                <button type="button" onClick={() => setCreateModalOpen(false)} className="btn btn-secondary">
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={createSupplierMutation.isPending}
                  className="btn btn-primary"
                >
                  <Plus size={16} />
                  <span>{createSupplierMutation.isPending ? 'Registering...' : 'Register Supplier'}</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default Suppliers;
