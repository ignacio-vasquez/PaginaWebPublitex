const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { openDatabase } = require('../server/database/database');
const { migrateDatabase } = require('../server/database/migrate');
const { createQuoteRepository } = require('../server/quotes/quote-repository');

function insertUsers(database) {
  const insert = database.prepare(`
    INSERT INTO users (id, name, email, password_hash, role, created_at, updated_at)
    VALUES (?, ?, ?, 'hash', 'cliente', 1, 1)
  `);
  insert.run('user-1', 'Ana', 'ana@example.com');
  insert.run('user-2', 'Beto', 'beto@example.com');
}

function fixedItem(overrides = {}) {
  return {
    id: 'item-1',
    catalogPriceId: 'sign-rect:acrylic:100x50:sign-rect-qty-2',
    productId: 'sign-rect',
    materialId: 'acrylic',
    sizeId: '100x50',
    quantityId: 'sign-rect-qty-2',
    productLabel: 'Letrero rectangular',
    materialLabel: 'Acrílico',
    sizeLabel: '100 × 50 cm',
    quantityLabel: '2 unidades',
    quantityValue: 2,
    observation: 'Con terminación mate',
    estimatedSubtotal: 64000,
    requiresEvaluation: false,
    extras: [
      { id: 'installation', label: 'Instalación', unitPrice: 6000 },
      { id: 'lighting', label: 'Iluminación', unitPrice: 8000 },
    ],
    ...overrides,
  };
}

async function withRepository(callback) {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'publitex-quotes-'));
  const filename = path.join(directory, 'quotes.sqlite');
  let database = openDatabase({ filename });
  migrateDatabase({ database });
  insertUsers(database);
  let timestamp = 1000;
  const makeRepository = () => createQuoteRepository({ database, now: () => timestamp++ });

  try {
    await callback({
      get database() { return database; },
      makeRepository,
      reopen() {
        database.close();
        database = openDatabase({ filename });
      },
    });
  } finally {
    if (database.isOpen) database.close();
    fs.rmSync(directory, { recursive: true, force: true });
  }
}

test('crea, lista y recupera un borrador como objetos planos después de reabrir SQLite', async () => {
  await withRepository(async (fixture) => {
    const quotes = fixture.makeRepository();
    assert.deepEqual(await quotes.createDraft({ id: 'quote-1', userId: 'user-1' }), {
      id: 'quote-1', code: 'COT-000001', status: 'draft', phone: null, company: null,
      workName: '',
      invoiceNumber: null, invoicedAt: null, paymentDueAt: null,
      events: [{ actorId: 'user-1', effectiveRole: 'cliente', status: 'draft', createdAt: 1000 }],
      estimatedTotal: 0, hasEvaluation: false,
      createdAt: 1000, updatedAt: 1000, submittedAt: null, items: [],
    });

    fixture.reopen();
    const reopened = fixture.makeRepository();
    const listed = await reopened.listByUser('user-1');
    assert.equal(Object.getPrototypeOf(listed[0]), Object.prototype);
    assert.deepEqual(listed, [await reopened.findOwned('quote-1', 'user-1')]);
  });
});

test('guarda detalles e items ordenados con extras y recalcula los agregados', async () => {
  await withRepository(async ({ makeRepository }) => {
    const quotes = makeRepository();
    await quotes.createDraft({ id: 'quote-1', userId: 'user-1' });
    await quotes.saveDetails({ id: 'quote-1', userId: 'user-1', phone: '+56 9 1234 5678', company: 'ACME' });
    await quotes.addItem({ quoteId: 'quote-1', userId: 'user-1', item: fixedItem() });
    await quotes.addItem({
      quoteId: 'quote-1', userId: 'user-1',
      item: fixedItem({
        id: 'item-2',
        catalogPriceId: 'vehicle-wrap:vehicle-car:coverage-partial:vehicle-wrap-qty-1',
        productId: 'vehicle-wrap', materialId: 'vehicle-car', sizeId: 'coverage-partial',
        quantityId: 'vehicle-wrap-qty-1', productLabel: 'Rotulación vehicular',
        materialLabel: 'Automóvil', sizeLabel: 'Cobertura parcial', quantityLabel: '1 vehículo',
        quantityValue: 1, observation: '', estimatedSubtotal: null,
        requiresEvaluation: true, extras: [],
      }),
    });

    const quote = await quotes.findOwned('quote-1', 'user-1');
    assert.equal(quote.phone, '+56 9 1234 5678');
    assert.equal(quote.company, 'ACME');
    assert.equal(quote.estimatedTotal, 64000);
    assert.equal(quote.hasEvaluation, true);
    assert.deepEqual(quote.items.map((item) => item.id), ['item-1', 'item-2']);
    assert.deepEqual(quote.items[0].extras, fixedItem().extras);
  });
});

test('actualiza y elimina items recalculando el total', async () => {
  await withRepository(async ({ makeRepository }) => {
    const quotes = makeRepository();
    await quotes.createDraft({ id: 'quote-1', userId: 'user-1' });
    await quotes.addItem({ quoteId: 'quote-1', userId: 'user-1', item: fixedItem() });

    await quotes.updateItem({
      quoteId: 'quote-1', itemId: 'item-1', userId: 'user-1',
      item: fixedItem({ estimatedSubtotal: 70000, observation: 'Actualizada' }),
    });
    assert.equal((await quotes.findOwned('quote-1', 'user-1')).estimatedTotal, 70000);

    await quotes.deleteItem({ quoteId: 'quote-1', itemId: 'item-1', userId: 'user-1' });
    const quote = await quotes.findOwned('quote-1', 'user-1');
    assert.equal(quote.estimatedTotal, 0);
    assert.deepEqual(quote.items, []);
  });
});

test('aplica el propietario real a todas las lecturas y mutaciones', async () => {
  await withRepository(async ({ makeRepository }) => {
    const quotes = makeRepository();
    await quotes.createDraft({ id: 'quote-1', userId: 'user-1' });
    await quotes.addItem({ quoteId: 'quote-1', userId: 'user-1', item: fixedItem() });

    assert.equal(await quotes.findOwned('quote-1', 'user-2'), null);
    assert.deepEqual(await quotes.listByUser('user-2'), []);
    assert.equal(await quotes.saveDetails({ id: 'quote-1', userId: 'user-2', phone: 'otro', company: 'otra' }), null);
    assert.equal(await quotes.updateItem({ quoteId: 'quote-1', itemId: 'item-1', userId: 'user-2', item: fixedItem() }), null);
    assert.equal(await quotes.deleteItem({ quoteId: 'quote-1', itemId: 'item-1', userId: 'user-2' }), null);

    const owned = await quotes.findOwned('quote-1', 'user-1');
    assert.equal(owned.phone, null);
    assert.equal(owned.items.length, 1);
  });
});

test('envía el borrador transaccionalmente y bloquea todas las mutaciones posteriores', async () => {
  await withRepository(async ({ makeRepository }) => {
    const quotes = makeRepository();
    await quotes.createDraft({ id: 'quote-1', userId: 'user-1' });
    await quotes.addItem({ quoteId: 'quote-1', userId: 'user-1', item: fixedItem() });

    const submitted = await quotes.submit({ id: 'quote-1', userId: 'user-1' });
    assert.equal(submitted.status, 'submitted');
    assert.equal(typeof submitted.submittedAt, 'number');

    const operations = [
      () => quotes.saveDetails({ id: 'quote-1', userId: 'user-1', phone: '1', company: '' }),
      () => quotes.addItem({ quoteId: 'quote-1', userId: 'user-1', item: fixedItem({ id: 'item-2' }) }),
      () => quotes.updateItem({ quoteId: 'quote-1', itemId: 'item-1', userId: 'user-1', item: fixedItem() }),
      () => quotes.deleteItem({ quoteId: 'quote-1', itemId: 'item-1', userId: 'user-1' }),
    ];
    for (const operation of operations) {
      await assert.rejects(operation, { code: 'QUOTE_NOT_EDITABLE' });
    }
    await assert.rejects(
      () => quotes.deleteDraft({ id: 'quote-1', userId: 'user-1' }),
      { code: 'QUOTE_NOT_EDITABLE' },
    );
  });
});

test('elimina solo borradores del propietario y conserva el historial de otros usuarios', async () => {
  await withRepository(async ({ makeRepository }) => {
    const quotes = makeRepository();
    await quotes.createDraft({ id: 'quote-1', userId: 'user-1' });
    await quotes.createDraft({ id: 'quote-2', userId: 'user-2' });
    assert.equal(await quotes.deleteDraft({ id: 'quote-1', userId: 'user-2' }), null);
    assert.deepEqual(await quotes.deleteDraft({ id: 'quote-1', userId: 'user-1' }), { deleted: true });
    assert.equal(await quotes.findOwned('quote-1', 'user-1'), null);
    assert.ok(await quotes.findOwned('quote-2', 'user-2'));
  });
});

test('guarda el nombre del trabajo en el borrador del propietario y permite su edición por el equipo', async () => {
  await withRepository(async ({ makeRepository }) => {
    const quotes = makeRepository();
    await quotes.createDraft({ id: 'quote-1', userId: 'user-1' });
    const named = await quotes.saveWorkName({ id: 'quote-1', userId: 'user-1', workName: 'Trabajo Quijote' });
    assert.equal(named.workName, 'Trabajo Quijote');
    assert.equal(await quotes.saveWorkName({ id: 'quote-1', userId: 'user-2', workName: 'Ajeno' }), null);
    await quotes.submit({ id: 'quote-1', userId: 'user-1' });
    await assert.rejects(() => quotes.saveWorkName({ id: 'quote-1', userId: 'user-1', workName: 'Tarde' }), { code: 'QUOTE_NOT_EDITABLE' });
    assert.equal((await quotes.saveWorkNameForTeam({ id: 'quote-1', workName: 'Trabajo final' })).workName, 'Trabajo final');
  });
});


test('asigna códigos únicos permanentes y ordena el historial por creación', async () => {
  await withRepository(async (fixture) => {
    let quotes = fixture.makeRepository();
    const first = await quotes.createDraft({ id: 'quote-1', userId: 'user-1' });
    const second = await quotes.createDraft({ id: 'quote-2', userId: 'user-1' });
    const other = await quotes.createDraft({ id: 'quote-3', userId: 'user-2' });
    assert.deepEqual([first.code, second.code, other.code], ['COT-000001', 'COT-000002', 'COT-000003']);
    await quotes.saveDetails({ id: first.id, userId: 'user-1', phone: '912345678', company: '' });
    fixture.reopen();
    quotes = fixture.makeRepository();
    assert.deepEqual((await quotes.listByUser('user-1')).map((quote) => quote.code), ['COT-000002', 'COT-000001']);
    assert.equal(await quotes.findOwned(other.id, 'user-1'), null);
    assert.equal((await quotes.createDraft({ id: 'quote-4', userId: 'user-1' })).code, 'COT-000004');
  });
});
