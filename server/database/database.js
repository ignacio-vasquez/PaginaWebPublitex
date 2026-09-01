const fs = require('node:fs');
const path = require('node:path');
const { DatabaseSync } = require('node:sqlite');

function openDatabase({ filename } = {}) {
  if (typeof filename !== 'string' || filename.trim() === '') {
    throw new TypeError('La ruta de la base de datos es obligatoria.');
  }

  if (filename !== ':memory:') {
    fs.mkdirSync(path.dirname(path.resolve(filename)), { recursive: true });
  }

  const database = new DatabaseSync(filename);
  database.exec('PRAGMA foreign_keys = ON;');
  database.exec('PRAGMA journal_mode = WAL;');
  database.exec('PRAGMA busy_timeout = 5000;');
  return database;
}

module.exports = { openDatabase };
