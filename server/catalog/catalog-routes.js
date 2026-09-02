const express = require('express');

function createCatalogRouter({ catalogService }) {
  const router = express.Router();

  router.get('/', async (_request, response) => {
    response.json(await catalogService.getCatalog());
  });

  router.post('/estimate', async (request, response, next) => {
    try {
      response.json(await catalogService.estimate(request.body));
    } catch (error) {
      if (error?.code === 'INVALID_CATALOG_SELECTION') {
        return response.status(400).json({ error: error.message });
      }
      return next(error);
    }
  });

  return router;
}

module.exports = { createCatalogRouter };
