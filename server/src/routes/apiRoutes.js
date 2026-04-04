'use strict';

const { Router } = require('express');
const { getLogs } = require('../controllers/apiController');

const router = Router();

// GET /api/logs
router.get('/', getLogs);

module.exports = router;
