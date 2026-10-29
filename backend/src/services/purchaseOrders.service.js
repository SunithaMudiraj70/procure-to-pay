import pool from '../config/pg.js';
import { withTx } from '../utils/tx.js';
import { AppError } from '../utils/errors.js';
import { getPaginationParams, formatPaginatedResponse } from '../utils/pagination.js';

export const listPurchaseOrders = async (filters) => {
  const { page, pageSize, offset } = getPaginationParams(filters);

  const whereConditions = [];
  const params = [];
  let paramIndex = 1;

  if (filters.status) {
    whereConditions.push(`po.status = $${paramIndex++}`);
    params.push(filters.status);
  }

  const whereClause = whereConditions.length > 0
    ? `WHERE ${whereConditions.join(' AND ')}`
    : '';

  const countQuery = `
    SELECT COUNT(*)::int as total
    FROM purchase_orders po
    ${whereClause};
  `;
  const countResult = await pool.query(countQuery, params);
  const total = countResult.rows[0]?.total || 0;

  const dataQuery = `
    SELECT
      po.po_id,
      po.pr_id,
      po.rfq_id,
      po.supplier_id,
      s.name as supplier_name,
      s.status as supplier_status,
      s.risk_level as supplier_risk_level,
      po.po_type,
      po.currency_code,
      po.subtotal,
      po.total_amount,
      po.issued_date,
      po.expected_delivery_date,
      po.status,
      po.created_at,
      COALESCE(SUM(rs.qty_ordered), 0)::numeric as total_qty_ordered,
      COALESCE(SUM(rs.qty_accepted), 0)::numeric as total_qty_accepted,
      COALESCE(SUM(rs.qty_outstanding), 0)::numeric as total_qty_outstanding,
      CASE
        WHEN COALESCE(SUM(rs.qty_ordered), 0) > 0 THEN
          ROUND(100.0 * COALESCE(SUM(rs.qty_accepted), 0) / SUM(rs.qty_ordered), 1)
        ELSE 0
      END as delivery_progress_pct,
      COUNT(DISTINCT d.delivery_id)::int as delivery_count
    FROM purchase_orders po
    JOIN suppliers s ON s.supplier_id = po.supplier_id
    LEFT JOIN v_po_receipt_status rs ON rs.po_id = po.po_id
    LEFT JOIN deliveries d ON d.po_id = po.po_id
    ${whereClause}
    GROUP BY po.po_id, s.name, s.status, s.risk_level
    ORDER BY po.created_at DESC, po.po_id DESC
    LIMIT $${paramIndex++} OFFSET $${paramIndex++};
  `;

  const queryParams = [...params, pageSize, offset];
  const dataResult = await pool.query(dataQuery, queryParams);

  return formatPaginatedResponse(dataResult.rows, total, page, pageSize);
};

export const getPurchaseOrderById = async (poId) => {
  // 1. PO header
  const poQuery = `
    SELECT
      po.*,
      s.name as supplier_name,
      s.supplier_code,
      s.status as supplier_status,
      s.risk_level as supplier_risk_level,
      s.risk_flag as supplier_risk_flag,
      req.full_name as issued_by_name,
      pr.title as pr_title,
      d.name as department_name
    FROM purchase_orders po
    JOIN suppliers s ON s.supplier_id = po.supplier_id
    JOIN requesters req ON req.requester_id = po.issued_by
    JOIN purchase_requests pr ON pr.pr_id = po.pr_id
    JOIN departments d ON d.department_id = pr.department_id
    WHERE po.po_id = $1;
  `;
  const poResult = await pool.query(poQuery, [poId]);

  if (poResult.rows.length === 0) {
    return null;
  }
  const po = poResult.rows[0];

  // 2. Lines
  const linesQuery = `
    SELECT
      pol.*,
      rs.qty_ordered,
      rs.qty_accepted,
      rs.qty_outstanding
    FROM purchase_order_lines pol
    LEFT JOIN v_po_receipt_status rs ON rs.po_line_id = pol.po_line_id
    WHERE pol.po_id = $1
    ORDER BY pol.line_no ASC;
  `;
  const linesResult = await pool.query(linesQuery, [poId]);

  // 3. Deliveries with delivery lines
  const deliveriesQuery = `
    SELECT
      d.*,
      COALESCE(
        json_agg(
          json_build_object(
            'delivery_line_id', dl.delivery_line_id,
            'po_line_id', dl.po_line_id,
            'qty_delivered', dl.qty_delivered,
            'qty_rejected', dl.qty_rejected
          )
        ) FILTER (WHERE dl.delivery_line_id IS NOT NULL),
        '[]'::json
      ) as lines
    FROM deliveries d
    LEFT JOIN delivery_lines dl ON dl.delivery_id = d.delivery_id
    WHERE d.po_id = $1
    GROUP BY d.delivery_id
    ORDER BY d.delivery_seq ASC;
  `;
  const deliveriesResult = await pool.query(deliveriesQuery, [poId]);

  // 4. Receipt status per line
  const receiptStatusQuery = `
    SELECT *
    FROM v_po_receipt_status
    WHERE po_id = $1;
  `;
  const receiptStatusResult = await pool.query(receiptStatusQuery, [poId]);

  return {
    ...po,
    lines: linesResult.rows,
    deliveries: deliveriesResult.rows,
    receipt_status: receiptStatusResult.rows
  };
};

export const recordDelivery = async (poId, body, user) => {
  return withTx(async (client) => {
    // 1. Fetch PO
    const poRes = await client.query('SELECT * FROM purchase_orders WHERE po_id = $1 FOR UPDATE;', [poId]);
    if (poRes.rows.length === 0) {
      throw new AppError(404, 'NOT_FOUND', `Purchase order '${poId}' not found`);
    }
    const po = poRes.rows[0];

    if (po.status === 'cancelled') {
      throw new AppError(422, 'INVALID_STATUS', 'Cannot record delivery against a cancelled purchase order');
    }

    // 2. Outstanding quantities per line
    const statusRes = await client.query(
      'SELECT po_line_id, qty_ordered, qty_accepted, qty_outstanding FROM v_po_receipt_status WHERE po_id = $1;',
      [poId]
    );
    const lineStatusMap = new Map();
    for (const row of statusRes.rows) {
      lineStatusMap.set(row.po_line_id, {
        ordered: parseFloat(row.qty_ordered),
        accepted: parseFloat(row.qty_accepted),
        outstanding: parseFloat(row.qty_outstanding)
      });
    }

    // 3. Validate delivery lines against outstanding
    for (const line of body.lines) {
      const lineStatus = lineStatusMap.get(line.poLineId);
      if (!lineStatus) {
        throw new AppError(422, 'INVALID_LINE', `PO line '${line.poLineId}' does not belong to PO '${poId}'`);
      }

      const delivered = parseFloat(line.qtyDelivered || 0);
      const rejected = parseFloat(line.qtyRejected || 0);
      const netAccepted = delivered - rejected;

      if (rejected > delivered) {
        throw new AppError(422, 'INVALID_QUANTITY', 'Rejected quantity cannot exceed delivered quantity');
      }

      if (netAccepted > lineStatus.outstanding) {
        throw new AppError(
          422,
          'RULE_OVER_DELIVERY',
          `Cannot receive ${netAccepted} for line '${line.poLineId}': outstanding quantity is only ${lineStatus.outstanding}`
        );
      }
    }

    // 4. Compute delivery ID and sequence
    const countRes = await client.query('SELECT count(*)::int as count FROM deliveries WHERE po_id = $1;', [poId]);
    const deliverySeq = countRes.rows[0].count + 1;

    const idRes = await client.query('SELECT next_delivery_id($1) as id;', [poId]);
    const deliveryId = idRes.rows[0].id;

    // 5. Compute if PO still has outstanding quantity after this delivery
    let totalOrdered = 0;
    let totalAcceptedAfterThis = 0;
    let anyOutstanding = false;

    for (const [lineId, status] of lineStatusMap.entries()) {
      totalOrdered += status.ordered;
      const thisDeliveryLine = body.lines.find((l) => l.poLineId === lineId);
      const thisNet = thisDeliveryLine ? (parseFloat(thisDeliveryLine.qtyDelivered || 0) - parseFloat(thisDeliveryLine.qtyRejected || 0)) : 0;
      const newAccepted = status.accepted + thisNet;
      totalAcceptedAfterThis += newAccepted;

      if (status.ordered - newAccepted > 0.001) {
        anyOutstanding = true;
      }
    }

    const deliveryStatus = anyOutstanding ? 'partial' : 'delivered';
    const actualDate = body.actualDate || new Date().toISOString().split('T')[0];

    // 6. Insert delivery record
    await client.query(`
      INSERT INTO deliveries (
        delivery_id, po_id, delivery_seq, scheduled_date, actual_date, status, carrier, tracking_ref, notes
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9);
    `, [
      deliveryId,
      poId,
      deliverySeq,
      body.scheduledDate,
      actualDate,
      deliveryStatus,
      body.carrier || null,
      body.trackingRef || null,
      body.notes || null
    ]);

    // 7. Insert delivery lines
    for (const line of body.lines) {
      await client.query(`
        INSERT INTO delivery_lines (
          delivery_id, po_line_id, qty_delivered, qty_rejected
        ) VALUES ($1, $2, $3, $4);
      `, [deliveryId, line.poLineId, line.qtyDelivered, line.qtyRejected || 0]);
    }

    // 8. Initial status_events for delivery
    await client.query(`
      INSERT INTO status_events (entity_type, entity_id, from_status, to_status, actor_id, reason)
      VALUES ('delivery', $1, NULL, $2, $3, 'Delivery recorded');
    `, [deliveryId, deliveryStatus, user.id]);

    // 9. Update PO status
    const poStatus = anyOutstanding ? 'partially_delivered' : 'delivered';
    await client.query("SELECT set_config('app.change_reason', $1, true);", [`Delivery ${deliveryId} recorded (${deliveryStatus})`]);
    await client.query("UPDATE purchase_orders SET status = $1, updated_at = NOW() WHERE po_id = $2;", [poStatus, poId]);

    // 10. Update PR status likewise
    await client.query("UPDATE purchase_requests SET status = $1, updated_at = NOW() WHERE pr_id = $2;", [poStatus, po.pr_id]);

    // 11. Partial delivery exception
    if (deliveryStatus === 'partial') {
      const excIdRes = await client.query("SELECT next_year_id('EXC') as id;");
      const reasonMsg = `${totalAcceptedAfterThis} of ${totalOrdered} received`;
      await client.query(`
        INSERT INTO exceptions (
          exception_id, issue_type, entity_type, entity_id, severity, reason, status, detected_by, detected_at
        ) VALUES ($1, 'partial_delivery', 'delivery', $2, 'low', $3, 'open', 'system', NOW());
      `, [excIdRes.rows[0].id, deliveryId, reasonMsg]);
    }

    return {
      delivery_id: deliveryId,
      po_id: poId,
      delivery_seq: deliverySeq,
      status: deliveryStatus,
      po_status: poStatus
    };
  });
};

export const cancelPurchaseOrder = async (poId, body, user) => {
  return withTx(async (client) => {
    // 1. Fetch PO
    const poRes = await client.query('SELECT * FROM purchase_orders WHERE po_id = $1 FOR UPDATE;', [poId]);
    if (poRes.rows.length === 0) {
      throw new AppError(404, 'NOT_FOUND', `Purchase order '${poId}' not found`);
    }
    const po = poRes.rows[0];

    if (po.status === 'cancelled') {
      throw new AppError(422, 'ALREADY_CANCELLED', 'Purchase order is already cancelled');
    }

    // 2. Only if no deliveries recorded
    const delRes = await client.query('SELECT count(*)::int as count FROM deliveries WHERE po_id = $1;', [poId]);
    if (delRes.rows[0].count > 0) {
      throw new AppError(422, 'RULE_DELIVERY_EXISTS', 'Cannot cancel purchase order: deliveries have already been recorded');
    }

    // 3. Fetch linked PR to get budget_id
    const prRes = await client.query('SELECT budget_id FROM purchase_requests WHERE pr_id = $1;', [po.pr_id]);
    const budgetId = prRes.rows[0]?.budget_id;

    // 4. Update PO status to cancelled
    const cancelReason = body.reason || 'PO cancelled by process owner';
    await client.query("SELECT set_config('app.change_reason', $1, true);", [cancelReason]);
    await client.query("UPDATE purchase_orders SET status = 'cancelled', updated_at = NOW() WHERE po_id = $1;", [poId]);

    // 5. Budget ledger: commitment_release
    if (budgetId) {
      await client.query(`
        INSERT INTO budget_ledger (
          budget_id, entry_type, amount, po_id, entry_date, notes
        ) VALUES ($1, 'commitment_release', $2, $3, CURRENT_DATE, $4);
      `, [budgetId, po.total_amount, poId, cancelReason]);
    }

    return {
      po_id: poId,
      status: 'cancelled',
      reason: cancelReason
    };
  });
};
