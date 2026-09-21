const express = require('express');

const SESSION_COOKIE = 'publitex_session';
const SESSION_MAX_AGE = 8 * 60 * 60 * 1000;

function getSessionToken(request) {
  const header = request.headers.cookie;
  if (typeof header !== 'string') return null;
  for (const part of header.split(';')) {
    const separator = part.indexOf('=');
    if (separator < 0 || part.slice(0, separator).trim() !== SESSION_COOKIE) continue;
    const value = part.slice(separator + 1).trim();
    if (!value) return null;
    try {
      return decodeURIComponent(value);
    } catch {
      return null;
    }
  }
  return null;
}

function errorResponse(response, error, next) {
  if (error && error.code === 'EMAIL_EXISTS') {
    return response.status(409).json({ error: 'El correo ya está registrado.' });
  }
  if (error && error.code === 'INVALID_CREDENTIALS') {
    return response.status(401).json({ error: 'Correo o contraseña incorrectos.' });
  }
  if (error && /^INVALID_/.test(error.code || '')) {
    return response.status(400).json({ error: error.message });
  }
  return next(error);
}

function createAuthRouter({ authService, cookieSecure = false, loginLimiter } = {}) {
  if (!authService) throw new TypeError('authService es obligatorio.');
  const router = express.Router();
  const cookieOptions = {
    httpOnly: true,
    sameSite: 'lax',
    secure: cookieSecure,
    maxAge: SESSION_MAX_AGE,
    path: '/',
  };

  function setSessionCookie(response, token) {
    response.cookie(SESSION_COOKIE, token, cookieOptions);
  }

  router.post('/register', async (request, response, next) => {
    try {
      const result = await authService.register(request.body || {});
      setSessionCookie(response, result.token);
      return response.status(201).json({ user: result.user });
    } catch (error) {
      return errorResponse(response, error, next);
    }
  });

  const loginHandlers = [];
  if (loginLimiter) loginHandlers.push(loginLimiter);
  loginHandlers.push(async (request, response, next) => {
    try {
      const result = await authService.login(request.body || {});
      setSessionCookie(response, result.token);
      return response.status(200).json({ user: result.user });
    } catch (error) {
      return errorResponse(response, error, next);
    }
  });
  router.post('/login', ...loginHandlers);

  router.get('/session', async (request, response, next) => {
    try {
      const context = typeof authService.getSessionContext === 'function'
        ? await authService.getSessionContext(getSessionToken(request))
        : { user: await authService.getSessionUser(getSessionToken(request)) };
      const { user } = context;
      const result = user ? { authenticated: true, user } : { authenticated: false };
      if (context.realUser?.role === 'superadmin') {
        result.realUser = context.realUser;
        result.simulation = context.simulation;
      }
      return response.status(200).json(result);
    } catch (error) {
      return next(error);
    }
  });

  router.post('/logout', async (request, response, next) => {
    try {
      await authService.logout(getSessionToken(request));
      return response.cookie(SESSION_COOKIE, '', { ...cookieOptions, maxAge: 0 }).status(204).end();
    } catch (error) {
      return errorResponse(response, error, next);
    }
  });

  return router;
}

module.exports = { createAuthRouter, SESSION_COOKIE, SESSION_MAX_AGE, getSessionToken };
