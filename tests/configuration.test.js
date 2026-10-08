const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const { createRuntime } = require('../server/server');
const { createUserRepository } = require('../server/users/user-repository');
const { createSessionRepository } = require('../server/auth/session-repository');

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

function noOpBootstrap() {
  return Promise.resolve();
}

function isolatedStorage() {
  return {
    users: createUserRepository(),
    sessions: createSessionRepository(),
  };
}

test('configura el proxy únicamente cuando el hosting lo solicita', async () => {
  for (const [value, expected] of [[undefined, false], ['0', false], ['1', 1]]) {
    const runtime = createRuntime({ ...isolatedStorage(), env: { PUBLITEX_TRUST_PROXY: value }, bootstrapUsers: noOpBootstrap });
    await runtime.ready;
    assert.equal(runtime.app.get('trust proxy'), expected);
  }
});

test('las tres cuentas se recrean en una base vacía y no se duplican al reiniciar', async () => {
  const { withTestDatabase } = require('./database-helper');
  const env = {
    PUBLITEX_BOSS_NAME: 'Marcelo Velis', PUBLITEX_BOSS_EMAIL: 'marcelo@example.com', PUBLITEX_BOSS_PASSWORD: 'jefe-prueba',
    PUBLITEX_WORKER_NAME: 'Marcos Velis', PUBLITEX_WORKER_EMAIL: 'marcos@example.com', PUBLITEX_WORKER_PASSWORD: 'trabajador-prueba',
    PUBLITEX_SUPERADMIN_NAME: 'Ignacio', PUBLITEX_SUPERADMIN_EMAIL: 'ignacio@example.com', PUBLITEX_SUPERADMIN_PASSWORD: 'admin-prueba',
  };
  for (let freshDatabase = 0; freshDatabase < 2; freshDatabase++) {
    await withTestDatabase(async ({ database }) => {
      for (let restart = 0; restart < 2; restart++) {
        const runtime = createRuntime({ database, env, hashPassword: value => `test:${value}`, verifyPassword: (value, hash) => hash === `test:${value}` });
        await runtime.ready;
        for (const [prefix, role] of [['BOSS', 'jefe'], ['WORKER', 'trabajador'], ['SUPERADMIN', 'superadmin']]) {
          const user = await runtime.userService.authenticate({ email: env[`PUBLITEX_${prefix}_EMAIL`], password: env[`PUBLITEX_${prefix}_PASSWORD`] });
          assert.equal(user.role, role);
        }
        assert.equal(database.prepare('SELECT COUNT(*) AS count FROM users').get().count, 3);
        runtime.close();
      }
    });
  }
});

test('rechaza una cuenta inicial de trabajador incompleta', async () => {
  const runtime = createRuntime({ ...isolatedStorage(), env: { PUBLITEX_WORKER_NAME: 'Marcos Velis', PUBLITEX_WORKER_EMAIL: 'marcos@example.com' } });
  await assert.rejects(runtime.ready, { code: 'INCOMPLETE_BOOTSTRAP_CONFIG' });
});

test('crear el runtime no escucha puertos por sí mismo', async () => {
  const runtime = createRuntime({ ...isolatedStorage(), bootstrapUsers: noOpBootstrap, env: {} });
  await runtime.ready;
  assert.equal(runtime.app.listening, undefined);
});

test('el runtime espera el bootstrap antes de aceptar tráfico', async () => {
  let releaseBootstrap;
  const bootstrapStarted = new Promise((resolve) => {
    releaseBootstrap = resolve;
  });
  let bootstrapFinished;
  const bootstrap = new Promise((resolve) => {
    bootstrapFinished = resolve;
  });
  const runtime = createRuntime({
    ...isolatedStorage(),
    env: {},
    bootstrapUsers: async () => {
      releaseBootstrap();
      await bootstrap;
    },
  });
  await bootstrapStarted;

  await withServer(runtime.app, async (baseUrl) => {
    let settled = false;
    const responsePromise = fetch(`${baseUrl}/api/no-existe`).then((response) => {
      settled = true;
      return response;
    });
    await new Promise((resolve) => setTimeout(resolve, 20));
    assert.equal(settled, false);
    bootstrapFinished();
    await runtime.ready;
    const response = await responsePromise;
    assert.equal(response.status, 404);
  });
});

test('marca la cookie como segura únicamente en producción', async () => {
  const authService = {
    async register() {
      return { user: { id: 'u1', name: 'Ana', email: 'ana@example.com', role: 'cliente' }, token: 'token' };
    },
    async login() {
      return { user: { id: 'u1', name: 'Ana', email: 'ana@example.com', role: 'cliente' }, token: 'token' };
    },
    async getSessionUser() { return null; },
    async logout() {},
  };

  const production = createRuntime({
    ...isolatedStorage(), env: { NODE_ENV: 'production' }, authService, bootstrapUsers: noOpBootstrap,
  });
  await production.ready;
  await withServer(production.app, async (baseUrl) => {
    const response = await fetch(`${baseUrl}/api/auth/login`, { method: 'POST', body: '{}' });
    assert.match(response.headers.get('set-cookie'), /Secure/i);
  });

  const development = createRuntime({
    ...isolatedStorage(), env: { NODE_ENV: 'development' }, authService, bootstrapUsers: noOpBootstrap,
  });
  await development.ready;
  await withServer(development.app, async (baseUrl) => {
    const response = await fetch(`${baseUrl}/api/auth/login`, { method: 'POST', body: '{}' });
    assert.doesNotMatch(response.headers.get('set-cookie'), /Secure/i);
  });
});

test('rechaza el runtime cuando una cuenta privilegiada está incompleta', async () => {
  const runtime = createRuntime({
    ...isolatedStorage(),
    env: { PUBLITEX_BOSS_NAME: 'Jefa', PUBLITEX_BOSS_EMAIL: 'jefa@example.com' },
  });
  await assert.rejects(runtime.ready, { code: 'INCOMPLETE_BOOTSTRAP_CONFIG' });
});

test('no imprime valores de contraseña durante un fallo de bootstrap', async () => {
  const messages = [];
  const runtime = createRuntime({
    ...isolatedStorage(),
    env: {
      PUBLITEX_BOSS_NAME: 'Jefa',
      PUBLITEX_BOSS_EMAIL: 'jefa@example.com',
      PUBLITEX_BOSS_PASSWORD: 'secreto-no-imprimir',
    },
    logger: { error(...args) { messages.push(args); } },
    bootstrapUsers: async () => {
      throw new Error('password=secreto-no-imprimir');
    },
  });
  await assert.rejects(runtime.ready);
  assert.doesNotMatch(JSON.stringify(messages), /secreto-no-imprimir/i);
});

test('ignora .env.example pero mantiene .env fuera del control de versiones', () => {
  const gitignore = fs.readFileSync('.gitignore', 'utf8');
  assert.match(gitignore, /^\.env$/m);
  assert.match(gitignore, /^!\.env\.example$/m);
});
