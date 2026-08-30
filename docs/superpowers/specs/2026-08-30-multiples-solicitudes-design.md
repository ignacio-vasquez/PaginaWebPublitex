# Diseño del flujo de múltiples solicitudes

## Objetivo

Permitir que una persona prepare varias solicitudes de cotización independientes sin que una nueva reemplace a la anterior. La interfaz mostrará una solicitud activa con todos sus detalles y una lista compacta con las demás.

Esta etapa sigue siendo una simulación local: no envía, persiste ni almacena datos personales. La estructura de cada solicitud quedará preparada para convertirse más adelante en un registro independiente de la base de datos.

## Alcance

El flujo permitirá:

- Crear varias solicitudes durante la sesión actual de la página.
- Mantener una sola solicitud activa y visible en detalle.
- Mostrar las demás en una lista resumida.
- Seleccionar, editar y eliminar cualquier solicitud.
- Crear una solicitud nueva sin borrar las existentes.
- Comunicar siempre que ninguna solicitud fue enviada a la empresa.

No incluye base de datos, API, envío de red, almacenamiento del navegador, sincronización entre pestañas, autenticación ni recuperación después de recargar.

## Modelo de solicitud

Cada solicitud en memoria tendrá:

- Un identificador interno único generado durante la sesión.
- Nombre.
- Empresa cliente, opcional.
- Teléfono.
- Correo.
- Tipo de trabajo.
- Descripción.
- Consentimiento.
- Fecha y hora de creación.

El identificador no tendrá significado comercial y podrá reemplazarse por el identificador de la base de datos en una etapa posterior. La empresa cliente se conservará en cada solicitud cuando se proporcione, pero seguirá siendo opcional y no producirá un error de validación cuando esté vacía.

## Estado de la interfaz

El módulo mantendrá en memoria:

- La colección ordenada de solicitudes.
- El identificador de la solicitud activa.
- El identificador de la solicitud que se está editando, o ausencia de edición cuando se crea una nueva.

La solicitud creada o seleccionada más recientemente será la activa. Las demás solicitudes permanecerán en la lista en orden de creación, con la más reciente primero.

Recargar la página elimina esta colección. La interfaz explicará que las solicitudes son simulaciones y no quedan guardadas.

## Flujo de creación

Una solicitud válida se añadirá a la colección y se convertirá en la solicitud activa. El formulario se ocultará y aparecerá la vista de detalle.

La acción **“Crear otra solicitud”** abrirá un formulario vacío, limpiará errores generados y llevará el foco al campo Nombre. No eliminará ni modificará solicitudes existentes. Cancelar la creación devolverá a la solicitud activa sin añadir datos.

## Vista activa e historial

La vista activa mostrará todos los campos relevantes, acciones para **Editar**, **Eliminar** y **Crear otra solicitud**, y el aviso destacado:

> Simulación: estas solicitudes todavía no fueron enviadas a la empresa

Debajo aparecerá **“Otras solicitudes preparadas”**, una lista compacta que excluirá la solicitud activa. Cada elemento mostrará nombre, tipo de trabajo y fecha/hora, con acciones **Ver**, **Editar** y **Eliminar**.

Si solo existe una solicitud, la lista secundaria permanecerá oculta y la interfaz indicará que no hay otras solicitudes preparadas.

## Edición

Editar una solicitud rellenará el formulario con sus datos, mostrará una acción principal **“Guardar cambios”** y una acción **“Cancelar edición”**. Guardar reemplazará únicamente esa solicitud, conservará su identificador y fecha de creación, y la dejará activa.

Cancelar descartará los cambios no guardados y regresará a la solicitud activa anterior. La validación y los mensajes accesibles serán los mismos que en la creación.

## Eliminación

Eliminar siempre requerirá una confirmación explícita que identifique la solicitud. La confirmación será operable con teclado y devolverá el foco de forma predecible si se cancela.

Al eliminar una solicitud no activa, la vista activa no cambiará. Al eliminar la activa, se seleccionará la solicitud más reciente restante. Si no queda ninguna, se mostrará el formulario vacío para crear la primera solicitud.

## Accesibilidad

- Las actualizaciones de creación, edición y eliminación se anunciarán mediante una región `aria-live` visible para tecnologías de asistencia.
- El foco irá a la vista activa después de crear o guardar, al formulario después de iniciar una creación o edición, y a un destino lógico después de eliminar.
- La lista usará botones reales para Ver, Editar y Eliminar.
- La confirmación de eliminación tendrá semántica de diálogo, contención de foco, cierre con Escape y restauración de foco.
- Ningún estado dependerá únicamente del color.
- Se respetará `prefers-reduced-motion`.

## Arquitectura

`js/formulario.js` conservará las reglas de validación y coordinará el formulario. La colección y sus transiciones se separarán en un módulo puro para evitar mezclar reglas de estado con manipulación del DOM.

Componentes propuestos:

- `js/solicitudes.js`: crea y actualiza el estado inmutable de la colección; añade, selecciona, edita y elimina por identificador.
- `js/formulario.js`: recoge y valida campos, cambia entre creación y edición y coordina el foco.
- `js/mensajes.js`: mantiene mensajes y errores accesibles.
- HTML: contratos para detalle activo, lista secundaria, acciones y confirmación.
- CSS: presentación responsive de la vista activa, lista y diálogo.

No se utilizarán `fetch`, `XMLHttpRequest`, `sendBeacon`, `localStorage`, `sessionStorage`, cookies ni IndexedDB.

## Manejo de errores y casos límite

- Las operaciones con un identificador inexistente no modificarán el estado ni romperán la página.
- No se crearán solicitudes con datos inválidos.
- Un formulario editado no cambiará la colección hasta guardar correctamente.
- La lista se volverá a renderizar desde el estado usando `createElement` y `textContent`, nunca `innerHTML` con datos de la persona.
- Si falta el marcado asociado, el módulo terminará de forma segura sin impedir las demás funciones.

## Pruebas

Las pruebas automatizadas cubrirán:

- Creación de dos o más solicitudes sin reemplazo.
- Selección y cambio de solicitud activa.
- Exclusión de la activa en la lista secundaria.
- Edición de una solicitud sin alterar las demás.
- Cancelación de edición y creación.
- Confirmación, cancelación y ejecución de eliminación.
- Selección de una nueva activa al eliminar la actual.
- Regreso al formulario vacío al eliminar la última.
- Validación, anuncios accesibles y gestión del foco.
- Ausencia de red y almacenamiento.
- Uso seguro de texto proporcionado por la persona.
- Conservación de las pruebas actuales de menú, portafolio, HTML y CSS.

## Criterios de aceptación

La etapa estará terminada cuando se puedan crear, revisar, editar y eliminar varias solicitudes independientes durante una sesión; una solicitud permanezca visible en detalle; las demás aparezcan en una lista compacta; ninguna acción envíe o guarde información; y todas las interacciones principales funcionen con mouse y teclado con las pruebas completas en verde.
