function toUser(row) {
  if (!row) return null;
  return {
    id: row.id,
    name: row.name,
    email: row.email,
    role: row.role,
    passwordHash: row.password_hash,
  };
}

function createSqliteUserRepository({ database, now = Date.now }) {
  const insert = database.prepare(`
    INSERT INTO users (id, name, email, password_hash, role, created_at, updated_at)
    VALUES (?, ?, ?, ?, ?, ?, ?)
  `);
  const findEmail = database.prepare(`
    SELECT id, name, email, role, password_hash
    FROM users
    WHERE email = ? COLLATE NOCASE AND status = 'active'
  `);
  const findId = database.prepare(`
    SELECT id, name, email, role, password_hash
    FROM users
    WHERE id = ? AND status = 'active'
  `);

  return {
    async create(user) {
      const timestamp = now();
      try {
        insert.run(
          user.id,
          user.name,
          user.email,
          user.passwordHash,
          user.role,
          timestamp,
          timestamp,
        );
      } catch (error) {
        if (error?.code === 'ERR_SQLITE_ERROR' && error?.errcode === 2067) {
          const duplicate = new Error('El correo ya está registrado.');
          duplicate.code = 'EMAIL_EXISTS';
          throw duplicate;
        }
        throw error;
      }
      return toUser(findId.get(user.id));
    },

    async findByEmail(email) {
      return toUser(findEmail.get(email));
    },

    async findById(id) {
      return toUser(findId.get(id));
    },
  };
}

module.exports = { createSqliteUserRepository };
