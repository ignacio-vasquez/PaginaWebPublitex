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
      [{ version: '001_auth.sql' }, { version: '002_catalog_quotes.sql' }, { version: '003_quote_codes.sql' }, { version: '004_simulation.sql' }, { version: '005_quote_workflow.sql' }, { version: '006_invoicing.sql' }, { version: '007_shared_work.sql' }, { version: '008_simulation_real_identity.sql' }, { version: '009_actor_target.sql' }, { version: '010_invoice_documents.sql' }],
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

test('vincula los extras de un ítem a su configuración compatible', async () => {
  await withTestDatabase(async ({ database }) => {
    const stickerConfiguration = database.prepare(`
      SELECT id, product_id, material_id, size_id, quantity_id
      FROM catalog_prices
      WHERE product_id = 'sticker-print'
      ORDER BY id
      LIMIT 1
    `).get();
    const signConfiguration = database.prepare(`
      SELECT id, product_id, material_id, size_id, quantity_id
      FROM catalog_prices
      WHERE product_id = 'sign-rect'
      ORDER BY id
      LIMIT 1
    `).get();
    const vehicleConfiguration = database.prepare(`
      SELECT id, product_id, material_id, size_id, quantity_id
      FROM catalog_prices
      WHERE product_id = 'vehicle-wrap'
      ORDER BY id
      LIMIT 1
    `).get();
    const otherSignQuantity = database.prepare(`
      SELECT id
      FROM catalog_quantities
      WHERE product_id = 'sign-rect' AND id != ?
      ORDER BY sort_order
      LIMIT 1
    `).get(signConfiguration.quantity_id);

    database.prepare(`
      INSERT INTO users (id, name, email, password_hash, role, created_at, updated_at)
      VALUES ('catalog-user', 'Catálogo', 'catalogo@example.com', 'hash', 'cliente', 0, 0)
    `).run();
    database.prepare(`
      INSERT INTO quotes (id, user_id, created_at, updated_at)
      VALUES ('catalog-quote', 'catalog-user', 0, 0)
    `).run();
    database.prepare(`
      INSERT INTO quote_items (
        id, quote_id, catalog_price_id, product_id, material_id, size_id, quantity_id,
        product_label, material_label, size_label, quantity_label, quantity_value,
        observation, estimated_subtotal, requires_evaluation, sort_order, created_at, updated_at
      ) VALUES (?, 'catalog-quote', ?, ?, ?, ?, ?, 'Adhesivo', 'Vinilo', 'Formato', 'Cantidad', 10,
        '', 5000, 0, 1, 0, 0)
    `).run(
      'sticker-item',
      stickerConfiguration.id,
      stickerConfiguration.product_id,
      stickerConfiguration.material_id,
      stickerConfiguration.size_id,
      stickerConfiguration.quantity_id,
    );
    database.prepare(`
      INSERT INTO quote_items (
        id, quote_id, catalog_price_id, product_id, material_id, size_id, quantity_id,
        product_label, material_label, size_label, quantity_label, quantity_value,
        observation, estimated_subtotal, requires_evaluation, sort_order, created_at, updated_at
      ) VALUES (?, 'catalog-quote', ?, ?, ?, ?, ?, 'Rotulación', 'Vehículo', 'Cobertura', 'Cantidad', 1,
        '', NULL, 1, 3, 0, 0)
    `).run(
      'vehicle-item',
      vehicleConfiguration.id,
      vehicleConfiguration.product_id,
      vehicleConfiguration.material_id,
      vehicleConfiguration.size_id,
      vehicleConfiguration.quantity_id,
    );
    database.prepare(`
      INSERT INTO quote_items (
        id, quote_id, catalog_price_id, product_id, material_id, size_id, quantity_id,
        product_label, material_label, size_label, quantity_label, quantity_value,
        observation, estimated_subtotal, requires_evaluation, sort_order, created_at, updated_at
      ) VALUES (?, 'catalog-quote', ?, ?, ?, ?, ?, 'Adhesivo', 'Vinilo', 'Formato', 'Cantidad', 10,
        '', 5000, 0, 2, 0, 0)
    `).run(
      'sticker-item-with-fake-price',
      stickerConfiguration.id,
      stickerConfiguration.product_id,
      stickerConfiguration.material_id,
      stickerConfiguration.size_id,
      stickerConfiguration.quantity_id,
    );

    assert.throws(
      () => database.prepare(`
        INSERT INTO quote_items (
          id, quote_id, catalog_price_id, product_id, material_id, size_id, quantity_id,
          product_label, material_label, size_label, quantity_label, quantity_value,
          observation, estimated_subtotal, requires_evaluation, sort_order, created_at, updated_at
        ) VALUES ('incompatible-item', 'catalog-quote', ?, ?, ?, ?, ?, 'Letrero', 'Material', 'Medida', 'Cantidad', 1,
          '', 1000, 0, 2, 0, 0)
      `).run(
        signConfiguration.id,
        signConfiguration.product_id,
        signConfiguration.material_id,
        signConfiguration.size_id,
        otherSignQuantity.id,
      ),
      (error) => error.code === 'ERR_SQLITE_ERROR' && error.errcode === 787,
    );

    database.prepare(`
      INSERT INTO quote_item_extras (quote_item_id, catalog_price_id, extra_id, extra_label, unit_price)
      VALUES ('sticker-item', ?, 'installation', 'Instalación', 3000)
    `).run(stickerConfiguration.id);

    assert.throws(
      () => database.prepare(`
        INSERT INTO quote_item_extras (quote_item_id, catalog_price_id, extra_id, extra_label, unit_price)
        VALUES ('sticker-item', ?, 'eyelets', 'Ojales', 1500)
      `).run(stickerConfiguration.id),
      (error) => error.code === 'ERR_SQLITE_ERROR' && error.errcode === 787,
    );
    assert.throws(
      () => database.prepare(`
        INSERT INTO quote_item_extras (quote_item_id, catalog_price_id, extra_id, extra_label, unit_price)
        VALUES ('sticker-item', ?, 'lighting', 'Iluminación', 8000)
      `).run(signConfiguration.id),
      (error) => error.code === 'ERR_SQLITE_ERROR' && error.errcode === 787,
    );
    assert.throws(
      () => database.prepare(`
        INSERT INTO quote_item_extras (quote_item_id, catalog_price_id, extra_id, extra_label, unit_price)
        VALUES ('sticker-item-with-fake-price', ?, 'installation', 'Instalación', 999999)
      `).run(stickerConfiguration.id),
      (error) => error.code === 'ERR_SQLITE_ERROR' && error.errcode === 787,
    );
    assert.throws(
      () => database.prepare(`
        INSERT INTO quote_item_extras (quote_item_id, catalog_price_id, extra_id, extra_label, unit_price)
        VALUES ('vehicle-item', ?, 'installation', 'Instalación', 6000)
      `).run(vehicleConfiguration.id),
      (error) => error.code === 'ERR_SQLITE_ERROR' && error.errcode === 787,
    );

    assert.deepEqual(
      database.prepare(`
        SELECT product.calculation_type, price.base_price
        FROM catalog_products AS product
        JOIN catalog_prices AS price ON price.product_id = product.id
        WHERE product.id = 'vehicle-wrap'
        ORDER BY price.id
      `).all().map(({ calculation_type, base_price }) => ({ calculation_type, base_price })),
      Array.from({ length: 6 }, () => ({ calculation_type: 'evaluation', base_price: null })),
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


test('asigna códigos a cotizaciones existentes sin modificar sus datos al migrar', () => {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'publitex-code-migration-'));
  const legacy = path.join(directory, 'legacy');
  fs.mkdirSync(legacy);
  for (const name of ['001_auth.sql', '002_catalog_quotes.sql']) {
    fs.copyFileSync(path.join(__dirname, '../server/database/migrations', name), path.join(legacy, name));
  }
  const database = openDatabase({ filename: path.join(directory, 'legacy.sqlite') });
  try {
    migrateDatabase({ database, migrationsDirectory: legacy });
    database.exec("INSERT INTO users (id, name, email, password_hash, role, created_at, updated_at) VALUES ('u', 'Ana', 'ana@example.com', 'hash', 'cliente', 0, 0)");
    database.exec("INSERT INTO quotes (id, user_id, status, phone, created_at, updated_at, submitted_at) VALUES ('old', 'u', 'submitted', '912345678', 1, 3, 3), ('new', 'u', 'draft', NULL, 2, 2, NULL)");
    const before = database.prepare('SELECT * FROM quotes ORDER BY id').all();
    assert.deepEqual(migrateDatabase({ database }), ['003_quote_codes.sql', '004_simulation.sql', '005_quote_workflow.sql', '006_invoicing.sql', '007_shared_work.sql', '008_simulation_real_identity.sql', '009_actor_target.sql', '010_invoice_documents.sql']);
    assert.deepEqual(database.prepare('SELECT * FROM quotes ORDER BY id').all(), before);
    const repository = require('../server/quotes/quote-repository').createQuoteRepository({ database });
    return (async () => {
      assert.equal((await repository.findOwned('old', 'u')).code, 'COT-000001');
      assert.equal((await repository.findOwned('new', 'u')).code, 'COT-000002');
      assert.deepEqual(migrateDatabase({ database }), []);
      assert.equal((await repository.createDraft({ id: 'next', userId: 'u' })).code, 'COT-000003');
    })().finally(() => { database.close(); fs.rmSync(directory, { recursive: true, force: true }); });
  } catch (error) {
    database.close(); fs.rmSync(directory, { recursive: true, force: true }); throw error;
  }
});
