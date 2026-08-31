const { createApp } = require('./app');

function parsePort(value) {
  const port = Number(value);
  if (!Number.isInteger(port) || port < 1 || port > 65535) {
    throw new RangeError('El puerto debe ser un entero entre 1 y 65535.');
  }
  return port;
}

function startServer({ port = process.env.PORT ?? '8081', host = process.env.HOST ?? '0.0.0.0' } = {}) {
  const app = createApp();
  return app.listen(parsePort(port), host);
}

if (require.main === module) {
  startServer();
}

module.exports = { startServer };
