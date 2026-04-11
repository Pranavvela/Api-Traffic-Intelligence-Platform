'use strict';

const { Router } = require('express');
const { registerApi, listApis, removeApi, validateApi } = require('../controllers/registeredApiController');

const router = Router();

// POST /api/register
router.post('/register', registerApi);

// GET /api/list
router.get('/list', listApis);

// POST /api/validate/:id
router.post('/validate/:id(\\d+)', validateApi);

// DELETE /api/:id
router.delete('/:id(\\d+)', removeApi);

module.exports = router;
