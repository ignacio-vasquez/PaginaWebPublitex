# Nombres y archivos por trabajo

## Objetivo

Facilitar la búsqueda de cotizaciones mediante un nombre de trabajo legible (por ejemplo, “Trabajo Quijote” o “Letrero luminoso Minimarket Medialuna”) y conservar los cuatro archivos operativos asociados a cada cotización. El cliente, el jefe y el trabajador podrán consultar los archivos en la etapa correspondiente. Para este borrador, la falta de archivos no impedirá avanzar por el flujo.

## Alcance aprobado

- Añadir a cada cotización un nombre editable y buscable, manteniendo su código `COT-xxxxxx` como identificador permanente. Si todavía no tiene nombre, mostrar el código.
- Permitir estos adjuntos por cotización:
  1. Presupuesto Excel (`.xlsx`).
  2. Factura PDF de respaldo.
  3. Fotomontaje JPG para mostrar al cliente.
  4. Foto JPG del trabajo terminado o instalado.
- Jefe (y superadmin) administra las cargas. Cliente, jefe, trabajador y superadmin pueden descargar los archivos según su acceso a la cotización y la etapa.
- Presupuesto, factura PDF de respaldo y fotomontaje quedan disponibles para el cliente desde el estado Aceptada. La foto del trabajo terminado queda disponible desde Entregada.
- Mantener operativos los controles Aceptar y Entregar aunque falten archivos. No añadir validaciones de presencia obligatoria en esta etapa.
- El nombre y los adjuntos se muestran en las listas y búsquedas de cotizaciones y trabajos; la búsqueda ignora mayúsculas y tildes.

## Alternativas consideradas

1. **Una tabla por tipo de archivo.** Ofrece esquemas específicos, pero duplica validación, descarga y control de permisos para cuatro archivos pequeños.
2. **Una tabla genérica de adjuntos por cotización (recomendada).** Un registro identifica tipo, nombre, MIME, contenido y auditoría; las reglas específicas se validan por tipo. Reduce duplicación y permite agregar otro tipo de adjunto después.
3. **Archivos en el sistema de archivos.** Evita guardar BLOBs en SQLite, pero requiere manejar copias de seguridad, rutas privadas y consistencia entre base de datos y archivos por separado.

Se elige la tabla genérica en SQLite porque el respaldo existente ya protege la base completa y el volumen esperado es acotado.

## Datos y almacenamiento

- Una migración posterior a `010_invoice_documents.sql` añade `quotes.work_name` y `quote_attachments`.
- `work_name` es texto opcional, recortado, con máximo de 120 caracteres. El formulario del cliente lo permite editar mientras la cotización es borrador. Jefe/superadmin pueden asignarlo o corregirlo durante la gestión.
- `quote_attachments` guarda `quote_id`, tipo (`budget`, `invoice_backup`, `preview`, `completion`), nombre de archivo saneado, MIME validado, contenido BLOB, SHA-256, fecha de carga e ID de quien lo cargó. Hay un archivo vigente por tipo y cotización; una nueva carga del jefe reemplaza el anterior y actualiza la auditoría.
- Tipos permitidos: XLSX real para presupuesto, PDF para factura de respaldo, JPEG para ambas imágenes. Rechazar tipos/extensiones que no correspondan y archivos vacíos. Límite inicial: 10 MB por archivo.
- Los adjuntos quedan dentro de SQLite y, por lo tanto, dentro del respaldo/restauración habitual. No se exponen como archivos estáticos.
- La factura PDF de respaldo es distinta de `quote_invoices`: no requiere folio, fecha ni monto, no aparece en “Facturas realizadas” y no cambia el estado de la cotización. El flujo de factura oficial actual queda intacto.

## Acceso y etapas

- Toda carga exige una sesión. Solo jefe/superadmin pueden cargar o reemplazar archivos.
- Un cliente solo puede ver y descargar adjuntos de sus propias cotizaciones. Jefe/superadmin siguen el alcance actual de gestión. Los trabajadores podrán acceder desde Aceptada hasta Entregada, de modo que tengan el fotomontaje y luego la foto final dentro de su flujo de trabajo.
- En el cliente, presupuesto, factura PDF de respaldo y fotomontaje se muestran cuando el estado es Aceptada o posterior. La foto final aparece cuando el estado es Entregada.
- El equipo puede cargar archivos desde la vista de gestión antes o después del cambio de estado; su disponibilidad para el cliente depende del estado anterior. Esto permite preparar los archivos al revisar/aceptar sin filtrarlos antes.
- El servicio de transición no exige adjuntos. Si falta alguno, los controles de estado siguen funcionando y el archivo correspondiente simplemente no aparece.
- Las descargas usan rutas autenticadas, `Cache-Control: private, no-store`, `X-Content-Type-Options: nosniff` y `Content-Disposition: attachment`.

## Interfaz y búsqueda

- `cotizaciones.html` añade un campo de nombre al editor, un buscador sobre el historial y enlaces de descarga visibles para el dueño según la etapa.
- `gestion.html` muestra el nombre junto al código, permite buscar por nombre/código y ofrece al jefe los cuatro controles de carga y descarga. Los trabajadores ven las descargas permitidas.
- `facturas.html` incluye el nombre en sus tarjetas y en el índice de búsqueda, sin confundir el PDF de respaldo con la factura oficial que ya se archiva ahí.
- La carga informa tipo esperado, nombre del archivo y resultado. Errores de formato y tamaño se explican junto al control; las respuestas API usan 400/403/404/413 según corresponda.

## Componentes a modificar

- Migraciones, `quote-repository.js` y `quote-service.js` para el nombre.
- Un servicio de adjuntos y rutas autenticadas, integrado en `server.js`/`app.js`, sin acoplar los archivos de respaldo al servicio de factura oficial.
- Visibilidad de cotizaciones de trabajador para incluir desde Aceptada, preservando el resto de controles de rol/estado.
- `cotizaciones.html`/`js/cotizaciones.js`, `gestion.html`/`js/gestion.js`, y `facturas.html`/`js/facturas.js`; estilos en `css/styles.css`.

## Criterios de aceptación

1. El cliente o el jefe puede asignar un nombre; el código permanente permanece visible y cotizaciones viejas aparecen con su código como nombre alternativo.
2. Cliente y equipo pueden encontrar la cotización por nombre o código en sus listas pertinentes, sin distinguir tildes o mayúsculas.
3. Jefe/superadmin puede cargar el archivo correcto para cada tipo y reemplazarlo; extensiones/MIME incorrectos, contenido no coincidente, vacío o mayor a 10 MB se rechazan.
4. Los permisos por dueño/rol se aplican tanto a metadatos como a descargas; un ID ajeno no permite obtener un archivo.
5. Cliente ve los tres primeros adjuntos desde Aceptada y la foto final desde Entregada; trabajadores pueden verlos desde Aceptada y jefe/superadmin siguen con acceso de gestión.
6. Aceptar y Entregar siguen funcionando sin ninguno de los archivos.
7. La factura de respaldo no cambia estado ni sustituye la factura oficial actual; los archivos nuevos sobreviven al ciclo normal de respaldo y restauración.

## Fuera de alcance

- Hacer obligatorios los adjuntos antes de aceptar o entregar.
- Enviar correos/notificaciones automáticas; “enviar” significa que el documento queda disponible para el cliente en su espacio privado.
- Versionado/historial de archivos reemplazados, vista previa embebida, conversión de Excel o edición administrativa del catálogo.
- Cambios al formato, extracción de datos o archivo contable de las facturas oficiales existentes.
