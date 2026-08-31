const express = require('express');
const path = require('node:path');

function createApp() {
  const app = express();
  app.disable('x-powered-by');
  app.use(express.json({ limit: '16kb' }));
  app.use(express.static(path.resolve(__dirname, '..')));
  app.use('/api', (_request, response) => {
    response.status(404).json({ error: 'Recurso no encontrado.' });
  });
  return app;
}

module.exports = { createApp };
