const { inspectInvoice } = require('./invoice-document');

function failure(code, message) {
  return Object.assign(new Error(message), { code });
}

const transitions = {
  in_review: { from: 'submitted', roles: ['jefe', 'superadmin'] },
  accepted: { from: 'in_review', roles: ['jefe', 'superadmin'] },
  invoiced: { from: 'accepted', roles: ['jefe', 'superadmin'] },
  in_production: { from: 'invoiced', roles: ['jefe', 'superadmin'] },
  ready: {
    fromByRole: {
      jefe: ['in_production'],
      trabajador: ['invoiced', 'in_production'],
      superadmin: ['invoiced', 'in_production'],
    },
    roles: ['jefe', 'trabajador', 'superadmin'],
  },
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

  function invoiceTarget(id, context, forUpload = false) {
    if (!['jefe', 'superadmin'].includes(context?.user?.role)) throw failure('FORBIDDEN', 'Solo el jefe puede gestionar facturas.');
    const row = database.prepare(`SELECT q.user_id, COALESCE(w.status,q.status) AS status,
      i.quote_id AS attached FROM quotes q LEFT JOIN quote_workflow w ON w.quote_id=q.id
      LEFT JOIN quote_invoices i ON i.quote_id=q.id
      WHERE q.id=? AND q.status='submitted' AND q.user_id NOT IN (SELECT user_id FROM simulation_users)`).get(id);
    if (!row) throw failure('NOT_FOUND', 'Cotización no encontrada.');
    if (forUpload && (row.attached || !['accepted','invoiced','in_production','ready','delivered'].includes(row.status))) {
      throw failure('INVALID_TRANSITION', row.attached ? 'Esta cotización ya tiene una factura adjunta.' : 'Acepta la cotización antes de añadir su factura.');
    }
    return row;
  }

  return {
    async saveWorkName(id, context, value) {
      if (!['jefe', 'superadmin'].includes(context?.user?.role)) {
        throw failure('FORBIDDEN', 'Solo el jefe puede editar el nombre del trabajo.');
      }
      const visible = visibleRows({ ...context, user: { ...context.user, role: context.user.role } }, id);
      if (!visible.length) throw failure('NOT_FOUND', 'Cotización no encontrada.');
      const workName = typeof value === 'string' ? value.trim() : '';
      if (typeof value !== 'string' || workName.length > 120) throw failure('INVALID_NAME', 'El nombre del trabajo debe tener hasta 120 caracteres.');
      return quotes.saveWorkNameForTeam({ id, workName });
    },
    async previewInvoice(id, context, file) {
      invoiceTarget(id, context, true);
      const { filename, mediaType, metadata } = await inspectInvoice(file, {}, false);
      return { filename, mediaType, metadata };
    },
    async attachInvoice(id, context, file, fields = {}) {
      invoiceTarget(id, context, true);
      const document = await inspectInvoice(file, fields);
      const data = document.metadata;
      const timestamp = now();
      database.exec('BEGIN IMMEDIATE');
      let target;
      try {
        target = invoiceTarget(id, context, true);
        const duplicate = database.prepare(`SELECT quote_id FROM quote_invoices WHERE sha256=?
          OR (issuer_rut=? AND document_type=? AND folio=?)`).get(document.sha256, data.issuerRut || null, data.documentType || null, data.number);
        if (duplicate) throw failure('DUPLICATE_INVOICE', 'Esta factura ya está adjunta a otra cotización.');
        database.prepare(`INSERT INTO quote_invoices (quote_id,filename,media_type,content,sha256,folio,issue_date,total,
          document_type,issuer_rut,receiver_rut,receiver_name,uploaded_at,uploaded_by) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?)`)
          .run(id, document.filename, document.mediaType, file.buffer, document.sha256, data.number, data.issueDate, data.total,
            data.documentType || null, data.issuerRut || null, data.receiverRut || null, data.receiverName || null,
            timestamp, context.realUser?.id || context.user.id);
        database.prepare(`UPDATE quote_workflow SET invoice_number=?,
          status=CASE WHEN status='accepted' THEN 'invoiced' ELSE status END,
          invoiced_at=COALESCE(invoiced_at,?), payment_due_at=COALESCE(payment_due_at,?) WHERE quote_id=?`)
          .run(data.number, timestamp, timestamp + 30 * 24 * 60 * 60 * 1000, id);
        database.prepare('UPDATE quotes SET updated_at=? WHERE id=?').run(timestamp, id);
        if (target.status === 'accepted') {
          database.prepare('INSERT INTO quote_events (quote_id,actor_id,effective_role,status,created_at) VALUES (?,?,?,?,?)')
            .run(id, context.realUser?.id || context.user.id, context.user.role, 'invoiced', timestamp);
        }
        database.exec('COMMIT');
      } catch (error) { database.exec('ROLLBACK'); throw error; }
      return quotes.findOwned(id, target.user_id);
    },
    downloadInvoice(id, context) {
      invoiceTarget(id, context);
      const document = database.prepare('SELECT filename,media_type,content FROM quote_invoices WHERE quote_id=?').get(id);
      if (!document) throw failure('NOT_FOUND', 'Esta cotización todavía no tiene factura adjunta.');
      return document;
    },
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
      const issueTime = quote => quote.invoice ? Date.parse(`${quote.invoice.issueDate}T12:00:00Z`)
        : quote.invoicedAt || quote.events.find(e => e.status === 'delivered')?.createdAt || 0;
      return records.sort((a, b) => issueTime(b) - issueTime(a)
        || b.createdAt - a.createdAt || b.code.localeCompare(a.code));
    },
    async transition(id, context, input = {}) {
      checkRole(context);
      const rule = transitions[input?.status];
      if (!rule) throw failure('INVALID_TRANSITION', 'El estado solicitado no es válido.');
      if (!rule.roles.includes(context.user.role)) {
        throw failure('FORBIDDEN', 'Tu rol no permite realizar esta acción.');
      }
      if (input.status === 'invoiced') throw failure('INVALID_INVOICE', 'Añade el archivo de la factura para marcar la cotización como facturada.');
      database.exec('BEGIN IMMEDIATE');
      let ownerId;
      try {
        const quote = visibleRows(context, id)[0];
        if (!quote) { database.exec('COMMIT'); return null; }
        const allowedFrom = rule.fromByRole?.[context.user.role] || [rule.from];
        if (!allowedFrom.includes(quote.status)) {
          throw failure('INVALID_TRANSITION', 'La cotización cambió de estado. Actualiza el listado antes de continuar.');
        }
        const timestamp = now();
        database.prepare(`INSERT INTO quote_workflow (quote_id,status) VALUES (?,?)
          ON CONFLICT(quote_id) DO UPDATE SET status=excluded.status`).run(id, input.status);
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
