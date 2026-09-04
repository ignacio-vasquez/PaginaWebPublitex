# Publitexweb

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

Para guardar una selección es necesario registrarse o iniciar sesión. Cada cliente dispone de **Mis cotizaciones**, donde puede mantener borradores con varios productos, datos de contacto y observaciones. Los borradores se autoguardan en SQLite, por lo que sobreviven a recargas y reinicios del servidor. Después de enviar una cotización queda disponible solo para lectura durante esta etapa.

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
