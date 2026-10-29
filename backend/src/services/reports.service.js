import pool from '../config/pg.js';

export const getSummaryReport = async ({ from, to } = {}) => {
  const dateFilters = [];
  const dateParams = [];
  let paramIdx = 1;

  if (from) {
    dateFilters.push(`event_at >= $${paramIdx++}`);
    dateParams.push(from);
  }
  if (to) {
    dateFilters.push(`event_at <= $${paramIdx++}`);
    dateParams.push(to);
  }

  // 1. Cycle Times
  // request submitted -> approved
  const prCycleRes = await pool.query(`
    SELECT
      COALESCE(ROUND(AVG(EXTRACT(EPOCH FROM (approved_at - submitted_at)) / 86400.0)::numeric, 2), 0) as avg_days,
      COALESCE(ROUND(PERCENTILE_CONT(0.90) WITHIN GROUP (ORDER BY EXTRACT(EPOCH FROM (approved_at - submitted_at)) / 86400.0)::numeric, 2), 0) as p90_days
    FROM purchase_requests
    WHERE submitted_at IS NOT NULL AND approved_at IS NOT NULL;
  `);

  // approved -> RFQ issued
  const rfqCycleRes = await pool.query(`
    SELECT
      COALESCE(ROUND(AVG(EXTRACT(EPOCH FROM (r.created_at - pr.approved_at)) / 86400.0)::numeric, 2), 0) as avg_days,
      COALESCE(ROUND(PERCENTILE_CONT(0.90) WITHIN GROUP (ORDER BY EXTRACT(EPOCH FROM (r.created_at - pr.approved_at)) / 86400.0)::numeric, 2), 0) as p90_days
    FROM rfqs r
    JOIN rfq_request_lines rrl ON rrl.rfq_id = r.rfq_id
    JOIN request_lines rl ON rl.request_line_id = rrl.request_line_id
    JOIN purchase_requests pr ON pr.pr_id = rl.pr_id
    WHERE pr.approved_at IS NOT NULL AND r.created_at >= pr.approved_at;
  `);

  // RFQ issued -> award
  const awardCycleRes = await pool.query(`
    SELECT
      COALESCE(ROUND(AVG(EXTRACT(EPOCH FROM (aw.awarded_at - r.created_at)) / 86400.0)::numeric, 2), 0) as avg_days,
      COALESCE(ROUND(PERCENTILE_CONT(0.90) WITHIN GROUP (ORDER BY EXTRACT(EPOCH FROM (aw.awarded_at - r.created_at)) / 86400.0)::numeric, 2), 0) as p90_days
    FROM rfq_awards aw
    JOIN rfqs r ON r.rfq_id = aw.rfq_id
    WHERE aw.awarded_at >= r.created_at;
  `);

  // award -> PO
  const poCycleRes = await pool.query(`
    SELECT
      COALESCE(ROUND(AVG(EXTRACT(EPOCH FROM (po.created_at - aw.awarded_at)) / 86400.0)::numeric, 2), 0) as avg_days,
      COALESCE(ROUND(PERCENTILE_CONT(0.90) WITHIN GROUP (ORDER BY EXTRACT(EPOCH FROM (po.created_at - aw.awarded_at)) / 86400.0)::numeric, 2), 0) as p90_days
    FROM purchase_orders po
    JOIN rfq_awards aw ON aw.award_id = po.award_id
    WHERE po.created_at >= aw.awarded_at;
  `);

  // PO -> first delivery
  const deliveryCycleRes = await pool.query(`
    SELECT
      COALESCE(ROUND(AVG(EXTRACT(EPOCH FROM (d.first_del_date::timestamp - po.issued_date::timestamp)) / 86400.0)::numeric, 2), 0) as avg_days,
      COALESCE(ROUND(PERCENTILE_CONT(0.90) WITHIN GROUP (ORDER BY EXTRACT(EPOCH FROM (d.first_del_date::timestamp - po.issued_date::timestamp)) / 86400.0)::numeric, 2), 0) as p90_days
    FROM purchase_orders po
    JOIN (
      SELECT po_id, MIN(COALESCE(actual_date, scheduled_date)) as first_del_date
      FROM deliveries
      GROUP BY po_id
    ) d ON d.po_id = po.po_id
    WHERE d.first_del_date >= po.issued_date;
  `);

  // 2. Savings: sum(estimated_total of awarded PRs) - sum(awarded PO subtotal)
  const savingsRes = await pool.query(`
    SELECT
      COALESCE(SUM(pr.estimated_total), 0) as estimated_total,
      COALESCE(SUM(po.subtotal), 0) as po_subtotal
    FROM purchase_orders po
    JOIN purchase_requests pr ON pr.pr_id = po.pr_id
    WHERE po.status <> 'cancelled';
  `);
  const estTotal = parseFloat(savingsRes.rows[0]?.estimated_total || 0);
  const poSubtotal = parseFloat(savingsRes.rows[0]?.po_subtotal || 0);
  const savingsAmount = Math.round((estTotal - poSubtotal) * 100) / 100;
  const savingsPct = estTotal > 0 ? Math.round(((savingsAmount / estTotal) * 100) * 100) / 100 : 0;

  // 3. Quote competitiveness
  const quoteCompRes = await pool.query(`
    WITH rfq_stats AS (
      SELECT
        r.rfq_id,
        COUNT(DISTINCT sq.quote_id) as quote_count,
        MAX(CASE WHEN aw.award_id IS NOT NULL THEN 1 ELSE 0 END) as is_awarded,
        MAX(CASE WHEN aw.is_lowest_cost THEN 1 ELSE 0 END) as awarded_lowest
      FROM rfqs r
      LEFT JOIN supplier_quotes sq ON sq.rfq_id = r.rfq_id AND sq.status <> 'withdrawn'
      LEFT JOIN rfq_awards aw ON aw.rfq_id = r.rfq_id
      GROUP BY r.rfq_id
    )
    SELECT
      COALESCE(ROUND(AVG(quote_count)::numeric, 2), 0) as avg_quotes_per_rfq,
      COALESCE(ROUND((COUNT(CASE WHEN quote_count >= 3 THEN 1 END) * 100.0 / NULLIF(COUNT(*), 0))::numeric, 2), 0) as pct_rfqs_min_3_quotes,
      COALESCE(ROUND((COUNT(CASE WHEN awarded_lowest = 1 THEN 1 END) * 100.0 / NULLIF(COUNT(CASE WHEN is_awarded = 1 THEN 1 END), 0))::numeric, 2), 0) as pct_awards_lowest_cost
    FROM rfq_stats;
  `);

  // 4. On-time delivery % and partial delivery rate
  const deliveryStatsRes = await pool.query(`
    SELECT
      COUNT(*)::int as total_deliveries,
      COALESCE(ROUND((COUNT(CASE WHEN actual_date <= scheduled_date THEN 1 END) * 100.0 / NULLIF(COUNT(CASE WHEN actual_date IS NOT NULL THEN 1 END), 0))::numeric, 2), 0) as on_time_delivery_pct,
      COALESCE(ROUND((COUNT(CASE WHEN status = 'partial' THEN 1 END) * 100.0 / NULLIF(COUNT(*), 0))::numeric, 2), 0) as partial_delivery_rate
    FROM deliveries;
  `);

  // 5. Exception counts by issue_type and status; exception rate = exceptions / POs
  const exceptionsCountRes = await pool.query(`
    SELECT issue_type, status, COUNT(*)::int as count
    FROM exceptions
    GROUP BY issue_type, status
    ORDER BY issue_type, status;
  `);

  const poCountRes = await pool.query("SELECT COUNT(*)::int as count FROM purchase_orders WHERE status <> 'cancelled';");
  const totalPos = poCountRes.rows[0]?.count || 0;

  const totalExceptionsRes = await pool.query('SELECT COUNT(*)::int as count FROM exceptions;');
  const totalExceptions = totalExceptionsRes.rows[0]?.count || 0;
  const exceptionRate = totalPos > 0 ? Math.round((totalExceptions / totalPos) * 100) / 100 : 0;

  // 6. Budget utilisation per department (committed / allocated)
  const budgetUtilRes = await pool.query(`
    SELECT
      d.department_id,
      d.name as department_name,
      d.cost_center,
      COALESCE(SUM(b.allocated_amount), 0) as allocated_amount,
      COALESCE(SUM(bb.committed), 0) as committed_amount,
      COALESCE(SUM(bb.available_amount), 0) as available_amount,
      CASE
        WHEN COALESCE(SUM(b.allocated_amount), 0) > 0 THEN
          ROUND((COALESCE(SUM(bb.committed), 0) * 100.0 / SUM(b.allocated_amount))::numeric, 2)
        ELSE 0
      END as utilisation_pct
    FROM departments d
    LEFT JOIN budgets b ON b.department_id = d.department_id
    LEFT JOIN v_budget_balances bb ON bb.budget_id = b.budget_id
    GROUP BY d.department_id, d.name, d.cost_center
    ORDER BY d.name ASC;
  `);

  // 7. Spend by category (top 10)
  const categorySpendRes = await pool.query(`
    SELECT
      rl.category,
      ROUND(SUM(pol.line_total)::numeric, 2) as spend,
      COUNT(DISTINCT pol.po_id)::int as po_count
    FROM purchase_order_lines pol
    JOIN request_lines rl ON rl.request_line_id = pol.request_line_id
    JOIN purchase_orders po ON po.po_id = pol.po_id
    WHERE po.status <> 'cancelled'
    GROUP BY rl.category
    ORDER BY spend DESC
    LIMIT 10;
  `);

  // Spend by supplier (top 10)
  const supplierSpendRes = await pool.query(`
    SELECT
      s.supplier_id,
      s.name as supplier_name,
      s.country_code,
      ROUND(SUM(po.total_amount)::numeric, 2) as spend,
      COUNT(po.po_id)::int as po_count
    FROM purchase_orders po
    JOIN suppliers s ON s.supplier_id = po.supplier_id
    WHERE po.status <> 'cancelled'
    GROUP BY s.supplier_id, s.name, s.country_code
    ORDER BY spend DESC
    LIMIT 10;
  `);

  return {
    cycle_times: {
      request_to_approval: {
        avg_days: parseFloat(prCycleRes.rows[0]?.avg_days || 0),
        p90_days: parseFloat(prCycleRes.rows[0]?.p90_days || 0)
      },
      approval_to_rfq: {
        avg_days: parseFloat(rfqCycleRes.rows[0]?.avg_days || 0),
        p90_days: parseFloat(rfqCycleRes.rows[0]?.p90_days || 0)
      },
      rfq_to_award: {
        avg_days: parseFloat(awardCycleRes.rows[0]?.avg_days || 0),
        p90_days: parseFloat(awardCycleRes.rows[0]?.p90_days || 0)
      },
      award_to_po: {
        avg_days: parseFloat(poCycleRes.rows[0]?.avg_days || 0),
        p90_days: parseFloat(poCycleRes.rows[0]?.p90_days || 0)
      },
      po_to_first_delivery: {
        avg_days: parseFloat(deliveryCycleRes.rows[0]?.avg_days || 0),
        p90_days: parseFloat(deliveryCycleRes.rows[0]?.p90_days || 0)
      }
    },
    savings: {
      estimated_total: estTotal,
      po_subtotal: poSubtotal,
      savings_amount: savingsAmount,
      savings_pct: savingsPct
    },
    quote_competitiveness: {
      avg_quotes_per_rfq: parseFloat(quoteCompRes.rows[0]?.avg_quotes_per_rfq || 0),
      pct_rfqs_with_min_3_quotes: parseFloat(quoteCompRes.rows[0]?.pct_rfqs_min_3_quotes || 0),
      pct_awards_at_lowest_cost: parseFloat(quoteCompRes.rows[0]?.pct_awards_lowest_cost || 0)
    },
    fulfillment: {
      total_deliveries: deliveryStatsRes.rows[0]?.total_deliveries || 0,
      on_time_delivery_pct: parseFloat(deliveryStatsRes.rows[0]?.on_time_delivery_pct || 0),
      partial_delivery_rate: parseFloat(deliveryStatsRes.rows[0]?.partial_delivery_rate || 0)
    },
    exceptions: {
      total_exceptions: totalExceptions,
      total_pos: totalPos,
      exception_rate: exceptionRate,
      breakdown: exceptionsCountRes.rows
    },
    budget_utilisation: budgetUtilRes.rows.map((r) => ({
      ...r,
      allocated_amount: parseFloat(r.allocated_amount),
      committed_amount: parseFloat(r.committed_amount),
      available_amount: parseFloat(r.available_amount),
      utilisation_pct: parseFloat(r.utilisation_pct)
    })),
    spend_by_category: categorySpendRes.rows.map((r) => ({
      category: r.category,
      spend: parseFloat(r.spend),
      po_count: r.po_count
    })),
    spend_by_supplier: supplierSpendRes.rows.map((r) => ({
      supplier_id: r.supplier_id,
      supplier_name: r.supplier_name,
      country_code: r.country_code,
      spend: parseFloat(r.spend),
      po_count: r.po_count
    }))
  };
};

export const exportReportCsv = async (type) => {
  let query = '';
  let filename = 'export.csv';

  switch (type) {
    case 'requests':
      filename = 'requests.csv';
      query = `
        SELECT
          pr.pr_id,
          pr.title,
          r.full_name as requester,
          d.name as department,
          pr.procurement_type,
          pr.priority,
          pr.status,
          pr.currency_code,
          pr.estimated_total,
          pr.submitted_at,
          pr.created_at
        FROM purchase_requests pr
        JOIN requesters r ON r.requester_id = pr.requester_id
        JOIN departments d ON d.department_id = pr.department_id
        ORDER BY pr.created_at DESC;
      `;
      break;

    case 'pos':
      filename = 'purchase_orders.csv';
      query = `
        SELECT
          po.po_id,
          po.pr_id,
          po.rfq_id,
          s.name as supplier,
          po.po_type,
          po.status,
          po.currency_code,
          po.subtotal,
          po.total_amount,
          po.issued_date,
          po.expected_delivery_date,
          po.created_at
        FROM purchase_orders po
        JOIN suppliers s ON s.supplier_id = po.supplier_id
        ORDER BY po.created_at DESC;
      `;
      break;

    case 'exceptions':
      filename = 'exceptions.csv';
      query = `
        SELECT
          e.exception_id,
          e.issue_type,
          e.entity_type,
          e.entity_id,
          e.severity,
          e.status,
          e.reason,
          e.detected_by,
          e.detected_at,
          e.resolved_at,
          e.resolution_note
        FROM exceptions e
        ORDER BY e.detected_at DESC;
      `;
      break;

    default:
      throw new Error(`Unsupported export type: ${type}`);
  }

  const result = await pool.query(query);
  const rows = result.rows;

  if (rows.length === 0) {
    return { filename, csv: '' };
  }

  // Format RFC4180 CSV
  const headers = Object.keys(rows[0]);
  const formatCell = (val) => {
    if (val === null || val === undefined) return '';
    const str = String(val);
    if (str.includes(',') || str.includes('"') || str.includes('\n') || str.includes('\r')) {
      return `"${str.replace(/"/g, '""')}"`;
    }
    return str;
  };

  const csvLines = [];
  csvLines.push(headers.map(formatCell).join(','));

  for (const row of rows) {
    csvLines.push(headers.map((h) => formatCell(row[h])).join(','));
  }

  return {
    filename,
    csv: csvLines.join('\r\n')
  };
};
