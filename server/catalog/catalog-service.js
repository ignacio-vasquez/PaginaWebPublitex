function invalidCatalogSelection() {
  const error = new Error('La selección del catálogo no es válida.');
  error.code = 'INVALID_CATALOG_SELECTION';
  return error;
}

function hasValidBasePrice(basePrice) {
  return Number.isInteger(basePrice) && basePrice >= 0;
}

function createCatalogService({ catalog }) {
  async function offeringEstimate(selection) {
    if (!selection || typeof selection.offeringId !== 'string') throw invalidCatalogSelection();
    const offering = await catalog.findOffering(selection.offeringId);
    const quantity = typeof selection.quantity === 'string' ? Number(selection.quantity.replace(',', '.')) : selection.quantity;
    if (!offering || !Number.isFinite(quantity) || quantity <= 0 || (offering.unit === 'UN' && !Number.isInteger(quantity))) throw invalidCatalogSelection();
    return { offering, quantity, estimatedTotal: offering.unitPrice * quantity };
  }
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
      return { ...(await catalog.listActiveOfferings()), products: await catalog.listActive() };
    },

    async estimate(selection) {
      if (selection?.offeringId) {
        const { offering, quantity, estimatedTotal } = await offeringEstimate(selection);
        return { selection: { offeringId: offering.id, quantity }, summary: { product: offering.label, category: offering.categoryLabel, unit: offering.unit, unitPrice: offering.unitPrice }, estimatedTotal, requiresEvaluation: false };
      }
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
      if (selection?.offeringId) {
        const { offering, quantity, estimatedTotal } = await offeringEstimate(selection);
        return { catalogPriceId: 'commercial-offering-price', productId: 'commercial-offering', materialId: 'commercial-offering-material', sizeId: 'commercial-offering-size', quantityId: 'commercial-offering-quantity', productLabel: offering.label, materialLabel: offering.categoryLabel, sizeLabel: offering.unit, quantityLabel: `${quantity} ${offering.unit}`, quantityValue: quantity, estimatedSubtotal: estimatedTotal, requiresEvaluation: false, extras: [], offeringId: offering.id, categoryLabel: offering.categoryLabel, unit: offering.unit, unitPrice: offering.unitPrice, isOffering: true };
      }
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
