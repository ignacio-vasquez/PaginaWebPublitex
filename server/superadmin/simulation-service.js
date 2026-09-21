const crypto = require('node:crypto');
const ROLES = ['cliente', 'jefe', 'trabajador'];

function fail(status, message) {
  return Object.assign(new Error(message), { status });
}

function createSimulationService({ database, authService, hashToken = token => crypto.createHash('sha256').update(token).digest('hex') }) {
  function context(realUser, tokenHash) {
    if (!realUser) return {user:null, realUser:null, simulation:null};
    const row = realUser.role === 'superadmin' && database.prepare(`
      SELECT role, target_user_id FROM session_simulations WHERE token_hash = ? AND real_user_id = ?
    `).get(tokenHash, realUser.id);
    const target = row?.target_user_id && database.prepare(`
      SELECT id,name,email,role FROM users WHERE id = ? AND status = 'active'
    `).get(row.target_user_id);
    const user = target
      ? { ...target, role: target.id === realUser.id ? 'cliente' : target.role }
      : row ? { ...realUser, role: row.role } : realUser;
    return {
      user,
      realUser,
      simulation: row ? {role:row.role, ownerId:realUser.id, targetUserId:user.id} : null,
    };
  }

  return {
    async actors(token) {
      const realUser = await authService.getSessionUser(token);
      if (!realUser) throw fail(401, 'Debes iniciar sesión.');
      if (realUser.role !== 'superadmin') throw fail(403, 'Solo superadmin puede elegir personas.');
      const rows = database.prepare(`SELECT id,name,email,role FROM users
        WHERE status = 'active' AND role IN ('cliente','jefe','trabajador')
        AND id NOT IN (SELECT user_id FROM simulation_users)
        ORDER BY CASE role WHEN 'jefe' THEN 0 WHEN 'trabajador' THEN 1 ELSE 2 END, name, id`).all();
      return {
        staff: rows.filter(row => row.role !== 'cliente').map(row => ({ ...row })),
        clients: [
          { ...realUser, role: 'cliente', name: `${realUser.name} (mis cotizaciones)` },
          ...rows.filter(row => row.role === 'cliente').map(row => ({ ...row })),
        ],
      };
    },
    async getContext(token) {
      const realUser = await authService.getSessionUser(token);
      return context(realUser, realUser ? await hashToken(token) : null);
    },
    async setRole(token, role) {
      const realUser = await authService.getSessionUser(token);
      if (!realUser) throw fail(401, 'Debes iniciar sesión.');
      if (realUser.role !== 'superadmin') throw fail(403, 'Solo superadmin puede simular un rol.');
      if (role !== null && !ROLES.includes(role)) throw fail(400, 'El rol no es válido.');
      const tokenHash = await hashToken(token);
      database.exec('BEGIN IMMEDIATE');
      try {
        database.prepare('DELETE FROM session_simulations WHERE token_hash = ?').run(tokenHash);
        if (role !== null) {
          database.prepare('INSERT INTO session_simulations (token_hash,real_user_id,role) VALUES (?,?,?)').run(tokenHash,realUser.id,role);
          database.prepare("INSERT INTO simulation_events (actor_id,effective_role,action,created_at) VALUES (?,?,'enter',?)").run(realUser.id,role,Date.now());
        }
        database.exec('COMMIT');
      } catch (error) {
        database.exec('ROLLBACK');
        throw error;
      }
      return context(realUser,tokenHash);
    },
    async actAs(token, targetUserId) {
      const realUser = await authService.getSessionUser(token);
      if (!realUser) throw fail(401, 'Debes iniciar sesión.');
      if (realUser.role !== 'superadmin') throw fail(403, 'Solo superadmin puede elegir personas.');
      if (typeof targetUserId !== 'string' || !targetUserId) throw fail(400, 'Selecciona una persona válida.');
      const target = database.prepare(`SELECT id,role FROM users WHERE id = ? AND status = 'active'
        AND id NOT IN (SELECT user_id FROM simulation_users)`).get(targetUserId);
      if (!target || (target.id !== realUser.id && !ROLES.includes(target.role))) throw fail(404, 'Persona no encontrada.');
      const role = target.id === realUser.id ? 'cliente' : target.role;
      const tokenHash = await hashToken(token);
      database.exec('BEGIN IMMEDIATE');
      try {
        database.prepare('DELETE FROM session_simulations WHERE token_hash = ?').run(tokenHash);
        database.prepare(`INSERT INTO session_simulations (token_hash,real_user_id,role,target_user_id)
          VALUES (?,?,?,?)`).run(tokenHash,realUser.id,role,target.id);
        database.prepare("INSERT INTO simulation_events (actor_id,effective_role,action,created_at) VALUES (?,?,'enter',?)")
          .run(realUser.id,role,Date.now());
        database.exec('COMMIT');
      } catch (error) { database.exec('ROLLBACK'); throw error; }
      return context(realUser,tokenHash);
    },
  };
}
module.exports = { createSimulationService };
