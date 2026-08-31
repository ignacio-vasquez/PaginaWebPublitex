const VALID_ROLES = Object.freeze(['cliente', 'trabajador', 'jefe', 'superadmin']);
const PRIVILEGED_ROLES = new Set(['trabajador', 'jefe', 'superadmin']);
const EMAIL_PATTERN = /^[A-Z0-9.!#$%&'*+/=?^_`{|}~-]+@[A-Z0-9](?:[A-Z0-9-]{0,61}[A-Z0-9])?(?:\.[A-Z0-9](?:[A-Z0-9-]{0,61}[A-Z0-9])?)+$/i;
const NAME_PATTERN = /^[\p{L}\p{M}]+(?:[ '-][\p{L}\p{M}]+)*$/u;

function createError(code, message) {
  const error = new Error(message);
  error.code = code;
  return error;
}

function normalizeName(name) {
  if (typeof name !== 'string') throw createError('INVALID_NAME', 'El nombre no es válido.');
  const normalized = name.trim();
  if (normalized.length === 0 || normalized.length > 100 || !NAME_PATTERN.test(normalized)) {
    throw createError('INVALID_NAME', 'El nombre no es válido.');
  }
  return normalized;
}

function normalizeEmail(email) {
  if (typeof email !== 'string') throw createError('INVALID_EMAIL', 'El correo no es válido.');
  const normalized = email.trim().toLowerCase();
  if (normalized.length === 0 || normalized.length > 254 || !EMAIL_PATTERN.test(normalized)) {
    throw createError('INVALID_EMAIL', 'El correo no es válido.');
  }
  return normalized;
}

function validatePassword(password) {
  if (typeof password !== 'string' || password.length < 8 || password.length > 128) {
    throw createError('INVALID_PASSWORD', 'La contraseña no es válida.');
  }
}

function invalidCredentials() {
  return createError('INVALID_CREDENTIALS', 'Las credenciales no son válidas.');
}

function createUserService({ users, hashPassword, verifyPassword, createId }) {
  async function createUser({ name, email, password, role, privileged = false }) {
    const normalizedName = normalizeName(name);
    const normalizedEmail = normalizeEmail(email);
    validatePassword(password);
    if (!VALID_ROLES.includes(role) || (privileged && !PRIVILEGED_ROLES.has(role))) {
      throw createError('INVALID_ROLE', 'El rol no es válido.');
    }
    if (await users.findByEmail(normalizedEmail)) {
      throw createError('EMAIL_EXISTS', 'El correo ya está registrado.');
    }
    const passwordHash = await hashPassword(password);
    const stored = await users.create({
      id: await createId(),
      name: normalizedName,
      email: normalizedEmail,
      role,
      passwordHash,
    });
    return getPublicUser(stored);
  }

  function getPublicUser(user) {
    if (!user) return null;
    return {
      id: user.id,
      name: user.name,
      email: user.email,
      role: user.role,
    };
  }

  return {
    async registerClient(input = {}) {
      return createUser({ ...input, role: 'cliente' });
    },

    async authenticate(input = {}) {
      let email;
      try {
        email = normalizeEmail(input.email);
      } catch {
        throw invalidCredentials();
      }

      const user = await users.findByEmail(email);
      if (!user || typeof input.password !== 'string' || !user.passwordHash) {
        throw invalidCredentials();
      }
      try {
        if (!await verifyPassword(input.password, user.passwordHash)) {
          throw invalidCredentials();
        }
      } catch (error) {
        if (error && error.code === 'INVALID_CREDENTIALS') throw error;
        throw invalidCredentials();
      }
      return getPublicUser(user);
    },

    getPublicUser,

    async createPrivilegedUser(input = {}) {
      return createUser({ ...input, privileged: true });
    },
  };
}

module.exports = { createUserService, VALID_ROLES };
