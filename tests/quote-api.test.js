const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { createRuntime } = require('../server/server');

async function withQuoteServer(callback) {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'publitex-quote-api-'));
  const runtime = createRuntime({
    databaseFilename: path.join(directory, 'quotes.sqlite'), env: {},
    bootstrapUsers: async () => {},
    loginLimiter: (_request, _response, next) => next(),
    hashPassword: async (password) => `hash:${password}`,
    verifyPassword: async (password, hash) => hash === `hash:${password}`,
  });
  const server = runtime.app.listen(0, '127.0.0.1');
  await Promise.all([runtime.ready, new Promise((resolve) => server.once('listening', resolve))]);
  const baseUrl = `http://127.0.0.1:${server.address().port}`;
  try {
    await callback({ baseUrl, runtime });
  } finally {
    await new Promise((resolve, reject) => server.close((error) => error ? reject(error) : resolve()));
    runtime.close();
    fs.rmSync(directory, { recursive: true, force: true });
  }
}

async function register(baseUrl, name, email) {
  const response = await fetch(`${baseUrl}/api/auth/register`, {
    method: 'POST', headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ name, email, password: 'secreto1' }),
  });
  assert.equal(response.status, 201);
  return response.headers.get('set-cookie').split(';')[0];
}

function request(baseUrl, pathname, { method = 'GET', cookie, body } = {}) {
  const headers = {};
  if (cookie) headers.cookie = cookie;
  if (body !== undefined) headers['content-type'] = 'application/json';
  return fetch(`${baseUrl}${pathname}`, {
    method, headers, body: body === undefined ? undefined : JSON.stringify(body),
  });
}

const selection = {
  productId: 'sign-rect', materialId: 'acrylic', sizeId: '100x50',
  quantityId: 'sign-rect-qty-2', extraIds: ['installation', 'lighting'],
};

test('todos los endpoints de cotización exigen una sesión', async () => {
  await withQuoteServer(async ({ baseUrl }) => {
    const calls = [
      ['/api/quotes'], ['/api/quotes', { method: 'POST', body: {} }],
      ['/api/quotes/quote-1'], ['/api/quotes/quote-1', { method: 'PATCH', body: {} }],
      ['/api/quotes/quote-1/items', { method: 'POST', body: selection }],
      ['/api/quotes/quote-1/items/item-1', { method: 'PUT', body: selection }],
      ['/api/quotes/quote-1/items/item-1', { method: 'DELETE' }],
      ['/api/quotes/quote-1/submit', { method: 'POST', body: {} }],
    ];
    for (const [pathname, options] of calls) {
      const response = await request(baseUrl, pathname, options);
      assert.equal(response.status, 401, `${options?.method || 'GET'} ${pathname}`);
    }
  });
});

test('un cliente recibe 404 al consultar o modificar la cotización de otro', async () => {
  await withQuoteServer(async ({ baseUrl }) => {
    const cookieA = await register(baseUrl, 'Ana', 'ana@example.com');
    const cookieB = await register(baseUrl, 'Beto', 'beto@example.com');
    const created = await request(baseUrl, '/api/quotes', { method: 'POST', cookie: cookieA, body: {} });
    const quote = await created.json();

    assert.equal((await request(baseUrl, `/api/quotes/${quote.id}`, { cookie: cookieB })).status, 404);
    assert.equal((await request(baseUrl, `/api/quotes/${quote.id}`, {
      method: 'PATCH', cookie: cookieB, body: { phone: '+56 9 1111 1111', company: '' },
    })).status, 404);
  });
});

test('autosave devuelve el borrador completo y el envío lo vuelve inmutable', async () => {
  await withQuoteServer(async ({ baseUrl, runtime }) => {
    const cookie = await register(baseUrl, 'Ana', 'ana@example.com');
    assert.ok(runtime.quoteRepository);
    assert.ok(runtime.quoteService);

    const createdResponse = await request(baseUrl, '/api/quotes', { method: 'POST', cookie, body: {} });
    assert.equal(createdResponse.status, 201);
    const created = await createdResponse.json();

    const detailsResponse = await request(baseUrl, `/api/quotes/${created.id}`, {
      method: 'PATCH', cookie, body: { phone: ' +56 9 1234 5678 ', company: ' Publitex ' },
    });
    assert.equal(detailsResponse.status, 200);
    const details = await detailsResponse.json();
    assert.equal(details.phone, '+56 9 1234 5678');
    assert.equal(details.company, 'Publitex');
    assert.deepEqual(details.items, []);

    const itemResponse = await request(baseUrl, `/api/quotes/${created.id}/items`, {
      method: 'POST', cookie, body: { ...selection, observation: ' prueba ', estimatedTotal: 1 },
    });
    assert.equal(itemResponse.status, 201);
    const withItem = await itemResponse.json();
    assert.equal(withItem.estimatedTotal, 64000);
    assert.equal(withItem.items[0].observation, 'prueba');

    const submittedResponse = await request(baseUrl, `/api/quotes/${created.id}/submit`, {
      method: 'POST', cookie, body: {},
    });
    assert.equal(submittedResponse.status, 200);
    assert.equal((await submittedResponse.json()).status, 'submitted');

    const conflict = await request(baseUrl, `/api/quotes/${created.id}`, {
      method: 'PATCH', cookie, body: { phone: '+56 9 1111 1111', company: '' },
    });
    assert.equal(conflict.status, 409);
    assert.deepEqual(await conflict.json(), { error: 'La cotización ya no se puede editar.' });
  });
});

test('mapea datos inválidos a 400 y recursos inexistentes a 404', async () => {
  await withQuoteServer(async ({ baseUrl }) => {
    const cookie = await register(baseUrl, 'Ana', 'ana@example.com');
    const invalid = await request(baseUrl, '/api/quotes/no-existe', {
      method: 'PATCH', cookie, body: { phone: '123', company: '' },
    });
    assert.equal(invalid.status, 400);

    const missing = await request(baseUrl, '/api/quotes/no-existe', { cookie });
    assert.equal(missing.status, 404);
  });
});
