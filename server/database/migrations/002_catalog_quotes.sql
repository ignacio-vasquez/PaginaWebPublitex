CREATE TABLE catalog_products (
  id TEXT PRIMARY KEY,
  label TEXT NOT NULL,
  calculation_type TEXT NOT NULL CHECK (calculation_type IN ('fixed', 'evaluation')),
  active INTEGER NOT NULL DEFAULT 1 CHECK (active IN (0, 1)),
  sort_order INTEGER NOT NULL CHECK (sort_order > 0)
);

CREATE TABLE catalog_materials (
  id TEXT PRIMARY KEY,
  product_id TEXT NOT NULL REFERENCES catalog_products(id),
  label TEXT NOT NULL,
  active INTEGER NOT NULL DEFAULT 1 CHECK (active IN (0, 1)),
  sort_order INTEGER NOT NULL CHECK (sort_order > 0),
  UNIQUE (product_id, id)
);

CREATE TABLE catalog_sizes (
  id TEXT PRIMARY KEY,
  product_id TEXT NOT NULL REFERENCES catalog_products(id),
  label TEXT NOT NULL,
  active INTEGER NOT NULL DEFAULT 1 CHECK (active IN (0, 1)),
  sort_order INTEGER NOT NULL CHECK (sort_order > 0),
  UNIQUE (product_id, id)
);

CREATE TABLE catalog_quantities (
  id TEXT PRIMARY KEY,
  product_id TEXT NOT NULL REFERENCES catalog_products(id),
  label TEXT NOT NULL,
  quantity INTEGER NOT NULL CHECK (quantity > 0),
  active INTEGER NOT NULL DEFAULT 1 CHECK (active IN (0, 1)),
  sort_order INTEGER NOT NULL CHECK (sort_order > 0),
  UNIQUE (product_id, id)
);

CREATE TABLE catalog_extras (
  id TEXT PRIMARY KEY,
  label TEXT NOT NULL,
  active INTEGER NOT NULL DEFAULT 1 CHECK (active IN (0, 1)),
  sort_order INTEGER NOT NULL CHECK (sort_order > 0)
);

CREATE TABLE catalog_prices (
  id TEXT PRIMARY KEY,
  product_id TEXT NOT NULL REFERENCES catalog_products(id),
  material_id TEXT NOT NULL,
  size_id TEXT NOT NULL,
  quantity_id TEXT NOT NULL,
  base_price INTEGER CHECK (base_price IS NULL OR base_price >= 0),
  active INTEGER NOT NULL DEFAULT 1 CHECK (active IN (0, 1)),
  FOREIGN KEY (product_id, material_id) REFERENCES catalog_materials(product_id, id),
  FOREIGN KEY (product_id, size_id) REFERENCES catalog_sizes(product_id, id),
  FOREIGN KEY (product_id, quantity_id) REFERENCES catalog_quantities(product_id, id),
  UNIQUE (product_id, material_id, size_id, quantity_id),
  UNIQUE (id, product_id, material_id, size_id, quantity_id)
);

CREATE TABLE catalog_price_extras (
  catalog_price_id TEXT NOT NULL REFERENCES catalog_prices(id) ON DELETE CASCADE,
  extra_id TEXT NOT NULL REFERENCES catalog_extras(id),
  unit_price INTEGER NOT NULL CHECK (unit_price >= 0),
  active INTEGER NOT NULL DEFAULT 1 CHECK (active IN (0, 1)),
  PRIMARY KEY (catalog_price_id, extra_id)
);

CREATE TABLE quotes (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id),
  status TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'submitted')),
  phone TEXT,
  company TEXT,
  estimated_total INTEGER NOT NULL DEFAULT 0 CHECK (estimated_total >= 0),
  has_evaluation INTEGER NOT NULL DEFAULT 0 CHECK (has_evaluation IN (0, 1)),
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL,
  submitted_at INTEGER
);

CREATE TABLE quote_items (
  id TEXT PRIMARY KEY,
  quote_id TEXT NOT NULL REFERENCES quotes(id) ON DELETE CASCADE,
  catalog_price_id TEXT NOT NULL,
  product_id TEXT NOT NULL,
  material_id TEXT NOT NULL,
  size_id TEXT NOT NULL,
  quantity_id TEXT NOT NULL,
  product_label TEXT NOT NULL,
  material_label TEXT NOT NULL,
  size_label TEXT NOT NULL,
  quantity_label TEXT NOT NULL,
  quantity_value INTEGER NOT NULL CHECK (quantity_value > 0),
  observation TEXT NOT NULL DEFAULT '',
  estimated_subtotal INTEGER CHECK (estimated_subtotal IS NULL OR estimated_subtotal >= 0),
  requires_evaluation INTEGER NOT NULL DEFAULT 0 CHECK (requires_evaluation IN (0, 1)),
  sort_order INTEGER NOT NULL CHECK (sort_order > 0),
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL,
  FOREIGN KEY (catalog_price_id, product_id, material_id, size_id, quantity_id)
    REFERENCES catalog_prices(id, product_id, material_id, size_id, quantity_id)
);

CREATE TABLE quote_item_extras (
  quote_item_id TEXT NOT NULL REFERENCES quote_items(id) ON DELETE CASCADE,
  extra_id TEXT NOT NULL REFERENCES catalog_extras(id),
  extra_label TEXT NOT NULL,
  unit_price INTEGER NOT NULL CHECK (unit_price >= 0),
  PRIMARY KEY (quote_item_id, extra_id)
);

CREATE INDEX catalog_materials_product_idx ON catalog_materials(product_id, sort_order);
CREATE INDEX catalog_sizes_product_idx ON catalog_sizes(product_id, sort_order);
CREATE INDEX catalog_quantities_product_idx ON catalog_quantities(product_id, sort_order);
CREATE INDEX catalog_prices_selection_idx
  ON catalog_prices(product_id, material_id, size_id, quantity_id);
CREATE INDEX catalog_price_extras_price_idx ON catalog_price_extras(catalog_price_id);
CREATE INDEX quotes_user_status_idx ON quotes(user_id, status, updated_at DESC);
CREATE INDEX quote_items_quote_order_idx ON quote_items(quote_id, sort_order);
CREATE INDEX quote_item_extras_item_idx ON quote_item_extras(quote_item_id);

INSERT OR IGNORE INTO catalog_products (id, label, calculation_type, sort_order) VALUES
  ('sign-rect', 'Letrero rectangular', 'fixed', 1),
  ('sticker-print', 'Adhesivo impreso', 'fixed', 2),
  ('banner', 'Pendón publicitario', 'fixed', 3),
  ('vehicle-wrap', 'Rotulación vehicular', 'evaluation', 4);

INSERT OR IGNORE INTO catalog_materials (id, product_id, label, sort_order) VALUES
  ('pvc-foam', 'sign-rect', 'PVC espumado', 1),
  ('acrylic', 'sign-rect', 'Acrílico', 2),
  ('aluminium-composite', 'sign-rect', 'Aluminio compuesto', 3),
  ('vinyl-white', 'sticker-print', 'Vinilo blanco', 1),
  ('vinyl-transparent', 'sticker-print', 'Vinilo transparente', 2),
  ('vinyl-microperforated', 'sticker-print', 'Vinilo microperforado', 3),
  ('canvas-standard', 'banner', 'Lona estándar', 1),
  ('canvas-reinforced', 'banner', 'Lona reforzada', 2),
  ('vehicle-car', 'vehicle-wrap', 'Automóvil', 1),
  ('vehicle-pickup', 'vehicle-wrap', 'Camioneta', 2),
  ('vehicle-van', 'vehicle-wrap', 'Furgón', 3);

INSERT OR IGNORE INTO catalog_sizes (id, product_id, label, sort_order) VALUES
  ('50x30', 'sign-rect', '50 × 30 cm', 1),
  ('100x50', 'sign-rect', '100 × 50 cm', 2),
  ('150x75', 'sign-rect', '150 × 75 cm', 3),
  ('a4', 'sticker-print', 'A4', 1),
  ('50x50', 'sticker-print', '50 × 50 cm', 2),
  ('100x100', 'sticker-print', '100 × 100 cm', 3),
  ('80x180', 'banner', '80 × 180 cm', 1),
  ('100x200', 'banner', '100 × 200 cm', 2),
  ('200x100', 'banner', '200 × 100 cm', 3),
  ('coverage-partial', 'vehicle-wrap', 'Cobertura parcial', 1),
  ('coverage-full', 'vehicle-wrap', 'Cobertura completa', 2);

INSERT OR IGNORE INTO catalog_quantities (id, product_id, label, quantity, sort_order) VALUES
  ('sign-rect-qty-1', 'sign-rect', '1 unidad', 1, 1),
  ('sign-rect-qty-2', 'sign-rect', '2 unidades', 2, 2),
  ('sign-rect-qty-5', 'sign-rect', '5 unidades', 5, 3),
  ('sticker-print-qty-10', 'sticker-print', '10 unidades', 10, 1),
  ('sticker-print-qty-50', 'sticker-print', '50 unidades', 50, 2),
  ('sticker-print-qty-100', 'sticker-print', '100 unidades', 100, 3),
  ('banner-qty-1', 'banner', '1 unidad', 1, 1),
  ('banner-qty-2', 'banner', '2 unidades', 2, 2),
  ('banner-qty-5', 'banner', '5 unidades', 5, 3),
  ('vehicle-wrap-qty-1', 'vehicle-wrap', '1 vehículo', 1, 1);

INSERT OR IGNORE INTO catalog_extras (id, label, sort_order) VALUES
  ('lighting', 'Iluminación', 1),
  ('installation', 'Instalación', 2),
  ('eyelets', 'Ojales', 3),
  ('structure', 'Estructura', 4);

INSERT OR IGNORE INTO catalog_prices (
  id, product_id, material_id, size_id, quantity_id, base_price
)
SELECT
  p.id || ':' || m.id || ':' || s.id || ':' || q.id,
  p.id,
  m.id,
  s.id,
  q.id,
  CASE p.calculation_type
    WHEN 'evaluation' THEN NULL
    ELSE CASE p.id
      WHEN 'sign-rect' THEN 15000
      WHEN 'sticker-print' THEN 500
      WHEN 'banner' THEN 18000
    END + ((m.sort_order - 1) * 1000) + ((s.sort_order - 1) * 2000)
  END
FROM catalog_products AS p
JOIN catalog_materials AS m ON m.product_id = p.id
JOIN catalog_sizes AS s ON s.product_id = p.id
JOIN catalog_quantities AS q ON q.product_id = p.id;

INSERT OR IGNORE INTO catalog_price_extras (catalog_price_id, extra_id, unit_price)
SELECT price.id, extra.id,
  CASE extra.id
    WHEN 'lighting' THEN 8000
    WHEN 'installation' THEN 6000
  END
FROM catalog_prices AS price
JOIN catalog_extras AS extra ON extra.id IN ('lighting', 'installation')
WHERE price.product_id = 'sign-rect';

INSERT OR IGNORE INTO catalog_price_extras (catalog_price_id, extra_id, unit_price)
SELECT price.id, 'installation', 3000
FROM catalog_prices AS price
WHERE price.product_id = 'sticker-print';

INSERT OR IGNORE INTO catalog_price_extras (catalog_price_id, extra_id, unit_price)
SELECT price.id, extra.id,
  CASE extra.id
    WHEN 'installation' THEN 8000
    WHEN 'eyelets' THEN 1500
    WHEN 'structure' THEN 12000
  END
FROM catalog_prices AS price
JOIN catalog_extras AS extra ON extra.id IN ('installation', 'eyelets', 'structure')
WHERE price.product_id = 'banner';
