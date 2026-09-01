function toSession(row) {
  if (!row) return null;
  return {
    tokenHash: row.token_hash,
    userId: row.user_id,
    expiresAt: row.expires_at,
  };
}

function createSqliteSessionRepository({ database }) {
  const insert = database.prepare(`
    INSERT OR REPLACE INTO sessions (token_hash, user_id, expires_at, created_at)
    VALUES (?, ?, ?, ?)
  `);
  const findToken = database.prepare(`
    SELECT token_hash, user_id, expires_at
    FROM sessions
    WHERE token_hash = ?
  `);
  const deleteToken = database.prepare('DELETE FROM sessions WHERE token_hash = ?');

  return {
    async create(session) {
      insert.run(session.tokenHash, session.userId, session.expiresAt, Date.now());
      return toSession(findToken.get(session.tokenHash));
    },

    async findByTokenHash(tokenHash) {
      return toSession(findToken.get(tokenHash));
    },

    async deleteByTokenHash(tokenHash) {
      deleteToken.run(tokenHash);
    },
  };
}

module.exports = { createSqliteSessionRepository };
