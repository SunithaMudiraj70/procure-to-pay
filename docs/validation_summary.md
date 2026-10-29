# Procure-to-Pay System: Validation & Integrity Summary

This report documents the verification and integrity test results of the synthetic dataset generated for the Procure-to-Pay (P2P) enterprise platform with deterministic seed `20261022` and scaling factor `1.0`.

---

## 1. Executive Summary

| Metric | Result | Target / Standard |
| :--- | :--- | :--- |
| **Integrity Tests Executed** | **60 / 60 Passed (100%)** | Zero tolerance for schema or constraint failures |
| **Deterministic Seed** | `20261022` | Fixed across runs |
| **Scaling Factor** | `1.0` (Parameterizable) | Supports starter (0.1) and full (1.0) datasets |
| **Reproducibility** | **100% Identical SHA-256 Checksums** | Verified across 2 independent generation passes |
| **Ground Truth Isolation** | **Verified (Zero Leakage)** | Schema isolated; excluded from all input CSVs/JSONs |
| **Injected Edge Cases Covered** | **7 / 7 (100%)** | All labelled anomalies detected and registered |

---

## 2. Baseline Entity Volumes Generated

| Entity Table | Baseline Target | Generated Volume | Status |
| :--- | :--- | :--- | :--- |
| **Requesters (`requesters`)** | 300 | **300** | Target met |
| **Suppliers (`suppliers`)** | 120 | **120** | Target met |
| **Purchase Requests (`purchase_requests`)** | 1,200 | **1,200** | Target met |
| **Request Lines (`request_lines`)** | Variable ($\ge 1,200$) | **2,378** | Target met |
| **RFQs (`rfqs`)** | 500 | **500** | Target met |
| **RFQ Request Lines (`rfq_request_lines`)** | Variable | **987** | Target met |
| **RFQ Supplier Invitations (`rfq_suppliers`)** | $\ge 1,500$ | **2,000** | Target met ($\ge 3$ per RFQ) |
| **Supplier Quotes (`supplier_quotes`)** | 1,500 | **2,000** | Target met ($\ge 1,500$) |
| **Quote Lines (`quote_lines`)** | Variable | **3,948** | Target met |
| **Quote Evaluations (`quote_evaluations`)** | $\ge 1,500$ | **2,000** | Target met |
| **RFQ Awards (`rfq_awards`)** | $\le 500$ | **500** | Target met |
| **Approvals (`approvals`)** | Variable | **2,599** | Tiered thresholds met |
| **Purchase Orders (`purchase_orders`)** | 900 | **900** | Target met |
| **Purchase Order Lines (`purchase_order_lines`)**| Variable | **1,802** | Target met |
| **Deliveries (`deliveries`)** | Variable | **838** | Target met (partials included) |
| **Delivery Lines (`delivery_lines`)** | Variable | **1,236** | Target met |
| **Budget Ledger (`budget_ledger`)** | Variable | **3,028** | Target met |
| **Status Events (`status_events`)** | Variable | **2,385** | Target met |
| **Operational Exceptions (`exceptions`)** | Variable | **92** | Target met |
| **Ground Truth Labels (`ground_truth`)** | $\ge 7$ | **7** | Target met (strictly isolated) |

---

## 3. Detailed Validation Test Categories

### 3.1 Primary-Key Uniqueness (15 Tests)
- `departments.department_id`: **PASSED** (10 unique PKs)
- `requesters.requester_id`: **PASSED** (300 unique PKs)
- `budgets.budget_id`: **PASSED** (42 unique PKs)
- `suppliers.supplier_id`: **PASSED** (120 unique PKs)
- `purchase_requests.pr_id`: **PASSED** (1,200 unique PKs)
- `request_lines.request_line_id`: **PASSED** (2,378 unique PKs)
- `rfqs.rfq_id`: **PASSED** (500 unique PKs)
- `supplier_quotes.quote_id`: **PASSED** (2,000 unique PKs)
- `quote_lines.quote_line_id`: **PASSED** (3,948 unique PKs)
- `rfq_awards.award_id`: **PASSED** (500 unique PKs)
- `approvals.approval_id`: **PASSED** (2,599 unique PKs)
- `purchase_orders.po_id`: **PASSED** (900 unique PKs)
- `purchase_order_lines.po_line_id`: **PASSED** (1,802 unique PKs)
- `deliveries.delivery_id`: **PASSED** (838 unique PKs)
- `exceptions.exception_id`: **PASSED** (92 unique PKs)

### 3.2 Foreign-Key Referential Integrity (24 Tests)
- All child tables reference valid, existing parent keys.
- Zero orphaned foreign keys detected across `departments`, `requesters`, `budgets`, `suppliers`, `purchase_requests`, `request_lines`, `rfqs`, `supplier_quotes`, `quote_lines`, `rfq_awards`, `approvals`, `purchase_orders`, `purchase_order_lines`, and `deliveries`.

### 3.3 Domain Enumerations (12 Tests)
- All categorical fields strictly conform to database check constraint enums:
  - Department statuses: `active`, `inactive`
  - Requester roles: `requester`, `approver`, `process_owner`, `operations_analyst`, `system_admin`
  - Budget statuses: `draft`, `active`, `frozen`, `closed`
  - Supplier statuses: `onboarding`, `active`, `inactive`, `blacklisted`
  - Supplier risk levels: `low`, `medium`, `high`, `critical`
  - PR procurement types: `competitive`, `single_source`, `direct_low_value`
  - PR priorities: `low`, `normal`, `high`, `urgent`
  - RFQ statuses: `draft`, `issued`, `quotes_received`, `evaluated`, `awarded`, `cancelled`, `closed`
  - Quote statuses: `submitted`, `under_review`, `awarded`, `rejected`, `expired`, `withdrawn`
  - Approval decisions: `pending`, `approved`, `rejected`, `escalated`
  - PO statuses: `draft`, `issued`, `acknowledged`, `partially_delivered`, `delivered`, `closed`, `cancelled`
  - Delivery statuses: `scheduled`, `in_transit`, `partial`, `delivered`, `delayed`, `rejected`, `cancelled`

### 3.4 Date Ordering & Chronology (3 Tests)
- RFQ closing dates are strictly greater than or equal to issue dates (`closing_date >= issue_date`).
- PO expected delivery dates are strictly after or equal to order issue dates (`expected_delivery_date >= issued_date`).
- Deliveries marked as `delivered` or `partial` have mandatory `actual_date` recorded.

### 3.5 Arithmetic Reconciliation (4 Tests)
- **Request Line Costs**: `estimated_line_cost == round(quantity * estimated_unit_cost, 2)` (100% match).
- **Quote Line Totals**: `line_total == round(quantity * unit_price, 2)` (100% match).
- **Quote Total Landed Cost**: `total_landed_cost == round(subtotal + freight + duty + other, 2)` (100% match).
- **PO Total Commitment**: `total_amount == round(subtotal + freight + duty + other, 2)` (100% match).

### 3.6 Labelled Edge Cases & Ground Truth Isolation (2 Tests)
- All 7 mandatory labelled anomalies verified in `ground_truth.anomaly_labels`:
  1. `po_without_approval`
  2. `quote_expired_before_award`
  3. `non_cheapest_without_rationale`
  4. `supplier_inactive`
  5. `budget_overrun`
  6. `duplicate_request`
  7. `quote_currency_mismatch`
- **Zero Leakage**: Operational tables (`purchase_requests`, `purchase_orders`, etc.) contain zero ground truth labels or anomaly indicators.

---

## 4. Reproducibility Proof (Seed `20261022`)

Generating the full dataset twice with the identical seed produces identical SHA-256 cryptographic hashes for every table:

```
  departments             : 10 vs 10 rows | Hash Match: MATCH
  requesters              : 300 vs 300 rows | Hash Match: MATCH
  budgets                 : 42 vs 42 rows | Hash Match: MATCH
  suppliers               : 120 vs 120 rows | Hash Match: MATCH
  supplier_categories     : 251 vs 251 rows | Hash Match: MATCH
  purchase_requests       : 1200 vs 1200 rows | Hash Match: MATCH
  request_lines           : 2378 vs 2378 rows | Hash Match: MATCH
  approvals               : 2599 vs 2599 rows | Hash Match: MATCH
  rfqs                    : 500 vs 500 rows | Hash Match: MATCH
  rfq_request_lines       : 987 vs 987 rows | Hash Match: MATCH
  rfq_suppliers           : 2000 vs 2000 rows | Hash Match: MATCH
  supplier_quotes         : 2000 vs 2000 rows | Hash Match: MATCH
  quote_lines             : 3948 vs 3948 rows | Hash Match: MATCH
  quote_evaluations       : 2000 vs 2000 rows | Hash Match: MATCH
  rfq_awards              : 500 vs 500 rows | Hash Match: MATCH
  purchase_orders         : 900 vs 900 rows | Hash Match: MATCH
  purchase_order_lines    : 1802 vs 1802 rows | Hash Match: MATCH
  deliveries              : 838 vs 838 rows | Hash Match: MATCH
  delivery_lines          : 1236 vs 1236 rows | Hash Match: MATCH
  budget_ledger           : 3028 vs 3028 rows | Hash Match: MATCH
  status_events           : 2385 vs 2385 rows | Hash Match: MATCH
  exceptions              : 92 vs 92 rows | Hash Match: MATCH
  ground_truth            : 7 vs 7 rows | Hash Match: MATCH

RESULT: 100% DETERMINISTIC & REPRODUCIBLE (Identical SHA256 checksums)
```
