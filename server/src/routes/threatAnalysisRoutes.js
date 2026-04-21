'use strict';

const { Router } = require('express');
const { getSummary, getRules, getTimelineHandler } = require('../controllers/threatAnalysisController');

const router = Router();

// Short-path compatibility endpoints used by the frontend
router.get('/threat-summary', getSummary);
router.get('/threat-rules', getRules);
router.get('/threat-timeline', getTimelineHandler);

// GET /api/threat-analysis/summary
router.get('/threat-analysis/summary', getSummary);

// GET /api/threat-analysis/rules
router.get('/threat-analysis/rules', getRules);

// GET /api/threat-analysis/timeline
router.get('/threat-analysis/timeline', getTimelineHandler);

module.exports = router;
