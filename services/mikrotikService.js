'use strict';

const { RouterOSAPI } = require('node-routeros');
const Router = require('../models/Router');
const Voucher = require('../models/Voucher');

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
    port: router.api_port || 8728,
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

const mikrotikService = {
  /**
   * Create a hotspot user on the router.
   * @param {number} routerId
   * @param {Object} opts - { username, password, profile, comment, limitUptime }
   * @returns {Promise<Array>}
   */
  async createHotspotUser(routerId, { username, password, profile, comment = '', limitUptime = '' }) {
    const { conn } = await getConnection(routerId);
    try {
      const params = [
        '=name=' + username,
        '=password=' + password,
      ];
      if (profile) params.push('=profile=' + profile);
      if (comment) params.push('=comment=' + comment);
      if (limitUptime) params.push('=limit-uptime=' + limitUptime);

      const result = await conn.write(['/ip/hotspot/user/add', ...params]);
      return result;
    } finally {
      await conn.close();
    }
  },

  /**
   * Delete a hotspot user from the router.
   * @param {number} routerId
   * @param {string} username
   * @returns {Promise<Array>}
   */
  async deleteHotspotUser(routerId, username) {
    const { conn } = await getConnection(routerId);
    try {
      const users = await conn.write([
        '/ip/hotspot/user/print',
        '?name=' + username,
      ]);

      if (!users || users.length === 0) {
        throw new Error(`Hotspot user "${username}" not found on router`);
      }

      const result = await conn.write([
        '/ip/hotspot/user/remove',
        '=.id=' + users[0]['.id'],
      ]);
      return result;
    } finally {
      await conn.close();
    }
  },

  /**
   * Disable a hotspot user on the router.
   * @param {number} routerId
   * @param {string} username
   * @returns {Promise<Array>}
   */
  async disableHotspotUser(routerId, username) {
    const { conn } = await getConnection(routerId);
    try {
      const users = await conn.write([
        '/ip/hotspot/user/print',
        '?name=' + username,
      ]);

      if (!users || users.length === 0) {
        throw new Error(`Hotspot user "${username}" not found on router`);
      }

      const result = await conn.write([
        '/ip/hotspot/user/set',
        '=.id=' + users[0]['.id'],
        '=disabled=yes',
      ]);
      return result;
    } finally {
      await conn.close();
    }
  },

  /**
   * Enable a previously disabled hotspot user.
   * @param {number} routerId
   * @param {string} username
   * @returns {Promise<Array>}
   */
  async enableHotspotUser(routerId, username) {
    const { conn } = await getConnection(routerId);
    try {
      const users = await conn.write([
        '/ip/hotspot/user/print',
        '?name=' + username,
      ]);

      if (!users || users.length === 0) {
        throw new Error(`Hotspot user "${username}" not found on router`);
      }

      const result = await conn.write([
        '/ip/hotspot/user/set',
        '=.id=' + users[0]['.id'],
        '=disabled=no',
      ]);
      return result;
    } finally {
      await conn.close();
    }
  },

  /**
   * List all hotspot users on the router.
   * @param {number} routerId
   * @returns {Promise<Array>}
   */
  async listHotspotUsers(routerId) {
    const { conn } = await getConnection(routerId);
    try {
      return await conn.write(['/ip/hotspot/user/print']);
    } finally {
      await conn.close();
    }
  },

  /**
   * Get currently active hotspot sessions.
   * @param {number} routerId
   * @returns {Promise<Array>}
   */
  async getActiveSessions(routerId) {
    const { conn } = await getConnection(routerId);
    try {
      return await conn.write(['/ip/hotspot/active/print']);
    } finally {
      await conn.close();
    }
  },

  /**
   * Forcibly disconnect an active hotspot session.
   * @param {number} routerId
   * @param {string} sessionId - The .id of the active session
   * @returns {Promise<Array>}
   */
  async disconnectSession(routerId, sessionId) {
    const { conn } = await getConnection(routerId);
    try {
      const result = await conn.write([
        '/ip/hotspot/active/remove',
        '=.id=' + sessionId,
      ]);
      return result;
    } finally {
      await conn.close();
    }
  },

  /**
   * Create a hotspot user profile on the router.
   * @param {number} routerId
   * @param {Object} opts - { name, rateLimit, sessionTimeout }
   * @returns {Promise<Array>}
   */
  async createProfile(routerId, { name, rateLimit = '', sessionTimeout = '' }) {
    const { conn } = await getConnection(routerId);
    try {
      const params = ['/ip/hotspot/user/profile/add', '=name=' + name];
      if (rateLimit) params.push('=rate-limit=' + rateLimit);
      if (sessionTimeout) params.push('=session-timeout=' + sessionTimeout);

      const result = await conn.write(params);
      return result;
    } finally {
      await conn.close();
    }
  },

  /**
   * Delete a hotspot user profile from the router.
   * @param {number} routerId
   * @param {string} name
   * @returns {Promise<Array>}
   */
  async deleteProfile(routerId, name) {
    const { conn } = await getConnection(routerId);
    try {
      const profiles = await conn.write([
        '/ip/hotspot/user/profile/print',
        '?name=' + name,
      ]);

      if (!profiles || profiles.length === 0) {
        throw new Error(`Hotspot profile "${name}" not found on router`);
      }

      const result = await conn.write([
        '/ip/hotspot/user/profile/remove',
        '=.id=' + profiles[0]['.id'],
      ]);
      return result;
    } finally {
      await conn.close();
    }
  },

  /**
   * List all hotspot user profiles on the router.
   * @param {number} routerId
   * @returns {Promise<Array>}
   */
  async listProfiles(routerId) {
    const { conn } = await getConnection(routerId);
    try {
      return await conn.write(['/ip/hotspot/user/profile/print']);
    } finally {
      await conn.close();
    }
  },

  /**
   * Retrieve router health metrics (CPU, RAM, uptime).
   * @param {number} routerId
   * @returns {Promise<Object>}
   */
  async getRouterHealth(routerId) {
    const { conn } = await getConnection(routerId);
    try {
      const result = await conn.write(['/system/resource/print']);
      return result[0] || {};
    } finally {
      await conn.close();
    }
  },

  /**
   * Retrieve interface statistics from the router.
   * @param {number} routerId
   * @returns {Promise<Array>}
   */
  async getInterfaces(routerId) {
    const { conn } = await getConnection(routerId);
    try {
      return await conn.write(['/interface/print']);
    } finally {
      await conn.close();
    }
  },

  /**
   * Synchronise DB voucher users with the MikroTik router.
   * - Adds voucher users that exist in the DB but not on the router.
   * - Disables/removes users on the router that are expired in the DB.
   * @param {number} routerId
   * @returns {Promise<{added: number, removed: number, errors: Array}>}
   */
  async syncUsers(routerId) {
    const { conn } = await getConnection(routerId);
    const stats = { added: 0, removed: 0, errors: [] };

    try {
      // Fetch existing router users
      const routerUsers = await conn.write(['/ip/hotspot/user/print']);
      const routerUserMap = new Map(routerUsers.map((u) => [u.name, u]));

      // Fetch active (non-expired) DB vouchers for this router
      const activeVouchers = await Voucher.list({ router_id: routerId, is_expired: false });

      // Add missing users
      for (const voucher of activeVouchers) {
        if (!routerUserMap.has(voucher.username)) {
          try {
            const params = [
              '/ip/hotspot/user/add',
              '=name=' + voucher.username,
              '=password=' + voucher.password,
            ];
            if (voucher.profile_name) params.push('=profile=' + voucher.profile_name);

            await conn.write(params);
            stats.added++;
          } catch (err) {
            stats.errors.push({ action: 'add', username: voucher.username, error: err.message });
          }
        }
      }

      // Disable expired voucher users still present on the router
      const expiredVouchers = await Voucher.list({ router_id: routerId, is_expired: true });

      for (const voucher of expiredVouchers) {
        if (routerUserMap.has(voucher.username)) {
          try {
            const routerUser = routerUserMap.get(voucher.username);
            await conn.write([
              '/ip/hotspot/user/remove',
              '=.id=' + routerUser['.id'],
            ]);
            stats.removed++;
          } catch (err) {
            stats.errors.push({ action: 'remove', username: voucher.username, error: err.message });
          }
        }
      }
    } finally {
      await conn.close();
    }

    return stats;
  },

  /**
   * Test connectivity to a router by fetching system identity.
   * @param {number} routerId
   * @returns {Promise<{connected: boolean, identity: string|null}>}
   */
  async testConnection(routerId) {
    let conn;
    try {
      const result = await getConnection(routerId);
      conn = result.conn;
      const identity = await conn.write(['/system/identity/print']);
      return { connected: true, identity: identity[0] ? identity[0].name : null };
    } catch (err) {
      return { connected: false, identity: null, error: err.message };
    } finally {
      if (conn) {
        try { await conn.close(); } catch (closeErr) {
          console.debug(`[mikrotikService] Error closing connection for router ${routerId}: ${closeErr.message}`);
        }
      }
    }
  },
};

module.exports = mikrotikService;
