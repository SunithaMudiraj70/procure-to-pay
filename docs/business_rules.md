# Procure-to-Pay System: Business Rules & Validation Logic

This document specifies the business rules, threshold policies, lifecycle state machines, derived financial computations, and anomaly injection logic implemented across the Procure-to-Pay (P2P) platform.

---

## 1. Approval Thresholds & Governance Hierarchy

Purchase requests require tiered management approvals determined strictly by the requisition's `estimated_total` (derived from the sum of request lines):

| Tier Level | Approver Role | Min Amount (USD) | Max Amount (USD) | Required Approvals |
| :---: | :--- | :--- | :--- | :--- |
| **Level 1** | Department Manager | $0.00 | $5,000.00 | Level 1 sign-off |
| **Level 2** | Procurement Head | $5,000.00 | $25,000.00 | Level 1 + Level 2 sign-off |
| **Level 3** | Finance Director | $25,000.00 | $100,000.00 | Level 1 + Level 2 + Level 3 sign-off |
| **Level 4** | Chief Financial Officer (CFO) | $100,000.00 | No upper limit | Level 1 + Level 2 + Level 3 + Level 4 sign-off |

### Rules:
- A Purchase Order **cannot** be issued without all required approval levels having `decision = 'approved'` and `decided_at <= po.issued_date`.
- If a Purchase Order is issued before full approval, an exception `po_without_approval` is registered.
- Approvers must possess an `approval_level >= required_level`.

---

## 2. Procurement Pathways & RFQ Requirements

Every Purchase Request follows one of three procurement routes:
1. **Competitive Sourcing (`competitive`)**:
   - Mandatory for all requisitions with `estimated_total >= $5,000` (policy threshold).
   - Generates an RFQ covering the request lines.
   - At least 3 independent suppliers must be invited and submit valid quotations (`min_quotes_required >= 3`).
   - If an award is made with `< 3` quotes, an `insufficient_quotes` exception is logged.
2. **Single-Source Procurement (`single_source`)**:
   - Requires documented `single_source_justification` (e.g., sole patent holder, OEM warranty compliance, emergency disaster response).
   - Directly proceeds to award or PO without an RFQ, but generates an audit trail entry.
3. **Direct Low-Value Purchase (`direct_low_value`)**:
   - Permitted only for requisitions under `$5,000.00`.
   - Expedited purchase order generation permitted directly to catalog suppliers.

---

## 3. Landed Cost & Quote Evaluation Logic

### 3.1 Landed Cost Formulation
Suppliers submit nominal line items, freight, customs/tariffs, and auxiliary fees. The system automatically computes:
$$\text{Total Landed Cost} = \text{Subtotal} + \text{Freight Cost} + \text{Duty Cost} + \text{Other Charges}$$
$$\text{Total Landed Cost (Base)} = \text{round}(\text{Total Landed Cost} \times \text{FX Rate to Base}, 2)$$

Where `FX Rate to Base` converts foreign currencies (e.g. EUR, GBP, CAD, JPY) to the corporate reporting currency (`USD`).

### 3.2 Quote Scoring & Award Rationale
Quotes are evaluated according to a multi-criteria scoring algorithm:
$$\text{Cost Score} = \left(\frac{\text{Min Landed Cost in RFQ}}{\text{Quote Landed Cost Base}}\right) \times 100$$
$$\text{Delivery Score} = \left(\frac{\text{Min Delivery Days in RFQ}}{\text{Quote Delivery Days}}\right) \times 100$$
$$\text{Weighted Score} = (0.70 \times \text{Cost Score}) + (0.30 \times \text{Delivery Score})$$

### Rules:
- If an award is granted to a supplier who is **not** the lowest landed cost, a comprehensive written `rationale` is **mandatory** (e.g., expedited turnaround time, ISO quality certification, sole supplier meeting critical tolerances).
- If awarded without a documented rationale, an anomaly `non_cheapest_without_rationale` is recorded.
- Quotes cannot be awarded after their `valid_until` date. If awarded post-expiry, a `quote_expired_before_award` violation is logged.
- The quotation currency should match the RFQ comparison currency, otherwise `quote_currency_mismatch` is recorded.

---

## 4. Budget Ledger & Overrun Controls

Financial balances are computed strictly from double-entry ledger entries in `budget_ledger`:
$$\text{Adjustments} = \sum \text{adjustment}$$
$$\text{Reserved Open} = \sum \text{reservation} - \sum \text{reservation\_release}$$
$$\text{Committed} = \sum \text{commitment} - \sum \text{commitment\_release}$$
$$\text{Available Amount} = \text{Allocated Amount} + \text{Adjustments} - \text{Reserved Open} - \text{Committed}$$

### Rules:
- When a Purchase Request is submitted, an initial reservation is logged.
- When a Purchase Order is issued, the PR reservation is released and a formal PO commitment is posted.
- When $\text{Available Amount} < 0$, a `budget_overrun` exception is flagged.

---

## 5. Duplicate Requests & Split Purchases

### 5.1 Duplicate Request Detection
A Purchase Request is flagged as a duplicate (`duplicate_request`) if:
1. `duplicate_of_pr_id` is explicitly populated, OR
2. Same `requester_id`, same `department_id`, identical `estimated_total`, and `created_at` within 7 days of an earlier request.

### 5.2 Split Purchase Detection
Multiple smaller PRs originating from the same department within a 14-day window that individually fall below the $5,000 threshold but collectively exceed it with the same `split_group_id` are flagged as `split_purchase` to detect threshold circumvention.

---

## 6. Supplier Risk & Order Fulfilment

- **Supplier Inactivity**: If a Purchase Order is issued to a vendor whose status is `'inactive'` or `'blacklisted'`, a `supplier_inactive` violation is flagged.
- **Supplier Risk Flag**: Purchase Orders placed with vendors marked `risk_flag = TRUE` register a `supplier_risk_flag` alert.
- **Delivery Reconciliation**: PO receipts are reconciled:
  $$\text{Qty Outstanding} = \text{Qty Ordered} - \sum (\text{Qty Delivered} - \text{Qty Rejected})$$
  Partial deliveries are tracked through sequential delivery events (`delivery_seq >= 1`).
