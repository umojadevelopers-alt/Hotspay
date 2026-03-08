const mysql = require('mysql2');

const pool = mysql.createPool({
  host: process.env.DB_HOST || 'localhost',
  port: parseInt(process.env.DB_PORT) || 3306,
  database: process.env.DB_NAME || 'hotspay',
  user: process.env.DB_USER || 'root',
  password: process.env.DB_PASSWORD || '',
  connectionLimit: parseInt(process.env.DB_CONNECTION_LIMIT) || 10,
  queueLimit: parseInt(process.env.DB_QUEUE_LIMIT) || 0,
  waitForConnections: true,
  enableKeepAlive: true,
  keepAliveInitialDelay: 0,
  timezone: '+00:00',
  charset: 'utf8mb4',
  decimalNumbers: true
});

// Wrap with promise interface
const promisePool = pool.promise();

/**
 * Execute a query with optional parameters.
 * @param {string} sql
 * @param {Array} [params]
 * @returns {Promise<[Array, Array]>} [rows, fields]
 */
async function query(sql, params = []) {
  const [rows, fields] = await promisePool.execute(sql, params);
  return [rows, fields];
}

/**
 * Begin a transaction and return a connection from the pool.
 * Remember to call connection.release() when done.
 * @returns {Promise<mysql2.PoolConnection>}
 */
async function getConnection() {
  return promisePool.getConnection();
}

/**
 * Test the database connection on startup.
 */
async function testConnection() {
  try {
    const [rows] = await query('SELECT 1 AS connected');
    if (rows[0].connected === 1) {
      console.log('Database connection established successfully.');
    }
  } catch (err) {
    console.error('Database connection failed:', err.message);
    process.exit(1);
  }
}

testConnection();

module.exports = { pool: promisePool, query, getConnection };
