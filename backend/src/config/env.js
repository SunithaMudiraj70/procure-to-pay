import { z } from 'zod';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Load environment variables from backend/.env or root .env
dotenv.config({ path: path.resolve(__dirname, '../../.env') });
dotenv.config();

const envSchema = z.object({
  PORT: z.coerce.number().default(5000),
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
  SUPABASE_URL: z.string({
    required_error: 'SUPABASE_URL is required'
  }).url('SUPABASE_URL must be a valid URL'),
  SUPABASE_SERVICE_ROLE_KEY: z.string({
    required_error: 'SUPABASE_SERVICE_ROLE_KEY is required'
  }).min(1, 'SUPABASE_SERVICE_ROLE_KEY cannot be empty'),
  DATABASE_URL: z.string({
    required_error: 'DATABASE_URL is required'
  }).min(1, 'DATABASE_URL cannot be empty'),
  CORS_ORIGIN: z.string().default('http://localhost:5173')
});

const parsed = envSchema.safeParse(process.env);

if (!parsed.success) {
  console.error('\n❌ [CONFIG ERROR] Missing or invalid environment variables:');
  parsed.error.issues.forEach(issue => {
    const field = issue.path.join('.');
    console.error(`   ▶ ${field}: ${issue.message}`);
  });
  console.error('\nPlease copy backend/.env.example to backend/.env and provide valid credentials.\n');
  process.exit(1);
}

export const env = parsed.data;
export default env;
