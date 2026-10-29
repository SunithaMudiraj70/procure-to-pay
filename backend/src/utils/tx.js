import pool, { getTestClient } from '../config/pg.js';

let savepointCounter = 0;

/**
 * Executes a callback within a managed database transaction.
 * Automatically handles BEGIN, COMMIT, ROLLBACK, and client release.
 * If a test client transaction is active, uses SAVEPOINT to allow rolling back the outer transaction at the end of the test.
 *
 * @param {Function} callback - Async function receiving the pg client: async (client) => { ... }
 * @returns {Promise<any>} Result of the callback
 */
export const withTx = async (callback) => {
  const testClient = getTestClient();
  if (testClient) {
    const spName = `sp_${++savepointCounter}`;
    await testClient.query(`SAVEPOINT ${spName}`);
    try {
      const result = await callback(testClient);
      await testClient.query(`RELEASE SAVEPOINT ${spName}`);
      return result;
    } catch (error) {
      try {
        await testClient.query(`ROLLBACK TO SAVEPOINT ${spName}`);
      } catch (rbErr) {
        console.error('Error during test savepoint rollback:', rbErr.message);
      }
      throw error;
    }
  }

  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const result = await callback(client);
    await client.query('COMMIT');
    return result;
  } catch (error) {
    try {
      await client.query('ROLLBACK');
    } catch (rbErr) {
      console.error('Error during transaction rollback:', rbErr.message);
    }
    throw error;
  } finally {
    client.release();
  }
};

export default withTx;
