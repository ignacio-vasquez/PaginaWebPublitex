# Simulador público y cotizaciones persistentes

## Objetivo

Separar claramente una estimación pública de una cotización real. La página principal ofrecerá un simulador basado únicamente en opciones predefinidas, mientras que la creación, edición y envío de cotizaciones exigirá una cuenta autenticada y persistirá en SQLite.

La configuración elegida en el simulador podrá continuar automáticamente después del inicio de sesión. El servidor será la única autoridad para validar combinaciones y calcular valores; el navegador nunca decidirá precios.

## Alcance de esta etapa

Esta etapa incluye:

- reemplazar el formulario actual de la página principal por un simulador público;
- crear un catálogo demostrativo persistente en SQLite;
- ofrecer únicamente productos, materiales, medidas, cantidades y extras válidos mediante controles cerrados;
- calcular estimaciones en el servidor;
- exigir inicio de sesión antes de crear una cotización real;
- conservar temporalmente la simulación durante el acceso;
- crear una página privada para cotizaciones;
- admitir borradores con varios productos;
- guardar automáticamente los borradores;
- enviar una cotización mediante una acción separada y confirmada;
- listar borradores y cotizaciones enviadas del usuario;
- conservar los datos después de reiniciar el servidor.

Quedan fuera:

- la tabla definitiva de precios del jefe;
- una interfaz administrativa para editar el catálogo;
- decisiones, asignaciones y avances de trabajador o jefe;
- solicitudes de cambio posteriores al envío;
- archivos adjuntos;
- pagos, facturación o precios contractuales.

Estas capacidades podrán añadirse después sobre las entidades persistentes creadas aquí.

## Separación de experiencias

### Simulador público

La sección actual de cotización en `index.html` pasará a llamarse **Simula tu proyecto**. Cualquier visitante podrá:

1. seleccionar un producto;
2. elegir únicamente materiales compatibles;
3. elegir una medida disponible;
4. seleccionar una cantidad permitida;
5. agregar extras compatibles;
6. solicitar al servidor una estimación;
7. ver el total, el resumen y un aviso de valor referencial.

La acción final se llamará **Cotizar este proyecto**. Si no existe una sesión activa, abrirá la página de acceso. No se creará una cotización ni un borrador antes de autenticar al usuario.

### Cotización privada

Después del acceso, el usuario será dirigido a `cotizaciones.html`. La configuración simulada se agregará como el primer producto de un borrador, después de que el servidor vuelva a validar el catálogo y recalcular el valor.

La página privada permitirá:

- consultar borradores y cotizaciones enviadas propias;
- crear un borrador vacío;
- agregar varios productos;
- editar o eliminar productos mientras el estado sea borrador;
- completar teléfono y empresa;
- consultar subtotales y total estimado;
- enviar el borrador con confirmación.

Nombre y correo se obtendrán de la cuenta. No se pedirán nuevamente ni se aceptarán desde el navegador como autoridad de identidad.

La página **Mi cuenta** incorporará un acceso visible a **Mis cotizaciones**.

## Catálogo demostrativo

El catálogo se almacenará en SQLite y será la fuente única de opciones y precios. Los datos serán reconocibles como demostrativos y se podrán reemplazar posteriormente por la tabla real del jefe.

Los grupos iniciales serán:

- **Letrero rectangular:** PVC espumado, acrílico o aluminio compuesto; medidas predefinidas; extras de iluminación e instalación cuando sean compatibles.
- **Adhesivo impreso:** vinilo blanco, transparente o microperforado; formatos y cantidades predefinidos.
- **Pendón publicitario:** lona estándar o reforzada; medidas y terminaciones predefinidas.
- **Rotulación vehicular:** tipo de vehículo y cobertura predefinidos, sin precio automático; el resultado será **Requiere evaluación**.

Producto, material, medida, cantidad y extras se seleccionarán siempre desde controles cerrados. Existirá una observación opcional de texto libre para aportar contexto, pero nunca alterará el cálculo.

Cada opción del catálogo tendrá estado activo. Las cotizaciones conservarán una instantánea del nombre y valor estimado usados al agregarlas, para que un cambio posterior del catálogo no reescriba silenciosamente solicitudes anteriores.

## Modelo persistente

Una nueva migración agregará como mínimo:

- `catalog_products`: producto, código estable, estado y tipo de cálculo;
- `catalog_materials`: materiales disponibles por producto;
- `catalog_sizes`: dimensiones o formatos predefinidos;
- `catalog_quantities`: cantidades permitidas;
- `catalog_extras`: extras compatibles;
- tablas o relaciones de precios para combinaciones válidas;
- `quotes`: propietario, estado, teléfono, empresa, total estimado y fechas;
- `quote_items`: producto, selección validada, cantidad, observación, instantánea descriptiva, subtotal y orden.

Los estados incluidos en esta etapa serán `draft` y `submitted`. El paso de `draft` a `submitted` será irreversible mediante la API de edición. Las solicitudes de cambio se implementarán en una etapa posterior.

Los datos del catálogo de demostración se cargarán de manera idempotente mediante migración o semilla versionada. Reiniciar el proceso no duplicará productos ni precios.

## API y reglas del servidor

La API pública expondrá la lectura del catálogo activo y una operación de estimación. La solicitud de estimación enviará identificadores de opciones, nunca precios propuestos por el navegador.

El servidor:

- comprobará que cada identificador exista y esté activo;
- comprobará la compatibilidad entre producto, material, medida, cantidad y extras;
- calculará el resultado desde SQLite;
- devolverá un total estimado o `requiresEvaluation: true`;
- rechazará combinaciones manipuladas con `400`;
- no incluirá reglas internas innecesarias en la respuesta.

Las operaciones de borrador exigirán una sesión válida. Cada lectura y escritura verificará que la cotización pertenezca al usuario autenticado. Un cliente nunca podrá consultar o modificar cotizaciones ajenas.

El guardado automático usará operaciones explícitas de creación y actualización. Cada cambio confirmado en la interfaz se enviará al servidor; la pantalla mostrará `Guardando…`, `Borrador guardado` o un error recuperable. La interfaz conservará los datos visibles si una petición falla y ofrecerá reintentar.

El envío validará que exista al menos un producto y que teléfono y datos obligatorios sean válidos. El cambio de estado y su fecha se escribirán en una transacción.

## Traspaso a través del inicio de sesión

La simulación se conservará temporalmente en almacenamiento de sesión del navegador. Solo contendrá identificadores de catálogo, cantidad, extras y observación; no contendrá identidad, secretos ni un precio confiable.

El enlace de acceso incluirá un destino de retorno permitido hacia `cotizaciones.html`. Después de registrarse o iniciar sesión:

1. la página privada leerá la simulación temporal;
2. solicitará al servidor validarla y recalcularla;
3. creará o actualizará un borrador propio;
4. eliminará la simulación temporal únicamente después de recibir confirmación;
5. avisará si el catálogo cambió y mostrará el valor recalculado.

Los destinos de retorno se limitarán a rutas internas conocidas para evitar redirecciones abiertas.

## Presentación del precio

El simulador mostrará:

- producto y opciones elegidas;
- cantidad;
- extras;
- total estimado, cuando corresponda;
- el aviso **Valor referencial sujeto a confirmación por la empresa**.

No mostrará la fórmula, márgenes ni tablas internas. Una rotulación vehicular y cualquier combinación marcada para revisión mostrarán **Requiere evaluación** en lugar de un número inventado.

La cotización privada mostrará un subtotal estimado por producto y un total estimado general. Si algún producto requiere evaluación, el total general se presentará como parcial y se indicará claramente qué elemento está pendiente.

## Accesibilidad y navegación

Los desplegables tendrán etiquetas visibles y las opciones dependientes se actualizarán conservando foco y anunciando cambios relevantes. Los estados de cálculo y guardado usarán regiones `aria-live`.

La simulación podrá operarse con teclado. Los errores identificarán el campo afectado y moverán el foco solo cuando sea necesario para completar una acción.

La página privada mantendrá enlaces visibles a Inicio, Mi cuenta y Mis cotizaciones. Las confirmaciones de envío serán diálogos accesibles con foco contenido y restaurado.

## Pruebas

Las pruebas automatizadas cubrirán:

- migración y carga idempotente del catálogo;
- lectura de opciones activas y compatibles;
- cálculo del servidor con valores literales conocidos;
- rechazo de combinaciones inexistentes o incompatibles;
- resultado `Requiere evaluación` para rotulación vehicular;
- ausencia de precios aceptados desde el navegador;
- exigencia de sesión para borradores y envío;
- traspaso de una simulación después de registro o login;
- recálculo ante cambios de catálogo;
- guardado automático y recuperación tras reiniciar;
- varios productos en un borrador;
- subtotales, total general y total parcial;
- aislamiento estricto entre clientes;
- validación de teléfono y campos obligatorios;
- transición única de borrador a enviada;
- rechazo de edición y eliminación después del envío;
- estados accesibles de cálculo, guardado, error y confirmación;
- regresión completa de la web pública, autenticación y persistencia existentes.

## Criterios de término

La etapa estará completa cuando:

- un visitante pueda obtener una estimación sin inventar productos, materiales ni medidas;
- ningún precio sea decidido o confiado al navegador;
- pulsar **Cotizar este proyecto** exija iniciar sesión;
- la simulación aparezca automáticamente como producto de un borrador después del acceso;
- el cliente pueda guardar automáticamente un borrador con varios productos;
- el borrador sobreviva a recargas y reinicios del servidor;
- el cliente pueda enviar la cotización y no editarla directamente después;
- cada cliente vea únicamente sus cotizaciones;
- la interfaz diferencie claramente estimación, borrador y cotización enviada;
- todas las pruebas relevantes pasen.
