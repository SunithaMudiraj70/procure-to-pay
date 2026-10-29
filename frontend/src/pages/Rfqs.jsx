import React, { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { Scale, Plus, Search, Filter, AlertTriangle, ArrowRight, X } from 'lucide-react';
import { useRfqsQuery } from '../hooks/useRfqs.js';
import { useRequestsQuery, useCreateRfqMutation } from '../hooks/useRequests.js';
import { useSuppliersQuery } from '../hooks/useSuppliers.js';
import { useLookupsQuery } from '../hooks/useLookups.js';
import { useSessionStore } from '../store/useSessionStore.js';
import DataTable, { CopyableId } from '../components/DataTable.jsx';
import StatusChip from '../components/StatusChip.jsx';
import Spinner from '../components/Spinner.jsx';
import { formatDate, formatCurrency } from '../lib/formatters.js';

export const Rfqs = () => {
  const navigate = useNavigate();
  const currentUser = useSessionStore((state) => state.currentUser);
  const userRole = currentUser?.role;

  const [statusFilter, setStatusFilter] = useState('');
  const [page, setPage] = useState(1);
  const pageSize = 10;

  // Create RFQ Modal
  const [modalOpen, setModalOpen] = useState(false);
  const [selectedPrId, setSelectedPrId] = useState('');
  const [selectedSuppliers, setSelectedSuppliers] = useState([]);
  const [supplierFilterQuery, setSupplierFilterQuery] = useState('');
  const [closingDate, setClosingDate] = useState(
    new Date(Date.now() + 14 * 24 * 60 * 60 * 1000).toISOString().split('T')[0]
  );
  const [formError, setFormError] = useState(null);

  // Queries
  const { data: rfqResponse, isLoading, refetch } = useRfqsQuery({
    status: statusFilter || undefined,
    page,
    pageSize
  });

  const { data: lookupsData, isLoading: loadingLookups } = useLookupsQuery();
  const { data: requestsData, isLoading: loadingRequests } = useRequestsQuery({ status: 'approved', pageSize: 100, all: true });
  const { data: suppliersData, isLoading: loadingSuppliers } = useSuppliersQuery({ status: 'active', pageSize: 100 });

  const createRfqMutation = useCreateRfqMutation();

  const rfqList = Array.isArray(rfqResponse) ? rfqResponse : (rfqResponse?.data || []);
  const total = rfqResponse?.total || rfqList.length;

  const allReqs = Array.isArray(requestsData) ? requestsData : (requestsData?.data || []);
  const approvedRequests = allReqs.filter((r) => r.status === 'approved');

  // Combine lookups suppliers and suppliers data
  const rawSuppliers = (lookupsData?.suppliers && lookupsData.suppliers.length > 0)
    ? lookupsData.suppliers
    : (Array.isArray(suppliersData) ? suppliersData : suppliersData?.data || []);

  const suppliers = rawSuppliers.filter((s) => {
    if (!supplierFilterQuery) return true;
    const q = supplierFilterQuery.toLowerCase();
    const cats = Array.isArray(s.categories) ? s.categories.join(' ') : (s.category || '');
    return (
      (s.name && s.name.toLowerCase().includes(q)) ||
      (s.supplier_code && s.supplier_code.toLowerCase().includes(q)) ||
      cats.toLowerCase().includes(q)
    );
  });

  const handleToggleSupplier = (id) => {
    if (selectedSuppliers.includes(id)) {
      setSelectedSuppliers(selectedSuppliers.filter((s) => s !== id));
    } else {
      setSelectedSuppliers([...selectedSuppliers, id]);
    }
  };

  const handleCreateRfqSubmit = async (e) => {
    e.preventDefault();
    setFormError(null);

    if (!selectedPrId) {
      setFormError('Please select an approved purchase request.');
      return;
    }

    if (selectedSuppliers.length < 3) {
      setFormError('Procurement policy requires selecting at least 3 active suppliers.');
      return;
    }

    try {
      const res = await createRfqMutation.mutateAsync({
        prId: selectedPrId,
        body: {
          closing_date: closingDate,
          supplier_ids: selectedSuppliers
        }
      });
      setModalOpen(false);
      navigate(`/rfqs/${res.rfq_id}`);
    } catch (err) {
      setFormError(err.message || 'Failed to issue RFQ.');
    }
  };

  const columns = [
    {
      key: 'rfq_id',
      header: 'RFQ ID',
      sortable: true,
      render: (row) => (
        <CopyableId
          id={row.rfq_id}
          linkTo={`/rfqs/${row.rfq_id}`}
          onClick={(e) => {
            e.stopPropagation();
            navigate(`/rfqs/${row.rfq_id}`);
          }}
        />
      )
    },
    {
      key: 'pr_title',
      header: 'Purchase Requisition',
      sortable: true,
      render: (row) => (
        <div>
          <div style={{ fontWeight: 600, color: 'var(--text-main)' }}>{row.pr_title || row.title || 'Requisition'}</div>
          <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
            Requisition ID: <span style={{ fontFamily: 'var(--font-mono)' }}>{row.pr_id}</span>
          </div>
        </div>
      )
    },
    {
      key: 'issue_date',
      header: 'Issue Date',
      sortable: true,
      render: (row) => (
        <span className="date-num" style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
          {formatDate(row.issue_date || row.created_at)}
        </span>
      )
    },
    {
      key: 'closing_date',
      header: 'Closing Date',
      sortable: true,
      render: (row) => (
        <span className="date-num" style={{ fontSize: '0.8rem', fontWeight: 500 }}>
          {formatDate(row.closing_date)}
        </span>
      )
    },
    {
      key: 'quote_count',
      header: 'Quotes / Min',
      align: 'center',
      render: (row) => {
        const count = row.quote_count || row.quotes_count || 0;
        const min = row.min_quotes_required || 3;
        const isSufficient = count >= min;

        return (
          <span
            className={`badge ${isSufficient ? 'badge-success' : 'badge-warning'}`}
            style={{ fontVariantNumeric: 'tabular-nums' }}
          >
            {count} / {min}
          </span>
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

  // Allow all users to initiate competitive RFQs
  const canCreateRfq = true;

  return (
    <div>
      {/* Top Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '24px' }}>
        <div>
          <h2 style={{ fontSize: '1.5rem', fontWeight: 700, margin: 0 }}>RFQs & Quote Comparison</h2>
          <p style={{ fontSize: '0.875rem', color: 'var(--text-muted)', margin: '4px 0 0' }}>
            Invite suppliers, evaluate competitive landed cost quotes, and award contracts
          </p>
        </div>

        <button
          onClick={() => {
            setSelectedPrId(approvedRequests[0]?.pr_id || '');
            setFormError(null);
            setModalOpen(true);
          }}
          disabled={!canCreateRfq}
          className="btn btn-primary"
          title={!canCreateRfq ? 'Only a Procurement Lead can create an RFQ' : undefined}
        >
          <Plus size={16} />
          <span>Create RFQ</span>
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
          gap: '16px'
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <Filter size={16} color="var(--text-muted)" />
          <span style={{ fontSize: '0.875rem', fontWeight: 600 }}>Filter by Status:</span>
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
          <option value="">All RFQ Statuses</option>
          <option value="issued">Issued (Awaiting Quotes)</option>
          <option value="quotes_received">Quotes Received</option>
          <option value="evaluated">Evaluated</option>
          <option value="awarded">Awarded</option>
          <option value="po_issued">PO Issued</option>
          <option value="closed">Closed / Cancelled</option>
        </select>
      </div>

      {/* RFQ DataTable */}
      <DataTable
        columns={columns}
        data={rfqList}
        loading={isLoading}
        total={total}
        page={page}
        pageSize={pageSize}
        onPageChange={setPage}
        onRowClick={(row) => navigate(`/rfqs/${row.rfq_id}`)}
        emptyTitle="No RFQs found"
        emptyDescription="Create a competitive RFQ from an approved requisition to solicit supplier quotes."
      />

      {/* CREATE RFQ MODAL */}
      {modalOpen && (
        <div className="modal-backdrop" onClick={() => setModalOpen(false)}>
          <div className="modal-box" onClick={(e) => e.stopPropagation()} style={{ maxWidth: '640px', width: '92%' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px', borderBottom: '1px solid var(--border)', paddingBottom: '12px' }}>
              <div>
                <h3 style={{ margin: 0, fontSize: '1.15rem' }}>Create Competitive RFQ</h3>
                <p style={{ margin: '4px 0 0', fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                  Solicit bids for an approved purchase requisition
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

            <form onSubmit={handleCreateRfqSubmit}>
              <div className="form-group">
                <label className="form-label">Approved Purchase Requisition *</label>
                {loadingRequests ? (
                  <div style={{ padding: '12px', textAlign: 'center' }}>
                    <Spinner size="sm" message="Loading approved requisitions..." />
                  </div>
                ) : approvedRequests.length === 0 ? (
                  <div style={{ padding: '12px', backgroundColor: 'var(--warning-soft)', border: '1px solid var(--warning-border)', borderRadius: 'var(--radius-sm)', fontSize: '0.825rem', color: 'var(--warning)' }}>
                    <div>No unassigned approved requisitions available.</div>
                    <div style={{ marginTop: '4px', fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                      Requisitions must be approved before issuing a competitive RFQ.
                    </div>
                  </div>
                ) : (
                  <select
                    className="form-select"
                    value={selectedPrId}
                    onChange={(e) => setSelectedPrId(e.target.value)}
                    required
                  >
                    <option value="">Choose requisition to solicit quotes for...</option>
                    {approvedRequests.map((r) => (
                      <option key={r.pr_id} value={r.pr_id}>
                        {r.pr_id} - {r.title} ({formatCurrency(r.estimated_total)})
                      </option>
                    ))}
                  </select>
                )}
              </div>

              <div className="form-group">
                <label className="form-label">Submission Closing Date *</label>
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
                    Select Suppliers ({selectedSuppliers.length} selected / min 3 required) *
                  </label>
                  <div style={{ display: 'flex', gap: '8px' }}>
                    <button
                      type="button"
                      onClick={() => {
                        const compliant = suppliers.filter(s => !s.risk_flag);
                        const top3 = (compliant.length >= 3 ? compliant : suppliers).slice(0, 3).map(s => s.supplier_id);
                        setSelectedSuppliers(top3);
                      }}
                      className="btn btn-secondary btn-sm"
                      style={{ fontSize: '0.725rem', padding: '2px 8px' }}
                    >
                      Select First 3
                    </button>
                    {selectedSuppliers.length > 0 && (
                      <button
                        type="button"
                        onClick={() => setSelectedSuppliers([])}
                        className="btn btn-secondary btn-sm"
                        style={{ fontSize: '0.725rem', padding: '2px 8px' }}
                      >
                        Clear
                      </button>
                    )}
                  </div>
                </div>

                <div style={{ marginBottom: '8px' }}>
                  <input
                    type="text"
                    className="form-input"
                    placeholder="Search suppliers by name, code or category..."
                    value={supplierFilterQuery}
                    onChange={(e) => setSupplierFilterQuery(e.target.value)}
                    style={{ height: '34px', fontSize: '0.8rem', padding: '4px 10px' }}
                  />
                </div>

                <div style={{ maxHeight: '220px', minHeight: '120px', overflowY: 'auto', border: '1px solid var(--border)', borderRadius: 'var(--radius-md)', padding: '6px', backgroundColor: 'var(--bg-surface)' }}>
                  {(loadingLookups && rawSuppliers.length === 0) ? (
                    <div style={{ padding: '20px', textAlign: 'center' }}>
                      <Spinner size="sm" message="Loading accredited suppliers..." />
                    </div>
                  ) : suppliers.length === 0 ? (
                    <div style={{ padding: '24px 16px', textAlign: 'center', color: 'var(--text-muted)', fontSize: '0.825rem' }}>
                      <div>No accredited suppliers found matching your query.</div>
                      <Link
                        to="/suppliers"
                        onClick={() => setModalOpen(false)}
                        className="btn btn-secondary btn-sm"
                        style={{ marginTop: '10px', display: 'inline-flex' }}
                      >
                        <Plus size={14} /> Onboard New Supplier
                      </Link>
                    </div>
                  ) : (
                    suppliers.map((s) => {
                      const isSelected = selectedSuppliers.includes(s.supplier_id);
                      const isRisk = s.risk_flag || s.risk_level === 'high' || s.risk_level === 'critical';
                      const categoriesStr = Array.isArray(s.categories)
                        ? s.categories.join(', ')
                        : (s.category || 'General');

                      return (
                        <div
                          key={s.supplier_id}
                          onClick={() => handleToggleSupplier(s.supplier_id)}
                          style={{
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'space-between',
                            padding: '8px 10px',
                            borderRadius: 'var(--radius-sm)',
                            backgroundColor: isSelected ? 'var(--primary-soft)' : 'transparent',
                            border: isSelected ? '1px solid var(--primary)' : '1px solid transparent',
                            cursor: 'pointer',
                            marginBottom: '4px',
                            transition: 'all 0.15s ease'
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
                              <div style={{ fontSize: '0.85rem', fontWeight: 600, color: 'var(--text-main)' }}>
                                {s.name}
                              </div>
                              <div style={{ fontSize: '0.725rem', color: 'var(--text-muted)' }}>
                                <span style={{ fontFamily: 'var(--font-mono)' }}>{s.supplier_code}</span> • {categoriesStr} • {s.country_code || 'US'}
                              </div>
                            </div>
                          </div>

                          {isRisk ? (
                            <span className="badge badge-warning" style={{ fontSize: '0.7rem' }}>
                              <AlertTriangle size={12} />
                              <span>Risk Flag</span>
                            </span>
                          ) : (
                            <span className="badge badge-secondary" style={{ fontSize: '0.65rem' }}>
                              Tier: {s.risk_level || 'low'}
                            </span>
                          )}
                        </div>
                      );
                    })
                  )}
                </div>
              </div>

              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '20px', borderTop: '1px solid var(--border)', paddingTop: '16px' }}>
                <Link
                  to="/suppliers"
                  onClick={() => setModalOpen(false)}
                  style={{ fontSize: '0.8rem', color: 'var(--primary)', textDecoration: 'none', display: 'flex', alignItems: 'center', gap: '4px' }}
                >
                  <Plus size={14} /> Add new supplier
                </Link>

                <div style={{ display: 'flex', gap: '10px' }}>
                  <button type="button" onClick={() => setModalOpen(false)} className="btn btn-secondary">
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={!selectedPrId || selectedSuppliers.length < 3 || createRfqMutation.isPending}
                    className="btn btn-primary"
                  >
                    <Scale size={16} />
                    <span>{createRfqMutation.isPending ? 'Issuing...' : 'Issue RFQ'}</span>
                  </button>
                </div>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default Rfqs;
