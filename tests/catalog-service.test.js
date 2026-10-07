const test = require('node:test');
const assert = require('node:assert/strict');
const { createCatalogRepository } = require('../server/catalog/catalog-repository');
const { createCatalogService } = require('../server/catalog/catalog-service');
const { withTestDatabase } = require('./database-helper');

function createService(database) {
  return createCatalogService({ catalog: createCatalogRepository({ database }) });
}

test('publica las 37 ofertas comerciales agrupadas y corrige letrero de una faz', async () => {
  await withTestDatabase(async ({ database }) => {
    const result = await createService(database).getCatalog();
    assert.deepEqual(result.categories.map((category) => category.label), [
      'Impresiones', 'Pintura de fachada', 'Bastidores', 'Letreros luminosos',
      'Toldos', 'Vinilo para ventanas', 'Otros',
    ]);
    const offerings = result.categories.flatMap((category) => category.offerings);
    assert.equal(offerings.length, 37);
    assert.deepEqual(offerings.find((offering) => offering.label === 'Letrero 1 faz'), {
      id: 'letrero-1-faz', label: 'Letrero 1 faz', unit: 'M2', unitPrice: 135000,
    });
  });
});

test('calcula ofertas comerciales por M2, ML y UN sin confiar en el precio cliente', async () => {
  await withTestDatabase(async ({ database }) => {
    const service = createService(database);
    assert.equal((await service.estimate({ offeringId: 'tela-pvc-impresa', quantity: 2.5, unitPrice: 1 })).estimatedTotal, 26250);
    assert.equal((await service.estimate({ offeringId: 'cenefa-personalizada', quantity: 3, unitPrice: 1 })).estimatedTotal, 14700);
    assert.equal((await service.estimate({ offeringId: 'pendon-rollers', quantity: 2, unitPrice: 1 })).estimatedTotal, 96000);
    await assert.rejects(service.estimate({ offeringId: 'pendon-rollers', quantity: 1.5 }), { code: 'INVALID_CATALOG_SELECTION' });
  });
});

test('publica el catálogo comercial bajo la clave categories', async () => {
  await withTestDatabase(async ({ database }) => {
    const result = await createService(database).getCatalog();

    assert.equal(result.categories.length, 7);
  });
});

test('calcula una estimación fija desde SQLite e ignora un total recibido', async () => {
  await withTestDatabase(async ({ database }) => {
    const result = await createService(database).estimate({
      productId: 'sign-rect',
      materialId: 'acrylic',
      sizeId: '100x50',
      quantityId: 'sign-rect-qty-2',
      extraIds: ['lighting', 'installation', 'lighting'],
      estimatedTotal: 1,
    });

    assert.deepEqual(result, {
      selection: {
        productId: 'sign-rect',
        materialId: 'acrylic',
        sizeId: '100x50',
        quantityId: 'sign-rect-qty-2',
        extraIds: ['installation', 'lighting'],
      },
      summary: {
        product: 'Letrero rectangular',
        material: 'Acrílico',
        size: '100 × 50 cm',
        quantity: '2 unidades',
        extras: ['Instalación', 'Iluminación'],
      },
      estimatedTotal: 64000,
      requiresEvaluation: false,
    });
  });
});

test('multiplica el precio unitario exactamente una vez por la cantidad seleccionada', async () => {
  await withTestDatabase(async ({ database }) => {
    const result = await createService(database).estimate({
      productId: 'sign-rect',
      materialId: 'pvc-foam',
      sizeId: '50x30',
      quantityId: 'sign-rect-qty-5',
      extraIds: [],
    });

    assert.equal(result.estimatedTotal, 75000);
    assert.equal(result.requiresEvaluation, false);
  });
});

test('devuelve evaluación para rotulación vehicular sin inventar un precio', async () => {
  await withTestDatabase(async ({ database }) => {
    const result = await createService(database).estimate({
      productId: 'vehicle-wrap',
      materialId: 'vehicle-car',
      sizeId: 'coverage-partial',
      quantityId: 'vehicle-wrap-qty-1',
      extraIds: [],
    });

    assert.equal(result.estimatedTotal, null);
    assert.equal(result.requiresEvaluation, true);
  });
});

test('rechaza una configuración fija cuyo precio base no está definido', async () => {
  await withTestDatabase(async ({ database }) => {
    database.prepare(`
      UPDATE catalog_prices
      SET base_price = NULL
      WHERE id = 'sign-rect:pvc-foam:50x30:sign-rect-qty-1'
    `).run();

    await assert.rejects(
      createService(database).estimate({
        productId: 'sign-rect',
        materialId: 'pvc-foam',
        sizeId: '50x30',
        quantityId: 'sign-rect-qty-1',
        extraIds: [],
      }),
      { code: 'INVALID_CATALOG_SELECTION', message: 'La selección del catálogo no es válida.' },
    );
  });
});

test('rechaza una selección incompatible sin exponer detalles de SQLite', async () => {
  await withTestDatabase(async ({ database }) => {
    await assert.rejects(
      createService(database).estimate({
        productId: 'sign-rect',
        materialId: 'vinyl-white',
        sizeId: '50x30',
        quantityId: 'sign-rect-qty-1',
        extraIds: [],
      }),
      { code: 'INVALID_CATALOG_SELECTION', message: 'La selección del catálogo no es válida.' },
    );
  });
});
