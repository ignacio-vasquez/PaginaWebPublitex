# Cotización formal y revisión de diseños

## Objetivo

Separar la simulación pública de la solicitud formal de cotización. La simulación entrega un valor referencial a partir de opciones estándar. La cotización de un cliente autenticado recoge el trabajo solicitado, sus datos comerciales y los archivos de diseño por producto, sin mostrar precios hasta que el equipo prepare una propuesta final.

El equipo debe poder revisar cada diseño, explicar por qué un archivo no sirve y recibir una corrección del cliente antes de aceptar el trabajo. Cuando Publitex deba crear un diseño, ese trabajo y su costo adicional deben quedar definidos antes de la aceptación.

## Alcance

### Simulación pública

- `index.html` mantiene el simulador actual con opciones estándar y estimación referencial.
- El simulador puede llevar a una cuenta autenticada con la selección inicial, pero no convierte la estimación en un compromiso comercial.
- La simulación conserva sus precios y no solicita forma de pago, datos tributarios ni archivos de diseño.

### Cotización formal

- `cotizacion.html` pasa a ser una pantalla para agregar un producto a una cotización formal; no reutiliza el resultado de estimación ni muestra precios.
- Cada producto solicita: producto, material, extras disponibles, medida o cobertura libre, cantidad libre con su unidad, observación y modalidad de diseño.
- La medida o cobertura admite textos como `120 x 70 cm`, `rotulación completa` o `cubierta trasera`. La cantidad se captura como valor escrito por el cliente para evitar restringir trabajos a medidas estándar.
- La modalidad de diseño tiene dos alternativas:
  - **Adjunto mi diseño**: requiere un archivo PDF, JPG o PNG asociado al producto.
  - **Necesito diseño de Publitex**: no requiere archivo y deja el producto marcado para definición de alcance y costo adicional.
- El borrador muestra los productos y sus detalles, pero no subtotales ni total estimado.

## Datos comerciales y envío

Antes de enviar una cotización el cliente debe completar teléfono, empresa, nombre del trabajo, forma de pago y si requiere factura.

- La forma de pago se guarda como una preferencia comercial, inicialmente con alternativas empresariales configuradas en la interfaz: transferencia bancaria, efectivo, tarjeta y crédito.
- `Requiere factura` es independiente de la forma de pago. Cuando se selecciona, razón social y RUT son obligatorios.
- El servidor valida todos estos campos al enviar, además de exigir al menos un producto.
- Una cotización enviada deja de poder editarse libremente. Las únicas correcciones permitidas al cliente son las que el flujo de revisión habilita para un producto rechazado.

## Revisión de diseños y estados

Cada producto tiene un estado de diseño independiente:

| Estado | Significado |
| --- | --- |
| `pending_review` | El cliente adjuntó un archivo y espera revisión. |
| `approved` | El archivo está apto para la fabricación. |
| `rejected` | Un miembro del equipo lo rechazó e indicó cómo corregirlo. |
| `publitex_design` | Publitex preparará el diseño; falta definir y acordar su alcance comercial. |

Los archivos se guardan por versión. Al reemplazar un diseño rechazado, el nuevo archivo se vuelve `pending_review`, se preservan el archivo anterior y el comentario de revisión, y el producto vuelve a la cola del equipo.

El estado general de la cotización sigue este recorrido:

1. `draft`: el cliente prepara la solicitud.
2. `submitted`: el cliente la envía.
3. `in_review`: el jefe o un trabajador revisa productos, archivos y condiciones.
4. `changes_required`: hay al menos un diseño rechazado. El cliente puede leer el comentario y reemplazar solo el archivo afectado, o escoger diseño de Publitex si corresponde.
5. `pending_confirmation`: todos los diseños están aprobados o resueltos por Publitex, y el equipo deja la propuesta comercial final disponible para el cliente.
6. `accepted`: el cliente confirma la propuesta final; a partir de aquí continúa el flujo actual de facturación, producción, listo y entrega.

El jefe y los trabajadores pueden ver cotizaciones enviadas desde `submitted`, abrir los archivos de cada producto y aprobar o rechazar diseños con un comentario obligatorio al rechazar. La aceptación queda bloqueada mientras exista un producto pendiente, rechazado o con diseño de Publitex sin resolver.

## Precio y propuesta final

Los cálculos de catálogo pueden seguir existiendo internamente para que el equipo prepare presupuestos, pero no se exponen en la solicitud formal ni en la lista de cotizaciones del cliente.

La única cifra comercial presentada al cliente será la propuesta final preparada por el equipo en `pending_confirmation`. Debe incluir los cargos adicionales por diseño de Publitex cuando existan. El cliente debe confirmarla para que la cotización llegue a `accepted`.

## Persistencia y archivos

- Añadir una migración aditiva para los campos comerciales de `quotes`, los campos de solicitud libre en `quote_items`, el historial de diseños por producto y los comentarios de revisión.
- Mantener las cotizaciones y adjuntos existentes intactos. Los productos históricos sin datos de diseño se consideran fuera del nuevo ciclo de revisión.
- Validar en servidor los tipos PDF, JPG y PNG, el tamaño máximo y la pertenencia del producto a la cotización del cliente.
- Los clientes solo descargan y reemplazan archivos de sus propias cotizaciones; el equipo puede revisar las cotizaciones que entren al flujo de trabajo.

## Catálogo: letrero luminoso

- Retirar `Iluminación` como extra seleccionable de los productos.
- Crear `Letrero luminoso` como producto independiente, con los mismos materiales, medidas y cantidades estándar del letrero rectangular para la simulación.
- Usar precios internos provisionales mayores que los del letrero rectangular. Esos precios quedan preparados para ser reemplazados cuando Publitex defina sus valores reales.
- Los registros históricos que ya incluyan el extra de iluminación conservan su snapshot y no cambian.

## Interfaz y accesibilidad

- La modalidad de diseño se presenta junto a los extras de cada producto para que la decisión se tome en el mismo contexto.
- La carga de archivo indica los formatos aceptados y el archivo asociado al producto; los estados y comentarios se anuncian mediante regiones accesibles ya presentes en la interfaz.
- La vista de seguimiento identifica los productos rechazados, el comentario correspondiente y la acción de reemplazar su archivo.
- La pantalla de gestión muestra un bloque por producto con sus medidas, cantidad, extras, observación, modalidad de diseño, archivo actual e historial de revisión.

## Pruebas

- Pruebas de migración, repositorio y servicio para los nuevos campos, estados, bloqueos y preservación de historiales.
- Pruebas HTTP de permisos de carga, descarga, revisión y reemplazo de archivos.
- Pruebas de interfaz para la distinción entre simulación y cotización formal, los campos comerciales, los estados por producto y la ausencia de precios durante la solicitud.
- Pruebas del catálogo para la retirada de iluminación y el nuevo producto letrero luminoso.
