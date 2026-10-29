# Procure-to-Pay System: Comprehensive Data Dictionary

This document details the data dictionary for the Procure-to-Pay (P2P) enterprise application, covering master data, transactional workflows, event tracking, anomaly detection, and ground truth validation.

---

## Table of Contents
1. [Department (`departments`)](#1-department-departments)
2. [Requester / User (`requesters`)](#2-requester--user-requesters)
3. [Budget (`budgets`)](#3-budget-budgets)
4. [Purchase Request (`purchase_requests`)](#4-purchase-request-purchase_requests)
5. [Request Line (`request_lines`)](#5-request-line-request_lines)
6. [Supplier (`suppliers` & `supplier_categories`)](#6-supplier-suppliers--supplier_categories)
7. [Request For Quotation (`rfqs`, `rfq_request_lines`, `rfq_suppliers`)](#7-request-for-quotation-rfqs-rfq_request_lines-rfq_suppliers)
8. [Supplier Quote (`supplier_quotes`, `quote_lines`, `quote_evaluations`, `rfq_awards`)](#8-supplier-quote-supplier_quotes-quote_lines-quote_evaluations-rfq_awards)
9. [Approval (`approvals` & `approval_thresholds`)](#9-approval-approvals--approval_thresholds)
10. [Purchase Order (`purchase_orders` & `purchase_order_lines`)](#10-purchase-order-purchase_orders--purchase_order_lines)
11. [Delivery (`deliveries` & `delivery_lines`)](#11-delivery-deliveries--delivery_lines)
12. [Audit & Supporting Tables (`budget_ledger`, `status_events`, `exceptions`, `ground_truth`)](#12-audit--supporting-tables)

---

## 1. Department (`departments`)
Represents internal cost centers and organizational business units that own budgets and originate purchase requests.

| Field Name | Type | Req/Opt | Allowed Values | Units | Uniqueness | Validation Rule |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| `department_id` | `TEXT` | Required | `DEP-[0-9]{3}` (e.g. `DEP-001`) | Identifier | Primary Key | Must match regex `^DEP-[0-9]{3}$`. Generated via `next_simple_id('DEP', 3)`. |
| `name` | `TEXT` | Required | Non-empty string (e.g. "Engineering") | Text | Unique | Case-sensitive unique department title across enterprise. |
| `cost_center` | `TEXT` | Required | Alphanumeric (e.g. "CC-ENG-101") | Code | Unique | Corporate financial ledger cost center identifier. |
| `status` | `TEXT` | Required | `'active'`, `'inactive'` | Status | Non-unique | Must be `'active'` or `'inactive'`. Inactive departments cannot originate new PRs. |
| `effective_from` | `DATE` | Required | ISO-8601 Date (`YYYY-MM-DD`) | Calendar Date | Non-unique | Defaults to `2026-01-01`. Valid opening date of department. |
| `effective_to` | `DATE` | Optional | ISO-8601 Date (`YYYY-MM-DD`) | Calendar Date | Non-unique | Must satisfy `effective_to IS NULL OR effective_to >= effective_from`. |
| `head_requester_id`| `TEXT` | Optional | `RQT-[0-9]{6}` | Identifier | Non-unique | Foreign key referencing `requesters(requester_id)`. Designated department lead. |
| `created_at` | `TIMESTAMPTZ`| Required| ISO-8601 Timestamp with TZ | Timestamp | Non-unique | Defaults to `now()`. |

---

## 2. Requester / User (`requesters`)
Represents system users, including regular purchase requesters, managerial approvers, operations analysts, and administrators.

| Field Name | Type | Req/Opt | Allowed Values | Units | Uniqueness | Validation Rule |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| `requester_id` | `TEXT` | Required | `RQT-[0-9]{6}` (e.g. `RQT-000001`) | Identifier | Primary Key | Must match regex `^RQT-[0-9]{6}$`. Generated via `next_simple_id('RQT', 6)`. |
| `employee_code` | `TEXT` | Required | Alphanumeric (e.g. `EMP-10492`) | Code | Unique | Globally unique enterprise staff badge or payroll code. |
| `full_name` | `TEXT` | Required | Non-empty string | Text | Non-unique | First and last name of employee. |
| `email` | `TEXT` | Required | Standard RFC 5322 email | Email Address | Unique | Matches regex `^[^@\s]+@[^@\s]+\.[^@\s]+$`. |
| `department_id` | `TEXT` | Required | `DEP-[0-9]{3}` | Identifier | Non-unique | Foreign key referencing `departments(department_id)`. |
| `role` | `TEXT` | Required | `'requester'`, `'approver'`, `'process_owner'`, `'operations_analyst'`, `'system_admin'` | Role | Non-unique | Role-based access control enum. |
| `approval_level`| `SMALLINT`| Optional | `1`, `2`, `3`, `4`, or `NULL` | Tier Level | Non-unique | `1`=Dept Mgr, `2`=Proc Head, `3`=Finance Dir, `4`=CFO. Constraint: `role <> 'approver' OR approval_level IS NOT NULL`. |
| `is_active` | `BOOLEAN` | Required | `TRUE`, `FALSE` | Boolean | Non-unique | Inactive staff cannot log in or sign off on approvals. Defaults to `TRUE`. |
| `hired_on` | `DATE` | Required | ISO-8601 Date (`YYYY-MM-DD`) | Calendar Date | Non-unique | Must be valid employment inception date. Defaults to `2020-01-01`. |
| `created_at` | `TIMESTAMPTZ`| Required| ISO-8601 Timestamp with TZ | Timestamp | Non-unique | Defaults to `now()`. |

---

## 3. Budget (`budgets`)
Tracks authorized fiscal allocations per department and optional procurement category.

| Field Name | Type | Req/Opt | Allowed Values | Units | Uniqueness | Validation Rule |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| `budget_id` | `TEXT` | Required | `BUD-[0-9]{4}-[0-9]{4}` (e.g. `BUD-2026-0001`) | Identifier | Primary Key | Must match regex `^BUD-[0-9]{4}-[0-9]{4}$`. |
| `department_id` | `TEXT` | Required | `DEP-[0-9]{3}` | Identifier | Composite Unique | Foreign key referencing `departments(department_id)`. |
| `fiscal_year` | `SMALLINT`| Required | `2020` to `2100` | Year | Composite Unique | Constraint: `fiscal_year BETWEEN 2020 AND 2100`. |
| `category` | `TEXT` | Optional | Commodity Category or `NULL` | Category | Composite Unique | `NULL` represents general department-wide budget. Unique on `(department_id, fiscal_year, coalesce(category, '*'))`. |
| `allocated_amount`| `NUMERIC(14,2)`| Required| Greater than `0.00` | Currency (USD) | Non-unique | Positive allocation. Constraint: `allocated_amount > 0`. |
| `currency_code` | `CHAR(3)` | Required | `USD`, `EUR`, `GBP`, `CAD`, etc. | ISO Currency | Non-unique | Must match regex `^[A-Z]{3}$`. Defaults to `'USD'`. |
| `effective_from`| `DATE` | Required | ISO-8601 Date (`YYYY-MM-DD`) | Calendar Date | Non-unique | Start of fiscal coverage (e.g. `2026-01-01`). |
| `effective_to` | `DATE` | Required | ISO-8601 Date (`YYYY-MM-DD`) | Calendar Date | Non-unique | End of fiscal coverage. Constraint: `effective_to >= effective_from`. |
| `status` | `TEXT` | Required | `'draft'`, `'active'`, `'frozen'`, `'closed'` | Status | Non-unique | Check constraint on allowed enums. Spend commitments only allowed on `'active'` budgets. |
| `created_at` | `TIMESTAMPTZ`| Required| ISO-8601 Timestamp with TZ | Timestamp | Non-unique | Defaults to `now()`. |

---

## 4. Purchase Request (`purchase_requests`)
Header record representing an employee's formal requisition for goods or services.

| Field Name | Type | Req/Opt | Allowed Values | Units | Uniqueness | Validation Rule |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| `pr_id` | `TEXT` | Required | `PR-[0-9]{4}-[0-9]{6}` (e.g. `PR-2026-000001`) | Identifier | Primary Key | Must match regex `^PR-[0-9]{4}-[0-9]{6}$`. Generated via `next_year_id('PR')`. |
| `requester_id` | `TEXT` | Required | `RQT-[0-9]{6}` | Identifier | Non-unique | Foreign key referencing `requesters(requester_id)`. |
| `department_id` | `TEXT` | Required | `DEP-[0-9]{3}` | Identifier | Non-unique | Foreign key referencing `departments(department_id)`. |
| `budget_id` | `TEXT` | Required | `BUD-[0-9]{4}-[0-9]{4}` | Identifier | Non-unique | Foreign key referencing `budgets(budget_id)`. |
| `title` | `TEXT` | Required | Non-empty concise description | Text | Non-unique | Requisition subject line. |
| `justification` | `TEXT` | Optional | Narrative text | Text | Non-unique | Business rationale for requisition. |
| `procurement_type`| `TEXT` | Required | `'competitive'`, `'single_source'`, `'direct_low_value'` | Type Enum | Non-unique | Constraint: `procurement_type <> 'single_source' OR single_source_justification IS NOT NULL`. |
| `single_source_justification`| `TEXT` | Optional | Narrative justification | Text | Non-unique | Mandatory if `procurement_type = 'single_source'`. |
| `currency_code` | `CHAR(3)` | Required | `USD` (or ISO code) | ISO Currency | Non-unique | Matches `^[A-Z]{3}$`. Defaults to `'USD'`. |
| `estimated_total`| `NUMERIC(14,2)`| Required| Greater than or equal to `0.00` | Currency | Non-unique | Derived automatically from sum of `request_lines.estimated_line_cost` via database trigger. |
| `priority` | `TEXT` | Required | `'low'`, `'normal'`, `'high'`, `'urgent'` | Priority | Non-unique | Check constraint on priority levels. Defaults to `'normal'`. |
| `needed_by_date`| `DATE` | Optional | ISO-8601 Date (`YYYY-MM-DD`) | Calendar Date | Non-unique | Target delivery deadline requested by requester. |
| `status` | `TEXT` | Required | `'draft'`, `'submitted'`, `'pending_approval'`, `'approved'`, `'rejected'`, `'rfq_issued'`, `'awarded'`, `'po_issued'`, `'partially_delivered'`, `'delivered'`, `'closed'`, `'cancelled'` | Lifecycle State | Non-unique | Governed by state machine. Transitions logged into `status_events`. |
| `split_group_id`| `TEXT` | Optional | Alphanumeric group identifier | Code | Non-unique | Used to flag suspect split purchases designed to bypass threshold limits. |
| `duplicate_of_pr_id`| `TEXT` | Optional | `PR-[0-9]{4}-[0-9]{6}` | Identifier | Non-unique | Self-referencing FK to `purchase_requests(pr_id)`. Constraint: `duplicate_of_pr_id <> pr_id`. |
| `submitted_at` | `TIMESTAMPTZ`| Optional| ISO-8601 Timestamp | Timestamp | Non-unique | Timestamp when status transitioned from draft to submitted. |
| `approved_at` | `TIMESTAMPTZ`| Optional| ISO-8601 Timestamp | Timestamp | Non-unique | Timestamp when final approval completed. Constraint: `approved_at >= submitted_at`. |
| `created_at` | `TIMESTAMPTZ`| Required| ISO-8601 Timestamp with TZ | Timestamp | Non-unique | Defaults to `now()`. |
| `updated_at` | `TIMESTAMPTZ`| Required| ISO-8601 Timestamp with TZ | Timestamp | Non-unique | Updated automatically by `trg_pr_touch`. |

---

## 5. Request Line (`request_lines`)
Individual line items specifying commodities, quantities, and estimated unit costs within a Purchase Request.

| Field Name | Type | Req/Opt | Allowed Values | Units | Uniqueness | Validation Rule |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| `request_line_id`| `TEXT` | Required | `<PR-id>-L[0-9]{2}` (e.g. `PR-2026-000001-L01`) | Identifier | Primary Key | Must match regex `^PR-[0-9]{4}-[0-9]{6}-L[0-9]{2}$`. Must strictly equal `pr_id || '-L' || lpad(line_no::text, 2, '0')`. |
| `pr_id` | `TEXT` | Required | `PR-[0-9]{4}-[0-9]{6}` | Identifier | Composite Unique | Foreign key referencing `purchase_requests(pr_id)` with `ON DELETE CASCADE`. Unique on `(pr_id, line_no)`. |
| `line_no` | `SMALLINT`| Required | `1, 2, 3...` | Sequence | Composite Unique | 1-indexed sequential line number. Constraint: `line_no > 0`. |
| `item_code` | `TEXT` | Required | Alphanumeric item SKU/code | Code | Non-unique | Standard inventory or catalog SKU code. |
| `description` | `TEXT` | Required | Text description of item/service | Text | Non-unique | Detailed specification. |
| `category` | `TEXT` | Required | e.g. `'Hardware'`, `'Software'`, `'Consulting'`, `'Office Supplies'`, `'Cloud Infrastructure'` | Category | Non-unique | General commodity categorization. |
| `quantity` | `NUMERIC(12,2)`| Required| Greater than `0.00` | Units | Non-unique | Constraint: `quantity > 0`. |
| `uom` | `TEXT` | Required | `'EA'`, `'HRS'`, `'MO'`, `'BOX'`, `'PKG'`, `'SET'` | Unit of Measure | Non-unique | Standard unit of measurement. Defaults to `'EA'`. |
| `estimated_unit_cost`| `NUMERIC(14,2)`| Required| Greater than or equal to `0.00` | Currency | Non-unique | Constraint: `estimated_unit_cost >= 0`. |
| `estimated_line_cost`| `NUMERIC(14,2)`| Required| `round(quantity * estimated_unit_cost, 2)` | Currency | Non-unique | SQL Generated Stored Column. |

---

## 6. Supplier (`suppliers` & `supplier_categories`)
Commercial vendors and contractors eligible to quote and fulfil purchase orders.

### 6.1 `suppliers`
| Field Name | Type | Req/Opt | Allowed Values | Units | Uniqueness | Validation Rule |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| `supplier_id` | `TEXT` | Required | `SUP-[0-9]{6}` (e.g. `SUP-000001`) | Identifier | Primary Key | Must match regex `^SUP-[0-9]{6}$`. Generated via `next_simple_id('SUP', 6)`. |
| `supplier_code` | `TEXT` | Required | `[A-Z0-9]{3,10}` (e.g. `SUP001`, `DELL01`) | Code | Unique | Short code used in deterministic quote IDs. Matches regex `^[A-Z0-9]{3,10}$`. |
| `name` | `TEXT` | Required | Non-empty corporate name | Legal Name | Non-unique | Supplier legal company name. |
| `country_code` | `CHAR(2)` | Required | ISO 3166-1 alpha-2 (e.g. `US`, `DE`, `IN`) | Country Code | Non-unique | Matches regex `^[A-Z]{2}$`. |
| `default_currency`| `CHAR(3)`| Required | ISO 4217 Currency (e.g. `USD`, `EUR`) | Currency Code | Non-unique | Matches regex `^[A-Z]{3}$`. Defaults to `'USD'`. |
| `payment_terms_days`| `SMALLINT`| Required| `0` to `180` | Days | Non-unique | Standard net payment window. Constraint: `payment_terms_days BETWEEN 0 AND 180`. |
| `status` | `TEXT` | Required | `'onboarding'`, `'active'`, `'inactive'`, `'blacklisted'` | Vendor Status | Non-unique | Inactive or blacklisted suppliers trigger violations when PO is issued. |
| `risk_level` | `TEXT` | Required | `'low'`, `'medium'`, `'high'`, `'critical'` | Risk Tier | Non-unique | Vendor risk score assessment. |
| `risk_flag` | `BOOLEAN` | Required | `TRUE`, `FALSE` | Flag | Non-unique | Constraint: `NOT risk_flag OR risk_reason IS NOT NULL`. |
| `risk_reason` | `TEXT` | Optional | Narrative description | Text | Non-unique | Required if `risk_flag = TRUE`. |
| `onboarded_on` | `DATE` | Required | ISO-8601 Date (`YYYY-MM-DD`) | Calendar Date | Non-unique | Vendor qualification date. Defaults to `2024-01-01`. |
| `deactivated_on`| `DATE` | Optional | ISO-8601 Date (`YYYY-MM-DD`) | Calendar Date | Non-unique | Must satisfy: `deactivated_on IS NULL OR deactivated_on >= onboarded_on`. |
| `created_at` | `TIMESTAMPTZ`| Required| ISO-8601 Timestamp with TZ | Timestamp | Non-unique | Defaults to `now()`. |

### 6.2 `supplier_categories`
| Field Name | Type | Req/Opt | Allowed Values | Units | Uniqueness | Validation Rule |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| `supplier_id` | `TEXT` | Required | `SUP-[0-9]{6}` | Identifier | Composite PK | FK referencing `suppliers(supplier_id)` with `ON DELETE CASCADE`. |
| `category` | `TEXT` | Required | Category string | Category | Composite PK | Primary Key: `(supplier_id, category)`. |

---

## 7. Request For Quotation (`rfqs`, `rfq_request_lines`, `rfq_suppliers`)
Formal solicitation issued to multiple suppliers to collect competitive bids for request lines.

### 7.1 `rfqs`
| Field Name | Type | Req/Opt | Allowed Values | Units | Uniqueness | Validation Rule |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| `rfq_id` | `TEXT` | Required | `RFQ-[0-9]{4}-[0-9]{6}` (e.g. `RFQ-2026-000001`) | Identifier | Primary Key | Must match regex `^RFQ-[0-9]{4}-[0-9]{6}$`. Generated via `next_year_id('RFQ')`. |
| `created_by` | `TEXT` | Required | `RQT-[0-9]{6}` | Identifier | Non-unique | Foreign key referencing `requesters(requester_id)`. |
| `currency_code` | `CHAR(3)` | Required | `USD` (or base comparison currency) | Currency | Non-unique | Benchmark currency against which landed costs are converted and evaluated. |
| `issue_date` | `DATE` | Required | ISO-8601 Date (`YYYY-MM-DD`) | Calendar Date | Non-unique | Date solicitation was published. |
| `closing_date` | `DATE` | Required | ISO-8601 Date (`YYYY-MM-DD`) | Calendar Date | Non-unique | Deadline for bid submission. Constraint: `closing_date >= issue_date`. |
| `min_quotes_required`| `SMALLINT`| Required| Minimum `1` (typically `3`) | Count | Non-unique | Constraint: `min_quotes_required >= 1`. Baseline competitive standard requires $\ge 3$. |
| `status` | `TEXT` | Required | `'draft'`, `'issued'`, `'quotes_received'`, `'evaluated'`, `'awarded'`, `'cancelled'`, `'closed'` | Status | Non-unique | Check constraint on allowed lifecycle stages. |
| `notes` | `TEXT` | Optional | Narrative scope instructions | Text | Non-unique | Bid specifications and delivery instructions. |
| `created_at` | `TIMESTAMPTZ`| Required| ISO-8601 Timestamp with TZ | Timestamp | Non-unique | Defaults to `now()`. |
| `updated_at` | `TIMESTAMPTZ`| Required| ISO-8601 Timestamp with TZ | Timestamp | Non-unique | Updated automatically by `trg_rfq_touch`. |

### 7.2 `rfq_request_lines`
| Field Name | Type | Req/Opt | Allowed Values | Units | Uniqueness | Validation Rule |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| `rfq_id` | `TEXT` | Required | `RFQ-[0-9]{4}-[0-9]{6}` | Identifier | Composite PK | FK referencing `rfqs(rfq_id)` with `ON DELETE CASCADE`. |
| `request_line_id`| `TEXT` | Required | `<PR-id>-L[0-9]{2}` | Identifier | Composite PK | FK referencing `request_lines(request_line_id)`. Primary key `(rfq_id, request_line_id)`. |

### 7.3 `rfq_suppliers`
| Field Name | Type | Req/Opt | Allowed Values | Units | Uniqueness | Validation Rule |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| `rfq_id` | `TEXT` | Required | `RFQ-[0-9]{4}-[0-9]{6}` | Identifier | Composite PK | FK referencing `rfqs(rfq_id)` with `ON DELETE CASCADE`. |
| `supplier_id` | `TEXT` | Required | `SUP-[0-9]{6}` | Identifier | Composite PK | FK referencing `suppliers(supplier_id)`. Primary key `(rfq_id, supplier_id)`. |
| `invited_on` | `DATE` | Required | ISO-8601 Date (`YYYY-MM-DD`) | Calendar Date | Non-unique | Date supplier was invited. |
| `response_status`| `TEXT` | Required | `'invited'`, `'quoted'`, `'declined'`, `'no_response'` | Status | Non-unique | Supplier participation status enum. |

---

## 8. Supplier Quote (`supplier_quotes`, `quote_lines`, `quote_evaluations`, `rfq_awards`)
Commercial proposals submitted by suppliers containing landed cost breakdowns and delivery schedules.

### 8.1 `supplier_quotes`
| Field Name | Type | Req/Opt | Allowed Values | Units | Uniqueness | Validation Rule |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| `quote_id` | `TEXT` | Required | `QUO-[A-Z0-9]{3,10}-[0-9]{4}-[0-9]{6}` | Identifier | Primary Key | Must match regex `^QUO-[A-Z0-9]{3,10}-[0-9]{4}-[0-9]{6}$`. Deterministic ID. |
| `rfq_id` | `TEXT` | Required | `RFQ-[0-9]{4}-[0-9]{6}` | Identifier | Composite Unique | FK referencing `rfqs(rfq_id)`. Unique on `(rfq_id, supplier_id)` and `(quote_id, rfq_id)`. |
| `supplier_id` | `TEXT` | Required | `SUP-[0-9]{6}` | Identifier | Composite Unique | FK referencing `suppliers(supplier_id)`. |
| `quote_date` | `DATE` | Required | ISO-8601 Date (`YYYY-MM-DD`) | Calendar Date | Non-unique | Bid issuance date. |
| `valid_until` | `DATE` | Required | ISO-8601 Date (`YYYY-MM-DD`) | Calendar Date | Non-unique | Expiration date. Constraint: `valid_until >= quote_date`. |
| `currency_code` | `CHAR(3)` | Required | `USD`, `EUR`, `GBP`, etc. | Currency Code | Non-unique | Currency of supplier quotation. |
| `fx_rate_to_base`| `NUMERIC(12,6)`| Required| Greater than `0` | Multiplier | Non-unique | Exchange rate to convert quotation currency to RFQ comparison currency. Default `1.0`. |
| `subtotal` | `NUMERIC(14,2)`| Required| Greater than or equal to `0.00` | Quote Currency| Non-unique | Derived automatically from sum of `quote_lines.line_total` via trigger `trg_quote_lines_subtotal`. |
| `freight_cost` | `NUMERIC(14,2)`| Required| Greater than or equal to `0.00` | Quote Currency| Non-unique | Shipping and logistics charges. Defaults to `0.00`. |
| `duty_cost` | `NUMERIC(14,2)`| Required| Greater than or equal to `0.00` | Quote Currency| Non-unique | Customs and tariffs. Defaults to `0.00`. |
| `other_charges` | `NUMERIC(14,2)`| Required| Greater than or equal to `0.00` | Quote Currency| Non-unique | Insurance, handling, packaging fees. Defaults to `0.00`. |
| `total_landed_cost`| `NUMERIC(14,2)`| Required| `subtotal + freight + duty + other` | Quote Currency| Non-unique | SQL Generated Stored Column. Total nominal cost. |
| `total_landed_cost_base`| `NUMERIC(14,2)`| Required| `round(total_landed_cost * fx_rate_to_base, 2)` | RFQ Base Currency| Non-unique | SQL Generated Stored Column. Normalized landed cost for fair RFQ comparison. |
| `delivery_days` | `SMALLINT`| Required | Greater than `0` | Days | Non-unique | Guaranteed lead time in days. Constraint: `delivery_days > 0`. |
| `payment_terms_days`| `SMALLINT`| Required| Greater than or equal to `0` | Days | Non-unique | Payment terms offered by vendor. Defaults to `30`. |
| `status` | `TEXT` | Required | `'submitted'`, `'under_review'`, `'awarded'`, `'rejected'`, `'expired'`, `'withdrawn'` | Status | Non-unique | State machine check constraint. |
| `created_at` | `TIMESTAMPTZ`| Required| ISO-8601 Timestamp with TZ | Timestamp | Non-unique | Defaults to `now()`. |
| `updated_at` | `TIMESTAMPTZ`| Required| ISO-8601 Timestamp with TZ | Timestamp | Non-unique | Updated automatically by `trg_quo_touch`. |

### 8.2 `quote_lines`
| Field Name | Type | Req/Opt | Allowed Values | Units | Uniqueness | Validation Rule |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| `quote_line_id` | `TEXT` | Required | `<quote-id>-L[0-9]{2}` | Identifier | Primary Key | Must strictly equal `quote_id || '-L' || lpad(line_no::text, 2, '0')`. |
| `quote_id` | `TEXT` | Required | `QUO-...` | Identifier | Composite Unique | FK referencing `supplier_quotes(quote_id)` with `ON DELETE CASCADE`. |
| `line_no` | `SMALLINT`| Required | `1, 2, 3...` | Sequence | Composite Unique | 1-indexed line number. Unique on `(quote_id, line_no)`. Constraint: `line_no > 0`. |
| `request_line_id`| `TEXT` | Required | `<PR-id>-L[0-9]{2}` | Identifier | Composite Unique | FK referencing `request_lines(request_line_id)`. Unique on `(quote_id, request_line_id)`. |
| `quantity` | `NUMERIC(12,2)`| Required| Greater than `0.00` | Units | Non-unique | Quoted item quantity. Constraint: `quantity > 0`. |
| `unit_price` | `NUMERIC(14,2)`| Required| Greater than or equal to `0.00` | Quote Currency| Non-unique | Quoted unit price. Constraint: `unit_price >= 0`. |
| `line_total` | `NUMERIC(14,2)`| Required| `round(quantity * unit_price, 2)` | Quote Currency| Non-unique | SQL Generated Stored Column. |

### 8.3 `quote_evaluations`
| Field Name | Type | Req/Opt | Allowed Values | Units | Uniqueness | Validation Rule |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| `evaluation_id` | `BIGINT` | Required | Auto-increment identity | Identifier | Primary Key | Database generated identity. |
| `rfq_id` | `TEXT` | Required | `RFQ-[0-9]{4}-[0-9]{6}` | Identifier | Non-unique | FK referencing `rfqs(rfq_id)`. |
| `quote_id` | `TEXT` | Required | `QUO-...` | Identifier | Composite Unique | FK referencing `supplier_quotes(quote_id)`. Unique on `(quote_id, evaluation_run)`. |
| `evaluation_run`| `SMALLINT`| Required | `1, 2...` | Run Index | Composite Unique | Snapshot version number. |
| `total_landed_cost_base`| `NUMERIC(14,2)`| Required| Normalized landed cost | Base Currency | Non-unique | Landed cost converted to base currency. |
| `delivery_days` | `SMALLINT`| Required | Greater than `0` | Days | Non-unique | Promised delivery lead time. |
| `cost_rank` | `SMALLINT`| Required | `1, 2, 3...` | Rank | Non-unique | Ordinal rank ordered by `total_landed_cost_base ASC`. |
| `delivery_rank` | `SMALLINT`| Required | `1, 2, 3...` | Rank | Non-unique | Ordinal rank ordered by `delivery_days ASC`. |
| `weighted_score`| `NUMERIC(7,4)`| Required| `0.0000` to `100.0000` | Score | Non-unique | Derived formula: `0.70 * cost_score + 0.30 * delivery_score`. |
| `is_lowest_cost`| `BOOLEAN` | Required | `TRUE`, `FALSE` | Boolean | Non-unique | `TRUE` if `cost_rank == 1`. |
| `is_fastest` | `BOOLEAN` | Required | `TRUE`, `FALSE` | Boolean | Non-unique | `TRUE` if `delivery_rank == 1`. |
| `is_eligible` | `BOOLEAN` | Required | `TRUE`, `FALSE` | Boolean | Non-unique | Constraint: `is_eligible OR ineligibility_reason IS NOT NULL`. |
| `ineligibility_reason`| `TEXT` | Optional | Narrative reason | Text | Non-unique | Required if `is_eligible = FALSE`. |
| `evaluated_by` | `TEXT` | Optional | `RQT-[0-9]{6}` | Identifier | Non-unique | FK referencing `requesters(requester_id)`. |
| `evaluated_at` | `TIMESTAMPTZ`| Required| ISO-8601 Timestamp with TZ | Timestamp | Non-unique | Defaults to `now()`. |

### 8.4 `rfq_awards`
| Field Name | Type | Req/Opt | Allowed Values | Units | Uniqueness | Validation Rule |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| `award_id` | `TEXT` | Required | `AWD-[0-9]{4}-[0-9]{6}` | Identifier | Primary Key | Must match regex `^AWD-[0-9]{4}-[0-9]{6}$`. Generated via `next_year_id('AWD')`. |
| `rfq_id` | `TEXT` | Required | `RFQ-[0-9]{4}-[0-9]{6}` | Identifier | Unique | Exactly one award decision per RFQ. FK referencing `rfqs(rfq_id)`. |
| `quote_id` | `TEXT` | Required | `QUO-...` | Identifier | Non-unique | Winning quotation. Composite FK `(quote_id, rfq_id)` referencing `supplier_quotes`. |
| `supplier_id` | `TEXT` | Required | `SUP-[0-9]{6}` | Identifier | Non-unique | Awarded vendor. FK referencing `suppliers(supplier_id)`. |
| `awarded_by` | `TEXT` | Required | `RQT-[0-9]{6}` | Identifier | Non-unique | Procurement officer making award. FK referencing `requesters(requester_id)`. |
| `awarded_at` | `TIMESTAMPTZ`| Required| ISO-8601 Timestamp with TZ | Timestamp | Non-unique | Timestamp of award decision. |
| `award_basis` | `TEXT` | Required | `'lowest_landed_cost'`, `'best_weighted_score'`, `'fastest_delivery'`, `'sole_source'`, `'other'` | Basis Enum | Non-unique | Justification category. |
| `is_lowest_cost`| `BOOLEAN` | Required | `TRUE`, `FALSE` | Boolean | Non-unique | Indicates if awarded quote had lowest landed cost. |
| `rationale` | `TEXT` | Optional | Narrative justification | Text | Non-unique | Mandatory business rule: non-cheapest awards require rationale or trigger violation. |

---

## 9. Approval (`approvals` & `approval_thresholds`)
Hierarchical multi-tier authorization workflow ensuring governance and policy adherence.

### 9.1 `approval_thresholds`
| Field Name | Type | Req/Opt | Allowed Values | Units | Uniqueness | Validation Rule |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| `threshold_id` | `SMALLINT`| Required | `1, 2, 3, 4` | Tier Level | Primary Key | `1`=Dept Mgr (<5k), `2`=Proc Head (5k-25k), `3`=Finance Dir (25k-100k), `4`=CFO (>=100k). |
| `name` | `TEXT` | Required | Non-empty role description | Text | Non-unique | Policy tier name. |
| `min_amount` | `NUMERIC(14,2)`| Required| Greater than or equal to `0.00` | Currency (USD)| Non-unique | Inclusive lower monetary boundary. |
| `max_amount` | `NUMERIC(14,2)`| Optional| Greater than `min_amount` or `NULL` | Currency (USD)| Non-unique | Exclusive upper monetary boundary (`NULL` = unbounded). |
| `required_level`| `SMALLINT`| Required| `1` to `4` | Level Number | Non-unique | Highest sequential sign-off level required. |
| `effective_from`| `DATE` | Required| ISO-8601 Date (`YYYY-MM-DD`) | Calendar Date | Non-unique | Defaults to `2026-01-01`. |
| `effective_to` | `DATE` | Optional | ISO-8601 Date (`YYYY-MM-DD`) | Calendar Date | Non-unique | Must satisfy `effective_to >= effective_from`. |

### 9.2 `approvals`
| Field Name | Type | Req/Opt | Allowed Values | Units | Uniqueness | Validation Rule |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| `approval_id` | `TEXT` | Required | `APR-[0-9]{4}-[0-9]{6}` | Identifier | Primary Key | Must match regex `^APR-[0-9]{4}-[0-9]{6}$`. Generated via `next_year_id('APR')`. |
| `pr_id` | `TEXT` | Required | `PR-[0-9]{4}-[0-9]{6}` | Identifier | Composite Unique | FK referencing `purchase_requests(pr_id)`. Unique on `(pr_id, approval_level)`. |
| `approval_level`| `SMALLINT`| Required | `1, 2, 3, 4` | Tier Level | Composite Unique | Sequential sign-off level. Constraint: `approval_level BETWEEN 1 AND 4`. |
| `approver_id` | `TEXT` | Required | `RQT-[0-9]{6}` | Identifier | Non-unique | FK referencing `requesters(requester_id)` where `approval_level >= approvals.approval_level`. |
| `threshold_id` | `SMALLINT`| Optional | `1, 2, 3, 4` | Identifier | Non-unique | FK referencing `approval_thresholds(threshold_id)`. |
| `decision` | `TEXT` | Required | `'pending'`, `'approved'`, `'rejected'`, `'escalated'` | Decision Enum | Non-unique | Current step status. Constraint: `decision = 'pending' OR decided_at IS NOT NULL`. |
| `requested_at` | `TIMESTAMPTZ`| Required| ISO-8601 Timestamp with TZ | Timestamp | Non-unique | Timestamp when approval step was assigned. |
| `decided_at` | `TIMESTAMPTZ`| Optional| ISO-8601 Timestamp with TZ | Timestamp | Non-unique | Timestamp when decision recorded. Constraint: `decided_at >= requested_at`. |
| `comments` | `TEXT` | Optional | Narrative review comments | Text | Non-unique | Sign-off notes or rejection reason. |

---

## 10. Purchase Order (`purchase_orders` & `purchase_order_lines`)
Legally binding commercial contract issued to a supplier to deliver specified products and services.

### 10.1 `purchase_orders`
| Field Name | Type | Req/Opt | Allowed Values | Units | Uniqueness | Validation Rule |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| `po_id` | `TEXT` | Required | `PO-[0-9]{4}-[0-9]{6}` (e.g. `PO-2026-000001`) | Identifier | Primary Key | Must match regex `^PO-[0-9]{4}-[0-9]{6}$`. Generated via `next_year_id('PO')`. |
| `pr_id` | `TEXT` | Required | `PR-[0-9]{4}-[0-9]{6}` | Identifier | Non-unique | FK referencing `purchase_requests(pr_id)`. |
| `rfq_id` | `TEXT` | Optional | `RFQ-[0-9]{4}-[0-9]{6}` or `NULL` | Identifier | Non-unique | Optional FK to `rfqs(rfq_id)` (single-source / low-value POs have no RFQ). |
| `quote_id` | `TEXT` | Optional | `QUO-...` or `NULL` | Identifier | Non-unique | Composite FK `(quote_id, rfq_id)` referencing `supplier_quotes(quote_id, rfq_id)`. |
| `award_id` | `TEXT` | Optional | `AWD-[0-9]{4}-[0-9]{6}` or `NULL` | Identifier | Non-unique | FK referencing `rfq_awards(award_id)`. |
| `supplier_id` | `TEXT` | Required | `SUP-[0-9]{6}` | Identifier | Non-unique | FK referencing `suppliers(supplier_id)`. |
| `issued_by` | `TEXT` | Required | `RQT-[0-9]{6}` | Identifier | Non-unique | Buyer/officer issuing order. FK referencing `requesters(requester_id)`. |
| `po_type` | `TEXT` | Required | `'competitive'`, `'single_source'`, `'direct_low_value'` | Type Enum | Non-unique | Constraint: `po_type <> 'competitive' OR quote_id IS NOT NULL`. Also `(quote_id IS NULL) = (rfq_id IS NULL)`. |
| `currency_code` | `CHAR(3)` | Required | `USD` (or vendor currency) | Currency | Non-unique | Matches regex `^[A-Z]{3}$`. Defaults to `'USD'`. |
| `subtotal` | `NUMERIC(14,2)`| Required| Greater than or equal to `0.00` | Currency | Non-unique | Derived automatically from sum of `purchase_order_lines.line_total` via `trg_po_lines_subtotal`. |
| `freight_cost` | `NUMERIC(14,2)`| Required| Greater than or equal to `0.00` | Currency | Non-unique | Shipping amount copied or agreed from quote. Defaults to `0.00`. |
| `duty_cost` | `NUMERIC(14,2)`| Required| Greater than or equal to `0.00` | Currency | Non-unique | Customs duty amount. Defaults to `0.00`. |
| `other_charges` | `NUMERIC(14,2)`| Required| Greater than or equal to `0.00` | Currency | Non-unique | Packaging, taxes, handling. Defaults to `0.00`. |
| `total_amount` | `NUMERIC(14,2)`| Required| `subtotal + freight + duty + other` | Currency | Non-unique | SQL Generated Stored Column. Total binding contract commitment. |
| `payment_terms_days`| `SMALLINT`| Required| `0` to `180` | Days | Non-unique | Agreed settlement terms. Defaults to `30`. |
| `issued_date` | `DATE` | Required | ISO-8601 Date (`YYYY-MM-DD`) | Calendar Date | Non-unique | Effective purchase order execution date. |
| `expected_delivery_date`| `DATE`| Required | ISO-8601 Date (`YYYY-MM-DD`) | Calendar Date | Non-unique | Promised delivery milestone. Constraint: `expected_delivery_date >= issued_date`. |
| `status` | `TEXT` | Required | `'draft'`, `'issued'`, `'acknowledged'`, `'partially_delivered'`, `'delivered'`, `'closed'`, `'cancelled'` | Status | Non-unique | Order lifecycle status. |
| `created_at` | `TIMESTAMPTZ`| Required| ISO-8601 Timestamp with TZ | Timestamp | Non-unique | Defaults to `now()`. |
| `updated_at` | `TIMESTAMPTZ`| Required| ISO-8601 Timestamp with TZ | Timestamp | Non-unique | Updated automatically by `trg_po_touch`. |

### 10.2 `purchase_order_lines`
| Field Name | Type | Req/Opt | Allowed Values | Units | Uniqueness | Validation Rule |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| `po_line_id` | `TEXT` | Required | `<PO-id>-L[0-9]{2}` (e.g. `PO-2026-000001-L01`) | Identifier | Primary Key | Must strictly equal `po_id || '-L' || lpad(line_no::text, 2, '0')`. |
| `po_id` | `TEXT` | Required | `PO-[0-9]{4}-[0-9]{6}` | Identifier | Composite Unique | FK referencing `purchase_orders(po_id)` with `ON DELETE CASCADE`. Unique on `(po_id, line_no)`. |
| `line_no` | `SMALLINT`| Required | `1, 2, 3...` | Sequence | Composite Unique | 1-indexed sequential line. Constraint: `line_no > 0`. |
| `request_line_id`| `TEXT` | Required | `<PR-id>-L[0-9]{2}` | Identifier | Non-unique | FK referencing `request_lines(request_line_id)`. Traceability to original requisition. |
| `quote_line_id` | `TEXT` | Optional | `<quote-id>-L[0-9]{2}` or `NULL` | Identifier | Non-unique | Optional FK referencing `quote_lines(quote_line_id)`. |
| `description` | `TEXT` | Required | Non-empty item description | Text | Non-unique | Line item description. |
| `quantity` | `NUMERIC(12,2)`| Required| Greater than `0.00` | Units | Non-unique | Ordered quantity. Constraint: `quantity > 0`. |
| `unit_price` | `NUMERIC(14,2)`| Required| Greater than or equal to `0.00` | Currency | Non-unique | Contracted unit price. Constraint: `unit_price >= 0`. |
| `line_total` | `NUMERIC(14,2)`| Required| `round(quantity * unit_price, 2)` | Currency | Non-unique | SQL Generated Stored Column. |

---

## 11. Delivery (`deliveries` & `delivery_lines`)
Logistics receipts and warehouse inspection events recording receipt and quality acceptance.

### 11.1 `deliveries`
| Field Name | Type | Req/Opt | Allowed Values | Units | Uniqueness | Validation Rule |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| `delivery_id` | `TEXT` | Required | `DEL-<PO-id>-[0-9]{2}` (e.g. `DEL-PO-2026-000001-01`) | Identifier | Primary Key | Must strictly equal `'DEL-' || po_id || '-' || lpad(delivery_seq::text, 2, '0')`. |
| `po_id` | `TEXT` | Required | `PO-[0-9]{4}-[0-9]{6}` | Identifier | Composite Unique | FK referencing `purchase_orders(po_id)`. Unique on `(po_id, delivery_seq)`. |
| `delivery_seq` | `SMALLINT`| Required | `1, 2, 3...` | Sequence | Composite Unique | Sequential delivery index for PO. Constraint: `delivery_seq > 0`. Multiple deliveries indicate partial fulfilment. |
| `scheduled_date`| `DATE` | Required | ISO-8601 Date (`YYYY-MM-DD`) | Calendar Date | Non-unique | Expected gate arrival date. |
| `actual_date` | `DATE` | Optional | ISO-8601 Date (`YYYY-MM-DD`) | Calendar Date | Non-unique | Date physical goods arrived at loading dock. Constraint: `status NOT IN ('partial','delivered') OR actual_date IS NOT NULL`. |
| `status` | `TEXT` | Required | `'scheduled'`, `'in_transit'`, `'partial'`, `'delivered'`, `'delayed'`, `'rejected'`, `'cancelled'` | Status | Non-unique | Delivery milestone state enum. |
| `carrier` | `TEXT` | Optional | Carrier name (e.g. "FedEx", "DHL") | Text | Non-unique | Logistics service provider. |
| `tracking_ref` | `TEXT` | Optional | Alphanumeric airway bill / tracking ID | Code | Non-unique | Carrier tracking code. |
| `notes` | `TEXT` | Optional | Inspection and receiving remarks | Text | Non-unique | Warehouse inspection observations. |
| `created_at` | `TIMESTAMPTZ`| Required| ISO-8601 Timestamp with TZ | Timestamp | Non-unique | Defaults to `now()`. |
| `updated_at` | `TIMESTAMPTZ`| Required| ISO-8601 Timestamp with TZ | Timestamp | Non-unique | Updated automatically by `trg_del_touch`. |

### 11.2 `delivery_lines`
| Field Name | Type | Req/Opt | Allowed Values | Units | Uniqueness | Validation Rule |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| `delivery_line_id`| `BIGINT`| Required | Auto-increment identity | Identifier | Primary Key | Generated identity. |
| `delivery_id` | `TEXT` | Required | `DEL-...` | Identifier | Composite Unique | FK referencing `deliveries(delivery_id)` with `ON DELETE CASCADE`. Unique on `(delivery_id, po_line_id)`. |
| `po_line_id` | `TEXT` | Required | `<PO-id>-L[0-9]{2}` | Identifier | Composite Unique | FK referencing `purchase_order_lines(po_line_id)`. |
| `qty_delivered` | `NUMERIC(12,2)`| Required| Greater than or equal to `0.00` | Units | Non-unique | Quantity physically received at dock. Constraint: `qty_delivered >= 0`. |
| `qty_rejected` | `NUMERIC(12,2)`| Required| Greater than or equal to `0.00` | Units | Non-unique | Quantity rejected due to damage or defect. Constraint: `qty_rejected <= qty_delivered`. |

---

## 12. Audit & Supporting Tables

### 12.1 `budget_ledger`
Financial commitment ledger tracking allocation, adjustments, reservations (PRs), and commitments (POs).

| Field Name | Type | Req/Opt | Allowed Values | Units | Validation Rule |
| :--- | :--- | :--- | :--- | :--- | :--- |
| `ledger_id` | `BIGINT` | Required | Auto-increment identity | Identifier | Primary Key. |
| `budget_id` | `TEXT` | Required | `BUD-[0-9]{4}-[0-9]{4}` | Identifier | FK referencing `budgets(budget_id)`. |
| `entry_type` | `TEXT` | Required | `'allocation'`, `'adjustment'`, `'reservation'`, `'reservation_release'`, `'commitment'`, `'commitment_release'` | Enum | Sign implied by type: adjustments can be negative; PR reservations require `pr_id`; PO commitments require `po_id`. |
| `amount` | `NUMERIC(14,2)`| Required| Positive numeric | Currency | Constraint: `entry_type = 'adjustment' OR amount > 0`. |
| `pr_id` | `TEXT` | Optional | `PR-[0-9]{4}-[0-9]{6}` | Identifier | FK referencing `purchase_requests(pr_id)`. |
| `po_id` | `TEXT` | Optional | `PO-[0-9]{4}-[0-9]{6}` | Identifier | FK referencing `purchase_orders(po_id)`. |
| `entry_date` | `DATE` | Required | ISO-8601 Date (`YYYY-MM-DD`) | Calendar Date | Transaction recording date. |
| `notes` | `TEXT` | Optional | Narrative description | Text | Explanation of ledger movement. |

### 12.2 `status_events`
Append-only immutable audit trail capturing every lifecycle state transition.

| Field Name | Type | Req/Opt | Allowed Values | Units | Validation Rule |
| :--- | :--- | :--- | :--- | :--- | :--- |
| `event_id` | `BIGINT` | Required | Auto-increment identity | Identifier | Primary Key. |
| `entity_type` | `TEXT` | Required | `'purchase_request'`, `'rfq'`, `'supplier_quote'`, `'purchase_order'`, `'delivery'`, `'approval'`, `'exception'` | Enum | Check constraint on supported entities. |
| `entity_id` | `TEXT` | Required | Valid Entity Primary Key | Identifier | Referenced entity ID. |
| `from_status` | `TEXT` | Optional | Previous status or `NULL` | Status | Initial record insert has `from_status = NULL`. |
| `to_status` | `TEXT` | Required | Destination status | Status | New state after transition. |
| `actor_id` | `TEXT` | Optional | `RQT-[0-9]{6}` | Identifier | FK referencing `requesters(requester_id)`. User executing transition. |
| `reason` | `TEXT` | Optional | Narrative explanation | Text | Justification for state transition. |
| `event_at` | `TIMESTAMPTZ`| Required| ISO-8601 Timestamp with TZ | Timestamp | Defaults to `now()`. |
| `metadata` | `JSONB` | Required | JSON Object `{}` | Data | Extensible structured metadata. Defaults to `{}`. |

### 12.3 `exceptions`
Operational exception register tracking non-conformances detected by system rules.

| Field Name | Type | Req/Opt | Allowed Values | Units | Validation Rule |
| :--- | :--- | :--- | :--- | :--- | :--- |
| `exception_id` | `TEXT` | Required | `EXC-[0-9]{4}-[0-9]{6}` | Identifier | Primary Key. Regex `^EXC-[0-9]{4}-[0-9]{6}$`. |
| `issue_type` | `TEXT` | Required | `'po_without_approval'`, `'quote_expired_before_award'`, `'non_cheapest_without_rationale'`, `'supplier_inactive'`, `'budget_overrun'`, `'duplicate_request'`, `'quote_currency_mismatch'`, `'single_source'`, `'split_purchase'`, `'supplier_risk_flag'`, `'partial_delivery'`, `'insufficient_quotes'`, `'po_value_mismatch'`, `'quote_expired'` | Enum | Check constraint on known issue types. |
| `entity_type` | `TEXT` | Required | Entity name | Text | Affected entity type. |
| `entity_id` | `TEXT` | Required | Entity ID | Identifier | Affected entity ID. |
| `severity` | `TEXT` | Required | `'low'`, `'medium'`, `'high'`, `'critical'` | Severity | Exception severity tier. |
| `reason` | `TEXT` | Required | Detailed diagnostic explanation | Text | Mandatory reason describing violation. |
| `status` | `TEXT` | Required | `'open'`, `'acknowledged'`, `'resolved'`, `'waived'` | Status | Operational disposition. Constraint: `status NOT IN ('resolved','waived') OR (resolved_at IS NOT NULL AND resolution_note IS NOT NULL)`. |
| `detected_by` | `TEXT` | Required | System or user name | Text | Defaults to `'system'`. |
| `detected_at` | `TIMESTAMPTZ`| Required| ISO-8601 Timestamp with TZ | Timestamp | Defaults to `now()`. |
| `resolved_by` | `TEXT` | Optional | `RQT-[0-9]{6}` | Identifier | FK referencing `requesters(requester_id)`. |
| `resolved_at` | `TIMESTAMPTZ`| Optional| ISO-8601 Timestamp with TZ | Timestamp | Resolution timestamp. |
| `resolution_note`| `TEXT` | Optional| Narrative resolution | Text | Required upon resolution or waiver. |

### 12.4 `ground_truth.anomaly_labels`
Isolated ground truth reference containing synthetic injection labels. **Never joined or leaked into input features.**

| Field Name | Type | Req/Opt | Allowed Values | Units | Validation Rule |
| :--- | :--- | :--- | :--- | :--- | :--- |
| `label_id` | `BIGINT` | Required | Auto-increment identity | Identifier | Primary Key. |
| `issue_type` | `TEXT` | Required | Injected anomaly category | Label | Machine learning and validation ground truth label. |
| `entity_type` | `TEXT` | Required | Entity category | Text | Name of entity containing anomaly. |
| `entity_id` | `TEXT` | Required | Entity Primary Key | Identifier | Target record ID. |
| `is_anomaly` | `BOOLEAN` | Required | `TRUE`, `FALSE` | Boolean | True positive indicator. Defaults to `TRUE`. |
| `expected_decision`| `TEXT` | Optional| Decision (e.g. `'reject_po'`, `'require_rationale'`) | Action | Expected governance action. |
| `expected_reason` | `TEXT` | Required | Explanatory ground truth basis | Text | Ground truth rationale. |
| `injected_by_rule`| `TEXT` | Required | Rule identifier (e.g. `'RULE_PO_NO_APPROVAL'`) | Code | Originating generator test case rule. |
| `generator_seed` | `INTEGER` | Required | Numeric seed (e.g. `20261022`) | Seed | Seed used during data generation. |
| `created_at` | `TIMESTAMPTZ`| Required| ISO-8601 Timestamp with TZ | Timestamp | Defaults to `now()`. |
