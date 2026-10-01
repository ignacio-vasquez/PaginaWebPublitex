# Punto de guardado — 30 de septiembre de 2026

## Estado

- Rama integrada: `main`, commit `22a76ce` (`docs: save quote work checkpoint for tomorrow`).
- El worktree de implementación se conserva en `/home/ignacio/Pagina app/.worktrees/quote-names-attachments`.
- Verificación después del merge: `npm test` terminó con 237 pruebas aprobadas y 0 fallidas.
- La página está corriendo en `http://localhost:8081` con la base persistente `data/publitex.sqlite`.
- Para probar adjuntos sin tocar esos datos, hay una copia aislada en `http://127.0.0.1:8082`, respaldada en `/tmp/publitex-attachment-qa/publitex-20261001-022510.sqlite`; las cargas allí solo modifican esa copia.
- Antes de iniciar contra esa base se comprobó en modo de solo lectura que tenía una cuenta superadmin activa y se creó el respaldo `/tmp/publitex-pre-main-db/publitex-20261001-021431.sqlite`.
- El inicio aplicó las migraciones aditivas 011 y 012; después se confirmó que sigue habiendo un superadmin activo.
- La base temporal de vista previa está en `/tmp/publitex-preview-20260930.sqlite`. Se encontró allí la cuenta nueva, con rol `cliente` y el mismo correo que el superadmin persistente. No se copiaron cuentas ni contraseñas entre bases; la cuenta nueva no aparece en la base persistente.

## Trabajo completado

- Nombres editables para cotizaciones y búsqueda por nombre o código.
- Cuatro adjuntos opcionales con acceso según usuario y etapa, incluidos los trabajos entregados en Facturas realizadas.
- Validación de Excel con comprobación del paquete y límite de descompresión.
- Corrección de los cinco fallos anteriores de la suite: dos expectativas de interfaz desactualizadas, la ruta pública dentro del worktree y el servicio de gestión de usuarios.
- Servicio de gestión de usuarios en `createRuntime`: creación de clientes, asignación del rol trabajador, cierre de sesiones anteriores y registro del cambio de rol.

## Para retomar

1. Abrir `/home/ignacio/Pagina app`, comprobar `git status --short` y `git log -1 --oneline`; el cambio ya está integrado a `main`.
2. Si se reinicia el servidor, usar `PUBLITEX_DB_PATH=/home/ignacio/Pagina app/data/publitex.sqlite` para conservar las cuentas y los datos persistentes. La cookie de sesión previa al cambio de base puede requerir volver a iniciar sesión.
3. El servicio de gestión de usuarios aún no tiene rutas HTTP ni pantalla; ese acceso sería trabajo de producto aparte.
4. Detalles menores diferidos: los nombres de archivos muy largos pueden perder la extensión y el mensaje de carga exitosa desaparece al actualizar la lista. No se ha hecho una prueba de restauración de respaldos de producción.

El historial detallado de la implementación y revisión está en `.superpowers/sdd/2026-09-28-quote-names-and-attachments/progress.md` dentro del worktree.

## Próxima sesión

Cuando Ignacio diga “sigamos con lo último”, empezar explicando cómo puede actualizar por sí mismo el inicio del sitio, sin modificarlo todavía:

- Reunir nombres y descripciones reales de los servicios, información de la empresa y datos de contacto.
- Reemplazar las imágenes provisionales del portafolio por fotos reales; explicar dónde ponerlas en `assets/` y cómo cambiar sus referencias y textos alternativos en `index.html`.
- Ver los cambios recargando `http://localhost:8081`; sus textos e imágenes son archivos directos del proyecto.
- Probar presupuestos y adjuntos de cotizaciones solo en `http://127.0.0.1:8082`, que usa la copia temporal `/tmp/publitex-attachment-qa/publitex-20261001-022510.sqlite`. No usar `localhost:8081` para cargas de prueba porque conecta a los datos persistentes.

La preferencia expresada es que Ignacio haga la actualización de la portada con una guía sencilla y revise los cambios paso a paso.
