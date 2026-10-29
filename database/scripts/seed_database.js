import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import pg from 'pg';
import dotenv from 'dotenv';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const backendEnvPath = path.resolve(__dirname, '../../backend/.env');
const rootEnvPath = path.resolve(__dirname, '../../.env');

if (fs.existsSync(backendEnvPath)) {
  dotenv.config({ path: backendEnvPath });
}
if (fs.existsSync(rootEnvPath)) {
  dotenv.config({ path: rootEnvPath });
}
dotenv.config();

const databaseUrl = process.env.DATABASE_URL;

if (!databaseUrl) {
  console.error('❌ [SEED ERROR] DATABASE_URL is not set.');
  process.exit(1);
}

const isLocal = databaseUrl.includes('localhost') || databaseUrl.includes('127.0.0.1');

const client = new pg.Client({
  connectionString: databaseUrl,
  ssl: isLocal ? false : { rejectUnauthorized: false }
});

async function runSeed() {
  const seedSqlPath = path.resolve(__dirname, '../../data_generator/output/sql/seed_all.sql');
  if (!fs.existsSync(seedSqlPath)) {
    console.error('❌ [SEED ERROR] Seed SQL file not found at:', seedSqlPath);
    console.error('Please run "python data_generator/generate.py" first.');
    process.exit(1);
  }

  try {
    console.log(' Connecting to PostgreSQL...');
    await client.connect();
    console.log(' Connected successfully.');

    console.log(' Reading seed SQL script (~4.4 MB)...');
    const sqlContent = fs.readFileSync(seedSqlPath, 'utf-8');

    console.log(' Cleaning existing seed data (TRUNCATE CASCADE)...');
    await client.query(`
      TRUNCATE TABLE
        departments, requesters, budgets, suppliers, supplier_categories,
        purchase_requests, request_lines, rfqs, rfq_request_lines, rfq_suppliers,
        supplier_quotes, quote_lines, quote_evaluations, rfq_awards,
        approvals,
        purchase_orders, purchase_order_lines, deliveries, delivery_lines,
        status_events, budget_ledger, exceptions, id_counters,
        ground_truth.anomaly_labels
      CASCADE;
    `);

    console.log(' Executing seed script against database...');
    const startTime = Date.now();
    await client.query(sqlContent);
    const duration = ((Date.now() - startTime) / 1000).toFixed(2);

    console.log(` Database seeded successfully in ${duration}s!`);

    // Synchronize id_counters so next_year_id doesn't collide with existing records
    await client.query(`
      INSERT INTO id_counters (counter_key, last_value)
      VALUES
        ('PR-2026', COALESCE((SELECT MAX(SUBSTRING(pr_id FROM 9)::bigint) FROM purchase_requests WHERE pr_id LIKE 'PR-2026-%'), 0)),
        ('RFQ-2026', COALESCE((SELECT MAX(SUBSTRING(rfq_id FROM 10)::bigint) FROM rfqs WHERE rfq_id LIKE 'RFQ-2026-%'), 0)),
        ('PO-2026', COALESCE((SELECT MAX(SUBSTRING(po_id FROM 9)::bigint) FROM purchase_orders WHERE po_id LIKE 'PO-2026-%'), 0)),
        ('QUO-2026', COALESCE((SELECT MAX(SUBSTRING(quote_id FROM 'QUO-[A-Z0-9]+-2026-([0-9]+)')::bigint) FROM supplier_quotes WHERE quote_id LIKE 'QUO-%-2026-%'), 0)),
        ('APR-2026', COALESCE((SELECT MAX(SUBSTRING(approval_id FROM 10)::bigint) FROM approvals WHERE approval_id LIKE 'APR-2026-%'), 0)),
        ('AWD-2026', COALESCE((SELECT MAX(SUBSTRING(award_id FROM 10)::bigint) FROM rfq_awards WHERE award_id LIKE 'AWD-2026-%'), 0)),
        ('EXC-2026', COALESCE((SELECT MAX(SUBSTRING(exception_id FROM 10)::bigint) FROM exceptions WHERE exception_id LIKE 'EXC-2026-%'), 0)),
        ('RQT', COALESCE((SELECT MAX(SUBSTRING(requester_id FROM 5)::bigint) FROM requesters WHERE requester_id LIKE 'RQT-%'), 0)),
        ('SUP', COALESCE((SELECT MAX(SUBSTRING(supplier_id FROM 5)::bigint) FROM suppliers WHERE supplier_id LIKE 'SUP-%'), 0))
      ON CONFLICT (counter_key) DO UPDATE SET last_value = GREATEST(id_counters.last_value, EXCLUDED.last_value);
    `);
    console.log('✅ ID counters synchronized to highest generated IDs.');

    // Verify row counts
    const tables = [
      'departments', 'requesters', 'budgets', 'suppliers',
      'purchase_requests', 'rfqs', 'supplier_quotes', 'purchase_orders',
      'deliveries', 'exceptions'
    ];

    console.log('\nVerified Table Row Counts:');
    for (const t of tables) {
      const res = await client.query(`SELECT count(*) FROM ${t};`);
      console.log(`  - ${t.padEnd(20)}: ${res.rows[0].count} rows`);
    }

    process.exit(0);
  } catch (error) {
    console.error('❌ [SEED ERROR] Failed to seed database:', error);
    process.exit(1);
  } finally {
    await client.end().catch(() => {});
  }
}

runSeed();
