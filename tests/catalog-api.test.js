const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { createRuntime } = require('../server/server');

async function withCatalogServer(callback) {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'publitex-catalog-api-'));
  const runtime = createRuntime({
    databaseFilename: path.join(directory, 'catalog.sqlite'),
    env: {},
    bootstrapUsers: async () => {},
    loginLimiter: (_request, _response, next) => next(),
  });
  const server = runtime.app.listen(0, '127.0.0.1');
  await Promise.all([
    runtime.ready,
    new Promise((resolve) => server.once('listening', resolve)),
  ]);
  const { port } = server.address();

  try {
    await callback({ baseUrl: `http://127.0.0.1:${port}`, runtime });
  } finally {
    await new Promise((resolve, reject) => {
      server.close((error) => error ? reject(error) : resolve());
    });
    runtime.close();
    fs.rmSync(directory, { recursive: true, force: true });
  }
}

test('expone el catálogo activo sin exigir una sesión', async () => {
  await withCatalogServer(async ({ baseUrl, runtime }) => {
    const response = await fetch(`${baseUrl}/api/catalog`);

    assert.equal(response.status, 200);
    const body = await response.json();
    assert.equal(body.categories.length, 7);
    assert.equal(body.categories.flatMap((category) => category.offerings).length, 37);
    assert.ok(runtime.catalogRepository);
    assert.ok(runtime.catalogService);
  });
});

test('calcula la estimación pública sin escribir en SQLite e ignora un precio recibido', async () => {
  await withCatalogServer(async ({ baseUrl, runtime }) => {
    const changesBefore = runtime.database.prepare('SELECT total_changes() AS count').get().count;
    const response = await fetch(`${baseUrl}/api/catalog/estimate`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        offeringId: 'letrero-1-faz', quantity: 2,
        estimatedTotal: 1,
      }),
    });

    assert.equal(response.status, 200);
    const body = await response.json();
    assert.equal(body.estimatedTotal, 270000);
    assert.equal(body.selection.estimatedTotal, undefined);
    assert.equal(runtime.database.prepare('SELECT total_changes() AS count').get().count, changesBefore);
  });
});

test('rechaza con 400 una combinación incompatible sin filtrar detalles internos', async () => {
  await withCatalogServer(async ({ baseUrl }) => {
    const response = await fetch(`${baseUrl}/api/catalog/estimate`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        productId: 'sign-rect',
        materialId: 'vinyl-white',
        sizeId: '50x30',
        quantityId: 'sign-rect-qty-1',
        extraIds: [],
      }),
    });

    assert.equal(response.status, 400);
    assert.deepEqual(await response.json(), {
      error: 'La selección del catálogo no es válida.',
    });
  });
});

test('mantiene el error JSON común para una estimación malformada', async () => {
  await withCatalogServer(async ({ baseUrl }) => {
    const response = await fetch(`${baseUrl}/api/catalog/estimate`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: '{"productId":',
    });

    assert.equal(response.status, 400);
    assert.deepEqual(await response.json(), {
      error: 'La solicitud JSON no es válida.',
    });
  });
});
