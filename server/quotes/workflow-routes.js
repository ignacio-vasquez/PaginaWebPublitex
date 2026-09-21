const express = require('express');
const { requireUser } = require('../auth/authorization');

function createWorkflowRouter({ authService, workflowService }) {
  const router = express.Router();
  router.use(requireUser(authService));
  const context = (request) => ({ user: request.user, realUser: request.realUser || request.user, simulation: request.simulation || null });
  function action(callback) {
    return async (request, response, next) => {
      try { await callback(request, response); }
      catch (error) {
        const status = { FORBIDDEN: 403, INVALID_TRANSITION: 409, INVALID_INVOICE: 400 }[error.code];
        if (status) response.status(status).json({ error: error.message });
        else next(error);
      }
    };
  }
  router.get('/quotes', action(async (request, response) => response.json(await workflowService.list(context(request)))));
  router.get('/invoices', action(async (request, response) => response.json(await workflowService.archived(context(request)))));
  router.post('/quotes/:id/transition', action(async (request, response) => {
    const result = await workflowService.transition(request.params.id, context(request), request.body);
    if (!result) return response.status(404).json({ error: 'Cotización no encontrada.' });
    return response.json(result);
  }));
  return router;
}
module.exports = { createWorkflowRouter };
