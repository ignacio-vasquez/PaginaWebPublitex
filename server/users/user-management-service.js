function failure(status, message) {
  return Object.assign(new Error(message), { status });
}

function createUserManagementService({ database, userService, now = Date.now }) {
  const directory = database.prepare(`
    SELECT id, name, email, role FROM users
    WHERE status = 'active' AND role IN ('cliente', 'trabajador')
      AND id NOT IN (SELECT user_id FROM simulation_users)
    ORDER BY name COLLATE NOCASE, id
  `);
  const findTarget = database.prepare(`
    SELECT id, name, email, role FROM users
    WHERE id = ? AND status = 'active'
  `);
  const isDemo = database.prepare('SELECT 1 FROM simulation_users WHERE user_id = ?');
  const promoteUser = database.prepare(`
    UPDATE users SET role = 'trabajador', updated_at = ?
    WHERE id = ? AND role = 'cliente' AND status = 'active'
  `);
  const recordEvent = database.prepare(`
    INSERT INTO user_role_events (actor_id, target_user_id, previous_role, new_role, created_at)
    VALUES (?, ?, 'cliente', 'trabajador', ?)
  `);
  const closeSessions = database.prepare('DELETE FROM sessions WHERE user_id = ?');

  function requireManager(context) {
    if (!context?.user || !context?.realUser || context.simulation
      || context.user.id !== context.realUser.id
      || !['jefe', 'superadmin'].includes(context.user.role)) {
      throw failure(403, 'No tienes permiso para administrar usuarios.');
    }
  }

  return {
    async list(context) {
      requireManager(context);
      return directory.all().map(row => ({ ...row }));
    },
    async createClient(context, input = {}) {
      requireManager(context);
      return userService.registerClient(input);
    },
    async promote(context, targetId, input = {}) {
      requireManager(context);
      if (input.role !== 'trabajador') throw failure(400, 'Solo se puede asignar el rol trabajador.');
      const target = findTarget.get(targetId);
      if (!target) throw failure(404, 'Usuario no encontrado.');
      if (isDemo.get(target.id) || target.role === 'jefe' || target.role === 'superadmin') {
        throw failure(403, 'No puedes cambiar el rol de este usuario.');
      }
      if (target.role === 'trabajador') throw failure(409, 'El usuario ya es trabajador.');
      const timestamp = now();
      database.exec('BEGIN IMMEDIATE');
      try {
        if (!promoteUser.run(timestamp, target.id).changes) throw failure(409, 'El rol ya cambió.');
        recordEvent.run(context.realUser.id, target.id, timestamp);
        closeSessions.run(target.id);
        database.exec('COMMIT');
      } catch (error) {
        database.exec('ROLLBACK');
        throw error;
      }
      return { ...target, role: 'trabajador' };
    },
  };
}

module.exports = { createUserManagementService };
