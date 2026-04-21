'use strict';

const { Router } = require('express');
const { registerApi, listApis, removeApi, validateApi, updateApi } = require('../controllers/registeredApiController');
const { getApiStatsSnapshot } = require('../services/proxyService');

const router = Router();

// REST-style compatibility endpoints used by the frontend
router.post('/registered-apis', registerApi);
router.get('/registered-apis', listApis);
router.post(String.raw`/registered-apis/:id(\d+)/validate`, validateApi);
router.patch(String.raw`/registered-apis/:id(\d+)`, updateApi);
router.delete(String.raw`/registered-apis/:id(\d+)`, removeApi);

// POST /api/register
router.post('/register', registerApi);

// GET /api/list
router.get('/list', listApis);

// GET /api/api-stats
router.get('/api-stats', (_req, res) => {
	const stats = getApiStatsSnapshot(_req.user?.id || null);
	return res.json({ success: true, count: stats.length, data: stats });
});

// POST /api/validate/:id
router.post(String.raw`/validate/:id(\d+)`, validateApi);

// PATCH /api/:id
router.patch(String.raw`/:id(\d+)`, updateApi);

// DELETE /api/:id
router.delete(String.raw`/:id(\d+)`, removeApi);

module.exports = router;
