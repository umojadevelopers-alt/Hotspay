const { Strategy: JwtStrategy, ExtractJwt } = require('passport-jwt');
const { query } = require('./database');

if (!process.env.JWT_SECRET && process.env.NODE_ENV === 'production') {
  console.error('FATAL: JWT_SECRET environment variable is not set. Refusing to start in production.');
  process.exit(1);
}

const options = {
  jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
  secretOrKey: process.env.JWT_SECRET || 'fallback_secret_change_in_production_only',
  algorithms: ['HS256']
};

/**
 * Configure passport with the JWT strategy.
 * The JWT payload is expected to contain { id, role }.
 * The user record is loaded from the database on every request.
 *
 * @param {import('passport').PassportStatic} passport
 */
module.exports = function configurePassport(passport) {
  passport.use(
    new JwtStrategy(options, async (payload, done) => {
      try {
        const [rows] = await query(
          'SELECT id, name, email, role, is_active FROM admin_users WHERE id = ? LIMIT 1',
          [payload.id]
        );

        if (!rows.length) {
          return done(null, false, { message: 'User not found' });
        }

        const user = rows[0];

        if (!user.is_active) {
          return done(null, false, { message: 'Account is disabled' });
        }

        return done(null, user);
      } catch (err) {
        return done(err, false);
      }
    })
  );
};
