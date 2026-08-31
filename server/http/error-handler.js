const INVALID_JSON = 'La solicitud JSON no es válida.';
const BODY_TOO_LARGE = 'La solicitud es demasiado grande.';
const UNEXPECTED_ERROR = 'Ocurrió un problema inesperado.';

function isMalformedJson(error) {
  return error && error.type === 'entity.parse.failed';
}

function isBodyTooLarge(error) {
  return error && error.type === 'entity.too.large';
}

function getLogger(request) {
  if (request && request.app && typeof request.app.get === 'function') {
    return request.app.get('logger') || console;
  }
  return console;
}

function logUnexpectedError(error, request, status) {
  const logger = getLogger(request);
  const entry = {
    event: 'http_error',
    status,
    method: request && request.method,
    path: request && request.path,
  };
  try {
    if (logger && typeof logger.error === 'function') logger.error(entry);
    else if (typeof logger === 'function') logger(entry);
  } catch {
    // El logger no debe impedir que el cliente reciba una respuesta segura.
  }
}

function notFoundApi(_request, response) {
  return response.status(404).json({ error: 'Recurso no encontrado.' });
}

function handleError(error, request, response, next) {
  if (response.headersSent) return next(error);
  if (isMalformedJson(error)) {
    return response.status(400).json({ error: INVALID_JSON });
  }
  if (isBodyTooLarge(error)) {
    return response.status(413).json({ error: BODY_TOO_LARGE });
  }

  logUnexpectedError(error, request, 500);
  return response.status(500).json({ error: UNEXPECTED_ERROR });
}

module.exports = {
  notFoundApi,
  handleError,
  INVALID_JSON,
  BODY_TOO_LARGE,
  UNEXPECTED_ERROR,
};
