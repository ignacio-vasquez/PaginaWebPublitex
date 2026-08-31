const test = require('node:test');
const assert = require('node:assert/strict');
const express = require('express');
const { createApp } = require('../server/app');
const { requireUser } = require('../server/auth/authorization');

async function withServer(app, callback) {
  const server = app.listen(0, '127.0.0.1');
  await new Promise((resolve) => server.once('listening', resolve));
  const { port } = server.address();
  try {
    await callback(`http://127.0.0.1:${port}`);
  } finally {
    await new Promise((resolve, reject) => server.close((error) => error ? reject(error) : resolve()));
  }
}

function createAuthService({ login = async () => ({ user: { id: 'user-1' }, token: 'token' }) } = {}) {
  return {
    register: async () => ({ user: { id: 'user-1' }, token: 'token' }),
    login,
    getSessionUser: async () => null,
    logout: async () => undefined,
  };
}

async function postLogin(baseUrl, body) {
  return fetch(`${baseUrl}/api/auth/login`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body),
  });
}

test('limita a cinco intentos de login por IP y rechaza el sexto', async () => {
  const app = createApp({
    authService: createAuthService({
      login: async () => {
        const error = new Error('credenciales inválidas');
        error.code = 'INVALID_CREDENTIALS';
        throw error;
      },
    }),
  });

  await withServer(app, async (baseUrl) => {
    const responses = [];
    for (let attempt = 0; attempt < 6; attempt += 1) {
      responses.push(await postLogin(baseUrl, { email: 'nadie@example.com', password: 'incorrecta' }));
    }
    assert.deepEqual(responses.map((response) => response.status), [401, 401, 401, 401, 401, 429]);
    assert.deepEqual(await responses[5].json(), {
      error: 'Demasiados intentos. Intenta nuevamente más tarde.',
    });
  });
});

test('devuelve 413 en vez de una página HTML para un cuerpo JSON demasiado grande', async () => {
  const app = createApp({ authService: createAuthService() });
  await withServer(app, async (baseUrl) => {
    const response = await postLogin(baseUrl, {
      email: `${'a'.repeat(17_000)}@example.com`,
      password: 'secreto1',
    });
    assert.equal(response.status, 413);
    assert.match(response.headers.get('content-type'), /^application\/json/);
    assert.deepEqual(await response.json(), { error: 'La solicitud es demasiado grande.' });
  });
});

test('devuelve 400 en JSON para un cuerpo malformado', async () => {
  const app = createApp({ authService: createAuthService() });
  await withServer(app, async (baseUrl) => {
    const response = await fetch(`${baseUrl}/api/auth/login`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: '{"email": "incompleto"',
    });
    assert.equal(response.status, 400);
    assert.match(response.headers.get('content-type'), /^application\/json/);
    assert.deepEqual(await response.json(), { error: 'La solicitud JSON no es válida.' });
  });
});

test('oculta detalles sensibles ante errores inesperados y registra solo metadatos seguros', async () => {
  const logEntries = [];
  const logger = {
    error(...args) {
      logEntries.push(args);
    },
  };
  const app = createApp({
    logger,
    authService: createAuthService({
      login: async () => {
        throw new Error('password=secreto hash=abc cookie=publitex_session=token stack=interno');
      },
    }),
  });

  await withServer(app, async (baseUrl) => {
    const response = await postLogin(baseUrl, { email: 'ana@example.com', password: 'secreto' });
    assert.equal(response.status, 500);
    assert.deepEqual(await response.json(), { error: 'Ocurrió un problema inesperado.' });
    assert.equal(response.headers.get('set-cookie'), null);
  });

  const logged = JSON.stringify(logEntries);
  assert.doesNotMatch(logged, /password|hash|cookie|secreto|publitex_session|stack=interno/i);
});

test('el log de un error inesperado omite query strings sensibles', async () => {
  const logEntries = [];
  const app = createApp({
    logger: { error(...args) { logEntries.push(args); } },
    authService: createAuthService({
      login: async () => { throw new Error('fallo interno'); },
    }),
  });

  await withServer(app, async (baseUrl) => {
    const response = await fetch(`${baseUrl}/api/auth/login?password=secreto&cookie=abc`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ email: 'ana@example.com', password: 'secreto' }),
    });
    assert.equal(response.status, 500);
  });

  assert.equal(logEntries.length, 1);
  assert.equal(logEntries[0][0].path, '/api/auth/login');
  assert.doesNotMatch(JSON.stringify(logEntries), /\?|password|cookie|secreto|abc/i);
});

test('un SyntaxError de aplicación con status 400 sigue siendo un error inesperado', async () => {
  const app = createApp({
    authService: createAuthService({
      login: async () => {
        const error = new SyntaxError('error interno de aplicación');
        error.status = 400;
        throw error;
      },
    }),
  });

  await withServer(app, async (baseUrl) => {
    const response = await postLogin(baseUrl, { email: 'ana@example.com', password: 'secreto' });
    assert.equal(response.status, 500);
    assert.deepEqual(await response.json(), { error: 'Ocurrió un problema inesperado.' });
  });
});

test('un error de aplicación con status 413 sin tipo de parser sigue siendo inesperado', async () => {
  const app = createApp({
    authService: createAuthService({
      login: async () => {
        const error = new Error('error interno de aplicación');
        error.status = 413;
        throw error;
      },
    }),
  });

  await withServer(app, async (baseUrl) => {
    const response = await postLogin(baseUrl, { email: 'ana@example.com', password: 'secreto' });
    assert.equal(response.status, 500);
    assert.deepEqual(await response.json(), { error: 'Ocurrió un problema inesperado.' });
  });
});

test('una excepción al consultar sesión responde 500 seguro y registra solo metadatos seguros', async () => {
  const logEntries = [];
  const app = createApp({
    logger: { error(...args) { logEntries.push(args); } },
    authService: {
      ...createAuthService(),
      getSessionUser: async () => {
        throw new Error('password=secreto cookie=publitex_session=token');
      },
    },
  });

  await withServer(app, async (baseUrl) => {
    const response = await fetch(`${baseUrl}/api/auth/session?password=secreto`, {
      headers: { cookie: 'publitex_session=token' },
    });
    assert.equal(response.status, 500);
    assert.deepEqual(await response.json(), { error: 'Ocurrió un problema inesperado.' });
  });

  assert.equal(logEntries.length, 1);
  assert.deepEqual(logEntries[0][0], {
    event: 'http_error', status: 500, method: 'GET', path: '/api/auth/session',
  });
});

test('un error downstream tras requireUser llega al manejador de errores, nunca a 401', async () => {
  const logEntries = [];
  const authService = {
    ...createAuthService(),
    getSessionUser: async () => ({ id: 'user-1', role: 'cliente' }),
  };
  const testRoutes = express.Router();
  testRoutes.get('/downstream-error', requireUser(authService), (_request, _response, next) => {
    next(new Error('fallo downstream password=secreto'));
  });
  const app = createApp({ logger: { error(...args) { logEntries.push(args); } }, authService, testRoutes });

  await withServer(app, async (baseUrl) => {
    const response = await fetch(`${baseUrl}/api/test/downstream-error`, {
      headers: { cookie: 'publitex_session=token' },
    });
    assert.equal(response.status, 500);
    assert.deepEqual(await response.json(), { error: 'Ocurrió un problema inesperado.' });
  });

  assert.deepEqual(logEntries[0][0], {
    event: 'http_error', status: 500, method: 'GET', path: '/api/test/downstream-error',
  });
});

test('mantiene una respuesta JSON uniforme para rutas API inexistentes', async () => {
  const app = createApp();
  await withServer(app, async (baseUrl) => {
    const response = await fetch(`${baseUrl}/api/no-existe`);
    assert.equal(response.status, 404);
    assert.deepEqual(await response.json(), { error: 'Recurso no encontrado.' });
  });
});
