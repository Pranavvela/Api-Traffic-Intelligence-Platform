'use strict';

const express = require('express');
const cors = require('cors');
const morgan = require('morgan');
const config = require('./config/config');
const requestLogger = require('./middleware/logger');
const { attachAuth, requireAuth } = require('./middleware/authMiddleware');
const logger = require('./utils/logger');
const { pool } = require('./config/db');

// Route modules
const apiRoutes = require('./routes/apiRoutes');
const alertRoutes = require('./routes/alertRoutes');
const statsRoutes = require('./routes/statsRoutes');
const blocklistRoutes = require('./routes/blocklistRoutes');
const registeredApiRoutes = require('./routes/registeredApiRoutes');
const mlRoutes = require('./routes/mlRoutes');
const blockedIpsRoutes = require('./routes/blockedIpsRoutes');
const settingsRoutes = require('./routes/settingsRoutes');
const simulatorRoutes = require('./routes/simulatorRoutes');
const threatAnalysisRoutes = require('./routes/threatAnalysisRoutes');
const proxyRoutes = require('./routes/proxyRoutes');
const authRoutes = require('./routes/authRoutes');

const app = express();

// ─── CORS ─────────────────────────────────────────────
app.use(cors({
  origin: true,
  credentials: true,
}));

// ─── Disable Cache ────────────────────────────────────
app.use((req, res, next) => {
  res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
  res.setHeader('Pragma', 'no-cache');
  res.setHeader('Expires', '0');
  next();
});

// ─── Body Parsing ─────────────────────────────────────
app.use(express.json({ limit: config.server.requestBodyLimit }));
app.use(express.urlencoded({ extended: false }));

// ─── Dev Logger ───────────────────────────────────────
if (config.server.nodeEnv === 'development') {
  app.use(morgan('dev'));
}

// ─── Attach Auth Context (NON-BLOCKING) ───────────────
app.use(attachAuth);

// ─── HEALTH (no auth, no logger interference) ─────────
app.get('/health', async (_req, res) => {
  const response = {
    status: 'ok',
    timestamp: new Date().toISOString(),
  };

  if (config.health.includeDbStatus) {
    try {
      await pool.query('SELECT 1');
      response.db = 'ok';
    } catch (err) {
      logger.warn('Health check DB query failed', { error: err.message });
      response.db = 'error';
    }
  }

  res.json(response);
});

app.get('/', (_req, res) => {
  res.json({
    success: true,
    service: 'api-traffic-intelligence-server',
    status: 'running',
    health: '/health',
  });
});

// ─── 🔥 PUBLIC AUTH ROUTES (LOGIN / REGISTER) ─────────
app.use('/api', authRoutes);

// ─── 🔥 REQUEST LOGGER (after login allowed) ──────────
app.use(requestLogger);

// ─── 🔥 SIMULATOR TARGET APIS (SEPARATE PREFIX) ───────
app.post('/sim/login', (req, res) => {
  const { username, password } = req.body || {};
  if (username === 'admin' && password === 'secret') {
    return res.status(200).json({ message: 'Login successful.' });
  }
  res.status(401).json({ message: 'Invalid credentials.' });
});

app.get('/sim/search', (_req, res) => {
  res.json({ results: ['item1', 'item2', 'item3'] });
});

app.get('/sim/products', (_req, res) => {
  res.json({ products: [] });
});

app.get('/sim/users', (_req, res) => {
  res.json({ users: [] });
});

app.get('/sim/dashboard', (_req, res) => {
  res.json({ widgets: [] });
});

// ─── 🔒 PROTECTED ROUTES ──────────────────────────────────────────────────────
app.use('/api/logs', requireAuth, apiRoutes);
app.use('/api/alerts', requireAuth, alertRoutes);
app.use('/api/stats', requireAuth, statsRoutes);
app.use('/api/block-ip', requireAuth, blocklistRoutes);
app.use('/api', requireAuth, registeredApiRoutes);
app.use('/api', requireAuth, blockedIpsRoutes);
app.use('/api', requireAuth, settingsRoutes);
app.use('/api', requireAuth, simulatorRoutes);
app.use('/api', requireAuth, threatAnalysisRoutes);

app.use('/ml', requireAuth, mlRoutes);
app.use('/proxy', requireAuth, proxyRoutes);

// ─── 404 ──────────────────────────────────────────────
app.use((_req, res) => {
  res.status(404).json({
    success: false,
    message: 'Route not found.',
    code: 'NOT_FOUND',
  });
});

// ─── ERROR HANDLER ────────────────────────────────────
app.use((err, _req, res, _next) => {
  logger.error('Unhandled error', { error: err.message });

  const status = err.status || 500;

  res.status(status).json({
    success: false,
    message: err.message || 'Internal server error.',
    code: err.code || 'INTERNAL_ERROR',
  });
});

module.exports = app;