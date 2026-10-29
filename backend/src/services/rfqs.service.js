import pool from '../config/pg.js';
import { withTx } from '../utils/tx.js';
import { AppError } from '../utils/errors.js';
import { getPaginationParams, formatPaginatedResponse } from '../utils/pagination.js';

export const listRfqs = async (filters) => {
  const { page, pageSize, offset } = getPaginationParams(filters);

  const whereConditions = [];
  const params = [];
  let paramIndex = 1;

  if (filters.status) {
    whereConditions.push(`r.status = $${paramIndex++}`);
    params.push(filters.status);
  }

  const whereClause = whereConditions.length > 0
    ? `WHERE ${whereConditions.join(' AND ')}`
    : '';

  const countQuery = `
    SELECT COUNT(*)::int as total
    FROM rfqs r
    ${whereClause};
  `;
  const countResult = await pool.query(countQuery, params);
  const total = countResult.rows[0]?.total || 0;

  const dataQuery = `
    SELECT
      r.rfq_id,
      r.created_by,
      req.full_name as creator_name,
      r.currency_code,
      r.issue_date,
      r.closing_date,
      r.min_quotes_required,
      r.status,
      r.notes,
      r.created_at,
      COUNT(DISTINCT sq.quote_id)::int as quote_count,
      aw.supplier_id as awarded_supplier_id,
      s.name as awarded_supplier_name,
      aw.award_basis,
      aw.is_lowest_cost as award_is_lowest_cost
    FROM rfqs r
    JOIN requesters req ON req.requester_id = r.created_by
    LEFT JOIN supplier_quotes sq ON sq.rfq_id = r.rfq_id
    LEFT JOIN rfq_awards aw ON aw.rfq_id = r.rfq_id
    LEFT JOIN suppliers s ON s.supplier_id = aw.supplier_id
    ${whereClause}
    GROUP BY r.rfq_id, req.full_name, aw.supplier_id, s.name, aw.award_basis, aw.is_lowest_cost
    ORDER BY r.created_at DESC, r.rfq_id DESC
    LIMIT $${paramIndex++} OFFSET $${paramIndex++};
  `;

  const queryParams = [...params, pageSize, offset];
  const dataResult = await pool.query(dataQuery, queryParams);

  return formatPaginatedResponse(dataResult.rows, total, page, pageSize);
};

export const getRfqComparison = async (rfqId) => {
  // 1. RFQ metadata
  const rfqQuery = `
    SELECT
      r.*,
      req.full_name as creator_name
    FROM rfqs r
    JOIN requesters req ON req.requester_id = r.created_by
    WHERE r.rfq_id = $1;
  `;
  const rfqResult = await pool.query(rfqQuery, [rfqId]);

  if (rfqResult.rows.length === 0) {
    return null;
  }
  const rfq = rfqResult.rows[0];

  // 2. Comparison quotes from v_quote_comparison joined with suppliers for risk_level & reason
  const comparisonQuery = `
    SELECT
      qc.*,
      s.risk_level,
      s.risk_reason
    FROM v_quote_comparison qc
    JOIN suppliers s ON s.supplier_id = qc.supplier_id
    WHERE qc.rfq_id = $1
    ORDER BY qc.cost_rank ASC, qc.delivery_rank ASC;
  `;
  const comparisonResult = await pool.query(comparisonQuery, [rfqId]);

  // 3. Award details (basis, rationale, awarded quote)
  const awardQuery = `
    SELECT
      aw.*,
      s.name as supplier_name,
      req.full_name as awarded_by_name
    FROM rfq_awards aw
    JOIN suppliers s ON s.supplier_id = aw.supplier_id
    JOIN requesters req ON req.requester_id = aw.awarded_by
    WHERE aw.rfq_id = $1;
  `;
  const awardResult = await pool.query(awardQuery, [rfqId]);
  const award = awardResult.rows[0] || null;

  return {
    rfq: {
      rfq_id: rfq.rfq_id,
      currency_code: rfq.currency_code,
      issue_date: rfq.issue_date,
      closing_date: rfq.closing_date,
      min_quotes_required: rfq.min_quotes_required,
      status: rfq.status,
      notes: rfq.notes,
      creator_name: rfq.creator_name,
      created_at: rfq.created_at
    },
    quotes: comparisonResult.rows.map((q) => ({
      ...q,
      total_landed_cost: parseFloat(q.total_landed_cost),
      total_landed_cost_base: parseFloat(q.total_landed_cost_base),
      delivery_days: parseInt(q.delivery_days, 10),
      cost_rank: parseInt(q.cost_rank, 10),
      delivery_rank: parseInt(q.delivery_rank, 10)
    })),
    award: award ? {
      award_id: award.award_id,
      quote_id: award.quote_id,
      supplier_id: award.supplier_id,
      supplier_name: award.supplier_name,
      awarded_at: award.awarded_at,
      awarded_by: award.awarded_by,
      awarded_by_name: award.awarded_by_name,
      award_basis: award.award_basis,
      is_lowest_cost: award.is_lowest_cost,
      rationale: award.rationale
    } : null,
    min_quotes_required: rfq.min_quotes_required
  };
};

export const addQuote = async (rfqId, body, user) => {
  return withTx(async (client) => {
    // 1. Fetch RFQ
    const rfqRes = await client.query('SELECT * FROM rfqs WHERE rfq_id = $1 FOR UPDATE;', [rfqId]);
    if (rfqRes.rows.length === 0) {
      throw new AppError(404, 'NOT_FOUND', `RFQ '${rfqId}' not found`);
    }
    const rfq = rfqRes.rows[0];

    // 2. Verify supplier is invited
    const invitedRes = await client.query(
      'SELECT * FROM rfq_suppliers WHERE rfq_id = $1 AND supplier_id = $2;',
      [rfqId, body.supplierId]
    );
    if (invitedRes.rows.length === 0) {
      throw new AppError(422, 'RULE_SUPPLIER_NOT_INVITED', `Supplier '${body.supplierId}' was not invited to RFQ '${rfqId}'`);
    }

    // 3. Verify supplier is active
    const suppRes = await client.query('SELECT * FROM suppliers WHERE supplier_id = $1;', [body.supplierId]);
    if (suppRes.rows.length === 0) {
      throw new AppError(404, 'NOT_FOUND', `Supplier '${body.supplierId}' not found`);
    }
    const supplier = suppRes.rows[0];
    if (supplier.status !== 'active') {
      throw new AppError(422, 'RULE_SUPPLIER_INACTIVE', `Supplier '${body.supplierId}' is ${supplier.status}`);
    }

    // 4. Check if quote already exists for this supplier and RFQ
    const existingQuoteRes = await client.query(
      'SELECT quote_id FROM supplier_quotes WHERE rfq_id = $1 AND supplier_id = $2;',
      [rfqId, body.supplierId]
    );
    if (existingQuoteRes.rows.length > 0) {
      throw new AppError(422, 'DUPLICATE_QUOTE', `Supplier '${body.supplierId}' has already submitted quote '${existingQuoteRes.rows[0].quote_id}' for this RFQ`);
    }

    // 5. Generate quote ID via next_quote_id(supplier_code)
    const quoteIdRes = await client.query('SELECT next_quote_id($1) as id;', [supplier.supplier_code]);
    const quoteId = quoteIdRes.rows[0].id;

    // 6. Calculate subtotal
    let subtotal = 0;
    for (const line of body.lines) {
      subtotal += Math.round(line.quantity * line.unitPrice * 100) / 100;
    }

    // 7. Insert quote
    const insertQuoteQuery = `
      INSERT INTO supplier_quotes (
        quote_id, rfq_id, supplier_id, quote_date, valid_until,
        currency_code, fx_rate_to_base, subtotal, freight_cost, duty_cost, other_charges,
        delivery_days, payment_terms_days, status
      ) VALUES (
        $1, $2, $3, $4, $5,
        $6, $7, $8, $9, $10, $11,
        $12, $13, 'submitted'
      ) RETURNING *;
    `;
    const insertRes = await client.query(insertQuoteQuery, [
      quoteId,
      rfqId,
      supplier.supplier_id,
      body.quoteDate,
      body.validUntil,
      body.currencyCode || rfq.currency_code,
      body.fxRateToBase || 1.0,
      subtotal,
      body.freightCost || 0,
      body.dutyCost || 0,
      body.otherCharges || 0,
      body.deliveryDays,
      body.paymentTermsDays || supplier.payment_terms_days || 30
    ]);
    const quote = insertRes.rows[0];

    // 8. Insert quote lines
    for (let i = 0; i < body.lines.length; i++) {
      const line = body.lines[i];
      const lineNo = i + 1;
      const quoteLineId = `${quoteId}-L${String(lineNo).padStart(2, '0')}`;
      await client.query(`
        INSERT INTO quote_lines (
          quote_line_id, quote_id, line_no, request_line_id, quantity, unit_price
        ) VALUES ($1, $2, $3, $4, $5, $6);
      `, [quoteLineId, quoteId, lineNo, line.requestLineId, line.quantity, line.unitPrice]);
    }

    // 9. Update rfq_suppliers response_status
    await client.query(`
      UPDATE rfq_suppliers
      SET response_status = 'quoted'
      WHERE rfq_id = $1 AND supplier_id = $2;
    `, [rfqId, supplier.supplier_id]);

    // 10. Initial status_events for quote
    await client.query(`
      INSERT INTO status_events (entity_type, entity_id, from_status, to_status, actor_id, reason)
      VALUES ('supplier_quote', $1, NULL, 'submitted', $2, 'Quote submitted');
    `, [quoteId, user.id]);

    // 11. Currency mismatch exception check
    const isCurrencyMismatch = body.currencyCode && body.currencyCode !== rfq.currency_code;
    if (isCurrencyMismatch) {
      const excIdRes = await client.query("SELECT next_year_id('EXC') as id;");
      await client.query(`
        INSERT INTO exceptions (
          exception_id, issue_type, entity_type, entity_id, severity, reason, status, detected_by, detected_at
        ) VALUES ($1, 'quote_currency_mismatch', 'supplier_quote', $2, 'medium', $3, 'open', 'system', NOW());
      `, [
        excIdRes.rows[0].id,
        quoteId,
        `Quote currency '${body.currencyCode}' differs from RFQ currency '${rfq.currency_code}'`
      ]);
    }

    // 12. Check if RFQ now has >= min_quotes_required quotes
    const quoteCountRes = await client.query(
      "SELECT count(*)::int as count FROM supplier_quotes WHERE rfq_id = $1 AND status <> 'withdrawn';",
      [rfqId]
    );
    const quoteCount = quoteCountRes.rows[0].count;

    if (quoteCount >= rfq.min_quotes_required && rfq.status === 'issued') {
      await client.query("SELECT set_config('app.change_reason', $1, true);", ['Minimum required quotes received']);
      await client.query(
        "UPDATE rfqs SET status = 'quotes_received', updated_at = NOW() WHERE rfq_id = $1;",
        [rfqId]
      );
    }

    return {
      quote_id: quoteId,
      rfq_id: rfqId,
      supplier_id: supplier.supplier_id,
      status: 'submitted',
      total_quotes: quoteCount,
      currency_mismatch: isCurrencyMismatch
    };
  });
};

export const evaluateRfq = async (rfqId, user) => {
  return withTx(async (client) => {
    // 1. Fetch RFQ
    const rfqRes = await client.query('SELECT * FROM rfqs WHERE rfq_id = $1 FOR UPDATE;', [rfqId]);
    if (rfqRes.rows.length === 0) {
      throw new AppError(404, 'NOT_FOUND', `RFQ '${rfqId}' not found`);
    }
    const rfq = rfqRes.rows[0];

    // 2. Next evaluation run number
    const runRes = await client.query(
      'SELECT COALESCE(MAX(evaluation_run), 0) + 1 AS next_run FROM quote_evaluations WHERE rfq_id = $1;',
      [rfqId]
    );
    const evaluationRun = runRes.rows[0].next_run;

    // 3. Score weights from policy_parameters
    const policyRes = await client.query(`
      SELECT param_key, param_value FROM policy_parameters
      WHERE param_key IN ('score_weight_cost', 'score_weight_delivery');
    `);
    const policy = {};
    for (const r of policyRes.rows) policy[r.param_key] = r.param_value;

    const wCost = parseFloat(policy.score_weight_cost || '0.70');
    const wDelivery = parseFloat(policy.score_weight_delivery || '0.30');

    // 4. Fetch quotes with supplier details
    const quotesRes = await client.query(`
      SELECT q.*, s.status as supplier_status, s.risk_flag, s.risk_reason, CURRENT_DATE as today
      FROM supplier_quotes q
      JOIN suppliers s ON s.supplier_id = q.supplier_id
      WHERE q.rfq_id = $1 AND q.status NOT IN ('withdrawn');
    `, [rfqId]);

    const quotes = quotesRes.rows;
    if (quotes.length === 0) {
      throw new AppError(422, 'NO_QUOTES', 'Cannot evaluate RFQ with no submitted quotes');
    }

    const today = quotes[0].today;

    // 5. Evaluate eligibility and handle expiration
    const evaluatedQuotes = [];
    for (const q of quotes) {
      let isEligible = true;
      const ineligibilityReasons = [];

      // Check expired
      const isExpired = q.valid_until < today;
      if (isExpired) {
        isEligible = false;
        ineligibilityReasons.push(`Expired on ${q.valid_until}`);

        // Update quote status to expired if not already
        if (q.status !== 'expired') {
          await client.query("SELECT set_config('app.change_reason', $1, true);", ['Quote expired']);
          await client.query("UPDATE supplier_quotes SET status = 'expired', updated_at = NOW() WHERE quote_id = $1;", [q.quote_id]);

          // Insert exception if not already recorded
          const existingExc = await client.query(
            "SELECT 1 FROM exceptions WHERE issue_type = 'quote_expired' AND entity_id = $1;",
            [q.quote_id]
          );
          if (existingExc.rows.length === 0) {
            const excIdRes = await client.query("SELECT next_year_id('EXC') as id;");
            await client.query(`
              INSERT INTO exceptions (
                exception_id, issue_type, entity_type, entity_id, severity, reason, status, detected_by, detected_at
              ) VALUES ($1, 'quote_expired', 'supplier_quote', $2, 'medium', $3, 'open', 'system', NOW());
            `, [excIdRes.rows[0].id, q.quote_id, `Quote expired on ${q.valid_until} before evaluation/award`]);
          }
        }
      }

      // Check supplier active
      if (q.supplier_status !== 'active') {
        isEligible = false;
        ineligibilityReasons.push(`Supplier is ${q.supplier_status}`);
      }

      // Check currency mismatch
      if (q.currency_code !== rfq.currency_code) {
        isEligible = false;
        ineligibilityReasons.push(`Currency mismatch: quote '${q.currency_code}' vs RFQ '${rfq.currency_code}'`);
      }

      evaluatedQuotes.push({
        ...q,
        isEligible,
        ineligibilityReason: ineligibilityReasons.length > 0 ? ineligibilityReasons.join('; ') : null,
        costBase: parseFloat(q.total_landed_cost_base),
        deliveryDays: parseInt(q.delivery_days, 10)
      });
    }

    // 6. Compute min/max for normalization across all quotes
    const minCost = Math.min(...evaluatedQuotes.map((q) => q.costBase));
    const maxCost = Math.max(...evaluatedQuotes.map((q) => q.costBase));
    const minDelivery = Math.min(...evaluatedQuotes.map((q) => q.deliveryDays));
    const maxDelivery = Math.max(...evaluatedQuotes.map((q) => q.deliveryDays));

    // Sort to compute ranks
    const sortedByCost = [...evaluatedQuotes].sort((a, b) => a.costBase - b.costBase);
    const sortedByDelivery = [...evaluatedQuotes].sort((a, b) => a.deliveryDays - b.deliveryDays);

    const costRanks = new Map();
    sortedByCost.forEach((q, idx) => costRanks.set(q.quote_id, idx + 1));

    const deliveryRanks = new Map();
    sortedByDelivery.forEach((q, idx) => deliveryRanks.set(q.quote_id, idx + 1));

    // 7. Insert evaluation snapshots
    for (const q of evaluatedQuotes) {
      const costRank = costRanks.get(q.quote_id);
      const deliveryRank = deliveryRanks.get(q.quote_id);

      // Normalization: (min-max normalization, all-equal -> 1)
      const costFactor = maxCost === minCost ? 1.0 : 1.0 - (q.costBase - minCost) / (maxCost - minCost);
      const deliveryFactor = maxDelivery === minDelivery ? 1.0 : 1.0 - (q.deliveryDays - minDelivery) / (maxDelivery - minDelivery);
      const weightedScore = Math.round((wCost * costFactor + wDelivery * deliveryFactor) * 10000) / 10000;

      const isLowestCost = costRank === 1 && q.isEligible;
      const isFastest = deliveryRank === 1 && q.isEligible;

      await client.query(`
        INSERT INTO quote_evaluations (
          rfq_id, quote_id, evaluation_run, total_landed_cost_base, delivery_days,
          cost_rank, delivery_rank, weighted_score, is_lowest_cost, is_fastest,
          is_eligible, ineligibility_reason, evaluated_by, evaluated_at
        ) VALUES (
          $1, $2, $3, $4, $5,
          $6, $7, $8, $9, $10,
          $11, $12, $13, NOW()
        );
      `, [
        rfqId,
        q.quote_id,
        evaluationRun,
        q.costBase,
        q.deliveryDays,
        costRank,
        deliveryRank,
        weightedScore,
        isLowestCost,
        isFastest,
        q.isEligible,
        q.ineligibilityReason,
        user.id
      ]);
    }

    // 8. Update RFQ status to evaluated
    await client.query("SELECT set_config('app.change_reason', $1, true);", ['Quotes evaluated']);
    await client.query("UPDATE rfqs SET status = 'evaluated', updated_at = NOW() WHERE rfq_id = $1;", [rfqId]);

    return {
      rfq_id: rfqId,
      evaluation_run: evaluationRun,
      quotes_evaluated: evaluatedQuotes.length,
      status: 'evaluated'
    };
  });
};

export const awardRfq = async (rfqId, { quoteId, rationale }, user) => {
  return withTx(async (client) => {
    // 1. Fetch RFQ
    const rfqRes = await client.query('SELECT * FROM rfqs WHERE rfq_id = $1 FOR UPDATE;', [rfqId]);
    if (rfqRes.rows.length === 0) {
      throw new AppError(404, 'NOT_FOUND', `RFQ '${rfqId}' not found`);
    }
    const rfq = rfqRes.rows[0];

    // Check not already awarded
    const awardRes = await client.query('SELECT award_id FROM rfq_awards WHERE rfq_id = $1;', [rfqId]);
    if (awardRes.rows.length > 0) {
      throw new AppError(422, 'ALREADY_AWARDED', `RFQ '${rfqId}' is already awarded (Award: ${awardRes.rows[0].award_id})`);
    }

    // 2. RULE_MIN_QUOTES check: minimum required quotes
    const quoteCountRes = await client.query(
      "SELECT count(*)::int as count FROM supplier_quotes WHERE rfq_id = $1 AND status <> 'withdrawn';",
      [rfqId]
    );
    const quoteCount = quoteCountRes.rows[0].count;
    if (quoteCount < rfq.min_quotes_required) {
      throw new AppError(
        422,
        'RULE_MIN_QUOTES',
        `Cannot award competitive RFQ: requires at least ${rfq.min_quotes_required} quotes, but only ${quoteCount} received`
      );
    }

    // 3. Fetch selected quote and supplier
    const quoteRes = await client.query(`
      SELECT q.*, s.status as supplier_status, s.risk_flag, s.risk_reason, s.risk_level, CURRENT_DATE as today
      FROM supplier_quotes q
      JOIN suppliers s ON s.supplier_id = q.supplier_id
      WHERE q.quote_id = $1 AND q.rfq_id = $2;
    `, [quoteId, rfqId]);

    if (quoteRes.rows.length === 0) {
      throw new AppError(404, 'NOT_FOUND', `Quote '${quoteId}' not found for RFQ '${rfqId}'`);
    }
    const quote = quoteRes.rows[0];

    // 4. RULE_QUOTE_EXPIRED check
    if (quote.valid_until < quote.today) {
      throw new AppError(422, 'RULE_QUOTE_EXPIRED', `Selected quote expired on ${quote.valid_until} and cannot be awarded`);
    }

    // 5. RULE_SUPPLIER_INACTIVE check
    if (quote.supplier_status !== 'active') {
      throw new AppError(422, 'RULE_SUPPLIER_INACTIVE', `Supplier '${quote.supplier_id}' is ${quote.supplier_status}`);
    }

    // 6. Lowest cost check among eligible quotes
    const eligibleCostRes = await client.query(`
      SELECT min(q.total_landed_cost_base) as min_cost
      FROM supplier_quotes q
      JOIN suppliers s ON s.supplier_id = q.supplier_id
      WHERE q.rfq_id = $1
        AND q.valid_until >= CURRENT_DATE
        AND s.status = 'active'
        AND q.currency_code = $2;
    `, [rfqId, rfq.currency_code]);

    const minEligibleCost = parseFloat(eligibleCostRes.rows[0]?.min_cost || '0');
    const selectedCost = parseFloat(quote.total_landed_cost_base);
    const isLowestCost = Math.abs(selectedCost - minEligibleCost) < 0.01;

    // 7. RULE_RATIONALE_REQUIRED check
    if (!isLowestCost && (!rationale || !rationale.trim())) {
      throw new AppError(
        422,
        'RULE_RATIONALE_REQUIRED',
        'A documented rationale is required when awarding a quote that is not the lowest landed cost'
      );
    }

    // 8. Derive award basis
    const latestEvalRes = await client.query(`
      SELECT * FROM quote_evaluations WHERE quote_id = $1 ORDER BY evaluation_run DESC LIMIT 1;
    `, [quoteId]);
    const latestEval = latestEvalRes.rows[0] || null;

    let awardBasis = 'other';
    if (isLowestCost) {
      awardBasis = 'lowest_landed_cost';
    } else if (latestEval?.is_fastest) {
      awardBasis = 'fastest_delivery';
    } else if (latestEval && latestEval.weighted_score >= 0.7) {
      awardBasis = 'best_weighted_score';
    }

    if (awardBasis === 'other' && (!rationale || !rationale.trim())) {
      throw new AppError(422, 'RULE_RATIONALE_REQUIRED', 'Rationale is required for award basis other');
    }

    // 9. Insert rfq_awards
    const awardIdRes = await client.query("SELECT next_year_id('AWD') as id;");
    const awardId = awardIdRes.rows[0].id;

    await client.query(`
      INSERT INTO rfq_awards (
        award_id, rfq_id, quote_id, supplier_id, awarded_by, awarded_at, award_basis, is_lowest_cost, rationale
      ) VALUES ($1, $2, $3, $4, $5, NOW(), $6, $7, $8);
    `, [
      awardId,
      rfqId,
      quoteId,
      quote.supplier_id,
      user.id,
      awardBasis,
      isLowestCost,
      rationale || null
    ]);

    // 10. Update winner quote -> awarded
    await client.query("SELECT set_config('app.change_reason', $1, true);", ['Quote awarded']);
    await client.query("UPDATE supplier_quotes SET status = 'awarded', updated_at = NOW() WHERE quote_id = $1;", [quoteId]);

    // 11. Update other quotes -> rejected
    await client.query("SELECT set_config('app.change_reason', $1, true);", ['Quote rejected']);
    await client.query(`
      UPDATE supplier_quotes
      SET status = 'rejected', updated_at = NOW()
      WHERE rfq_id = $1 AND quote_id <> $2 AND status IN ('submitted', 'under_review');
    `, [rfqId, quoteId]);

    // 12. RFQ -> awarded
    await client.query("SELECT set_config('app.change_reason', $1, true);", ['RFQ awarded']);
    await client.query("UPDATE rfqs SET status = 'awarded', updated_at = NOW() WHERE rfq_id = $1;", [rfqId]);

    // 13. PR -> awarded
    const prRes = await client.query(`
      SELECT DISTINCT rl.pr_id
      FROM rfq_request_lines rrl
      JOIN request_lines rl ON rl.request_line_id = rrl.request_line_id
      WHERE rrl.rfq_id = $1;
    `, [rfqId]);

    if (prRes.rows.length > 0) {
      const prId = prRes.rows[0].pr_id;
      await client.query("SELECT set_config('app.change_reason', $1, true);", ['PR awarded']);
      await client.query("UPDATE purchase_requests SET status = 'awarded', updated_at = NOW() WHERE pr_id = $1;", [prId]);
    }

    // 14. If supplier.risk_flag insert exceptions row supplier_risk_flag
    if (quote.risk_flag) {
      const excIdRes = await client.query("SELECT next_year_id('EXC') as id;");
      await client.query(`
        INSERT INTO exceptions (
          exception_id, issue_type, entity_type, entity_id, severity, reason, status, detected_by, detected_at
        ) VALUES ($1, 'supplier_risk_flag', 'rfq_award', $2, $3, $4, 'open', 'system', NOW());
      `, [
        excIdRes.rows[0].id,
        awardId,
        quote.risk_level || 'medium',
        quote.risk_reason || 'Awarded supplier has an active risk flag'
      ]);
    }

    return {
      award_id: awardId,
      rfq_id: rfqId,
      quote_id: quoteId,
      supplier_id: quote.supplier_id,
      award_basis: awardBasis,
      is_lowest_cost: isLowestCost
    };
  });
};

export const createPurchaseOrderForRfq = async (rfqId, user) => {
  return withTx(async (client) => {
    // 1. Fetch RFQ and Award
    const rfqRes = await client.query('SELECT * FROM rfqs WHERE rfq_id = $1;', [rfqId]);
    if (rfqRes.rows.length === 0) {
      throw new AppError(404, 'NOT_FOUND', `RFQ '${rfqId}' not found`);
    }

    const awardRes = await client.query('SELECT * FROM rfq_awards WHERE rfq_id = $1;', [rfqId]);
    if (awardRes.rows.length === 0) {
      throw new AppError(422, 'RULE_NOT_AWARDED', 'Cannot create PO: RFQ has not been awarded');
    }
    const award = awardRes.rows[0];

    // Check if PO already exists
    const existingPoRes = await client.query(
      "SELECT po_id FROM purchase_orders WHERE rfq_id = $1 AND status <> 'cancelled';",
      [rfqId]
    );
    if (existingPoRes.rows.length > 0) {
      throw new AppError(422, 'PO_ALREADY_EXISTS', `PO '${existingPoRes.rows[0].po_id}' already exists for this RFQ`);
    }

    // 2. Fetch linked PR and check approvals
    const prRes = await client.query(`
      SELECT DISTINCT pr.*, ra.required_level
      FROM rfq_request_lines rrl
      JOIN request_lines rl ON rl.request_line_id = rrl.request_line_id
      JOIN purchase_requests pr ON pr.pr_id = rl.pr_id
      LEFT JOIN v_pr_required_approval ra ON ra.pr_id = pr.pr_id
      WHERE rrl.rfq_id = $1;
    `, [rfqId]);

    if (prRes.rows.length === 0) {
      throw new AppError(404, 'NOT_FOUND', 'Linked purchase request not found');
    }
    const pr = prRes.rows[0];

    const approvalsRes = await client.query(`
      SELECT count(distinct approval_level)::int as count
      FROM approvals
      WHERE pr_id = $1 AND decision = 'approved';
    `, [pr.pr_id]);
    const approvedCount = approvalsRes.rows[0].count;
    const requiredLevel = pr.required_level || 1;

    if (approvedCount < requiredLevel) {
      throw new AppError(
        422,
        'RULE_PO_REQUIRES_APPROVAL',
        `Cannot issue PO: PR requires ${requiredLevel} approvals, but only ${approvedCount} approved`
      );
    }

    // 3. Fetch quote and quote lines
    const quoteRes = await client.query('SELECT * FROM supplier_quotes WHERE quote_id = $1;', [award.quote_id]);
    const quote = quoteRes.rows[0];

    const quoteLinesRes = await client.query(`
      SELECT ql.*, rl.description as request_desc
      FROM quote_lines ql
      JOIN request_lines rl ON rl.request_line_id = ql.request_line_id
      WHERE ql.quote_id = $1
      ORDER BY ql.line_no ASC;
    `, [award.quote_id]);
    const quoteLines = quoteLinesRes.rows;

    // 4. Generate PO ID
    const poIdRes = await client.query("SELECT next_year_id('PO') as id;");
    const poId = poIdRes.rows[0].id;

    // 5. Insert PO
    await client.query(`
      INSERT INTO purchase_orders (
        po_id, pr_id, rfq_id, quote_id, award_id, supplier_id, issued_by, po_type,
        currency_code, subtotal, freight_cost, duty_cost, other_charges,
        payment_terms_days, issued_date, expected_delivery_date, status
      ) VALUES (
        $1, $2, $3, $4, $5, $6, $7, 'competitive',
        $8, $9, $10, $11, $12,
        $13, CURRENT_DATE, CURRENT_DATE + ($14)::int, 'issued'
      );
    `, [
      poId,
      pr.pr_id,
      rfqId,
      quote.quote_id,
      award.award_id,
      award.supplier_id,
      user.id,
      quote.currency_code,
      quote.subtotal,
      quote.freight_cost,
      quote.duty_cost,
      quote.other_charges,
      quote.payment_terms_days || 30,
      quote.delivery_days || 30
    ]);

    // 6. Insert po_lines copying every awarded quote line
    for (let i = 0; i < quoteLines.length; i++) {
      const ql = quoteLines[i];
      const poLineId = `${poId}-L${String(i + 1).padStart(2, '0')}`;
      await client.query(`
        INSERT INTO purchase_order_lines (
          po_line_id, po_id, line_no, request_line_id, quote_line_id, description, quantity, unit_price
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8);
      `, [
        poLineId,
        poId,
        i + 1,
        ql.request_line_id,
        ql.quote_line_id,
        ql.request_desc || 'Quote item',
        ql.quantity,
        ql.unit_price
      ]);
    }

    // 7. Initial status_events for PO
    await client.query(`
      INSERT INTO status_events (entity_type, entity_id, from_status, to_status, actor_id, reason)
      VALUES ('purchase_order', $1, NULL, 'issued', $2, 'Purchase order issued from awarded RFQ');
    `, [poId, user.id]);

    // 8. PR -> po_issued
    await client.query("SELECT set_config('app.change_reason', $1, true);", ['Purchase order issued']);
    await client.query("UPDATE purchase_requests SET status = 'po_issued', updated_at = NOW() WHERE pr_id = $1;", [pr.pr_id]);

    // 9. Budget ledger: reservation_release & commitment
    await client.query(`
      INSERT INTO budget_ledger (budget_id, entry_type, amount, pr_id, entry_date, notes)
      VALUES ($1, 'reservation_release', $2, $3, CURRENT_DATE, 'Reservation release on competitive PO issue');
    `, [pr.budget_id, pr.estimated_total, pr.pr_id]);

    await client.query(`
      INSERT INTO budget_ledger (budget_id, entry_type, amount, po_id, entry_date, notes)
      VALUES ($1, 'commitment', $2, $3, CURRENT_DATE, 'Commitment on competitive PO issue');
    `, [pr.budget_id, quote.total_landed_cost_base, poId]);

    return {
      po_id: poId,
      pr_id: pr.pr_id,
      rfq_id: rfqId,
      quote_id: quote.quote_id,
      supplier_id: award.supplier_id,
      total_amount: parseFloat(quote.total_landed_cost_base),
      status: 'issued'
    };
  });
};
