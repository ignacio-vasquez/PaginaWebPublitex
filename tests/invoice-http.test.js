const test = require('node:test');
const assert = require('node:assert/strict');
const { withTestDatabase } = require('./database-helper');
const { createRuntime } = require('../server/server');
const { invoiceFile } = require('./invoice-fixture');
const { openDatabase } = require('../server/database/database');

test('carga HTTP exige archivo y permisos, vista previa no factura y descarga persiste al reabrir', async () => {
  await withTestDatabase(async ({ database, filename }) => {
    const runtime = createRuntime({ database, env: {}, hashPassword: p => p, verifyPassword: (p, h) => p === h });
    await runtime.ready;
    const boss = await runtime.userService.createPrivilegedUser({ name: 'Jefe', email: 'boss@example.com', password: 'password', role: 'jefe' });
    const worker = await runtime.userService.createPrivilegedUser({ name: 'Trabajador', email: 'worker@example.com', password: 'password', role: 'trabajador' });
    const client = await runtime.userService.registerClient({ name: 'Cliente', email: 'client@example.com', password: 'password' });
    const cookies = {};
    for (const user of [boss, worker, client]) cookies[user.role] = `publitex_session=${(await runtime.authService.login({ email: user.email, password: 'password' })).token}`;
    database.prepare("INSERT INTO quotes (id,user_id,status,phone,created_at,updated_at,submitted_at) VALUES ('q',?,'submitted','912345678',1,1,1)").run(client.id);
    database.exec("INSERT INTO quote_workflow (quote_id,status) VALUES ('q','accepted')");
    const server = runtime.app.listen(0, '127.0.0.1');
    await new Promise((resolve, reject) => { server.once('listening', resolve); server.once('error', reject); });
    const base = `http://127.0.0.1:${server.address().port}/api/work/quotes/q`;
    const original = invoiceFile();
    const form = (buffer = original.buffer) => { const data = new FormData(); data.append('invoice', new Blob([buffer]), 'factura.xml'); return data; };
    const post = (suffix, cookie, body = form()) => fetch(base + suffix, { method: 'POST', headers: { ...(cookie ? { cookie } : {}), 'X-Invoice-Upload': '1' }, body });
    try {
      assert.equal((await post('/invoice', null)).status, 401);
      for (const role of ['cliente', 'trabajador']) assert.equal((await post('/invoice', cookies[role])).status, 403);
      assert.equal((await post('/invoice', cookies.jefe, new FormData())).status, 400);
      assert.equal((await post('/invoice', cookies.jefe, form(Buffer.alloc(5 * 1024 * 1024 + 1)))).status, 413);
      const preview = await post('/invoice/preview', cookies.jefe);
      assert.equal(preview.status, 200);
      assert.equal((await preview.json()).metadata.issueDate, '2024-10-26');
      assert.equal((await runtime.quoteRepository.findOwned('q', client.id)).status, 'accepted');
      const confirmed = form();
      confirmed.append('number', '23');
      confirmed.append('issueDate', '2024-10-26');
      confirmed.append('total', '11900');
      const saved = await post('/invoice', cookies.jefe, confirmed);
      assert.equal(saved.status, 201, await saved.clone().text());
      assert.equal((await saved.json()).invoiceNumber, '23');
      assert.equal((await post('/invoice', cookies.jefe)).status, 409);
      assert.equal((await fetch(base + '/invoice')).status, 401);
      assert.equal((await fetch(base + '/invoice', { headers: { cookie: cookies.cliente } })).status, 403);
      const download = await fetch(base + '/invoice', { headers: { cookie: cookies.jefe } });
      assert.equal(download.status, 200);
      assert.match(download.headers.get('content-disposition'), /^attachment/);
      assert.equal(download.headers.get('cache-control'), 'private, no-store');
      assert.deepEqual(Buffer.from(await download.arrayBuffer()), original.buffer);
      const reopened = openDatabase({ filename });
      try { assert.deepEqual(Buffer.from(reopened.prepare("SELECT content FROM quote_invoices WHERE quote_id='q'").get().content), original.buffer); }
      finally { reopened.close(); }
    } finally { await new Promise(resolve => server.close(resolve)); }
  });
});
