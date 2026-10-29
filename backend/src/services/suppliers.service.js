import pool from '../config/pg.js';
import { getPaginationParams, formatPaginatedResponse } from '../utils/pagination.js';

export const listSuppliers = async (filters) => {
  const { page, pageSize, offset } = getPaginationParams(filters);

  const whereConditions = [];
  const params = [];
  let paramIndex = 1;

  if (filters.status) {
    whereConditions.push(`ss.status = $${paramIndex++}`);
    params.push(filters.status);
  }

  if (filters.risk) {
    whereConditions.push(`ss.risk_level = $${paramIndex++}`);
    params.push(filters.risk);
  }

  const whereClause = whereConditions.length > 0
    ? `WHERE ${whereConditions.join(' AND ')}`
    : '';

  const countQuery = `
    SELECT COUNT(*)::int as total
    FROM v_supplier_scorecard ss
    ${whereClause};
  `;
  const countResult = await pool.query(countQuery, params);
  const total = countResult.rows[0]?.total || 0;

  const dataQuery = `
    SELECT
      ss.supplier_id,
      ss.name,
      ss.status,
      ss.risk_level,
      COALESCE(ss.quotes_submitted, 0)::int as quotes_submitted,
      COALESCE(ss.awards_won, 0)::int as awards_won,
      COALESCE(ss.po_count, 0)::int as po_count,
      ss.on_time_pct,
      s.supplier_code,
      s.country_code,
      s.default_currency,
      s.payment_terms_days,
      s.risk_flag,
      s.risk_reason
    FROM v_supplier_scorecard ss
    JOIN suppliers s ON s.supplier_id = ss.supplier_id
    ${whereClause}
    ORDER BY ss.po_count DESC, ss.name ASC
    LIMIT $${paramIndex++} OFFSET $${paramIndex++};
  `;

  const queryParams = [...params, pageSize, offset];
  const dataResult = await pool.query(dataQuery, queryParams);

  const data = dataResult.rows.map((row) => ({
    ...row,
    quotes_submitted: parseInt(row.quotes_submitted || 0, 10),
    awards_won: parseInt(row.awards_won || 0, 10),
    po_count: parseInt(row.po_count || 0, 10),
    on_time_pct: row.on_time_pct !== null && row.on_time_pct !== undefined ? parseFloat(row.on_time_pct) : null
  }));

  return formatPaginatedResponse(data, total, page, pageSize);
};

export const createSupplier = async (supplierData) => {
  const { withTx } = await import('../utils/tx.js');
  return await withTx(async (client) => {
    const {
      supplier_code,
      name,
      country_code = 'US',
      default_currency = 'USD',
      payment_terms_days = 30,
      status = 'active',
      risk_level = 'low',
      risk_flag = false,
      risk_reason = null,
      categories = []
    } = supplierData;

    const idRes = await client.query("SELECT next_simple_id('SUP', 6) as new_id;");
    const supplierId = idRes.rows[0].new_id;

    const insertQuery = `
      INSERT INTO suppliers (
        supplier_id, supplier_code, name, country_code, default_currency,
        payment_terms_days, status, risk_level, risk_flag, risk_reason
      ) VALUES ($1, upper($2), $3, upper($4), upper($5), $6, $7, $8, $9, $10)
      RETURNING *;
    `;
    const insertRes = await client.query(insertQuery, [
      supplierId,
      supplier_code,
      name,
      country_code,
      default_currency,
      payment_terms_days,
      status,
      risk_level,
      risk_flag,
      risk_flag ? (risk_reason || 'Flagged at onboarding') : null
    ]);

    if (Array.isArray(categories) && categories.length > 0) {
      for (const cat of categories) {
        if (cat && String(cat).trim()) {
          await client.query(
            'INSERT INTO supplier_categories (supplier_id, category) VALUES ($1, $2) ON CONFLICT DO NOTHING;',
            [supplierId, String(cat).trim()]
          );
        }
      }
    }

    return {
      ...insertRes.rows[0],
      categories: categories || []
    };
  });
};
