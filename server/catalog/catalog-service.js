function invalidCatalogSelection() {
  const error = new Error('La selección del catálogo no es válida.');
  error.code = 'INVALID_CATALOG_SELECTION';
  return error;
}

function hasValidBasePrice(basePrice) {
  return Number.isInteger(basePrice) && basePrice >= 0;
}

function createCatalogService({ catalog }) {
  return {
    async getCatalog() {
      return { products: await catalog.listActive() };
    },

    async estimate(selection) {
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
      const estimatedTotal = requiresEvaluation
        ? null
        : (configuration.basePrice + configuration.extras.reduce(
          (total, extra) => total + extra.unitPrice,
          0,
        )) * configuration.quantity.quantity;

      return { selection: normalizedSelection, summary, estimatedTotal, requiresEvaluation };
    },
  };
}

module.exports = { createCatalogService };
