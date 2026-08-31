function copySession(session) {
  return session ? { ...session } : null;
}

function createSessionRepository() {
  const storedSessions = new Map();

  return {
    async create(session) {
      const copy = copySession(session);
      storedSessions.set(copy.tokenHash, copy);
      return copySession(copy);
    },

    async findByTokenHash(tokenHash) {
      return copySession(storedSessions.get(tokenHash));
    },

    async deleteByTokenHash(tokenHash) {
      storedSessions.delete(tokenHash);
    },
  };
}

module.exports = { createSessionRepository };
