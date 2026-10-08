# Publicación de prueba en Render

El servicio usa el plan Free, sin disco ni base de datos de pago. `render.yaml` configura Node 22, inicio automático, HTTPS y SQLite temporal. Los datos de prueba pueden desaparecer al reiniciar, publicar una actualización o entrar en reposo. Las tres cuentas iniciales se recrean a partir de la configuración privada del servicio.

## Primera publicación

1. Conectar Render con la cuenta de GitHub que tiene acceso a `ignacio-vasquez/PaginaWebPublitex`.
2. Crear un Blueprint desde ese repositorio, rama `main`. Verificar que el único recurso propuesto sea el servicio web `publitex`, plan Free.
3. Configurar los correos y contraseñas de Marcelo Velis (jefe), Marcos Velis (trabajador) e Ignacio (superadmin) en las variables privadas solicitadas. No guardar contraseñas en GitHub. Las contraseñas deben tener de 8 a 128 caracteres.
4. Publicar y abrir la dirección HTTPS que Render asigne. `publitex.onrender.com` está sujeto a disponibilidad; el nombre del servicio no garantiza ese subdominio.
5. Comprobar acceso de las tres cuentas y creación de una cotización de prueba.

## Cómo seguimos trabajando

Los archivos del proyecto son la fuente del código. Después de modificar y probar aquí, guardar los cambios con un commit y enviarlos a `main` en GitHub. Render publica automáticamente ese commit. Guardar un archivo local por sí solo todavía no actualiza la página pública.

El código será el mismo en ambas versiones una vez publicado. Las bases son independientes: crear usuarios, cotizaciones o adjuntos en internet no los copia al equipo local y viceversa. Los datos locales permanecen en `data/publitex.sqlite`; los remotos son descartables en `/tmp/publitex/publitex.sqlite`.

Si se cambia una contraseña o correo de las cuentas iniciales mediante la aplicación, actualizar también su configuración privada de Render para conservar ese cambio tras un reinicio. Las cuentas existentes no se sobrescriben al iniciar.

El plan gratuito entra en reposo después de 15 minutos sin tráfico y despierta con una nueva visita; esa primera carga puede tardar alrededor de un minuto. Mantener el uso dentro de las cuotas del plan y no agregar recursos de pago.

Referencias: https://render.com/docs/free, https://render.com/docs/blueprint-spec y https://render.com/docs/deploys.
