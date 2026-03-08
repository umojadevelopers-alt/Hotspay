/**
 * Role hierarchy for Hotspay.
 * Higher index = higher privilege level.
 */
const ROLE_HIERARCHY = ['viewer', 'cashier', 'super_admin'];

/**
 * Returns the numeric privilege level for a role.
 * Unknown roles receive -1 (no access).
 * @param {string} role
 * @returns {number}
 */
function roleLevel(role) {
  const index = ROLE_HIERARCHY.indexOf(role);
  return index; // -1 if unknown
}

/**
 * Middleware factory: requires the authenticated user to have at least
 * the specified role (or a higher one in the hierarchy).
 *
 * Usage:
 *   router.get('/admin', authenticate, requireRole('super_admin'), handler);
 *   router.post('/sell', authenticate, requireRole('cashier'), handler);
 *
 * @param {string} minimumRole - Minimum role required ('viewer' | 'cashier' | 'super_admin')
 * @returns {Function} Express middleware
 */
function requireRole(minimumRole) {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({ success: false, message: 'Authentication required' });
    }

    const userLevel = roleLevel(req.user.role);
    const requiredLevel = roleLevel(minimumRole);

    if (userLevel === -1) {
      return res.status(403).json({ success: false, message: 'Unknown role assigned to account' });
    }

    if (requiredLevel === -1) {
      return res.status(500).json({ success: false, message: 'Invalid role configuration' });
    }

    if (userLevel < requiredLevel) {
      return res.status(403).json({
        success: false,
        message: `Access denied. Required role: ${minimumRole}`
      });
    }

    return next();
  };
}

/**
 * Convenience middleware: allow only super_admin.
 */
const superAdminOnly = requireRole('super_admin');

/**
 * Convenience middleware: allow cashier and above.
 */
const cashierAndAbove = requireRole('cashier');

/**
 * Convenience middleware: allow any authenticated user (viewer and above).
 */
const viewerAndAbove = requireRole('viewer');

module.exports = { requireRole, superAdminOnly, cashierAndAbove, viewerAndAbove, ROLE_HIERARCHY };
