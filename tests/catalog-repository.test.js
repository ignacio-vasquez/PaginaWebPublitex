const test = require('node:test');
const assert = require('node:assert/strict');
const { createCatalogRepository } = require('../server/catalog/catalog-repository');
const { withTestDatabase } = require('./database-helper');

test('expone solo opciones activas, compatibles y sin columnas internas de precio', async () => {
  await withTestDatabase(async ({ database }) => {
    database.prepare("UPDATE catalog_products SET active = 0 WHERE id = 'banner'").run();
    database.prepare("UPDATE catalog_materials SET active = 0 WHERE id = 'acrylic'").run();
    database.prepare("UPDATE catalog_sizes SET active = 0 WHERE id = 'a4'").run();
    database.prepare("UPDATE catalog_extras SET active = 0 WHERE id = 'lighting'").run();
    const catalog = createCatalogRepository({ database });

    const products = await catalog.listActive();

    assert.deepEqual(products.map((product) => product.id), [
      'sign-rect', 'sticker-print', 'vehicle-wrap',
    ]);
    assert.deepEqual(products[0], {
      id: 'sign-rect',
      label: 'Letrero rectangular',
      calculationType: 'fixed',
      materials: [
        { id: 'pvc-foam', label: 'PVC espumado' },
        { id: 'aluminium-composite', label: 'Aluminio compuesto' },
      ],
      sizes: [
        { id: '50x30', label: '50 × 30 cm' },
        { id: '100x50', label: '100 × 50 cm' },
        { id: '150x75', label: '150 × 75 cm' },
      ],
      quantities: [
        { id: 'sign-rect-qty-1', label: '1 unidad', quantity: 1 },
        { id: 'sign-rect-qty-2', label: '2 unidades', quantity: 2 },
        { id: 'sign-rect-qty-5', label: '5 unidades', quantity: 5 },
      ],
      extras: [{ id: 'installation', label: 'Instalación' }],
    });
    assert.deepEqual(products[1].sizes.map((size) => size.id), ['50x50', '100x100']);
    assert.equal(Object.getPrototypeOf(products[0]), Object.prototype);
    assert.equal(JSON.stringify(products).includes('basePrice'), false);
    assert.equal(JSON.stringify(products).includes('unitPrice'), false);
  });
});

test('resuelve una configuración activa y canónica, y rechaza material de otro producto', async () => {
  await withTestDatabase(async ({ database }) => {
    const catalog = createCatalogRepository({ database });

    const configuration = await catalog.findConfiguration({
      productId: 'sign-rect',
      materialId: 'acrylic',
      sizeId: '100x50',
      quantityId: 'sign-rect-qty-2',
      extraIds: ['lighting', 'installation', 'lighting'],
    });

    assert.deepEqual(configuration, {
      catalogPriceId: 'sign-rect:acrylic:100x50:sign-rect-qty-2',
      product: { id: 'sign-rect', label: 'Letrero rectangular', calculationType: 'fixed' },
      material: { id: 'acrylic', label: 'Acrílico' },
      size: { id: '100x50', label: '100 × 50 cm' },
      quantity: { id: 'sign-rect-qty-2', label: '2 unidades', quantity: 2 },
      basePrice: 18000,
      extras: [
        { id: 'installation', label: 'Instalación', unitPrice: 6000 },
        { id: 'lighting', label: 'Iluminación', unitPrice: 8000 },
      ],
    });
    assert.equal(Object.getPrototypeOf(configuration), Object.prototype);
    assert.equal(await catalog.findConfiguration({
      productId: 'sign-rect',
      materialId: 'vinyl-white',
      sizeId: '100x50',
      quantityId: 'sign-rect-qty-2',
      extraIds: [],
    }), null);
  });
});

test('rechaza extras desactivados aunque su identificador pertenezca a la configuración', async () => {
  await withTestDatabase(async ({ database }) => {
    const catalog = createCatalogRepository({ database });
    database.prepare(`
      UPDATE catalog_price_extras
      SET active = 0
      WHERE catalog_price_id = 'sign-rect:pvc-foam:50x30:sign-rect-qty-1'
        AND extra_id = 'lighting'
    `).run();

    assert.equal(await catalog.findConfiguration({
      productId: 'sign-rect',
      materialId: 'pvc-foam',
      sizeId: '50x30',
      quantityId: 'sign-rect-qty-1',
      extraIds: ['lighting'],
    }), null);
  });
});
