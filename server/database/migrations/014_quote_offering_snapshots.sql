ALTER TABLE quote_items ADD COLUMN offering_id TEXT;
ALTER TABLE quote_items ADD COLUMN category_label TEXT;
ALTER TABLE quote_items ADD COLUMN unit TEXT;
ALTER TABLE quote_items ADD COLUMN unit_price INTEGER;
INSERT INTO catalog_products (id,label,calculation_type,sort_order) VALUES ('commercial-offering','Oferta comercial','fixed',99);
INSERT INTO catalog_materials (id,product_id,label,sort_order) VALUES ('commercial-offering-material','commercial-offering','Tarifa',1);
INSERT INTO catalog_sizes (id,product_id,label,sort_order) VALUES ('commercial-offering-size','commercial-offering','Según unidad',1);
INSERT INTO catalog_quantities (id,product_id,label,quantity,sort_order) VALUES ('commercial-offering-quantity','commercial-offering','Cantidad',1,1);
INSERT INTO catalog_prices (id,product_id,material_id,size_id,quantity_id,base_price) VALUES ('commercial-offering-price','commercial-offering','commercial-offering-material','commercial-offering-size','commercial-offering-quantity',0);
