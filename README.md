# Publitexweb

Para publicar la versión de prueba gratuita y enviar las actualizaciones desde GitHub, consulta [la guía de Render](docs/render-gratuito.md). Las bases local y remota son independientes.

Proyecto progresivo para una empresa de publicidad visual y para practicar desarrollo web y bases de datos.

## Etapa actual: simulador y cotizaciones persistentes

Esta versión combina la web pública con un servidor Express, autenticación y un flujo persistente de cotizaciones. Incluye menú móvil, navegación activa, filtros de portafolio, visor de trabajos, un simulador público de precios y un espacio privado para administrar borradores.

## Prerrequisitos

Node.js 22.13 o superior.

## Preparar y ejecutar

Después de clonar el proyecto, instala las dependencias:

```bash
npm install
```

Inicia el servidor y abre <http://127.0.0.1:8081>:

```bash
npm start
```

Para abrirlo desde otro dispositivo de la red local, inicia el servidor con `HOST=0.0.0.0` y visita `http://IP_LOCAL:8081`, reemplazando `IP_LOCAL` por la dirección del equipo servidor.

Los módulos JavaScript viven en `js/`; cada archivo tiene una responsabilidad definida. Las cuentas iniciales opcionales de jefe y superadmin se configuran copiando `.env.example` a `.env`, completando sus variables y exportándolas antes de iniciar:

```bash
cp .env.example .env
set -a; . ./.env; set +a
npm start
```

No guardes secretos en el repositorio: `.env` está ignorado por Git y `.env.example` contiene únicamente nombres de variables.

Los usuarios y las sesiones se guardan en SQLite y sobreviven al reinicio del servidor. Por defecto la base queda en `data/publitex.sqlite`; puedes elegir otra ubicación mediante `PUBLITEX_DB_PATH`. Los archivos de la base y sus respaldos están excluidos de Git.

Los precios del simulador son valores demostrativos y el servidor los calcula usando el catálogo almacenado en SQLite; el navegador nunca decide el precio. La rotulación de vehículos se muestra como **requiere evaluación**, sin inventar un total.

Sin sesión, los accesos ofrecen **Simular proyecto**: calcular no guarda simulaciones en el navegador ni crea registros en SQLite. Con sesión, **Cotizar proyecto** abre la página independiente `cotizacion.html`, con accesos a Inicio, Mi cuenta y Mis cotizaciones. Calcular tampoco guarda un borrador en esta página; **Guardar producto y continuar** lleva la selección a Mis cotizaciones para guardarla y completar el envío. Cada cliente dispone de **Mis cotizaciones**, donde puede mantener borradores con varios productos, datos de contacto y observaciones. Los borradores se autoguardan en SQLite, por lo que sobreviven a recargas y reinicios del servidor. Después de enviar una cotización queda disponible solo para lectura durante esta etapa. El historial lateral muestra un código único permanente (`COT-000001`), fecha, productos y estado, ordenado desde la creación más reciente. **Ver estado** abre el seguimiento de la cotización seleccionada. Borrador y Enviada son los estados operativos actuales; las etapas posteriores se muestran pendientes hasta implementar la gestión del equipo. La migración `003_quote_codes.sql` asigna códigos también a las cotizaciones existentes, conservando sus identificadores y datos.

La tabla de precios definitiva de la empresa y un editor administrativo del catálogo quedan para una etapa futura.

## Respaldar y restaurar SQLite

Con el archivo de base existente, crea un respaldo coherente mediante:

```bash
npm run db:backup
```

El respaldo se guarda por defecto en `backups/` con fecha y hora en el nombre. Puedes configurar otra carpeta con `PUBLITEX_BACKUP_DIR`. El comando imprime la ruta completa del archivo creado y nunca sobrescribe un respaldo existente.

Para restaurar, detén primero el servidor. Conserva el archivo de base actual bajo otro nombre, copia el respaldo elegido a la ubicación configurada en `PUBLITEX_DB_PATH` —o a `data/publitex.sqlite` si no configuraste una—, inicia nuevamente el servidor y verifica que puedas iniciar sesión. La restauración es deliberadamente manual para evitar sobrescribir datos por accidente.

## Ejecutar las pruebas

```bash
npm test
```

Este comando ejecuta todas las comprobaciones automatizadas.


## Superadmin y gestión

La cuenta con rol real `superadmin` ve el acceso **Superadmin** en la barra. Su página muestra dos pestañas: Trabajadores, con jefes primero, y Clientes. **Actuar como** permite operar con una persona concreta sin abrir otra sesión; la cuenta original sigue identificada en el registro de acciones. Clientes incluye también las cotizaciones que el propio superadmin creó antes de elegir personas. El cambio afecta solo a esa sesión y se elimina al cerrar sesión. **Cambiar persona** vuelve al directorio. Los usuarios normales no pueden activarlo. El registro público siempre crea clientes; el rol privilegiado se asigna administrativamente en la base de datos, nunca por un correo enviado desde el navegador.

El superadmin puede actuar como cliente para crear y enviar una cotización de esa cuenta, elegir un jefe para revisarla, aceptarla y registrar la factura, y elegir un trabajador para marcarla lista. El jefe también puede tomar el trabajo, marcarlo listo y confirmar la entrega. Desde la facturación todos los trabajadores ven el proyecto. `gestion.html` muestra las acciones según el rol y el estado, además de las horas de facturación y término.

Para pasar de Aceptada a Facturada es obligatorio usar **Añadir factura** y adjuntar un PDF o XML (máximo 5 MB). Primero se revisa el archivo y luego se confirma: la vista previa no cambia la cotización. El XML individual del SII (DTE 33 o 34, también dentro de un EnvioDTE) completa folio, fecha de emisión, RUT y nombre del receptor y monto total; el PDF requiere ingresar folio, fecha de emisión y monto total en pesos. El sistema conserva el documento original y registra quién lo adjuntó. Esta lectura no verifica la firma ni el estado del documento en el SII.

La migración `010_invoice_documents.sql` guarda los archivos en SQLite, vinculados uno a uno con las cotizaciones y cubiertos por el respaldo habitual de la base. Solo jefe y superadmin pueden cargarlos y descargarlos. Se impiden archivos repetidos y, en XML, facturas con la misma combinación de RUT emisor, tipo y folio. Las cotizaciones anteriores se conservan; las que ya estaban facturadas o entregadas ofrecen **Añadir factura** para completar su documento sin cambiar su estado. Una factura adjunta no se sobrescribe.

Al confirmar la entrega, la cotización sale de la lista de proyectos en proceso y queda en `facturas.html`, disponible para el jefe y el superadmin junto a la descarga de su factura. El archivo agrupa y ordena por la fecha de emisión del documento, independientemente del día de carga; los registros antiguos sin adjunto conservan como referencia la fecha registrada previamente. Muestra años desde 2005 y amplía el intervalo cuando un documento lo necesita. Permite buscar por fecha, folio, cliente, RUT del documento y detalles del trabajo. El monto facturado se muestra separado de la estimación original de la cotización. El plazo interno de pago existente sigue siendo de 30 días desde el registro como facturada; no se obtiene del archivo.

El servidor expone únicamente las páginas públicas y recursos de `assets/`, `css/` y `js/`; las bases, respaldos y archivos internos no se sirven por HTTP. Este entorno local usa contraseña y sesión, sin doble factor.
