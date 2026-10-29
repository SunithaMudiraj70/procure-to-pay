import pool from '../config/pg.js';
import { withTx } from '../utils/tx.js';
import { AppError } from '../utils/errors.js';
import { getPaginationParams, formatPaginatedResponse } from '../utils/pagination.js';

export const listExceptions = async (filters) => {
  const { page, pageSize, offset } = getPaginationParams(filters);

  const whereConditions = [];
  const params = [];
  let paramIndex = 1;

  if (filters.type) {
    whereConditions.push(`e.issue_type = $${paramIndex++}`);
    params.push(filters.type);
  }

  if (filters.status) {
    whereConditions.push(`e.status = $${paramIndex++}`);
    params.push(filters.status);
  }

  const whereClause = whereConditions.length > 0
    ? `WHERE ${whereConditions.join(' AND ')}`
    : '';

  const countQuery = `
    SELECT COUNT(*)::int as total
    FROM exceptions e
    ${whereClause};
  `;
  const countResult = await pool.query(countQuery, params);
  const total = countResult.rows[0]?.total || 0;

  const dataQuery = `
    SELECT
      e.exception_id,
      e.issue_type,
      e.entity_type,
      e.entity_id,
      e.severity,
      e.reason,
      e.status,
      e.detected_by,
      e.detected_at,
      e.resolved_by,
      e.resolved_at,
      e.resolution_note,
      r.full_name as resolved_by_name
    FROM exceptions e
    LEFT JOIN requesters r ON r.requester_id = e.resolved_by
    ${whereClause}
    ORDER BY e.detected_at DESC, e.exception_id DESC
    LIMIT $${paramIndex++} OFFSET $${paramIndex++};
  `;

  const queryParams = [...params, pageSize, offset];
  const dataResult = await pool.query(dataQuery, queryParams);

  return formatPaginatedResponse(dataResult.rows, total, page, pageSize);
};

export const listViolations = async (filters) => {
  const { page, pageSize, offset } = getPaginationParams(filters);

  const whereConditions = [];
  const params = [];
  let paramIndex = 1;

  if (filters.type) {
    whereConditions.push(`v.issue_type = $${paramIndex++}`);
    params.push(filters.type);
  }

  const whereClause = whereConditions.length > 0
    ? `WHERE ${whereConditions.join(' AND ')}`
    : '';

  const countQuery = `
    SELECT COUNT(*)::int as total
    FROM v_rule_violations v
    ${whereClause};
  `;
  const countResult = await pool.query(countQuery, params);
  const total = countResult.rows[0]?.total || 0;

  const dataQuery = `
    SELECT
      v.issue_type,
      v.entity_type,
      v.entity_id,
      v.detail
    FROM v_rule_violations v
    ${whereClause}
    ORDER BY v.issue_type ASC, v.entity_id ASC
    LIMIT $${paramIndex++} OFFSET $${paramIndex++};
  `;

  const queryParams = [...params, pageSize, offset];
  const dataResult = await pool.query(dataQuery, queryParams);

  return formatPaginatedResponse(dataResult.rows, total, page, pageSize);
};

export const resolveException = async (exceptionId, { status, note }, user) => {
  return withTx(async (client) => {
    // 1. Fetch exception
    const excRes = await client.query('SELECT * FROM exceptions WHERE exception_id = $1 FOR UPDATE;', [exceptionId]);
    if (excRes.rows.length === 0) {
      throw new AppError(404, 'NOT_FOUND', `Exception '${exceptionId}' not found`);
    }
    const exception = excRes.rows[0];

    if (exception.status === 'resolved' || exception.status === 'waived') {
      throw new AppError(422, 'ALREADY_RESOLVED', `Exception '${exceptionId}' is already ${exception.status}`);
    }

    if (!note || !note.trim()) {
      throw new AppError(422, 'RULE_NOTE_REQUIRED', 'A resolution note is required');
    }

    // 2. Update exception
    const updateRes = await client.query(`
      UPDATE exceptions
      SET status = $1,
          resolved_by = $2,
          resolved_at = NOW(),
          resolution_note = $3
      WHERE exception_id = $4
      RETURNING *;
    `, [status, user.id, note.trim(), exceptionId]);
    const updated = updateRes.rows[0];

    // 3. Insert status_events row with actor
    await client.query(`
      INSERT INTO status_events (
        entity_type, entity_id, from_status, to_status, actor_id, reason, metadata
      ) VALUES (
        'exception', $1, $2, $3, $4, $5, $6::jsonb
      );
    `, [
      exceptionId,
      exception.status,
      status,
      user.id,
      note.trim(),
      JSON.stringify({ issue_type: exception.issue_type, severity: exception.severity })
    ]);

    return updated;
  });
};
