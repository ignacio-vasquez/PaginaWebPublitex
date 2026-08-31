const http = require('node:http');
const crypto = require('node:crypto');
const bcrypt = require('bcryptjs');
const { createApp } = require('./app');
const { createUserRepository } = require('./users/user-repository');
const { createUserService } = require('./users/user-service');
const { createSessionRepository } = require('./auth/session-repository');
const { createAuthService } = require('./auth/auth-service');
const { bootstrapUsers: defaultBootstrapUsers } = require('./users/bootstrap-users');

function parsePort(value) {
  const port = Number(value);
  if (!Number.isInteger(port) || port < 1 || port > 65535) {
    throw new RangeError('El puerto debe ser un entero entre 1 y 65535.');
  }
  return port;
}

function createRuntime(options = {}) {
  const env = options.env || process.env;
  const users = options.users || createUserRepository();
  const sessions = options.sessions || createSessionRepository();
  const userService = options.userService || createUserService({
    users,
    createId: options.createId || (() => crypto.randomUUID()),
    hashPassword: options.hashPassword || ((password) => bcrypt.hash(password, 12)),
    verifyPassword: options.verifyPassword || ((password, hash) => bcrypt.compare(password, hash)),
  });
  const authService = options.authService || createAuthService({
    users,
    sessions,
    userService,
    createToken: options.createToken,
    hashToken: options.hashToken,
    now: options.now,
  });

  let resolveReady;
  let rejectReady;
  const ready = new Promise((resolve, reject) => {
    resolveReady = resolve;
    rejectReady = reject;
  });
  const app = createApp({
    ...options,
    env,
    ready,
    users,
    sessions,
    userService,
    authService,
    cookieSecure: options.cookieSecure ?? env.NODE_ENV === 'production',
  });
  const bootstrap = options.bootstrapUsers || defaultBootstrapUsers;
  Promise.resolve()
    .then(() => bootstrap({ userService, env }))
    .then(resolveReady, rejectReady);

  return { app, ready };
}

function startServer(options = {}) {
  const env = options.env || process.env;
  const port = options.port ?? env.PORT ?? '8081';
  const host = options.host ?? env.HOST ?? '0.0.0.0';
  const runtime = createRuntime(options);
  const server = http.createServer(runtime.app);
  server.ready = runtime.ready.then(() => new Promise((resolve, reject) => {
    const onError = (error) => {
      server.removeListener('listening', onListening);
      reject(error);
    };
    const onListening = () => {
      server.removeListener('error', onError);
      resolve(server);
    };
    server.once('error', onError);
    server.once('listening', onListening);
    server.listen(parsePort(port), host);
  }));
  // Keep a rejected startup promise observable through server.ready without an
  // unhandled-rejection warning for callers that only use the Server contract.
  server.ready.catch(() => {});
  return server;
}

if (require.main === module) {
  const server = startServer();
  server.ready.catch(() => {
    console.error('No se pudo iniciar el servidor por un error de configuración.');
    process.exitCode = 1;
  });
}

module.exports = { createRuntime, startServer, parsePort };
