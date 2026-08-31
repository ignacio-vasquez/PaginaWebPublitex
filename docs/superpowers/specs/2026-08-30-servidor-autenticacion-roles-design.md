# Servidor, autenticación y roles

## Objetivo

Agregar a la web de Publitexweb un servidor Express con registro e inicio de sesión, manteniendo intacto el acceso público al sitio y al cotizador actual. Esta primera entrega establecerá la base de cuentas y permisos que posteriormente permitirá guardar cotizaciones y trabajos en Oracle.

## Alcance

La entrega permite que un visitante:

- navegue por la web y use el cotizador sin iniciar sesión;
- cree una cuenta de cliente con nombre, correo y contraseña;
- inicie y cierre sesión;
- consulte un perfil básico con su nombre, correo y rol.

También establece y prueba los roles `cliente`, `trabajador`, `jefe` y `superadmin`, con autorización aplicada en el servidor.

Quedan fuera de esta entrega el historial de cotizaciones, la persistencia en Oracle, la recuperación y verificación por correo, y los paneles funcionales de trabajador y jefe.

## Arquitectura

Express servirá los archivos públicos existentes y expondrá una API bajo `/api`. La autenticación usará sesiones identificadas mediante una cookie `HttpOnly`. Las contraseñas se almacenarán únicamente como hashes resistentes a ataques de fuerza bruta.

La persistencia temporal se aislará detrás de repositorios en memoria. Los servicios dependerán de las interfaces de esos repositorios y no de sus detalles internos, de modo que una implementación Oracle pueda reemplazarlos en una etapa posterior sin cambiar las rutas ni las reglas de negocio.

Los módulos tendrán responsabilidades separadas:

- `server.js`: composición de la aplicación, configuración e inicio del servidor;
- rutas de autenticación: traducción entre HTTP y los servicios;
- servicio de autenticación: registro, validación de credenciales y reglas de cuentas;
- middleware de autorización: comprobación de sesión y roles;
- repositorio de usuarios: creación y consulta de usuarios;
- repositorio de sesiones: creación, consulta y revocación de sesiones;
- interfaz de acceso: registro, ingreso, perfil básico y cierre de sesión.

## Cuentas y roles

Los visitantes podrán registrarse solamente con el rol `cliente`. El formulario solicitará nombre, correo electrónico y una contraseña de al menos ocho caracteres. El correo se normalizará antes de comprobar duplicados.

Las cuentas `trabajador` serán creadas posteriormente por el jefe mediante una interfaz administrativa. Durante esta entrega, la capacidad del servidor para autorizar ese rol se probará con datos de desarrollo controlados.

Las cuentas iniciales `jefe` y `superadmin` se crearán al iniciar el servidor únicamente cuando existan las variables de configuración requeridas. Sus contraseñas no aparecerán en el repositorio ni en respuestas HTTP. El `superadmin`, también denominado adminfantasma por el propietario, es un rol técnico y no aparecerá en la navegación diaria.

## Experiencia de usuario

La navegación pública incorporará el enlace **Ingresar**. La página `/acceso.html` mostrará el siguiente mensaje introductorio:

> ¿Ya eres cliente o quieres gestionar tus proyectos? Inicia sesión o crea una cuenta para consultar tus cotizaciones, seguir tus trabajos y mantener tus datos organizados.

La misma página permitirá alternar entre registro e inicio de sesión. Tras autenticar, la navegación mostrará **Mi cuenta**. El perfil inicial enseñará nombre, correo y rol, además de una acción clara para cerrar sesión. La página no prometerá todavía un historial disponible; esa función llegará en la siguiente etapa.

Los formularios conservarán los criterios actuales de accesibilidad: etiquetas visibles, mensajes anunciables, navegación por teclado y foco controlado. Los errores usarán lenguaje claro y no confirmarán si un correo particular está registrado.

## API

La API inicial expondrá:

- `POST /api/auth/register`: crea una cuenta `cliente` e inicia su sesión;
- `POST /api/auth/login`: valida credenciales e inicia una sesión;
- `POST /api/auth/logout`: revoca la sesión activa y elimina su cookie;
- `GET /api/auth/session`: informa si existe una sesión y devuelve datos públicos mínimos;
- `GET /api/account/profile`: devuelve el perfil del usuario autenticado.

Las respuestas de usuario incluirán identificador, nombre, correo y rol, pero nunca contraseña ni hash. Las rutas privadas responderán `401` sin sesión válida y `403` cuando el rol no tenga permiso.

## Sesiones y seguridad

Las sesiones se identificarán con valores aleatorios opacos almacenados en cookie `HttpOnly` y `SameSite=Lax`. En desarrollo local la cookie podrá viajar por HTTP; en producción deberá marcarse también como `Secure`.

El servidor aplicará:

- hash de contraseñas mediante una biblioteca mantenida para ese propósito;
- validación y límites de longitud en todos los campos;
- comparación segura de credenciales;
- mensajes genéricos para fallos de autenticación;
- limitación básica de intentos repetidos en las rutas de acceso;
- autorización por rol dentro del servidor;
- configuración sensible exclusivamente mediante variables de entorno.

El almacenamiento en memoria implica que usuarios y sesiones desaparecen al reiniciar el proceso. La interfaz y la documentación de esta etapa lo tratarán explícitamente como una limitación de desarrollo.

## Flujo de datos

En el registro, la ruta valida el formato básico y entrega los datos al servicio. El servicio normaliza el correo, comprueba duplicados, genera el hash, crea el cliente en el repositorio y abre una sesión. La ruta escribe la cookie y devuelve únicamente el perfil público.

En el ingreso, el servicio busca el correo normalizado y comprueba la contraseña. Ante cualquier fallo devuelve el mismo error público. Cuando las credenciales son válidas, crea una sesión y la ruta establece la cookie.

En una ruta protegida, el middleware obtiene la cookie, consulta el repositorio de sesiones, carga el usuario y compara su rol con los roles permitidos. Las decisiones de autorización no dependen del contenido visible en el navegador.

## Manejo de errores

Los errores de validación responderán `400`, los correos duplicados `409`, los accesos sin sesión `401` y los permisos insuficientes `403`. Los fallos inesperados responderán `500` con un mensaje público genérico y podrán registrar detalles técnicos sin incluir contraseñas, hashes ni cookies.

El navegador mostrará el mensaje asociado al formulario y conservará los campos no sensibles cuando resulte útil. Nunca conservará ni volverá a mostrar una contraseña después de enviar el formulario.

## Pruebas y criterio de término

Las pruebas automatizadas cubrirán:

- registro válido y creación automática de sesión;
- rechazo de campos inválidos, correos duplicados y contraseñas breves;
- ingreso válido e inválido sin revelar la existencia de la cuenta;
- consulta de sesión, perfil y cierre de sesión;
- ausencia de contraseñas y hashes en las respuestas;
- permisos aceptados y rechazados para los cuatro roles;
- creación controlada de las cuentas iniciales configuradas;
- limitación de intentos repetidos;
- conservación del funcionamiento y las pruebas de la web pública.

La entrega estará terminada cuando todas las pruebas pasen y un cliente pueda registrarse, ingresar, consultar su perfil y cerrar sesión desde la interfaz, mientras las reglas de autorización se apliquen efectivamente en el servidor.
