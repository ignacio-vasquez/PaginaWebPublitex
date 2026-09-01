const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { createRuntime } = require('../server/server');

function createTemporaryDatabase() {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'publitex-runtime-'));
  return { directory, filename: path.join(directory, 'runtime.sqlite') };
}

function runtimeOptions(databaseFilename) {
  return {
    databaseFilename,
    env: {},
    bootstrapUsers: async () => {},
    createId: () => 'user-1',
    hashPassword: async (password) => `hash:${password}`,
    verifyPassword: async (password, hash) => hash === `hash:${password}`,
    createToken: () => 'a'.repeat(64),
    hashToken: (token) => `token-hash:${token}`,
    now: () => 1_000,
  };
}

test('conserva una cuenta y permite autenticarla después de reiniciar el runtime', async () => {
  const fixture = createTemporaryDatabase();
  try {
    const first = createRuntime(runtimeOptions(fixture.filename));
    await first.ready;
    await first.authService.register({ name: 'Ana', email: 'ana@example.com', password: 'secreto1' });
    first.close();

    const second = createRuntime(runtimeOptions(fixture.filename));
    await second.ready;
    const login = await second.authService.login({ email: 'ana@example.com', password: 'secreto1' });
    assert.deepEqual(login.user, {
      id: 'user-1', name: 'Ana', email: 'ana@example.com', role: 'cliente',
    });
    second.close();
  } finally {
    fs.rmSync(fixture.directory, { recursive: true, force: true });
  }
});

test('expone el runtime persistente y permite cerrarlo más de una vez', async () => {
  const fixture = createTemporaryDatabase();
  try {
    const runtime = createRuntime(runtimeOptions(fixture.filename));
    assert.equal(typeof runtime.close, 'function');
    assert.ok(runtime.database);
    assert.ok(runtime.users);
    assert.ok(runtime.sessions);
    assert.ok(runtime.userService);
    assert.ok(runtime.authService);
    await runtime.ready;
    runtime.close();
    runtime.close();
  } finally {
    fs.rmSync(fixture.directory, { recursive: true, force: true });
  }
});

test('no ejecuta el bootstrap cuando falla una migración', () => {
  const fixture = createTemporaryDatabase();
  const migrationsDirectory = path.join(fixture.directory, 'migrations');
  fs.mkdirSync(migrationsDirectory);
  fs.writeFileSync(path.join(migrationsDirectory, '001_invalid.sql'), 'INVALID SQL;');
  let bootstrapCalled = false;

  try {
    assert.throws(() => createRuntime({
      ...runtimeOptions(fixture.filename),
      migrationsDirectory,
      bootstrapUsers: async () => { bootstrapCalled = true; },
    }));
    assert.equal(bootstrapCalled, false);
  } finally {
    fs.rmSync(fixture.directory, { recursive: true, force: true });
  }
});
