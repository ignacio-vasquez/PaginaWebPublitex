const test = require('node:test');
const assert = require('node:assert/strict');
const { createUserRepository } = require('../server/users/user-repository');
const { createUserService, VALID_ROLES } = require('../server/users/user-service');
const { bootstrapUsers } = require('../server/users/bootstrap-users');

function createDeterministicService(initialUsers = [], overrides = {}) {
  const users = createUserRepository(initialUsers);
  const service = createUserService({
    users,
    createId: () => 'user-1',
    hashPassword: async (password) => `hash:${password}`,
    verifyPassword: async (password, hash) => hash === `hash:${password}`,
    ...overrides,
  });
  return { users, service };
}

test('el repositorio copia los objetos al guardar y al leer', async () => {
  const users = createUserRepository();
  const user = { id: 'user-1', name: 'Ana', email: 'ana@example.com', role: 'cliente', passwordHash: 'hash' };

  await users.create(user);
  user.name = 'Modificada';
  const found = await users.findByEmail('ana@example.com');
  found.name = 'También modificada';

  assert.deepEqual(await users.findById('user-1'), {
    id: 'user-1', name: 'Ana', email: 'ana@example.com', role: 'cliente', passwordHash: 'hash',
  });
  assert.equal(await users.findByEmail('desconocido@example.com'), null);
  assert.equal(await users.findById('desconocido'), null);
});

test('registra clientes con correo normalizado y sin exponer el hash', async () => {
  const { users, service } = createDeterministicService();
  const result = await service.registerClient({
    name: '  Ignacio Vásquez  ', email: ' IGNACIO@Example.COM ', password: 'secreto1',
  });

  assert.deepEqual(result, {
    id: 'user-1', name: 'Ignacio Vásquez', email: 'ignacio@example.com', role: 'cliente',
  });
  assert.equal((await users.findByEmail('ignacio@example.com')).passwordHash, 'hash:secreto1');
  assert.equal('passwordHash' in result, false);
});

test('rechaza nombres vacíos o mayores de 100 caracteres', async () => {
  const { service } = createDeterministicService();
  await assert.rejects(() => service.registerClient({ name: '   ', email: 'ana@example.com', password: 'secreto1' }), {
    code: 'INVALID_NAME',
  });
  await assert.rejects(() => service.registerClient({ name: 'a'.repeat(101), email: 'ana@example.com', password: 'secreto1' }), {
    code: 'INVALID_NAME',
  });
});

test('rechaza correos inválidos o mayores de 254 caracteres', async () => {
  const { service } = createDeterministicService();
  await assert.rejects(() => service.registerClient({ name: 'Ana', email: 'ana@ejemplo', password: 'secreto1' }), {
    code: 'INVALID_EMAIL',
  });
  await assert.rejects(() => service.registerClient({ name: 'Ana', email: `${'a'.repeat(249)}@x.com`, password: 'secreto1' }), {
    code: 'INVALID_EMAIL',
  });
});

test('rechaza contraseñas menores de 8 o mayores de 128 caracteres', async () => {
  const { service } = createDeterministicService();
  await assert.rejects(() => service.registerClient({ name: 'Ana', email: 'ana@example.com', password: '1234567' }), {
    code: 'INVALID_PASSWORD',
  });
  await assert.rejects(() => service.registerClient({ name: 'Ana', email: 'ana@example.com', password: 'a'.repeat(129) }), {
    code: 'INVALID_PASSWORD',
  });
});

test('rechaza el correo duplicado con EMAIL_EXISTS', async () => {
  const { service } = createDeterministicService();
  await service.registerClient({ name: 'Ana', email: 'ana@example.com', password: 'secreto1' });

  await assert.rejects(() => service.registerClient({ name: 'Otra', email: ' ANA@EXAMPLE.COM ', password: 'secreto2' }), {
    code: 'EMAIL_EXISTS',
  });
});

test('evita duplicados cuando dos registros del mismo correo ocurren en paralelo', async () => {
  const users = createUserRepository();
  let nextId = 1;
  let hashCalls = 0;
  let releaseHashes;
  const hashesReleased = new Promise((resolve) => { releaseHashes = resolve; });
  const service = createUserService({
    users,
    createId: () => `user-${nextId++}`,
    hashPassword: async (password) => {
      hashCalls += 1;
      if (hashCalls === 2) releaseHashes();
      await hashesReleased;
      return `hash:${password}`;
    },
    verifyPassword: async (password, hash) => hash === `hash:${password}`,
  });

  const registrations = await Promise.allSettled([
    service.registerClient({ name: 'Ana', email: 'ana@example.com', password: 'secreto1' }),
    service.registerClient({ name: 'Otra Ana', email: ' ANA@EXAMPLE.COM ', password: 'secreto2' }),
  ]);

  assert.deepEqual(registrations.map(({ status }) => status).sort(), ['fulfilled', 'rejected']);
  assert.equal(registrations.find(({ status }) => status === 'rejected').reason.code, 'EMAIL_EXISTS');
  const stored = await Promise.all([users.findById('user-1'), users.findById('user-2')]);
  assert.equal(stored.filter(Boolean).length, 1);
  assert.ok(await users.findByEmail('ana@example.com'));
});

test('mapea una restricción de unicidad del repositorio a EMAIL_EXISTS', async () => {
  const service = createUserService({
    users: {
      async findByEmail() { return null; },
      async create() {
        const error = new Error('unique constraint failed');
        error.code = 'UNIQUE_VIOLATION';
        throw error;
      },
    },
    createId: () => 'user-1',
    hashPassword: async (password) => `hash:${password}`,
    verifyPassword: async () => true,
  });

  await assert.rejects(() => service.registerClient({
    name: 'Ana', email: 'ana@example.com', password: 'secreto1',
  }), { code: 'EMAIL_EXISTS' });
});

test('autentica credenciales correctas y devuelve el usuario público', async () => {
  const { service } = createDeterministicService();
  await service.registerClient({ name: 'Ana', email: 'ana@example.com', password: 'secreto1' });

  assert.deepEqual(await service.authenticate({ email: ' ANA@EXAMPLE.COM ', password: 'secreto1' }), {
    id: 'user-1', name: 'Ana', email: 'ana@example.com', role: 'cliente',
  });
});

test('mapea correo inexistente y contraseña incorrecta a INVALID_CREDENTIALS', async () => {
  const { service } = createDeterministicService();
  await service.registerClient({ name: 'Ana', email: 'ana@example.com', password: 'secreto1' });

  await assert.rejects(() => service.authenticate({ email: 'nadie@example.com', password: 'secreto1' }), {
    code: 'INVALID_CREDENTIALS',
  });
  await assert.rejects(() => service.authenticate({ email: 'ana@example.com', password: 'incorrecta' }), {
    code: 'INVALID_CREDENTIALS',
  });
});

test('crea usuarios privilegiados solo con roles válidos y sin exponer el hash', async () => {
  const { users, service } = createDeterministicService();
  assert.deepEqual(VALID_ROLES, ['cliente', 'trabajador', 'jefe', 'superadmin']);

  const result = await service.createPrivilegedUser({
    name: 'Jefa', email: ' JEFA@EXAMPLE.COM ', password: 'secreto1', role: 'jefe',
  });

  assert.deepEqual(result, { id: 'user-1', name: 'Jefa', email: 'jefa@example.com', role: 'jefe' });
  assert.equal((await users.findByEmail('jefa@example.com')).passwordHash, 'hash:secreto1');
  await assert.rejects(() => service.createPrivilegedUser({
    name: 'Cliente', email: 'cliente@example.com', password: 'secreto1', role: 'cliente',
  }), { code: 'INVALID_ROLE' });
});

test('bootstrap crea jefe y superadmin con grupos completos', async () => {
  const calls = [];
  const userService = {
    async createPrivilegedUser(input) {
      calls.push(input);
      return input;
    },
  };
  await bootstrapUsers({ userService, env: {
    PUBLITEX_BOSS_NAME: '  Jefa  ', PUBLITEX_BOSS_EMAIL: ' JEFA@EXAMPLE.COM ', PUBLITEX_BOSS_PASSWORD: 'secreto1',
    PUBLITEX_SUPERADMIN_NAME: ' Admin ', PUBLITEX_SUPERADMIN_EMAIL: ' ADMIN@EXAMPLE.COM ', PUBLITEX_SUPERADMIN_PASSWORD: 'secreto2',
  } });

  assert.deepEqual(calls, [
    { name: '  Jefa  ', email: ' JEFA@EXAMPLE.COM ', password: 'secreto1', role: 'jefe' },
    { name: ' Admin ', email: ' ADMIN@EXAMPLE.COM ', password: 'secreto2', role: 'superadmin' },
  ]);
});

test('bootstrap ignora grupos ausentes por completo', async () => {
  let calls = 0;
  await bootstrapUsers({ userService: { async createPrivilegedUser() { calls += 1; } }, env: {} });
  assert.equal(calls, 0);
});

test('bootstrap rechaza grupos incompletos', async () => {
  await assert.rejects(() => bootstrapUsers({
    userService: { async createPrivilegedUser() {} },
    env: { PUBLITEX_BOSS_NAME: 'Jefa', PUBLITEX_BOSS_EMAIL: 'jefa@example.com' },
  }), { code: 'INCOMPLETE_BOOTSTRAP_CONFIG' });
});

test('bootstrap no duplica correos existentes', async () => {
  const calls = [];
  const userService = {
    async createPrivilegedUser(input) {
      calls.push(input);
      const error = new Error('already exists');
      error.code = 'EMAIL_EXISTS';
      throw error;
    },
  };

  await bootstrapUsers({ userService, env: {
    PUBLITEX_BOSS_NAME: 'Jefa', PUBLITEX_BOSS_EMAIL: 'jefa@example.com', PUBLITEX_BOSS_PASSWORD: 'secreto1',
  } });
  assert.equal(calls.length, 1);
});
