const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { DatabaseSync } = require('node:sqlite');
const { createBackup } = require('../server/database/backup');
const { createSqliteUserRepository } = require('../server/users/sqlite-user-repository');
const { withTestDatabase } = require('./database-helper');

const USER = {
  id: 'user-1', name: 'Ana', email: 'ana@example.com', role: 'cliente', passwordHash: 'hash:secreto1',
};

test('crea un respaldo fechado que conserva los datos de origen', async () => {
  await withTestDatabase(async ({ database, filename, directory }) => {
    await createSqliteUserRepository({ database }).create(USER);
    const backupDirectory = path.join(directory, 'backups');
    const backupFilename = await createBackup({
      sourceFilename: filename,
      backupDirectory,
      now: () => new Date('2026-08-31T14:05:09Z'),
    });

    assert.equal(path.basename(backupFilename), 'publitex-20260831-140509.sqlite');
    assert.equal(fs.existsSync(backupFilename), true);
    const backupDatabase = new DatabaseSync(backupFilename, { readOnly: true });
    try {
      assert.deepEqual(
        { ...backupDatabase.prepare('SELECT id, email FROM users WHERE id = ?').get('user-1') },
        { id: 'user-1', email: 'ana@example.com' },
      );
    } finally {
      backupDatabase.close();
    }
  });
});

test('rechaza un origen inexistente sin crear una base vacía', async () => {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'publitex-backup-'));
  const sourceFilename = path.join(directory, 'missing.sqlite');
  try {
    await assert.rejects(createBackup({
      sourceFilename,
      backupDirectory: path.join(directory, 'backups'),
    }));
    assert.equal(fs.existsSync(sourceFilename), false);
  } finally {
    fs.rmSync(directory, { recursive: true, force: true });
  }
});
