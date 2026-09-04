const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { createRuntime } = require('../server/server');

function createIds(prefix) {
  let index = 0;
  return () => `${prefix}-${++index}`;
}

function options(databaseFilename, userIds, quoteIds, tokens) {
  return {
    databaseFilename,
    env: {},
    bootstrapUsers: async () => {},
    loginLimiter: (_request, _response, next) => next(),
    createId: userIds,
    createQuoteId: quoteIds,
    createToken: tokens,
    hashToken: (token) => `hash:${token}`,
    hashPassword: async (password) => `password:${password}`,
    verifyPassword: async (password, hash) => hash === `password:${password}`,
    now: () => 1_000,
  };
}

async function start(runtime) {
  const server = runtime.app.listen(0, '127.0.0.1');
  await Promise.all([runtime.ready, new Promise((resolve) => server.once('listening', resolve))]);
  return {
    baseUrl: `http://127.0.0.1:${server.address().port}`,
    close: () => new Promise((resolve, reject) => server.close((error) => {
      runtime.close();
      if (error) reject(error); else resolve();
    })),
  };
}

function request(baseUrl, pathname, { method = 'GET', cookie, body } = {}) {
  const headers = {};
  if (cookie) headers.cookie = cookie;
  if (body !== undefined) headers['content-type'] = 'application/json';
  return fetch(`${baseUrl}${pathname}`, {
    method,
    headers,
    body: body === undefined ? undefined : JSON.stringify(body),
  });
}

async function register(baseUrl, name, email) {
  const response = await request(baseUrl, '/api/auth/register', {
    method: 'POST', body: { name, email, password: 'secreto1' },
  });
  assert.equal(response.status, 201);
  return response.headers.get('set-cookie').split(';')[0];
}

test('conserva el recorrido público y privado tras reiniciar y aísla cada cliente', async () => {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'publitex-quote-journey-'));
  const filename = path.join(directory, 'journey.sqlite');
  const userIds = createIds('user');
  const quoteIds = createIds('entity');
  const tokens = createIds('token');
  let running;

  try {
    running = await start(createRuntime(options(filename, userIds, quoteIds, tokens)));

    const catalogResponse = await request(running.baseUrl, '/api/catalog');
    assert.equal(catalogResponse.status, 200);
    const catalog = await catalogResponse.json();
    assert.equal(catalog.products.length, 4);

    const firstSelection = {
      productId: 'sign-rect', materialId: 'acrylic', sizeId: '100x50',
      quantityId: 'sign-rect-qty-2', extraIds: ['installation', 'lighting'],
    };
    const estimateResponse = await request(running.baseUrl, '/api/catalog/estimate', {
      method: 'POST', body: firstSelection,
    });
    assert.equal(estimateResponse.status, 200);
    assert.equal((await estimateResponse.json()).estimatedTotal, 64000);

    const cookieA = await register(running.baseUrl, 'Ana', 'ana@example.com');
    const draftResponse = await request(running.baseUrl, '/api/quotes', {
      method: 'POST', cookie: cookieA, body: {},
    });
    assert.equal(draftResponse.status, 201);
    const draft = await draftResponse.json();

    const firstItem = await request(running.baseUrl, `/api/quotes/${draft.id}/items`, {
      method: 'POST', cookie: cookieA, body: { ...firstSelection, observation: 'Fachada principal' },
    });
    assert.equal(firstItem.status, 201);
    const secondItem = await request(running.baseUrl, `/api/quotes/${draft.id}/items`, {
      method: 'POST', cookie: cookieA,
      body: {
        productId: 'banner', materialId: 'canvas-standard', sizeId: '80x180',
        quantityId: 'banner-qty-1', extraIds: ['eyelets'], observation: 'Acceso',
      },
    });
    assert.equal(secondItem.status, 201);
    assert.equal((await secondItem.json()).items.length, 2);

    const saved = await request(running.baseUrl, `/api/quotes/${draft.id}`, {
      method: 'PATCH', cookie: cookieA,
      body: { phone: '+56 9 1234 5678', company: 'Publitex' },
    });
    assert.equal(saved.status, 200);

    await running.close();
    running = await start(createRuntime(options(filename, userIds, quoteIds, tokens)));

    const persistedResponse = await request(running.baseUrl, '/api/quotes', { cookie: cookieA });
    assert.equal(persistedResponse.status, 200);
    const [persisted] = await persistedResponse.json();
    assert.equal(persisted.id, draft.id);
    assert.equal(persisted.items.length, 2);
    assert.equal(persisted.phone, '+56 9 1234 5678');

    const submitted = await request(running.baseUrl, `/api/quotes/${draft.id}/submit`, {
      method: 'POST', cookie: cookieA, body: {},
    });
    assert.equal(submitted.status, 200);
    assert.equal((await submitted.json()).status, 'submitted');
    assert.equal((await request(running.baseUrl, `/api/quotes/${draft.id}`, {
      method: 'PATCH', cookie: cookieA, body: { phone: '+56 9 9999 9999', company: '' },
    })).status, 409);

    const cookieB = await register(running.baseUrl, 'Beto', 'beto@example.com');
    assert.equal((await request(running.baseUrl, `/api/quotes/${draft.id}`, { cookie: cookieB })).status, 404);
  } finally {
    if (running) await running.close().catch(() => {});
    fs.rmSync(directory, { recursive: true, force: true });
  }
});
