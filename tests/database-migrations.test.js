const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { openDatabase } = require('../server/database/database');
const { migrateDatabase } = require('../server/database/migrate');
const { withTestDatabase } = require('./database-helper');

test('configura SQLite y aplica cada migración una sola vez', async () => {
  await withTestDatabase(async ({ database, filename }) => {
    assert.equal(database.prepare('PRAGMA foreign_keys').get().foreign_keys, 1);
    assert.equal(database.prepare('PRAGMA journal_mode').get().journal_mode, 'wal');
    assert.deepEqual(migrateDatabase({ database }), []);
    database.close();

    const reopened = openDatabase({ filename });
    assert.deepEqual(
      reopened.prepare('SELECT version FROM schema_migrations ORDER BY version').all().map((row) => ({ ...row })),
      [{ version: '001_auth.sql' }],
    );
    reopened.close();
  });
});

test('revierte una migración inválida sin registrarla', () => {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'publitex-migrations-'));
  const filename = path.join(directory, 'test.sqlite');
  const migrationsDirectory = path.join(directory, 'migrations');
  fs.mkdirSync(migrationsDirectory);
  fs.writeFileSync(path.join(migrationsDirectory, '001_invalid.sql'), 'CREATE TABLE partial (id TEXT); INVALID SQL;');
  const database = openDatabase({ filename });

  try {
    assert.throws(() => migrateDatabase({ database, migrationsDirectory }));
    assert.deepEqual(database.prepare('SELECT version FROM schema_migrations').all(), []);
    assert.equal(
      database.prepare("SELECT name FROM sqlite_master WHERE type = 'table' AND name = 'partial'").get(),
      undefined,
    );
  } finally {
    database.close();
    fs.rmSync(directory, { recursive: true, force: true });
  }
});
