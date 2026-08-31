const crypto = require('node:crypto');

const SESSION_DURATION_MS = 8 * 60 * 60 * 1000;

function defaultCreateToken() {
  return crypto.randomBytes(32).toString('hex');
}

function defaultHashToken(token) {
  return crypto.createHash('sha256').update(token).digest('hex');
}

function currentTime(now) {
  const value = now();
  return value instanceof Date ? value.getTime() : value;
}

function createAuthService({
  users,
  sessions,
  userService,
  createToken = defaultCreateToken,
  hashToken = defaultHashToken,
  now = () => Date.now(),
}) {
  async function openSession(user) {
    const token = await createToken();
    const tokenHash = await hashToken(token);
    const expiresAt = currentTime(now) + SESSION_DURATION_MS;
    await sessions.create({ tokenHash, userId: user.id, expiresAt });
    return { token, user };
  }

  return {
    async register(input = {}) {
      const user = await userService.registerClient(input);
      return openSession(user);
    },

    async login(input = {}) {
      const user = await userService.authenticate(input);
      return openSession(user);
    },

    async getSessionUser(token) {
      if (typeof token !== 'string' || token.length === 0) return null;
      const tokenHash = await hashToken(token);
      const session = await sessions.findByTokenHash(tokenHash);
      if (!session) return null;

      const expiresAt = session.expiresAt instanceof Date ? session.expiresAt.getTime() : session.expiresAt;
      if (!Number.isFinite(expiresAt) || currentTime(now) >= expiresAt) {
        await sessions.deleteByTokenHash(tokenHash);
        return null;
      }

      const user = await users.findById(session.userId);
      if (!user) return null;
      return userService.getPublicUser(user);
    },

    async logout(token) {
      if (typeof token !== 'string' || token.length === 0) return;
      await sessions.deleteByTokenHash(await hashToken(token));
    },
  };
}

module.exports = { createAuthService, SESSION_DURATION_MS };
