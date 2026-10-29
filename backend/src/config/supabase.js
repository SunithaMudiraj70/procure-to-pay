import { createClient } from '@supabase/supabase-js';
import { env } from './env.js';

// Supabase client initialized with SERVICE ROLE key for secure server-side administrative access
export const supabaseAdmin = createClient(env.SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, {
  auth: {
    autoRefreshToken: false,
    persistSession: false
  }
});

export default supabaseAdmin;
