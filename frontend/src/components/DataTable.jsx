import React, { useState, useMemo } from 'react';
import Spinner from './Spinner.jsx';
import EmptyState from './EmptyState.jsx';
import { Copy, Check } from 'lucide-react';

export const CopyableId = ({ id, linkTo, onClick }) => {
  const [copied, setCopied] = useState(false);

  const handleCopy = (e) => {
    e.stopPropagation();
    navigator.clipboard.writeText(id);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <span
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: '6px'
      }}
    >
      <span
        onClick={onClick}
        style={{
          fontFamily: 'var(--font-mono)',
          fontWeight: 600,
          fontSize: '0.825rem',
          color: 'var(--primary)',
          cursor: (linkTo || onClick) ? 'pointer' : 'default',
          textDecoration: 'none'
        }}
      >
        {id}
      </span>
      <button
        onClick={handleCopy}
        title="Copy ID"
        aria-label="Copy ID"
        style={{
          background: 'none',
          border: 'none',
          padding: '2px',
          cursor: 'pointer',
          color: copied ? 'var(--success)' : 'var(--text-subtle)',
          display: 'inline-flex',
          alignItems: 'center'
        }}
      >
        {copied ? <Check size={12} color="var(--success)" /> : <Copy size={12} />}
      </button>
    </span>
  );
};

export const DataTable = ({
  columns = [],
  data = [],
  loading = false,
  total = 0,
  page = 1,
  pageSize = 10,
  onPageChange,
  onRowClick,
  emptyIcon = '📋',
  emptyTitle = 'No data available',
  emptyDescription = 'There are no records matching the selected criteria.'
}) => {
  const [sortKey, setSortKey] = useState(null);
  const [sortOrder, setSortOrder] = useState('asc');

  const handleSort = (key) => {
    if (sortKey === key) {
      setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc');
    } else {
      setSortKey(key);
      setSortOrder('asc');
    }
  };

  const sortedData = useMemo(() => {
    if (!sortKey || !data) return data;
    return [...data].sort((a, b) => {
      let aVal = a[sortKey];
      let bVal = b[sortKey];

      if (typeof aVal === 'string') aVal = aVal.toLowerCase();
      if (typeof bVal === 'string') bVal = bVal.toLowerCase();

      if (aVal < bVal) return sortOrder === 'asc' ? -1 : 1;
      if (aVal > bVal) return sortOrder === 'asc' ? 1 : -1;
      return 0;
    });
  }, [data, sortKey, sortOrder]);

  const totalPages = Math.max(1, Math.ceil(total / pageSize));

  return (
    <div
      style={{
        backgroundColor: 'var(--bg-surface)',
        border: '1px solid var(--border)',
        borderRadius: 'var(--radius-lg)',
        boxShadow: 'var(--shadow-card)',
        overflow: 'hidden',
        display: 'flex',
        flexDirection: 'column'
      }}
    >
      <div style={{ overflowX: 'auto', width: '100%' }}>
        <table className="app-table">
          <thead>
            <tr>
              {columns.map((col) => {
                const isSorted = sortKey === col.key;
                const align = col.align || 'left';
                return (
                  <th
                    key={col.key || col.header}
                    onClick={() => col.sortable !== false && handleSort(col.key)}
                    style={{
                      cursor: col.sortable !== false ? 'pointer' : 'default',
                      textAlign: align,
                      userSelect: 'none',
                      whiteSpace: 'nowrap'
                    }}
                  >
                    <div
                      style={{
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: '6px',
                        justifyContent: align === 'right' ? 'flex-end' : align === 'center' ? 'center' : 'flex-start',
                        width: '100%'
                      }}
                    >
                      <span>{col.header}</span>
                      {col.sortable !== false && (
                        <span
                          style={{
                            opacity: isSorted ? 1 : 0.4,
                            fontSize: '0.75rem',
                            color: isSorted ? 'var(--primary)' : 'inherit'
                          }}
                        >
                          {isSorted ? (sortOrder === 'asc' ? '▲' : '▼') : '⇅'}
                        </span>
                      )}
                    </div>
                  </th>
                );
              })}
            </tr>
          </thead>

          <tbody>
            {loading ? (
              <tr>
                <td colSpan={columns.length} style={{ padding: '40px 0' }}>
                  <Spinner size="md" message="Loading records..." />
                </td>
              </tr>
            ) : sortedData.length === 0 ? (
              <tr>
                <td colSpan={columns.length} style={{ padding: '24px' }}>
                  <EmptyState
                    icon={emptyIcon}
                    title={emptyTitle}
                    description={emptyDescription}
                  />
                </td>
              </tr>
            ) : (
              sortedData.map((row, idx) => (
                <tr
                  key={row.id || row.pr_id || row.rfq_id || row.po_id || row.quote_id || row.approval_id || row.supplier_id || row.budget_id || row.exception_id || idx}
                  onClick={() => onRowClick && onRowClick(row)}
                  style={{
                    cursor: onRowClick ? 'pointer' : 'default'
                  }}
                >
                  {columns.map((col) => {
                    const align = col.align || 'left';
                    const isTabular = align === 'right' || col.tabular;
                    return (
                      <td
                        key={col.key || col.header}
                        style={{
                          textAlign: align,
                          fontVariantNumeric: isTabular ? 'tabular-nums' : 'normal'
                        }}
                      >
                        {col.render ? col.render(row) : row[col.key] !== undefined ? row[col.key] : '—'}
                      </td>
                    );
                  })}
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* Pagination Footer */}
      {total > 0 && onPageChange && (
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            padding: '12px 20px',
            borderTop: '1px solid var(--border)',
            backgroundColor: 'var(--bg-surface-subtle)',
            fontSize: '0.85rem',
            color: 'var(--text-muted)'
          }}
        >
          <div>
            Showing <strong style={{ color: 'var(--text-main)' }}>{Math.min((page - 1) * pageSize + 1, total)}</strong> to{' '}
            <strong style={{ color: 'var(--text-main)' }}>{Math.min(page * pageSize, total)}</strong> of{' '}
            <strong style={{ color: 'var(--text-main)' }}>{total}</strong> entries
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <button
              onClick={() => onPageChange(page - 1)}
              disabled={page <= 1 || loading}
              className="btn btn-secondary btn-sm"
            >
              Previous
            </button>
            <span style={{ padding: '0 6px', fontVariantNumeric: 'tabular-nums', fontWeight: 500 }}>
              Page {page} of {totalPages}
            </span>
            <button
              onClick={() => onPageChange(page + 1)}
              disabled={page >= totalPages || loading}
              className="btn btn-secondary btn-sm"
            >
              Next
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

export default DataTable;
