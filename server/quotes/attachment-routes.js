const express = require('express');
const multer = require('multer');
const { MAX_ATTACHMENT_BYTES } = require('./attachment-document');
const { requireUser } = require('../auth/authorization');

function createQuoteAttachmentRouter({ attachmentService, authService }) {
  if (!attachmentService || !authService) throw new TypeError('attachmentService y authService son obligatorios.');
  const router = express.Router();
  router.use(requireUser(authService));
  router.use((_request, response, next) => {
    response.set('Cache-Control', 'private, no-store');
    response.set('X-Content-Type-Options', 'nosniff');
    next();
  });
  const upload = multer({
    storage: multer.memoryStorage(),
    limits: { fileSize: MAX_ATTACHMENT_BYTES, files: 1, fields: 0, parts: 1 },
  }).single('file');
  const context = (request) => ({
    user: request.user,
    realUser: request.realUser || request.user,
    simulation: request.simulation || null,
  });
  function action(callback) {
    return async (request, response, next) => {
      try { await callback(request, response); }
      catch (error) {
        const status = { FORBIDDEN: 403, NOT_FOUND: 404, INVALID_ATTACHMENT: 400 }[error.code];
        if (status) response.status(status).json({ error: error.message });
        else next(error);
      }
    };
  }
  function parseUpload(request, response, next) {
    if (!['jefe', 'superadmin'].includes(request.user.role)) return response.status(403).json({ error: 'Solo el jefe puede cargar archivos.' });
    upload(request, response, (error) => {
      if (error) {
        const oversize = error.code === 'LIMIT_FILE_SIZE';
        return response.status(oversize ? 413 : 400).json({ error: oversize
          ? 'El archivo supera el límite de 10 MB.' : 'Adjunta un solo archivo en el campo file.' });
      }
      if (!request.file) return response.status(400).json({ error: 'Adjunta un archivo en el campo file.' });
      return next();
    });
  }
  router.get('/:id/attachments', action(async (request, response) => {
    response.json(await attachmentService.list(request.params.id, context(request)));
  }));
  router.get('/:id/attachments/:kind', action(async (request, response) => {
    const file = await attachmentService.download(request.params.id, request.params.kind, context(request));
    response.attachment(file.filename).type(file.media_type).send(Buffer.from(file.content));
  }));
  router.put('/:id/attachments/:kind', parseUpload, action(async (request, response) => {
    response.json(await attachmentService.upload(request.params.id, request.params.kind, context(request), request.file));
  }));
  return router;
}

module.exports = { createQuoteAttachmentRouter };
