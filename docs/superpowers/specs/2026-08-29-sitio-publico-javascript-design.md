# Diseño de la etapa JavaScript del sitio público

## Objetivo

Incorporar comportamiento dinámico a la página pública de Publitexweb usando JavaScript nativo. Esta etapa permitirá practicar eventos, funciones, módulos, validación y manipulación del DOM sin incorporar aún Node.js, Express, Oracle ni React.

La página conservará su contenido y navegación básica si JavaScript no carga. Las funciones nuevas serán mejoras progresivas sobre el HTML existente.

## Alcance

La etapa incluye:

- Menú desplegable para pantallas pequeñas.
- Indicación de la sección visible en la navegación principal.
- Filtros por categoría para el portafolio.
- Visor ampliado y accesible para los trabajos.
- Validación accesible del formulario de cotización.
- Confirmación explícitamente simulada de una solicitud válida.
- Ajustes CSS necesarios para los nuevos estados y controles.
- Pruebas automatizadas de los comportamientos principales.

No incluye envío de datos, almacenamiento local, autenticación, panel administrativo, conexión con servicios externos ni persistencia en una base de datos.

## Organización del código

`js/app.js` será el punto de entrada y coordinará módulos pequeños con una sola responsabilidad:

- `js/menu.js`: controla la apertura y cierre del menú móvil.
- `js/navegacion.js`: actualiza el enlace correspondiente a la sección visible.
- `js/portafolio.js`: controla filtros y visor de trabajos.
- `js/formulario.js`: limpia, valida y resume los campos de cotización.
- `js/mensajes.js`: presenta mensajes accesibles de error y confirmación.

Los módulos expondrán funciones de inicialización. Si falta el elemento HTML asociado a un módulo, este terminará sin producir un error que impida las demás funciones.

## Menú y navegación

En pantallas pequeñas, el encabezado mostrará un botón para abrir y cerrar la navegación. El botón informará su estado con `aria-expanded` y su relación con el menú mediante `aria-controls`.

El menú se cerrará al seleccionar un enlace, al presionar `Escape` o al pasar a un tamaño de pantalla donde el menú completo vuelva a estar visible. El foco se conservará de manera predecible: cuando se cierre mediante `Escape`, regresará al botón.

La navegación marcará el enlace de la sección que ocupa la zona principal de la ventana. El estado actual se comunicará visualmente y con `aria-current="location"`. Si el navegador no permite observar secciones, los enlaces internos seguirán funcionando normalmente.

## Portafolio

El portafolio ofrecerá cuatro filtros: Todos, Letreros, Vehículos y Adhesivos. Cada trabajo tendrá una categoría declarada en el HTML. El filtro seleccionado permanecerá visible y se comunicará mediante `aria-pressed`.

Al activar un trabajo se abrirá un visor con su imagen y descripción. El visor tendrá semántica de diálogo, moverá el foco a su botón de cierre y conservará el elemento que lo abrió para devolverle el foco al cerrar. Podrá cerrarse con el botón, al activar el fondo exterior o al presionar `Escape`.

Mientras el visor esté abierto se evitará el desplazamiento del documento. Las fotografías siguen siendo provisionales hasta que la empresa entregue material real.

## Formulario de cotización

La validación se ejecutará al intentar enviar el formulario y se actualizará cuando el usuario corrija un campo. Antes de validar, se eliminarán espacios innecesarios al comienzo y final de los valores de texto.

Se comprobarán los siguientes datos:

- Nombre: obligatorio y con al menos dos caracteres visibles.
- Teléfono: obligatorio y con entre 8 y 15 dígitos, admitiendo espacios, paréntesis, guiones y el prefijo `+`.
- Correo: obligatorio y con formato de correo válido.
- Tipo de trabajo: debe tener una opción seleccionada.
- Descripción: obligatoria y con un mínimo de 20 caracteres visibles.
- Consentimiento: debe estar marcado.

Cada error aparecerá junto al campo correspondiente. El campo se marcará con `aria-invalid` y se conectará con su mensaje mediante `aria-describedby`. Tras un intento inválido, el foco irá al primer campo con error.

Cuando todos los datos sean válidos, JavaScript impedirá el envío de red y mostrará un resumen sin almacenar la información. El resumen incluirá de forma destacada el texto: **“Simulación: esta solicitud todavía no fue enviada a la empresa”**. El usuario podrá volver a editar o limpiar el formulario.

La página nunca afirmará que la empresa recibió una cotización durante esta etapa.

## Mensajes, errores y compatibilidad

Los avisos generales usarán una región con `aria-live` para ser anunciados por tecnologías de asistencia. Los errores serán concretos y explicarán cómo corregir el dato, sin depender solamente del color.

Las animaciones serán breves y decorativas. Se anularán mediante `prefers-reduced-motion` cuando el usuario haya solicitado menos movimiento.

Si una API opcional como `IntersectionObserver` no está disponible, la página omitirá solamente esa mejora. El formulario y la navegación interna continuarán operativos.

## Pruebas

Las pruebas automatizadas verificarán:

- Estado, apertura y cierre del menú móvil.
- Cierre por enlace y por tecla `Escape`.
- Marcado accesible de la sección activa.
- Selección de filtros y visibilidad de trabajos.
- Apertura, cierre y gestión del foco del visor.
- Reglas de validación y asociación de errores con campos.
- Foco en el primer error.
- Confirmación simulada y ausencia de envío real.
- Ausencia de almacenamiento de datos personales.
- Conservación de las pruebas existentes de HTML y CSS.

## Criterios de aceptación

La etapa se considera terminada cuando todas las interacciones funcionan con mouse y teclado, presentan estados accesibles, las pruebas completas pasan y ninguna solicitud sale del navegador ni queda guardada. El comportamiento debe funcionar en los tamaños de pantalla ya cubiertos por el diseño responsive.
