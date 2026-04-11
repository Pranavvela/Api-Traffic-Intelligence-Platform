'use strict';

const express = require('express');
const cors = require('cors');
const morgan = require('morgan');
const config = require('./config/config');
const requestLogger = require('./middleware/logger');

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

const app = express();

// ─── CORS ─────────────────────────────────────────────────────────────────────
app.use(
  cors({
    origin: config.cors.clientOrigin,
    methods: ['GET', 'POST', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization'],
  })
);

// ─── Body parsing ─────────────────────────────────────────────────────────────
app.use(express.json({ limit: '1mb' }));
app.use(express.urlencoded({ extended: false }));

// ─── HTTP dev logger (morgan — stdout only) ───────────────────────────────────
if (config.server.nodeEnv === 'development') {
  app.use(morgan('dev'));
}

// ─── Traffic logger middleware (persists to DB + triggers detection) ──────────
app.use(requestLogger);

// ─── Health check (excluded from persistent logging via early return) ─────────
app.get('/health', (_req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// ─── Simulated target endpoints (the API being "monitored") ──────────────────
// These exist so that the traffic simulator has real endpoints to hit.
app.post('/api/login', (req, res) => {
  const { username, password } = req.body || {};
  if (username === 'admin' && password === 'secret') {
    return res.status(200).json({ message: 'Login successful.' });
  }
  res.status(401).json({ message: 'Invalid credentials.' });
});

app.get('/api/search', (_req, res) => {
  res.json({ results: ['item1', 'item2', 'item3'] });
});

app.get('/api/products', (_req, res) => {
  res.json({ products: [] });
});

app.get('/api/users', (_req, res) => {
  res.json({ users: [] });
});

app.get('/api/dashboard', (_req, res) => {
  res.json({ widgets: [] });
});

// ─── Intelligence platform routes ─────────────────────────────────────────────
app.use('/api/logs',     apiRoutes);
app.use('/api/alerts',   alertRoutes);
app.use('/api/stats',    statsRoutes);
app.use('/api/block-ip', blocklistRoutes);
app.use('/api', registeredApiRoutes);
app.use('/api', blockedIpsRoutes);
app.use('/api', settingsRoutes);
app.use('/api', simulatorRoutes);
app.use('/api', threatAnalysisRoutes);
app.use('/ml', mlRoutes);

// ─── 404 handler ──────────────────────────────────────────────────────────────
app.use((_req, res) => {
  res.status(404).json({ success: false, message: 'Route not found.' });
});

// ─── Global error handler ─────────────────────────────────────────────────────
// eslint-disable-next-line no-unused-vars
app.use((err, _req, res, _next) => {
  console.error('[App] Unhandled error:', err.message);
  const status = err.status || 500;
  res.status(status).json({
    success: false,
    message: err.message || 'Internal server error.',
  });
});

module.exports = app;
