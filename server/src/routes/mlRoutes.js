'use strict';

const { Router } = require('express');
const { getFeatures, exportFeatures, trainModel, detectAnomalies, getStatus, listModels, activateModel } = require('../controllers/mlController');

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

// GET /ml/models
router.get('/models', listModels);

// POST /ml/models/:id/activate
router.post(String.raw`/models/:id(\d+)/activate`, activateModel);

module.exports = router;
