"""
Transactions generator for Procure-to-Pay system:
- Purchase Requests (PR-2026-000001..) & Request Lines
- Approvals (APR-2026-000001..)
- RFQs (RFQ-2026-000001..), RFQ Lines, RFQ Suppliers
- Supplier Quotes (QUO-SUP001-2026-000001..) & Quote Lines
- Quote Evaluations & RFQ Awards (AWD-2026-000001..)
- Purchase Orders (PO-2026-000001..) & PO Lines
- Deliveries (DEL-PO-2026-000001-01..) & Delivery Lines
- Budget Ledger & Status Events
"""

import random
from datetime import datetime, timedelta
from typing import Dict, List, Tuple
from faker import Faker

from utils.ids import (
    generate_pr_id,
    generate_pr_line_id,
    generate_rfq_id,
    generate_quote_id,
    generate_quote_line_id,
    generate_award_id,
    generate_approval_id,
    generate_po_id,
    generate_po_line_id,
    generate_delivery_id
)

CATALOG_ITEMS = {
    "Hardware": [
        ("HW-SRV-01", "Rackmount Enterprise Server 2U", 4500.0),
        ("HW-LAP-02", "Developer Laptop 32GB RAM", 1850.0),
        ("HW-MON-03", "4K Ultra-Wide Monitor 34-inch", 650.0),
        ("HW-DSK-04", "Modular Workstation Mini PC", 950.0),
        ("HW-SWT-05", "48-Port Managed Network Switch", 2200.0)
    ],
    "Software": [
        ("SW-DAT-01", "Database Enterprise Core License", 7500.0),
        ("SW-DEV-02", "IDE Professional Multi-User Subscription", 450.0),
        ("SW-MON-03", "Application Monitoring Annual Subscription", 3600.0),
        ("SW-SEC-04", "Endpoint Threat Protection 50-Seat", 2800.0),
        ("SW-BI-05", "Analytics & Reporting Platform Cloud License", 5200.0)
    ],
    "Cloud Infrastructure": [
        ("CLD-COM-01", "Dedicated Cloud Compute Cluster Reserve", 6200.0),
        ("CLD-STR-02", "Cold Storage Multi-Region Archive 50TB", 1200.0),
        ("CLD-NET-03", "Direct Connect Enterprise Gateway Port", 1800.0),
        ("CLD-K8S-04", "Managed Kubernetes Control Plane Reserve", 3400.0)
    ],
    "Consulting": [
        ("CNS-ARC-01", "Senior Cloud Architecture Advisory", 220.0),
        ("CNS-SEC-02", "Cybersecurity Penetration Testing & Audit", 15000.0),
        ("CNS-IMP-03", "ERP System Integration Services", 180.0),
        ("CNS-TRN-04", "Specialized Technical Training Workshop", 4500.0)
    ],
    "Office Supplies": [
        ("OFC-DK-01", "Ergonomic Electric Standing Desk", 750.0),
        ("OFC-CHR-02", "Ergonomic Lumbar Mesh Task Chair", 420.0),
        ("OFC-PRN-03", "High-Volume Department Laser Copier", 1600.0),
        ("OFC-SUP-04", "Premium Stationery Supply Bulk Pack", 150.0)
    ],
    "Facilities": [
        ("FAC-HVAC-01", "Precision HVAC Filter & Blower Assembly", 3100.0),
        ("FAC-SEC-02", "Access Badge Reader & Turnstile Mechanism", 2400.0),
        ("FAC-LED-03", "Commercial High-Efficiency Light Panels", 850.0)
    ],
    "Logistics": [
        ("LOG-PLT-01", "Heavy-Duty Warehouse Storage Pallets", 65.0),
        ("LOG-FLT-02", "Electric Pallet Jack Forklift", 3800.0),
        ("LOG-PKG-03", "Biodegradable Packaging Cushioning 1000m", 280.0)
    ],
    "Security Services": [
        ("SEC-SOC-01", "24/7 Managed SOC Surveillance Service", 8500.0),
        ("SEC-AUD-02", "SOC2 Type II Annual Compliance Audit", 18000.0),
        ("SEC-ID-03", "Hardware Security Keys Multi-Pack", 55.0)
    ]
}

def get_required_approval_level(amount: float) -> int:
    """Returns required approval level based on policy thresholds."""
    if amount < 5000.0:
        return 1
    elif amount < 25000.0:
        return 2
    elif amount < 100000.0:
        return 3
    else:
        return 4

def generate_transactions(
    faker: Faker,
    rng: random.Random,
    master_data: Dict[str, List[Dict]],
    target_volumes: Dict[str, int],
    year: int = 2026
) -> Dict[str, List[Dict]]:
    """Generates all transaction and event records."""
    
    departments = master_data["departments"]
    requesters = master_data["requesters"]
    budgets = master_data["budgets"]
    suppliers = master_data["suppliers"]
    supplier_categories = master_data["supplier_categories"]

    # Index approvers by level
    approvers_by_level = {1: [], 2: [], 3: [], 4: []}
    for r in requesters:
        if r.get("role") == "approver" and r.get("approval_level"):
            approvers_by_level[r["approval_level"]].append(r)
            
    # Index budgets by department
    dept_budgets = {}
    for b in budgets:
        dept_budgets.setdefault(b["department_id"], []).append(b)

    # Index suppliers by category
    cat_suppliers = {}
    for sc in supplier_categories:
        cat_suppliers.setdefault(sc["category"], []).append(sc["supplier_id"])
    all_supplier_ids = [s["supplier_id"] for s in suppliers]
    supplier_map = {s["supplier_id"]: s for s in suppliers}

    # Number of entities from config
    num_prs = target_volumes.get("requests", 1200)
    num_rfqs = target_volumes.get("rfqs", 500)
    num_quotes = target_volumes.get("quotes", 1500)
    num_pos = target_volumes.get("pos", 900)

    # 1. Generate Purchase Requests & Request Lines
    purchase_requests = []
    request_lines = []
    approvals = []
    budget_ledger = []
    status_events = []

    # Initial budget allocations in ledger
    for b in budgets:
        budget_ledger.append({
            "budget_id": b["budget_id"],
            "entry_type": "allocation",
            "amount": b["allocated_amount"],
            "pr_id": None,
            "po_id": None,
            "entry_date": f"{year}-01-01",
            "notes": f"Initial FY{year} budget allocation"
        })

    approval_counter = 1
    base_date = datetime(year, 1, 15)

    # Generate PR records
    for pr_idx in range(1, num_prs + 1):
        pr_id = generate_pr_id(pr_idx, year)
        dept = departments[(pr_idx - 1) % len(departments)]
        dept_id = dept["department_id"]
        
        # Pick requester from department
        dept_reqs = [r for r in requesters if r["department_id"] == dept_id and r["is_active"]]
        req = rng.choice(dept_reqs) if dept_reqs else requesters[0]

        # Pick budget
        dept_b_list = dept_budgets.get(dept_id, [budgets[0]])
        budget = rng.choice(dept_b_list)
        budget_id = budget["budget_id"]

        # Category for PR
        cat = budget.get("category") or rng.choice(list(CATALOG_ITEMS.keys()))
        
        # Items for lines
        available_items = CATALOG_ITEMS.get(cat, CATALOG_ITEMS["Hardware"])
        num_lines = rng.randint(1, 3)
        selected_items = rng.sample(available_items, k=min(num_lines, len(available_items)))

        # Procurement pathway
        # ~80% competitive, ~10% single_source, ~10% direct_low_value
        path_roll = rng.random()
        if path_roll < 0.10:
            proc_type = "single_source"
            single_source_just = "OEM proprietary hardware module; no compatible aftermarket alternative."
        elif path_roll < 0.20:
            proc_type = "direct_low_value"
            single_source_just = None
        else:
            proc_type = "competitive"
            single_source_just = None

        pr_title = f"{cat} Procurement for {dept['name']}"
        priority = rng.choice(["low", "normal", "normal", "high", "urgent"])
        
        # Date timeline
        day_offset = int((pr_idx / max(1, num_prs)) * 180) # Spread over first 6 months
        created_dt = base_date + timedelta(days=day_offset, hours=rng.randint(1, 8))
        created_str = created_dt.strftime("%Y-%m-%d %H:%M:%SZ")
        needed_by = (created_dt + timedelta(days=rng.randint(20, 60))).strftime("%Y-%m-%d")

        # Determine target PR status based on index and volumes
        # If pr_idx <= num_pos, it will result in a PO
        if pr_idx <= num_pos:
            target_status = "po_issued"
        elif pr_idx <= num_pos + (num_rfqs - int(num_pos * 0.7)):
            target_status = "rfq_issued"
        elif pr_idx <= num_prs - 60:
            target_status = "approved"
        elif pr_idx <= num_prs - 30:
            target_status = "pending_approval"
        elif pr_idx <= num_prs - 15:
            target_status = "rejected"
        else:
            target_status = "draft"

        # Generate request lines
        total_estimated = 0.0
        lines_for_pr = []
        for line_no, item in enumerate(selected_items, start=1):
            line_id = generate_pr_line_id(pr_id, line_no)
            item_code, desc, base_price = item
            
            # If direct_low_value, force low quantity
            if proc_type == "direct_low_value":
                qty = float(rng.randint(1, 3))
                unit_cost = round(min(base_price, 1200.0) * rng.uniform(0.9, 1.1), 2)
            else:
                qty = float(rng.randint(1, 10))
                unit_cost = round(base_price * rng.uniform(0.95, 1.15), 2)

            line_cost = round(qty * unit_cost, 2)
            total_estimated += line_cost

            req_line_obj = {
                "request_line_id": line_id,
                "pr_id": pr_id,
                "line_no": line_no,
                "item_code": item_code,
                "description": desc,
                "category": cat,
                "quantity": qty,
                "uom": "EA",
                "estimated_unit_cost": unit_cost,
                "estimated_line_cost": line_cost
            }
            request_lines.append(req_line_obj)
            lines_for_pr.append(req_line_obj)

        total_estimated = round(total_estimated, 2)

        submitted_dt = created_dt + timedelta(hours=rng.randint(1, 12)) if target_status != "draft" else None
        submitted_str = submitted_dt.strftime("%Y-%m-%d %H:%M:%SZ") if submitted_dt else None

        approved_dt = submitted_dt + timedelta(days=rng.randint(1, 3)) if target_status in ["approved", "rfq_issued", "awarded", "po_issued", "partially_delivered", "delivered", "closed"] else None
        approved_str = approved_dt.strftime("%Y-%m-%d %H:%M:%SZ") if approved_dt else None

        pr_record = {
            "pr_id": pr_id,
            "requester_id": req["requester_id"],
            "department_id": dept_id,
            "budget_id": budget_id,
            "title": pr_title,
            "justification": f"Operational requirements for {dept['name']} team projects.",
            "procurement_type": proc_type,
            "single_source_justification": single_source_just,
            "currency_code": "USD",
            "estimated_total": total_estimated,
            "priority": priority,
            "needed_by_date": needed_by,
            "status": target_status,
            "split_group_id": None,
            "duplicate_of_pr_id": None,
            "submitted_at": submitted_str,
            "approved_at": approved_str,
            "created_at": created_str,
            "updated_at": approved_str or submitted_str or created_str
        }
        purchase_requests.append(pr_record)

        # Status event for PR creation
        status_events.append({
            "entity_type": "purchase_request",
            "entity_id": pr_id,
            "from_status": None,
            "to_status": "draft",
            "actor_id": req["requester_id"],
            "reason": "Initial request drafted",
            "event_at": created_str,
            "metadata": "{}"
        })

        if submitted_str:
            status_events.append({
                "entity_type": "purchase_request",
                "entity_id": pr_id,
                "from_status": "draft",
                "to_status": "submitted",
                "actor_id": req["requester_id"],
                "reason": "Submitted for managerial review",
                "event_at": submitted_str,
                "metadata": "{}"
            })

            # Record budget reservation
            budget_ledger.append({
                "budget_id": budget_id,
                "entry_type": "reservation",
                "amount": total_estimated,
                "pr_id": pr_id,
                "po_id": None,
                "entry_date": submitted_dt.strftime("%Y-%m-%d"),
                "notes": f"Reservation for PR {pr_id}"
            })

        # Generate Approvals for required levels
        req_level = get_required_approval_level(total_estimated)
        if target_status in ["approved", "rfq_issued", "awarded", "po_issued", "partially_delivered", "delivered", "closed"]:
            # All levels approved
            for lvl in range(1, req_level + 1):
                appr_id = generate_approval_id(approval_counter, year)
                approval_counter += 1
                
                # Pick approver for this level
                eligible_approvers = approvers_by_level.get(lvl) or approvers_by_level.get(1)
                approver = rng.choice(eligible_approvers)
                dec_dt = submitted_dt + timedelta(hours=lvl * 12)
                
                approvals.append({
                    "approval_id": appr_id,
                    "pr_id": pr_id,
                    "approval_level": lvl,
                    "approver_id": approver["requester_id"],
                    "threshold_id": lvl,
                    "decision": "approved",
                    "requested_at": submitted_str,
                    "decided_at": dec_dt.strftime("%Y-%m-%d %H:%M:%SZ"),
                    "comments": f"Approved by tier {lvl} authority"
                })

        elif target_status == "rejected":
            # Rejected at tier 1 or 2
            appr_id = generate_approval_id(approval_counter, year)
            approval_counter += 1
            approver = rng.choice(approvers_by_level.get(1))
            dec_dt = submitted_dt + timedelta(days=1)
            approvals.append({
                "approval_id": appr_id,
                "pr_id": pr_id,
                "approval_level": 1,
                "approver_id": approver["requester_id"],
                "threshold_id": 1,
                "decision": "rejected",
                "requested_at": submitted_str,
                "decided_at": dec_dt.strftime("%Y-%m-%d %H:%M:%SZ"),
                "comments": "Requisition rejected due to prioritization constraints."
            })

    # 2. Generate RFQs, Supplier Quotes, and Evaluations
    # Select competitive PRs that qualify for RFQs
    rfq_eligible_prs = [
        p for p in purchase_requests 
        if p["procurement_type"] == "competitive" and p["status"] in ["rfq_issued", "po_issued", "approved"]
    ]

    rfqs = []
    rfq_request_lines = []
    rfq_suppliers = []
    supplier_quotes = []
    quote_lines = []
    quote_evaluations = []
    rfq_awards = []

    # Map request lines by PR
    pr_lines_map = {}
    for l in request_lines:
        pr_lines_map.setdefault(l["pr_id"], []).append(l)

    quote_global_idx = 1
    award_counter = 1

    # Exactly num_rfqs to generate
    rfq_count_to_make = min(num_rfqs, len(rfq_eligible_prs))
    
    for rfq_idx in range(1, rfq_count_to_make + 1):
        rfq_id = generate_rfq_id(rfq_idx, year)
        pr = rfq_eligible_prs[rfq_idx - 1]
        p_lines = pr_lines_map.get(pr["pr_id"], [])

        creator_req = requesters[3] # Procurement analyst/lead
        pr_created_dt = datetime.strptime(pr["created_at"], "%Y-%m-%d %H:%M:%SZ")
        rfq_issue_dt = pr_created_dt + timedelta(days=3)
        rfq_closing_dt = rfq_issue_dt + timedelta(days=14)

        rfq_status = "awarded" if pr["status"] == "po_issued" else "quotes_received"

        rfqs.append({
            "rfq_id": rfq_id,
            "created_by": creator_req["requester_id"],
            "currency_code": "USD",
            "issue_date": rfq_issue_dt.strftime("%Y-%m-%d"),
            "closing_date": rfq_closing_dt.strftime("%Y-%m-%d"),
            "min_quotes_required": 3,
            "status": rfq_status,
            "notes": f"Competitive RFQ for PR {pr['pr_id']}",
            "created_at": rfq_issue_dt.strftime("%Y-%m-%d %H:%M:%SZ"),
            "updated_at": rfq_issue_dt.strftime("%Y-%m-%d %H:%M:%SZ")
        })

        # Link RFQ to request lines
        for l in p_lines:
            rfq_request_lines.append({
                "rfq_id": rfq_id,
                "request_line_id": l["request_line_id"]
            })

        # Invite 3 to 4 suppliers for this RFQ category
        primary_cat = p_lines[0]["category"] if p_lines else "Hardware"
        eligible_suppliers = cat_suppliers.get(primary_cat, all_supplier_ids)
        if len(eligible_suppliers) < 3:
            eligible_suppliers = all_supplier_ids
            
        invited_supplier_ids = rng.sample(eligible_suppliers, k=min(4, len(eligible_suppliers)))
        quotes_for_this_rfq = []

        for sup_id in invited_supplier_ids:
            sup = supplier_map[sup_id]
            rfq_suppliers.append({
                "rfq_id": rfq_id,
                "supplier_id": sup_id,
                "invited_on": rfq_issue_dt.strftime("%Y-%m-%d"),
                "response_status": "quoted"
            })

            # Create quotation
            q_id = generate_quote_id(sup["supplier_code"], quote_global_idx, year)
            quote_global_idx += 1

            quote_dt = rfq_issue_dt + timedelta(days=rng.randint(2, 10))
            valid_until_dt = quote_dt + timedelta(days=rng.randint(30, 60))

            # Foreign currency chance ~10%
            q_curr = sup["default_currency"]
            fx_rate = 1.0
            if q_curr == "EUR":
                fx_rate = 1.08
            elif q_curr == "GBP":
                fx_rate = 1.25
            elif q_curr == "CAD":
                fx_rate = 0.74

            # Line total calculations
            q_subtotal = 0.0
            for line_no, r_line in enumerate(p_lines, start=1):
                ql_id = generate_quote_line_id(q_id, line_no)
                unit_price = round((r_line["estimated_unit_cost"] / fx_rate) * rng.uniform(0.85, 1.15), 2)
                line_tot = round(r_line["quantity"] * unit_price, 2)
                q_subtotal += line_tot

                quote_lines.append({
                    "quote_line_id": ql_id,
                    "quote_id": q_id,
                    "line_no": line_no,
                    "request_line_id": r_line["request_line_id"],
                    "quantity": r_line["quantity"],
                    "unit_price": unit_price,
                    "line_total": line_tot
                })

            q_subtotal = round(q_subtotal, 2)
            freight = round(q_subtotal * rng.uniform(0.02, 0.05), 2)
            duty = round(q_subtotal * rng.uniform(0.01, 0.03), 2) if q_curr != "USD" else 0.0
            other = 0.0
            tot_landed = round(q_subtotal + freight + duty + other, 2)
            tot_landed_base = round(tot_landed * fx_rate, 2)
            deliv_days = rng.randint(7, 30)

            quote_obj = {
                "quote_id": q_id,
                "rfq_id": rfq_id,
                "supplier_id": sup_id,
                "quote_date": quote_dt.strftime("%Y-%m-%d"),
                "valid_until": valid_until_dt.strftime("%Y-%m-%d"),
                "currency_code": q_curr,
                "fx_rate_to_base": fx_rate,
                "subtotal": q_subtotal,
                "freight_cost": freight,
                "duty_cost": duty,
                "other_charges": other,
                "total_landed_cost": tot_landed,
                "total_landed_cost_base": tot_landed_base,
                "delivery_days": deliv_days,
                "payment_terms_days": sup["payment_terms_days"],
                "status": "submitted",
                "created_at": quote_dt.strftime("%Y-%m-%d %H:%M:%SZ"),
                "updated_at": quote_dt.strftime("%Y-%m-%d %H:%M:%SZ")
            }
            supplier_quotes.append(quote_obj)
            quotes_for_this_rfq.append(quote_obj)

        # Evaluate quotes for this RFQ
        if quotes_for_this_rfq:
            sorted_by_cost = sorted(quotes_for_this_rfq, key=lambda q: q["total_landed_cost_base"])
            sorted_by_delivery = sorted(quotes_for_this_rfq, key=lambda q: q["delivery_days"])
            min_cost = sorted_by_cost[0]["total_landed_cost_base"]
            min_days = sorted_by_delivery[0]["delivery_days"]

            cost_ranks = {q["quote_id"]: rank for rank, q in enumerate(sorted_by_cost, start=1)}
            deliv_ranks = {q["quote_id"]: rank for rank, q in enumerate(sorted_by_delivery, start=1)}

            for q in quotes_for_this_rfq:
                c_score = (min_cost / q["total_landed_cost_base"]) * 100.0 if q["total_landed_cost_base"] > 0 else 100.0
                d_score = (min_days / q["delivery_days"]) * 100.0 if q["delivery_days"] > 0 else 100.0
                weighted = round((0.70 * c_score) + (0.30 * d_score), 4)

                quote_evaluations.append({
                    "rfq_id": rfq_id,
                    "quote_id": q["quote_id"],
                    "evaluation_run": 1,
                    "total_landed_cost_base": q["total_landed_cost_base"],
                    "delivery_days": q["delivery_days"],
                    "cost_rank": cost_ranks[q["quote_id"]],
                    "delivery_rank": deliv_ranks[q["quote_id"]],
                    "weighted_score": weighted,
                    "is_lowest_cost": (cost_ranks[q["quote_id"]] == 1),
                    "is_fastest": (deliv_ranks[q["quote_id"]] == 1),
                    "is_eligible": True,
                    "ineligibility_reason": None,
                    "evaluated_by": creator_req["requester_id"],
                    "evaluated_at": (rfq_closing_dt + timedelta(days=1)).strftime("%Y-%m-%d %H:%M:%SZ")
                })

            # If RFQ is awarded, pick winner
            if rfq_status == "awarded":
                winner = sorted_by_cost[0] # Lowest cost winner by default
                winner["status"] = "awarded"
                for other_q in quotes_for_this_rfq:
                    if other_q["quote_id"] != winner["quote_id"]:
                        other_q["status"] = "rejected"

                award_id = generate_award_id(award_counter, year)
                award_counter += 1
                award_dt = rfq_closing_dt + timedelta(days=2)

                rfq_awards.append({
                    "award_id": award_id,
                    "rfq_id": rfq_id,
                    "quote_id": winner["quote_id"],
                    "supplier_id": winner["supplier_id"],
                    "awarded_by": creator_req["requester_id"],
                    "awarded_at": award_dt.strftime("%Y-%m-%d %H:%M:%SZ"),
                    "award_basis": "lowest_landed_cost",
                    "is_lowest_cost": True,
                    "rationale": "Awarded to qualified bidder with lowest total landed cost meeting all technical specs."
                })

    # 3. Generate Purchase Orders & Deliveries
    # Connect awarded RFQs and non-competitive PRs to POs
    purchase_orders = []
    purchase_order_lines = []
    deliveries = []
    delivery_lines = []

    # Map awards by rfq_id
    award_map = {a["rfq_id"]: a for a in rfq_awards}
    quote_map = {q["quote_id"]: q for q in supplier_quotes}
    quote_lines_map = {}
    for ql in quote_lines:
        quote_lines_map.setdefault(ql["quote_id"], []).append(ql)

    po_idx = 1
    for pr in purchase_requests:
        if po_idx > num_pos:
            break
            
        if pr["status"] != "po_issued":
            continue

        po_id = generate_po_id(po_idx, year)
        dept = next((d for d in departments if d["department_id"] == pr["department_id"]), departments[0])
        p_lines = pr_lines_map.get(pr["pr_id"], [])

        # Match RFQ award if competitive
        associated_award = None
        associated_quote = None
        associated_rfq = None

        if pr["procurement_type"] == "competitive":
            # Find RFQ covering this PR's request lines
            for r_line in p_lines:
                for rfq_line in rfq_request_lines:
                    if rfq_line["request_line_id"] == r_line["request_line_id"]:
                        associated_rfq = rfq_line["rfq_id"]
                        associated_award = award_map.get(associated_rfq)
                        if associated_award:
                            associated_quote = quote_map.get(associated_award["quote_id"])
                        break
                if associated_award:
                    break

        # If competitive but no award found (or single-source/direct), pick a supplier
        if associated_award and associated_quote:
            po_supplier_id = associated_award["supplier_id"]
            po_quote_id = associated_quote["quote_id"]
            po_rfq_id = associated_rfq
            po_award_id = associated_award["award_id"]
            po_type = "competitive"
            po_curr = associated_quote["currency_code"]
            freight = associated_quote["freight_cost"]
            duty = associated_quote["duty_cost"]
            other = associated_quote["other_charges"]
        else:
            # Single source or direct low value
            primary_cat = p_lines[0]["category"] if p_lines else "Hardware"
            eligible_sups = cat_suppliers.get(primary_cat, all_supplier_ids)
            po_supplier_id = rng.choice(eligible_sups)
            po_quote_id = None
            po_rfq_id = None
            po_type = "direct_low_value" if pr["estimated_total"] < 5000 else "single_source"
            po_curr = "USD"
            freight = round(pr["estimated_total"] * 0.02, 2)
            duty = 0.0
            other = 0.0

        sup = supplier_map[po_supplier_id]
        issued_req = requesters[3] # Procurement buyer
        pr_approved_dt = datetime.strptime(pr["approved_at"], "%Y-%m-%d %H:%M:%SZ") if pr["approved_at"] else base_date
        po_issued_dt = pr_approved_dt + timedelta(days=rng.randint(1, 3))
        expected_deliv_dt = po_issued_dt + timedelta(days=rng.randint(14, 45))

        # PO status distribution
        po_status_roll = rng.random()
        if po_status_roll < 0.45:
            po_status = "delivered"
        elif po_status_roll < 0.70:
            po_status = "partially_delivered"
        elif po_status_roll < 0.90:
            po_status = "issued"
        else:
            po_status = "acknowledged"

        # Generate PO lines
        po_subtotal = 0.0
        po_lines_for_this_po = []

        q_lines_for_quote = quote_lines_map.get(po_quote_id, [])
        q_line_by_req_line = {ql["request_line_id"]: ql for ql in q_lines_for_quote}

        for line_no, r_line in enumerate(p_lines, start=1):
            pol_id = generate_po_line_id(po_id, line_no)
            matching_ql = q_line_by_req_line.get(r_line["request_line_id"])
            
            unit_price = matching_ql["unit_price"] if matching_ql else r_line["estimated_unit_cost"]
            qty = r_line["quantity"]
            line_tot = round(qty * unit_price, 2)
            po_subtotal += line_tot

            po_line_record = {
                "po_line_id": pol_id,
                "po_id": po_id,
                "line_no": line_no,
                "request_line_id": r_line["request_line_id"],
                "quote_line_id": matching_ql["quote_line_id"] if matching_ql else None,
                "description": r_line["description"],
                "quantity": qty,
                "unit_price": unit_price,
                "line_total": line_tot
            }
            purchase_order_lines.append(po_line_record)
            po_lines_for_this_po.append(po_line_record)

        po_subtotal = round(po_subtotal, 2)
        total_amt = round(po_subtotal + freight + duty + other, 2)

        po_record = {
            "po_id": po_id,
            "pr_id": pr["pr_id"],
            "rfq_id": po_rfq_id,
            "quote_id": po_quote_id,
            "award_id": po_award_id,
            "supplier_id": po_supplier_id,
            "issued_by": issued_req["requester_id"],
            "po_type": po_type,
            "currency_code": po_curr,
            "subtotal": po_subtotal,
            "freight_cost": freight,
            "duty_cost": duty,
            "other_charges": other,
            "total_amount": total_amt,
            "payment_terms_days": sup["payment_terms_days"],
            "issued_date": po_issued_dt.strftime("%Y-%m-%d"),
            "expected_delivery_date": expected_deliv_dt.strftime("%Y-%m-%d"),
            "status": po_status,
            "created_at": po_issued_dt.strftime("%Y-%m-%d %H:%M:%SZ"),
            "updated_at": po_issued_dt.strftime("%Y-%m-%d %H:%M:%SZ")
        }
        purchase_orders.append(po_record)

        # Budget ledger: release reservation and commit PO
        budget_ledger.append({
            "budget_id": pr["budget_id"],
            "entry_type": "reservation_release",
            "amount": pr["estimated_total"],
            "pr_id": pr["pr_id"],
            "po_id": None,
            "entry_date": po_issued_dt.strftime("%Y-%m-%d"),
            "notes": f"Reservation released on PO issue for PR {pr['pr_id']}"
        })
        budget_ledger.append({
            "budget_id": pr["budget_id"],
            "entry_type": "commitment",
            "amount": total_amt,
            "pr_id": None,
            "po_id": po_id,
            "entry_date": po_issued_dt.strftime("%Y-%m-%d"),
            "notes": f"Commitment for PO {po_id}"
        })

        # Deliveries for delivered or partially delivered POs
        if po_status in ["delivered", "partially_delivered"]:
            carrier = rng.choice(["FedEx Freight", "DHL Express", "UPS Supply Chain", "Maersk Logistics"])
            tracking = f"TRK-{rng.randint(10000000, 99999999)}"

            if po_status == "delivered":
                # Single full delivery
                del_id = generate_delivery_id(po_id, 1)
                del_dt = expected_deliv_dt - timedelta(days=rng.randint(0, 3))
                deliveries.append({
                    "delivery_id": del_id,
                    "po_id": po_id,
                    "delivery_seq": 1,
                    "scheduled_date": expected_deliv_dt.strftime("%Y-%m-%d"),
                    "actual_date": del_dt.strftime("%Y-%m-%d"),
                    "status": "delivered",
                    "carrier": carrier,
                    "tracking_ref": tracking,
                    "notes": "Full shipment received in good condition.",
                    "created_at": del_dt.strftime("%Y-%m-%d %H:%M:%SZ"),
                    "updated_at": del_dt.strftime("%Y-%m-%d %H:%M:%SZ")
                })
                for pol in po_lines_for_this_po:
                    delivery_lines.append({
                        "delivery_id": del_id,
                        "po_line_id": pol["po_line_id"],
                        "qty_delivered": pol["quantity"],
                        "qty_rejected": 0.0
                    })
            else:
                # Partial delivery: 2 separate shipments
                del_id_1 = generate_delivery_id(po_id, 1)
                del_dt_1 = expected_deliv_dt - timedelta(days=5)
                deliveries.append({
                    "delivery_id": del_id_1,
                    "po_id": po_id,
                    "delivery_seq": 1,
                    "scheduled_date": expected_deliv_dt.strftime("%Y-%m-%d"),
                    "actual_date": del_dt_1.strftime("%Y-%m-%d"),
                    "status": "partial",
                    "carrier": carrier,
                    "tracking_ref": tracking,
                    "notes": "First partial batch received.",
                    "created_at": del_dt_1.strftime("%Y-%m-%d %H:%M:%SZ"),
                    "updated_at": del_dt_1.strftime("%Y-%m-%d %H:%M:%SZ")
                })
                for pol in po_lines_for_this_po:
                    qty_deliv = float(int(pol["quantity"] * 0.5)) or 1.0
                    delivery_lines.append({
                        "delivery_id": del_id_1,
                        "po_line_id": pol["po_line_id"],
                        "qty_delivered": qty_deliv,
                        "qty_rejected": 0.0
                    })

                # Second batch scheduled / in transit
                del_id_2 = generate_delivery_id(po_id, 2)
                del_dt_2 = expected_deliv_dt + timedelta(days=10)
                deliveries.append({
                    "delivery_id": del_id_2,
                    "po_id": po_id,
                    "delivery_seq": 2,
                    "scheduled_date": del_dt_2.strftime("%Y-%m-%d"),
                    "actual_date": None,
                    "status": "in_transit",
                    "carrier": carrier,
                    "tracking_ref": f"{tracking}-B",
                    "notes": "Second batch in transit from supplier warehouse.",
                    "created_at": del_dt_1.strftime("%Y-%m-%d %H:%M:%SZ"),
                    "updated_at": del_dt_1.strftime("%Y-%m-%d %H:%M:%SZ")
                })

        po_idx += 1

    return {
        "purchase_requests": purchase_requests,
        "request_lines": request_lines,
        "approvals": approvals,
        "rfqs": rfqs,
        "rfq_request_lines": rfq_request_lines,
        "rfq_suppliers": rfq_suppliers,
        "supplier_quotes": supplier_quotes,
        "quote_lines": quote_lines,
        "quote_evaluations": quote_evaluations,
        "rfq_awards": rfq_awards,
        "purchase_orders": purchase_orders,
        "purchase_order_lines": purchase_order_lines,
        "deliveries": deliveries,
        "delivery_lines": delivery_lines,
        "budget_ledger": budget_ledger,
        "status_events": status_events
    }
