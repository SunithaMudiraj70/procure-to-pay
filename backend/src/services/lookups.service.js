import pool from '../config/pg.js';

export const getActiveUsers = async () => {
  const query = `
    SELECT
      r.requester_id,
      r.employee_code,
      r.full_name,
      r.email,
      r.role,
      r.approval_level,
      r.department_id,
      d.name as department_name
    FROM requesters r
    JOIN departments d ON d.department_id = r.department_id
    WHERE r.is_active = true
    ORDER BY r.role ASC, r.full_name ASC;
  `;
  const result = await pool.query(query);
  return result.rows;
};

export const getLookups = async () => {
  // 1. Departments
  const deptQuery = `
    SELECT department_id, name, cost_center, status, effective_from, effective_to
    FROM departments
    WHERE status = 'active'
    ORDER BY name ASC;
  `;

  // 2. Budgets with available_amount from v_budget_balances
  const budgetQuery = `
    SELECT
      b.budget_id,
      b.department_id,
      d.name as department_name,
      b.fiscal_year,
      b.category,
      b.allocated_amount,
      b.currency_code,
      b.status,
      b.effective_from,
      b.effective_to,
      COALESCE(bb.available_amount, b.allocated_amount) as available_amount,
      COALESCE(bb.reserved_open, 0) as reserved_open,
      COALESCE(bb.committed, 0) as committed
    FROM budgets b
    JOIN departments d ON d.department_id = b.department_id
    LEFT JOIN v_budget_balances bb ON bb.budget_id = b.budget_id
    WHERE b.status = 'active'
    ORDER BY d.name ASC, b.fiscal_year DESC;
  `;

  // 3. Active suppliers with categories
  const supplierQuery = `
    SELECT
      s.supplier_id,
      s.supplier_code,
      s.name,
      s.country_code,
      s.default_currency,
      s.payment_terms_days,
      s.status,
      s.risk_level,
      s.risk_flag,
      s.risk_reason,
      COALESCE(
        json_agg(sc.category) FILTER (WHERE sc.category IS NOT NULL),
        '[]'::json
      ) as categories
    FROM suppliers s
    LEFT JOIN supplier_categories sc ON sc.supplier_id = s.supplier_id
    WHERE s.status = 'active'
    GROUP BY s.supplier_id
    ORDER BY s.name ASC;
  `;

  // 4. Distinct categories from request_lines and supplier_categories
  const categoryQuery = `
    SELECT DISTINCT category
    FROM (
      SELECT category FROM request_lines
      UNION
      SELECT category FROM supplier_categories
    ) cats
    WHERE category IS NOT NULL AND btrim(category) <> ''
    ORDER BY category ASC;
  `;

  // 5. Approval thresholds
  const thresholdQuery = `
    SELECT threshold_id, name, min_amount, max_amount, required_level
    FROM approval_thresholds
    ORDER BY required_level ASC;
  `;

  // 6. Policy parameters as an object
  const policyQuery = `
    SELECT param_key, param_value, description
    FROM policy_parameters;
  `;

  const [deptRes, budgetRes, suppRes, catRes, threshRes, policyRes] = await Promise.all([
    pool.query(deptQuery),
    pool.query(budgetQuery),
    pool.query(supplierQuery),
    pool.query(categoryQuery),
    pool.query(thresholdQuery),
    pool.query(policyQuery)
  ]);

  const policyObject = {};
  for (const row of policyRes.rows) {
    policyObject[row.param_key] = row.param_value;
  }

  return {
    departments: deptRes.rows,
    budgets: budgetRes.rows.map((b) => ({
      ...b,
      allocated_amount: parseFloat(b.allocated_amount),
      available_amount: parseFloat(b.available_amount),
      reserved_open: parseFloat(b.reserved_open),
      committed: parseFloat(b.committed)
    })),
    suppliers: suppRes.rows,
    categories: catRes.rows.map((r) => r.category),
    thresholds: threshRes.rows.map((t) => ({
      ...t,
      min_amount: parseFloat(t.min_amount),
      max_amount: t.max_amount !== null ? parseFloat(t.max_amount) : null
    })),
    policy: policyObject
  };
};
