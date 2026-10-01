const test = require('node:test');
const assert = require('node:assert/strict');
const { withTestDatabase } = require('./database-helper');
const { createRuntime } = require('../server/server');

async function fixture(callback) {
  await withTestDatabase(async ({ database }) => {
    const runtime = createRuntime({ database, env: {}, hashPassword: (value) => value, verifyPassword: (value, hash) => value === hash });
    await runtime.ready;
    const boss = await runtime.userService.createPrivilegedUser({ name: 'Jefe', email: 'boss-http@example.com', password: 'password', role: 'jefe' });
    const worker = await runtime.userService.createPrivilegedUser({ name: 'Trabajador', email: 'worker-http@example.com', password: 'password', role: 'trabajador' });
    const client = await runtime.userService.registerClient({ name: 'Cliente', email: 'client-http@example.com', password: 'password' });
    const other = await runtime.userService.registerClient({ name: 'Otro', email: 'other-http@example.com', password: 'password' });
    const cookies = {};
    for (const user of [boss, worker, client, other]) {
      const session = await runtime.authService.login({ email: user.email, password: 'password' });
      cookies[user.role === 'cliente' ? user.id : user.role] = `publitex_session=${session.token}`;
    }
    const insert = database.prepare(`INSERT INTO quotes (id,user_id,status,phone,created_at,updated_at,submitted_at)
      VALUES (? ,?,'submitted','912345678',1,1,1)`);
    insert.run('q', client.id);
    insert.run('q-other', other.id);
    database.exec("INSERT INTO quote_workflow (quote_id,status) VALUES ('q','accepted'),('q-other','accepted')");
    const server = runtime.app.listen(0, '127.0.0.1');
    await new Promise((resolve, reject) => { server.once('listening', resolve); server.once('error', reject); });
    const base = `http://127.0.0.1:${server.address().port}`;
    try { await callback({ base, runtime, database, cookies, client, worker, other }); }
    finally { await new Promise((resolve) => server.close(resolve)); runtime.close(); }
  });
}

function pdfForm(filename = 'presupuesto.pdf', bytes = Buffer.from('%PDF-1.7\nfile')) {
  const form = new FormData();
  form.append('file', new Blob([bytes], { type: 'application/pdf' }), filename);
  return form;
}

test('jefe uploads and downloads an attachment', async () => fixture(async ({ base, cookies }) => {
  const path = '/api/quotes/q/attachments/invoice_backup';
  const uploaded = await fetch(base + path, { method: 'PUT', headers: { cookie: cookies.jefe }, body: pdfForm('respaldo.pdf') });
  assert.equal(uploaded.status, 200);
  assert.equal((await uploaded.json()).filename, 'respaldo.pdf');
  const download = await fetch(base + path, { headers: { cookie: cookies.jefe } });
  assert.equal(download.status, 200);
  assert.match(download.headers.get('content-disposition'), /^attachment/);
  assert.equal(download.headers.get('cache-control'), 'private, no-store');
  assert.equal(download.headers.get('x-content-type-options'), 'nosniff');
  assert.match(await download.text(), /^%PDF-/);
}));

test('owner downloads an accepted quote attachment', async () => fixture(async ({ base, cookies, client }) => {
  await fetch(`${base}/api/quotes/q/attachments/invoice_backup`, { method: 'PUT', headers: { cookie: cookies.jefe }, body: pdfForm() });
  const download = await fetch(`${base}/api/quotes/q/attachments/invoice_backup`, { headers: { cookie: cookies[client.id] } });
  assert.equal(download.status, 200);
  assert.equal(download.headers.get('cache-control'), 'private, no-store');
}));

test('worker downloads an accepted work attachment', async () => fixture(async ({ base, cookies }) => {
  await fetch(`${base}/api/quotes/q/attachments/invoice_backup`, { method: 'PUT', headers: { cookie: cookies.jefe }, body: pdfForm() });
  const download = await fetch(`${base}/api/quotes/q/attachments/invoice_backup`, { headers: { cookie: cookies.trabajador } });
  assert.equal(download.status, 200);
}));

test('client and worker cannot upload', async () => fixture(async ({ base, cookies, client }) => {
  for (const cookie of [cookies[client.id], cookies.trabajador]) {
    const result = await fetch(`${base}/api/quotes/q/attachments/invoice_backup`, { method: 'PUT', headers: { cookie }, body: pdfForm() });
    assert.equal(result.status, 403);
  }
}));

test('unrelated quote returns not found', async () => fixture(async ({ base, cookies, client }) => {
  const result = await fetch(`${base}/api/quotes/q-other/attachments`, { headers: { cookie: cookies[client.id] } });
  assert.equal(result.status, 404);
}));

test('oversize upload returns 413 with private download headers', async () => fixture(async ({ base, cookies }) => {
  const result = await fetch(`${base}/api/quotes/q/attachments/invoice_backup`, { method: 'PUT', headers: { cookie: cookies.jefe }, body: pdfForm('large.pdf', Buffer.alloc(10 * 1024 * 1024 + 1)) });
  assert.equal(result.status, 413);
  assert.match(result.headers.get('cache-control'), /no-store/);
}));
