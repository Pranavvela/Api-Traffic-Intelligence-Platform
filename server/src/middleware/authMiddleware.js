'use strict';

const jwt = require('jsonwebtoken');
const config = require('../config/config');

function parseToken(req) {
  const header = req.headers.authorization || '';
  const [scheme, token] = header.split(' ');
  if (scheme !== 'Bearer' || !token) return null;
  return token;
}

function attachAuth(req, _res, next) {
  const token = parseToken(req);
  if (!token) return next();

  try {
    const payload = jwt.verify(token, config.auth.jwtSecret);
    req.user = {
      id: payload.sub,
      email: payload.email,
    };
  } catch (err) {
    req.user = null;
  }

  next();
}

function requireAuth(req, res, next) {
  const token = parseToken(req);
  if (!token) {
    return res.status(401).json({
      success: false,
      message: 'Authentication required.',
      code: 'UNAUTHORIZED',
    });
  }

  try {
    const payload = jwt.verify(token, config.auth.jwtSecret);
    req.user = {
      id: payload.sub,
      email: payload.email,
    };
    return next();
  } catch (err) {
    return res.status(401).json({
      success: false,
      message: 'Invalid or expired token.',
      code: 'UNAUTHORIZED',
    });
  }
}

module.exports = { attachAuth, requireAuth };
