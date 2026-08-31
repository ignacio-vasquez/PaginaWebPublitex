const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const { createRuntime } = require('../server/server');

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

test('crear el runtime no escucha puertos por sí mismo', async () => {
  const runtime = createRuntime({ bootstrapUsers: noOpBootstrap, env: {} });
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

  const production = createRuntime({ env: { NODE_ENV: 'production' }, authService, bootstrapUsers: noOpBootstrap });
  await production.ready;
  await withServer(production.app, async (baseUrl) => {
    const response = await fetch(`${baseUrl}/api/auth/login`, { method: 'POST', body: '{}' });
    assert.match(response.headers.get('set-cookie'), /Secure/i);
  });

  const development = createRuntime({ env: { NODE_ENV: 'development' }, authService, bootstrapUsers: noOpBootstrap });
  await development.ready;
  await withServer(development.app, async (baseUrl) => {
    const response = await fetch(`${baseUrl}/api/auth/login`, { method: 'POST', body: '{}' });
    assert.doesNotMatch(response.headers.get('set-cookie'), /Secure/i);
  });
});

test('rechaza el runtime cuando una cuenta privilegiada está incompleta', async () => {
  const runtime = createRuntime({
    env: { PUBLITEX_BOSS_NAME: 'Jefa', PUBLITEX_BOSS_EMAIL: 'jefa@example.com' },
  });
  await assert.rejects(runtime.ready, { code: 'INCOMPLETE_BOOTSTRAP_CONFIG' });
});

test('no imprime valores de contraseña durante un fallo de bootstrap', async () => {
  const messages = [];
  const runtime = createRuntime({
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
