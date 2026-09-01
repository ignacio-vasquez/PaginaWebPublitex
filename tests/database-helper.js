const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { openDatabase } = require('../server/database/database');
const { migrateDatabase } = require('../server/database/migrate');

async function withTestDatabase(callback) {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'publitex-db-'));
  const filename = path.join(directory, 'test.sqlite');
  const database = openDatabase({ filename });

  try {
    migrateDatabase({ database });
    await callback({ database, filename, directory });
  } finally {
    if (database.isOpen) database.close();
    fs.rmSync(directory, { recursive: true, force: true });
  }
}

module.exports = { withTestDatabase };
