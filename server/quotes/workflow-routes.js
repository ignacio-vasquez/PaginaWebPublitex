const express = require('express');
const multer = require('multer');
const { MAX_INVOICE_BYTES } = require('./invoice-document');
const { requireUser } = require('../auth/authorization');

function createWorkflowRouter({ authService, workflowService }) {
  const router = express.Router();
  router.use(requireUser(authService));
  const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: MAX_INVOICE_BYTES, files: 1, fields: 3, fieldSize: 200, parts: 4 } }).single('invoice');
  function invoiceUpload(request, response, next) {
    if (!['jefe', 'superadmin'].includes(request.user?.role)) return response.status(403).json({ error: 'Solo el jefe puede gestionar facturas.' });
    if (request.get('X-Invoice-Upload') !== '1') return response.status(403).json({ error: 'Carga la factura desde la página de gestión.' });
    upload(request, response, error => {
      if (error) return response.status(error.code === 'LIMIT_FILE_SIZE' ? 413 : 400).json({ error: error.code === 'LIMIT_FILE_SIZE' ? 'La factura supera el límite de 5 MB.' : 'Adjunta un solo archivo PDF o XML de hasta 5 MB.' });
      next();
    });
  }
  const context = (request) => ({ user: request.user, realUser: request.realUser || request.user, simulation: request.simulation || null });
  function action(callback) {
    return async (request, response, next) => {
      try { await callback(request, response); }
      catch (error) {
        const status = { FORBIDDEN: 403, NOT_FOUND: 404, INVALID_TRANSITION: 409, INVALID_INVOICE: 400, DUPLICATE_INVOICE: 409, INVALID_NAME: 400 }[error.code];
        if (status) response.status(status).json({ error: error.message });
        else next(error);
      }
    };
  }
  router.get('/quotes', action(async (request, response) => response.json(await workflowService.list(context(request)))));
  router.get('/invoices', action(async (request, response) => response.json(await workflowService.archived(context(request)))));
  router.patch('/quotes/:id/name', action(async (request, response) => {
    const result = await workflowService.saveWorkName(request.params.id, context(request), request.body?.workName);
    return response.json(result);
  }));
  router.post('/quotes/:id/invoice/preview', invoiceUpload, action(async (request, response) => {
    response.json(await workflowService.previewInvoice(request.params.id, context(request), request.file));
  }));
  router.post('/quotes/:id/invoice', invoiceUpload, action(async (request, response) => {
    response.status(201).json(await workflowService.attachInvoice(request.params.id, context(request), request.file, request.body));
  }));
  router.get('/quotes/:id/invoice', action(async (request, response) => {
    const file = workflowService.downloadInvoice(request.params.id, context(request));
    response.set('Cache-Control', 'private, no-store');
    response.set('X-Content-Type-Options', 'nosniff');
    response.attachment(file.filename).type(file.media_type).send(Buffer.from(file.content));
  }));
  router.post('/quotes/:id/transition', action(async (request, response) => {
    const result = await workflowService.transition(request.params.id, context(request), request.body);
    if (!result) return response.status(404).json({ error: 'Cotización no encontrada.' });
    return response.json(result);
  }));
  return router;
}
module.exports = { createWorkflowRouter };
