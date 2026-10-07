function toCatalogProduct(row) {
  return {
    id: row.id,
    label: row.label,
    calculationType: row.calculation_type,
    materials: [],
    sizes: [],
    quantities: [],
    extras: [],
  };
}

function normalizedExtraIds(extraIds) {
  if (!Array.isArray(extraIds) || extraIds.some((id) => typeof id !== 'string')) return null;
  return [...new Set(extraIds)].sort();
}

function createCatalogRepository({ database }) {
  const activeCategories = database.prepare('SELECT id, label FROM catalog_categories WHERE active=1 ORDER BY sort_order');
  const activeOfferings = database.prepare('SELECT id, category_id, label, unit, unit_price FROM catalog_offerings WHERE active=1 ORDER BY category_id, sort_order');
  const offeringById = database.prepare(`SELECT offering.id, offering.category_id, category.label AS category_label, offering.label, offering.unit, offering.unit_price FROM catalog_offerings offering JOIN catalog_categories category ON category.id=offering.category_id WHERE offering.id=? AND offering.active=1 AND category.active=1`);
  const products = database.prepare(`
    SELECT id, label, calculation_type
    FROM catalog_products
    WHERE active = 1
      AND id != 'commercial-offering'
      AND EXISTS (
        SELECT 1
        FROM catalog_prices AS price
        JOIN catalog_materials AS material ON material.id = price.material_id
        JOIN catalog_sizes AS size ON size.id = price.size_id
        JOIN catalog_quantities AS quantity ON quantity.id = price.quantity_id
        WHERE price.product_id = catalog_products.id
          AND price.active = 1
          AND material.active = 1
          AND size.active = 1
          AND quantity.active = 1
      )
    ORDER BY sort_order
  `);
  const materials = database.prepare(`
    SELECT material.product_id, material.id, material.label
    FROM catalog_materials AS material
    WHERE material.active = 1
      AND EXISTS (
        SELECT 1
        FROM catalog_prices AS price
        JOIN catalog_sizes AS size ON size.id = price.size_id
        JOIN catalog_quantities AS quantity ON quantity.id = price.quantity_id
        WHERE price.product_id = material.product_id
          AND price.material_id = material.id
          AND price.active = 1
          AND size.active = 1
          AND quantity.active = 1
      )
    ORDER BY material.product_id, material.sort_order
  `);
  const sizes = database.prepare(`
    SELECT size.product_id, size.id, size.label
    FROM catalog_sizes AS size
    WHERE size.active = 1
      AND EXISTS (
        SELECT 1
        FROM catalog_prices AS price
        JOIN catalog_materials AS material ON material.id = price.material_id
        JOIN catalog_quantities AS quantity ON quantity.id = price.quantity_id
        WHERE price.product_id = size.product_id
          AND price.size_id = size.id
          AND price.active = 1
          AND material.active = 1
          AND quantity.active = 1
      )
    ORDER BY size.product_id, size.sort_order
  `);
  const quantities = database.prepare(`
    SELECT quantity.product_id, quantity.id, quantity.label, quantity.quantity
    FROM catalog_quantities AS quantity
    WHERE quantity.active = 1
      AND EXISTS (
        SELECT 1
        FROM catalog_prices AS price
        JOIN catalog_materials AS material ON material.id = price.material_id
        JOIN catalog_sizes AS size ON size.id = price.size_id
        WHERE price.product_id = quantity.product_id
          AND price.quantity_id = quantity.id
          AND price.active = 1
          AND material.active = 1
          AND size.active = 1
      )
    ORDER BY quantity.product_id, quantity.sort_order
  `);
  const extras = database.prepare(`
    SELECT DISTINCT price.product_id, extra.id, extra.label, extra.sort_order
    FROM catalog_prices AS price
    JOIN catalog_materials AS material ON material.id = price.material_id
    JOIN catalog_sizes AS size ON size.id = price.size_id
    JOIN catalog_quantities AS quantity ON quantity.id = price.quantity_id
    JOIN catalog_price_extras AS price_extra ON price_extra.catalog_price_id = price.id
    JOIN catalog_extras AS extra ON extra.id = price_extra.extra_id
    WHERE price.active = 1
      AND material.active = 1
      AND size.active = 1
      AND quantity.active = 1
      AND price_extra.active = 1
      AND extra.active = 1
    ORDER BY price.product_id, extra.sort_order
  `);
  const configuration = database.prepare(`
    SELECT
      price.id AS catalog_price_id,
      product.id AS product_id,
      product.label AS product_label,
      product.calculation_type,
      material.id AS material_id,
      material.label AS material_label,
      size.id AS size_id,
      size.label AS size_label,
      quantity.id AS quantity_id,
      quantity.label AS quantity_label,
      quantity.quantity,
      price.base_price
    FROM catalog_prices AS price
    JOIN catalog_products AS product ON product.id = price.product_id
    JOIN catalog_materials AS material ON material.id = price.material_id
    JOIN catalog_sizes AS size ON size.id = price.size_id
    JOIN catalog_quantities AS quantity ON quantity.id = price.quantity_id
    WHERE price.product_id = ?
      AND price.material_id = ?
      AND price.size_id = ?
      AND price.quantity_id = ?
      AND price.active = 1
      AND product.active = 1
      AND material.active = 1
      AND size.active = 1
      AND quantity.active = 1
  `);
  const configurationExtras = database.prepare(`
    SELECT extra.id, extra.label, price_extra.unit_price
    FROM catalog_price_extras AS price_extra
    JOIN catalog_extras AS extra ON extra.id = price_extra.extra_id
    WHERE price_extra.catalog_price_id = ?
      AND price_extra.active = 1
      AND extra.active = 1
    ORDER BY extra.id
  `);

  return {
    async listActiveOfferings() {
      const categories = activeCategories.all().map((row) => ({ id: row.id, label: row.label, offerings: [] }));
      const byId = new Map(categories.map((category) => [category.id, category]));
      for (const row of activeOfferings.all()) byId.get(row.category_id)?.offerings.push({ id: row.id, label: row.label, unit: row.unit, unitPrice: row.unit_price });
      return { categories };
    },
    async findOffering(id) {
      const row = offeringById.get(id);
      return row && { id: row.id, categoryId: row.category_id, categoryLabel: row.category_label, label: row.label, unit: row.unit, unitPrice: row.unit_price };
    },
    async listActive() {
      const result = products.all().map(toCatalogProduct);
      const byId = new Map(result.map((product) => [product.id, product]));

      for (const row of materials.all()) {
        byId.get(row.product_id)?.materials.push({ id: row.id, label: row.label });
      }
      for (const row of sizes.all()) {
        byId.get(row.product_id)?.sizes.push({ id: row.id, label: row.label });
      }
      for (const row of quantities.all()) {
        byId.get(row.product_id)?.quantities.push({
          id: row.id, label: row.label, quantity: row.quantity,
        });
      }
      for (const row of extras.all()) {
        byId.get(row.product_id)?.extras.push({ id: row.id, label: row.label });
      }

      return result;
    },

    async findConfiguration({ productId, materialId, sizeId, quantityId, extraIds }) {
      const ids = normalizedExtraIds(extraIds);
      if (ids === null) return null;

      database.exec('BEGIN;');
      try {
        const row = configuration.get(productId, materialId, sizeId, quantityId);
        if (!row) return null;
        const extrasById = new Map(
          configurationExtras.all(row.catalog_price_id).map((extra) => [extra.id, extra]),
        );
        const resolvedExtras = ids.map((id) => extrasById.get(id));
        if (resolvedExtras.some((extra) => !extra)) return null;

        return {
          catalogPriceId: row.catalog_price_id,
          product: {
            id: row.product_id,
            label: row.product_label,
            calculationType: row.calculation_type,
          },
          material: { id: row.material_id, label: row.material_label },
          size: { id: row.size_id, label: row.size_label },
          quantity: { id: row.quantity_id, label: row.quantity_label, quantity: row.quantity },
          basePrice: row.base_price,
          extras: resolvedExtras.map((extra) => ({
            id: extra.id,
            label: extra.label,
            unitPrice: extra.unit_price,
          })),
        };
      } finally {
        database.exec('COMMIT;');
      }
    },
  };
}

module.exports = { createCatalogRepository };
