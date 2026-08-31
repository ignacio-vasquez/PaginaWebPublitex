const rateLimit = require('express-rate-limit');

const TOO_MANY_ATTEMPTS = 'Demasiados intentos. Intenta nuevamente más tarde.';

function createLoginRateLimit(options = {}) {
  return rateLimit({
    ...options,
    windowMs: options.windowMs ?? 15 * 60 * 1000,
    limit: options.limit ?? 5,
    standardHeaders: 'draft-7',
    legacyHeaders: false,
    handler: options.handler ?? ((_request, response) => response.status(429).json({
      error: TOO_MANY_ATTEMPTS,
    })),
  });
}

module.exports = { createLoginRateLimit, TOO_MANY_ATTEMPTS };
