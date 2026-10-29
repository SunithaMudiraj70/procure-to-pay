import pool from '../config/pg.js';

export const getKpis = async () => {
  const query = 'SELECT * FROM v_kpi_overview LIMIT 1;';
  const result = await pool.query(query);

  const fallback = {
    total_requests: 0,
    pending_approval: 0,
    open_rfqs: 0,
    open_pos: 0,
    total_po_value: 0,
    open_exceptions: 0,
    on_time_delivery_pct: null
  };

  if (!result.rows || result.rows.length === 0) {
    return fallback;
  }

  const row = result.rows[0];
  return {
    total_requests: parseInt(row.total_requests || 0, 10),
    pending_approval: parseInt(row.pending_approval || 0, 10),
    open_rfqs: parseInt(row.open_rfqs || 0, 10),
    open_pos: parseInt(row.open_pos || 0, 10),
    total_po_value: parseFloat(row.total_po_value || 0),
    open_exceptions: parseInt(row.open_exceptions || 0, 10),
    on_time_delivery_pct: row.on_time_delivery_pct !== null && row.on_time_delivery_pct !== undefined
      ? parseFloat(row.on_time_delivery_pct)
      : null
  };
};

export const getSpendByDepartment = async () => {
  const query = `
    SELECT
      department_id,
      department,
      COALESCE(po_value, 0)::numeric as po_value,
      COALESCE(po_count, 0)::int as po_count
    FROM v_spend_by_department
    ORDER BY po_value DESC, department ASC;
  `;
  const result = await pool.query(query);
  return result.rows.map((r) => ({
    department_id: r.department_id,
    department: r.department,
    po_value: parseFloat(r.po_value || 0),
    po_count: parseInt(r.po_count || 0, 10)
  }));
};

export const getPipeline = async () => {
  const query = `
    SELECT
      status,
      COUNT(*)::int as count
    FROM purchase_requests
    GROUP BY status
    ORDER BY count DESC;
  `;
  const result = await pool.query(query);
  return result.rows.map((r) => ({
    status: r.status,
    count: parseInt(r.count, 10)
  }));
};
