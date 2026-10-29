import pool from '../config/pg.js';
import { withTx } from '../utils/tx.js';
import { AppError } from '../utils/errors.js';
import { getPaginationParams, formatPaginatedResponse } from '../utils/pagination.js';

export const listApprovals = async (filters, user = null) => {
  const { page, pageSize, offset } = getPaginationParams(filters);

  const whereConditions = [];
  const params = [];
  let paramIndex = 1;

  if (filters.decision) {
    whereConditions.push(`a.decision = $${paramIndex++}`);
    params.push(filters.decision);
  }

  // If user is approver, optionally filter or prioritize their approvals if needed,
  // but keep list view open
  const whereClause = whereConditions.length > 0
    ? `WHERE ${whereConditions.join(' AND ')}`
    : '';

  const countQuery = `
    SELECT COUNT(*)::int as total
    FROM approvals a
    JOIN purchase_requests pr ON pr.pr_id = a.pr_id
    ${whereClause};
  `;
  const countResult = await pool.query(countQuery, params);
  const total = countResult.rows[0]?.total || 0;

  const dataQuery = `
    SELECT
      a.approval_id,
      a.pr_id,
      a.approval_level,
      a.approver_id,
      a.decision,
      a.requested_at,
      a.decided_at,
      a.comments,
      a.threshold_id,
      t.name as threshold_name,
      r.full_name as approver_name,
      r.email as approver_email,
      pr.title as pr_title,
      pr.estimated_total as pr_value,
      pr.currency_code as pr_currency,
      pr.status as pr_status,
      pr.priority as pr_priority,
      req.full_name as requester_name,
      d.name as department_name
    FROM approvals a
    JOIN purchase_requests pr ON pr.pr_id = a.pr_id
    JOIN requesters r ON r.requester_id = a.approver_id
    JOIN requesters req ON req.requester_id = pr.requester_id
    JOIN departments d ON d.department_id = pr.department_id
    LEFT JOIN approval_thresholds t ON t.threshold_id = a.threshold_id
    ${whereClause}
    ORDER BY a.requested_at DESC, a.approval_id DESC
    LIMIT $${paramIndex++} OFFSET $${paramIndex++};
  `;

  const queryParams = [...params, pageSize, offset];
  const dataResult = await pool.query(dataQuery, queryParams);

  return formatPaginatedResponse(dataResult.rows, total, page, pageSize);
};

export const decideApproval = async (approvalId, { decision, comments }, user) => {
  return withTx(async (client) => {
    // 1. Fetch approval and lock
    const aprRes = await client.query('SELECT * FROM approvals WHERE approval_id = $1 FOR UPDATE;', [approvalId]);
    if (aprRes.rows.length === 0) {
      throw new AppError(404, 'NOT_FOUND', `Approval '${approvalId}' not found`);
    }

    const approval = aprRes.rows[0];

    // Check user is assigned approver or system_admin
    if (user.role !== 'system_admin' && approval.approver_id !== user.id) {
      throw new AppError(403, 'FORBIDDEN', 'You are not assigned to decide this approval');
    }

    // Check not already decided
    if (approval.decision !== 'pending') {
      throw new AppError(422, 'INVALID_STATUS', `Approval is already decided as '${approval.decision}'`);
    }

    // 2. Level N can only be decided after levels < N are approved (422 RULE_APPROVAL_ORDER)
    const priorRes = await client.query(`
      SELECT count(*)::int as pending_prior
      FROM approvals
      WHERE pr_id = $1 AND approval_level < $2 AND decision <> 'approved';
    `, [approval.pr_id, approval.approval_level]);

    if (priorRes.rows[0].pending_prior > 0) {
      throw new AppError(
        422,
        'RULE_APPROVAL_ORDER',
        `Approval level ${approval.approval_level} cannot be decided before lower levels are approved`
      );
    }

    // 3. Rejection requires comments
    if (decision === 'rejected' && (!comments || !comments.trim())) {
      throw new AppError(422, 'RULE_COMMENT_REQUIRED', 'Comments are required when rejecting an approval');
    }

    // Fetch PR details
    const prRes = await client.query('SELECT * FROM purchase_requests WHERE pr_id = $1 FOR UPDATE;', [approval.pr_id]);
    if (prRes.rows.length === 0) {
      throw new AppError(404, 'NOT_FOUND', `Purchase request '${approval.pr_id}' not found`);
    }
    const pr = prRes.rows[0];

    // 4. Update approval record
    const updateAprRes = await client.query(`
      UPDATE approvals
      SET decision = $1, comments = $2, decided_at = NOW()
      WHERE approval_id = $3
      RETURNING *;
    `, [decision, comments || null, approvalId]);
    const updatedApproval = updateAprRes.rows[0];

    // Status event for approval itself
    await client.query(`
      INSERT INTO status_events (entity_type, entity_id, from_status, to_status, actor_id, reason, metadata)
      VALUES ('approval', $1, 'pending', $2, $3, $4, $5::jsonb);
    `, [
      approvalId,
      decision,
      user.id,
      comments || `Level ${approval.approval_level} ${decision}`,
      JSON.stringify({ level: approval.approval_level, pr_id: approval.pr_id })
    ]);

    let prStatus = pr.status;

    if (decision === 'rejected') {
      // PR -> rejected
      await client.query("SELECT set_config('app.change_reason', $1, true);", [`Rejected at approval level ${approval.approval_level}: ${comments}`]);
      await client.query("UPDATE purchase_requests SET status = 'rejected', updated_at = NOW() WHERE pr_id = $1;", [pr.pr_id]);
      prStatus = 'rejected';

      // Insert budget_ledger 'reservation_release'
      await client.query(`
        INSERT INTO budget_ledger (budget_id, entry_type, amount, pr_id, entry_date, notes)
        VALUES ($1, 'reservation_release', $2, $3, CURRENT_DATE, $4);
      `, [pr.budget_id, pr.estimated_total, pr.pr_id, `Reservation release on rejection by approver ${user.id}`]);
    } else if (decision === 'approved') {
      // Check if this was the last required approval
      const reqLvlRes = await client.query('SELECT required_level FROM v_pr_required_approval WHERE pr_id = $1;', [pr.pr_id]);
      const requiredLevel = reqLvlRes.rows[0]?.required_level || 1;

      const approvedRes = await client.query(`
        SELECT count(distinct approval_level)::int as count
        FROM approvals
        WHERE pr_id = $1 AND decision = 'approved';
      `, [pr.pr_id]);
      const approvedCount = approvedRes.rows[0].count;

      if (approvedCount >= requiredLevel) {
        // Last required approval complete -> PR approved
        await client.query("SELECT set_config('app.change_reason', $1, true);", ['All required approvals granted']);
        await client.query(`
          UPDATE purchase_requests
          SET status = 'approved', approved_at = NOW(), updated_at = NOW()
          WHERE pr_id = $1;
        `, [pr.pr_id]);
        prStatus = 'approved';
      }
    }

    return {
      approval: updatedApproval,
      pr_id: pr.pr_id,
      pr_status: prStatus
    };
  });
};
