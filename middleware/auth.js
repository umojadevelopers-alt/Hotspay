const passport = require('passport');

/**
 * Middleware that verifies the JWT Bearer token using passport-jwt.
 * Attaches the authenticated user to req.user on success.
 * Returns 401 if the token is missing, invalid, or the user is inactive.
 */
const authenticate = (req, res, next) => {
  passport.authenticate('jwt', { session: false }, (err, user, info) => {
    if (err) {
      return next(err);
    }

    if (!user) {
      const message =
        (info && info.message) ||
        (info instanceof Error ? info.message : 'Unauthorized');
      return res.status(401).json({ success: false, message });
    }

    req.user = user;
    return next();
  })(req, res, next);
};

module.exports = authenticate;
