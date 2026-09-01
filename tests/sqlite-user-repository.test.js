const test = require('node:test');
const assert = require('node:assert/strict');
const { openDatabase } = require('../server/database/database');
const { createSqliteUserRepository } = require('../server/users/sqlite-user-repository');
const { withTestDatabase } = require('./database-helper');

const USER = {
  id: 'user-1',
  name: 'Ana',
  email: 'ana@example.com',
  role: 'cliente',
  passwordHash: 'hash:secreto1',
};

test('crea usuarios y los recupera con el contrato de dominio', async () => {
  await withTestDatabase(async ({ database }) => {
    const users = createSqliteUserRepository({ database, now: () => 1_000 });
    assert.deepEqual(await users.create(USER), USER);
    assert.deepEqual(await users.findByEmail('ana@example.com'), USER);
    assert.deepEqual(await users.findById('user-1'), USER);
    assert.equal(await users.findByEmail('nadie@example.com'), null);
    assert.equal(await users.findById('missing'), null);
  });
});

test('conserva usuarios después de cerrar y reabrir SQLite', async () => {
  await withTestDatabase(async ({ database, filename }) => {
    await createSqliteUserRepository({ database }).create(USER);
    database.close();
    const reopened = openDatabase({ filename });
    try {
      assert.deepEqual(await createSqliteUserRepository({ database: reopened }).findById('user-1'), USER);
    } finally {
      reopened.close();
    }
  });
});

test('rechaza correos duplicados sin distinguir mayúsculas', async () => {
  await withTestDatabase(async ({ database }) => {
    const users = createSqliteUserRepository({ database });
    await users.create(USER);
    await assert.rejects(
      users.create({ ...USER, id: 'user-2', email: 'ANA@example.com' }),
      { code: 'EMAIL_EXISTS', message: 'El correo ya está registrado.' },
    );
  });
});
