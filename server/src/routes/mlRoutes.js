'use strict';

const { Router } = require('express');
const { getFeatures, exportFeatures, trainModel, detectAnomalies, getStatus } = require('../controllers/mlController');

const router = Router();

// GET /ml/features
router.get('/features', getFeatures);

// GET /ml/export
router.get('/export', exportFeatures);

// POST /ml/train
router.post('/train', trainModel);

// GET /ml/detect
router.get('/detect', detectAnomalies);

// GET /ml/status
router.get('/status', getStatus);

module.exports = router;
