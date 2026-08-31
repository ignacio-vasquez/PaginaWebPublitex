const test = require('node:test');
const assert = require('node:assert/strict');
const crypto = require('node:crypto');
const express = require('express');
const { createApp } = require('../server/app');
const { createAuthService } = require('../server/auth/auth-service');
const { createUserRepository } = require('../server/users/user-repository');
const { createUserService } = require('../server/users/user-service');
const { requireUser, requireRole } = require('../server/auth/authorization');

function fakeResponse() {
  return {
    statusCode: 200,
    body: null,
    status(code) {
      this.statusCode = code;
      return this;
    },
    json(body) {
      this.body = body;
      return this;
    },
  };
}

test('requireRole aplica una matriz explícita de roles sin jerarquía implícita', async () => {
  const cases = [
    ['cliente', ['cliente'], true],
    ['trabajador', ['trabajador', 'jefe'], true],
    ['jefe', ['trabajador'], false],
    ['superadmin', ['jefe'], false],
  ];

  for (const [role, allowedRoles, allowed] of cases) {
    const request = { user: { role } };
    const response = fakeResponse();
    let nextCalled = false;
    await requireRole(...allowedRoles)(request, response, () => { nextCalled = true; });
    assert.equal(nextCalled, allowed, `rol ${role}`);
    assert.equal(response.statusCode, allowed ? 200 : 403, `rol ${role}`);
    if (!allowed) {
      assert.deepEqual(response.body, { error: 'No tienes permiso para realizar esta acción.' });
    }
  }
});

test('requireRole rechaza una solicitud sin usuario autenticado', async () => {
  const response = fakeResponse();
  let nextCalled = false;
  await requireRole('cliente')({}, response, () => { nextCalled = true; });
  assert.equal(nextCalled, false);
  assert.equal(response.statusCode, 403);
  assert.deepEqual(response.body, { error: 'No tienes permiso para realizar esta acción.' });
});

test('requireUser no convierte un error downstream de next en un 401', async () => {
  const request = { headers: {} };
  const response = fakeResponse();
  const downstreamError = new Error('fallo downstream');

  await assert.rejects(
    requireUser({ getSessionUser: async () => ({ id: 'user-1', role: 'cliente' }) })(
      request,
      response,
      () => { throw downstreamError; },
    ),
    downstreamError,
  );
  assert.equal(response.statusCode, 200);
  assert.equal(response.body, null);
});

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

function createRoleFixture() {
  const users = createUserRepository();
  const sessionsByHash = new Map();
  const sessions = {
    async create(session) { sessionsByHash.set(session.tokenHash, { ...session }); },
    async findByTokenHash(tokenHash) { return sessionsByHash.get(tokenHash) || null; },
    async deleteByTokenHash(tokenHash) { sessionsByHash.delete(tokenHash); },
  };
  let id = 0;
  const userService = createUserService({
    users,
    createId: () => `user-${++id}`,
    hashPassword: async (password) => `hash:${password}`,
    verifyPassword: async (password, hash) => hash === `hash:${password}`,
  });
  let tokenId = 0;
  const authService = createAuthService({
    users,
    sessions,
    userService,
    createToken: () => `token-${++tokenId}`,
    hashToken: (token) => crypto.createHash('sha256').update(token).digest('hex'),
    now: () => 1_000,
  });
  return { users, sessions, userService, authService };
}

test('aplica roles del servidor en rutas de prueba con sesiones reales', async () => {
  const fixture = createRoleFixture();
  const credentials = [];
  await fixture.userService.registerClient({ name: 'Cliente', email: 'cliente@example.com', password: 'secreto1' });
  credentials.push(['cliente', 'cliente@example.com']);
  for (const role of ['trabajador', 'jefe', 'superadmin']) {
    await fixture.userService.createPrivilegedUser({
      name: role,
      email: `${role}@example.com`,
      password: 'secreto1',
      role,
    });
    credentials.push([role, `${role}@example.com`]);
  }

  const testRoutes = express.Router();
  testRoutes.get('/worker-only', requireUser(fixture.authService), requireRole('trabajador'), (_request, response) => {
    response.json({ ok: true });
  });
  const app = createApp({
    users: fixture.users,
    sessions: fixture.sessions,
    userService: fixture.userService,
    authService: fixture.authService,
    loginLimiter: (_request, _response, next) => next(),
    testRoutes,
  });

  await withServer(app, async (baseUrl) => {
    for (const [role, email] of credentials) {
      const session = await fixture.authService.login({ email, password: 'secreto1' });
      const response = await fetch(`${baseUrl}/api/test/worker-only`, {
        headers: { cookie: `publitex_session=${encodeURIComponent(session.token)}` },
      });
      assert.equal(response.status, role === 'trabajador' ? 200 : 403, `rol ${role}`);
    }
  });
});
