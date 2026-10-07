const test = require('node:test');
const assert = require('node:assert/strict');
const { withTestDatabase } = require('./database-helper');
const { createCatalogRepository } = require('../server/catalog/catalog-repository');
const { createCatalogService } = require('../server/catalog/catalog-service');
const { createQuoteRepository } = require('../server/quotes/quote-repository');
const { createQuoteService } = require('../server/quotes/quote-service');

function insertUser(database) {
  database.prepare(`
    INSERT INTO users (id, name, email, password_hash, role, created_at, updated_at)
    VALUES ('user-1', 'Ana', 'ana@example.com', 'hash', 'cliente', 1, 1)
  `).run();
}

function createService(database) {
  let nextId = 0;
  const catalogService = createCatalogService({
    catalog: createCatalogRepository({ database }),
  });
  const quotes = createQuoteRepository({ database, now: () => 1000 + nextId });
  return createQuoteService({
    quotes,
    catalogService,
    createId: () => ['quote-1', 'item-1', 'item-2', 'item-3'][nextId++],
  });
}

const signSelection = {
  productId: 'sign-rect',
  materialId: 'acrylic',
  sizeId: '100x50',
  quantityId: 'sign-rect-qty-2',
  extraIds: ['lighting', 'installation'],
};

test('guarda una oferta con cantidad decimal como instantánea sin alterar ítems heredados', async () => {
  await withTestDatabase(async ({ database }) => {
    insertUser(database);
    const service = createService(database);
    const draft = await service.createDraft('user-1');
    await service.addItem(draft.id, 'user-1', signSelection);
    const saved = await service.addItem(draft.id, 'user-1', {
      offeringId: 'tela-pvc-impresa', quantity: 2.5, observation: ' Fachada ', unitPrice: 1,
    });
    assert.equal(saved.items.length, 2);
    assert.deepEqual(Object.fromEntries(['id','offeringId','categoryLabel','unit','unitPrice','quantityValue','productLabel','observation','estimatedSubtotal','requiresEvaluation','isOffering'].map((key) => [key, saved.items[1][key]])), { id: 'item-2', offeringId: 'tela-pvc-impresa', categoryLabel: 'Impresiones', unit: 'M2', unitPrice: 10500, quantityValue: 2.5, productLabel: 'Tela PVC impresa (tinta UV), solo impresión', observation: 'Fachada', estimatedSubtotal: 26250, requiresEvaluation: false, isOffering: true });
    await assert.rejects(service.addItem(draft.id, 'user-1', { offeringId: 'pendon-rollers', quantity: 1.5 }), { code: 'INVALID_CATALOG_SELECTION' });
  });
});

test('crea un borrador, normaliza detalles y persiste un snapshot calculado por el servidor', async () => {
  await withTestDatabase(async ({ database }) => {
    insertUser(database);
    const service = createService(database);
    const draft = await service.createDraft('user-1');
    await service.saveDetails(draft.id, 'user-1', {
      phone: '  +56 9 1234 5678  ', company: '  Publitex  ',
    });
    const saved = await service.addItem(draft.id, 'user-1', {
      ...signSelection,
      observation: '  Terminación mate  ',
      estimatedTotal: 1,
    });

    assert.equal(saved.phone, '+56 9 1234 5678');
    assert.equal(saved.company, 'Publitex');
    assert.equal(saved.estimatedTotal, 64000);
    assert.deepEqual(saved.items[0], {
      id: 'item-1',
      catalogPriceId: 'sign-rect:acrylic:100x50:sign-rect-qty-2',
      productId: 'sign-rect', materialId: 'acrylic', sizeId: '100x50',
      quantityId: 'sign-rect-qty-2', productLabel: 'Letrero rectangular',
      materialLabel: 'Acrílico', sizeLabel: '100 × 50 cm', quantityLabel: '2 unidades',
      quantityValue: 2, observation: 'Terminación mate', estimatedSubtotal: 64000,
      requiresEvaluation: false,
      extras: [
        { id: 'installation', label: 'Instalación', unitPrice: 6000 },
        { id: 'lighting', label: 'Iluminación', unitPrice: 8000 },
      ],
    });
  });
});

test('admite varios productos y recalcula también al actualizar un item', async () => {
  await withTestDatabase(async ({ database }) => {
    insertUser(database);
    const service = createService(database);
    const draft = await service.createDraft('user-1');
    await service.addItem(draft.id, 'user-1', signSelection);
    const withTwo = await service.addItem(draft.id, 'user-1', {
      productId: 'vehicle-wrap', materialId: 'vehicle-car', sizeId: 'coverage-partial',
      quantityId: 'vehicle-wrap-qty-1', extraIds: [], observation: '',
    });
    assert.equal(withTwo.items.length, 2);
    assert.equal(withTwo.hasEvaluation, true);

    const updated = await service.updateItem(draft.id, 'item-1', 'user-1', {
      productId: 'sign-rect', materialId: 'pvc-foam', sizeId: '50x30',
      quantityId: 'sign-rect-qty-1', extraIds: [], observation: ' nueva ',
      estimatedTotal: 999999,
    });
    assert.equal(updated.estimatedTotal, 15000);
    assert.equal(updated.items[0].observation, 'nueva');
  });
});

test('rechaza teléfonos con menos de 8 o más de 15 dígitos', async () => {
  await withTestDatabase(async ({ database }) => {
    insertUser(database);
    const service = createService(database);
    const draft = await service.createDraft('user-1');

    await assert.rejects(
      service.saveDetails(draft.id, 'user-1', { phone: '123-4567', company: '' }),
      { code: 'INVALID_QUOTE' },
    );
    await assert.rejects(
      service.saveDetails(draft.id, 'user-1', { phone: '+56 1234 5678 9012 3456', company: '' }),
      { code: 'INVALID_QUOTE' },
    );
  });
});

test('rechaza el envío vacío o sin un teléfono válido', async () => {
  await withTestDatabase(async ({ database }) => {
    insertUser(database);
    const service = createService(database);
    const draft = await service.createDraft('user-1');

    await assert.rejects(service.submit(draft.id, 'user-1'), { code: 'QUOTE_EMPTY' });
    await service.addItem(draft.id, 'user-1', signSelection);
    await assert.rejects(service.submit(draft.id, 'user-1'), { code: 'INVALID_QUOTE' });
  });
});

test('envía un borrador válido y rechaza cualquier edición posterior', async () => {
  await withTestDatabase(async ({ database }) => {
    insertUser(database);
    const service = createService(database);
    const draft = await service.createDraft('user-1');
    await service.saveDetails(draft.id, 'user-1', { phone: '+56 9 1234 5678', company: '' });
    await service.addItem(draft.id, 'user-1', signSelection);
    const submitted = await service.submit(draft.id, 'user-1');
    assert.equal(submitted.status, 'submitted');

    await assert.rejects(
      service.saveDetails(draft.id, 'user-1', { phone: '+56 9 1111 1111', company: '' }),
      { code: 'QUOTE_NOT_EDITABLE' },
    );
  });
});


test('acepta un teléfono local de nueve dígitos al guardar y enviar', async () => {
  await withTestDatabase(async ({ database }) => {
    insertUser(database);
    const service = createService(database);
    const draft = await service.createDraft('user-1');
    await service.addItem(draft.id, 'user-1', signSelection);
    await service.saveDetails(draft.id, 'user-1', { phone: '912345678', company: '' });
    const submitted = await service.submit(draft.id, 'user-1');
    assert.equal(submitted.phone, '912345678');
    assert.equal(submitted.status, 'submitted');
  });
});

test('elimina borradores y rechaza eliminar cotizaciones enviadas', async () => {
  await withTestDatabase(async ({ database }) => {
    insertUser(database);
    const service = createService(database);
    const draft = await service.createDraft('user-1');
    assert.deepEqual(await service.deleteDraft(draft.id, 'user-1'), { deleted: true });
    const submitted = await service.createDraft('user-1');
    await service.addItem(submitted.id, 'user-1', signSelection);
    await service.saveDetails(submitted.id, 'user-1', { phone: '912345678', company: '' });
    await service.submit(submitted.id, 'user-1');
    await assert.rejects(service.deleteDraft(submitted.id, 'user-1'), { code: 'QUOTE_NOT_EDITABLE' });
  });
});
