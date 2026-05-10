'use strict';

const { Router } = require('express');
const eventBus = require('../services/eventBus');

const router = Router();

// Public SSE endpoint for live events
router.get('/stream', (req, res) => {
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');
  res.flushHeaders && res.flushHeaders();

  const send = (event, payload) => {
    try {
      res.write(`event: ${event}\n`);
      res.write(`data: ${JSON.stringify(payload)}\n\n`);
    } catch (e) {
      // ignore write errors
    }
  };

  const offLog = eventBus.on('log', (d) => send('log', d));
  const offMl = eventBus.on('ml_detection', (d) => send('ml', d));

  // keep connection alive
  const keepAlive = setInterval(() => res.write(': ping\n\n'), 25000);

  req.on('close', () => {
    clearInterval(keepAlive);
    offLog();
    offMl();
  });
});

module.exports = router;
