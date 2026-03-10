require('dotenv').config();
const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const passport = require('passport');
const path = require('path');
const i18next = require('i18next');
const i18nextMiddleware = require('i18next-http-middleware');

// Initialize i18next
i18next.init({
  lng: process.env.DEFAULT_LANGUAGE || 'en',
  fallbackLng: 'en',
  resources: {
    en: {
      translation: {
        welcome: 'Welcome to Hotspay',
        login_success: 'Login successful',
        login_failed: 'Invalid credentials',
        unauthorized: 'Unauthorized access',
        not_found: 'Resource not found',
        server_error: 'Internal server error'
      }
    },
    sw: {
      translation: {
        welcome: 'Karibu Hotspay',
        login_success: 'Umefanikiwa kuingia',
        login_failed: 'Kitambulisho batili',
        unauthorized: 'Huna ruhusa',
        not_found: 'Rasilimali haipatikani',
        server_error: 'Hitilafu ya seva'
      }
    },
    fr: {
      translation: {
        welcome: 'Bienvenue sur Hotspay',
        login_success: 'Connexion réussie',
        login_failed: 'Identifiants invalides',
        unauthorized: 'Accès non autorisé',
        not_found: 'Ressource introuvable',
        server_error: 'Erreur interne du serveur'
      }
    }
  }
});

require('./config/passport')(passport);

const app = express();

// Security middleware
app.use(helmet({
  hsts: false, // Disable HSTS during development (no HTTPS yet)
  crossOriginOpenerPolicy: false, // Allow non-HTTPS origins
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      scriptSrc: ["'self'", "'unsafe-inline'", 'https://cdn.jsdelivr.net'],
      styleSrc: ["'self'", "'unsafe-inline'", 'https://cdn.jsdelivr.net'],
      imgSrc: ["'self'", 'data:', 'blob:', 'https:'],
      connectSrc: ["'self'", 'http:', 'https:'],
      fontSrc: ["'self'", 'https://cdn.jsdelivr.net'],
      objectSrc: ["'none'"],
      upgradeInsecureRequests: [], // Explicitly disable to allow HTTP
    }
  }
}));
app.use(cors({
  origin: process.env.CORS_ORIGIN || '*',
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH'],
  allowedHeaders: ['Content-Type', 'Authorization']
}));

// Rate limiting
const limiter = rateLimit({
  windowMs: parseInt(process.env.RATE_LIMIT_WINDOW_MS) || 15 * 60 * 1000,
  max: parseInt(process.env.RATE_LIMIT_MAX) || 100,
  message: { success: false, message: 'Too many requests, please try again later.' }
});
app.use('/api/', limiter);

// Page rate limiter (generous limit; prevents scraping/DoS on static pages)
const pageLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 300,
  message: { success: false, message: 'Too many requests, please try again later.' }
});

// Body parsing
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// i18next middleware
app.use(i18nextMiddleware.handle(i18next));

// Passport middleware
app.use(passport.initialize());

// Static files
app.use(express.static(path.join(__dirname, 'public')));

// IP Whitelist (optional, only if ALLOWED_IPS is set)
if (process.env.ALLOWED_IPS) {
  const ipWhitelist = require('./middleware/ipWhitelist');
  app.use('/api/', ipWhitelist);
}

// Routes
app.use('/api/auth', require('./routes/auth'));
app.use('/api/customers', require('./routes/customers'));
app.use('/api/vouchers', require('./routes/vouchers'));
app.use('/api/payments', require('./routes/payments'));
app.use('/api/hotspot', require('./routes/hotspot'));
app.use('/api/routers', require('./routes/routers'));
app.use('/api/reports', require('./routes/reports'));
app.use('/api/sms', require('./routes/sms'));
app.use('/api/profiles', require('./routes/profiles'));
app.use('/api/wireguard', require('./routes/wireguard'));

// Serve frontend pages
app.get('/', pageLimiter, (req, res) => res.sendFile(path.join(__dirname, 'public', 'index.html')));
app.get('/login', pageLimiter, (req, res) => res.sendFile(path.join(__dirname, 'public', 'login.html')));
app.get('/hotspot-login', pageLimiter, (req, res) => res.sendFile(path.join(__dirname, 'public', 'hotspot-login.html')));
app.get('/self-service', pageLimiter, (req, res) => res.sendFile(path.join(__dirname, 'public', 'self-service.html')));

// 404 handler
app.use((req, res) => {
  res.status(404).json({ success: false, message: 'Route not found' });
});

// Error handler
app.use((err, req, res, next) => {
  if (process.env.NODE_ENV !== 'production') {
    console.error(err.stack);
  } else {
    console.error(`[${new Date().toISOString()}] ${err.status || 500} - ${err.message}`);
  }
  res.status(err.status || 500).json({
    success: false,
    message: err.message || 'Internal server error'
  });
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Hotspay server running on port ${PORT}`);
  console.log(`Environment: ${process.env.NODE_ENV || 'development'}`);
});

module.exports = app;
