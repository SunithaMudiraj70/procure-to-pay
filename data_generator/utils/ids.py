"""
Deterministic ID generation helpers for Procure-to-Pay entities.

Patterns:
- Department: DEP-001
- Requester: RQT-000001
- Budget: BUD-2026-0001
- Supplier: SUP-000001
- Purchase Request: PR-2026-000001
- Request Line: PR-2026-000001-L01
- RFQ: RFQ-2026-000001
- Quotation: QUO-<supplier-code>-2026-000001
- Quote Line: QUO-<supplier-code>-2026-000001-L01
- Award: AWD-2026-000001
- Approval: APR-2026-000001
- Purchase Order: PO-2026-000001
- PO Line: PO-2026-000001-L01
- Delivery: DEL-PO-2026-000001-01
- Exception: EXC-2026-000001
"""

DEFAULT_YEAR: int = 2026

def generate_dept_id(counter: int) -> str:
    """Generates deterministic Department ID (e.g. DEP-001)."""
    return f"DEP-{counter:03d}"

def generate_requester_id(counter: int) -> str:
    """Generates deterministic Requester ID (e.g. RQT-000001)."""
    return f"RQT-{counter:06d}"

def generate_budget_id(counter: int, year: int = DEFAULT_YEAR) -> str:
    """Generates deterministic Budget ID (e.g. BUD-2026-0001)."""
    return f"BUD-{year}-{counter:04d}"

def generate_supplier_id(counter: int) -> str:
    """Generates deterministic Supplier ID (e.g. SUP-000001)."""
    return f"SUP-{counter:06d}"

def generate_pr_id(counter: int, year: int = DEFAULT_YEAR) -> str:
    """Generates deterministic Purchase Request ID (e.g. PR-2026-000001)."""
    return f"PR-{year}-{counter:06d}"

def generate_pr_line_id(pr_id: str, line_no: int) -> str:
    """Generates deterministic Request Line ID (e.g. PR-2026-000001-L01)."""
    return f"{pr_id}-L{line_no:02d}"

def generate_rfq_id(counter: int, year: int = DEFAULT_YEAR) -> str:
    """Generates deterministic RFQ ID (e.g. RFQ-2026-000001)."""
    return f"RFQ-{year}-{counter:06d}"

def generate_quote_id(supplier_code: str, counter: int, year: int = DEFAULT_YEAR) -> str:
    """Generates deterministic Quotation ID (e.g. QUO-SUP001-2026-000001)."""
    clean_code = str(supplier_code).strip().upper()
    return f"QUO-{clean_code}-{year}-{counter:06d}"

def generate_quote_line_id(quote_id: str, line_no: int) -> str:
    """Generates deterministic Quote Line ID (e.g. QUO-SUP001-2026-000001-L01)."""
    return f"{quote_id}-L{line_no:02d}"

def generate_award_id(counter: int, year: int = DEFAULT_YEAR) -> str:
    """Generates deterministic Award ID (e.g. AWD-2026-000001)."""
    return f"AWD-{year}-{counter:06d}"

def generate_approval_id(counter: int, year: int = DEFAULT_YEAR) -> str:
    """Generates deterministic Approval ID (e.g. APR-2026-000001)."""
    return f"APR-{year}-{counter:06d}"

def generate_po_id(counter: int, year: int = DEFAULT_YEAR) -> str:
    """Generates deterministic Purchase Order ID (e.g. PO-2026-000001)."""
    return f"PO-{year}-{counter:06d}"

def generate_po_line_id(po_id: str, line_no: int) -> str:
    """Generates deterministic Purchase Order Line ID (e.g. PO-2026-000001-L01)."""
    return f"{po_id}-L{line_no:02d}"

def generate_delivery_id(po_id: str, counter: int) -> str:
    """Generates deterministic Delivery ID (e.g. DEL-PO-2026-000001-01)."""
    clean_po = str(po_id).strip()
    return f"DEL-{clean_po}-{counter:02d}"

def generate_exception_id(counter: int, year: int = DEFAULT_YEAR) -> str:
    """Generates deterministic Exception ID (e.g. EXC-2026-000001)."""
    return f"EXC-{year}-{counter:06d}"
