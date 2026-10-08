const test = require('node:test');
const assert = require('node:assert/strict');
const { createApp } = require('../server/app');

async function withServer(app, callback) {
  const server = app.listen(0, '127.0.0.1');
  await new Promise((resolve) => server.once('listening', resolve));
  const { port } = server.address();
  try {
    await callback(`http://127.0.0.1:${port}`);
  } finally {
    await new Promise((resolve, reject) => server.close((error) => error ? reject(error) : resolve()));
  }
}

test('sirve la página pública existente', async () => {
  await withServer(createApp(), async (baseUrl) => {
    const response = await fetch(`${baseUrl}/`);
    assert.equal(response.status, 200);
    assert.match(await response.text(), /<title>Publitex \| Publicidad visual<\/title>/i);
  });
});

test('responde JSON uniforme para una ruta API inexistente', async () => {
  await withServer(createApp(), async (baseUrl) => {
    const response = await fetch(`${baseUrl}/api/no-existe`);
    assert.equal(response.status, 404);
    assert.deepEqual(await response.json(), { error: 'Recurso no encontrado.' });
  });
});
