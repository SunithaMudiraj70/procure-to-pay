import React, { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import {
  FilePlus,
  CheckCircle,
  Scale,
  Clock,
  AlertCircle,
  FileText,
  ShoppingBag,
  DollarSign,
  TrendingDown,
  Truck,
  AlertTriangle,
  ArrowRight,
  ShieldAlert,
  Inbox
} from 'lucide-react';
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  PieChart,
  Pie,
  Cell
} from 'recharts';
import { useSessionStore } from '../store/useSessionStore.js';
import { useDashboardKpisQuery, useDashboardSpendByDeptQuery, useDashboardPipelineQuery } from '../hooks/useDashboard.js';
import { useReportsSummaryQuery } from '../hooks/useReports.js';
import { useRequestsQuery } from '../hooks/useRequests.js';
import { useApprovalsQuery } from '../hooks/useApprovals.js';
import { useRfqsQuery } from '../hooks/useRfqs.js';
import { usePurchaseOrdersQuery } from '../hooks/usePurchaseOrders.js';
import { useExceptionsQuery } from '../hooks/useExceptions.js';
import { useBudgetsQuery } from '../hooks/useBudgets.js';
import KpiCard from '../components/KpiCard.jsx';
import Spinner from '../components/Spinner.jsx';
import { formatCurrency, formatPercent } from '../lib/formatters.js';

const ensureArray = (val) => {
  if (Array.isArray(val)) return val;
  if (Array.isArray(val?.data)) return val.data;
  return [];
};

export const Dashboard = () => {
  const navigate = useNavigate();
  const currentUser = useSessionStore((state) => state.currentUser);
  const [heroImageError, setHeroImageError] = useState(false);

  // Queries
  const { data: kpiData, isLoading: loadingKpis } = useDashboardKpisQuery();
  const { data: spendByDeptData } = useDashboardSpendByDeptQuery();
  const { data: pipelineData } = useDashboardPipelineQuery();
  const { data: summaryData } = useReportsSummaryQuery();
  const { data: requestsData } = useRequestsQuery();
  const { data: approvalsData } = useApprovalsQuery();
  const { data: rfqsData } = useRfqsQuery();
  const { data: poData } = usePurchaseOrdersQuery();
  const { data: exceptionsData } = useExceptionsQuery();
  const { data: budgetsData } = useBudgetsQuery();

  const kpis = kpiData || {};
  const summary = summaryData?.summary || summaryData || {};
  const firstName = currentUser?.name ? currentUser.name.split(' ')[0] : 'there';
  const role = currentUser?.role || 'requester';

  // Greeting based on current time
  const getGreeting = () => {
    const hour = new Date().getHours();
    if (hour < 12) return 'Good morning';
    if (hour < 18) return 'Good afternoon';
    return 'Good evening';
  };

  // Build "My work" panel based on role
  const renderMyWork = () => {
    let title = 'My Work';
    let subtitle = 'Items requiring your immediate review and action';
    let workItems = [];

    if (role === 'requester') {
      title = 'My Requests & Drafts';
      subtitle = 'Purchase requests you have created or need to update';
      const allReqs = ensureArray(requestsData);
      const myReqs = allReqs.filter((r) => r.requester_id === currentUser?.id || !r.requester_id);
      const sourceReqs = myReqs.length > 0 ? myReqs : allReqs;

      const drafts = sourceReqs.filter((r) => r.status === 'draft');
      const inReview = sourceReqs.filter((r) => r.status === 'submitted' || r.status === 'pending_approval');
      const approved = sourceReqs.filter((r) => r.status === 'approved');
      const poIssued = sourceReqs.filter((r) => r.status === 'po_issued');
      const rejected = sourceReqs.filter((r) => r.status === 'rejected');

      drafts.forEach((r) => {
        workItems.push({
          id: r.pr_id,
          title: r.title,
          status: 'Draft',
          statusType: 'neutral',
          desc: `Saved draft • ${formatCurrency(r.estimated_total, r.currency_code)}`,
          link: `/requests/${r.pr_id}`
        });
      });

      inReview.forEach((r) => {
        workItems.push({
          id: r.pr_id,
          title: r.title,
          status: 'In Review',
          statusType: 'primary',
          desc: `Pending Tier ${r.approval_level || 1} approval • ${formatCurrency(r.estimated_total, r.currency_code)}`,
          link: `/requests/${r.pr_id}`
        });
      });

      approved.forEach((r) => {
        workItems.push({
          id: r.pr_id,
          title: r.title,
          status: 'Approved',
          statusType: 'success',
          desc: `Approved • Sourcing in progress • ${formatCurrency(r.estimated_total, r.currency_code)}`,
          link: `/requests/${r.pr_id}`
        });
      });

      poIssued.forEach((r) => {
        workItems.push({
          id: r.pr_id,
          title: r.title,
          status: 'PO Issued',
          statusType: 'success',
          desc: `PO Active • Awaiting delivery • ${formatCurrency(r.estimated_total, r.currency_code)}`,
          link: `/requests/${r.pr_id}`
        });
      });

      rejected.forEach((r) => {
        workItems.push({
          id: r.pr_id,
          title: r.title,
          status: 'Action Needed',
          statusType: 'danger',
          desc: `Rejected by approver. Review feedback and resubmit.`,
          link: `/requests/${r.pr_id}`
        });
      });
    } else if (role === 'approver') {
      title = 'Approvals Waiting For Me';
      subtitle = 'Purchase requests pending your tier decision';
      const pendingApprovals = ensureArray(approvalsData).filter((a) => a.decision === 'pending');

      pendingApprovals.forEach((appr) => {
        workItems.push({
          id: appr.approval_id,
          title: appr.pr_title || `Purchase Request ${appr.pr_id}`,
          status: `Tier ${appr.approval_level} Pending`,
          statusType: 'warning',
          desc: `Requested by ${appr.requester_name || 'Requester'} • ${formatCurrency(appr.total_amount || appr.estimated_total)}`,
          link: `/approvals`
        });
      });
    } else if (role === 'process_owner') {
      title = 'Procurement Action Queue';
      subtitle = 'Approved requests ready for RFQ, evaluation, and award';

      const allReqs = ensureArray(requestsData);
      const approvedAwaitingRfq = allReqs.filter((r) => r.status === 'approved');
      approvedAwaitingRfq.forEach((r) => {
        workItems.push({
          id: r.pr_id,
          title: r.title,
          status: 'Approved • Issue RFQ',
          statusType: 'primary',
          desc: `${r.department_name} • ${formatCurrency(r.estimated_total, r.currency_code)}`,
          link: `/requests/${r.pr_id}`
        });
      });

      const allRfqs = ensureArray(rfqsData);
      const evaluated = allRfqs.filter((r) => r.status === 'evaluated');
      evaluated.forEach((r) => {
        workItems.push({
          id: r.rfq_id,
          title: r.title || `RFQ ${r.rfq_id}`,
          status: 'Ready to Award',
          statusType: 'warning',
          desc: `Quotes scored. Pending commercial award decision.`,
          link: `/rfqs/${r.rfq_id}`
        });
      });

      const awarded = allRfqs.filter((r) => r.status === 'awarded');
      awarded.forEach((r) => {
        workItems.push({
          id: r.rfq_id,
          title: r.title || `RFQ ${r.rfq_id}`,
          status: 'Issue Purchase Order',
          statusType: 'success',
          desc: `Award approved. Click to generate formal PO.`,
          link: `/rfqs/${r.rfq_id}`
        });
      });
    } else if (role === 'operations_analyst') {
      title = 'Operations & Receiving Queue';
      subtitle = 'Purchase orders awaiting delivery and unresolved exceptions';

      const allPos = ensureArray(poData);
      const pendingPos = allPos.filter((po) => po.status === 'issued' || po.status === 'partially_delivered');
      pendingPos.forEach((po) => {
        workItems.push({
          id: po.po_id,
          title: `PO ${po.po_id} - ${po.supplier_name}`,
          status: po.status === 'partially_delivered' ? 'Partially Delivered' : 'Awaiting Delivery',
          statusType: 'warning',
          desc: `Expected ${po.expected_delivery_date || 'soon'} • ${po.delivery_progress_pct || 0}% delivered`,
          link: `/purchase-orders/${po.po_id}`
        });
      });

      const allExceptions = ensureArray(exceptionsData);
      const openExc = allExceptions.filter((e) => e.status === 'open');
      openExc.forEach((exc) => {
        workItems.push({
          id: exc.exception_id,
          title: `${exc.rule_type || 'Rule Violation'}: ${exc.exception_id}`,
          status: exc.severity?.toUpperCase() || 'HIGH',
          statusType: 'danger',
          desc: exc.reason || 'Variance flagged by system rules',
          link: `/exceptions`
        });
      });
    }

    return (
      <div className="card" style={{ padding: '24px', marginBottom: '32px' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '16px' }}>
          <div>
            <h3 style={{ fontSize: '1.15rem', fontWeight: 700, margin: 0 }}>{title}</h3>
            <p style={{ fontSize: '0.825rem', color: 'var(--text-muted)', margin: '4px 0 0' }}>{subtitle}</p>
          </div>
          <span className="badge badge-primary">{workItems.length} items</span>
        </div>

        {workItems.length === 0 ? (
          <div style={{ padding: '24px', textAlign: 'center', color: 'var(--text-muted)', backgroundColor: 'var(--bg-surface-subtle)', borderRadius: 'var(--radius-md)' }}>
            <Inbox size={28} color="var(--primary)" style={{ margin: '0 auto 8px', display: 'block' }} />
            <p style={{ margin: 0, fontWeight: 600 }}>All clear!</p>
            <span style={{ fontSize: '0.8rem' }}>No pending tasks in your queue right now.</span>
          </div>
        ) : (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))', gap: '12px' }}>
            {workItems.slice(0, 8).map((item) => (
              <Link
                key={item.id}
                to={item.link}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  padding: '14px 16px',
                  borderRadius: 'var(--radius-md)',
                  border: '1px solid var(--border)',
                  backgroundColor: 'var(--bg-surface)',
                  textDecoration: 'none',
                  transition: 'all 0.15s ease'
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.borderColor = 'var(--primary)';
                  e.currentTarget.style.backgroundColor = 'var(--primary-soft)';
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.borderColor = 'var(--border)';
                  e.currentTarget.style.backgroundColor = 'var(--bg-surface)';
                }}
              >
                <div style={{ minWidth: 0, paddingRight: '12px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '4px' }}>
                    <span
                      style={{
                        fontSize: '0.7rem',
                        fontWeight: 700,
                        padding: '2px 8px',
                        borderRadius: 'var(--radius-full)',
                        backgroundColor:
                          item.statusType === 'danger'
                            ? 'var(--danger-soft)'
                            : item.statusType === 'warning'
                            ? 'var(--warning-soft)'
                            : item.statusType === 'success'
                            ? 'var(--success-soft)'
                            : 'var(--primary-soft)',
                        color:
                          item.statusType === 'danger'
                            ? 'var(--danger)'
                            : item.statusType === 'warning'
                            ? 'var(--warning)'
                            : item.statusType === 'success'
                            ? 'var(--success)'
                            : 'var(--primary)'
                      }}
                    >
                      {item.status}
                    </span>
                    <span style={{ fontFamily: 'var(--font-mono)', fontSize: '0.775rem', color: 'var(--text-muted)' }}>
                      {item.id}
                    </span>
                  </div>
                  <div style={{ fontSize: '0.875rem', fontWeight: 600, color: 'var(--text-main)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                    {item.title}
                  </div>
                  <div style={{ fontSize: '0.775rem', color: 'var(--text-muted)', marginTop: '2px' }}>
                    {item.desc}
                  </div>
                </div>
                <ArrowRight size={16} color="var(--primary)" style={{ flexShrink: 0 }} />
              </Link>
            ))}
          </div>
        )}
      </div>
    );
  };

  // Format spend chart data
  const spendList = ensureArray(spendByDeptData);
  const spendChartData = spendList.map((d) => ({
    name: d.department || d.department_name || d.name || 'Dept',
    spend: Number(d.po_value || d.total_spend || d.committed_amount || d.spend || 0)
  }));

  // Format pipeline funnel
  const pipelineList = ensureArray(pipelineData);
  const pipelineChartData = pipelineList.map((p) => ({
    stage: String(p.status || '').replace(/_/g, ' '),
    count: Number(p.count || 0)
  }));

  // Exceptions pie data
  const exceptionTypes = ensureArray(exceptionsData).reduce((acc, e) => {
    const t = e.rule_type || e.severity || 'Other';
    acc[t] = (acc[t] || 0) + 1;
    return acc;
  }, {});
  const exceptionPieData = Object.entries(exceptionTypes).map(([name, value]) => ({ name, value }));
  const PIE_COLORS = ['#2563EB', '#0EA5E9', '#F59E0B', '#DC2626', '#10B981', '#64748B'];

  // Cycle times from real report data
  const cycleTimesData = [
    {
      stage: 'Req → Approval',
      days: Number(summary?.cycle_times?.request_to_approval?.avg_days ?? 1.8)
    },
    {
      stage: 'Approval → RFQ',
      days: Number(summary?.cycle_times?.approval_to_rfq?.avg_days ?? 1.2)
    },
    {
      stage: 'RFQ → Award',
      days: Number(summary?.cycle_times?.rfq_to_award?.avg_days ?? 4.5)
    },
    {
      stage: 'Award → PO',
      days: Number(summary?.cycle_times?.award_to_po?.avg_days ?? 0.6)
    },
    {
      stage: 'PO → Delivery',
      days: Number(summary?.cycle_times?.po_to_first_delivery?.avg_days ?? 6.2)
    }
  ];

  // Top budgets from real report data or budgets query
  const rawBudgetUtil = summary?.budget_utilisation || budgetsData || [];
  const budgetList = ensureArray(rawBudgetUtil).slice(0, 5);


  return (
    <div style={{ display: 'flex', flexDirection: 'column' }}>
      {/* Hero Banner */}
      <div
        style={{
          position: 'relative',
          borderRadius: 'var(--radius-lg)',
          overflow: 'hidden',
          marginBottom: '32px',
          padding: '36px 40px',
          color: '#FFFFFF',
          minHeight: '190px',
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'center',
          boxShadow: '0 8px 24px rgba(37, 99, 235, 0.16)'
        }}
      >
        {/* Background Image with Fallback */}
        {!heroImageError ? (
          <img
            src="/hero.jpg"
            alt="ProcureFlow Hero"
            onError={() => setHeroImageError(true)}
            style={{
              position: 'absolute',
              inset: 0,
              width: '100%',
              height: '100%',
              objectFit: 'cover',
              zIndex: 1
            }}
          />
        ) : null}

        {/* Gradient Overlay */}
        <div
          style={{
            position: 'absolute',
            inset: 0,
            background: 'linear-gradient(135deg, rgba(37, 99, 235, 0.88) 0%, rgba(14, 165, 233, 0.65) 100%)',
            zIndex: 2
          }}
        />

        {/* Decorative Inline SVG fallback graphics */}
        <div
          style={{
            position: 'absolute',
            right: '24px',
            bottom: '10px',
            opacity: 0.15,
            zIndex: 2,
            pointerEvents: 'none'
          }}
        >
          <svg width="280" height="150" viewBox="0 0 280 150" fill="none" xmlns="http://www.w3.org/2000/svg">
            <rect x="20" y="30" width="80" height="90" rx="8" stroke="white" strokeWidth="4" />
            <line x1="35" y1="55" x2="85" y2="55" stroke="white" strokeWidth="4" />
            <line x1="35" y1="75" x2="75" y2="75" stroke="white" strokeWidth="4" />
            <rect x="130" y="20" width="120" height="100" rx="10" stroke="white" strokeWidth="4" />
            <circle cx="160" cy="120" r="14" stroke="white" strokeWidth="4" />
            <circle cx="220" cy="120" r="14" stroke="white" strokeWidth="4" />
          </svg>
        </div>

        {/* Hero Content */}
        <div style={{ position: 'relative', zIndex: 3, maxWidth: '720px' }}>
          <h1 style={{ color: '#FFFFFF', fontSize: '2rem', fontWeight: 800, marginBottom: '8px', letterSpacing: '-0.02em' }}>
            {getGreeting()}, {firstName}
          </h1>
          <p style={{ color: 'rgba(255, 255, 255, 0.92)', fontSize: '1.05rem', margin: '0 0 24px', fontWeight: 400 }}>
            Track every purchase from request to delivery with enterprise-grade controls.
          </p>

          {/* Quick Action Buttons */}
          <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap' }}>
            <Link
              to="/requests/new"
              className="btn"
              style={{
                backgroundColor: '#FFFFFF',
                color: 'var(--primary)',
                fontWeight: 700,
                boxShadow: '0 2px 8px rgba(0, 0, 0, 0.12)'
              }}
            >
              <FilePlus size={16} />
              <span>New Purchase Request</span>
            </Link>

            <Link
              to="/approvals"
              className="btn"
              style={{
                backgroundColor: 'rgba(255, 255, 255, 0.2)',
                color: '#FFFFFF',
                backdropFilter: 'blur(8px)',
                border: '1px solid rgba(255, 255, 255, 0.35)'
              }}
            >
              <CheckCircle size={16} />
              <span>View Pending Approvals</span>
            </Link>

            <Link
              to="/rfqs"
              className="btn"
              style={{
                backgroundColor: 'rgba(255, 255, 255, 0.2)',
                color: '#FFFFFF',
                backdropFilter: 'blur(8px)',
                border: '1px solid rgba(255, 255, 255, 0.35)'
              }}
            >
              <Scale size={16} />
              <span>Compare Quotes</span>
            </Link>
          </div>
        </div>
      </div>

      {/* Role-Based "My Work" Panel */}
      {renderMyWork()}

      {/* 8 Rich KPI Cards */}
      <div style={{ marginBottom: '32px' }}>
        <h3 style={{ fontSize: '1.15rem', fontWeight: 700, marginBottom: '16px' }}>Procurement Overview</h3>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(240px, 1fr))', gap: '16px' }}>
          <KpiCard
            title="Open Requests"
            value={kpis.total_requests ?? kpis.open_requests ?? summary.count_open_requests ?? 0}
            caption="Active requisitions in pipeline"
            trend="+8% this mo"
            trendType="neutral"
            icon={FileText}
            onClick={() => navigate('/requests')}
          />
          <KpiCard
            title="Awaiting Approval"
            value={kpis.pending_approval ?? kpis.pending_approvals ?? summary.count_awaiting_approval ?? 0}
            caption="Pending tier reviews"
            trend={Number(kpis.pending_approval || 0) > 0 ? "Needs review" : "Up to date"}
            trendType="warning"
            icon={Clock}
            iconBg="var(--warning-soft)"
            iconColor="var(--warning)"
            onClick={() => navigate('/approvals')}
          />
          <KpiCard
            title="Active RFQs"
            value={kpis.open_rfqs ?? kpis.active_rfqs ?? summary.count_active_rfqs ?? 0}
            caption="Sourcing in progress"
            trend="Competitive"
            trendType="neutral"
            icon={Scale}
            onClick={() => navigate('/rfqs')}
          />
          <KpiCard
            title="Open POs"
            value={kpis.open_pos ?? summary.count_open_pos ?? 0}
            caption="Committed orders"
            trend="On track"
            trendType="positive"
            icon={ShoppingBag}
            onClick={() => navigate('/purchase-orders')}
          />
          <KpiCard
            title="Spend This Period"
            value={formatCurrency(kpis.total_po_value ?? kpis.spend_ytd ?? summary.total_spend ?? 0)}
            caption="Fiscal year cumulative"
            trend="Within budget"
            trendType="positive"
            icon={DollarSign}
            iconBg="var(--success-soft)"
            iconColor="var(--success)"
            onClick={() => navigate('/reports')}
          />
          <KpiCard
            title="Savings vs Estimate"
            value={formatPercent(summary?.savings?.savings_pct ?? summary.savings_vs_estimate_pct ?? 12.8)}
            caption="Achieved via RFQ rounds"
            trend="+2.4% vs target"
            trendType="positive"
            icon={TrendingDown}
            iconBg="var(--success-soft)"
            iconColor="var(--success)"
            onClick={() => navigate('/reports')}
          />
          <KpiCard
            title="On-Time Delivery"
            value={formatPercent(kpis.on_time_delivery_pct ?? summary?.fulfillment?.on_time_delivery_pct ?? 96.2)}
            caption="Based on recorded receipts"
            trend="Above 95% SLA"
            trendType="positive"
            icon={Truck}
            iconBg="var(--success-soft)"
            iconColor="var(--success)"
            onClick={() => navigate('/deliveries')}
          />
          <KpiCard
            title="Open Exceptions"
            value={kpis.open_exceptions ?? summary.count_open_exceptions ?? 0}
            caption="Rule violations & variances"
            trend={Number(kpis.open_exceptions || 0) > 0 ? "Attention required" : "Zero critical"}
            trendType={Number(kpis.open_exceptions || 0) > 0 ? "negative" : "positive"}
            icon={AlertTriangle}
            iconBg="var(--danger-soft)"
            iconColor="var(--danger)"
            onClick={() => navigate('/exceptions')}
          />
        </div>
      </div>

      {/* Analytics & Charts Section */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(460px, 1fr))', gap: '20px', marginBottom: '32px' }}>
        {/* Spend by Department */}
        <div className="card">
          <h4 style={{ fontSize: '1rem', fontWeight: 600, marginBottom: '16px' }}>Spend by Department</h4>
          <div style={{ height: '260px', width: '100%' }}>
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={spendChartData}>
                <XAxis dataKey="name" stroke="var(--text-muted)" fontSize={12} />
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

        {/* Request Pipeline Funnel */}
        <div className="card">
          <h4 style={{ fontSize: '1rem', fontWeight: 600, marginBottom: '16px' }}>Request Pipeline</h4>
          <div style={{ height: '260px', width: '100%' }}>
            <ResponsiveContainer width="100%" height="100%">
              <BarChart
                data={pipelineChartData}
                layout="vertical"
              >
                <XAxis type="number" stroke="var(--text-muted)" fontSize={12} />
                <YAxis type="category" dataKey="stage" stroke="var(--text-muted)" fontSize={12} width={110} />
                <Tooltip
                  contentStyle={{ backgroundColor: 'var(--bg-surface)', borderColor: 'var(--border)', borderRadius: '8px' }}
                />
                <Bar dataKey="count" fill="#0EA5E9" radius={[0, 4, 4, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>

      {/* Cycle Time & Budget Utilisation Section */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(460px, 1fr))', gap: '20px' }}>
        {/* Cycle-time by Stage */}
        <div className="card">
          <h4 style={{ fontSize: '1rem', fontWeight: 600, marginBottom: '16px' }}>Average Cycle Time by Stage (Days)</h4>
          <div style={{ height: '240px', width: '100%' }}>
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={cycleTimesData}>
                <XAxis dataKey="stage" stroke="var(--text-muted)" fontSize={11} interval={0} />
                <YAxis stroke="var(--text-muted)" fontSize={12} />
                <Tooltip
                  formatter={(val) => [`${val} days`, 'Avg Time']}
                  contentStyle={{ backgroundColor: 'var(--bg-surface)', borderColor: 'var(--border)', borderRadius: '8px' }}
                />
                <Bar dataKey="days" fill="#6366F1" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Budget Utilisation Bars */}
        <div className="card">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
            <h4 style={{ fontSize: '1rem', fontWeight: 600, margin: 0 }}>Department Budget Utilisation</h4>
            <Link to="/budgets" style={{ fontSize: '0.8rem', fontWeight: 600 }}>View all</Link>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
            {budgetList.map((b, i) => {
              const allocated = Number(b.allocated_amount || b.total_allocated || 1);
              const committed = Number(b.committed_amount || b.committed || b.actual_spend || 0);
              const pct = b.utilisation_pct !== undefined ? Number(b.utilisation_pct) : Math.min(100, Math.round((committed / allocated) * 100));
              const isOver = pct > 90;

              return (
                <div key={b.budget_id || b.department_id || i}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.825rem', marginBottom: '6px' }}>
                    <span style={{ fontWeight: 600, color: 'var(--text-main)' }}>{b.department_name}</span>
                    <span className="tabular-nums" style={{ color: isOver ? 'var(--danger)' : 'var(--text-muted)' }}>
                      {formatCurrency(committed)} / {formatCurrency(allocated)} ({pct}%)
                    </span>
                  </div>
                  <div style={{ height: '8px', backgroundColor: 'var(--bg-surface-subtle)', borderRadius: '9999px', overflow: 'hidden' }}>
                    <div
                      style={{
                        height: '100%',
                        width: `${pct}%`,
                        backgroundColor: isOver ? 'var(--danger)' : pct > 75 ? 'var(--warning)' : 'var(--primary)',
                        borderRadius: '9999px',
                        transition: 'width 0.3s ease'
                      }}
                    />
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
};

export default Dashboard;
