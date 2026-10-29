import pg from 'pg';
import { env } from './env.js';

const { Pool } = pg;

const isLocal = env.DATABASE_URL.includes('localhost') || env.DATABASE_URL.includes('127.0.0.1');

export const pool = new Pool({
  connectionString: env.DATABASE_URL,
  ssl: isLocal ? false : { rejectUnauthorized: false }
});

pool.on('error', (err) => {
  console.error('❌ Unexpected error on idle Postgres client', err);
});

let testClient = null;
let testQueryChain = Promise.resolve();

export const setTestClient = (client) => {
  testClient = client;
  testQueryChain = Promise.resolve();
};

export const getTestClient = () => testClient;

export const clearTestClient = () => {
  testClient = null;
  testQueryChain = Promise.resolve();
};

// Route pool.query to testClient when in test mode, queuing to avoid socket collision
const originalQuery = pool.query.bind(pool);
pool.query = (text, params) => {
  if (testClient) {
    testQueryChain = testQueryChain.then(
      () => testClient.query(text, params),
      () => testClient.query(text, params)
    );
    return testQueryChain;
  }
  return originalQuery(text, params);
};

export default pool;
