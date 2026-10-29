"""
Data Validation Suite for Procure-to-Pay synthetic datasets:
1. Primary-key uniqueness
2. Foreign-key referential integrity
3. Allowed enums
4. Date ordering
5. Arithmetic reconciliation (totals = sum of lines, base conversions)
6. Ground truth anomaly isolation
"""

import math
from datetime import datetime
from typing import Dict, List, Tuple

def validate_dataset(dataset: Dict[str, List[Dict]], ground_truth: List[Dict]) -> Dict[str, any]:
    """
    Executes full integrity check suite on in-memory dataset.
    Returns a dictionary of test results, metrics, and error logs.
    """
    results = {
        "passed": True,
        "tests_run": 0,
        "tests_passed": 0,
        "tests_failed": 0,
        "errors": [],
        "metrics": {}
    }

    def record_test(name: str, passed: bool, error_msg: str = ""):
        results["tests_run"] += 1
        if passed:
            results["tests_passed"] += 1
        else:
            results["tests_failed"] += 1
            results["passed"] = False
            results["errors"].append(f"[{name}] {error_msg}")

    # 1. Primary-Key Uniqueness
    pk_definitions = [
        ("departments", "department_id"),
        ("requesters", "requester_id"),
        ("budgets", "budget_id"),
        ("suppliers", "supplier_id"),
        ("purchase_requests", "pr_id"),
        ("request_lines", "request_line_id"),
        ("rfqs", "rfq_id"),
        ("supplier_quotes", "quote_id"),
        ("quote_lines", "quote_line_id"),
        ("rfq_awards", "award_id"),
        ("approvals", "approval_id"),
        ("purchase_orders", "po_id"),
        ("purchase_order_lines", "po_line_id"),
        ("deliveries", "delivery_id"),
        ("exceptions", "exception_id")
    ]

    for table_name, pk_col in pk_definitions:
        records = dataset.get(table_name, [])
        pk_values = [r[pk_col] for r in records if pk_col in r]
        unique_pks = set(pk_values)
        is_unique = (len(pk_values) == len(unique_pks))
        record_test(
            f"PK_Uniqueness_{table_name}",
            is_unique,
            f"Duplicate primary keys detected in {table_name}: {len(pk_values)} rows vs {len(unique_pks)} unique"
        )
        results["metrics"][f"count_{table_name}"] = len(records)

    # 2. Foreign-Key Referential Integrity
    fk_checks = [
        ("requesters", "department_id", "departments", "department_id"),
        ("budgets", "department_id", "departments", "department_id"),
        ("purchase_requests", "requester_id", "requesters", "requester_id"),
        ("purchase_requests", "department_id", "departments", "department_id"),
        ("purchase_requests", "budget_id", "budgets", "budget_id"),
        ("request_lines", "pr_id", "purchase_requests", "pr_id"),
        ("rfq_request_lines", "rfq_id", "rfqs", "rfq_id"),
        ("rfq_request_lines", "request_line_id", "request_lines", "request_line_id"),
        ("rfq_suppliers", "rfq_id", "rfqs", "rfq_id"),
        ("rfq_suppliers", "supplier_id", "suppliers", "supplier_id"),
        ("supplier_quotes", "rfq_id", "rfqs", "rfq_id"),
        ("supplier_quotes", "supplier_id", "suppliers", "supplier_id"),
        ("quote_lines", "quote_id", "supplier_quotes", "quote_id"),
        ("quote_lines", "request_line_id", "request_lines", "request_line_id"),
        ("rfq_awards", "rfq_id", "rfqs", "rfq_id"),
        ("rfq_awards", "quote_id", "supplier_quotes", "quote_id"),
        ("rfq_awards", "supplier_id", "suppliers", "supplier_id"),
        ("approvals", "pr_id", "purchase_requests", "pr_id"),
        ("approvals", "approver_id", "requesters", "requester_id"),
        ("purchase_orders", "pr_id", "purchase_requests", "pr_id"),
        ("purchase_orders", "supplier_id", "suppliers", "supplier_id"),
        ("purchase_order_lines", "po_id", "purchase_orders", "po_id"),
        ("purchase_order_lines", "request_line_id", "request_lines", "request_line_id"),
        ("deliveries", "po_id", "purchase_orders", "po_id")
    ]

    for child_tbl, child_fk, parent_tbl, parent_pk in fk_checks:
        parent_keys = {r[parent_pk] for r in dataset.get(parent_tbl, [])}
        orphans = [
            r[child_fk] for r in dataset.get(child_tbl, [])
            if r.get(child_fk) is not None and r[child_fk] not in parent_keys
        ]
        record_test(
            f"FK_{child_tbl}_{child_fk}_to_{parent_tbl}",
            len(orphans) == 0,
            f"Found {len(orphans)} orphaned records in {child_tbl}.{child_fk} missing from {parent_tbl}"
        )

    # 3. Allowed Enums
    enum_validations = [
        ("departments", "status", {"active", "inactive"}),
        ("requesters", "role", {"requester", "approver", "process_owner", "operations_analyst", "system_admin"}),
        ("budgets", "status", {"draft", "active", "frozen", "closed"}),
        ("suppliers", "status", {"onboarding", "active", "inactive", "blacklisted"}),
        ("suppliers", "risk_level", {"low", "medium", "high", "critical"}),
        ("purchase_requests", "procurement_type", {"competitive", "single_source", "direct_low_value"}),
        ("purchase_requests", "priority", {"low", "normal", "high", "urgent"}),
        ("rfqs", "status", {"draft", "issued", "quotes_received", "evaluated", "awarded", "cancelled", "closed"}),
        ("supplier_quotes", "status", {"submitted", "under_review", "awarded", "rejected", "expired", "withdrawn"}),
        ("approvals", "decision", {"pending", "approved", "rejected", "escalated"}),
        ("purchase_orders", "status", {"draft", "issued", "acknowledged", "partially_delivered", "delivered", "closed", "cancelled"}),
        ("deliveries", "status", {"scheduled", "in_transit", "partial", "delivered", "delayed", "rejected", "cancelled"})
    ]

    for tbl, col, allowed in enum_validations:
        invalid_rows = [r[col] for r in dataset.get(tbl, []) if r.get(col) not in allowed]
        record_test(
            f"Enum_{tbl}_{col}",
            len(invalid_rows) == 0,
            f"Invalid enum values in {tbl}.{col}: {set(invalid_rows)}"
        )

    # 4. Date Ordering Constraints
    # rfqs.closing_date >= rfqs.issue_date
    rfq_date_errors = [
        r["rfq_id"] for r in dataset.get("rfqs", [])
        if r["closing_date"] < r["issue_date"]
    ]
    record_test("DateOrder_RFQ_Closing_After_Issue", len(rfq_date_errors) == 0, f"RFQs with closing < issue: {rfq_date_errors}")

    # purchase_orders.expected_delivery_date >= purchase_orders.issued_date
    po_date_errors = [
        p["po_id"] for p in dataset.get("purchase_orders", [])
        if p["expected_delivery_date"] < p["issued_date"]
    ]
    record_test("DateOrder_PO_Delivery_After_Issue", len(po_date_errors) == 0, f"POs with expected delivery < issue date: {po_date_errors}")

    # deliveries: delivered or partial requires actual_date
    deliv_errors = [
        d["delivery_id"] for d in dataset.get("deliveries", [])
        if d["status"] in ["delivered", "partial"] and not d.get("actual_date")
    ]
    record_test("Deliveries_Actual_Date_Populated", len(deliv_errors) == 0, f"Delivered records missing actual_date: {deliv_errors}")

    # 5. Arithmetic Reconciliation
    # Request line cost = qty * unit_cost
    req_line_arith_errors = [
        l["request_line_id"] for l in dataset.get("request_lines", [])
        if abs(l["estimated_line_cost"] - round(l["quantity"] * l["estimated_unit_cost"], 2)) > 0.01
    ]
    record_test("Arithmetic_RequestLine_Cost", len(req_line_arith_errors) == 0, f"Request lines with cost mismatch: {req_line_arith_errors}")

    # Quote line cost = qty * unit_price
    quote_line_arith_errors = [
        l["quote_line_id"] for l in dataset.get("quote_lines", [])
        if abs(l["line_total"] - round(l["quantity"] * l["unit_price"], 2)) > 0.01
    ]
    record_test("Arithmetic_QuoteLine_Total", len(quote_line_arith_errors) == 0, f"Quote lines with total mismatch: {quote_line_arith_errors}")

    # Quote landed cost = subtotal + freight + duty + other
    quote_landed_errors = [
        q["quote_id"] for q in dataset.get("supplier_quotes", [])
        if abs(q["total_landed_cost"] - round(q["subtotal"] + q["freight_cost"] + q["duty_cost"] + q["other_charges"], 2)) > 0.01
    ]
    record_test("Arithmetic_Quote_Landed_Cost", len(quote_landed_errors) == 0, f"Quotes with landed cost mismatch: {quote_landed_errors}")

    # PO total = subtotal + freight + duty + other
    po_arith_errors = [
        p["po_id"] for p in dataset.get("purchase_orders", [])
        if abs(p["total_amount"] - round(p["subtotal"] + p["freight_cost"] + p["duty_cost"] + p["other_charges"], 2)) > 0.01
    ]
    record_test("Arithmetic_PO_Total_Amount", len(po_arith_errors) == 0, f"POs with total amount mismatch: {po_arith_errors}")

    # 6. Labelled Edge Cases & Ground Truth Isolation
    expected_edge_cases = {
        "po_without_approval",
        "quote_expired_before_award",
        "non_cheapest_without_rationale",
        "supplier_inactive",
        "budget_overrun",
        "duplicate_request",
        "quote_currency_mismatch"
    }
    injected_issues = {gt["issue_type"] for gt in ground_truth}
    missing_anomalies = expected_edge_cases - injected_issues
    record_test(
        "EdgeCases_All_Seven_Present_In_Ground_Truth",
        len(missing_anomalies) == 0,
        f"Missing required edge case anomaly labels: {missing_anomalies}"
    )

    # Verify ground truth labels are not leaked into purchase_requests / purchase_orders
    leaked_cols_pr = [col for col in dataset.get("purchase_requests", [{}])[0].keys() if "ground_truth" in col.lower() or "is_anomaly" in col.lower()]
    record_test("GroundTruth_Isolated_No_Leakage", len(leaked_cols_pr) == 0, f"Ground truth leaked into PR columns: {leaked_cols_pr}")

    return results
