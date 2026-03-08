/**
 * IP Whitelist Middleware
 *
 * Reads the ALLOWED_IPS environment variable (comma-separated list of IPs)
 * and blocks any request whose source IP is not in the list.
 *
 * This middleware is only mounted when ALLOWED_IPS is set (see server.js).
 *
 * Example:
 *   ALLOWED_IPS=127.0.0.1,192.168.1.10,10.0.0.5
 */

/**
 * Parse and normalise the allowed IPs list from the environment.
 * Strips whitespace and filters out empty entries.
 * @returns {string[]}
 */
function getAllowedIps() {
  const raw = process.env.ALLOWED_IPS || '';
  return raw
    .split(',')
    .map((ip) => ip.trim())
    .filter(Boolean);
}

/**
 * Extract the real client IP, respecting common proxy headers.
 *
 * IMPORTANT: This assumes a single trusted reverse proxy sits in front of the
 * application. The leftmost entry of X-Forwarded-For is used as the client IP.
 * If you have multiple proxies or an untrusted proxy tier, configure Express's
 * built-in "trust proxy" setting and use req.ip instead, or pass
 * TRUST_PROXY=true in your environment so this middleware defers to Express.
 *
 * @param {import('express').Request} req
 * @returns {string}
 */
function getClientIp(req) {
  // Defer to Express trust-proxy resolution when enabled
  if (process.env.TRUST_PROXY === 'true') {
    return req.ip || req.socket.remoteAddress || '';
  }
  const forwarded = req.headers['x-forwarded-for'];
  if (forwarded) {
    // X-Forwarded-For can be a comma-separated list; take the first (leftmost) IP
    return forwarded.split(',')[0].trim();
  }
  return req.headers['x-real-ip'] || req.socket.remoteAddress || '';
}

// Warn at module load time if ALLOWED_IPS is set but parses to nothing
if (process.env.ALLOWED_IPS) {
  const _parsedAtStartup = getAllowedIps();
  if (!_parsedAtStartup.length) {
    console.warn(
      '[ipWhitelist] WARNING: ALLOWED_IPS is set but contains no valid IP addresses. ' +
      'All API requests will be blocked until this is corrected.'
    );
  }
}

/**
 * Middleware function.
 */
function ipWhitelist(req, res, next) {
  const allowedIps = getAllowedIps();

  // If the list is empty after parsing, fail closed for safety
  if (!allowedIps.length) {
    return res.status(403).json({
      success: false,
      message: 'IP access control is enabled but no IPs are configured.'
    });
  }

  const clientIp = getClientIp(req);

  if (allowedIps.includes(clientIp)) {
    return next();
  }

  return res.status(403).json({
    success: false,
    message: 'Access denied: your IP address is not authorised.'
  });
}

module.exports = ipWhitelist;
