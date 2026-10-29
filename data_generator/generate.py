#!/usr/bin/env python3
"""
Procure-to-Pay End-to-End Synthetic Data Generator CLI

Executes Steps 1 through 10:
- Deterministic seeding (default: 20261022)
- Domain-specific generation (Master data -> Transactions -> Edge cases -> Derived values)
- Separate Ground Truth isolation (never leaked into input features)
- Export to CSV, JSON, and SQL
- Manifest & validation summary generation
- Reproducibility verification
"""

import os
import sys
import argparse
import json
import hashlib
import random
from pathlib import Path
from datetime import datetime
from typing import Dict, List, Tuple
import pandas as pd
from faker import Faker

# Setup paths
current_dir = Path(__file__).resolve().parent
if str(current_dir) not in sys.path:
    sys.path.insert(0, str(current_dir))

from config import SEED, DEFAULT_SCALE, get_config
from generators.master_data import generate_master_data
from generators.transactions import generate_transactions
from generators.edge_cases import inject_edge_cases
from validators.validate import validate_dataset

def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(
        description="Procure-to-Pay Synthetic Data Generator CLI"
    )
    parser.add_argument(
        "--scale",
        type=float,
        default=DEFAULT_SCALE,
        help=f"Volume scaling factor (default: {DEFAULT_SCALE})"
    )
    parser.add_argument(
        "--seed",
        type=int,
        default=SEED,
        help=f"Deterministic random seed (default: {SEED})"
    )
    parser.add_argument(
        "--out",
        type=str,
        default=str(current_dir / "output"),
        help="Target output directory (default: data_generator/output)"
    )
    parser.add_argument(
        "--verify-reproducibility",
        action="store_true",
        help="Runs generation twice with identical seed and compares hashes"
    )
    return parser.parse_args()

def generate_full_dataset(seed: int, scale: float) -> Tuple[Dict[str, List[Dict]], List[Dict]]:
    """Runs the complete deterministic generation pipeline in memory."""
    rng = random.Random(seed)
    faker = Faker()
    Faker.seed(seed)
    faker.seed_instance(seed)

    cfg = get_config(scale=scale, seed=seed)

    # Step 2: Master data first
    master = generate_master_data(
        faker=faker,
        rng=rng,
        num_requesters=cfg.volumes.get("requesters", 300),
        num_suppliers=cfg.volumes.get("suppliers", 120),
        year=2026
    )

    # Step 2 & 4: Transactions & Events
    transactions = generate_transactions(
        faker=faker,
        rng=rng,
        master_data=master,
        target_volumes=cfg.volumes,
        year=2026
    )

    dataset = {**master, **transactions}

    # Step 5 & 7: Inject labelled edge cases & isolate ground truth
    exceptions, ground_truth = inject_edge_cases(dataset, seed=seed, year=2026)
    dataset["exceptions"] = exceptions

    return dataset, ground_truth

def compute_sha256(file_path: Path) -> str:
    """Computes SHA256 checksum of a file."""
    h = hashlib.sha256()
    with open(file_path, "rb") as f:
        while chunk := f.read(65536):
            h.update(chunk)
    return h.hexdigest()

def export_dataset(dataset: Dict[str, List[Dict]], ground_truth: List[Dict], out_dir: Path, seed: int, scale: float) -> Dict[str, any]:
    """Exports dataset to CSV, JSON, and SQL formats, and generates manifest."""
    csv_dir = out_dir / "csv"
    json_dir = out_dir / "json"
    sql_dir = out_dir / "sql"
    gt_dir = out_dir / "ground_truth"

    for d in [csv_dir, json_dir, sql_dir, gt_dir]:
        d.mkdir(parents=True, exist_ok=True)

    manifest_tables = {}

    # Export operational tables to CSV & JSON
    for table_name, records in dataset.items():
        if not records:
            continue
        
        df = pd.DataFrame(records)
        
        # Save CSV
        csv_file = csv_dir / f"{table_name}.csv"
        df.to_csv(csv_file, index=False)
        csv_hash = compute_sha256(csv_file)

        # Save JSON
        json_file = json_dir / f"{table_name}.json"
        with open(json_file, "w", encoding="utf-8") as f:
            json.dump(records, f, indent=2, default=str)
        json_hash = compute_sha256(json_file)

        manifest_tables[table_name] = {
            "row_count": len(records),
            "columns": list(df.columns),
            "csv_sha256": csv_hash,
            "json_sha256": json_hash,
            "csv_size_bytes": csv_file.stat().st_size
        }

    # Step 7: Export isolated ground truth
    gt_df = pd.DataFrame(ground_truth)
    gt_csv = gt_dir / "ground_truth.csv"
    gt_df.to_csv(gt_csv, index=False)
    gt_csv_hash = compute_sha256(gt_csv)

    gt_json = gt_dir / "ground_truth.json"
    with open(gt_json, "w", encoding="utf-8") as f:
        json.dump(ground_truth, f, indent=2, default=str)
    gt_json_hash = compute_sha256(gt_json)

    manifest_tables["ground_truth"] = {
        "row_count": len(ground_truth),
        "columns": list(gt_df.columns),
        "csv_sha256": gt_csv_hash,
        "json_sha256": gt_json_hash,
        "csv_size_bytes": gt_csv.stat().st_size
    }

    # Step 9: Export SQL Seed script
    sql_file = sql_dir / "seed_all.sql"
    with open(sql_file, "w", encoding="utf-8") as f:
        f.write("-- ========================================================\n")
        f.write(f"-- Procure-to-Pay Complete Seed Script\n")
        f.write(f"-- Generated: {datetime.utcnow().isoformat()}Z\n")
        f.write(f"-- Seed: {seed} | Scale: {scale}\n")
        f.write("-- ========================================================\n\n")
        f.write("BEGIN;\n")
        f.write("SET session_replication_role = replica;\n\n")

        # Dependency-ordered insertion
        table_order = [
            "departments", "requesters", "budgets", "suppliers", "supplier_categories",
            "purchase_requests", "request_lines", "rfqs", "rfq_request_lines", "rfq_suppliers",
            "supplier_quotes", "quote_lines", "quote_evaluations", "rfq_awards",
            "approvals", "purchase_orders", "purchase_order_lines", "deliveries",
            "delivery_lines", "budget_ledger", "status_events", "exceptions"
        ]

        # Generated/Identity columns that PostgreSQL calculates automatically
        EXCLUDED_SQL_COLUMNS = {
            "request_lines": {"estimated_line_cost"},
            "supplier_quotes": {"total_landed_cost", "total_landed_cost_base"},
            "quote_lines": {"line_total"},
            "purchase_orders": {"total_amount"},
            "purchase_order_lines": {"line_total"},
            "quote_evaluations": {"evaluation_id"},
            "delivery_lines": {"delivery_line_id"},
            "status_events": {"event_id"},
            "budget_ledger": {"ledger_id"},
            "ground_truth": {"label_id"}
        }

        for tbl in table_order:
            rows = dataset.get(tbl, [])
            if not rows:
                continue
            excluded = EXCLUDED_SQL_COLUMNS.get(tbl, set())
            cols = [k for k in rows[0].keys() if k not in excluded]
            cols_str = ", ".join(cols)

            f.write(f"-- Table: {tbl} ({len(rows)} rows)\n")
            # Batch rows in chunks of 50 for clean SQL
            for i in range(0, len(rows), 50):
                batch = rows[i:i+50]
                values_clauses = []
                for r in batch:
                    val_parts = []
                    for c in cols:
                        v = r.get(c)
                        if v is None:
                            val_parts.append("NULL")
                        elif isinstance(v, bool):
                            val_parts.append("TRUE" if v else "FALSE")
                        elif isinstance(v, (int, float)):
                            val_parts.append(str(v))
                        else:
                            # Escape single quotes
                            escaped = str(v).replace("'", "''")
                            val_parts.append(f"'{escaped}'")
                    values_clauses.append(f"({', '.join(val_parts)})")
                f.write(f"INSERT INTO {tbl} ({cols_str}) VALUES\n  " + ",\n  ".join(values_clauses) + ";\n")
            f.write("\n")

        # Ground truth table
        if ground_truth:
            gt_cols = [k for k in ground_truth[0].keys() if k != "label_id"]
            gt_cols_str = ", ".join(gt_cols)
            f.write(f"-- Table: ground_truth.anomaly_labels ({len(ground_truth)} rows)\n")
            gt_vals = []
            for r in ground_truth:
                val_parts = []
                for c in gt_cols:
                    v = r.get(c)
                    if v is None:
                        val_parts.append("NULL")
                    elif isinstance(v, bool):
                        val_parts.append("TRUE" if v else "FALSE")
                    elif isinstance(v, (int, float)):
                        val_parts.append(str(v))
                    else:
                        escaped = str(v).replace("'", "''")
                        val_parts.append(f"'{escaped}'")
                gt_vals.append(f"({', '.join(val_parts)})")
            f.write(f"INSERT INTO ground_truth.anomaly_labels ({gt_cols_str}) VALUES\n  " + ",\n  ".join(gt_vals) + ";\n\n")

        f.write("SET session_replication_role = DEFAULT;\n")
        f.write("COMMIT;\n")

    sql_hash = compute_sha256(sql_file)

    # Manifest
    manifest = {
        "generator": "procure-to-pay-generator",
        "seed": seed,
        "scale": scale,
        "generated_at": datetime.utcnow().isoformat() + "Z",
        "sql_seed_sha256": sql_hash,
        "sql_seed_size_bytes": sql_file.stat().st_size,
        "tables": manifest_tables
    }

    manifest_file = out_dir / "manifest.json"
    with open(manifest_file, "w", encoding="utf-8") as f:
        json.dump(manifest, f, indent=2)

    return manifest

def main():
    args = parse_args()
    out_dir = Path(args.out).resolve()
    seed = args.seed
    scale = args.scale

    print("=" * 65)
    print("      Procure-to-Pay Synthetic Data Generation Suite")
    print("=" * 65)
    print(f"Random Seed      : {seed}")
    print(f"Scale Factor     : {scale}")
    print(f"Output Directory : {out_dir}")
    print("-" * 65)

    # 1. Generate primary dataset
    dataset, ground_truth = generate_full_dataset(seed, scale)
    
    # 2. Run Step 8 validation
    print("\nRunning comprehensive integrity validation...")
    val_results = validate_dataset(dataset, ground_truth)
    print(f"Total Tests Run   : {val_results['tests_run']}")
    print(f"Tests Passed     : {val_results['tests_passed']}")
    print(f"Tests Failed     : {val_results['tests_failed']}")
    if val_results["passed"]:
        print("Status           : ALL INTEGRITY CONSTRAINTS PASSED (100% VALID)")
    else:
        print("Status           : VALIDATION FAILURES DETECTED")
        for err in val_results["errors"]:
            print(f"  - {err}")

    # 3. Export datasets
    print("\nExporting datasets (CSV, JSON, SQL, Ground Truth, Manifest)...")
    manifest = export_dataset(dataset, ground_truth, out_dir, seed, scale)
    
    print("-" * 65)
    print("Dataset Summary:")
    for tbl, meta in manifest["tables"].items():
        print(f"  - {tbl.ljust(24)}: {str(meta['row_count']).rjust(5)} rows | CSV SHA256: {meta['csv_sha256'][:10]}...")

    # Step 10: Reproducibility verification
    if args.verify_reproducibility:
        print("\n" + "=" * 65)
        print("Step 10: Demonstrating Reproducibility Across 2 Independent Runs")
        print("=" * 65)
        ds2, gt2 = generate_full_dataset(seed, scale)
        out_dir_2 = out_dir / "reproducibility_test"
        manifest2 = export_dataset(ds2, gt2, out_dir_2, seed, scale)

        all_matched = True
        for tbl in manifest["tables"]:
            h1 = manifest["tables"][tbl]["csv_sha256"]
            h2 = manifest2["tables"][tbl]["csv_sha256"]
            c1 = manifest["tables"][tbl]["row_count"]
            c2 = manifest2["tables"][tbl]["row_count"]
            match = (h1 == h2 and c1 == c2)
            if not match:
                all_matched = False
            status = "MATCH" if match else "MISMATCH"
            print(f"  {tbl.ljust(24)}: {c1} vs {c2} rows | Hash Match: {status}")

        if all_matched:
            print("\nRESULT: 100% DETERMINISTIC & REPRODUCIBLE (Identical SHA256 checksums)")
        else:
            print("\nRESULT: REPRODUCIBILITY CHECK FAILED")
            sys.exit(1)

    print("\nGeneration and export completed successfully.")
    sys.exit(0)

if __name__ == "__main__":
    main()
