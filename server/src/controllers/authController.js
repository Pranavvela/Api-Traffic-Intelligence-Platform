'use strict';

const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const config = require('../config/config');
const { createUser, findByEmail, findById, countUsers } = require('../models/userModel');

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const MIN_PASSWORD_LENGTH = 8;

function validateEmail(email) {
  return EMAIL_REGEX.test(email);
}

function signToken(user) {
  return jwt.sign(
    { email: user.email },
    config.auth.jwtSecret,
    { subject: String(user.id), expiresIn: config.auth.jwtExpiresIn }
  );
}

async function register(req, res, next) {
  try {
    const { email, password } = req.body || {};

    if (!email || !validateEmail(email)) {
      return res.status(400).json({ success: false, message: 'Valid email is required.' });
    }

    if (!password || String(password).length < MIN_PASSWORD_LENGTH) {
      return res.status(400).json({
        success: false,
        message: `Password must be at least ${MIN_PASSWORD_LENGTH} characters.`,
      });
    }

    const usersCount = await countUsers();
    if (usersCount > 0 && !config.auth.allowRegister) {
      return res.status(403).json({
        success: false,
        message: 'Registration is disabled.',
      });
    }

    const normalizedEmail = String(email).trim().toLowerCase();
    const existing = await findByEmail(normalizedEmail);
    if (existing) {
      return res.status(409).json({ success: false, message: 'Email already in use.' });
    }

    const passwordHash = await bcrypt.hash(String(password), 10);
    const created = await createUser(normalizedEmail, passwordHash);
    const token = signToken(created);

    return res.status(201).json({
      success: true,
      data: {
        user: created,
        token,
        expiresIn: config.auth.jwtExpiresIn,
      },
    });
  } catch (err) {
    return next(err);
  }
}

async function login(req, res, next) {
  try {
    const { email, password } = req.body || {};

    if (!email || !password) {
      return res.status(400).json({ success: false, message: 'Email and password are required.' });
    }

    const normalizedEmail = String(email).trim().toLowerCase();
    const user = await findByEmail(normalizedEmail);
    if (!user) {
      return res.status(401).json({ success: false, message: 'Invalid email or password.' });
    }

    const validPassword = await bcrypt.compare(String(password), user.password);
    if (!validPassword) {
      return res.status(401).json({ success: false, message: 'Invalid email or password.' });
    }

    const token = signToken(user);
    return res.json({
      success: true,
      data: {
        user: { id: user.id, email: user.email, created_at: user.created_at },
        token,
        expiresIn: config.auth.jwtExpiresIn,
      },
    });
  } catch (err) {
    return next(err);
  }
}

async function me(req, res, next) {
  try {
    if (!req.user?.id) {
      return res.status(401).json({ success: false, message: 'Unauthorized.', code: 'UNAUTHORIZED' });
    }

    const user = await findById(req.user.id);
    if (!user) {
      return res.status(404).json({ success: false, message: 'User not found.' });
    }

    return res.json({ success: true, data: user });
  } catch (err) {
    return next(err);
  }
}

module.exports = { register, login, me };
