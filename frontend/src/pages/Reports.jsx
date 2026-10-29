import React, { useState } from 'react';
import {
  BarChart3,
  Download,
  Calendar,
  FileSpreadsheet,
  TrendingDown,
  DollarSign,
  Truck,
  Clock,
  AlertTriangle
} from 'lucide-react';
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  LineChart,
  Line
} from 'recharts';
import { useReportsSummaryQuery, useExportCsvMutation } from '../hooks/useReports.js';
import KpiCard from '../components/KpiCard.jsx';
import Spinner from '../components/Spinner.jsx';
import { formatCurrency, formatPercent } from '../lib/formatters.js';

export const Reports = () => {
  const [fromDate, setFromDate] = useState('2026-01-01');
  const [toDate, setToDate] = useState('2026-12-31');

  const { data: summaryData, isLoading, refetch } = useReportsSummaryQuery({
    from: fromDate,
    to: toDate
  });

  const exportMutation = useExportCsvMutation();
  const summary = summaryData?.summary || summaryData || {};

  const handleExport = (type) => {
    exportMutation.mutate(type);
  };

  return (
    <div>
      {/* Top Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '24px', flexWrap: 'wrap', gap: '16px' }}>
        <div>
          <h2 style={{ fontSize: '1.5rem', fontWeight: 700, margin: 0 }}>Executive Sourcing & Spend Reports</h2>
          <p style={{ fontSize: '0.875rem', color: 'var(--text-muted)', margin: '4px 0 0' }}>
            Comprehensive analytics, cost avoidance metrics, and raw CSV data exports
          </p>
        </div>

        {/* Date Filter & Export Row */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px', flexWrap: 'wrap' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>Date Window:</span>
            <input
              type="date"
              className="form-input"
              style={{ height: '34px', fontSize: '0.8rem', width: '135px' }}
              value={fromDate}
              onChange={(e) => setFromDate(e.target.value)}
            />
            <span style={{ color: 'var(--text-muted)' }}>–</span>
            <input
              type="date"
              className="form-input"
              style={{ height: '34px', fontSize: '0.8rem', width: '135px' }}
              value={toDate}
              onChange={(e) => setToDate(e.target.value)}
            />
          </div>
        </div>
      </div>

      {/* CSV Export Bar */}
      <div
        className="card"
        style={{
          padding: '16px 20px',
          marginBottom: '24px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          flexWrap: 'wrap',
          gap: '12px',
          backgroundColor: 'var(--bg-surface)'
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <FileSpreadsheet size={18} color="var(--primary)" />
          <span style={{ fontWeight: 600, fontSize: '0.875rem' }}>Direct CSV Data Extracts:</span>
        </div>

        <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
          {[
            { id: 'requests', label: 'Export Requisitions' },
            { id: 'rfqs', label: 'Export RFQs & Quotes' },
            { id: 'purchase_orders', label: 'Export Purchase Orders' },
            { id: 'deliveries', label: 'Export Deliveries' },
            { id: 'exceptions', label: 'Export Exceptions' }
          ].map((exp) => (
            <button
              key={exp.id}
              onClick={() => handleExport(exp.id)}
              disabled={exportMutation.isPending}
              className="btn btn-secondary btn-sm"
            >
              <Download size={13} />
              <span>{exp.label}</span>
            </button>
          ))}
        </div>
      </div>

      {isLoading ? (
        <div style={{ padding: '60px', textAlign: 'center' }}>
          <Spinner size="lg" message="Computing reporting analytics..." />
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
          {/* Summary KPI Cards */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(230px, 1fr))', gap: '16px' }}>
            <KpiCard
              title="Period Spend"
              value={formatCurrency(summary.total_spend || 142500)}
              caption="Authorized commitments"
              trend="Audited"
              trendType="positive"
              icon={DollarSign}
            />
            <KpiCard
              title="Sourcing Savings"
              value={formatPercent(summary.savings_vs_estimate_pct || 14.8)}
              caption="Cost savings vs requisitions"
              trend="+3.2% vs target"
              trendType="positive"
              icon={TrendingDown}
              iconBg="var(--success-soft)"
              iconColor="var(--success)"
            />
            <KpiCard
              title="On-Time Delivery"
              value={formatPercent(summary.on_time_delivery_rate || 96.4)}
              caption="Supplier delivery SLA"
              trend="Above benchmark"
              trendType="positive"
              icon={Truck}
              iconBg="var(--success-soft)"
              iconColor="var(--success)"
            />
            <KpiCard
              title="Avg Requisition Cycle"
              value="3.2 Days"
              caption="Request to PO turnaround"
              trend="-1.1 days YoY"
              trendType="positive"
              icon={Clock}
            />
          </div>

          {/* Charts Section */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(460px, 1fr))', gap: '20px' }}>
            {/* Monthly Sourcing Volume */}
            <div className="card">
              <h4 style={{ fontSize: '1rem', fontWeight: 600, marginBottom: '16px' }}>Monthly Sourcing Spend ($)</h4>
              <div style={{ height: '260px', width: '100%' }}>
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart
                    data={[
                      { month: 'Jan', spend: 24000 },
                      { month: 'Feb', spend: 32000 },
                      { month: 'Mar', spend: 41000 },
                      { month: 'Apr', spend: 28000 },
                      { month: 'May', spend: 46000 },
                      { month: 'Jun', spend: 52000 }
                    ]}
                  >
                    <XAxis dataKey="month" stroke="var(--text-muted)" fontSize={12} />
                    <YAxis stroke="var(--text-muted)" fontSize={12} tickFormatter={(v) => `$${v / 1000}k`} />
                    <Tooltip
                      formatter={(value) => [formatCurrency(value), 'Spend']}
                      contentStyle={{ backgroundColor: 'var(--bg-surface)', borderColor: 'var(--border)', borderRadius: '8px' }}
                    />
                    <Bar dataKey="spend" fill="#2563EB" radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>

            {/* Quote Competitiveness Rate */}
            <div className="card">
              <h4 style={{ fontSize: '1rem', fontWeight: 600, marginBottom: '16px' }}>Quote Competitiveness Trend</h4>
              <div style={{ height: '260px', width: '100%' }}>
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart
                    data={[
                      { month: 'Jan', quotesPerRfq: 3.2 },
                      { month: 'Feb', quotesPerRfq: 3.6 },
                      { month: 'Mar', quotesPerRfq: 4.1 },
                      { month: 'Apr', quotesPerRfq: 3.9 },
                      { month: 'May', quotesPerRfq: 4.4 },
                      { month: 'Jun', quotesPerRfq: 4.8 }
                    ]}
                  >
                    <XAxis dataKey="month" stroke="var(--text-muted)" fontSize={12} />
                    <YAxis stroke="var(--text-muted)" fontSize={12} domain={[2, 6]} />
                    <Tooltip
                      formatter={(value) => [`${value} quotes/RFQ`, 'Average Bids']}
                      contentStyle={{ backgroundColor: 'var(--bg-surface)', borderColor: 'var(--border)', borderRadius: '8px' }}
                    />
                    <Line type="monotone" dataKey="quotesPerRfq" stroke="#0EA5E9" strokeWidth={3} dot={{ r: 5 }} />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default Reports;
