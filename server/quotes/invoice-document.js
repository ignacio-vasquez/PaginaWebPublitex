const path = require('node:path');
const crypto = require('node:crypto');
const { XMLParser, XMLValidator } = require('fast-xml-parser');
const { PDFDocument } = require('pdf-lib');

const MAX_INVOICE_BYTES = 5 * 1024 * 1024;
const invalid = message => Object.assign(new Error(message), { code: 'INVALID_INVOICE' });
const scalar = value => typeof value === 'string' ? value.trim() : '';

function validateMetadata(value) {
  const number = scalar(value.number);
  const issueDate = scalar(value.issueDate);
  const totalText = String(value.total ?? '').trim();
  const date = new Date(`${issueDate}T12:00:00Z`);
  if (!/^[1-9]\d{0,9}$/.test(number)) throw invalid('Ingresa el folio numérico de la factura.');
  if (!/^\d{4}-\d{2}-\d{2}$/.test(issueDate) || !Number.isFinite(date.getTime()) || date.toISOString().slice(0, 10) !== issueDate) {
    throw invalid('Ingresa una fecha de emisión válida.');
  }
  if (!/^\d+$/.test(totalText) || !Number.isSafeInteger(Number(totalText))) {
    throw invalid('Ingresa el monto total en pesos, sin puntos ni decimales.');
  }
  return { number, issueDate, total: Number(totalText) };
}

function readXml(buffer) {
  const declaration = buffer.subarray(0, 200).toString('ascii');
  const encoding = /encoding\s*=\s*["']([^"']+)/i.exec(declaration)?.[1]?.toLowerCase() || 'utf-8';
  if (!['utf-8', 'utf8', 'iso-8859-1', 'windows-1252'].includes(encoding)) throw invalid('El XML debe estar codificado en UTF-8 o ISO-8859-1.');
  let xml;
  try { xml = new TextDecoder(encoding, { fatal: true }).decode(buffer); }
  catch { throw invalid('No se pudo leer la codificación del XML.'); }
  if (/<!\s*(DOCTYPE|ENTITY)/i.test(xml) || XMLValidator.validate(xml) !== true) {
    throw invalid('El XML no es válido o contiene declaraciones no permitidas.');
  }
  let parsed;
  try {
    parsed = new XMLParser({ removeNSPrefix: true, parseTagValue: false, trimValues: true }).parse(xml);
  } catch { throw invalid('No se pudo leer el XML de la factura.'); }
  const dte = parsed.DTE || parsed.EnvioDTE?.SetDTE?.DTE;
  const header = dte?.Documento?.Encabezado;
  if (!header || Array.isArray(dte) || Array.isArray(header) || Array.isArray(dte.Documento)) {
    throw invalid('Selecciona un XML que contenga una sola factura del SII.');
  }
  const documentType = scalar(header.IdDoc?.TipoDTE);
  if (!['33', '34'].includes(documentType)) throw invalid('El documento debe ser una factura electrónica (33 o 34).');
  const issuerRut = scalar(header.Emisor?.RUTEmisor).toUpperCase();
  const receiverRut = scalar(header.Receptor?.RUTRecep).toUpperCase();
  if (![issuerRut, receiverRut].every(rut => /^\d{7,8}-[\dK]$/.test(rut))) throw invalid('El XML no contiene los RUT del emisor y receptor.');
  return {
    ...validateMetadata({ number: header.IdDoc?.Folio, issueDate: header.IdDoc?.FchEmis, total: header.Totales?.MntTotal }),
    documentType, issuerRut, receiverRut, receiverName: scalar(header.Receptor?.RznSocRecep).slice(0, 200),
  };
}

async function inspectInvoice(file, fields = {}, requireMetadata = true) {
  if (!Buffer.isBuffer(file?.buffer) || !file.buffer.length) throw invalid('Añade el archivo de la factura.');
  if (file.buffer.length > MAX_INVOICE_BYTES) throw invalid('La factura supera el límite de 5 MB.');
  const filename = path.basename(String(file.originalname || '').replace(/\\/g, '/')).replace(/[\x00-\x1f\x7f]/g, '').slice(0, 180);
  const extension = path.extname(filename).toLowerCase();
  let metadata;
  let mediaType;
  if (extension === '.xml') {
    metadata = readXml(file.buffer);
    mediaType = 'application/xml';
  } else if (extension === '.pdf') {
    if (!file.buffer.subarray(0, 5).equals(Buffer.from('%PDF-'))) throw invalid('El archivo no es un PDF válido.');
    try {
      const pdf = await PDFDocument.load(file.buffer, { updateMetadata: false });
      if (!pdf.getPageCount()) throw new Error('empty');
    } catch { throw invalid('El PDF está dañado, vacío o protegido con contraseña.'); }
    metadata = requireMetadata ? validateMetadata(fields) : null;
    mediaType = 'application/pdf';
  } else {
    throw invalid('Selecciona una factura en PDF o XML.');
  }
  return { filename, mediaType, metadata, sha256: crypto.createHash('sha256').update(file.buffer).digest('hex') };
}

module.exports = { inspectInvoice, MAX_INVOICE_BYTES };
