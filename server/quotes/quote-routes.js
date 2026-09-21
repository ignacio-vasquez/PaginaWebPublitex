const express = require('express');
const { requireUser } = require('../auth/authorization');

const NOT_FOUND = { error: 'Cotización no encontrada.' };

function createQuoteRouter({ quoteService, authService }) {
  if (!quoteService || !authService) {
    throw new TypeError('quoteService y authService son obligatorios.');
  }
  const router = express.Router();
  router.use(requireUser(authService));
  router.use((request, response, next) => {
    if (request.simulation && request.user.role !== 'cliente') {
      return response.status(403).json({ error: 'Cambia al rol Cliente para gestionar tus cotizaciones.' });
    }
    return next();
  });

  function sendResult(response, result, status = 200) {
    if (!result) return response.status(404).json(NOT_FOUND);
    return response.status(status).json(result);
  }

  function handle(error, response, next) {
    if (['INVALID_QUOTE', 'INVALID_CATALOG_SELECTION', 'QUOTE_EMPTY'].includes(error?.code)) {
      return response.status(400).json({ error: error.message });
    }
    if (error?.code === 'QUOTE_NOT_EDITABLE') {
      return response.status(409).json({ error: error.message });
    }
    return next(error);
  }

  function action(callback) {
    return async (request, response, next) => {
      try {
        await callback(request, response);
      } catch (error) {
        handle(error, response, next);
      }
    };
  }

  router.get('/', action(async (request, response) => {
    response.json(await quoteService.list(request.user.id));
  }));
  router.post('/', action(async (request, response) => {
    sendResult(response, await quoteService.createDraft(request.user.id, request.simulation
      ? { effectiveRole: 'cliente', actorId: request.realUser.id } : undefined), 201);
  }));
  router.get('/:id', action(async (request, response) => {
    sendResult(response, await quoteService.get(request.params.id, request.user.id));
  }));
  router.patch('/:id', action(async (request, response) => {
    sendResult(response, await quoteService.saveDetails(
      request.params.id, request.user.id, request.body,
    ));
  }));
  router.post('/:id/items', action(async (request, response) => {
    sendResult(response, await quoteService.addItem(
      request.params.id, request.user.id, request.body,
    ), 201);
  }));
  router.put('/:id/items/:itemId', action(async (request, response) => {
    sendResult(response, await quoteService.updateItem(
      request.params.id, request.params.itemId, request.user.id, request.body,
    ));
  }));
  router.delete('/:id/items/:itemId', action(async (request, response) => {
    sendResult(response, await quoteService.deleteItem(
      request.params.id, request.params.itemId, request.user.id,
    ));
  }));
  router.post('/:id/submit', action(async (request, response) => {
    sendResult(response, await quoteService.submit(request.params.id, request.user.id, request.simulation
      ? { effectiveRole: 'cliente', actorId: request.realUser.id } : undefined));
  }));

  return router;
}

module.exports = { createQuoteRouter };
