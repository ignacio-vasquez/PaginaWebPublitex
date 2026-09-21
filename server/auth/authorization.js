const { getSessionToken } = require('./auth-routes');

function requireUser(authService) {
  if (!authService || typeof authService.getSessionUser !== 'function') {
    throw new TypeError('authService es obligatorio.');
  }

  return async function authenticatedUser(request, response, next) {
    let user;
    let context;
    try {
      context = typeof authService.getSessionContext === 'function'
        ? await authService.getSessionContext(getSessionToken(request))
        : { user: await authService.getSessionUser(getSessionToken(request)) };
      user = context.user;
    } catch (error) {
      return next(error);
    }
    if (!user) return response.status(401).json({ error: 'Debes iniciar sesión.' });
    request.user = user;
    request.realUser = context.realUser || user;
    request.simulation = context.simulation || null;
    return next();
  };
}

function requireRole(...roles) {
  return function authorizedRole(request, response, next) {
    if (!request.user || !roles.includes(request.user.role)) {
      return response.status(403).json({ error: 'No tienes permiso para realizar esta acción.' });
    }
    return next();
  };
}

module.exports = { requireUser, requireRole };
