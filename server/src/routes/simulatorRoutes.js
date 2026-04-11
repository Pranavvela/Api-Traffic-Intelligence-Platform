'use strict';

const { Router } = require('express');
const { runSimulator } = require('../controllers/simulatorController');

const router = Router();

// POST /api/simulator/run
router.post('/simulator/run', runSimulator);

module.exports = router;
