# Plan: varios adjuntos por categoría

**Objetivo:** Cada carga agrega archivos sin reemplazar los anteriores. El usuario autorizó implementar varios adjuntos por categoría.

**Diseño:** Migración 015 conserva todos los archivos existentes y les asigna un identificador. El servicio crea un ID nuevo por carga y genera enlaces por categoría e ID. La ruta antigua descarga el último archivo para conservar compatibilidad. Se mantienen tipos, límite de 10 MB y permisos actuales. Gestión y Facturas listan todos los archivos por categoría y permiten selección múltiple con cargas secuenciales.

**Tecnología:** Node.js, Express, SQLite y JavaScript del navegador, sin dependencias nuevas.

## Tareas

- [x] Probar varias cargas, incluso con igual nombre, descargas independientes, aislamiento entre cotizaciones y preservación de registros antiguos.
- [x] Migrar `quote_attachments` a clave primaria `id`; agregar índice por cotización, categoría y fecha.
- [x] Actualizar `attachment-service.js` y `attachment-routes.js` con descargas por ID y compatibilidad de enlaces anteriores.
- [x] Actualizar `gestion.js` y `facturas.js`: listas completas, selección múltiple, manejo de fallos parciales y cancelación del selector.
- [x] Ejecutar pruebas de interfaz, servicio, HTTP y suite completa; revisar permisos de fotos finales y clientes ajenos.
- [x] Respaldar la base local, reiniciar el servidor para migrar y comprobar que COT-000009 conserva sus cuatro adjuntos.

Verificación: 229 pruebas aprobadas. Migración 015 aplicada localmente, integridad referencial correcta, cuatro adjuntos de COT-000009 conservados y servidor responde HTTP 200. Respaldo previo: `backups/publitex-20261008-181705.sqlite`.

No se agrega eliminación de archivos ni se modifica la factura oficial o el estado del trabajo.
