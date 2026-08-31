# Publitexweb

Proyecto progresivo para una empresa de publicidad visual y para practicar desarrollo web y bases de datos.

## Etapa actual: JavaScript

Esta versión combina estructura semántica, CSS responsive y comportamientos accesibles en el navegador: menú móvil, navegación activa, filtros de portafolio, visor de trabajos y validación de cotizaciones.

## Prerrequisitos

Node.js 22 o superior.

## Preparar y ver la página

Después de clonar el proyecto, instala las dependencias:

```bash
npm install
```

Inicia un servidor local y abre <http://127.0.0.1:8081>:

```bash
python3 -m http.server 8081 --bind 127.0.0.1
```

Los módulos JavaScript viven en `js/`; cada archivo tiene una responsabilidad definida.

El formulario de cotización es una simulación local: permite preparar varias solicitudes independientes durante la sesión actual de la página, editarlas, seleccionarlas y eliminarlas. Al recargar la página la colección en memoria se descarta; ninguna solicitud se envía ni se almacena. La persistencia futura requerirá la etapa de backend y base de datos.

## Ejecutar las pruebas

```bash
npm test
```

Este comando ejecuta todas las comprobaciones automatizadas.

## Ruta de aprendizaje

HTML → CSS → JavaScript → Node.js + Express → Oracle → React
