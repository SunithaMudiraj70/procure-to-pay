"""
Master data generator for Procure-to-Pay system:
- Departments (DEP-001..)
- Requesters (RQT-000001..)
- Budgets (BUD-2026-0001..)
- Suppliers (SUP-000001..) & Supplier Categories
"""

import random
from typing import Dict, List, Tuple
from faker import Faker

from utils.ids import (
    generate_dept_id,
    generate_requester_id,
    generate_budget_id,
    generate_supplier_id
)

CATEGORIES = [
    "Hardware",
    "Software",
    "Cloud Infrastructure",
    "Consulting",
    "Office Supplies",
    "Facilities",
    "Logistics",
    "Security Services"
]

DEPARTMENTS_DEF = [
    ("Information Technology", "CC-IT-101"),
    ("Software Engineering", "CC-ENG-102"),
    ("Facilities & Workplace", "CC-FAC-103"),
    ("Marketing & Growth", "CC-MKT-104"),
    ("Legal & Compliance", "CC-LEG-105"),
    ("Human Resources", "CC-HR-106"),
    ("Finance & Accounting", "CC-FIN-107"),
    ("Research & Development", "CC-RND-108"),
    ("Customer Experience", "CC-CX-109"),
    ("Supply Chain Operations", "CC-OPS-110")
]

CURRENCIES = ["USD", "EUR", "GBP", "CAD"]
COUNTRIES = ["US", "DE", "GB", "CA", "FR", "IN", "JP", "SG"]

def generate_master_data(
    faker: Faker,
    rng: random.Random,
    num_requesters: int = 300,
    num_suppliers: int = 120,
    year: int = 2026
) -> Dict[str, List[Dict]]:
    """Generates master tables deterministically."""
    
    # 1. Departments
    departments = []
    for idx, (name, cc) in enumerate(DEPARTMENTS_DEF, start=1):
        dept_id = generate_dept_id(idx)
        departments.append({
            "department_id": dept_id,
            "name": name,
            "cost_center": cc,
            "status": "active",
            "effective_from": f"{year}-01-01",
            "effective_to": None,
            "head_requester_id": None,
            "created_at": f"{year}-01-01T08:00:00Z"
        })

    # 2. Requesters
    requesters = []
    dept_heads = {}
    
    # Ensure each department has designated managers/approvers
    roles_pool = ["requester"] * 70 + ["approver"] * 20 + ["process_owner"] * 4 + ["operations_analyst"] * 4 + ["system_admin"] * 2

    # Reserve first 4 users for specific leadership tiers
    # RQT-000001: CFO (Level 4)
    # RQT-000002: Finance Director (Level 3)
    # RQT-000003: Procurement Head (Level 2)
    # RQT-000004..013: Department Managers (Level 1)
    
    user_idx = 1
    
    # CFO
    cfo_id = generate_requester_id(user_idx)
    requesters.append({
        "requester_id": cfo_id,
        "employee_code": f"EMP-{user_idx:05d}",
        "full_name": "Eleanor Vance (CFO)",
        "email": "eleanor.vance.cfo@enterprise.com",
        "department_id": departments[6]["department_id"], # Finance
        "role": "approver",
        "approval_level": 4,
        "is_active": True,
        "hired_on": "2018-03-15",
        "created_at": f"{year}-01-01T08:00:00Z"
    })
    user_idx += 1

    # Finance Director
    fd_id = generate_requester_id(user_idx)
    requesters.append({
        "requester_id": fd_id,
        "employee_code": f"EMP-{user_idx:05d}",
        "full_name": "Marcus Sterling (Finance Dir)",
        "email": "marcus.sterling.fd@enterprise.com",
        "department_id": departments[6]["department_id"], # Finance
        "role": "approver",
        "approval_level": 3,
        "is_active": True,
        "hired_on": "2019-06-01",
        "created_at": f"{year}-01-01T08:00:00Z"
    })
    user_idx += 1

    # Procurement Head
    proc_id = generate_requester_id(user_idx)
    requesters.append({
        "requester_id": proc_id,
        "employee_code": f"EMP-{user_idx:05d}",
        "full_name": "Sarah Jenkins (Procurement Head)",
        "email": "sarah.jenkins.proc@enterprise.com",
        "department_id": departments[9]["department_id"], # Ops
        "role": "approver",
        "approval_level": 2,
        "is_active": True,
        "hired_on": "2020-01-10",
        "created_at": f"{year}-01-01T08:00:00Z"
    })
    user_idx += 1

    # Department Heads (Level 1 Approvers for each dept)
    for dept in departments:
        mgr_id = generate_requester_id(user_idx)
        name = faker.name()
        email = f"{name.lower().replace(' ', '.')}@{dept['name'].lower().replace(' ', '').replace('&', '')}.enterprise.com"
        requesters.append({
            "requester_id": mgr_id,
            "employee_code": f"EMP-{user_idx:05d}",
            "full_name": f"{name} (Head of {dept['name']})",
            "email": email,
            "department_id": dept["department_id"],
            "role": "approver",
            "approval_level": 1,
            "is_active": True,
            "hired_on": "2021-02-01",
            "created_at": f"{year}-01-01T08:00:00Z"
        })
        dept_heads[dept["department_id"]] = mgr_id
        user_idx += 1

    # Populate remaining requesters
    while user_idx <= num_requesters:
        r_id = generate_requester_id(user_idx)
        assigned_dept = departments[(user_idx - 1) % len(departments)]
        assigned_role = rng.choice(roles_pool)
        
        appr_level = None
        if assigned_role == "approver":
            appr_level = rng.choice([1, 1, 2]) # Mostly level 1 or 2
        
        name = faker.name()
        clean_name = "".join(c for c in name.lower() if c.isalnum() or c == " ").replace(" ", ".")
        email = f"{clean_name}.{user_idx}@enterprise.com"

        requesters.append({
            "requester_id": r_id,
            "employee_code": f"EMP-{user_idx:05d}",
            "full_name": name,
            "email": email,
            "department_id": assigned_dept["department_id"],
            "role": assigned_role,
            "approval_level": appr_level,
            "is_active": rng.random() > 0.05, # 95% active
            "hired_on": f"{rng.randint(2020, 2025)}-{rng.randint(1, 12):02d}-{rng.randint(1, 28):02d}",
            "created_at": f"{year}-01-01T08:00:00Z"
        })
        user_idx += 1

    # Link head_requester_id back to departments
    for dept in departments:
        dept["head_requester_id"] = dept_heads.get(dept["department_id"])

    # 3. Budgets (Department x Categories + General)
    budgets = []
    budget_idx = 1
    for dept in departments:
        # General department budget (category = None)
        b_id = generate_budget_id(budget_idx, year)
        alloc_amount = float(rng.randint(500_000, 2_000_000))
        budgets.append({
            "budget_id": b_id,
            "department_id": dept["department_id"],
            "fiscal_year": year,
            "category": None,
            "allocated_amount": alloc_amount,
            "currency_code": "USD",
            "effective_from": f"{year}-01-01",
            "effective_to": f"{year}-12-31",
            "status": "active",
            "created_at": f"{year}-01-01T08:00:00Z"
        })
        budget_idx += 1
        
        # Category specific budgets (2 to 3 per dept)
        selected_cats = rng.sample(CATEGORIES, k=rng.randint(2, 4))
        for cat in selected_cats:
            b_id = generate_budget_id(budget_idx, year)
            cat_alloc = float(rng.randint(150_000, 800_000))
            budgets.append({
                "budget_id": b_id,
                "department_id": dept["department_id"],
                "fiscal_year": year,
                "category": cat,
                "allocated_amount": cat_alloc,
                "currency_code": "USD",
                "effective_from": f"{year}-01-01",
                "effective_to": f"{year}-12-31",
                "status": "active",
                "created_at": f"{year}-01-01T08:00:00Z"
            })
            budget_idx += 1

    # 4. Suppliers & Supplier Categories
    suppliers = []
    supplier_categories = []
    
    supplier_name_prefixes = [
        "Apex", "Nexus", "Global", "Vanguard", "Pinnacle", "Summit", "Quantum", "Synergy",
        "Optima", "Prime", "Precision", "Benchmark", "Pacific", "Atlantic", "Horizon",
        "Acro", "Omni", "Dynamic", "Stellar", "Core", "Zenith", "Titan", "Vertex", "Delta"
    ]
    supplier_name_suffixes = [
        "Technologies", "Solutions", "Systems", "Industries", "Logistics", "Enterprises",
        "Services", "Networks", "Consulting", "Components", "Materials", "Innovations", "Global"
    ]

    for s_idx in range(1, num_suppliers + 1):
        s_id = generate_supplier_id(s_idx)
        # Format code as alphanumeric uppercase SUP001.. matching ^[A-Z0-9]{3,10}$
        s_code = f"SUP{s_idx:04d}"
        
        pref = supplier_name_prefixes[(s_idx - 1) % len(supplier_name_prefixes)]
        suff = supplier_name_suffixes[(s_idx * 7) % len(supplier_name_suffixes)]
        name = f"{pref} {suff} LLC"

        status_roll = rng.random()
        if status_roll < 0.85:
            status = "active"
            deactivated_on = None
        elif status_roll < 0.92:
            status = "onboarding"
            deactivated_on = None
        elif status_roll < 0.97:
            status = "inactive"
            deactivated_on = f"{year}-02-15"
        else:
            status = "blacklisted"
            deactivated_on = f"{year}-01-20"

        # Risk flag & reason
        risk_roll = rng.random()
        if risk_roll < 0.75:
            risk_level = "low"
            risk_flag = False
            risk_reason = None
        elif risk_roll < 0.88:
            risk_level = "medium"
            risk_flag = False
            risk_reason = None
        elif risk_roll < 0.95:
            risk_level = "high"
            risk_flag = True
            risk_reason = "Repeated delivery delays and SLA breach in prior quarter"
        else:
            risk_level = "critical"
            risk_flag = True
            risk_reason = "Severe financial distress / audit irregularity"

        country = rng.choice(COUNTRIES)
        currency = "USD" if country in ["US", "IN", "SG"] else ("EUR" if country in ["DE", "FR"] else ("GBP" if country == "GB" else "CAD"))

        suppliers.append({
            "supplier_id": s_id,
            "supplier_code": s_code,
            "name": name,
            "country_code": country,
            "default_currency": currency,
            "payment_terms_days": rng.choice([15, 30, 45, 60]),
            "status": status,
            "risk_level": risk_level,
            "risk_flag": risk_flag,
            "risk_reason": risk_reason,
            "onboarded_on": f"{rng.randint(2022, 2024)}-{rng.randint(1, 12):02d}-{rng.randint(1, 28):02d}",
            "deactivated_on": deactivated_on,
            "created_at": f"{year}-01-01T08:00:00Z"
        })

        # Associate categories
        cats_for_supplier = rng.sample(CATEGORIES, k=rng.randint(1, 3))
        for cat in cats_for_supplier:
            supplier_categories.append({
                "supplier_id": s_id,
                "category": cat
            })

    return {
        "departments": departments,
        "requesters": requesters,
        "budgets": budgets,
        "suppliers": suppliers,
        "supplier_categories": supplier_categories
    }
