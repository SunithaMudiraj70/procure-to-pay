import React, { useState } from 'react';
import { Wallet, Search, Filter, AlertTriangle, ArrowRight, BookOpen, CheckCircle2 } from 'lucide-react';
import { useBudgetsQuery } from '../hooks/useBudgets.js';
import DataTable, { CopyableId } from '../components/DataTable.jsx';
import StatusChip from '../components/StatusChip.jsx';
import Drawer from '../components/Drawer.jsx';
import { formatCurrency, formatPercent } from '../lib/formatters.js';

export const Budgets = () => {
  const [search, setSearch] = useState('');
  const [selectedBudget, setSelectedBudget] = useState(null);
  const [ledgerDrawerOpen, setLedgerDrawerOpen] = useState(false);

  const { data: budgetResponse, isLoading, refetch } = useBudgetsQuery();
  const rawList = Array.isArray(budgetResponse)
    ? budgetResponse
    : Array.isArray(budgetResponse?.data)
    ? budgetResponse.data
    : Array.isArray(budgetResponse?.budgets)
    ? budgetResponse.budgets
    : [];

  const filteredList = rawList.filter((b) => {
    if (!search) return true;
    const term = search.toLowerCase();
    return (
      b.department_name?.toLowerCase().includes(term) ||
      b.budget_id?.toLowerCase().includes(term) ||
      b.cost_center?.toLowerCase().includes(term)
    );
  });

  const handleOpenLedger = (budget) => {
    setSelectedBudget(budget);
    setLedgerDrawerOpen(true);
  };

  const columns = [
    {
      key: 'department_name',
      header: 'Department & Cost Center',
      sortable: true,
      render: (row) => (
        <div>
          <div style={{ fontWeight: 600, color: 'var(--text-main)' }}>{row.department_name}</div>
          <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
            <span style={{ fontFamily: 'var(--font-mono)' }}>{row.budget_id}</span> • Cost Center: {row.cost_center || 'CC-01'}
          </div>
        </div>
      )
    },
    {
      key: 'allocated_amount',
      header: 'Allocated',
      align: 'right',
      tabular: true,
      sortable: true,
      render: (row) => (
        <span style={{ fontWeight: 600, color: 'var(--text-main)' }}>
          {formatCurrency(row.allocated_amount, row.currency_code)}
        </span>
      )
    },
    {
      key: 'reserved_open',
      header: 'Reserved (PR)',
      align: 'right',
      tabular: true,
      sortable: true,
      render: (row) => (
        <span style={{ color: 'var(--warning)', fontWeight: 600 }}>
          {formatCurrency(row.reserved_open || 0, row.currency_code)}
        </span>
      )
    },
    {
      key: 'committed',
      header: 'Committed (PO)',
      align: 'right',
      tabular: true,
      sortable: true,
      render: (row) => (
        <span style={{ color: 'var(--primary)', fontWeight: 600 }}>
          {formatCurrency(row.committed || 0, row.currency_code)}
        </span>
      )
    },
    {
      key: 'available_amount',
      header: 'Available',
      align: 'right',
      tabular: true,
      sortable: true,
      render: (row) => {
        const avail = Number(row.available_amount || 0);
        const isOver = avail < 0;

        return (
          <span
            style={{
              fontWeight: 800,
              color: isOver ? 'var(--danger)' : 'var(--success)'
            }}
          >
            {formatCurrency(avail, row.currency_code)}
          </span>
        );
      }
    },
    {
      key: 'status',
      header: 'Status',
      align: 'center',
      render: (row) => {
        const avail = Number(row.available_amount || 0);
        if (avail < 0) {
          return (
            <span className="badge badge-danger">
              <AlertTriangle size={12} />
              <span>Overrun</span>
            </span>
          );
        }
        return <StatusChip status="ok" label="Within Budget" />;
      }
    },
    {
      key: 'actions',
      header: 'Ledger',
      align: 'right',
      render: (row) => (
        <button
          onClick={(e) => {
            e.stopPropagation();
            handleOpenLedger(row);
          }}
          className="btn btn-secondary btn-sm"
        >
          <BookOpen size={14} />
          <span>Ledger</span>
        </button>
      )
    }
  ];

  return (
    <div>
      {/* Top Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '24px' }}>
        <div>
          <h2 style={{ fontSize: '1.5rem', fontWeight: 700, margin: 0 }}>Department Budgets & Commitments</h2>
          <p style={{ fontSize: '0.875rem', color: 'var(--text-muted)', margin: '4px 0 0' }}>
            Real-time financial ledgers tracking allocated, reserved, and committed purchase funds
          </p>
        </div>
      </div>

      {/* Per-Department Highlight Cards */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: '16px', marginBottom: '28px' }}>
        {filteredList.slice(0, 4).map((b) => {
          const allocated = Number(b.allocated_amount || 1);
          const committed = Number(b.committed || 0);
          const reserved = Number(b.reserved_open || 0);
          const available = Number(b.available_amount || 0);
          const used = committed + reserved;
          const pct = Math.min(100, Math.round((used / allocated) * 100));
          const isOverrun = available < 0 || pct > 95;

          return (
            <div
              key={b.budget_id}
              className="card"
              style={{
                border: isOverrun ? '2px solid var(--danger-border)' : '1px solid var(--border)',
                backgroundColor: isOverrun ? '#FFF5F5' : 'var(--bg-surface)'
              }}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '8px' }}>
                <span style={{ fontWeight: 700, fontSize: '0.95rem' }}>{b.department_name}</span>
                {isOverrun && (
                  <span className="badge badge-danger">
                    <AlertTriangle size={12} /> Overrun
                  </span>
                )}
              </div>

              <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginBottom: '12px' }}>
                FY {b.fiscal_year || 2026} • {b.budget_id}
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '8px', fontSize: '0.8rem', marginBottom: '14px' }}>
                <div>
                  <div style={{ color: 'var(--text-muted)' }}>Allocated:</div>
                  <strong className="tabular-nums">{formatCurrency(allocated)}</strong>
                </div>
                <div>
                  <div style={{ color: 'var(--text-muted)' }}>Available:</div>
                  <strong className="tabular-nums" style={{ color: available < 0 ? 'var(--danger)' : 'var(--success)' }}>
                    {formatCurrency(available)}
                  </strong>
                </div>
              </div>

              {/* Utilisation Bar */}
              <div style={{ height: '6px', backgroundColor: 'var(--bg-surface-subtle)', borderRadius: '9999px', overflow: 'hidden' }}>
                <div
                  style={{
                    height: '100%',
                    width: `${pct}%`,
                    backgroundColor: isOverrun ? 'var(--danger)' : pct > 80 ? 'var(--warning)' : 'var(--primary)',
                    borderRadius: '9999px'
                  }}
                />
              </div>
            </div>
          );
        })}
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
        <div style={{ position: 'relative', width: '100%', maxWidth: '300px' }}>
          <Search size={16} style={{ position: 'absolute', left: '10px', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
          <input
            type="text"
            className="form-input"
            placeholder="Search department or budget code..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            style={{ paddingLeft: '32px', height: '36px' }}
          />
        </div>
      </div>

      {/* DataTable */}
      <DataTable
        columns={columns}
        data={filteredList}
        loading={isLoading}
        total={filteredList.length}
        onRowClick={handleOpenLedger}
        emptyTitle="No department budgets found"
        emptyDescription="Department budgets will appear here once allocated."
      />

      {/* LEDGER DRAWER */}
      {selectedBudget && (
        <Drawer
          isOpen={ledgerDrawerOpen}
          onClose={() => setLedgerDrawerOpen(false)}
          title={`Budget Ledger: ${selectedBudget.department_name}`}
          width="520px"
        >
          <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
              <span className="id-badge">{selectedBudget.budget_id}</span>
              <span className="badge badge-primary">FY {selectedBudget.fiscal_year}</span>
            </div>

            {/* Arithmetic Breakdown */}
            <div style={{ backgroundColor: 'var(--bg-surface-subtle)', padding: '16px', borderRadius: 'var(--radius-md)', display: 'flex', flexDirection: 'column', gap: '10px', fontSize: '0.85rem' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span style={{ color: 'var(--text-muted)' }}>Initial Allocated Budget:</span>
                <span className="tabular-nums" style={{ fontWeight: 600 }}>{formatCurrency(selectedBudget.allocated_amount)}</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span style={{ color: 'var(--text-muted)' }}>Budget Adjustments:</span>
                <span className="tabular-nums" style={{ fontWeight: 600 }}>{formatCurrency(selectedBudget.adjustments || 0)}</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span style={{ color: 'var(--warning)' }}>- Reserved Requisitions (PR):</span>
                <span className="tabular-nums" style={{ fontWeight: 600, color: 'var(--warning)' }}>
                  ({formatCurrency(selectedBudget.reserved_open || 0)})
                </span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span style={{ color: 'var(--primary)' }}>- Committed Orders (PO):</span>
                <span className="tabular-nums" style={{ fontWeight: 600, color: 'var(--primary)' }}>
                  ({formatCurrency(selectedBudget.committed || 0)})
                </span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', borderTop: '2px solid var(--border)', paddingTop: '8px' }}>
                <span style={{ fontWeight: 700 }}>= Net Available Funds:</span>
                <span
                  className="tabular-nums"
                  style={{
                    fontWeight: 800,
                    fontSize: '1.1rem',
                    color: Number(selectedBudget.available_amount) < 0 ? 'var(--danger)' : 'var(--success)'
                  }}
                >
                  {formatCurrency(selectedBudget.available_amount)}
                </span>
              </div>
            </div>

            {Number(selectedBudget.available_amount) < 0 && (
              <div className="alert alert-error">
                <AlertTriangle size={18} style={{ flexShrink: 0 }} />
                <div style={{ fontSize: '0.8rem' }}>
                  <strong>Budget Deficit:</strong> This cost center has exceeded its authorized allocation. Requisitions submitted against this department will trigger mandatory executive override approval.
                </div>
              </div>
            )}

            <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '16px' }}>
              <button onClick={() => setLedgerDrawerOpen(false)} className="btn btn-secondary">
                Close Ledger
              </button>
            </div>
          </div>
        </Drawer>
      )}
    </div>
  );
};

export default Budgets;
