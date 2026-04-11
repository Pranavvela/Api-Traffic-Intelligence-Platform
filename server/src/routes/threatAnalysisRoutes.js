'use strict';

const { Router } = require('express');
const { getSummary, getRules, getTimelineHandler } = require('../controllers/threatAnalysisController');

const router = Router();

// GET /api/threat-analysis/summary
router.get('/threat-analysis/summary', getSummary);

// GET /api/threat-analysis/rules
router.get('/threat-analysis/rules', getRules);

// GET /api/threat-analysis/timeline
router.get('/threat-analysis/timeline', getTimelineHandler);

module.exports = router;
