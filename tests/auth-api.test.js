const test = require('node:test');
const assert = require('node:assert/strict');
const crypto = require('node:crypto');
const { createApp } = require('../server/app');
const { createUserRepository } = require('../server/users/user-repository');
const { createUserService } = require('../server/users/user-service');

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

function cookiePair(response) {
  const value = response.headers.get('set-cookie');
  assert.ok(value, 'la respuesta debe establecer una cookie');
  return value.split(';', 1)[0];
}

function createTestApp() {
  const users = createUserRepository();
  const storedSessions = new Map();
  const sessions = {
    async create(session) { storedSessions.set(session.tokenHash, { ...session }); },
    async findByTokenHash(tokenHash) { return storedSessions.get(tokenHash) ? { ...storedSessions.get(tokenHash) } : null; },
    async deleteByTokenHash(tokenHash) { storedSessions.delete(tokenHash); },
  };
  const userService = createUserService({
    users,
    createId: () => 'user-1',
    hashPassword: async (password) => `hash:${password}`,
    verifyPassword: async (password, hash) => hash === `hash:${password}`,
  });
  let tokenNumber = 0;
  let currentTime = 1_000;
  const app = createApp({
    users,
    sessions,
    userService,
    createToken: () => `${String.fromCharCode(97 + tokenNumber++)}`.repeat(64),
    hashToken: (token) => crypto.createHash('sha256').update(token).digest('hex'),
    now: () => currentTime,
    loginLimiter: (_request, _response, next) => next(),
  });
  return {
    app,
    sessions,
    setTime(value) { currentTime = value; },
  };
}

test('registra un cliente, establece cookie HttpOnly y devuelve perfil público', async () => {
  const { app } = createTestApp();
  await withServer(app, async (baseUrl) => {
    const response = await fetch(`${baseUrl}/api/auth/register`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ name: 'Ignacio', email: 'ignacio@example.com', password: 'secreto1' }),
    });
    assert.equal(response.status, 201);
    assert.match(response.headers.get('set-cookie'), /publitex_session=.*HttpOnly.*SameSite=Lax/i);
    const body = await response.json();
    assert.deepEqual(body.user, {
      id: 'user-1', name: 'Ignacio', email: 'ignacio@example.com', role: 'cliente',
    });
    assert.doesNotMatch(JSON.stringify(body), /password|hash/i);
  });
});

test('permite iniciar sesión con credenciales válidas', async () => {
  const { app } = createTestApp();
  await withServer(app, async (baseUrl) => {
    await fetch(`${baseUrl}/api/auth/register`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ name: 'Ana', email: 'ana@example.com', password: 'secreto1' }),
    });
    const response = await fetch(`${baseUrl}/api/auth/login`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ email: 'ANA@example.com', password: 'secreto1' }),
    });
    assert.equal(response.status, 200);
    assert.ok(cookiePair(response));
    assert.deepEqual(await response.json(), {
      user: { id: 'user-1', name: 'Ana', email: 'ana@example.com', role: 'cliente' },
    });
  });
});

test('rechaza credenciales inválidas con un mensaje genérico', async () => {
  const { app } = createTestApp();
  await withServer(app, async (baseUrl) => {
    const response = await fetch(`${baseUrl}/api/auth/login`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ email: 'nadie@example.com', password: 'secreto1' }),
    });
    assert.equal(response.status, 401);
    assert.deepEqual(await response.json(), { error: 'Correo o contraseña incorrectos.' });
  });
});

test('rechaza registros duplicados con 409', async () => {
  const { app } = createTestApp();
  await withServer(app, async (baseUrl) => {
    const input = { name: 'Ana', email: 'ana@example.com', password: 'secreto1' };
    await fetch(`${baseUrl}/api/auth/register`, {
      method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(input),
    });
    const response = await fetch(`${baseUrl}/api/auth/register`, {
      method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(input),
    });
    assert.equal(response.status, 409);
    assert.deepEqual(await response.json(), { error: 'El correo ya está registrado.' });
  });
});

test('rechaza datos de registro inválidos con 400', async () => {
  const { app } = createTestApp();
  await withServer(app, async (baseUrl) => {
    const response = await fetch(`${baseUrl}/api/auth/register`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ name: '', email: 'no-es-correo', password: 'corto' }),
    });
    assert.equal(response.status, 400);
    assert.deepEqual(await response.json(), { error: 'El nombre no es válido.' });
  });
});

test('informa una sesión activa y no acepta el token desde JSON', async () => {
  const { app } = createTestApp();
  await withServer(app, async (baseUrl) => {
    const registration = await fetch(`${baseUrl}/api/auth/register`, {
      method: 'POST', headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ name: 'Ana', email: 'ana@example.com', password: 'secreto1' }),
    });
    const cookie = cookiePair(registration);
    const active = await fetch(`${baseUrl}/api/auth/session`, { headers: { cookie } });
    assert.equal(active.status, 200);
    assert.deepEqual(await active.json(), {
      authenticated: true,
      user: { id: 'user-1', name: 'Ana', email: 'ana@example.com', role: 'cliente' },
    });

    const forged = await fetch(`${baseUrl}/api/auth/session`, {
      method: 'GET', headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ token: cookie.split('=').pop() }),
    }).catch(() => null);
    assert.equal(forged, null);
  });
});

test('responde authenticated false cuando no hay sesión', async () => {
  const { app } = createTestApp();
  await withServer(app, async (baseUrl) => {
    const response = await fetch(`${baseUrl}/api/auth/session`);
    assert.equal(response.status, 200);
    assert.deepEqual(await response.json(), { authenticated: false });
  });
});

test('cierra sesión, responde 204 y expira la cookie', async () => {
  const { app } = createTestApp();
  await withServer(app, async (baseUrl) => {
    const registration = await fetch(`${baseUrl}/api/auth/register`, {
      method: 'POST', headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ name: 'Ana', email: 'ana@example.com', password: 'secreto1' }),
    });
    const response = await fetch(`${baseUrl}/api/auth/logout`, {
      method: 'POST', headers: { cookie: cookiePair(registration) },
    });
    assert.equal(response.status, 204);
    assert.match(response.headers.get('set-cookie'), /publitex_session=.*(?:Max-Age=0|Expires=.*1970)/i);
    const session = await fetch(`${baseUrl}/api/auth/session`, { headers: { cookie: cookiePair(registration) } });
    assert.deepEqual(await session.json(), { authenticated: false });
  });
});

test('una sesión expirada deja de autenticar y se elimina del repositorio', async () => {
  const fixture = createTestApp();
  await withServer(fixture.app, async (baseUrl) => {
    const registration = await fetch(`${baseUrl}/api/auth/register`, {
      method: 'POST', headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ name: 'Ana', email: 'ana@example.com', password: 'secreto1' }),
    });
    const cookie = cookiePair(registration);
    const token = cookie.slice('publitex_session='.length);
    fixture.setTime(1_000 + 8 * 60 * 60 * 1_000);
    const response = await fetch(`${baseUrl}/api/auth/session`, { headers: { cookie } });
    assert.deepEqual(await response.json(), { authenticated: false });
    const tokenHash = crypto.createHash('sha256').update(token).digest('hex');
    assert.equal(await fixture.sessions.findByTokenHash(tokenHash), null);
  });
});

test('devuelve el perfil público de la sesión activa', async () => {
  const { app } = createTestApp();
  await withServer(app, async (baseUrl) => {
    const registration = await fetch(`${baseUrl}/api/auth/register`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ name: 'Ana', email: 'ana@example.com', password: 'secreto1' }),
    });
    const response = await fetch(`${baseUrl}/api/account/profile`, {
      headers: { cookie: cookiePair(registration) },
    });
    assert.equal(response.status, 200);
    const body = await response.json();
    assert.deepEqual(body, {
      user: { id: 'user-1', name: 'Ana', email: 'ana@example.com', role: 'cliente' },
    });
    assert.doesNotMatch(JSON.stringify(body), /password|hash/i);
  });
});

test('rechaza el perfil sin una cookie de sesión', async () => {
  const { app } = createTestApp();
  await withServer(app, async (baseUrl) => {
    const response = await fetch(`${baseUrl}/api/account/profile`);
    assert.equal(response.status, 401);
    assert.deepEqual(await response.json(), { error: 'Debes iniciar sesión.' });
  });
});
