const fs = require('node:fs');
const path = require('node:path');

const DEFAULT_MIGRATIONS_DIRECTORY = path.join(__dirname, 'migrations');
const MIGRATION_FILENAME = /^\d{3}_[a-z0-9_]+\.sql$/;

function migrateDatabase({ database, migrationsDirectory = DEFAULT_MIGRATIONS_DIRECTORY }) {
  database.exec(`
    CREATE TABLE IF NOT EXISTS schema_migrations (
      version TEXT PRIMARY KEY,
      applied_at INTEGER NOT NULL
    );
  `);

  const applied = new Set(
    database.prepare('SELECT version FROM schema_migrations').all().map(({ version }) => version),
  );
  const pending = fs.readdirSync(migrationsDirectory)
    .filter((filename) => MIGRATION_FILENAME.test(filename) && !applied.has(filename))
    .sort();
  const recordMigration = database.prepare(
    'INSERT INTO schema_migrations (version, applied_at) VALUES (?, ?)',
  );

  for (const version of pending) {
    const sql = fs.readFileSync(path.join(migrationsDirectory, version), 'utf8');
    database.exec('BEGIN IMMEDIATE;');
    try {
      database.exec(sql);
      recordMigration.run(version, Date.now());
      database.exec('COMMIT;');
    } catch (error) {
      database.exec('ROLLBACK;');
      throw error;
    }
  }

  return pending;
}

module.exports = { migrateDatabase };
