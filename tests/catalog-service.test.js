const test = require('node:test');
const assert = require('node:assert/strict');
const { createCatalogRepository } = require('../server/catalog/catalog-repository');
const { createCatalogService } = require('../server/catalog/catalog-service');
const { withTestDatabase } = require('./database-helper');

function createService(database) {
  return createCatalogService({ catalog: createCatalogRepository({ database }) });
}

test('publica el catálogo activo bajo la clave products', async () => {
  await withTestDatabase(async ({ database }) => {
    const result = await createService(database).getCatalog();

    assert.deepEqual(result.products.map((product) => product.id), [
      'sign-rect', 'sticker-print', 'banner', 'vehicle-wrap',
    ]);
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
