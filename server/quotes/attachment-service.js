const { inspectAttachment } = require('./attachment-document');

function failure(code, message = 'Cotización no encontrada.') {
  return Object.assign(new Error(message), { code });
}

function createQuoteAttachmentService({ database, quotes, now = Date.now }) {
  if (!database || !quotes) throw new TypeError('database y quotes son obligatorios.');
  const selectQuote = database.prepare(`SELECT q.user_id, q.status AS quote_status,
    COALESCE(w.status, q.status) AS status
    FROM quotes q LEFT JOIN quote_workflow w ON w.quote_id = q.id WHERE q.id = ?`);
  const selectAttachments = database.prepare(`SELECT kind, filename, media_type, uploaded_at
    FROM quote_attachments WHERE quote_id = ? ORDER BY kind`);
  const selectAttachment = database.prepare(`SELECT filename, media_type, content
    FROM quote_attachments WHERE quote_id = ? AND kind = ?`);

  function access(id, context, kind) {
    const user = context?.user;
    if (!user?.id || !user.role) throw failure('FORBIDDEN', 'Inicia sesión para acceder a los archivos.');
    const quote = selectQuote.get(id);
    if (!quote || quote.quote_status !== 'submitted' || database.prepare('SELECT 1 FROM simulation_users WHERE user_id=?').get(quote.user_id)) {
      throw failure('NOT_FOUND');
    }
    const manager = ['jefe', 'superadmin'].includes(user.role);
    const owner = user.role === 'cliente' && quote.user_id === user.id;
    const worker = user.role === 'trabajador' && ['accepted', 'invoiced', 'in_production', 'ready', 'delivered'].includes(quote.status);
    if (!manager && !owner && !worker) throw failure('NOT_FOUND');
    if (kind && !Object.hasOwn(require('./attachment-document').ATTACHMENT_TYPES, kind)) throw failure('NOT_FOUND');
    if (owner) {
      const sharedStage = ['accepted', 'invoiced', 'in_production', 'ready', 'delivered'].includes(quote.status);
      if (!sharedStage || (kind === 'completion' && quote.status !== 'delivered')) throw failure('NOT_FOUND');
    }
    return { quote, manager };
  }

  function metadata(id, row) {
    return {
      kind: row.kind,
      filename: row.filename,
      mediaType: row.media_type,
      uploadedAt: row.uploaded_at,
      downloadUrl: `/api/quotes/${encodeURIComponent(id)}/attachments/${encodeURIComponent(row.kind)}`,
    };
  }

  return {
    async list(id, context) {
      access(id, context);
      return selectAttachments.all(id).filter((row) => {
        try { access(id, context, row.kind); return true; } catch (error) { if (error.code === 'NOT_FOUND') return false; throw error; }
      }).map((row) => metadata(id, row));
    },

    async upload(id, kind, context, file) {
      const { manager } = access(id, context, kind);
      if (!manager) throw failure('FORBIDDEN', 'Solo el jefe puede cargar archivos.');
      const document = inspectAttachment(kind, file);
      const timestamp = now();
      database.exec('BEGIN IMMEDIATE');
      try {
        access(id, context, kind);
        database.prepare(`INSERT INTO quote_attachments
          (quote_id,kind,filename,media_type,content,sha256,uploaded_at,uploaded_by)
          VALUES (?,?,?,?,?,?,?,?)
          ON CONFLICT(quote_id,kind) DO UPDATE SET filename=excluded.filename,media_type=excluded.media_type,
            content=excluded.content,sha256=excluded.sha256,uploaded_at=excluded.uploaded_at,uploaded_by=excluded.uploaded_by`)
          .run(id, kind, document.filename, document.mediaType, document.content, document.sha256, timestamp,
            context.realUser?.id || context.user.id);
        database.exec('COMMIT');
      } catch (error) { database.exec('ROLLBACK'); throw error; }
      return metadata(id, { kind, filename: document.filename, media_type: document.mediaType, uploaded_at: timestamp });
    },

    async download(id, kind, context) {
      access(id, context, kind);
      const row = selectAttachment.get(id, kind);
      if (!row) throw failure('NOT_FOUND');
      return { filename: row.filename, media_type: row.media_type, content: Buffer.from(row.content) };
    },
  };
}

module.exports = { createQuoteAttachmentService };
