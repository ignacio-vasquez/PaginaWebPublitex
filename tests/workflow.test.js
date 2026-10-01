const test = require('node:test');
const assert = require('node:assert/strict');
const { withTestDatabase } = require('./database-helper');
const { createQuoteRepository } = require('../server/quotes/quote-repository');
const { createWorkflowService } = require('../server/quotes/workflow-service');
const { invoiceFile } = require('./invoice-fixture');

function setup(database) {
  const insert = database.prepare("INSERT INTO users (id,name,email,password_hash,role,created_at,updated_at) VALUES (?,?,?,'hash',?,1,1)");
  for (const [id, role] of [['client','cliente'],['boss','jefe'],['worker','trabajador'],['other','trabajador']]) {
    insert.run(id, id, `${id}@example.com`, role);
  }
  database.exec("INSERT INTO quotes (id,user_id,status,phone,created_at,updated_at,submitted_at) VALUES ('q','client','submitted','912345678',1,2,2)");
  const quotes = createQuoteRepository({ database });
  const workflow = createWorkflowService({ database, quotes, now: () => 1000 });
  const context = (id, role) => ({ user: {id,role}, realUser: {id,role}, simulation: null });
  return { quotes, workflow, boss: context('boss','jefe'), worker: context('worker','trabajador'), other: context('other','trabajador'), client: context('client','cliente') };
}

test('jefe factura y todos los trabajadores ven el trabajo; uno lo termina', async () => {
  await withTestDatabase(async ({ database }) => {
    const { quotes, workflow, boss, worker, other, client } = setup(database);
    assert.equal((await workflow.list(boss)).length, 1);
    assert.deepEqual(await workflow.list(worker), []);
    await assert.rejects(workflow.list(client), { code: 'FORBIDDEN' });
    assert.equal((await workflow.transition('q', boss, { status: 'in_review' })).status, 'in_review');
    const accepted = await workflow.transition('q', boss, { status: 'accepted' });
    assert.equal(accepted.status, 'accepted');
    assert.equal((await workflow.list(worker)).length, 1, 'los trabajadores ven trabajos aceptados para preparar archivos');
    await assert.rejects(workflow.transition('q', other, { status: 'ready' }), { code: 'INVALID_TRANSITION' });
    await assert.rejects(workflow.transition('q', worker, { status: 'delivered' }), { code: 'FORBIDDEN' });
    await assert.rejects(workflow.transition('q', boss, { status: 'invoiced' }), { code: 'INVALID_INVOICE' });
    const invoiced = await workflow.attachInvoice('q', boss, invoiceFile('123'));
    assert.equal(invoiced.status, 'invoiced');
    assert.equal(invoiced.invoiceNumber, '123');
    assert.equal(invoiced.invoicedAt, 1000);
    assert.equal(invoiced.paymentDueAt, 1000 + 30 * 24 * 60 * 60 * 1000);
    assert.equal((await workflow.list(worker)).length, 1);
    assert.equal((await workflow.list(other)).length, 1);
    await workflow.transition('q', worker, { status: 'ready' });
    const delivered = await workflow.transition('q', boss, { status: 'delivered' });
    assert.equal(delivered.status, 'delivered');
    assert.deepEqual(await workflow.list(boss), []);
    assert.deepEqual(await workflow.list(worker), []);
    await assert.rejects(workflow.archived(worker), { code: 'FORBIDDEN' });
    const archive = await workflow.archived(boss);
    assert.deepEqual(archive.map(row => row.code), [delivered.code]);
    assert.equal(archive[0].clientName, 'client');
    assert.equal(archive[0].clientEmail, 'client@example.com');
    assert.equal((await quotes.findOwned('q','client')).status, 'delivered');
    assert.deepEqual(delivered.events.map(({ status }) => status), ['in_review','accepted','invoiced','ready','delivered']);
    assert.deepEqual(delivered.events.map(({ effectiveRole }) => effectiveRole), ['jefe','jefe','jefe','trabajador','jefe']);
    assert.deepEqual(database.prepare('SELECT actor_id FROM quote_events ORDER BY id').all().map(({actor_id})=>actor_id), ['boss','boss','boss','worker','boss']);
  });
});

test('jefe puede tomar el trabajo, marcarlo listo y confirmar la entrega', async () => {
  await withTestDatabase(async ({ database }) => {
    const { workflow, boss } = setup(database);
    await workflow.transition('q', boss, { status: 'in_review' });
    await workflow.transition('q', boss, { status: 'accepted' });
    await workflow.attachInvoice('q', boss, invoiceFile('123'));

    const started = await workflow.transition('q', boss, { status: 'in_production' });
    assert.equal(started.status, 'in_production');
    const ready = await workflow.transition('q', boss, { status: 'ready' });
    assert.equal(ready.status, 'ready');
    const delivered = await workflow.transition('q', boss, { status: 'delivered' });
    assert.equal(delivered.status, 'delivered');
    assert.deepEqual(delivered.events.slice(-3).map(({ status, effectiveRole }) => [status, effectiveRole]), [
      ['in_production', 'jefe'], ['ready', 'jefe'], ['delivered', 'jefe'],
    ]);
  });
});

test('accept and deliver succeed without work attachments', async () => {
  await withTestDatabase(async ({ database }) => {
    const { workflow, boss, worker } = setup(database);
    assert.equal((await workflow.transition('q', boss, { status: 'in_review' })).status, 'in_review');
    assert.equal((await workflow.transition('q', boss, { status: 'accepted' })).status, 'accepted');
    await workflow.attachInvoice('q', boss, invoiceFile('123'));
    assert.equal((await workflow.transition('q', boss, { status: 'in_production' })).status, 'in_production');
    assert.equal((await workflow.transition('q', worker, { status: 'ready' })).status, 'ready');
    assert.equal((await workflow.transition('q', boss, { status: 'delivered' })).status, 'delivered');
  });
});

test('rechaza saltos, doble avance y cambios sobre borradores sin registrar eventos falsos', async () => {
  await withTestDatabase(async ({ database }) => {
    const { workflow, boss } = setup(database);
    await assert.rejects(workflow.transition('q', boss, { status: 'delivered' }), { code: 'INVALID_TRANSITION' });
    await workflow.transition('q', boss, { status: 'in_review' });
    await assert.rejects(workflow.transition('q', boss, { status: 'in_review' }), { code: 'INVALID_TRANSITION' });
    database.exec("INSERT INTO quotes (id,user_id,created_at,updated_at) VALUES ('draft','client',1,1)");
    assert.equal(await workflow.transition('draft', boss, { status: 'in_review' }), null);
    assert.equal(database.prepare('SELECT COUNT(*) AS n FROM quote_events').get().n, 1);
  });
});

test('archivo contiene solo entregadas y las ordena por fecha de factura', async () => {
  await withTestDatabase(async ({ database }) => {
    const { workflow, boss, worker } = setup(database);
    database.exec("INSERT INTO quotes (id,user_id,status,phone,created_at,updated_at,submitted_at) VALUES ('older','client','submitted','912345678',3,3,3)");
    database.exec("INSERT INTO quote_workflow (quote_id,status,invoice_number,invoiced_at,payment_due_at) VALUES ('older','delivered','F-1',100,200)");
    database.exec("INSERT INTO quote_workflow (quote_id,status,invoice_number,invoiced_at,payment_due_at) VALUES ('q','delivered','F-2',200,300)");
    const archive = await workflow.archived(boss);
    assert.deepEqual(archive.map(quote => quote.invoiceNumber), ['F-2', 'F-1']);
    assert.deepEqual(await workflow.list(boss), []);
    assert.deepEqual(await workflow.list(worker), []);
  });
});
