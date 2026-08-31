const test = require('node:test');
const assert = require('node:assert/strict');
const { createApp } = require('../server/app');

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

test('mantiene una respuesta JSON uniforme para rutas API inexistentes', async () => {
  const app = createApp();
  await withServer(app, async (baseUrl) => {
    const response = await fetch(`${baseUrl}/api/no-existe`);
    assert.equal(response.status, 404);
    assert.deepEqual(await response.json(), { error: 'Recurso no encontrado.' });
  });
});
