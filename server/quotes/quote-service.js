function publicError(code, message) {
  const error = new Error(message);
  error.code = code;
  return error;
}

function normalizeText(value, { field, maxLength, required = false }) {
  if (value === undefined || value === null) value = '';
  if (typeof value !== 'string') {
    throw publicError('INVALID_QUOTE', `${field} no es válido.`);
  }
  const normalized = value.trim();
  if ((required && !normalized) || normalized.length > maxLength) {
    throw publicError('INVALID_QUOTE', `${field} no es válido.`);
  }
  return normalized;
}

function normalizePhone(value, required = false) {
  const phone = normalizeText(value, { field: 'El teléfono', maxLength: 40, required });
  if (!phone && !required) return '';
  if (!/^[+\d\s().-]+$/.test(phone)) {
    throw publicError('INVALID_QUOTE', 'El teléfono no es válido.');
  }
  const digits = phone.replace(/\D/g, '');
  if (digits.length < 8 || digits.length > 15) {
    throw publicError('INVALID_QUOTE', 'El teléfono debe contener entre 8 y 15 dígitos.');
  }
  return phone;
}

function createQuoteService({ quotes, catalogService, createId }) {
  if (!quotes || !catalogService || typeof createId !== 'function') {
    throw new TypeError('quotes, catalogService y createId son obligatorios.');
  }

  async function pricedItem(input, id) {
    const snapshot = await catalogService.prepareQuoteItem(input);
    return {
      id,
      ...snapshot,
      observation: normalizeText(input?.observation, {
        field: 'La observación', maxLength: 1000,
      }),
    };
  }

  return {
    list(userId) {
      return quotes.listByUser(userId);
    },

    get(id, userId) {
      return quotes.findOwned(id, userId);
    },

    createDraft(userId, audit) {
      return quotes.createDraft({ id: createId(), userId, ...audit });
    },

    async saveDetails(id, userId, details = {}) {
      return quotes.saveDetails({
        id,
        userId,
        phone: normalizePhone(details.phone),
        company: normalizeText(details.company, { field: 'La empresa', maxLength: 160 }),
      });
    },

    async addItem(quoteId, userId, input) {
      const item = await pricedItem(input, createId());
      return quotes.addItem({ quoteId, userId, item });
    },

    async updateItem(quoteId, itemId, userId, input) {
      const item = await pricedItem(input, itemId);
      return quotes.updateItem({ quoteId, itemId, userId, item });
    },

    deleteItem(quoteId, itemId, userId) {
      return quotes.deleteItem({ quoteId, itemId, userId });
    },

    async submit(id, userId, audit) {
      const quote = await quotes.findOwned(id, userId);
      if (!quote) return null;
      if (quote.status !== 'draft') {
        throw publicError('QUOTE_NOT_EDITABLE', 'La cotización ya no se puede editar.');
      }
      if (quote.items.length === 0) {
        throw publicError('QUOTE_EMPTY', 'Agrega al menos un producto antes de enviar.');
      }
      normalizePhone(quote.phone, true);
      return quotes.submit({ id, userId, ...audit });
    },
  };
}

module.exports = { createQuoteService };
