'use strict';

const { Router } = require('express');
const { listAlerts, markResolved, alertsByRule, alertHistory, resetAlerts } = require('../controllers/alertController');

const router = Router();

// GET  /api/alerts
router.get('/', listAlerts);

// GET  /api/alerts/by-rule
router.get('/by-rule', alertsByRule);

// GET  /api/alerts/history
router.get('/history', alertHistory);

// POST /api/alerts/reset
router.post('/reset', resetAlerts);

// PATCH /api/alerts/:id/resolve
router.patch('/:id/resolve', markResolved);

module.exports = router;
