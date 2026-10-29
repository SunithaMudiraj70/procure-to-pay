# Procure-to-Pay Synthetic Data Generator

A deterministic, scalable synthetic data generation engine for the Procure-to-Pay platform.

## Features & Specifications

- **Deterministic Generation**: Fixed default seed (`SEED=20261022`) guaranteeing 100% reproducible datasets across independent runs.
- **Dynamic Scale Factor**: Supports volume scaling (`--scale <float>`) against baseline volumes. Starter (`0.1`) and full (`1.0`) datasets use the exact same generator.
- **Deterministic ID Helpers**: Enforces standardized, zero-padded identifiers matching database constraints:
  - Departments: `DEP-001`
  - Requesters: `RQT-000001`
  - Budgets: `BUD-2026-0001`
  - Suppliers: `SUP-000001` (Code: `SUP0001`)
  - Purchase Requests: `PR-2026-000001`
  - Request Lines: `PR-2026-000001-L01`
  - RFQs: `RFQ-2026-000001`
  - Supplier Quotations: `QUO-<supplier-code>-2026-000001`
  - Quote Lines: `QUO-<supplier-code>-2026-000001-L01`
  - Awards: `AWD-2026-000001`
  - Approvals: `APR-2026-000001`
  - Purchase Orders: `PO-2026-000001`
  - PO Lines: `PO-2026-000001-L01`
  - Deliveries: `DEL-PO-2026-000001-01`
  - Exceptions: `EXC-2026-000001`
- **Output Formats**: Exports CSV, JSON, SQL seed script (`seed_all.sql`), and isolated Ground Truth datasets.
- **Reproducibility Verification**: Built-in `--verify-reproducibility` flag regenerates the entire dataset twice and verifies SHA-256 hash equality for every table.

## Baseline Entity Volumes (Scale = 1.0)

| Entity | Baseline Target | Generated Volume | Notes |
| :--- | :--- | :--- | :--- |
| **Requesters** | 300 | 300 | Approvers (Levels 1-4), Analysts, Admins |
| **Suppliers** | 120 | 120 | Categorized, risk-rated, multi-currency |
| **Purchase Requests** | 1,200 | 1,200 | Competitive, Single Source, Low Value |
| **Request Lines** | Variable | 2,378 | 1 to 4 items per PR |
| **RFQs** | 500 | 500 | Competitive solicitations |
| **Quotations** | 1,500 | 2,000 | $\ge 3$ quotes per RFQ |
| **Quote Lines** | Variable | 3,948 | Landed cost breakdown |
| **RFQ Awards** | $\le 500$ | 500 | Winning evaluations with rationale |
| **Purchase Orders** | 900 | 900 | Generated from awards & direct requisitions |
| **PO Lines** | Variable | 1,802 | Itemized contract commitments |
| **Deliveries** | Variable | 838 | Includes full and partial shipments |
| **Budget Ledger** | Variable | 3,028 | Double-entry reservations & commitments |
| **Status Events** | Variable | 2,385 | Immutable audit state changes |
| **Operational Exceptions**| Variable | 92 | Registered governance flags |
| **Ground Truth Labels** | $\ge 7$ | 7 | Isolated anomaly test benchmarks |

## 7 Injected Labelled Edge Cases

The generator injects 7 distinct labelled anomalies into the dataset, which are caught by the database validation views (`v_rule_violations`) and isolated in `ground_truth.anomaly_labels`:

1. `po_without_approval`: PO issued on a PR lacking required approval tier sign-off before issuance.
2. `quote_expired_before_award`: RFQ award made for a quote whose `valid_until` date has lapsed.
3. `non_cheapest_without_rationale`: RFQ award made to a quote that is not the lowest landed cost without documented rationale.
4. `supplier_inactive`: PO placed with a deactivated or blacklisted vendor.
5. `budget_overrun`: Department commitments exceed allocated budget amount resulting in negative available balance.
6. `duplicate_request`: Purchase request matching an existing request within 7 days.
7. `quote_currency_mismatch`: Supplier quote currency differs from RFQ comparison currency (USD).

All ground truth labels are saved in `output/ground_truth/ground_truth.csv` and `ground_truth.json` and are **never leaked into input features**.

## CLI Commands

```bash
# Generate full baseline dataset (seed: 20261022, scale: 1.0) with integrity validation
python generate.py

# Generate and verify 100% reproducibility across 2 independent runs
python generate.py --scale 1.0 --seed 20261022 --verify-reproducibility

# Scale down for rapid testing (10% sample)
python generate.py --scale 0.1 --seed 20261022

# Specify custom output directory
python generate.py --out ./custom_output
```

## Documentation References

- [Data Dictionary (11 Entities + Audit)](file:///c:/Users/SUNITHA/Downloads/yotta-flex-ai/procure-to-pay/docs/data_dictionary.md)
- [Business Rules & Validation Logic](file:///c:/Users/SUNITHA/Downloads/yotta-flex-ai/procure-to-pay/docs/business_rules.md)
- [Validation Summary & Reproducibility Report](file:///c:/Users/SUNITHA/Downloads/yotta-flex-ai/procure-to-pay/docs/validation_summary.md)
- [Entity-Relationship Diagram](file:///c:/Users/SUNITHA/Downloads/yotta-flex-ai/procure-to-pay/docs/er_diagram.md)
