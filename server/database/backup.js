const fs = require('node:fs');
const path = require('node:path');
const { DatabaseSync, backup } = require('node:sqlite');

function timestamp(date) {
  const digits = [
    date.getUTCFullYear(),
    String(date.getUTCMonth() + 1).padStart(2, '0'),
    String(date.getUTCDate()).padStart(2, '0'),
    '-',
    String(date.getUTCHours()).padStart(2, '0'),
    String(date.getUTCMinutes()).padStart(2, '0'),
    String(date.getUTCSeconds()).padStart(2, '0'),
  ];
  return digits.join('');
}

async function createBackup({ sourceFilename, backupDirectory, now = () => new Date() }) {
  const source = path.resolve(sourceFilename);
  const destinationDirectory = path.resolve(backupDirectory);
  if (!fs.existsSync(source)) {
    throw new Error('La base de datos de origen no existe.');
  }

  fs.mkdirSync(destinationDirectory, { recursive: true });
  const date = now();
  const destination = path.join(destinationDirectory, `publitex-${timestamp(date)}.sqlite`);
  if (fs.existsSync(destination)) {
    throw new Error('Ya existe un respaldo con esa fecha.');
  }

  const database = new DatabaseSync(source, { readOnly: true });
  try {
    await backup(database, destination);
  } finally {
    database.close();
  }
  return destination;
}

if (require.main === module) {
  const sourceFilename = process.env.PUBLITEX_DB_PATH
    || path.resolve(__dirname, '..', '..', 'data', 'publitex.sqlite');
  const backupDirectory = process.env.PUBLITEX_BACKUP_DIR
    || path.resolve(__dirname, '..', '..', 'backups');
  createBackup({ sourceFilename, backupDirectory })
    .then((filename) => console.log(filename))
    .catch(() => {
      console.error('No se pudo crear el respaldo de la base de datos.');
      process.exitCode = 1;
    });
}

module.exports = { createBackup };
