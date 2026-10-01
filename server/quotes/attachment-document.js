const path = require('node:path');
const crypto = require('node:crypto');
const zlib = require('node:zlib');

const MAX_ATTACHMENT_BYTES = 10 * 1024 * 1024;
const ATTACHMENT_TYPES = {
  budget: { extension: '.xlsx', mediaType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' },
  invoice_backup: { extension: '.pdf', mediaType: 'application/pdf' },
  preview: { extension: '.jpg', mediaType: 'image/jpeg' },
  completion: { extension: '.jpg', mediaType: 'image/jpeg' },
};

function invalid(message = 'El archivo no coincide con el tipo permitido o supera los 10 MB.') {
  return Object.assign(new Error(message), { code: 'INVALID_ATTACHMENT' });
}

function xlsxParts(buffer) {
  const names = new Set();
  let contentTypes = '';
  let cursor = 0;
  while (cursor + 46 <= buffer.length) {
    if (buffer.readUInt32LE(cursor) !== 0x02014b50) { cursor += 1; continue; }
    const nameLength = buffer.readUInt16LE(cursor + 28);
    const extraLength = buffer.readUInt16LE(cursor + 30);
    const commentLength = buffer.readUInt16LE(cursor + 32);
    const name = buffer.toString('utf8', cursor + 46, cursor + 46 + nameLength);
    const localOffset = buffer.readUInt32LE(cursor + 42);
    const compressedSize = buffer.readUInt32LE(cursor + 20);
    const compression = buffer.readUInt16LE(cursor + 10);
    names.add(name);
    if (name === '[Content_Types].xml' && localOffset + 30 <= buffer.length
      && buffer.readUInt32LE(localOffset) === 0x04034b50) {
      const localNameLength = buffer.readUInt16LE(localOffset + 26);
      const localExtraLength = buffer.readUInt16LE(localOffset + 28);
      const start = localOffset + 30 + localNameLength + localExtraLength;
      const compressed = buffer.subarray(start, start + compressedSize);
      try {
        contentTypes = compression === 0 ? compressed.toString('utf8')
          : compression === 8 ? zlib.inflateRawSync(compressed).toString('utf8') : '';
      } catch { contentTypes = ''; }
    }
    cursor += 46 + nameLength + extraLength + commentLength;
  }
  return { names, contentTypes };
}

function isXlsx(buffer) {
  if (buffer.length < 4 || buffer.readUInt32LE(0) !== 0x04034b50) return false;
  const { names, contentTypes } = xlsxParts(buffer);
  return names.has('[Content_Types].xml') && names.has('xl/workbook.xml')
    && /application\/vnd\.openxmlformats-officedocument\.spreadsheetml\.sheet\.main\+xml/i.test(contentTypes);
}

function inspectAttachment(kind, file) {
  const type = ATTACHMENT_TYPES[kind];
  if (!type || !file || !Buffer.isBuffer(file.buffer) || file.buffer.length < 1
    || file.buffer.length > MAX_ATTACHMENT_BYTES) throw invalid();
  const originalname = String(file.originalname || '').replace(/\\/g, '/');
  const extension = path.extname(path.basename(originalname)).toLowerCase();
  if (extension !== type.extension) throw invalid();
  const content = file.buffer;
  if (kind === 'budget' && !isXlsx(content)) throw invalid();
  if (kind === 'invoice_backup' && content.subarray(0, 5).toString('ascii') !== '%PDF-') throw invalid();
  if ((kind === 'preview' || kind === 'completion')
    && !(content[0] === 0xff && content[1] === 0xd8 && content[2] === 0xff
      && content[content.length - 2] === 0xff && content[content.length - 1] === 0xd9)) throw invalid();
  const filename = path.basename(originalname).replace(/[\u0000-\u001f\u007f<>:"|?*]/g, '_').trim().slice(0, 180);
  if (!filename || filename === '.' || filename === '..') throw invalid();
  return {
    filename,
    mediaType: type.mediaType,
    content: Buffer.from(content),
    sha256: crypto.createHash('sha256').update(content).digest('hex'),
  };
}

module.exports = { ATTACHMENT_TYPES, MAX_ATTACHMENT_BYTES, inspectAttachment, isXlsx };
