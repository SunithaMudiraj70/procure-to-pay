import pool from '../config/pg.js';
import supabaseAdmin from '../config/supabase.js';

export const getHealth = (req, res) => {
  res.status(200).json({
    status: 'ok',
    timestamp: new Date().toISOString()
  });
};

export const getDbHealth = async (req, res) => {
  let pgOk = false;
  let pgError = null;
  let supabaseOk = false;
  let supabaseError = null;

  // 1. Test pg pool with "select now()"
  try {
    const pgRes = await pool.query('SELECT NOW() as now');
    if (pgRes && pgRes.rows && pgRes.rows.length > 0) {
      pgOk = true;
    }
  } catch (err) {
    pgError = err.message || 'Failed to query Postgres via pg pool';
  }

  // 2. Test Supabase client with lightweight call using service role
  try {
    const { data, error } = await supabaseAdmin.auth.admin.listUsers({ page: 1, perPage: 1 });
    if (error) {
      supabaseError = error.message;
    } else {
      supabaseOk = true;
    }
  } catch (err) {
    supabaseError = err.message || 'Failed to connect to Supabase';
  }

  const isHealthy = pgOk && supabaseOk;
  const statusCode = isHealthy ? 200 : 503;

  const response = {
    status: isHealthy ? 'ok' : 'error',
    pg: pgOk,
    supabase: supabaseOk,
    timestamp: new Date().toISOString()
  };

  if (!isHealthy) {
    response.errors = {
      pg: pgError,
      supabase: supabaseError
    };
  }

  res.status(statusCode).json(response);
};
