'use strict';

const { Router } = require('express');
const { blockIpHandler, unblockIpHandler, listBlockedIpsHandler } = require('../controllers/blocklistController');

const router = Router();

// GET  /api/block-ip        — list all blocked IPs
router.get('/', listBlockedIpsHandler);

// POST /api/block-ip        — block an IP
router.post('/', blockIpHandler);

// DELETE /api/block-ip/:ip  — unblock an IP
router.delete('/:ip', unblockIpHandler);

module.exports = router;
