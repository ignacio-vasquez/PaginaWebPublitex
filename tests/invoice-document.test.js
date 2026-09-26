const test = require('node:test');
const assert = require('node:assert/strict');
const { PDFDocument } = require('pdf-lib');
const { inspectInvoice } = require('../server/quotes/invoice-document');
const { invoiceFile } = require('./invoice-fixture');

test('PDF válido requiere folio, fecha real y monto; el contenido no se deduce del nombre', async () => {
  const pdf = await PDFDocument.create();
  pdf.addPage();
  const file = { originalname: 'Factura-999-01-01-2000.pdf', buffer: Buffer.from(await pdf.save()) };
  assert.equal((await inspectInvoice(file, {}, false)).metadata, null);
  await assert.rejects(inspectInvoice(file), { code: 'INVALID_INVOICE' });
  await assert.rejects(inspectInvoice(file, { number: '23', issueDate: '2026-02-30', total: '11900' }), { code: 'INVALID_INVOICE' });
  const parsed = await inspectInvoice(file, { number: '23', issueDate: '2026-10-26', total: '11900' });
  assert.deepEqual(parsed.metadata, { number: '23', issueDate: '2026-10-26', total: 11900 });
});

test('XML envuelto del SII y Latin-1 conservan datos y rechazan lotes o documentos distintos', async () => {
  const raw = invoiceFile().buffer.toString().replace(/<\?xml[^>]+>/, '');
  const wrapped = text => ({ originalname: 'envio.xml', buffer: Buffer.from(`<EnvioDTE><SetDTE>${text}</SetDTE></EnvioDTE>`) });
  assert.equal((await inspectInvoice(wrapped(raw))).metadata.number, '23');
  await assert.rejects(inspectInvoice(wrapped(raw + raw)), { code: 'INVALID_INVOICE' });
  await assert.rejects(inspectInvoice(wrapped(raw.replace('<TipoDTE>33', '<TipoDTE>61'))), { code: 'INVALID_INVOICE' });
  const latin = '<?xml version="1.0" encoding="ISO-8859-1"?>' + raw.replace('Cliente de prueba', 'José Muñoz');
  assert.equal((await inspectInvoice({ originalname: 'factura.xml', buffer: Buffer.from(latin, 'latin1') })).metadata.receiverName, 'José Muñoz');
});

test('rechaza archivos vacíos, PDF falso, XML roto, entidades externas y tamaño excesivo', async () => {
  for (const file of [
    null, { originalname: 'factura.pdf', buffer: Buffer.from('no es pdf') },
    { originalname: 'factura.xml', buffer: Buffer.from('<DTE>') },
    { originalname: 'factura.xml', buffer: Buffer.from('<!DOCTYPE DTE [<!ENTITY secret SYSTEM "file:///etc/passwd">]><DTE>&secret;</DTE>') },
    { originalname: 'factura.xml', buffer: Buffer.alloc(5 * 1024 * 1024 + 1) },
  ]) await assert.rejects(inspectInvoice(file), { code: 'INVALID_INVOICE' });
});
