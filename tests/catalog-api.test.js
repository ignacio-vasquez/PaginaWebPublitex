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
    assert.deepEqual(body.products.map((product) => product.id), [
      'sign-rect', 'sticker-print', 'banner', 'vehicle-wrap',
    ]);
    assert.ok(runtime.catalogRepository);
    assert.ok(runtime.catalogService);
  });
});

test('calcula la estimación pública en el servidor e ignora un precio recibido', async () => {
  await withCatalogServer(async ({ baseUrl }) => {
    const response = await fetch(`${baseUrl}/api/catalog/estimate`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        productId: 'sign-rect',
        materialId: 'acrylic',
        sizeId: '100x50',
        quantityId: 'sign-rect-qty-2',
        extraIds: ['lighting', 'installation'],
        estimatedTotal: 1,
      }),
    });

    assert.equal(response.status, 200);
    const body = await response.json();
    assert.equal(body.estimatedTotal, 64000);
    assert.equal(body.selection.estimatedTotal, undefined);
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
