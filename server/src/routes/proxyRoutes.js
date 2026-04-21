'use strict';

const { Router } = require('express');
const { forwardRequest, getApiStatsSnapshot } = require('../services/proxyService');

const router = Router();

function apiStatsHandler(req, res) {
  const stats = getApiStatsSnapshot(req.user?.id || null);
  return res.json({ success: true, count: stats.length, data: stats });
}

async function proxyHandler(req, res, next) {
  try {
    const result = await forwardRequest(req);

    if (result.headers?.['content-type']) {
      res.set('content-type', result.headers['content-type']);
    }

    if (result.ok) {
      return res.status(result.status).send(result.data);
    }

    return res.status(result.status).send(result.data);
  } catch (err) {
    return next(err);
  }
}

// Optional proxy intelligence endpoint.
// Accessible at GET /proxy/api-stats
router.get('/api-stats', apiStatsHandler);

// Supports:
// 1) /proxy/https://api.example.com/users
// 2) /proxy?url=https://api.example.com/users
router.all('/', proxyHandler);
router.all('/*', proxyHandler);

module.exports = router;
