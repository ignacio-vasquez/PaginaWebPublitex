function quoteNotEditable() {
  const error = new Error('La cotización ya no se puede editar.');
  error.code = 'QUOTE_NOT_EDITABLE';
  return error;
}

function createQuoteRepository({ database, now = Date.now }) {
  const insertQuote = database.prepare(`
    INSERT INTO quotes (id, user_id, created_at, updated_at)
    VALUES (?, ?, ?, ?)
  `);
  const listQuotes = database.prepare(`
    SELECT quotes.*, quote_numbers.number AS quote_number
    FROM quotes JOIN quote_numbers ON quote_numbers.quote_id = quotes.id
    WHERE user_id = ? ORDER BY created_at DESC, quote_number DESC
  `);
  const findQuote = database.prepare(`
    SELECT quotes.*, quote_numbers.number AS quote_number
    FROM quotes JOIN quote_numbers ON quote_numbers.quote_id = quotes.id
    WHERE quotes.id = ? AND user_id = ?
  `);
  const findEditable = database.prepare(`SELECT status FROM quotes WHERE id = ? AND user_id = ?`);
  const listItems = database.prepare(`
    SELECT * FROM quote_items WHERE quote_id = ? ORDER BY sort_order, id
  `);
  const listExtras = database.prepare(`
    SELECT extra_id, extra_label, unit_price
    FROM quote_item_extras WHERE quote_item_id = ? ORDER BY extra_id
  `);
  const updateDetails = database.prepare(`
    UPDATE quotes SET phone = ?, company = ?, updated_at = ?
    WHERE id = ? AND user_id = ? AND status = 'draft'
  `);
  const nextOrder = database.prepare(`
    SELECT COALESCE(MAX(sort_order), 0) + 1 AS next_order FROM quote_items WHERE quote_id = ?
  `);
  const insertItem = database.prepare(`
    INSERT INTO quote_items (
      id, quote_id, catalog_price_id, product_id, material_id, size_id, quantity_id,
      product_label, material_label, size_label, quantity_label, quantity_value,
      observation, estimated_subtotal, requires_evaluation, sort_order, created_at, updated_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);
  const findOwnedItem = database.prepare(`
    SELECT item.sort_order, item.created_at
    FROM quote_items AS item
    JOIN quotes AS quote ON quote.id = item.quote_id
    WHERE item.id = ? AND item.quote_id = ? AND quote.user_id = ?
  `);
  const updateItemStatement = database.prepare(`
    UPDATE quote_items SET
      catalog_price_id = ?, product_id = ?, material_id = ?, size_id = ?, quantity_id = ?,
      product_label = ?, material_label = ?, size_label = ?, quantity_label = ?, quantity_value = ?,
      observation = ?, estimated_subtotal = ?, requires_evaluation = ?, updated_at = ?
    WHERE id = ? AND quote_id = ?
  `);
  const deleteItemStatement = database.prepare(`DELETE FROM quote_items WHERE id = ? AND quote_id = ?`);
  const deleteExtras = database.prepare(`DELETE FROM quote_item_extras WHERE quote_item_id = ?`);
  const insertExtra = database.prepare(`
    INSERT INTO quote_item_extras (
      quote_item_id, catalog_price_id, extra_id, extra_label, unit_price
    ) VALUES (?, ?, ?, ?, ?)
  `);
  const aggregate = database.prepare(`
    SELECT
      COALESCE(SUM(COALESCE(estimated_subtotal, 0)), 0) AS estimated_total,
      COALESCE(MAX(requires_evaluation), 0) AS has_evaluation
    FROM quote_items WHERE quote_id = ?
  `);
  const updateAggregate = database.prepare(`
    UPDATE quotes SET estimated_total = ?, has_evaluation = ?, updated_at = ?
    WHERE id = ? AND user_id = ? AND status = 'draft'
  `);
  const submitQuote = database.prepare(`
    UPDATE quotes SET status = 'submitted', submitted_at = ?, updated_at = ?
    WHERE id = ? AND user_id = ? AND status = 'draft'
  `);

  function transaction(callback) {
    database.exec('BEGIN IMMEDIATE;');
    try {
      const result = callback();
      database.exec('COMMIT;');
      return result;
    } catch (error) {
      database.exec('ROLLBACK;');
      throw error;
    }
  }

  function ensureEditable(id, userId) {
    const quote = findEditable.get(id, userId);
    if (!quote) return false;
    if (quote.status !== 'draft') throw quoteNotEditable();
    return true;
  }

  function mapItem(row) {
    return {
      id: row.id,
      catalogPriceId: row.catalog_price_id,
      productId: row.product_id,
      materialId: row.material_id,
      sizeId: row.size_id,
      quantityId: row.quantity_id,
      productLabel: row.product_label,
      materialLabel: row.material_label,
      sizeLabel: row.size_label,
      quantityLabel: row.quantity_label,
      quantityValue: row.quantity_value,
      observation: row.observation,
      estimatedSubtotal: row.estimated_subtotal,
      requiresEvaluation: Boolean(row.requires_evaluation),
      extras: listExtras.all(row.id).map((extra) => ({
        id: extra.extra_id,
        label: extra.extra_label,
        unitPrice: extra.unit_price,
      })),
    };
  }

  function mapQuote(row) {
    if (!row) return null;
    const workflow = database.prepare('SELECT status, invoice_number, invoiced_at, payment_due_at FROM quote_workflow WHERE quote_id = ?').get(row.id);
    const events = database.prepare('SELECT actor_id, effective_role, status, created_at FROM quote_events WHERE quote_id = ? ORDER BY id').all(row.id);
    return {
      id: row.id,
      status: workflow?.status || row.status,
      invoiceNumber: workflow?.invoice_number || null,
      invoicedAt: workflow?.invoiced_at || null,
      paymentDueAt: workflow?.payment_due_at || null,
      events: events.map(event => ({ actorId: event.actor_id, effectiveRole: event.effective_role, status: event.status, createdAt: event.created_at })),
      code: `COT-${String(row.quote_number).padStart(6, '0')}`,
      phone: row.phone,
      company: row.company,
      estimatedTotal: row.estimated_total,
      hasEvaluation: Boolean(row.has_evaluation),
      createdAt: row.created_at,
      updatedAt: row.updated_at,
      submittedAt: row.submitted_at,
      items: listItems.all(row.id).map(mapItem),
    };
  }

  function recordEvent(quoteId, userId, status, timestamp, effectiveRole, actorId) {
    database.prepare(`INSERT INTO quote_events (quote_id, actor_id, effective_role, status, created_at)
      SELECT ?, COALESCE(?, d.real_user_id, u.id), COALESCE(?, u.role), ?, ? FROM users u
      LEFT JOIN simulation_users d ON d.user_id = u.id WHERE u.id = ?`)
      .run(quoteId, actorId || null, effectiveRole || null, status, timestamp, userId);
  }

  function writeExtras(item) {
    for (const extra of item.extras) {
      insertExtra.run(item.id, item.catalogPriceId, extra.id, extra.label, extra.unitPrice);
    }
  }

  function recompute(quoteId, userId, timestamp) {
    const totals = aggregate.get(quoteId);
    updateAggregate.run(totals.estimated_total, totals.has_evaluation, timestamp, quoteId, userId);
  }

  return {
    async createDraft({ id, userId, effectiveRole, actorId }) {
      return transaction(() => {
        const timestamp = now();
        insertQuote.run(id, userId, timestamp, timestamp);
        recordEvent(id, userId, 'draft', timestamp, effectiveRole, actorId);
        return mapQuote(findQuote.get(id, userId));
      });
    },

    async listByUser(userId) {
      return listQuotes.all(userId).map(mapQuote);
    },

    async findOwned(id, userId) {
      return mapQuote(findQuote.get(id, userId));
    },

    async saveDetails({ id, userId, phone, company }) {
      if (!ensureEditable(id, userId)) return null;
      updateDetails.run(phone, company, now(), id, userId);
      return mapQuote(findQuote.get(id, userId));
    },

    async addItem({ quoteId, userId, item }) {
      return transaction(() => {
        if (!ensureEditable(quoteId, userId)) return null;
        const timestamp = now();
        insertItem.run(
          item.id, quoteId, item.catalogPriceId, item.productId, item.materialId,
          item.sizeId, item.quantityId, item.productLabel, item.materialLabel,
          item.sizeLabel, item.quantityLabel, item.quantityValue, item.observation,
          item.estimatedSubtotal, item.requiresEvaluation ? 1 : 0,
          nextOrder.get(quoteId).next_order, timestamp, timestamp,
        );
        writeExtras(item);
        recompute(quoteId, userId, timestamp);
        return mapQuote(findQuote.get(quoteId, userId));
      });
    },

    async updateItem({ quoteId, itemId, userId, item }) {
      return transaction(() => {
        if (!ensureEditable(quoteId, userId)) return null;
        const existing = findOwnedItem.get(itemId, quoteId, userId);
        if (!existing) return null;
        const timestamp = now();
        deleteExtras.run(itemId);
        updateItemStatement.run(
          item.catalogPriceId, item.productId, item.materialId, item.sizeId, item.quantityId,
          item.productLabel, item.materialLabel, item.sizeLabel, item.quantityLabel,
          item.quantityValue, item.observation, item.estimatedSubtotal,
          item.requiresEvaluation ? 1 : 0, timestamp, itemId, quoteId,
        );
        writeExtras({ ...item, id: itemId });
        recompute(quoteId, userId, timestamp);
        return mapQuote(findQuote.get(quoteId, userId));
      });
    },

    async deleteItem({ quoteId, itemId, userId }) {
      return transaction(() => {
        if (!ensureEditable(quoteId, userId)) return null;
        if (!findOwnedItem.get(itemId, quoteId, userId)) return null;
        deleteItemStatement.run(itemId, quoteId);
        recompute(quoteId, userId, now());
        return mapQuote(findQuote.get(quoteId, userId));
      });
    },

    async submit({ id, userId, effectiveRole, actorId }) {
      return transaction(() => {
        if (!ensureEditable(id, userId)) return null;
        const timestamp = now();
        submitQuote.run(timestamp, timestamp, id, userId);
        recordEvent(id, userId, 'submitted', timestamp, effectiveRole, actorId);
        return mapQuote(findQuote.get(id, userId));
      });
    },
  };
}

module.exports = { createQuoteRepository };
