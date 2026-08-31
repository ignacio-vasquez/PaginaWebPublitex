const BOOTSTRAP_GROUPS = [
  {
    prefix: 'PUBLITEX_BOSS',
    role: 'jefe',
  },
  {
    prefix: 'PUBLITEX_SUPERADMIN',
    role: 'superadmin',
  },
];

function isPresent(value) {
  return typeof value === 'string' && value.trim().length > 0;
}

function incompleteConfig() {
  const error = new Error('La configuración de bootstrap está incompleta.');
  error.code = 'INCOMPLETE_BOOTSTRAP_CONFIG';
  return error;
}

async function bootstrapUsers({ userService, env = process.env }) {
  for (const { prefix, role } of BOOTSTRAP_GROUPS) {
    const values = {
      name: env[`${prefix}_NAME`],
      email: env[`${prefix}_EMAIL`],
      password: env[`${prefix}_PASSWORD`],
    };
    const present = Object.values(values).map(isPresent);
    if (!present.some(Boolean)) continue;
    if (!present.every(Boolean)) throw incompleteConfig();

    try {
      await userService.createPrivilegedUser({ ...values, role });
    } catch (error) {
      if (!error || error.code !== 'EMAIL_EXISTS') throw error;
    }
  }
}

module.exports = { bootstrapUsers };
