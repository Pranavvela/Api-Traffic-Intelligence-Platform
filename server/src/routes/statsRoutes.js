'use strict';

const { Router } = require('express');
const { getSummary, getTopIpsHandler, getEndpointStatsHandler, getTrafficGraphHandler, getAttackersHandler } = require('../controllers/statsController');

const router = Router();

// GET /api/stats/summary
router.get('/summary', getSummary);

// GET /api/stats/top-ips
router.get('/top-ips', getTopIpsHandler);

// GET /api/stats/endpoints
router.get('/endpoints', getEndpointStatsHandler);

// GET /api/stats/traffic  — requests per minute for the last 5 minutes
router.get('/traffic', getTrafficGraphHandler);

// GET /api/stats/attackers  — top attacker scores
router.get('/attackers', getAttackersHandler);

module.exports = router;
