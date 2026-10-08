# Publitex en Render gratuito

Objetivo autorizado: publicar la aplicación para pruebas, continuar desarrollando localmente y enviar las actualizaciones de código a GitHub para despliegue automático.

- [x] Agregar bootstrap opcional del trabajador Marcos Velis, sin duplicar usuarios existentes. Probar configuración completa e incompleta y creación desde una base vacía.
- [x] Preparar `render.yaml`: servicio Node gratuito, rama main, publicación automática por commit, SQLite temporal, cookies de producción y las tres cuentas configuradas con secretos en Render.
- [x] Configurar confianza de un proxy únicamente en el entorno de Render para que el límite de intentos distinga clientes.
- [x] Documentar publicación y diferencia entre sincronización del código y bases independientes.
- [ ] Ejecutar todas las pruebas y enviar los cambios de esta sesión a GitHub, sin incluir bases, respaldos o contraseñas.
- [ ] Publicar mediante Render cuando el usuario conecte su cuenta y configure las credenciales iniciales; comprobar la URL pública y el acceso de las tres cuentas.

Las cuentas son Marcelo Velis (jefe), Marcos Velis (trabajador) e Ignacio (superadmin). Los datos de prueba remotos pueden borrarse en reposo, reinicios o publicaciones. Los datos locales se conservan. No se contratan recursos pagados.

Verificación local: 232 pruebas aprobadas. Integración Render encontrada pero todavía no conectada; los secretos iniciales deben configurarse en Render. No hay URL pública creada todavía.
