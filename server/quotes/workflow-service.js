function failure(code, message) {
  return Object.assign(new Error(message), { code });
}

const transitions = {
  in_review: { from: 'submitted', roles: ['jefe', 'superadmin'] },
  accepted: { from: 'in_review', roles: ['jefe', 'superadmin'] },
  invoiced: { from: 'accepted', roles: ['jefe', 'superadmin'] },
  ready: { from: 'invoiced', roles: ['trabajador', 'superadmin'] },
  delivered: { from: 'ready', roles: ['jefe', 'superadmin'] },
};

function createWorkflowService({ database, quotes, now = Date.now }) {
  function checkRole(context) {
    if (!['jefe', 'trabajador', 'superadmin'].includes(context?.user?.role)) {
      throw failure('FORBIDDEN', 'No tienes permiso para gestionar cotizaciones.');
    }
  }

  function visibility(context) {
    const clauses = ["q.status = 'submitted'"];
    const values = [];
    if (context.user.role === 'trabajador') {
      clauses.push("w.status IN ('invoiced','in_production','ready','delivered')");
    }
    clauses.push('q.user_id NOT IN (SELECT user_id FROM simulation_users)');
    return { sql: clauses.join(' AND '), values };
  }

  function visibleRows(context, id) {
    checkRole(context);
    const filter = visibility(context);
    const clause = id === undefined ? '' : ' AND q.id = ?';
    return database.prepare(`
      SELECT q.id, q.user_id, COALESCE(w.status, q.status) AS status
      FROM quotes q LEFT JOIN quote_workflow w ON w.quote_id = q.id
      WHERE ${filter.sql} AND COALESCE(w.status, q.status) <> 'delivered'${clause}
      ORDER BY q.created_at DESC, q.id
    `).all(...filter.values, ...(id === undefined ? [] : [id]));
  }

  return {
    async list(context) {
      const rows = visibleRows(context);
      return Promise.all(rows.map((row) => quotes.findOwned(row.id, row.user_id)));
    },
    async archived(context) {
      checkRole(context);
      if (!['jefe', 'superadmin'].includes(context.user.role)) {
        throw failure('FORBIDDEN', 'Solo el jefe puede consultar las facturas realizadas.');
      }
      const rows = database.prepare(`
        SELECT q.id, q.user_id, u.name AS client_name, u.email AS client_email
        FROM quotes q
        JOIN quote_workflow w ON w.quote_id = q.id
        JOIN users u ON u.id = q.user_id
        WHERE q.status = 'submitted' AND w.status = 'delivered'
          AND q.user_id NOT IN (SELECT user_id FROM simulation_users)
      `).all();
      const records = await Promise.all(rows.map(async (row) => ({
        ...await quotes.findOwned(row.id, row.user_id),
        clientName: row.client_name,
        clientEmail: row.client_email,
      })));
      return records.sort((a, b) => (b.invoicedAt || b.events.find(e => e.status === 'delivered')?.createdAt || 0)
        - (a.invoicedAt || a.events.find(e => e.status === 'delivered')?.createdAt || 0)
        || b.createdAt - a.createdAt || b.code.localeCompare(a.code));
    },
    async transition(id, context, input = {}) {
      checkRole(context);
      const rule = transitions[input?.status];
      if (!rule) throw failure('INVALID_TRANSITION', 'El estado solicitado no es válido.');
      if (!rule.roles.includes(context.user.role)) {
        throw failure('FORBIDDEN', 'Tu rol no permite realizar esta acción.');
      }
      database.exec('BEGIN IMMEDIATE');
      let ownerId;
      try {
        const quote = visibleRows(context, id)[0];
        if (!quote) { database.exec('COMMIT'); return null; }
        if (quote.status !== rule.from && !(input.status === 'ready' && quote.status === 'in_production')) {
          throw failure('INVALID_TRANSITION', 'La cotización cambió de estado. Actualiza el listado antes de continuar.');
        }
        if (input.status === 'invoiced' && (typeof input.invoiceNumber !== 'string' || !input.invoiceNumber.trim() || input.invoiceNumber.trim().length > 100)) {
          throw failure('INVALID_INVOICE', 'Ingresa el número de la factura emitida.');
        }
        const timestamp = now();
        const invoiceNumber = input.status === 'invoiced' ? input.invoiceNumber.trim() : null;
        database.prepare(`INSERT INTO quote_workflow (quote_id,status,invoice_number,invoiced_at,payment_due_at) VALUES (?,?,?,?,?)
          ON CONFLICT(quote_id) DO UPDATE SET status=excluded.status,
          invoice_number=COALESCE(excluded.invoice_number,quote_workflow.invoice_number),
          invoiced_at=COALESCE(excluded.invoiced_at,quote_workflow.invoiced_at),
          payment_due_at=COALESCE(excluded.payment_due_at,quote_workflow.payment_due_at)`)
          .run(id, input.status, invoiceNumber, invoiceNumber ? timestamp : null, invoiceNumber ? timestamp + 30 * 24 * 60 * 60 * 1000 : null);
        database.prepare('UPDATE quotes SET updated_at = ? WHERE id = ?').run(timestamp, id);
        database.prepare('INSERT INTO quote_events (quote_id,actor_id,effective_role,status,created_at) VALUES (?,?,?,?,?)')
          .run(id, context.realUser?.id || context.user.id, context.user.role, input.status, timestamp);
        ownerId = quote.user_id;
        database.exec('COMMIT');
      } catch (error) { database.exec('ROLLBACK'); throw error; }
      return quotes.findOwned(id, ownerId);
    },
  };
}

module.exports = { createWorkflowService };
