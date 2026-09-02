const express = require('express');
const path = require('node:path');
const crypto = require('node:crypto');
const bcrypt = require('bcryptjs');
const { createUserRepository } = require('./users/user-repository');
const { createUserService } = require('./users/user-service');
const { createSessionRepository } = require('./auth/session-repository');
const { createAuthService } = require('./auth/auth-service');
const { createAuthRouter } = require('./auth/auth-routes');
const { createAccountRouter } = require('./account/account-routes');
const { createCatalogRouter } = require('./catalog/catalog-routes');
const { createQuoteRouter } = require('./quotes/quote-routes');
const { createLoginRateLimit } = require('./http/login-rate-limit');
const { notFoundApi, handleError } = require('./http/error-handler');

function createApp(options = {}) {
  const app = express();
  app.disable('x-powered-by');
  app.set('logger', options.logger || console);
  if (options.ready) {
    app.use((_request, _response, next) => {
      Promise.resolve(options.ready).then(() => next(), next);
    });
  }
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
    ? createLoginRateLimit()
    : options.loginLimiter;
  app.use('/api/auth', createAuthRouter({
    authService,
    cookieSecure: options.cookieSecure ?? (options.env || process.env).NODE_ENV === 'production',
    loginLimiter,
  }));
  app.use('/api/account', createAccountRouter({ authService }));
  if (options.catalogService) {
    app.use('/api/catalog', createCatalogRouter({ catalogService: options.catalogService }));
  }
  if (options.quoteService) {
    app.use('/api/quotes', createQuoteRouter({
      quoteService: options.quoteService,
      authService,
    }));
  }
  if (options.testRoutes) app.use('/api/test', options.testRoutes);

  app.use('/api', notFoundApi);
  app.use(handleError);
  return app;
}

module.exports = { createApp };
