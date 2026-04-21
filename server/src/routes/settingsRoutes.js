'use strict';

const { Router } = require('express');
const { getSettings, updateSettings } = require('../controllers/settingsController');

const router = Router();

// GET /api/settings
router.get('/settings', getSettings);

// PUT /api/settings
router.put('/settings', updateSettings);

// PATCH /api/settings
router.patch('/settings', updateSettings);

module.exports = router;
