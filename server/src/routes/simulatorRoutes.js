'use strict';

const { Router } = require('express');
const { runSimulator, testEvasion, getEvasionGuide } = require('../controllers/simulatorController');

const router = Router();

// POST /api/simulator/run
router.post('/simulator/run', runSimulator);

// POST /api/simulator/test-evasion - Test adversarial evasion attacks
router.post('/simulator/test-evasion', testEvasion);

// GET /api/simulator/evasion-guide - Documentation on evasion attacks
router.get('/simulator/evasion-guide', getEvasionGuide);

module.exports = router;
