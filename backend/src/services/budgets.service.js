import pool from '../config/pg.js';
import { getPaginationParams, formatPaginatedResponse } from '../utils/pagination.js';

export const listBudgets = async (filters) => {
  const { page, pageSize, offset } = getPaginationParams(filters);

  const whereConditions = [];
  const params = [];
  let paramIndex = 1;

  if (filters.department) {
    whereConditions.push(`(bb.department_id = $${paramIndex} OR d.name ILIKE $${paramIndex})`);
    paramIndex++;
    params.push(filters.department);
  }

  if (filters.fiscalYear) {
    whereConditions.push(`bb.fiscal_year = $${paramIndex++}`);
    params.push(filters.fiscalYear);
  }

  const whereClause = whereConditions.length > 0
    ? `WHERE ${whereConditions.join(' AND ')}`
    : '';

  const countQuery = `
    SELECT COUNT(*)::int as total
    FROM v_budget_balances bb
    JOIN departments d ON d.department_id = bb.department_id
    ${whereClause};
  `;
  const countResult = await pool.query(countQuery, params);
  const total = countResult.rows[0]?.total || 0;

  const dataQuery = `
    SELECT
      bb.budget_id,
      bb.department_id,
      d.name as department_name,
      d.cost_center,
      bb.fiscal_year,
      bb.category,
      bb.allocated_amount,
      bb.adjustments,
      bb.reserved_open,
      bb.committed,
      bb.available_amount,
      b.currency_code,
      b.status as budget_status,
      b.effective_from,
      b.effective_to
    FROM v_budget_balances bb
    JOIN departments d ON d.department_id = bb.department_id
    JOIN budgets b ON b.budget_id = bb.budget_id
    ${whereClause}
    ORDER BY d.name ASC, bb.fiscal_year DESC, bb.category ASC
    LIMIT $${paramIndex++} OFFSET $${paramIndex++};
  `;

  const queryParams = [...params, pageSize, offset];
  const dataResult = await pool.query(dataQuery, queryParams);

  const data = dataResult.rows.map((r) => ({
    ...r,
    allocated_amount: parseFloat(r.allocated_amount || 0),
    adjustments: parseFloat(r.adjustments || 0),
    reserved_open: parseFloat(r.reserved_open || 0),
    committed: parseFloat(r.committed || 0),
    available_amount: parseFloat(r.available_amount || 0),
    is_overrun: parseFloat(r.available_amount || 0) < 0
  }));

  return formatPaginatedResponse(data, total, page, pageSize);
};
