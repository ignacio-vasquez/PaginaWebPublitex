# Diseño CSS del sitio público

## Propósito

Transformar la estructura HTML existente en una página profesional, comercial y adaptable, manteniendo el proyecto en la etapa de CSS tradicional. La identidad seguirá siendo provisional hasta recibir el logotipo, colores y fotografías reales de la empresa.

## Dirección visual

La interfaz utilizará una estética moderna e industrial apropiada para una empresa de letreros y publicidad visual:

- Azul muy oscuro como color principal en encabezado, presentación y pie.
- Naranja como acento en botones, enlaces, indicadores y detalles.
- Blanco y gris claro para superficies y secciones de lectura.
- Gris oscuro para texto sobre fondos claros.
- Tipografía de sistema, sin descargar fuentes externas.
- Fotografías o SVG provisionales con proporciones y recortes consistentes.
- Esquinas moderadas, sombras discretas y espacios amplios.

## Organización técnica

Se creará un único archivo `css/styles.css`, enlazado desde `index.html`. El archivo se organizará en este orden:

1. Propiedades personalizadas para colores, tamaños, sombras y ancho máximo.
2. Normalización básica y estilos globales.
3. Tipografía, enlaces, imágenes y controles compartidos.
4. Encabezado y navegación.
5. Presentación principal.
6. Servicios.
7. Proceso de trabajo.
8. Portafolio y empresa.
9. Formulario, contacto y pie.
10. Estados interactivos y accesibilidad.
11. Media queries para pantallas grandes y preferencias del usuario.

No se usarán Bootstrap, Tailwind, preprocesadores, JavaScript ni dependencias CSS.

## Diseño adaptable

El enfoque será mobile-first:

- En teléfonos, el contenido usará una columna, controles de ancho completo y navegación con ajuste de línea.
- Desde 48rem, servicios, portafolio, proceso y formulario aprovecharán cuadrículas de varias columnas.
- El contenido tendrá un ancho máximo común y márgenes laterales fluidos.
- No habrá desplazamiento horizontal a 320px de ancho.
- Las imágenes conservarán su proporción mediante `object-fit`.

El menú móvil no tendrá botón hamburguesa todavía porque requeriría JavaScript. Los enlaces se acomodarán en varias líneas de forma usable.

## Componentes visuales

### Encabezado

Barra oscura con marca visible, navegación clara y botón naranja de cotización. Permanecerá en la parte superior durante el desplazamiento mediante `position: sticky`.

### Presentación

Bloque oscuro de alto impacto con texto principal, acciones y una imagen provisional. En pantallas amplias se dividirá en dos columnas; en teléfonos se apilará.

### Servicios y proceso

Los servicios serán tarjetas con imagen, título y descripción. El proceso se mostrará como pasos numerados con jerarquía clara, sin depender del color para comunicar el orden.

### Portafolio y empresa

El portafolio será una cuadrícula de imágenes con leyendas. La sección de empresa tendrá fondo contrastante y una composición sencilla centrada en el texto.

### Cotización y contacto

El formulario tendrá etiquetas visibles, campos amplios, bordes y estados de foco notorios. La sección de contacto mantendrá explícito que sus datos son provisionales.

### Pie de página

Fondo oscuro, marca, navegación secundaria y texto provisional con contraste suficiente.

## Accesibilidad

- Indicadores `:focus-visible` claros para enlaces, botones y controles.
- Contraste legible entre texto y fondo.
- Tamaños táctiles adecuados para acciones principales.
- Estados `hover` como mejora, nunca como única forma de comunicar información.
- Respeto a `prefers-reduced-motion` para desactivar transiciones no esenciales.
- El diseño conservará el orden semántico del HTML.

## Verificación

Las pruebas automáticas comprobarán:

- La existencia del enlace a `css/styles.css` en `index.html`.
- La existencia física del archivo CSS.
- La presencia de las propiedades personalizadas principales.
- La ausencia de estilos inline y de frameworks externos.
- La existencia de reglas responsive, foco visible y movimiento reducido.
- Que la suite HTML existente continúe aprobándose.

También se hará una revisión visual manual en anchos aproximados de 320px, 768px y escritorio.

## Criterios de éxito

- La página se reconoce como el diseño comercial aprobado, incluso con identidad provisional.
- Todas las secciones tienen una jerarquía visual coherente.
- El sitio es usable en teléfono y computador sin desplazamiento horizontal.
- El formulario es legible y sus controles son fáciles de identificar.
- No se incorporan tecnologías posteriores ni dependencias externas.
- Las pruebas HTML y CSS pasan sin errores.

