import mysql from 'mysql2/promise';
import { env } from './env.js';

export const pool = mysql.createPool({
  host: env.MYSQL_HOST,
  port: parseInt(env.MYSQL_PORT, 10),
  user: env.MYSQL_USER,
  password: env.MYSQL_PASSWORD,
  database: env.MYSQL_DATABASE,
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0,
  enableKeepAlive: true,
  keepAliveInitialDelay: 10000,
  dateStrings: true
});

/**
 * Checks connectivity to the database pool.
 * @returns {Promise<{ ok: boolean, error?: string }>}
 */
export async function checkDatabaseConnection() {
  try {
    const connection = await pool.getConnection();
    await connection.ping();
    connection.release();
    return { ok: true };
  } catch (err) {
    return { ok: false, error: err.message };
  }
}
