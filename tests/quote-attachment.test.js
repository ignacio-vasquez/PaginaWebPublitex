const test = require('node:test');
const assert = require('node:assert/strict');
const { deflateRawSync } = require('node:zlib');
const { withTestDatabase } = require('./database-helper');
const { createQuoteRepository } = require('../server/quotes/quote-repository');
const { createQuoteAttachmentService } = require('../server/quotes/attachment-service');

function zipFile(entries, compressedNames = []) {
  const locals = [];
  const centrals = [];
  let offset = 0;
  for (const [name, content] of Object.entries(entries)) {
    const filename = Buffer.from(name);
    const originalBody = Buffer.from(content);
    const compressed = compressedNames.includes(name);
    const body = compressed ? deflateRawSync(originalBody) : originalBody;
    const local = Buffer.alloc(30 + filename.length + body.length);
    local.writeUInt32LE(0x04034b50, 0);
    local.writeUInt16LE(20, 4);
    local.writeUInt32LE(0, 6);
    local.writeUInt16LE(compressed ? 8 : 0, 8);
    local.writeUInt32LE(body.length, 18);
    local.writeUInt32LE(originalBody.length, 22);
    local.writeUInt16LE(filename.length, 26);
    filename.copy(local, 30);
    body.copy(local, 30 + filename.length);
    locals.push(local);
    const central = Buffer.alloc(46 + filename.length);
    central.writeUInt32LE(0x02014b50, 0);
    central.writeUInt16LE(20, 4);
    central.writeUInt16LE(20, 6);
    central.writeUInt16LE(compressed ? 8 : 0, 10);
    central.writeUInt32LE(body.length, 20);
    central.writeUInt32LE(originalBody.length, 24);
    central.writeUInt16LE(filename.length, 28);
    central.writeUInt32LE(offset, 42);
    filename.copy(central, 46);
    centrals.push(central);
    offset += local.length;
  }
  const directory = Buffer.concat(centrals);
  const end = Buffer.alloc(22);
  end.writeUInt32LE(0x06054b50, 0);
  end.writeUInt16LE(Object.keys(entries).length, 8);
  end.writeUInt16LE(Object.keys(entries).length, 10);
  end.writeUInt32LE(directory.length, 12);
  end.writeUInt32LE(offset, 16);
  return Buffer.concat([...locals, directory, end]);
}

const files = {
  budget: { originalname: 'presupuesto.xlsx', buffer: zipFile({ '[Content_Types].xml': '<Types><Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/></Types>', 'xl/workbook.xml': '<workbook></workbook>' }) },
  invoice_backup: { originalname: 'respaldo.pdf', buffer: Buffer.from('%PDF-1.7\ncontenido') },
  preview: { originalname: 'montaje.jpg', buffer: Buffer.from([0xff, 0xd8, 0xff, 0xe0, 1, 2, 0xff, 0xd9]) },
  completion: { originalname: 'final.jpg', buffer: Buffer.from([0xff, 0xd8, 0xff, 0xe0, 3, 4, 0xff, 0xd9]) },
};

async function fixture(callback) {
  await withTestDatabase(async ({ database }) => {
    database.prepare(`INSERT INTO users (id,name,email,password_hash,role,created_at,updated_at)
      VALUES ('owner','Ana','ana@test.local','hash','cliente',0,0), ('boss','Jefe','boss@test.local','hash','jefe',0,0),
      ('worker','Trabajador','worker@test.local','hash','trabajador',0,0)`).run();
    const quotes = createQuoteRepository({ database, now: () => 100 });
    await quotes.createDraft({ id: 'quote-1', userId: 'owner' });
    database.prepare("UPDATE quotes SET status='submitted' WHERE id='quote-1'").run();
    database.prepare("INSERT INTO quote_workflow (quote_id,status) VALUES ('quote-1','accepted')").run();
    const service = createQuoteAttachmentService({ database, quotes, now: () => 500 });
    await callback({ database, service, quotes });
  });
}

test('accepts each matching attachment kind', async () => fixture(async ({ service }) => {
  for (const kind of Object.keys(files)) {
    const saved = await service.upload('quote-1', kind, { user: { id: 'boss', role: 'jefe' } }, files[kind]);
    assert.equal(saved.kind, kind);
    assert.equal(saved.uploadedAt, 500);
    assert.equal(saved.downloadUrl, `/api/quotes/quote-1/attachments/${kind}`);
  }
}));

test('rejects mismatched extension and signature, empty and oversized files', async () => fixture(async ({ service }) => {
  const boss = { user: { id: 'boss', role: 'jefe' } };
  await assert.rejects(service.upload('quote-1', 'invoice_backup', boss, { originalname: 'wrong.jpg', buffer: files.invoice_backup.buffer }), { code: 'INVALID_ATTACHMENT' });
  await assert.rejects(service.upload('quote-1', 'invoice_backup', boss, { originalname: 'bad.pdf', buffer: Buffer.from('not a pdf') }), { code: 'INVALID_ATTACHMENT' });
  await assert.rejects(service.upload('quote-1', 'preview', boss, { originalname: 'empty.jpg', buffer: Buffer.alloc(0) }), { code: 'INVALID_ATTACHMENT' });
  await assert.rejects(service.upload('quote-1', 'preview', boss, { originalname: 'large.jpg', buffer: Buffer.alloc(10485761) }), { code: 'INVALID_ATTACHMENT' });
}));

test('replacing an attachment preserves other kinds', async () => fixture(async ({ service }) => {
  const boss = { user: { id: 'boss', role: 'jefe' } };
  for (const kind of Object.keys(files)) await service.upload('quote-1', kind, boss, files[kind]);
  await service.upload('quote-1', 'preview', boss, { ...files.preview, originalname: 'new.jpg' });
  assert.deepEqual((await service.list('quote-1', boss)).map((file) => file.filename).sort(), ['final.jpg', 'new.jpg', 'presupuesto.xlsx', 'respaldo.pdf']);
}));

test('customer attachment access is limited to owned quotes', async () => fixture(async ({ service, database, quotes }) => {
  const boss = { user: { id: 'boss', role: 'jefe' } };
  await service.upload('quote-1', 'preview', boss, files.preview);
  await assert.rejects(service.list('quote-1', { user: { id: 'other', role: 'cliente' } }), { code: 'NOT_FOUND' });
  await assert.rejects(service.upload('quote-1', 'budget', { user: { id: 'owner', role: 'cliente' } }, files.budget), { code: 'FORBIDDEN' });
  assert.equal(database.prepare('SELECT COUNT(*) AS total FROM quote_invoices').get().total, 0);
  assert.ok(await quotes.findOwned('quote-1', 'owner'));
}));

test('backup invoice attachment does not change official invoice archive', async () => fixture(async ({ database, service }) => {
  await service.upload('quote-1', 'invoice_backup', { user: { id: 'boss', role: 'jefe' } }, files.invoice_backup);
  assert.equal(database.prepare('SELECT COUNT(*) AS total FROM quote_invoices').get().total, 0);
  assert.equal(database.prepare('SELECT status FROM quotes WHERE id=?').get('quote-1').status, 'submitted');
}));

test('client file visibility follows accepted and delivered stages', async () => fixture(async ({ service, database }) => {
  const boss = { user: { id: 'boss', role: 'jefe' } };
  const owner = { user: { id: 'owner', role: 'cliente' } };
  await service.upload('quote-1', 'preview', boss, files.preview);
  await service.upload('quote-1', 'completion', boss, files.completion);
  assert.deepEqual((await service.list('quote-1', owner)).map((file) => file.kind), ['preview']);
  await assert.rejects(service.download('quote-1', 'completion', owner), { code: 'NOT_FOUND' });
  database.prepare("UPDATE quote_workflow SET status='delivered' WHERE quote_id='quote-1'").run();
  assert.deepEqual((await service.list('quote-1', owner)).map((file) => file.kind).sort(), ['completion', 'preview']);
}));

test('client cannot read attachments before acceptance', async () => fixture(async ({ service, database }) => {
  database.prepare("UPDATE quote_workflow SET status='in_review' WHERE quote_id='quote-1'").run();
  await service.upload('quote-1', 'preview', { user: { id: 'boss', role: 'jefe' } }, files.preview);
  await assert.rejects(service.list('quote-1', { user: { id: 'owner', role: 'cliente' } }), { code: 'NOT_FOUND' });
}));

test('malformed XLSX without a valid ZIP directory or workbook is rejected', async () => fixture(async ({ service }) => {
  const boss = { user: { id: 'boss', role: 'jefe' } };
  const malformed = Buffer.concat([Buffer.from('PK\x03\x04'), Buffer.from('[Content_Types].xml xl/workbook.xml spreadsheetml.sheet.main+xml')]);
  await assert.rejects(service.upload('quote-1', 'budget', boss, { originalname: 'bad.xlsx', buffer: malformed }), { code: 'INVALID_ATTACHMENT' });
}));

test('XLSX requires a real workbook package root and matching content type', async () => fixture(async ({ service }) => {
  const malformed = zipFile({
    '[Content_Types].xml': '<html><Types><Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/></Types></html>',
    'xl/workbook.xml': '<html><workbook></workbook></html>',
  });
  await assert.rejects(service.upload('quote-1', 'budget', { user: { id: 'boss', role: 'jefe' } }, {
    originalname: 'fake.xlsx', buffer: malformed,
  }), { code: 'INVALID_ATTACHMENT' });
}));

test('compressed XLSX XML expansion is bounded', async () => fixture(async ({ service }) => {
  const xml = Buffer.from(`<Types><Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/>${' '.repeat(12 * 1024 * 1024)}</Types>`);
  const bomb = zipFile({ '[Content_Types].xml': xml, 'xl/workbook.xml': '<workbook></workbook>' }, ['[Content_Types].xml']);
  assert.ok(bomb.length < 10 * 1024 * 1024);
  await assert.rejects(service.upload('quote-1', 'budget', { user: { id: 'boss', role: 'jefe' } }, { originalname: 'bomb.xlsx', buffer: bomb }), { code: 'INVALID_ATTACHMENT' });
}));

test('worker can read accepted attachments', async () => fixture(async ({ service }) => {
  await service.upload('quote-1', 'preview', { user: { id: 'boss', role: 'jefe' } }, files.preview);
  const worker = { user: { id: 'worker', role: 'trabajador' } };
  assert.equal((await service.list('quote-1', worker))[0].kind, 'preview');
  assert.equal((await service.download('quote-1', 'preview', worker)).content.length, files.preview.buffer.length);
}));

test('metadata never contains BLOB content', async () => fixture(async ({ service }) => {
  await service.upload('quote-1', 'invoice_backup', { user: { id: 'boss', role: 'jefe' } }, files.invoice_backup);
  const metadata = (await service.list('quote-1', { user: { id: 'boss', role: 'jefe' } }))[0];
  assert.deepEqual(Object.keys(metadata).sort(), ['downloadUrl', 'filename', 'kind', 'mediaType', 'uploadedAt']);
  assert.equal(Object.hasOwn(metadata, 'content'), false);
}));
