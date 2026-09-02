function invalidCatalogSelection() {
  const error = new Error('La selección del catálogo no es válida.');
  error.code = 'INVALID_CATALOG_SELECTION';
  return error;
}

function hasValidBasePrice(basePrice) {
  return Number.isInteger(basePrice) && basePrice >= 0;
}

function createCatalogService({ catalog }) {
  async function resolveSelection(selection) {
    if (!selection || typeof selection !== 'object') throw invalidCatalogSelection();
    const configuration = await catalog.findConfiguration({
      productId: selection.productId,
      materialId: selection.materialId,
      sizeId: selection.sizeId,
      quantityId: selection.quantityId,
      extraIds: selection.extraIds,
    });
    if (!configuration) throw invalidCatalogSelection();
    const requiresEvaluation = configuration.product.calculationType === 'evaluation';
    if (!requiresEvaluation && !hasValidBasePrice(configuration.basePrice)) {
      throw invalidCatalogSelection();
    }
    return { configuration, requiresEvaluation };
  }

  function calculatedTotal(configuration, requiresEvaluation) {
    return requiresEvaluation
      ? null
      : (configuration.basePrice + configuration.extras.reduce(
        (total, extra) => total + extra.unitPrice,
        0,
      )) * configuration.quantity.quantity;
  }

  return {
    async getCatalog() {
      return { products: await catalog.listActive() };
    },

    async estimate(selection) {
      const { configuration, requiresEvaluation } = await resolveSelection(selection);

      const normalizedSelection = {
        productId: configuration.product.id,
        materialId: configuration.material.id,
        sizeId: configuration.size.id,
        quantityId: configuration.quantity.id,
        extraIds: configuration.extras.map((extra) => extra.id),
      };
      const summary = {
        product: configuration.product.label,
        material: configuration.material.label,
        size: configuration.size.label,
        quantity: configuration.quantity.label,
        extras: configuration.extras.map((extra) => extra.label),
      };
      const estimatedTotal = calculatedTotal(configuration, requiresEvaluation);

      return { selection: normalizedSelection, summary, estimatedTotal, requiresEvaluation };
    },

    async prepareQuoteItem(selection) {
      const { configuration, requiresEvaluation } = await resolveSelection(selection);
      return {
        catalogPriceId: configuration.catalogPriceId,
        productId: configuration.product.id,
        materialId: configuration.material.id,
        sizeId: configuration.size.id,
        quantityId: configuration.quantity.id,
        productLabel: configuration.product.label,
        materialLabel: configuration.material.label,
        sizeLabel: configuration.size.label,
        quantityLabel: configuration.quantity.label,
        quantityValue: configuration.quantity.quantity,
        estimatedSubtotal: calculatedTotal(configuration, requiresEvaluation),
        requiresEvaluation,
        extras: configuration.extras.map((extra) => ({
          id: extra.id,
          label: extra.label,
          unitPrice: extra.unitPrice,
        })),
      };
    },
  };
}

module.exports = { createCatalogService };
