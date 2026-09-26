const test = require('node:test');
const assert = require('node:assert/strict');
const { withTestDatabase } = require('./database-helper');
const { createQuoteRepository } = require('../server/quotes/quote-repository');
const { createWorkflowService } = require('../server/quotes/workflow-service');
const { invoiceFile } = require('./invoice-fixture');

function setup(database) {
  for (const role of ['cliente', 'jefe', 'trabajador']) {
    database.prepare("INSERT INTO users (id,name,email,password_hash,role,created_at,updated_at) VALUES (?,?,?,'hash',?,1,1)")
      .run(role, role, `${role}@example.com`, role);
  }
  for (const id of ['q', 'other']) {
    database.prepare("INSERT INTO quotes (id,user_id,status,phone,created_at,updated_at,submitted_at) VALUES (?,'cliente','submitted','912345678',1,1,1)").run(id);
    database.prepare("INSERT INTO quote_workflow (quote_id,status) VALUES (?,'accepted')").run(id);
  }
  const quotes = createQuoteRepository({ database });
  const workflow = createWorkflowService({ database, quotes, now: () => 1800000000000 });
  return { quotes, workflow, boss: { user: { id: 'jefe', role: 'jefe' } }, client: { user: { id: 'cliente', role: 'cliente' } } };
}

test('no se puede facturar solo enviando un folio sin documento', async () => {
  await withTestDatabase(async ({ database }) => {
    const { workflow, boss, quotes } = setup(database);
    await assert.rejects(workflow.transition('q', boss, { status: 'invoiced', invoiceNumber: '23' }), { code: 'INVALID_INVOICE' });
    assert.equal((await quotes.findOwned('q', 'cliente')).status, 'accepted');
  });
});

test('XML factura la cotización con fecha real, conserva archivo y permite descargar tras entrega', async () => {
  await withTestDatabase(async ({ database }) => {
    const { workflow, boss } = setup(database);
    const file = invoiceFile();
    const quote = await workflow.attachInvoice('q', boss, file, { number: '999', issueDate: '2026-01-01', total: '1' });
    assert.equal(quote.status, 'invoiced');
    assert.equal(quote.invoiceNumber, '23');
    assert.equal(quote.invoice.issueDate, '2024-10-26');
    assert.equal(quote.invoice.total, 11900);
    assert.equal(quote.events.at(-1).createdAt, 1800000000000);
    await workflow.transition('q', boss, { status: 'in_production' });
    await workflow.transition('q', boss, { status: 'ready' });
    await workflow.transition('q', boss, { status: 'delivered' });
    assert.equal((await workflow.archived(boss))[0].invoice.issueDate, '2024-10-26');
    assert.deepEqual(Buffer.from(workflow.downloadInvoice('q', boss).content), file.buffer);
  });
});

test('duplicar un documento en otra cotización se rechaza sin facturar ni registrar eventos', async () => {
  await withTestDatabase(async ({ database }) => {
    const { workflow, boss, quotes } = setup(database);
    await workflow.attachInvoice('q', boss, invoiceFile());
    await assert.rejects(workflow.attachInvoice('other', boss, invoiceFile()), { code: 'DUPLICATE_INVOICE' });
    assert.equal((await quotes.findOwned('other', 'cliente')).status, 'accepted');
    assert.equal(database.prepare("SELECT COUNT(*) AS n FROM quote_events WHERE quote_id='other'").get().n, 0);
  });
});

test('adjunta facturas antiguas sin borrar cotizaciones ni alterar su estado de entrega', async () => {
  await withTestDatabase(async ({ database }) => {
    const { workflow, boss } = setup(database);
    database.exec("UPDATE quote_workflow SET status='delivered',invoice_number='23',invoiced_at=1,payment_due_at=2 WHERE quote_id='q'");
    const quote = await workflow.attachInvoice('q', boss, invoiceFile());
    assert.equal(quote.status, 'delivered');
    assert.equal(quote.events.length, 0);
    await assert.rejects(workflow.attachInvoice('q', boss, invoiceFile('24')), { code: 'INVALID_TRANSITION' });
  });
});

test('clientes no pueden adjuntar ni descargar facturas del equipo', async () => {
  await withTestDatabase(async ({ database }) => {
    const { workflow, boss, client } = setup(database);
    await assert.rejects(workflow.attachInvoice('q', client, invoiceFile()), { code: 'FORBIDDEN' });
    await workflow.attachInvoice('q', boss, invoiceFile());
    assert.throws(() => workflow.downloadInvoice('q', client), { code: 'FORBIDDEN' });
  });
});
