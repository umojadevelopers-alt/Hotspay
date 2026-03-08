'use strict';

const { RouterOSAPI } = require('node-routeros');
const Router = require('../models/Router');

/**
 * Establish a RouterOS API connection for the given router record.
 * The caller is responsible for calling conn.close().
 * @param {Object} router - Decrypted router DB record
 * @returns {Promise<RouterOSAPI>}
 */
async function connect(router) {
  const conn = new RouterOSAPI({
    host: router.host,
    user: router.api_user,
    password: router.api_password,
    port: router.port || 8728,
    timeout: parseInt(process.env.MIKROTIK_TIMEOUT) || 5000,
  });

  await conn.connect();
  return conn;
}

/**
 * Fetch router from DB and open a connection.
 * @param {number} routerId
 * @returns {Promise<{conn: RouterOSAPI, router: Object}>}
 */
async function getConnection(routerId) {
  const router = await Router.findById(routerId);
  if (!router) throw new Error(`Router with id ${routerId} not found`);

  const conn = await connect(router);
  return { conn, router };
}

/**
 * Strip the private-key field from a WireGuard interface record.
 * @param {Object} iface
 * @returns {Object}
 */
function sanitizeInterface(iface) {
  const { 'private-key': _pk, ...safe } = iface;
  return safe;
}

const wireguardService = {
  /**
   * List all WireGuard interfaces on a router.
   * @param {number} routerId
   * @returns {Promise<Array>}
   */
  async listInterfaces(routerId) {
    const { conn } = await getConnection(routerId);
    try {
      const result = await conn.write(['/interface/wireguard/print']);
      return result.map(sanitizeInterface);
    } finally {
      await conn.close();
    }
  },

  /**
   * Get a single WireGuard interface by name.
   * @param {number} routerId
   * @param {string} interfaceName
   * @returns {Promise<Object>}
   */
  async getInterface(routerId, interfaceName) {
    const { conn } = await getConnection(routerId);
    try {
      const result = await conn.write([
        '/interface/wireguard/print',
        '?name=' + interfaceName,
      ]);

      if (!result || result.length === 0) {
        throw new Error(`WireGuard interface "${interfaceName}" not found`);
      }

      return sanitizeInterface(result[0]);
    } finally {
      await conn.close();
    }
  },

  /**
   * Create a new WireGuard interface.
   * @param {number} routerId
   * @param {Object} opts - { name, listenPort, privateKey, mtu }
   * @returns {Promise<Array>}
   */
  async createInterface(routerId, { name, listenPort, privateKey, mtu }) {
    const { conn } = await getConnection(routerId);
    try {
      const params = ['/interface/wireguard/add', '=name=' + name];
      if (listenPort !== undefined) params.push('=listen-port=' + listenPort);
      if (privateKey) params.push('=private-key=' + privateKey);
      if (mtu !== undefined) params.push('=mtu=' + mtu);

      const result = await conn.write(params);
      return result;
    } finally {
      await conn.close();
    }
  },

  /**
   * Update a WireGuard interface.
   * @param {number} routerId
   * @param {string} interfaceName
   * @param {Object} opts - { listenPort, privateKey, mtu }
   * @returns {Promise<Array>}
   */
  async updateInterface(routerId, interfaceName, { listenPort, privateKey, mtu }) {
    const { conn } = await getConnection(routerId);
    try {
      const ifaces = await conn.write([
        '/interface/wireguard/print',
        '?name=' + interfaceName,
      ]);

      if (!ifaces || ifaces.length === 0) {
        throw new Error(`WireGuard interface "${interfaceName}" not found`);
      }

      const params = [
        '/interface/wireguard/set',
        '=.id=' + ifaces[0]['.id'],
      ];
      if (listenPort !== undefined) params.push('=listen-port=' + listenPort);
      if (privateKey) params.push('=private-key=' + privateKey);
      if (mtu !== undefined) params.push('=mtu=' + mtu);

      const result = await conn.write(params);
      return result;
    } finally {
      await conn.close();
    }
  },

  /**
   * Delete a WireGuard interface.
   * @param {number} routerId
   * @param {string} interfaceName
   * @returns {Promise<Array>}
   */
  async deleteInterface(routerId, interfaceName) {
    const { conn } = await getConnection(routerId);
    try {
      const ifaces = await conn.write([
        '/interface/wireguard/print',
        '?name=' + interfaceName,
      ]);

      if (!ifaces || ifaces.length === 0) {
        throw new Error(`WireGuard interface "${interfaceName}" not found`);
      }

      const result = await conn.write([
        '/interface/wireguard/remove',
        '=.id=' + ifaces[0]['.id'],
      ]);
      return result;
    } finally {
      await conn.close();
    }
  },

  /**
   * List all WireGuard peers on a router, optionally filtered by interface.
   * @param {number} routerId
   * @param {string} [interfaceName] - Optional interface filter
   * @returns {Promise<Array>}
   */
  async listPeers(routerId, interfaceName) {
    const { conn } = await getConnection(routerId);
    try {
      const cmd = ['/interface/wireguard/peers/print'];
      if (interfaceName) cmd.push('?interface=' + interfaceName);

      return await conn.write(cmd);
    } finally {
      await conn.close();
    }
  },

  /**
   * Get a single WireGuard peer by public key.
   * @param {number} routerId
   * @param {string} publicKey
   * @returns {Promise<Object>}
   */
  async getPeer(routerId, publicKey) {
    const { conn } = await getConnection(routerId);
    try {
      const result = await conn.write([
        '/interface/wireguard/peers/print',
        '?public-key=' + publicKey,
      ]);

      if (!result || result.length === 0) {
        throw new Error(`WireGuard peer with public key "${publicKey}" not found`);
      }

      return result[0];
    } finally {
      await conn.close();
    }
  },

  /**
   * Create a WireGuard peer.
   * @param {number} routerId
   * @param {Object} opts - { interfaceName, publicKey, allowedAddress, endpoint, presharedKey, comment, persistentKeepalive }
   * @returns {Promise<Array>}
   */
  async createPeer(routerId, { interfaceName, publicKey, allowedAddress, endpoint, presharedKey, comment, persistentKeepalive }) {
    const { conn } = await getConnection(routerId);
    try {
      const params = [
        '/interface/wireguard/peers/add',
        '=interface=' + interfaceName,
        '=public-key=' + publicKey,
      ];
      if (allowedAddress) params.push('=allowed-address=' + allowedAddress);
      if (endpoint) params.push('=endpoint-address=' + endpoint);
      if (presharedKey) params.push('=preshared-key=' + presharedKey);
      if (comment) params.push('=comment=' + comment);
      if (persistentKeepalive !== undefined) params.push('=persistent-keepalive=' + persistentKeepalive);

      const result = await conn.write(params);
      return result;
    } finally {
      await conn.close();
    }
  },

  /**
   * Update a WireGuard peer identified by public key.
   * @param {number} routerId
   * @param {string} publicKey
   * @param {Object} opts - { allowedAddress, endpoint, presharedKey, comment, persistentKeepalive }
   * @returns {Promise<Array>}
   */
  async updatePeer(routerId, publicKey, { allowedAddress, endpoint, presharedKey, comment, persistentKeepalive }) {
    const { conn } = await getConnection(routerId);
    try {
      const peers = await conn.write([
        '/interface/wireguard/peers/print',
        '?public-key=' + publicKey,
      ]);

      if (!peers || peers.length === 0) {
        throw new Error(`WireGuard peer with public key "${publicKey}" not found`);
      }

      const params = [
        '/interface/wireguard/peers/set',
        '=.id=' + peers[0]['.id'],
      ];
      if (allowedAddress !== undefined) params.push('=allowed-address=' + allowedAddress);
      if (endpoint !== undefined) params.push('=endpoint-address=' + endpoint);
      if (presharedKey !== undefined) params.push('=preshared-key=' + presharedKey);
      if (comment !== undefined) params.push('=comment=' + comment);
      if (persistentKeepalive !== undefined) params.push('=persistent-keepalive=' + persistentKeepalive);

      const result = await conn.write(params);
      return result;
    } finally {
      await conn.close();
    }
  },

  /**
   * Delete a WireGuard peer identified by public key.
   * @param {number} routerId
   * @param {string} publicKey
   * @returns {Promise<Array>}
   */
  async deletePeer(routerId, publicKey) {
    const { conn } = await getConnection(routerId);
    try {
      const peers = await conn.write([
        '/interface/wireguard/peers/print',
        '?public-key=' + publicKey,
      ]);

      if (!peers || peers.length === 0) {
        throw new Error(`WireGuard peer with public key "${publicKey}" not found`);
      }

      const result = await conn.write([
        '/interface/wireguard/peers/remove',
        '=.id=' + peers[0]['.id'],
      ]);
      return result;
    } finally {
      await conn.close();
    }
  },
};

module.exports = wireguardService;
