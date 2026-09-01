const test = require('node:test');
const assert = require('node:assert/strict');
const { openDatabase } = require('../server/database/database');
const { createSqliteUserRepository } = require('../server/users/sqlite-user-repository');
const { createSqliteSessionRepository } = require('../server/auth/sqlite-session-repository');
const { withTestDatabase } = require('./database-helper');

const USER = {
  id: 'user-1', name: 'Ana', email: 'ana@example.com', role: 'cliente', passwordHash: 'hash:secreto1',
};
const SESSION = { tokenHash: 'token-hash', userId: 'user-1', expiresAt: 28_801_000 };

async function insertUser(database) {
  await createSqliteUserRepository({ database }).create(USER);
}

test('crea, recupera y elimina sesiones con el contrato de dominio', async () => {
  await withTestDatabase(async ({ database }) => {
    await insertUser(database);
    const sessions = createSqliteSessionRepository({ database });
    assert.deepEqual(await sessions.create(SESSION), SESSION);
    assert.deepEqual(await sessions.findByTokenHash('token-hash'), SESSION);
    await sessions.deleteByTokenHash('token-hash');
    assert.equal(await sessions.findByTokenHash('token-hash'), null);
  });
});

test('conserva sesiones después de cerrar y reabrir SQLite', async () => {
  await withTestDatabase(async ({ database, filename }) => {
    await insertUser(database);
    await createSqliteSessionRepository({ database }).create(SESSION);
    database.close();
    const reopened = openDatabase({ filename });
    try {
      assert.deepEqual(
        await createSqliteSessionRepository({ database: reopened }).findByTokenHash('token-hash'),
        SESSION,
      );
    } finally {
      reopened.close();
    }
  });
});

test('rechaza una sesión asociada a un usuario inexistente', async () => {
  await withTestDatabase(async ({ database }) => {
    const sessions = createSqliteSessionRepository({ database });
    await assert.rejects(
      sessions.create({ ...SESSION, userId: 'missing' }),
      (error) => error.code === 'ERR_SQLITE_ERROR' && error.errcode === 787,
    );
  });
});
