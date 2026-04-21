'use strict';

const { Router } = require('express');
const { register, login, me } = require('../controllers/authController');
const { requireAuth } = require('../middleware/authMiddleware');

const router = Router();

// ─── PUBLIC ROUTES ─────────────────────────

// POST /api/register
router.post('/register', register);

// POST /api/login
router.post('/login', login);

// ─── PROTECTED ROUTE ───────────────────────

// GET /api/me
router.get('/me', requireAuth, me);

module.exports = router;