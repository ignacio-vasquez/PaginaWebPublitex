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

function readZipEntries(buffer) {
  const minimumEnd = Math.max(0, buffer.length - 65557);
  let endOffset = -1;
  for (let offset = buffer.length - 22; offset >= minimumEnd; offset -= 1) {
    if (buffer.readUInt32LE(offset) === 0x06054b50) { endOffset = offset; break; }
  }
  if (endOffset < 0) throw invalid();
  const commentLength = buffer.readUInt16LE(endOffset + 20);
  const entryCount = buffer.readUInt16LE(endOffset + 10);
  const centralSize = buffer.readUInt32LE(endOffset + 12);
  const centralOffset = buffer.readUInt32LE(endOffset + 16);
  if (buffer.readUInt16LE(endOffset + 4) !== 0 || buffer.readUInt16LE(endOffset + 6) !== 0
    || buffer.readUInt16LE(endOffset + 8) !== entryCount || entryCount < 1 || entryCount > 1000
    || endOffset + 22 + commentLength !== buffer.length || centralOffset + centralSize !== endOffset) throw invalid();
  const entries = new Map();
  let cursor = centralOffset;
  for (let index = 0; index < entryCount; index += 1) {
    if (cursor + 46 > endOffset || buffer.readUInt32LE(cursor) !== 0x02014b50) throw invalid();
    const flags = buffer.readUInt16LE(cursor + 8);
    const compression = buffer.readUInt16LE(cursor + 10);
    const compressedSize = buffer.readUInt32LE(cursor + 20);
    const uncompressedSize = buffer.readUInt32LE(cursor + 24);
    const filenameLength = buffer.readUInt16LE(cursor + 28);
    const extraLength = buffer.readUInt16LE(cursor + 30);
    const entryCommentLength = buffer.readUInt16LE(cursor + 32);
    const localOffset = buffer.readUInt32LE(cursor + 42);
    const endOfCentralEntry = cursor + 46 + filenameLength + extraLength + entryCommentLength;
    if (endOfCentralEntry > endOffset || flags & 1 || ![0, 8].includes(compression)) throw invalid();
    const name = buffer.toString('utf8', cursor + 46, cursor + 46 + filenameLength);
    if (!name || entries.has(name) || localOffset + 30 > centralOffset
      || buffer.readUInt32LE(localOffset) !== 0x04034b50) throw invalid();
    const localFlags = buffer.readUInt16LE(localOffset + 6);
    const localCompression = buffer.readUInt16LE(localOffset + 8);
    const localNameLength = buffer.readUInt16LE(localOffset + 26);
    const localExtraLength = buffer.readUInt16LE(localOffset + 28);
    const localName = buffer.toString('utf8', localOffset + 30, localOffset + 30 + localNameLength);
    const dataOffset = localOffset + 30 + localNameLength + localExtraLength;
    if (localName !== name || localFlags !== flags || localCompression !== compression
      || dataOffset + compressedSize > centralOffset) throw invalid();
    let content = null;
    if (name === '[Content_Types].xml' || name === 'xl/workbook.xml') {
      if (uncompressedSize > 4 * 1024 * 1024) throw invalid();
      const compressed = buffer.subarray(dataOffset, dataOffset + compressedSize);
      try {
        content = compression === 0 ? Buffer.from(compressed)
          : zlib.inflateRawSync(compressed, { maxOutputLength: 4 * 1024 * 1024 });
      } catch { throw invalid(); }
      if (content.length !== uncompressedSize) throw invalid();
    }
    entries.set(name, content);
    cursor = endOfCentralEntry;
  }
  if (cursor !== centralOffset + centralSize) throw invalid();
  return entries;
}

function isXlsx(buffer) {
  if (buffer.length < 4 || buffer.readUInt32LE(0) !== 0x04034b50) return false;
  const entries = readZipEntries(buffer);
  const cleanXml = buffer => buffer?.toString('utf8').replace(/^\uFEFF/, '').replace(/<!--[\s\S]*?-->/g, '').trim() || '';
  const contentTypes = cleanXml(entries.get('[Content_Types].xml'));
  const workbook = cleanXml(entries.get('xl/workbook.xml'));
  const contentRoot = /^(?:<\?xml[^?]*\?>\s*)?<Types(?:\s[^>]*)?>[\s\S]*<\/Types>$/i.test(contentTypes);
  const workbookRoot = /^(?:<\?xml[^?]*\?>\s*)?<workbook(?:\s[^>]*)?>[\s\S]*<\/workbook>$/i.test(workbook);
  const hasWorkbookOverride = [...contentTypes.matchAll(/<Override\b([^>]*)\/?\s*>/gi)].some(([, attributes]) => {
    const partName = attributes.match(/\bPartName=["']([^"']+)["']/i)?.[1];
    const contentType = attributes.match(/\bContentType=["']([^"']+)["']/i)?.[1];
    return partName === '/xl/workbook.xml'
      && contentType === 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml';
  });
  return contentRoot && hasWorkbookOverride && workbookRoot;
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
