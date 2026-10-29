import { test, before, after, describe } from 'node:test';
import assert from 'node:assert/strict';
import app from '../src/app.js';
import pool, { setTestClient, clearTestClient } from '../src/config/pg.js';

let server;
let baseUrl;
let testClient;

const USERS = {
  requester: 'RQT-000001',
  requester2: 'RQT-000002',
  approverL1: 'RQT-000003',
  approverL2: 'RQT-000004',
  approverL3: 'RQT-000005',
  approverL4: 'RQT-000006',
  processOwner: 'RQT-000007',
  opsAnalyst: 'RQT-000008',
  admin: 'RQT-000009'
};

const SUPPLIERS = {
  acme: 'SUP-000001',
  beta: 'SUP-000002',
  gamma: 'SUP-000003',
  inactive: 'SUP-000004'
};

const BUDGET_ID = 'BUD-2026-0001';
const DEPT_ID = 'DEP-001';

before(async () => {
  // 1. Start ephemeral HTTP server
  server = app.listen(0);
  await new Promise((resolve) => server.once('listening', resolve));
  const port = server.address().port;
  baseUrl = `http://127.0.0.1:${port}`;

  // 2. Start outer transaction on dedicated test client
  testClient = await pool.connect();
  await testClient.query('BEGIN');
  setTestClient(testClient);

  // 3. Configure fixture states inside test transaction
  await testClient.query(`
    UPDATE budgets SET allocated_amount = 50000000.00, status = 'active' WHERE budget_id = '${BUDGET_ID}';

    UPDATE requesters SET department_id = '${DEPT_ID}', role = 'requester', approval_level = null, is_active = true WHERE requester_id = '${USERS.requester}';
    UPDATE requesters SET department_id = '${DEPT_ID}', role = 'requester', approval_level = null, is_active = true WHERE requester_id = '${USERS.requester2}';
    UPDATE requesters SET department_id = '${DEPT_ID}', role = 'approver', approval_level = 1, is_active = true WHERE requester_id = '${USERS.approverL1}';
    UPDATE requesters SET department_id = '${DEPT_ID}', role = 'approver', approval_level = 2, is_active = true WHERE requester_id = '${USERS.approverL2}';
    UPDATE requesters SET department_id = '${DEPT_ID}', role = 'approver', approval_level = 3, is_active = true WHERE requester_id = '${USERS.approverL3}';
    UPDATE requesters SET department_id = '${DEPT_ID}', role = 'approver', approval_level = 4, is_active = true WHERE requester_id = '${USERS.approverL4}';
    UPDATE requesters SET department_id = '${DEPT_ID}', role = 'process_owner', approval_level = null, is_active = true WHERE requester_id = '${USERS.processOwner}';
    UPDATE requesters SET department_id = '${DEPT_ID}', role = 'operations_analyst', approval_level = null, is_active = true WHERE requester_id = '${USERS.opsAnalyst}';
    UPDATE requesters SET department_id = '${DEPT_ID}', role = 'system_admin', approval_level = null, is_active = true WHERE requester_id = '${USERS.admin}';

    UPDATE suppliers SET status = 'active', risk_level = 'low', risk_flag = false, risk_reason = null WHERE supplier_id = '${SUPPLIERS.acme}';
    UPDATE suppliers SET status = 'active', risk_level = 'medium', risk_flag = false, risk_reason = null WHERE supplier_id = '${SUPPLIERS.beta}';
    UPDATE suppliers SET status = 'active', risk_level = 'high', risk_flag = true, risk_reason = 'Past delivery delays' WHERE supplier_id = '${SUPPLIERS.gamma}';
    UPDATE suppliers SET status = 'inactive', risk_level = 'low', risk_flag = false, risk_reason = null WHERE supplier_id = '${SUPPLIERS.inactive}';

    INSERT INTO supplier_categories (supplier_id, category)
    VALUES
      ('${SUPPLIERS.acme}', 'Hardware'),
      ('${SUPPLIERS.beta}', 'Hardware'),
      ('${SUPPLIERS.gamma}', 'Hardware')
    ON CONFLICT DO NOTHING;

    INSERT INTO id_counters (counter_key, last_value)
    VALUES
      ('PR-2026', COALESCE((SELECT MAX(SUBSTRING(pr_id FROM 9)::bigint) FROM purchase_requests WHERE pr_id LIKE 'PR-2026-%'), 0)),
      ('RFQ-2026', COALESCE((SELECT MAX(SUBSTRING(rfq_id FROM 10)::bigint) FROM rfqs WHERE rfq_id LIKE 'RFQ-2026-%'), 0)),
      ('PO-2026', COALESCE((SELECT MAX(SUBSTRING(po_id FROM 9)::bigint) FROM purchase_orders WHERE po_id LIKE 'PO-2026-%'), 0)),
      ('QUO-2026', COALESCE((SELECT MAX(SUBSTRING(quote_id FROM 'QUO-[A-Z0-9]+-2026-([0-9]+)')::bigint) FROM supplier_quotes WHERE quote_id LIKE 'QUO-%-2026-%'), 0)),
      ('APR-2026', COALESCE((SELECT MAX(SUBSTRING(approval_id FROM 10)::bigint) FROM approvals WHERE approval_id LIKE 'APR-2026-%'), 0)),
      ('AWD-2026', COALESCE((SELECT MAX(SUBSTRING(award_id FROM 10)::bigint) FROM rfq_awards WHERE award_id LIKE 'AWD-2026-%'), 0)),
      ('EXC-2026', COALESCE((SELECT MAX(SUBSTRING(exception_id FROM 10)::bigint) FROM exceptions WHERE exception_id LIKE 'EXC-2026-%'), 0)),
      ('RQT', COALESCE((SELECT MAX(SUBSTRING(requester_id FROM 5)::bigint) FROM requesters WHERE requester_id LIKE 'RQT-%'), 0)),
      ('SUP', COALESCE((SELECT MAX(SUBSTRING(supplier_id FROM 5)::bigint) FROM suppliers WHERE supplier_id LIKE 'SUP-%'), 0))
    ON CONFLICT (counter_key) DO UPDATE SET last_value = GREATEST(id_counters.last_value, EXCLUDED.last_value);
  `);
});

after(async () => {
  // Roll back the entire test transaction so DB remains completely untouched
  if (testClient) {
    try {
      await testClient.query('ROLLBACK');
    } catch (e) {
      console.error('Error during test rollback:', e.message);
    }
    testClient.release();
    clearTestClient();
  }

  if (server) {
    await new Promise((resolve) => server.close(resolve));
  }

  await pool.end();
});

const apiCall = async (method, path, body = null, userId = null) => {
  const headers = { 'Content-Type': 'application/json' };
  if (userId) headers['X-User-Id'] = userId;

  const res = await fetch(`${baseUrl}${path}`, {
    method,
    headers,
    body: body ? JSON.stringify(body) : undefined
  });

  const text = await res.text();
  let json = null;
  try {
    json = JSON.parse(text);
  } catch {
    json = text;
  }

  return { status: res.status, headers: res.headers, data: json };
};

describe('Procure-to-Pay Integration & Rule Verification Tests', () => {

  test('1. Authentication & Role-based Permissions', async () => {
    // Missing X-User-Id returns 401
    const noAuth = await apiCall('POST', '/api/requests', { title: 'Test' }, null);
    assert.equal(noAuth.status, 401);
    assert.equal(noAuth.data.code, 'UNAUTHORIZED');

    // Unknown X-User-Id returns 401
    const badAuth = await apiCall('POST', '/api/requests', { title: 'Test' }, 'RQT-999999');
    assert.equal(badAuth.status, 401);

    // Wrong role returns 403 (approver trying to create PR)
    const wrongRole = await apiCall('POST', '/api/requests', {
      budgetId: BUDGET_ID,
      title: 'Disallowed PR',
      procurementType: 'competitive',
      lines: [{ itemCode: 'ITEM-1', description: 'Item 1', category: 'Hardware', quantity: 1, estimatedUnitCost: 100 }]
    }, USERS.approverL1);
    assert.equal(wrongRole.status, 403);
    assert.equal(wrongRole.data.code, 'FORBIDDEN');
  });

  test('2. Threshold path preview (4,999.99 -> Level 1, 5,000 -> Level 2, 100,000 -> Level 4)', async () => {
    const preview1 = await apiCall('GET', `/api/requests/preview?total=4999.99&budgetId=${BUDGET_ID}`);
    assert.equal(preview1.status, 200);
    assert.equal(preview1.data.requiredLevel, 1);
    assert.equal(preview1.data.approvalPath.length, 1);
    assert.equal(preview1.data.approvalPath[0].level, 1);

    const preview2 = await apiCall('GET', `/api/requests/preview?total=5000&budgetId=${BUDGET_ID}`);
    assert.equal(preview2.status, 200);
    assert.equal(preview2.data.requiredLevel, 2);
    assert.equal(preview2.data.approvalPath.length, 2);

    const preview4 = await apiCall('GET', `/api/requests/preview?total=100000&budgetId=${BUDGET_ID}`);
    assert.equal(preview4.status, 200);
    assert.equal(preview4.data.requiredLevel, 4);
    assert.equal(preview4.data.approvalPath.length, 4);
  });

  test('3. PR Creation, Single Source Validation, and Submission Checks', async () => {
    // Single source without justification returns 422 RULE_SINGLE_SOURCE_JUSTIFICATION
    const invalidSs = await apiCall('POST', '/api/requests', {
      budgetId: BUDGET_ID,
      title: 'Single Source Lacking Justification',
      procurementType: 'single_source',
      lines: [{ itemCode: 'ITM-01', description: 'Specialized Hardware', category: 'Hardware', quantity: 2, estimatedUnitCost: 500 }]
    }, USERS.requester);
    assert.equal(invalidSs.status, 422);
    assert.equal(invalidSs.data.code, 'RULE_SINGLE_SOURCE_JUSTIFICATION');

    // Create valid draft PR (Total = $6,100 -> Level 2)
    const createRes = await apiCall('POST', '/api/requests', {
      budgetId: BUDGET_ID,
      title: 'Servers Sourcing',
      justification: 'New infra requirements',
      procurementType: 'competitive',
      priority: 'high',
      lines: [
        { itemCode: 'SRV-01', description: 'Rack Server Node', category: 'Hardware', quantity: 2, estimatedUnitCost: 3050 }
      ]
    }, USERS.requester);
    assert.equal(createRes.status, 201);
    assert.equal(createRes.data.status, 'draft');
    assert.equal(createRes.data.estimated_total, 6100);
    const prId = createRes.data.pr_id;

    // Submit PR by wrong user returns 403
    const submitWrong = await apiCall('POST', `/api/requests/${prId}/submit`, {}, USERS.requester2);
    assert.equal(submitWrong.status, 403);

    // Submit PR successfully
    const submitRes = await apiCall('POST', `/api/requests/${prId}/submit`, {}, USERS.requester);
    assert.equal(submitRes.status, 200);
    assert.equal(submitRes.data.status, 'pending_approval');
    assert.equal(submitRes.data.required_level, 2);
  });

  test('4. Approval Order Enforcement (RULE_APPROVAL_ORDER)', async () => {
    // Create and submit a PR with unique total ($7,200 -> Level 2)
    const prRes = await apiCall('POST', '/api/requests', {
      budgetId: BUDGET_ID,
      title: 'Network Switches',
      procurementType: 'competitive',
      lines: [{ itemCode: 'SW-01', description: 'Managed Switch', category: 'Hardware', quantity: 3, estimatedUnitCost: 2400 }]
    }, USERS.requester);
    const prId = prRes.data.pr_id;
    await apiCall('POST', `/api/requests/${prId}/submit`, {}, USERS.requester);

    // Get approvals for this PR from PR details
    const prDetail = await apiCall('GET', `/api/requests/${prId}`);
    const prApprovals = prDetail.data.approvals;
    const aprL1 = prApprovals.find((a) => a.approval_level === 1);
    const aprL2 = prApprovals.find((a) => a.approval_level === 2);

    assert.ok(aprL1 && aprL2, 'Expected Level 1 and Level 2 approvals to be generated');

    // Attempting to decide Level 2 before Level 1 is approved returns 422 RULE_APPROVAL_ORDER
    const badOrder = await apiCall('POST', `/api/approvals/${aprL2.approval_id}/decision`, {
      decision: 'approved'
    }, USERS.approverL2);
    assert.equal(badOrder.status, 422);
    assert.equal(badOrder.data.code, 'RULE_APPROVAL_ORDER');

    // Rejection without comments returns 422 RULE_COMMENT_REQUIRED
    const rejectNoComment = await apiCall('POST', `/api/approvals/${aprL1.approval_id}/decision`, {
      decision: 'rejected',
      comments: ''
    }, USERS.approverL1);
    assert.equal(rejectNoComment.status, 422);
    assert.equal(rejectNoComment.data.code, 'RULE_COMMENT_REQUIRED');

    // Approve Level 1
    const apr1Res = await apiCall('POST', `/api/approvals/${aprL1.approval_id}/decision`, {
      decision: 'approved',
      comments: 'Looks good'
    }, USERS.approverL1);
    assert.equal(apr1Res.status, 200);

    // Now Level 2 can be decided, which completes all approvals and marks PR approved
    const apr2Res = await apiCall('POST', `/api/approvals/${aprL2.approval_id}/decision`, {
      decision: 'approved',
      comments: 'Approved by Head'
    }, USERS.approverL2);
    assert.equal(apr2Res.status, 200);
    assert.equal(apr2Res.data.pr_status, 'approved');
  });

  test('5. Min-Quote Block on Award (RULE_MIN_QUOTES)', async () => {
    // 1. Create and approve competitive PR ($8,300)
    const prRes = await apiCall('POST', '/api/requests', {
      budgetId: BUDGET_ID,
      title: 'Laptops Competitive',
      procurementType: 'competitive',
      lines: [{ itemCode: 'LPT-01', description: 'Developer Laptop', category: 'Hardware', quantity: 5, estimatedUnitCost: 1660 }]
    }, USERS.requester);
    const prId = prRes.data.pr_id;
    await apiCall('POST', `/api/requests/${prId}/submit`, {}, USERS.requester);

    const prDetail = await apiCall('GET', `/api/requests/${prId}`);
    for (const apr of prDetail.data.approvals) {
      const approverId = apr.approval_level === 1 ? USERS.approverL1 : USERS.approverL2;
      await apiCall('POST', `/api/approvals/${apr.approval_id}/decision`, { decision: 'approved' }, approverId);
    }

    // 2. Issue RFQ to 3 suppliers
    const rfqRes = await apiCall('POST', `/api/requests/${prId}/rfq`, {
      supplierIds: [SUPPLIERS.acme, SUPPLIERS.beta, SUPPLIERS.gamma],
      closingDate: '2026-12-31',
      notes: 'Competitive RFP'
    }, USERS.processOwner);
    assert.equal(rfqRes.status, 201);
    const rfqId = rfqRes.data.rfq_id;

    // Get PR line ID
    const lineId = prDetail.data.lines[0].request_line_id;

    // 3. Submit only 1 quote (below policy min_quotes_required = 3)
    const quote1Res = await apiCall('POST', `/api/rfqs/${rfqId}/quotes`, {
      supplierId: SUPPLIERS.acme,
      quoteDate: '2026-10-01',
      validUntil: '2026-12-31',
      deliveryDays: 15,
      lines: [{ requestLineId: lineId, unitPrice: 1650, quantity: 5 }]
    }, USERS.processOwner);
    assert.equal(quote1Res.status, 201);
    const quote1Id = quote1Res.data.quote_id;

    // 4. Attempt to award RFQ with fewer than min quotes returns 422 RULE_MIN_QUOTES
    const awardRes = await apiCall('POST', `/api/rfqs/${rfqId}/award`, {
      quoteId: quote1Id
    }, USERS.processOwner);
    assert.equal(awardRes.status, 422);
    assert.equal(awardRes.data.code, 'RULE_MIN_QUOTES');
  });

  test('6. Rationale-Required Block and Expired-Quote Block', async () => {
    // 1. Create and approve PR ($9,400)
    const prRes = await apiCall('POST', '/api/requests', {
      budgetId: BUDGET_ID,
      title: 'Monitors Procurement',
      procurementType: 'competitive',
      lines: [{ itemCode: 'MON-01', description: '4K Display', category: 'Hardware', quantity: 10, estimatedUnitCost: 940 }]
    }, USERS.requester);
    const prId = prRes.data.pr_id;
    await apiCall('POST', `/api/requests/${prId}/submit`, {}, USERS.requester);

    const prDetail = await apiCall('GET', `/api/requests/${prId}`);
    for (const apr of prDetail.data.approvals) {
      const approverId = apr.approval_level === 1 ? USERS.approverL1 : USERS.approverL2;
      await apiCall('POST', `/api/approvals/${apr.approval_id}/decision`, { decision: 'approved' }, approverId);
    }

    const lineId = prDetail.data.lines[0].request_line_id;

    // Issue RFQ
    const rfqRes = await apiCall('POST', `/api/requests/${prId}/rfq`, {
      supplierIds: [SUPPLIERS.acme, SUPPLIERS.beta, SUPPLIERS.gamma],
      closingDate: '2026-12-31'
    }, USERS.processOwner);
    const rfqId = rfqRes.data.rfq_id;

    // Submit Quote 1 (ACME: $800, cheapest, valid)
    const q1 = await apiCall('POST', `/api/rfqs/${rfqId}/quotes`, {
      supplierId: SUPPLIERS.acme,
      quoteDate: '2026-10-01',
      validUntil: '2026-12-31',
      deliveryDays: 10,
      lines: [{ requestLineId: lineId, unitPrice: 800, quantity: 10 }]
    }, USERS.processOwner);

    // Submit Quote 2 (BETA: $850, more expensive, valid)
    const q2 = await apiCall('POST', `/api/rfqs/${rfqId}/quotes`, {
      supplierId: SUPPLIERS.beta,
      quoteDate: '2026-10-01',
      validUntil: '2026-12-31',
      deliveryDays: 8,
      lines: [{ requestLineId: lineId, unitPrice: 850, quantity: 10 }]
    }, USERS.processOwner);

    // Submit Quote 3 (GAMMA: $780, but expired on 2026-01-01)
    const q3 = await apiCall('POST', `/api/rfqs/${rfqId}/quotes`, {
      supplierId: SUPPLIERS.gamma,
      quoteDate: '2025-12-01',
      validUntil: '2026-01-01',
      deliveryDays: 5,
      lines: [{ requestLineId: lineId, unitPrice: 780, quantity: 10 }]
    }, USERS.processOwner);

    // Evaluate quotes
    const evalRes = await apiCall('POST', `/api/rfqs/${rfqId}/evaluate`, {}, USERS.processOwner);
    assert.equal(evalRes.status, 200);

    // Test Expired Quote Block: attempting to award Q3 returns 422 RULE_QUOTE_EXPIRED
    const awardExpired = await apiCall('POST', `/api/rfqs/${rfqId}/award`, {
      quoteId: q3.data.quote_id
    }, USERS.processOwner);
    assert.equal(awardExpired.status, 422);
    assert.equal(awardExpired.data.code, 'RULE_QUOTE_EXPIRED');

    // Test Rationale-Required Block: attempting to award Q2 (not lowest cost) without rationale returns 422 RULE_RATIONALE_REQUIRED
    const awardNonCheapestNoReason = await apiCall('POST', `/api/rfqs/${rfqId}/award`, {
      quoteId: q2.data.quote_id,
      rationale: ''
    }, USERS.processOwner);
    assert.equal(awardNonCheapestNoReason.status, 422);
    assert.equal(awardNonCheapestNoReason.data.code, 'RULE_RATIONALE_REQUIRED');

    // Successfully award Q1 (lowest cost)
    const awardCheapest = await apiCall('POST', `/api/rfqs/${rfqId}/award`, {
      quoteId: q1.data.quote_id
    }, USERS.processOwner);
    assert.equal(awardCheapest.status, 200);
    assert.equal(awardCheapest.data.is_lowest_cost, true);
    assert.equal(awardCheapest.data.award_basis, 'lowest_landed_cost');
  });

  test('7. Over-Delivery Block (RULE_OVER_DELIVERY) and Partial Deliveries', async () => {
    // 1. Create, approve, RFQ, quote, award, and create PO ($10,500)
    const prRes = await apiCall('POST', '/api/requests', {
      budgetId: BUDGET_ID,
      title: 'SSD Disks',
      procurementType: 'competitive',
      lines: [{ itemCode: 'SSD-01', description: '2TB NVMe SSD', category: 'Hardware', quantity: 10, estimatedUnitCost: 1050 }]
    }, USERS.requester);
    const prId = prRes.data.pr_id;
    await apiCall('POST', `/api/requests/${prId}/submit`, {}, USERS.requester);

    const prDetail = await apiCall('GET', `/api/requests/${prId}`);
    for (const apr of prDetail.data.approvals) {
      const approverId = apr.approval_level === 1 ? USERS.approverL1 : USERS.approverL2;
      await apiCall('POST', `/api/approvals/${apr.approval_id}/decision`, { decision: 'approved' }, approverId);
    }

    const lineId = prDetail.data.lines[0].request_line_id;

    const rfqRes = await apiCall('POST', `/api/requests/${prId}/rfq`, {
      supplierIds: [SUPPLIERS.acme, SUPPLIERS.beta, SUPPLIERS.gamma],
      closingDate: '2026-12-31'
    }, USERS.processOwner);
    const rfqId = rfqRes.data.rfq_id;

    for (const suppId of [SUPPLIERS.acme, SUPPLIERS.beta, SUPPLIERS.gamma]) {
      await apiCall('POST', `/api/rfqs/${rfqId}/quotes`, {
        supplierId: suppId,
        quoteDate: '2026-10-01',
        validUntil: '2026-12-31',
        deliveryDays: 14,
        lines: [{ requestLineId: lineId, unitPrice: 1000, quantity: 10 }]
      }, USERS.processOwner);
    }

    const comparisonRes = await apiCall('GET', `/api/rfqs/${rfqId}/comparison`);
    const awardRes = await apiCall('POST', `/api/rfqs/${rfqId}/award`, {
      quoteId: comparisonRes.data.quotes[0].quote_id
    }, USERS.processOwner);
    assert.equal(awardRes.status, 200);

    const poRes = await apiCall('POST', `/api/rfqs/${rfqId}/purchase-order`, {}, USERS.processOwner);
    assert.equal(poRes.status, 201);
    const poId = poRes.data.po_id;

    // Fetch PO lines
    const poDetail = await apiCall('GET', `/api/purchase-orders/${poId}`);
    const poLineId = poDetail.data.lines[0].po_line_id;

    // 2. Over-Delivery Block: trying to receive 15 when 10 was ordered returns 422 RULE_OVER_DELIVERY
    const overDel = await apiCall('POST', `/api/purchase-orders/${poId}/deliveries`, {
      scheduledDate: '2026-11-01',
      lines: [{ poLineId, qtyDelivered: 15 }]
    }, USERS.opsAnalyst);
    assert.equal(overDel.status, 422);
    assert.equal(overDel.data.code, 'RULE_OVER_DELIVERY');

    // 3. Partial Delivery: receive 4 of 10
    const partialDel = await apiCall('POST', `/api/purchase-orders/${poId}/deliveries`, {
      scheduledDate: '2026-11-01',
      actualDate: '2026-11-01',
      carrier: 'FedEx',
      trackingRef: 'TRK-12345',
      lines: [{ poLineId, qtyDelivered: 4, qtyRejected: 0 }]
    }, USERS.opsAnalyst);
    assert.equal(partialDel.status, 201);
    assert.equal(partialDel.data.status, 'partial');
    assert.equal(partialDel.data.po_status, 'partially_delivered');

    // Check that partial delivery exception was recorded
    const excRes = await apiCall('GET', '/api/exceptions?type=partial_delivery');
    assert.ok(excRes.data.data.length > 0);

    // Cancel PO block: attempting to cancel a PO that has deliveries returns 422 RULE_DELIVERY_EXISTS
    const cancelBlocked = await apiCall('POST', `/api/purchase-orders/${poId}/cancel`, {
      reason: 'No longer needed'
    }, USERS.processOwner);
    assert.equal(cancelBlocked.status, 422);
    assert.equal(cancelBlocked.data.code, 'RULE_DELIVERY_EXISTS');

    // 4. Final Delivery: receive remaining 6 of 10
    const finalDel = await apiCall('POST', `/api/purchase-orders/${poId}/deliveries`, {
      scheduledDate: '2026-11-05',
      actualDate: '2026-11-05',
      carrier: 'FedEx',
      trackingRef: 'TRK-67890',
      lines: [{ poLineId, qtyDelivered: 6, qtyRejected: 0 }]
    }, USERS.opsAnalyst);
    assert.equal(finalDel.status, 201);
    assert.equal(finalDel.data.status, 'delivered');
    assert.equal(finalDel.data.po_status, 'delivered');
  });

  test('8. Budget Reservation -> Commitment Ledger Arithmetic', async () => {
    // 1. Initial budget balance
    const initLookups = await apiCall('GET', '/api/lookups');
    const initBudget = initLookups.data.budgets.find((b) => b.budget_id === BUDGET_ID);
    const initialAvailable = initBudget.available_amount;

    // 2. Create single source PR of unique total $12,500
    const prRes = await apiCall('POST', '/api/requests', {
      budgetId: BUDGET_ID,
      title: 'Proprietary Database License',
      procurementType: 'single_source',
      singleSourceJustification: 'Sole vendor for patented technology',
      lines: [{ itemCode: 'LIC-01', description: 'DB License', category: 'Software', quantity: 1, estimatedUnitCost: 12500 }]
    }, USERS.requester);
    const prId = prRes.data.pr_id;

    // 3. Submit PR -> creates reservation of $12,500
    const submitRes = await apiCall('POST', `/api/requests/${prId}/submit`, {}, USERS.requester);
    assert.equal(submitRes.status, 200);

    const postSubmitLookups = await apiCall('GET', '/api/lookups');
    const postSubmitBudget = postSubmitLookups.data.budgets.find((b) => b.budget_id === BUDGET_ID);
    assert.equal(
      Math.round((initialAvailable - postSubmitBudget.available_amount) * 100) / 100,
      12500,
      'Available budget should decrease by the $12,500 reservation'
    );

    // 4. Approve all levels
    const prDetail = await apiCall('GET', `/api/requests/${prId}`);
    for (const apr of prDetail.data.approvals) {
      const approverId = apr.approval_level === 1 ? USERS.approverL1 : USERS.approverL2;
      await apiCall('POST', `/api/approvals/${apr.approval_id}/decision`, { decision: 'approved' }, approverId);
    }

    // 5. Issue Single Source PO -> releases $12,500 reservation and commits $12,500
    const poRes = await apiCall('POST', `/api/requests/${prId}/single-source-po`, {
      supplierId: SUPPLIERS.acme,
      justification: 'Sole source vendor'
    }, USERS.processOwner);
    assert.equal(poRes.status, 201);
    const poId = poRes.data.po_id;

    // Check ledger entries for this PR and PO
    const ledgerRows = await testClient.query(`
      SELECT entry_type, amount, pr_id, po_id
      FROM budget_ledger
      WHERE pr_id = $1 OR po_id = $2
      ORDER BY ledger_id ASC;
    `, [prId, poId]);

    const entryTypes = ledgerRows.rows.map((r) => r.entry_type);
    assert.deepEqual(entryTypes, ['reservation', 'reservation_release', 'commitment']);

    // Cancel PO -> releases commitment of $12,500
    const cancelRes = await apiCall('POST', `/api/purchase-orders/${poId}/cancel`, {
      reason: 'Budget cut'
    }, USERS.processOwner);
    assert.equal(cancelRes.status, 200);

    const postCancelLedger = await testClient.query(`
      SELECT entry_type, amount FROM budget_ledger WHERE po_id = $1 ORDER BY ledger_id ASC;
    `, [poId]);
    const poEntryTypes = postCancelLedger.rows.map((r) => r.entry_type);
    assert.deepEqual(poEntryTypes, ['commitment', 'commitment_release']);

    // Budget available amount should now be restored
    const finalLookups = await apiCall('GET', '/api/lookups');
    const finalBudget = finalLookups.data.budgets.find((b) => b.budget_id === BUDGET_ID);
    assert.equal(finalBudget.available_amount, initialAvailable);
  });

  test('9. History is Append-Only and Audit Trail', async () => {
    // Create, submit, and reject a PR with unique total $13,500 to verify append-only status_events
    const prRes = await apiCall('POST', '/api/requests', {
      budgetId: BUDGET_ID,
      title: 'Audit Trail Verification PR',
      procurementType: 'competitive',
      lines: [{ itemCode: 'AUD-01', description: 'Audit Item', category: 'Hardware', quantity: 1, estimatedUnitCost: 13500 }]
    }, USERS.requester);
    const prId = prRes.data.pr_id;

    await apiCall('POST', `/api/requests/${prId}/submit`, {}, USERS.requester);

    const prDetail = await apiCall('GET', `/api/requests/${prId}`);
    const apr = prDetail.data.approvals.find((a) => a.approval_level === 1);

    await apiCall('POST', `/api/approvals/${apr.approval_id}/decision`, {
      decision: 'rejected',
      comments: 'Audit test rejection'
    }, USERS.approverL1);

    // Verify chronological audit trail
    const auditRes = await apiCall('GET', `/api/requests/${prId}/audit`);
    assert.equal(auditRes.status, 200);
    assert.ok(auditRes.data.trail.length >= 3, 'Audit trail must contain multiple chronological events');

    // Query status_events directly: events were inserted and never overwritten
    const eventsQuery = await testClient.query(`
      SELECT event_id, from_status, to_status, reason
      FROM status_events
      WHERE entity_type = 'purchase_request' AND entity_id = $1
      ORDER BY event_id ASC;
    `, [prId]);

    const states = eventsQuery.rows.map((r) => r.to_status);
    assert.deepEqual(states, ['draft', 'pending_approval', 'rejected']);
  });

  test('10. Reports Summary and CSV Export', async () => {
    const summaryRes = await apiCall('GET', '/api/reports/summary');
    assert.equal(summaryRes.status, 200);
    assert.ok(summaryRes.data.cycle_times);
    assert.ok(summaryRes.data.savings);
    assert.ok(summaryRes.data.quote_competitiveness);
    assert.ok(summaryRes.data.fulfillment);
    assert.ok(summaryRes.data.exceptions);
    assert.ok(Array.isArray(summaryRes.data.budget_utilisation));

    const exportRequests = await apiCall('GET', '/api/reports/export?type=requests');
    assert.equal(exportRequests.status, 200);
    assert.ok(exportRequests.headers.get('content-type').includes('text/csv'));

    const exportExceptions = await apiCall('GET', '/api/reports/export?type=exceptions');
    assert.equal(exportExceptions.status, 200);
    assert.ok(exportExceptions.headers.get('content-type').includes('text/csv'));
  });

  test('11. Lookups and Active Users List', async () => {
    const usersRes = await apiCall('GET', '/api/lookups/users');
    assert.equal(usersRes.status, 200);
    assert.ok(Array.isArray(usersRes.data));
    assert.ok(usersRes.data.length >= 9);

    const lookupsRes = await apiCall('GET', '/api/lookups');
    assert.equal(lookupsRes.status, 200);
    assert.ok(Array.isArray(lookupsRes.data.departments));
    assert.ok(Array.isArray(lookupsRes.data.budgets));
    assert.ok(Array.isArray(lookupsRes.data.suppliers));
    assert.ok(Array.isArray(lookupsRes.data.thresholds));
    assert.ok(typeof lookupsRes.data.policy === 'object');
  });

});
