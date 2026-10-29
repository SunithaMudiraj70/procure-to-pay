import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import pg from 'pg';
import dotenv from 'dotenv';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Check and load backend/.env, root .env, or use existing process.env
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
  console.error('❌ [MIGRATION ERROR] DATABASE_URL is not set.');
  console.error('Please configure DATABASE_URL in backend/.env before running migrations.');
  process.exit(1);
}

const isLocal = databaseUrl.includes('localhost') || databaseUrl.includes('127.0.0.1');

const client = new pg.Client({
  connectionString: databaseUrl,
  ssl: isLocal ? false : { rejectUnauthorized: false }
});

async function runMigrations() {
  try {
    await client.connect();
    console.log(' Connected to Postgres database.');

    // Ensure schema_migrations table exists
    await client.query(`
      CREATE TABLE IF NOT EXISTS schema_migrations (
        filename TEXT PRIMARY KEY,
        applied_at TIMESTAMPTZ DEFAULT NOW()
      );
    `);

    // Fetch already applied migrations
    const res = await client.query('SELECT filename FROM schema_migrations ORDER BY filename ASC;');
    const appliedFiles = new Set(res.rows.map(row => row.filename));

    // Read migrations directory
    const migrationsDir = path.resolve(__dirname, '../migrations');
    if (!fs.existsSync(migrationsDir)) {
      console.log('No migrations directory found at ' + migrationsDir);
      return;
    }

    const migrationFiles = fs.readdirSync(migrationsDir)
      .filter(file => file.endsWith('.sql'))
      .sort();

    if (migrationFiles.length === 0) {
      console.log('ℹ️ No migration SQL files found.');
      return;
    }

    let appliedCount = 0;

    for (const file of migrationFiles) {
      if (appliedFiles.has(file)) {
        console.log(`⏩ Skipping already applied migration: ${file}`);
        continue;
      }

      const filePath = path.join(migrationsDir, file);
      const sqlContent = fs.readFileSync(filePath, 'utf8');

      console.log(`Applying migration: ${file}...`);
      await client.query('BEGIN');
      try {
        await client.query(sqlContent);
        await client.query(
          'INSERT INTO schema_migrations (filename, applied_at) VALUES ($1, NOW());',
          [file]
        );
        await client.query('COMMIT');
        console.log(` Successfully applied: ${file}`);
        appliedCount++;
      } catch (err) {
        await client.query('ROLLBACK');
        console.error(`❌ Migration failed in file "${file}":`, err.message);
        throw err;
      }
    }

    if (appliedCount === 0) {
      console.log(' No new migrations to apply. Database schema is up to date.');
    } else {
      console.log(` All pending migrations applied successfully (${appliedCount} file(s)).`);
    }
  } catch (err) {
    console.error('❌ Migration process aborted:', err.message);
    process.exit(1);
  } finally {
    await client.end();
  }
}

runMigrations();
