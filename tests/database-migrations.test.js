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
      [{ version: '001_auth.sql' }, { version: '002_catalog_quotes.sql' }],
    );
    reopened.close();
  });
});

test('crea el catálogo versionado y rechaza ítems sin cotización', async () => {
  await withTestDatabase(async ({ database }) => {
    const tableNames = database.prepare("SELECT name FROM sqlite_master WHERE type = 'table'").all()
      .map(({ name }) => name);
    const expectedTables = [
      'catalog_products',
      'catalog_materials',
      'catalog_sizes',
      'catalog_quantities',
      'catalog_extras',
      'catalog_prices',
      'catalog_price_extras',
      'quotes',
      'quote_items',
      'quote_item_extras',
    ];

    for (const tableName of expectedTables) {
      assert.equal(tableNames.includes(tableName), true, `falta la tabla ${tableName}`);
    }

    assert.deepEqual(migrateDatabase({ database }), []);
    assert.deepEqual(
      database.prepare('SELECT id FROM catalog_products ORDER BY sort_order').all().map(({ id }) => id),
      ['sign-rect', 'sticker-print', 'banner', 'vehicle-wrap'],
    );

    const configuration = database.prepare(`
      SELECT id, product_id, material_id, size_id, quantity_id
      FROM catalog_prices
      WHERE product_id = 'sign-rect'
      ORDER BY id
      LIMIT 1
    `).get();
    assert.throws(
      () => database.prepare(`
        INSERT INTO quote_items (
          id, quote_id, catalog_price_id, product_id, material_id, size_id, quantity_id,
          product_label, material_label, size_label, quantity_label, quantity_value,
          observation, estimated_subtotal, requires_evaluation, sort_order, created_at, updated_at
        ) VALUES (
          'item-without-quote', 'unknown-quote', ?, ?, ?, ?, ?, 'Producto', 'Material', 'Medida', 'Cantidad', 1,
          '', 1000, 0, 1, 0, 0
        )
      `).run(
        configuration.id,
        configuration.product_id,
        configuration.material_id,
        configuration.size_id,
        configuration.quantity_id,
      ),
      (error) => error.code === 'ERR_SQLITE_ERROR' && error.errcode === 787,
    );
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
