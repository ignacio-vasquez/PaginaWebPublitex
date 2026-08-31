# Publitexweb

Proyecto progresivo para una empresa de publicidad visual y para practicar desarrollo web y bases de datos.

## Etapa actual: servidor y autenticación

Esta versión combina la web pública con un servidor Express y una API de autenticación. Incluye menú móvil, navegación activa, filtros de portafolio, visor de trabajos y validación de cotizaciones.

## Prerrequisitos

Node.js 22 o superior.

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

La persistencia de usuarios y sesiones es temporal y está en memoria. Al reiniciar el proceso desaparecen las cuentas y sesiones creadas durante el desarrollo.

El formulario de cotización es una simulación local: permite preparar varias solicitudes independientes durante la sesión actual de la página, editarlas, seleccionarlas y eliminarlas. Al recargar la página la colección en memoria se descarta; ninguna solicitud se envía ni se almacena. La persistencia futura requerirá una base de datos.

## Ejecutar las pruebas

```bash
npm test
```

Este comando ejecuta todas las comprobaciones automatizadas.
