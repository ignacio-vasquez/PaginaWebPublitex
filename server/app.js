const express = require('express');
const path = require('node:path');
const crypto = require('node:crypto');
const bcrypt = require('bcryptjs');
const rateLimit = require('express-rate-limit');
const { createUserRepository } = require('./users/user-repository');
const { createUserService } = require('./users/user-service');
const { createSessionRepository } = require('./auth/session-repository');
const { createAuthService } = require('./auth/auth-service');
const { createAuthRouter } = require('./auth/auth-routes');

function createApp(options = {}) {
  const app = express();
  app.disable('x-powered-by');
  app.use(express.json({ limit: '16kb' }));
  app.use(express.static(path.resolve(__dirname, '..')));

  const users = options.users || createUserRepository();
  const sessions = options.sessions || createSessionRepository();
  const userService = options.userService || createUserService({
    users,
    createId: () => crypto.randomUUID(),
    hashPassword: (password) => bcrypt.hash(password, 12),
    verifyPassword: (password, hash) => bcrypt.compare(password, hash),
  });
  const authService = options.authService || createAuthService({
    users,
    sessions,
    userService,
    createToken: options.createToken,
    hashToken: options.hashToken,
    now: options.now,
  });
  const loginLimiter = options.loginLimiter === undefined
    ? rateLimit({ windowMs: 15 * 60 * 1000, limit: 10, standardHeaders: 'draft-7', legacyHeaders: false })
    : options.loginLimiter;
  app.use('/api/auth', createAuthRouter({
    authService,
    cookieSecure: options.cookieSecure ?? process.env.NODE_ENV === 'production',
    loginLimiter,
  }));

  app.use('/api', (_request, response) => {
    response.status(404).json({ error: 'Recurso no encontrado.' });
  });
  return app;
}

module.exports = { createApp };
