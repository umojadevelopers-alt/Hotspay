const { RouterOSAPI } = require('node-routeros');

/**
 * Create a RouterOS API connection for a given router configuration.
 * @param {Object} routerConfig
 * @param {string} routerConfig.host - Router IP address
 * @param {number} [routerConfig.port=8728] - API port (8728 plain, 8729 TLS)
 * @param {string} routerConfig.user - API username
 * @param {string} routerConfig.password - API password
 * @param {boolean} [routerConfig.tls=false] - Use TLS
 * @param {number} [routerConfig.timeout=5000] - Connection timeout ms
 * @returns {RouterOSAPI} Connected RouterOS API client
 */
function createConnection(routerConfig = {}) {
  const host = routerConfig.host || process.env.MIKROTIK_HOST || '192.168.88.1';
  const port = parseInt(routerConfig.port || process.env.MIKROTIK_PORT) || 8728;
  const user = routerConfig.user || process.env.MIKROTIK_USER || 'admin';
  const password = routerConfig.password || process.env.MIKROTIK_PASSWORD || '';
  const tls = routerConfig.tls !== undefined
    ? routerConfig.tls
    : process.env.MIKROTIK_TLS === 'true';
  const timeout = parseInt(routerConfig.timeout || process.env.MIKROTIK_TIMEOUT) || 5000;

  return new RouterOSAPI({
    host,
    port,
    user,
    password,
    tls,
    timeout
  });
}

/**
 * Connect to a RouterOS device, execute a callback, then disconnect.
 * Ensures the connection is always closed even if an error occurs.
 *
 * @param {Object} routerConfig - Router connection parameters
 * @param {Function} callback - async (client: RouterOSAPI) => any
 * @returns {Promise<any>} Result of the callback
 */
async function withConnection(routerConfig, callback) {
  const client = createConnection(routerConfig);
  try {
    await client.connect();
    const result = await callback(client);
    return result;
  } finally {
    try {
      await client.close();
    } catch (_) {
      // Ignore close errors
    }
  }
}

/**
 * Test connectivity to a RouterOS device.
 * @param {Object} routerConfig
 * @returns {Promise<boolean>}
 */
async function testConnection(routerConfig) {
  try {
    await withConnection(routerConfig, async (client) => {
      await client.write('/system/identity/print');
    });
    return true;
  } catch (err) {
    console.error(`MikroTik connection test failed for ${routerConfig.host}:`, err.message);
    return false;
  }
}

module.exports = { createConnection, withConnection, testConnection };
