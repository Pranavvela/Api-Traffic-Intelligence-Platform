'use strict';

const { Router } = require('express');
const { listBlockedIpsHandler, unblockIpBodyHandler } = require('../controllers/blocklistController');

const router = Router();

// GET /api/blocked-ips
router.get('/blocked-ips', listBlockedIpsHandler);

// POST /api/unblock-ip
router.post('/unblock-ip', unblockIpBodyHandler);

module.exports = router;
