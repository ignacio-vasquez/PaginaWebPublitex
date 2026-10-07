# Flujo de cotización separado

## Objetivo

Separar la creación y edición de una cotización de su historial y seguimiento. El cliente crea y edita un borrador en una página dedicada; **Mis cotizaciones** queda enfocada en consultar cotizaciones existentes.

## Recorrido

1. **Enviar presupuesto** y **Nueva cotización** crean un borrador vacío y abren su página propia.
2. El borrador muestra código, datos del cliente, productos, total y envío.
3. **Agregar producto** abre el selector de servicios con el id del borrador.
4. Al guardar el producto, el cliente vuelve al mismo borrador.
5. Tras enviar, vuelve al historial para consultar sus cotizaciones y avance.

## Restricciones

- No se modifica la API ni el modelo de cotizaciones.
- El id del borrador viaja en la URL; no se usa almacenamiento temporal como puente.
- Un borrador no existente, no propio o no editable muestra un mensaje claro.
- Las cotizaciones enviadas son de solo lectura.
