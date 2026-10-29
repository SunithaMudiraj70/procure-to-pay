import pool from '../config/pg.js';
import { withTx } from '../utils/tx.js';
import { AppError } from '../utils/errors.js';
import { getPaginationParams, formatPaginatedResponse } from '../utils/pagination.js';

export const listRequests = async (filters, user = null) => {
  const { page, pageSize, offset } = getPaginationParams(filters);

  const whereConditions = [];
  const params = [];
  let paramIndex = 1;

  // Requester role only views their own requests if requested or if not querying all
  if (filters.requester_id) {
    whereConditions.push(`pr.requester_id = $${paramIndex++}`);
    params.push(filters.requester_id);
  } else if (user && user.role === 'requester' && !filters.all && filters.status !== 'approved') {
    whereConditions.push(`pr.requester_id = $${paramIndex++}`);
    params.push(user.id);
  }

  if (filters.status) {
    whereConditions.push(`pr.status = $${paramIndex++}`);
    params.push(filters.status);
  }

  if (filters.department) {
    whereConditions.push(`(pr.department_id = $${paramIndex} OR d.name ILIKE $${paramIndex})`);
    paramIndex++;
    params.push(filters.department);
  }

  if (filters.q) {
    const searchPattern = `%${filters.q}%`;
    whereConditions.push(`(pr.pr_id ILIKE $${paramIndex} OR pr.title ILIKE $${paramIndex} OR r.full_name ILIKE $${paramIndex})`);
    paramIndex++;
    params.push(searchPattern);
  }

  const whereClause = whereConditions.length > 0 ? `WHERE ${whereConditions.join(' AND ')}` : '';

  const countQuery = `
    SELECT COUNT(*)::int as total
    FROM purchase_requests pr
    JOIN requesters r ON r.requester_id = pr.requester_id
    JOIN departments d ON d.department_id = pr.department_id
    ${whereClause};
  `;
  const countResult = await pool.query(countQuery, params);
  const total = countResult.rows[0]?.total || 0;

  const dataQuery = `
    SELECT
      pr.pr_id,
      pr.title,
      pr.procurement_type,
      pr.priority,
      pr.currency_code,
      pr.estimated_total,
      pr.status,
      pr.needed_by_date,
      pr.submitted_at,
      pr.created_at,
      r.requester_id,
      r.full_name as requester_name,
      r.email as requester_email,
      d.department_id,
      d.name as department_name,
      d.cost_center
    FROM purchase_requests pr
    JOIN requesters r ON r.requester_id = pr.requester_id
    JOIN departments d ON d.department_id = pr.department_id
    ${whereClause}
    ORDER BY pr.created_at DESC, pr.pr_id DESC
    LIMIT $${paramIndex++} OFFSET $${paramIndex++};
  `;

  const queryParams = [...params, pageSize, offset];
  const dataResult = await pool.query(dataQuery, queryParams);

  return formatPaginatedResponse(dataResult.rows, total, page, pageSize);
};

export const getRequestById = async (prId) => {
  const prQuery = `
    SELECT
      pr.*,
      r.full_name as requester_name,
      r.email as requester_email,
      r.employee_code as requester_employee_code,
      d.name as department_name,
      d.cost_center,
      b.allocated_amount as budget_allocated,
      b.fiscal_year as budget_fiscal_year,
      ra.required_level
    FROM purchase_requests pr
    JOIN requesters r ON r.requester_id = pr.requester_id
    JOIN departments d ON d.department_id = pr.department_id
    LEFT JOIN budgets b ON b.budget_id = pr.budget_id
    LEFT JOIN v_pr_required_approval ra ON ra.pr_id = pr.pr_id
    WHERE pr.pr_id = $1;
  `;
  const prResult = await pool.query(prQuery, [prId]);

  if (prResult.rows.length === 0) {
    return null;
  }

  const request = prResult.rows[0];

  const linesQuery = `
    SELECT *
    FROM request_lines
    WHERE pr_id = $1
    ORDER BY line_no ASC;
  `;
  const linesResult = await pool.query(linesQuery, [prId]);

  const approvalsQuery = `
    SELECT
      a.*,
      r.full_name as approver_name,
      r.email as approver_email,
      r.approval_level as approver_tier,
      t.name as threshold_name
    FROM approvals a
    JOIN requesters r ON r.requester_id = a.approver_id
    LEFT JOIN approval_thresholds t ON t.threshold_id = a.threshold_id
    WHERE a.pr_id = $1
    ORDER BY a.approval_level ASC;
  `;
  const approvalsResult = await pool.query(approvalsQuery, [prId]);

  const eventsQuery = `
    SELECT
      se.*,
      r.full_name as actor_name
    FROM status_events se
    LEFT JOIN requesters r ON r.requester_id = se.actor_id
    WHERE se.entity_type = 'purchase_request' AND se.entity_id = $1
    ORDER BY se.event_at DESC, se.event_id DESC;
  `;
  const eventsResult = await pool.query(eventsQuery, [prId]);

  const rfqsQuery = `
    SELECT DISTINCT
      rfq.rfq_id,
      rfq.status,
      rfq.issue_date,
      rfq.closing_date,
      rfq.currency_code,
      rfq.min_quotes_required,
      aw.supplier_id as awarded_supplier_id,
      s.name as awarded_supplier_name
    FROM rfqs rfq
    JOIN rfq_request_lines rrl ON rrl.rfq_id = rfq.rfq_id
    JOIN request_lines rl ON rl.request_line_id = rrl.request_line_id
    LEFT JOIN rfq_awards aw ON aw.rfq_id = rfq.rfq_id
    LEFT JOIN suppliers s ON s.supplier_id = aw.supplier_id
    WHERE rl.pr_id = $1
    ORDER BY rfq.rfq_id DESC;
  `;
  const rfqsResult = await pool.query(rfqsQuery, [prId]);

  const posQuery = `
    SELECT
      po.po_id,
      po.rfq_id,
      po.status,
      po.po_type,
      po.currency_code,
      po.total_amount,
      po.issued_date,
      po.expected_delivery_date,
      s.name as supplier_name,
      s.supplier_id
    FROM purchase_orders po
    JOIN suppliers s ON s.supplier_id = po.supplier_id
    WHERE po.pr_id = $1
    ORDER BY po.created_at DESC;
  `;
  const posResult = await pool.query(posQuery, [prId]);

  return {
    ...request,
    lines: linesResult.rows,
    approvals: approvalsResult.rows,
    status_events: eventsResult.rows,
    linked_rfqs: rfqsResult.rows,
    linked_pos: posResult.rows
  };
};

export const previewRequest = async ({ total, budgetId, user }) => {
  const reqTotal = parseFloat(total || 0);

  // 1. Approval threshold
  const thresholdQuery = `
    SELECT required_level
    FROM approval_thresholds
    WHERE min_amount <= $1 AND (max_amount IS NULL OR max_amount > $1)
    ORDER BY required_level DESC
    LIMIT 1;
  `;
  const threshRes = await pool.query(thresholdQuery, [reqTotal]);
  const requiredLevel = threshRes.rows[0]?.required_level || 1;

  const pathQuery = `
    SELECT required_level as level, name as title
    FROM approval_thresholds
    WHERE required_level <= $1
    ORDER BY required_level ASC;
  `;
  const pathRes = await pool.query(pathQuery, [requiredLevel]);
  const approvalPath = pathRes.rows;

  // 2. Budget balance
  let availableBudget = 0;
  let wouldExceedBudget = false;

  if (budgetId) {
    const budgetRes = await pool.query(
      'SELECT available_amount FROM v_budget_balances WHERE budget_id = $1;',
      [budgetId]
    );
    if (budgetRes.rows.length > 0) {
      availableBudget = parseFloat(budgetRes.rows[0].available_amount || 0);
      wouldExceedBudget = reqTotal > availableBudget;
    }
  }

  // 3. Duplicate candidates (if user provided)
  let duplicateCandidates = [];
  if (user) {
    const dupPolicyRes = await pool.query(
      "SELECT param_value FROM policy_parameters WHERE param_key = 'duplicate_window_days';"
    );
    const windowDays = parseInt(dupPolicyRes.rows[0]?.param_value || '7', 10);

    const dupQuery = `
      SELECT pr_id, title, estimated_total, created_at, status
      FROM purchase_requests
      WHERE requester_id = $1
        AND department_id = $2
        AND abs(estimated_total - $3) < 0.01
        AND status NOT IN ('cancelled', 'rejected')
        AND abs(created_at::date - CURRENT_DATE) <= $4;
    `;
    const dupRes = await pool.query(dupQuery, [user.id, user.departmentId, reqTotal, windowDays]);
    duplicateCandidates = dupRes.rows;
  }

  return {
    requiredLevel,
    approvalPath,
    availableBudget,
    wouldExceedBudget,
    duplicateCandidates
  };
};

export const createRequest = async (rawPayload, user) => {
  const payload = {
    ...rawPayload,
    budgetId: rawPayload.budgetId || rawPayload.budget_id,
    procurementType: rawPayload.procurementType || rawPayload.procurement_type,
    singleSourceJustification: rawPayload.singleSourceJustification || rawPayload.single_source_justification,
    currencyCode: rawPayload.currencyCode || rawPayload.currency_code,
    priority: rawPayload.priority || 'normal',
    neededByDate: rawPayload.neededByDate || rawPayload.needed_by_date,
    lines: (rawPayload.lines || []).map((l, idx) => ({
      ...l,
      line_no: l.line_no || idx + 1,
      itemCode: l.itemCode || l.item_code,
      estimatedUnitCost: Number(l.estimatedUnitCost ?? l.estimated_unit_cost ?? 0)
    }))
  };

  return withTx(async (client) => {
    if (!payload.lines || payload.lines.length === 0) {
      throw new AppError(422, 'RULE_AT_LEAST_ONE_LINE', 'Request must have at least 1 line');
    }

    if (payload.procurementType === 'single_source' && (!payload.singleSourceJustification || !payload.singleSourceJustification.trim())) {
      throw new AppError(422, 'RULE_SINGLE_SOURCE_JUSTIFICATION', 'Single source procurement requires justification');
    }

    // 1. Validate budget belongs to user's department, status is active, today within effective dates
    const budgetQuery = `
      SELECT budget_id, department_id, status, effective_from, effective_to, currency_code
      FROM budgets
      WHERE budget_id = $1;
    `;
    const budgetRes = await client.query(budgetQuery, [payload.budgetId]);
    if (budgetRes.rows.length === 0) {
      throw new AppError(422, 'INVALID_BUDGET', `Budget '${payload.budgetId}' not found`);
    }

    const budget = budgetRes.rows[0];
    if (budget.status !== 'active') {
      throw new AppError(422, 'INVALID_BUDGET', `Budget '${payload.budgetId}' is not active (status: ${budget.status})`);
    }

    // Department for the request will be the budget's department (or user's department)
    const requestDepartmentId = budget.department_id || user.departmentId;

    const todayRes = await client.query('SELECT CURRENT_DATE as today;');
    const today = todayRes.rows[0].today;
    if (budget.effective_from > today || (budget.effective_to && budget.effective_to < today)) {
      throw new AppError(
        422,
        'BUDGET_NOT_EFFECTIVE',
        `Current date is outside budget effective dates (${budget.effective_from} to ${budget.effective_to})`
      );
    }

    // 2. Generate PR ID
    const idRes = await client.query("SELECT next_year_id('PR') AS id;");
    const prId = idRes.rows[0].id;

    // 3. Compute total
    let estimatedTotal = 0;
    for (const line of payload.lines) {
      estimatedTotal += Math.round(line.quantity * line.estimatedUnitCost * 100) / 100;
    }

    // 4. Insert PR
    const prInsertQuery = `
      INSERT INTO purchase_requests (
        pr_id, requester_id, department_id, budget_id, title, justification,
        procurement_type, single_source_justification, currency_code,
        estimated_total, priority, needed_by_date, status, created_at, updated_at
      ) VALUES (
        $1, $2, $3, $4, $5, $6,
        $7, $8, $9,
        $10, $11, $12, 'draft', NOW(), NOW()
      ) RETURNING *;
    `;
    const prInsertRes = await client.query(prInsertQuery, [
      prId,
      user.id,
      requestDepartmentId,
      payload.budgetId,
      payload.title,
      payload.justification || null,
      payload.procurementType,
      payload.procurementType === 'single_source' ? payload.singleSourceJustification : null,
      payload.currencyCode || budget.currency_code || 'USD',
      estimatedTotal,
      payload.priority || 'normal',
      payload.neededByDate || null
    ]);
    const pr = prInsertRes.rows[0];

    // 5. Insert lines
    for (let i = 0; i < payload.lines.length; i++) {
      const line = payload.lines[i];
      const lineNo = i + 1;
      const lineId = `${prId}-L${String(lineNo).padStart(2, '0')}`;
      const lineQuery = `
        INSERT INTO request_lines (
          request_line_id, pr_id, line_no, item_code, description, category,
          quantity, uom, estimated_unit_cost
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9);
      `;
      await client.query(lineQuery, [
        lineId,
        prId,
        lineNo,
        line.itemCode,
        line.description,
        line.category,
        line.quantity,
        line.uom || 'EA',
        line.estimatedUnitCost
      ]);
    }

    // 6. Insert initial status_events manually (trigger only logs UPDATE)
    await client.query(
      `INSERT INTO status_events (entity_type, entity_id, from_status, to_status, actor_id, reason, metadata)
       VALUES ('purchase_request', $1, NULL, 'draft', $2, 'Draft request created', $3::jsonb);`,
      [prId, user.id, JSON.stringify({ lines_count: payload.lines.length })]
    );

    // 7. Fetch required approval path from v_pr_required_approval & approval_thresholds
    const pathQuery = `
      SELECT t.required_level, t.name
      FROM v_pr_required_approval ra
      JOIN approval_thresholds t ON t.required_level <= ra.required_level
      WHERE ra.pr_id = $1
      ORDER BY t.required_level ASC;
    `;
    const pathRes = await client.query(pathQuery, [prId]);

    return {
      ...pr,
      estimated_total: parseFloat(pr.estimated_total),
      approvalPath: pathRes.rows.map((r) => ({ level: r.required_level, title: r.name }))
    };
  });
};

export const submitRequest = async (prId, rawBody, user) => {
  const body = {
    ...rawBody,
    confirmDuplicate: rawBody.confirmDuplicate ?? rawBody.duplicate_confirmed ?? false,
    overrideReason: rawBody.overrideReason || rawBody.override_reason
  };

  return withTx(async (client) => {
    // 1. Fetch PR
    const prRes = await client.query('SELECT * FROM purchase_requests WHERE pr_id = $1 FOR UPDATE;', [prId]);
    if (prRes.rows.length === 0) {
      throw new AppError(404, 'NOT_FOUND', `Purchase request '${prId}' not found`);
    }

    const pr = prRes.rows[0];

    // Ownership check: requester who owns it or system_admin
    if (user.role !== 'system_admin' && pr.requester_id !== user.id) {
      throw new AppError(403, 'FORBIDDEN', 'Only the request owner can submit this request');
    }

    // Status check: only from draft
    if (pr.status !== 'draft') {
      throw new AppError(422, 'INVALID_STATUS', `Request is in '${pr.status}' status. Only draft requests can be submitted.`);
    }

    // Policy parameters
    const policyRes = await client.query(`
      SELECT param_key, param_value FROM policy_parameters
      WHERE param_key IN ('duplicate_window_days', 'split_purchase_window_days', 'competitive_threshold');
    `);
    const policy = {};
    for (const r of policyRes.rows) policy[r.param_key] = r.param_value;

    const dupDays = parseInt(policy.duplicate_window_days || '7', 10);
    const splitDays = parseInt(policy.split_purchase_window_days || '14', 10);
    const compThreshold = parseFloat(policy.competitive_threshold || '5000');

    // 2. Duplicate check (same requester + department + total within duplicate_window_days)
    const dupQuery = `
      SELECT pr_id, title, estimated_total, created_at
      FROM purchase_requests
      WHERE requester_id = $1
        AND department_id = $2
        AND abs(estimated_total - $3) < 0.01
        AND pr_id <> $4
        AND status NOT IN ('cancelled', 'rejected')
        AND abs(created_at::date - CURRENT_DATE) <= $5;
    `;
    const dupRes = await client.query(dupQuery, [pr.requester_id, pr.department_id, pr.estimated_total, prId, dupDays]);
    let duplicateOfPrId = null;

    if (dupRes.rows.length > 0) {
      if (!body.confirmDuplicate) {
        throw new AppError(409, 'CONFLICT_DUPLICATE', 'Potential duplicate request detected within duplicate window', {
          candidates: dupRes.rows
        });
      }
      duplicateOfPrId = dupRes.rows[0].pr_id;
      // When confirmed, insert an exceptions row
      const excIdRes = await client.query("SELECT next_year_id('EXC') as id;");
      await client.query(`
        INSERT INTO exceptions (
          exception_id, issue_type, entity_type, entity_id, severity, reason, status, detected_by, detected_at
        ) VALUES ($1, 'duplicate_request', 'purchase_request', $2, 'medium', $3, 'open', 'system', NOW());
      `, [excIdRes.rows[0].id, prId, `Confirmed duplicate of PR ${duplicateOfPrId} by user ${user.id}`]);
    }

    // 3. Split purchase check (same requester + same category within split_purchase_window_days)
    const splitQuery = `
      SELECT DISTINCT pr2.pr_id, pr2.estimated_total, pr2.split_group_id
      FROM purchase_requests pr2
      JOIN request_lines rl2 ON rl2.pr_id = pr2.pr_id
      WHERE pr2.requester_id = $1
        AND pr2.pr_id <> $2
        AND pr2.status NOT IN ('cancelled', 'rejected')
        AND abs(pr2.created_at::date - CURRENT_DATE) <= $3
        AND rl2.category IN (SELECT category FROM request_lines WHERE pr_id = $2);
    `;
    const splitRes = await client.query(splitQuery, [pr.requester_id, prId, splitDays]);
    let splitGroupId = pr.split_group_id || null;

    if (splitRes.rows.length > 0) {
      const combinedTotal = splitRes.rows.reduce((sum, r) => sum + parseFloat(r.estimated_total), parseFloat(pr.estimated_total));
      const allBelowThreshold = splitRes.rows.every((r) => parseFloat(r.estimated_total) < compThreshold) && parseFloat(pr.estimated_total) < compThreshold;

      if (combinedTotal >= compThreshold && allBelowThreshold) {
        // Find existing split_group_id or create new one
        splitGroupId = splitRes.rows.find((r) => r.split_group_id)?.split_group_id || `SPLIT-${prId}`;

        // Set split_group_id on all related PRs
        const prIdsToGroup = [prId, ...splitRes.rows.map((r) => r.pr_id)];
        await client.query(
          'UPDATE purchase_requests SET split_group_id = $1 WHERE pr_id = ANY($2);',
          [splitGroupId, prIdsToGroup]
        );

        // Insert exceptions row
        const excIdRes = await client.query("SELECT next_year_id('EXC') as id;");
        await client.query(`
          INSERT INTO exceptions (
            exception_id, issue_type, entity_type, entity_id, severity, reason, status, detected_by, detected_at
          ) VALUES ($1, 'split_purchase', 'purchase_request', $2, 'high', $3, 'open', 'system', NOW());
        `, [excIdRes.rows[0].id, prId, `Split purchase detected in group ${splitGroupId}. Combined total: $${combinedTotal}`]);
      }
    }

    // 4. Budget check: estimated_total > v_budget_balances.available_amount
    const budgetBalanceRes = await client.query(
      'SELECT available_amount FROM v_budget_balances WHERE budget_id = $1;',
      [pr.budget_id]
    );
    const availableBudget = parseFloat(budgetBalanceRes.rows[0]?.available_amount || 0);

    if (parseFloat(pr.estimated_total) > availableBudget) {
      if (!body.overrideReason || !body.overrideReason.trim()) {
        throw new AppError(
          422,
          'RULE_BUDGET_OVERRUN',
          `Estimated total (${pr.estimated_total}) exceeds available budget (${availableBudget}). An overrideReason is required to proceed.`
        );
      }
      // Continue and insert an exceptions row
      const excIdRes = await client.query("SELECT next_year_id('EXC') as id;");
      await client.query(`
        INSERT INTO exceptions (
          exception_id, issue_type, entity_type, entity_id, severity, reason, status, detected_by, detected_at
        ) VALUES ($1, 'budget_overrun', 'budget', $2, 'high', $3, 'open', 'system', NOW());
      `, [excIdRes.rows[0].id, pr.budget_id, body.overrideReason.trim()]);
    }

    // 5. Insert budget_ledger 'reservation'
    await client.query(`
      INSERT INTO budget_ledger (
        budget_id, entry_type, amount, pr_id, entry_date, notes
      ) VALUES ($1, 'reservation', $2, $3, CURRENT_DATE, 'Budget reservation upon PR submission');
    `, [pr.budget_id, pr.estimated_total, prId]);

    // 6. Create approvals rows for levels 1..required_level
    const requiredLevelRes = await client.query(
      'SELECT required_level FROM v_pr_required_approval WHERE pr_id = $1;',
      [prId]
    );
    const requiredLevel = requiredLevelRes.rows[0]?.required_level || 1;

    for (let lvl = 1; lvl <= requiredLevel; lvl++) {
      // Pick active approver with approval_level = lvl. Prefer same department, else any.
      const approverRes = await client.query(`
        SELECT requester_id
        FROM requesters
        WHERE role = 'approver' AND is_active = true AND approval_level = $1
        ORDER BY CASE WHEN department_id = $2 THEN 0 ELSE 1 END, requester_id ASC
        LIMIT 1;
      `, [lvl, pr.department_id]);

      let approverId = approverRes.rows[0]?.requester_id;
      if (!approverId) {
        // Fallback to any user with approval_level = lvl
        const fallbackRes = await client.query(`
          SELECT requester_id FROM requesters WHERE is_active = true AND approval_level = $1 LIMIT 1;
        `, [lvl]);
        approverId = fallbackRes.rows[0]?.requester_id;
      }

      if (!approverId) {
        throw new AppError(422, 'NO_APPROVER_FOUND', `No active approver found for Level ${lvl}`);
      }

      const threshRes = await client.query(
        'SELECT threshold_id FROM approval_thresholds WHERE required_level = $1 LIMIT 1;',
        [lvl]
      );
      const thresholdId = threshRes.rows[0]?.threshold_id || null;

      const aprIdRes = await client.query("SELECT next_year_id('APR') as id;");
      await client.query(`
        INSERT INTO approvals (
          approval_id, pr_id, approval_level, approver_id, threshold_id, decision, requested_at
        ) VALUES ($1, $2, $3, $4, $5, 'pending', NOW());
      `, [aprIdRes.rows[0].id, prId, lvl, approverId, thresholdId]);
    }

    // 7. Update status to pending_approval and set reason
    await client.query("SELECT set_config('app.change_reason', $1, true);", ['Submitted for approval']);
    await client.query(`
      UPDATE purchase_requests
      SET status = 'pending_approval',
          submitted_at = NOW(),
          duplicate_of_pr_id = COALESCE($1, duplicate_of_pr_id),
          split_group_id = COALESCE($2, split_group_id),
          updated_at = NOW()
      WHERE pr_id = $3;
    `, [duplicateOfPrId, splitGroupId, prId]);

    return {
      pr_id: prId,
      status: 'pending_approval',
      required_level: requiredLevel,
      duplicate_of_pr_id: duplicateOfPrId,
      split_group_id: splitGroupId
    };
  });
};

export const createRfqForRequest = async (prId, body, user) => {
  return withTx(async (client) => {
    // 1. Fetch PR
    const prRes = await client.query('SELECT * FROM purchase_requests WHERE pr_id = $1;', [prId]);
    if (prRes.rows.length === 0) {
      throw new AppError(404, 'NOT_FOUND', `Purchase request '${prId}' not found`);
    }

    const pr = prRes.rows[0];
    if (pr.status !== 'approved') {
      throw new AppError(422, 'INVALID_STATUS', `PR must be in approved status to issue an RFQ (current: '${pr.status}')`);
    }

    if (pr.procurement_type !== 'competitive') {
      throw new AppError(422, 'INVALID_PROCUREMENT_TYPE', `PR procurement type must be competitive to issue an RFQ (current: '${pr.procurement_type}')`);
    }

    // 2. Policy min_quotes_competitive
    const policyRes = await client.query("SELECT param_value FROM policy_parameters WHERE param_key = 'min_quotes_competitive';");
    const minQuotes = parseInt(policyRes.rows[0]?.param_value || '3', 10);

    const supplierIds = [...new Set(body.supplierIds)];
    if (supplierIds.length < minQuotes) {
      throw new AppError(
        422,
        'RULE_MIN_SUPPLIERS',
        `Competitive sourcing requires at least ${minQuotes} invited suppliers (received ${supplierIds.length})`
      );
    }

    // 3. Verify all suppliers are active and not blacklisted
    const suppRes = await client.query(`
      SELECT supplier_id, status FROM suppliers WHERE supplier_id = ANY($1);
    `, [supplierIds]);

    if (suppRes.rows.length !== supplierIds.length) {
      throw new AppError(422, 'INVALID_SUPPLIER', 'One or more specified supplier IDs do not exist');
    }

    const inactiveSuppliers = suppRes.rows.filter((s) => s.status !== 'active');
    if (inactiveSuppliers.length > 0) {
      throw new AppError(
        422,
        'RULE_SUPPLIER_INACTIVE',
        `Cannot invite inactive or blacklisted suppliers: ${inactiveSuppliers.map((s) => `${s.supplier_id} (${s.status})`).join(', ')}`
      );
    }

    // 4. Create RFQ
    const rfqIdRes = await client.query("SELECT next_year_id('RFQ') as id;");
    const rfqId = rfqIdRes.rows[0].id;

    await client.query(`
      INSERT INTO rfqs (
        rfq_id, created_by, currency_code, issue_date, closing_date, min_quotes_required, status, notes
      ) VALUES ($1, $2, $3, CURRENT_DATE, $4, $5, 'issued', $6);
    `, [rfqId, user.id, pr.currency_code, body.closingDate, minQuotes, body.notes || null]);

    // 5. Link all PR request lines
    await client.query(`
      INSERT INTO rfq_request_lines (rfq_id, request_line_id)
      SELECT $1, request_line_id FROM request_lines WHERE pr_id = $2;
    `, [rfqId, prId]);

    // 6. Link invited suppliers
    for (const suppId of supplierIds) {
      await client.query(`
        INSERT INTO rfq_suppliers (rfq_id, supplier_id, invited_on, response_status)
        VALUES ($1, $2, CURRENT_DATE, 'invited');
      `, [rfqId, suppId]);
    }

    // 7. Initial status_events for RFQ
    await client.query(`
      INSERT INTO status_events (entity_type, entity_id, from_status, to_status, actor_id, reason)
      VALUES ('rfq', $1, NULL, 'issued', $2, 'RFQ issued to suppliers');
    `, [rfqId, user.id]);

    // 8. Update PR status to rfq_issued
    await client.query("SELECT set_config('app.change_reason', $1, true);", ['RFQ issued for request']);
    await client.query("UPDATE purchase_requests SET status = 'rfq_issued', updated_at = NOW() WHERE pr_id = $1;", [prId]);

    return {
      rfq_id: rfqId,
      pr_id: prId,
      status: 'issued',
      invited_suppliers: supplierIds.length
    };
  });
};

export const createSingleSourcePo = async (prId, body, user) => {
  return withTx(async (client) => {
    // 1. Fetch PR
    const prRes = await client.query(`
      SELECT pr.*, ra.required_level
      FROM purchase_requests pr
      LEFT JOIN v_pr_required_approval ra ON ra.pr_id = pr.pr_id
      WHERE pr.pr_id = $1;
    `, [prId]);

    if (prRes.rows.length === 0) {
      throw new AppError(404, 'NOT_FOUND', `Purchase request '${prId}' not found`);
    }

    const pr = prRes.rows[0];
    if (pr.procurement_type !== 'single_source' && pr.procurement_type !== 'direct_low_value') {
      throw new AppError(
        422,
        'INVALID_PROCUREMENT_TYPE',
        `Direct PO issuance is only valid for single_source or direct_low_value (current: '${pr.procurement_type}')`
      );
    }

    // 2. Approvals complete check
    const approvalsRes = await client.query(`
      SELECT count(distinct approval_level) as approved_count
      FROM approvals
      WHERE pr_id = $1 AND decision = 'approved';
    `, [prId]);
    const approvedCount = parseInt(approvalsRes.rows[0]?.approved_count || '0', 10);
    const requiredLevel = pr.required_level || 1;

    if (approvedCount < requiredLevel) {
      throw new AppError(
        422,
        'RULE_PO_REQUIRES_APPROVAL',
        `Purchase order cannot be created until all required approvals are complete (${approvedCount}/${requiredLevel} approved)`
      );
    }

    // 3. Supplier check
    const suppRes = await client.query('SELECT * FROM suppliers WHERE supplier_id = $1;', [body.supplierId]);
    if (suppRes.rows.length === 0 || suppRes.rows[0].status !== 'active') {
      throw new AppError(422, 'RULE_SUPPLIER_INACTIVE', `Supplier '${body.supplierId}' not found or is inactive`);
    }
    const supplier = suppRes.rows[0];

    // 4. Generate PO ID
    const poIdRes = await client.query("SELECT next_year_id('PO') as id;");
    const poId = poIdRes.rows[0].id;

    // 5. Calculate Subtotal from lines
    const prLinesRes = await client.query('SELECT * FROM request_lines WHERE pr_id = $1 ORDER BY line_no ASC;', [prId]);
    let subtotal = 0;
    const computedLines = [];

    for (let i = 0; i < prLinesRes.rows.length; i++) {
      const line = prLinesRes.rows[i];
      const customPrice = body.unitPrices && body.unitPrices[line.request_line_id] !== undefined
        ? parseFloat(body.unitPrices[line.request_line_id])
        : parseFloat(line.estimated_unit_cost);

      const lineTotal = Math.round(parseFloat(line.quantity) * customPrice * 100) / 100;
      subtotal += lineTotal;
      computedLines.push({ line, customPrice, lineNo: i + 1 });
    }

    // 6. Insert PO header first
    await client.query(`
      INSERT INTO purchase_orders (
        po_id, pr_id, rfq_id, quote_id, award_id, supplier_id, issued_by, po_type,
        currency_code, subtotal, freight_cost, duty_cost, other_charges,
        payment_terms_days, issued_date, expected_delivery_date, status
      ) VALUES (
        $1, $2, NULL, NULL, NULL, $3, $4, $5,
        $6, $7, 0, 0, 0,
        $8, CURRENT_DATE, CURRENT_DATE + 30, 'issued'
      );
    `, [
      poId,
      prId,
      supplier.supplier_id,
      user.id,
      pr.procurement_type,
      pr.currency_code,
      subtotal,
      supplier.payment_terms_days || 30
    ]);

    // 7. Insert PO lines
    for (const { line, customPrice, lineNo } of computedLines) {
      const poLineId = `${poId}-L${String(lineNo).padStart(2, '0')}`;
      await client.query(`
        INSERT INTO purchase_order_lines (
          po_line_id, po_id, line_no, request_line_id, quote_line_id, description, quantity, unit_price
        ) VALUES ($1, $2, $3, $4, NULL, $5, $6, $7);
      `, [poLineId, poId, lineNo, line.request_line_id, line.description, line.quantity, customPrice]);
    }

    // 7. Initial status_events for PO
    await client.query(`
      INSERT INTO status_events (entity_type, entity_id, from_status, to_status, actor_id, reason)
      VALUES ('purchase_order', $1, NULL, 'issued', $2, 'Direct/single-source PO issued');
    `, [poId, user.id]);

    // 8. Exceptions row for single source
    const excIdRes = await client.query("SELECT next_year_id('EXC') as id;");
    await client.query(`
      INSERT INTO exceptions (
        exception_id, issue_type, entity_type, entity_id, severity, reason, status, detected_by, detected_at
      ) VALUES ($1, 'single_source', 'purchase_order', $2, 'medium', $3, 'open', 'system', NOW());
    `, [excIdRes.rows[0].id, poId, body.justification]);

    // 9. Update PR status to po_issued
    await client.query("SELECT set_config('app.change_reason', $1, true);", ['Purchase order issued']);
    await client.query("UPDATE purchase_requests SET status = 'po_issued', updated_at = NOW() WHERE pr_id = $1;", [prId]);

    // 10. Ledger movements
    await client.query(`
      INSERT INTO budget_ledger (budget_id, entry_type, amount, pr_id, entry_date, notes)
      VALUES ($1, 'reservation_release', $2, $3, CURRENT_DATE, 'Reservation release on single-source PO issue');
    `, [pr.budget_id, pr.estimated_total, prId]);

    await client.query(`
      INSERT INTO budget_ledger (budget_id, entry_type, amount, po_id, entry_date, notes)
      VALUES ($1, 'commitment', $2, $3, CURRENT_DATE, 'Commitment on single-source PO issue');
    `, [pr.budget_id, subtotal, poId]);

    return {
      po_id: poId,
      pr_id: prId,
      supplier_id: supplier.supplier_id,
      total_amount: subtotal,
      status: 'issued'
    };
  });
};

export const getRequestAuditTrail = async (prId) => {
  // Query all status events for PR, linked RFQs, quotes, POs, deliveries
  const auditQuery = `
    SELECT
      'status_event' as record_type,
      se.entity_type,
      se.entity_id,
      se.from_status,
      se.to_status,
      se.reason,
      se.event_at as timestamp,
      r.full_name as actor_name,
      se.metadata
    FROM status_events se
    LEFT JOIN requesters r ON r.requester_id = se.actor_id
    WHERE (se.entity_type = 'purchase_request' AND se.entity_id = $1)
       OR (se.entity_type = 'rfq' AND se.entity_id IN (
            SELECT rfq_id FROM rfq_request_lines rrl JOIN request_lines rl ON rl.request_line_id = rrl.request_line_id WHERE rl.pr_id = $1
          ))
       OR (se.entity_type = 'supplier_quote' AND se.entity_id IN (
            SELECT q.quote_id FROM supplier_quotes q
            JOIN rfq_request_lines rrl ON rrl.rfq_id = q.rfq_id
            JOIN request_lines rl ON rl.request_line_id = rrl.request_line_id
            WHERE rl.pr_id = $1
          ))
       OR (se.entity_type = 'purchase_order' AND se.entity_id IN (
            SELECT po_id FROM purchase_orders WHERE pr_id = $1
          ))
       OR (se.entity_type = 'delivery' AND se.entity_id IN (
            SELECT d.delivery_id FROM deliveries d JOIN purchase_orders po ON po.po_id = d.po_id WHERE po.pr_id = $1
          ))

    UNION ALL

    SELECT
      'approval' as record_type,
      'approval' as entity_type,
      a.approval_id as entity_id,
      'pending' as from_status,
      a.decision as to_status,
      a.comments as reason,
      COALESCE(a.decided_at, a.requested_at) as timestamp,
      req.full_name as actor_name,
      json_build_object('level', a.approval_level)::jsonb as metadata
    FROM approvals a
    JOIN requesters req ON req.requester_id = a.approver_id
    WHERE a.pr_id = $1

    UNION ALL

    SELECT
      'exception' as record_type,
      e.entity_type,
      e.exception_id as entity_id,
      NULL as from_status,
      e.status as to_status,
      e.reason,
      e.detected_at as timestamp,
      e.detected_by as actor_name,
      json_build_object('issue_type', e.issue_type, 'severity', e.severity)::jsonb as metadata
    FROM exceptions e
    WHERE e.entity_id = $1
       OR e.entity_id IN (SELECT po_id FROM purchase_orders WHERE pr_id = $1)
       OR e.entity_id IN (SELECT rfq_id FROM rfq_request_lines rrl JOIN request_lines rl ON rl.request_line_id = rrl.request_line_id WHERE rl.pr_id = $1)

    ORDER BY timestamp ASC;
  `;

  const result = await pool.query(auditQuery, [prId]);
  return {
    pr_id: prId,
    trail: result.rows
  };
};
