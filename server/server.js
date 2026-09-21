const http = require('node:http');
const crypto = require('node:crypto');
const path = require('node:path');
const bcrypt = require('bcryptjs');
const { createApp } = require('./app');
const { createSimulationService } = require('./superadmin/simulation-service');
const { createWorkflowService } = require('./quotes/workflow-service');
const { openDatabase } = require('./database/database');
const { migrateDatabase } = require('./database/migrate');
const { createUserRepository } = require('./users/user-repository');
const { createSqliteUserRepository } = require('./users/sqlite-user-repository');
const { createUserService } = require('./users/user-service');
const { createSessionRepository } = require('./auth/session-repository');
const { createSqliteSessionRepository } = require('./auth/sqlite-session-repository');
const { createAuthService } = require('./auth/auth-service');
const { createCatalogRepository } = require('./catalog/catalog-repository');
const { createCatalogService } = require('./catalog/catalog-service');
const { createQuoteRepository } = require('./quotes/quote-repository');
const { createQuoteService } = require('./quotes/quote-service');
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
  const usesInjectedServices = Boolean(
    options.users || options.sessions || options.userService || options.authService,
  );
  let database = options.database || null;
  let ownsDatabase = false;

  if (!usesInjectedServices && !database) {
    const databaseFilename = options.databaseFilename
      || env.PUBLITEX_DB_PATH
      || path.resolve(__dirname, '..', 'data', 'publitex.sqlite');
    database = openDatabase({ filename: databaseFilename });
    ownsDatabase = true;
  }

  if (database) {
    try {
      migrateDatabase({ database, migrationsDirectory: options.migrationsDirectory });
    } catch (error) {
      if (ownsDatabase && database.isOpen) database.close();
      throw error;
    }
  }

  const users = options.users
    || (database ? createSqliteUserRepository({ database, now: options.now }) : createUserRepository());
  const sessions = options.sessions
    || (database ? createSqliteSessionRepository({ database }) : createSessionRepository());
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
  const catalogRepository = options.catalogRepository
    || (database ? createCatalogRepository({ database }) : null);
  const catalogService = options.catalogService
    || (catalogRepository ? createCatalogService({ catalog: catalogRepository }) : null);
  const quoteRepository = options.quoteRepository
    || (database ? createQuoteRepository({ database, now: options.now }) : null);
  const quoteService = options.quoteService
    || (quoteRepository && catalogService ? createQuoteService({
      quotes: quoteRepository,
      catalogService,
      createId: options.createQuoteId || (() => crypto.randomUUID()),
    }) : null);

  const simulationService = database ? createSimulationService({ database, authService, hashToken: options.hashToken }) : null;
  if (simulationService) authService.getSessionContext = simulationService.getContext;
  const workflowService = database && quoteRepository
    ? createWorkflowService({ database, quotes: quoteRepository, now: options.now }) : null;

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
    catalogService,
    quoteService,
    simulationService,
    workflowService,
    cookieSecure: options.cookieSecure ?? env.NODE_ENV === 'production',
  });
  const bootstrap = options.bootstrapUsers || defaultBootstrapUsers;
  Promise.resolve()
    .then(() => bootstrap({ userService, env }))
    .then(resolveReady, rejectReady);

  function close() {
    if (ownsDatabase && database?.isOpen) database.close();
  }

  return {
    app,
    ready,
    close,
    database,
    users,
    sessions,
    userService,
    authService,
    catalogRepository,
    catalogService,
    quoteRepository,
    quoteService,
    simulationService,
    workflowService,
  };
}

function startServer(options = {}) {
  const env = options.env || process.env;
  const port = options.port ?? env.PORT ?? '8081';
  const host = options.host ?? env.HOST ?? '0.0.0.0';
  const runtime = createRuntime(options);
  const server = http.createServer(runtime.app);
  server.once('close', runtime.close);
  server.ready = runtime.ready.then(() => new Promise((resolve, reject) => {
    const onError = (error) => {
      server.removeListener('listening', onListening);
      runtime.close();
      reject(error);
    };
    const onListening = () => {
      server.removeListener('error', onError);
      resolve(server);
    };
    server.once('error', onError);
    server.once('listening', onListening);
    server.listen(parsePort(port), host);
  }), (error) => {
    runtime.close();
    throw error;
  });
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
