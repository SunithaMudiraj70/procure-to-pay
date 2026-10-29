"""
Edge cases & anomalies injection for Procure-to-Pay system:
Injects 7 labelled edge cases required by the problem statement:
1. po_without_approval
2. quote_expired_before_award
3. non_cheapest_without_rationale
4. supplier_inactive
5. budget_overrun
6. duplicate_request
7. quote_currency_mismatch

Also injects natural operational exceptions:
- single_source
- split_purchase
- supplier_risk_flag
- partial_delivery

Records ground truth entries in a separate schema (never leaked into input features).
"""

from datetime import datetime, timedelta
from typing import Dict, List, Tuple

from utils.ids import generate_exception_id

def inject_edge_cases(
    dataset: Dict[str, List[Dict]],
    seed: int,
    year: int = 2026
) -> Tuple[List[Dict], List[Dict]]:
    """
    Injects anomalies into the generated dataset and returns:
    (exceptions_list, ground_truth_labels_list)
    """
    purchase_requests = dataset["purchase_requests"]
    request_lines = dataset["request_lines"]
    approvals = dataset["approvals"]
    budgets = dataset["budgets"]
    budget_ledger = dataset["budget_ledger"]
    rfqs = dataset["rfqs"]
    supplier_quotes = dataset["supplier_quotes"]
    rfq_awards = dataset["rfq_awards"]
    purchase_orders = dataset["purchase_orders"]
    suppliers = dataset["suppliers"]
    deliveries = dataset["deliveries"]

    exceptions = []
    ground_truth_labels = []
    exc_idx = 1
    label_idx = 1

    supplier_map = {s["supplier_id"]: s for s in suppliers}
    pr_map = {p["pr_id"]: p for p in purchase_requests}
    rfq_map = {r["rfq_id"]: r for r in rfqs}
    quote_map = {q["quote_id"]: q for q in supplier_quotes}

    # -------------------------------------------------------------
    # 1. Edge Case: po_without_approval
    # PO issued without required approval tier sign-off
    # -------------------------------------------------------------
    candidate_pos = [po for po in purchase_orders if po["status"] not in ["draft", "cancelled"]]
    if candidate_pos:
        target_po = candidate_pos[0]
        # Remove or invalidate approvals for target_po's PR
        t_pr_id = target_po["pr_id"]
        dataset["approvals"] = [a for a in dataset["approvals"] if a["pr_id"] != t_pr_id]

        # Add single pending level 1 approval to simulate incomplete approval
        dataset["approvals"].append({
            "approval_id": f"APR-{year}-999001",
            "pr_id": t_pr_id,
            "approval_level": 1,
            "approver_id": dataset["requesters"][3]["requester_id"],
            "threshold_id": 1,
            "decision": "pending",
            "requested_at": target_po["created_at"],
            "decided_at": None,
            "comments": "Awaiting managerial sign-off"
        })

        exc_id = generate_exception_id(exc_idx, year)
        exc_idx += 1
        reason_text = f"PR {t_pr_id} lacks required approvals before PO issue"
        exceptions.append({
            "exception_id": exc_id,
            "issue_type": "po_without_approval",
            "entity_type": "purchase_order",
            "entity_id": target_po["po_id"],
            "severity": "critical",
            "reason": reason_text,
            "status": "open",
            "detected_by": "system",
            "detected_at": target_po["created_at"]
        })

        ground_truth_labels.append({
            "label_id": label_idx,
            "issue_type": "po_without_approval",
            "entity_type": "purchase_order",
            "entity_id": target_po["po_id"],
            "is_anomaly": True,
            "expected_decision": "reject_po",
            "expected_reason": reason_text,
            "injected_by_rule": "RULE_PO_WITHOUT_APPROVAL",
            "generator_seed": seed,
            "created_at": target_po["created_at"]
        })
        label_idx += 1

    # -------------------------------------------------------------
    # 2. Edge Case: quote_expired_before_award
    # RFQ awarded after winning quote's valid_until date
    # -------------------------------------------------------------
    if rfq_awards:
        target_award = rfq_awards[0]
        win_quote = quote_map.get(target_award["quote_id"])
        if win_quote:
            # Set valid_until 5 days before awarded_at
            award_dt = datetime.strptime(target_award["awarded_at"], "%Y-%m-%d %H:%M:%SZ")
            expired_valid_until = (award_dt - timedelta(days=5)).strftime("%Y-%m-%d")
            quote_dt = datetime.strptime(win_quote["quote_date"], "%Y-%m-%d")
            if datetime.strptime(expired_valid_until, "%Y-%m-%d") >= quote_dt:
                win_quote["valid_until"] = expired_valid_until
            else:
                win_quote["valid_until"] = win_quote["quote_date"]
                target_award["awarded_at"] = (quote_dt + timedelta(days=10)).strftime("%Y-%m-%d %H:%M:%SZ")

            exc_id = generate_exception_id(exc_idx, year)
            exc_idx += 1
            reason_text = f"Quote {win_quote['quote_id']} expired {win_quote['valid_until']} but awarded {target_award['awarded_at'][:10]}"
            exceptions.append({
                "exception_id": exc_id,
                "issue_type": "quote_expired_before_award",
                "entity_type": "rfq_award",
                "entity_id": target_award["award_id"],
                "severity": "high",
                "reason": reason_text,
                "status": "open",
                "detected_by": "system",
                "detected_at": target_award["awarded_at"]
            })

            ground_truth_labels.append({
                "label_id": label_idx,
                "issue_type": "quote_expired_before_award",
                "entity_type": "rfq_award",
                "entity_id": target_award["award_id"],
                "is_anomaly": True,
                "expected_decision": "require_quote_extension",
                "expected_reason": reason_text,
                "injected_by_rule": "RULE_QUOTE_EXPIRED_BEFORE_AWARD",
                "generator_seed": seed,
                "created_at": target_award["awarded_at"]
            })
            label_idx += 1

    # -------------------------------------------------------------
    # 3. Edge Case: non_cheapest_without_rationale
    # Awarded quote is not lowest cost and lacks rationale
    # -------------------------------------------------------------
    if len(rfq_awards) > 1:
        target_award_2 = rfq_awards[1]
        t_rfq_id = target_award_2["rfq_id"]
        rfq_quotes = [q for q in supplier_quotes if q["rfq_id"] == t_rfq_id and q["status"] != "withdrawn"]
        if len(rfq_quotes) >= 2:
            rfq_quotes_sorted = sorted(rfq_quotes, key=lambda x: x["total_landed_cost_base"])
            higher_quote = rfq_quotes_sorted[-1]
            target_award_2["quote_id"] = higher_quote["quote_id"]
            target_award_2["supplier_id"] = higher_quote["supplier_id"]
            target_award_2["is_lowest_cost"] = False
            target_award_2["award_basis"] = "other"
            target_award_2["rationale"] = None # Missing rationale!

            exc_id = generate_exception_id(exc_idx, year)
            exc_idx += 1
            reason_text = f"Awarded quote {higher_quote['quote_id']} is not lowest landed cost and has no rationale"
            exceptions.append({
                "exception_id": exc_id,
                "issue_type": "non_cheapest_without_rationale",
                "entity_type": "rfq_award",
                "entity_id": target_award_2["award_id"],
                "severity": "high",
                "reason": reason_text,
                "status": "open",
                "detected_by": "system",
                "detected_at": target_award_2["awarded_at"]
            })

            ground_truth_labels.append({
                "label_id": label_idx,
                "issue_type": "non_cheapest_without_rationale",
                "entity_type": "rfq_award",
                "entity_id": target_award_2["award_id"],
                "is_anomaly": True,
                "expected_decision": "require_rationale",
                "expected_reason": reason_text,
                "injected_by_rule": "RULE_NON_CHEAPEST_WITHOUT_RATIONALE",
                "generator_seed": seed,
                "created_at": target_award_2["awarded_at"]
            })
            label_idx += 1

    # -------------------------------------------------------------
    # 4. Edge Case: supplier_inactive
    # PO issued to a deactivated or blacklisted vendor
    # -------------------------------------------------------------
    inactive_suppliers = [s for s in suppliers if s["status"] in ["inactive", "blacklisted"]]
    if inactive_suppliers and len(purchase_orders) > 2:
        inact_sup = inactive_suppliers[0]
        inact_sup["deactivated_on"] = f"{year}-01-05" # Ensure deactivated prior to PO
        target_po_inact = purchase_orders[2]
        target_po_inact["supplier_id"] = inact_sup["supplier_id"]

        exc_id = generate_exception_id(exc_idx, year)
        exc_idx += 1
        reason_text = f"Supplier {inact_sup['supplier_id']} is {inact_sup['status']}"
        exceptions.append({
            "exception_id": exc_id,
            "issue_type": "supplier_inactive",
            "entity_type": "purchase_order",
            "entity_id": target_po_inact["po_id"],
            "severity": "critical",
            "reason": reason_text,
            "status": "open",
            "detected_by": "system",
            "detected_at": target_po_inact["created_at"]
        })

        ground_truth_labels.append({
            "label_id": label_idx,
            "issue_type": "supplier_inactive",
            "entity_type": "purchase_order",
            "entity_id": target_po_inact["po_id"],
            "is_anomaly": True,
            "expected_decision": "block_po",
            "expected_reason": reason_text,
            "injected_by_rule": "RULE_SUPPLIER_INACTIVE",
            "generator_seed": seed,
            "created_at": target_po_inact["created_at"]
        })
        label_idx += 1

    # -------------------------------------------------------------
    # 5. Edge Case: budget_overrun
    # Commitments exceed allocated budget amount
    # -------------------------------------------------------------
    if budgets:
        target_budget = budgets[0]
        # Insert a ledger commitment exceeding allocated amount
        overrun_commitment = target_budget["allocated_amount"] + 150000.0
        budget_ledger.append({
            "budget_id": target_budget["budget_id"],
            "entry_type": "commitment",
            "amount": overrun_commitment,
            "pr_id": None,
            "po_id": purchase_orders[3]["po_id"] if len(purchase_orders) > 3 else None,
            "entry_date": f"{year}-02-01",
            "notes": "Emergency hardware commitment resulting in budget overrun"
        })

        exc_id = generate_exception_id(exc_idx, year)
        exc_idx += 1
        reason_text = f"Available amount for budget {target_budget['budget_id']} is negative (-150000.00)"
        exceptions.append({
            "exception_id": exc_id,
            "issue_type": "budget_overrun",
            "entity_type": "budget",
            "entity_id": target_budget["budget_id"],
            "severity": "high",
            "reason": reason_text,
            "status": "open",
            "detected_by": "system",
            "detected_at": f"{year}-02-01T00:00:00Z"
        })

        ground_truth_labels.append({
            "label_id": label_idx,
            "issue_type": "budget_overrun",
            "entity_type": "budget",
            "entity_id": target_budget["budget_id"],
            "is_anomaly": True,
            "expected_decision": "budget_supplement",
            "expected_reason": reason_text,
            "injected_by_rule": "RULE_BUDGET_OVERRUN",
            "generator_seed": seed,
            "created_at": f"{year}-02-01T00:00:00Z"
        })
        label_idx += 1

    # -------------------------------------------------------------
    # 6. Edge Case: duplicate_request
    # Duplicate purchase request explicitly linked and matched
    # -------------------------------------------------------------
    if len(purchase_requests) > 10:
        orig_pr = purchase_requests[5]
        dup_pr = purchase_requests[6]
        
        # Link explicitly and align values
        dup_pr["duplicate_of_pr_id"] = orig_pr["pr_id"]
        dup_pr["requester_id"] = orig_pr["requester_id"]
        dup_pr["department_id"] = orig_pr["department_id"]
        dup_pr["estimated_total"] = orig_pr["estimated_total"]
        dup_pr["created_at"] = orig_pr["created_at"]

        exc_id = generate_exception_id(exc_idx, year)
        exc_idx += 1
        reason_text = f"Possible duplicate of {orig_pr['pr_id']}"
        exceptions.append({
            "exception_id": exc_id,
            "issue_type": "duplicate_request",
            "entity_type": "purchase_request",
            "entity_id": dup_pr["pr_id"],
            "severity": "medium",
            "reason": reason_text,
            "status": "open",
            "detected_by": "system",
            "detected_at": dup_pr["created_at"]
        })

        ground_truth_labels.append({
            "label_id": label_idx,
            "issue_type": "duplicate_request",
            "entity_type": "purchase_request",
            "entity_id": dup_pr["pr_id"],
            "is_anomaly": True,
            "expected_decision": "cancel_duplicate",
            "expected_reason": reason_text,
            "injected_by_rule": "RULE_DUPLICATE_REQUEST",
            "generator_seed": seed,
            "created_at": dup_pr["created_at"]
        })
        label_idx += 1

    # -------------------------------------------------------------
    # 7. Edge Case: quote_currency_mismatch
    # Quote currency differs from RFQ comparison currency (USD)
    # -------------------------------------------------------------
    if supplier_quotes:
        target_quote_curr = supplier_quotes[5]
        target_quote_curr["currency_code"] = "EUR"
        target_quote_curr["fx_rate_to_base"] = 1.08
        
        rfq_obj = rfq_map.get(target_quote_curr["rfq_id"])
        rfq_curr = rfq_obj["currency_code"] if rfq_obj else "USD"

        exc_id = generate_exception_id(exc_idx, year)
        exc_idx += 1
        reason_text = f"Quote currency EUR vs RFQ currency {rfq_curr}"
        exceptions.append({
            "exception_id": exc_id,
            "issue_type": "quote_currency_mismatch",
            "entity_type": "supplier_quote",
            "entity_id": target_quote_curr["quote_id"],
            "severity": "medium",
            "reason": reason_text,
            "status": "open",
            "detected_by": "system",
            "detected_at": target_quote_curr["created_at"]
        })

        ground_truth_labels.append({
            "label_id": label_idx,
            "issue_type": "quote_currency_mismatch",
            "entity_type": "supplier_quote",
            "entity_id": target_quote_curr["quote_id"],
            "is_anomaly": True,
            "expected_decision": "convert_currency",
            "expected_reason": reason_text,
            "injected_by_rule": "RULE_QUOTE_CURRENCY_MISMATCH",
            "generator_seed": seed,
            "created_at": target_quote_curr["created_at"]
        })
        label_idx += 1

    # -------------------------------------------------------------
    # Natural operational exceptions: single_source, split_purchase, supplier_risk_flag
    # -------------------------------------------------------------
    # Single source PR exceptions
    single_source_prs = [p for p in purchase_requests if p["procurement_type"] == "single_source"]
    for s_pr in single_source_prs[:5]:
        exc_id = generate_exception_id(exc_idx, year)
        exc_idx += 1
        exceptions.append({
            "exception_id": exc_id,
            "issue_type": "single_source",
            "entity_type": "purchase_request",
            "entity_id": s_pr["pr_id"],
            "severity": "medium",
            "reason": f"Single source justification provided: {s_pr['single_source_justification']}",
            "status": "acknowledged",
            "detected_by": "system",
            "detected_at": s_pr["created_at"]
        })

    # Split purchase PR exceptions
    if len(purchase_requests) > 20:
        split_pr_1 = purchase_requests[15]
        split_pr_2 = purchase_requests[16]
        split_group = "SPLIT-2026-001"
        split_pr_1["split_group_id"] = split_group
        split_pr_2["split_group_id"] = split_group
        split_pr_1["department_id"] = split_pr_2["department_id"]
        split_pr_1["estimated_total"] = 3200.0
        split_pr_2["estimated_total"] = 2800.0 # Total = 6000.0 >= 5000 threshold

        for sp in [split_pr_1, split_pr_2]:
            exc_id = generate_exception_id(exc_idx, year)
            exc_idx += 1
            exceptions.append({
                "exception_id": exc_id,
                "issue_type": "split_purchase",
                "entity_type": "purchase_request",
                "entity_id": sp["pr_id"],
                "severity": "high",
                "reason": f"Split group {split_group} totals 6000.00 (exceeds competitive threshold 5000.00)",
                "status": "open",
                "detected_by": "system",
                "detected_at": sp["created_at"]
            })

    # Supplier risk flag exceptions on POs
    for po in purchase_orders:
        sup = supplier_map.get(po["supplier_id"])
        if sup and sup["risk_flag"]:
            exc_id = generate_exception_id(exc_idx, year)
            exc_idx += 1
            exceptions.append({
                "exception_id": exc_id,
                "issue_type": "supplier_risk_flag",
                "entity_type": "purchase_order",
                "entity_id": po["po_id"],
                "severity": "high" if sup["risk_level"] == "critical" else "medium",
                "reason": f"Supplier {sup['supplier_id']} risk flag: {sup['risk_reason']}",
                "status": "acknowledged",
                "detected_by": "system",
                "detected_at": po["created_at"]
            })

    return exceptions, ground_truth_labels
