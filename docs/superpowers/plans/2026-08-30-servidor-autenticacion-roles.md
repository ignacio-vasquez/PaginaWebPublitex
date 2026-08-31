# Servidor, autenticación y roles Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Incorporar un servidor Express que mantenga pública la web actual y permita registrar, autenticar y autorizar usuarios con los roles cliente, trabajador, jefe y superadmin.

**Architecture:** Express sirve los archivos actuales y una API `/api`. Servicios independientes coordinan repositorios temporales de usuarios y sesiones; cookies opacas `HttpOnly` identifican las sesiones y un middleware aplica permisos en el servidor. Las interfaces de repositorio quedan desacopladas para sustituir la memoria por Oracle en una etapa posterior.

**Tech Stack:** Node.js, Express, bcryptjs, express-rate-limit, cookies HTTP, `node:test`, JSDOM y `fetch` nativo de Node.

**Spec:** `docs/superpowers/specs/2026-08-30-servidor-autenticacion-roles-design.md`

## Global Constraints

- La web y el cotizador continúan disponibles sin iniciar sesión.
- El registro público siempre crea el rol exacto `cliente`.
- Los roles válidos son `cliente`, `trabajador`, `jefe` y `superadmin`.
- La contraseña exige al menos 8 caracteres y nunca aparece en repositorios, logs ni respuestas HTTP.
- La sesión usa la cookie `publitex_session`, `HttpOnly`, `SameSite=Lax`, duración de 8 horas y `Secure` solamente en producción.
- Los datos en memoria desaparecen al reiniciar el servidor; esta limitación debe indicarse en el README.
- Las cuentas iniciales de jefe y superadmin se crean solamente desde variables de entorno completas.
- No se agrega verificación de correo, recuperación de contraseña, historial de cotizaciones ni panel administrativo.
- Cada tarea se desarrolla en un worktree creado con `superpowers:using-git-worktrees`, mediante TDD y sin modificar el worktree principal.

---

### Task 1: Base del servidor Express

**Files:**
- Modify: `package.json`
- Modify: `package-lock.json`
- Create: `server/app.js`
- Create: `server/server.js`
- Create: `tests/server-foundation.test.js`

**Interfaces:**
- Produces: `createApp(options = {}) -> Express.Application` desde `server/app.js`.
- Produces: `startServer({ port, host } = {}) -> http.Server` desde `server/server.js`.
- Consumes: la raíz del repositorio como directorio de archivos públicos.

- [ ] **Step 1: Instalar dependencias del servidor**

Run: `npm install express@5 bcryptjs@3 express-rate-limit@8`

Expected: `package.json` contiene las tres dependencias y `package-lock.json` queda actualizado.

- [ ] **Step 2: Escribir las pruebas fallidas de composición y archivos públicos**

Create `tests/server-foundation.test.js` con un helper que escucha en un puerto efímero y cierra el servidor después de cada prueba:

```js
const test = require('node:test');
const assert = require('node:assert/strict');
const { createApp } = require('../server/app');

async function withServer(app, callback) {
  const server = app.listen(0, '127.0.0.1');
  await new Promise((resolve) => server.once('listening', resolve));
  const { port } = server.address();
  try {
    await callback(`http://127.0.0.1:${port}`);
  } finally {
    await new Promise((resolve, reject) => server.close((error) => error ? reject(error) : resolve()));
  }
}

test('sirve la página pública existente', async () => {
  await withServer(createApp(), async (baseUrl) => {
    const response = await fetch(`${baseUrl}/`);
    assert.equal(response.status, 200);
    assert.match(await response.text(), /PUBLITEXWEB/i);
  });
});

test('responde JSON uniforme para una ruta API inexistente', async () => {
  await withServer(createApp(), async (baseUrl) => {
    const response = await fetch(`${baseUrl}/api/no-existe`);
    assert.equal(response.status, 404);
    assert.deepEqual(await response.json(), { error: 'Recurso no encontrado.' });
  });
});
```

- [ ] **Step 3: Ejecutar la prueba para comprobar que falla**

Run: `node --test tests/server-foundation.test.js`

Expected: FAIL porque `../server/app` no existe.

- [ ] **Step 4: Implementar la composición mínima**

`server/app.js` debe exportar `createApp`, desactivar `x-powered-by`, usar `express.json({ limit: '16kb' })`, servir la raíz mediante `express.static`, y responder JSON a rutas `/api/*` desconocidas:

```js
const express = require('express');
const path = require('node:path');

function createApp() {
  const app = express();
  app.disable('x-powered-by');
  app.use(express.json({ limit: '16kb' }));
  app.use(express.static(path.resolve(__dirname, '..')));
  app.use('/api', (_request, response) => {
    response.status(404).json({ error: 'Recurso no encontrado.' });
  });
  return app;
}

module.exports = { createApp };
```

`server/server.js` debe leer `PORT` con valor predeterminado `8081`, usar `HOST` con valor predeterminado `0.0.0.0`, validar que el puerto sea entero entre 1 y 65535, y exportar `startServer` además de iniciar únicamente cuando `require.main === module`.

- [ ] **Step 5: Agregar scripts y ejecutar las pruebas**

En `package.json`, conservar `test: node --test` y agregar:

```json
"start": "node server/server.js",
"dev": "node --watch server/server.js"
```

Run: `npm test`

Expected: todas las pruebas pasan, incluidas las pruebas públicas existentes.

- [ ] **Step 6: Commit**

```bash
git add package.json package-lock.json server/app.js server/server.js tests/server-foundation.test.js
git commit -m "feat: add Express server foundation"
```

---

### Task 2: Repositorio de usuarios y contraseñas

**Files:**
- Create: `server/users/user-repository.js`
- Create: `server/users/user-service.js`
- Create: `server/users/bootstrap-users.js`
- Create: `tests/user-service.test.js`

**Interfaces:**
- Produces: `createUserRepository(initialUsers = [])` con métodos asíncronos `create(user)`, `findByEmail(email)` y `findById(id)`.
- Produces: `createUserService({ users, hashPassword, verifyPassword, createId })` con `registerClient(input)`, `authenticate(input)`, `getPublicUser(user)` y `createPrivilegedUser(input)`.
- Produces: `bootstrapUsers({ userService, env }) -> Promise<void>`.
- Public user shape: `{ id: string, name: string, email: string, role: 'cliente'|'trabajador'|'jefe'|'superadmin' }`.
- Stored user shape: public user plus `{ passwordHash: string }`.

- [ ] **Step 1: Escribir pruebas fallidas del servicio**

Create `tests/user-service.test.js` con factories deterministas y casos que demuestren:

```js
test('registra clientes con correo normalizado y sin exponer el hash', async () => {
  const users = createUserRepository();
  const service = createUserService({
    users,
    createId: () => 'user-1',
    hashPassword: async (password) => `hash:${password}`,
    verifyPassword: async (password, hash) => hash === `hash:${password}`,
  });
  const result = await service.registerClient({
    name: '  Ignacio Vásquez  ', email: ' IGNACIO@Example.COM ', password: 'secreto1',
  });
  assert.deepEqual(result, {
    id: 'user-1', name: 'Ignacio Vásquez', email: 'ignacio@example.com', role: 'cliente',
  });
  assert.equal((await users.findByEmail('ignacio@example.com')).passwordHash, 'hash:secreto1');
  assert.equal('passwordHash' in result, false);
});
```

Agregar casos para nombre vacío o mayor de 100 caracteres, email inválido o mayor de 254, contraseña menor de 8 o mayor de 128, correo duplicado (`code: 'EMAIL_EXISTS'`), autenticación correcta y error genérico `INVALID_CREDENTIALS` tanto para correo inexistente como para contraseña incorrecta.

- [ ] **Step 2: Ejecutar las pruebas para comprobar que fallan**

Run: `node --test tests/user-service.test.js`

Expected: FAIL porque los módulos de usuarios no existen.

- [ ] **Step 3: Implementar repositorio y servicio**

El repositorio debe copiar los objetos al guardar y devolver copias al leer. `user-service.js` debe exportar `VALID_ROLES`, normalizar con `trim()` y `toLowerCase()`, validar con expresiones regulares acotadas y mapear todos los errores de credenciales al mismo código.

La composición real usará:

```js
const bcrypt = require('bcryptjs');
const crypto = require('node:crypto');

const userService = createUserService({
  users,
  createId: () => crypto.randomUUID(),
  hashPassword: (password) => bcrypt.hash(password, 12),
  verifyPassword: (password, hash) => bcrypt.compare(password, hash),
});
```

- [ ] **Step 4: Implementar y probar bootstrap privilegiado**

`bootstrapUsers` debe reconocer los grupos completos:

```text
PUBLITEX_BOSS_NAME, PUBLITEX_BOSS_EMAIL, PUBLITEX_BOSS_PASSWORD
PUBLITEX_SUPERADMIN_NAME, PUBLITEX_SUPERADMIN_EMAIL, PUBLITEX_SUPERADMIN_PASSWORD
```

Si un grupo está ausente por completo, no crea la cuenta. Si está incompleto, rechaza con `code: 'INCOMPLETE_BOOTSTRAP_CONFIG'`. Si está completo, llama `createPrivilegedUser` con el rol correspondiente y no duplica un correo existente.

Run: `node --test tests/user-service.test.js`

Expected: PASS para registro, autenticación, validación, duplicados y bootstrap.

- [ ] **Step 5: Ejecutar regresión y commit**

Run: `npm test`

Expected: todas las pruebas pasan.

```bash
git add server/users tests/user-service.test.js
git commit -m "feat: add secure user accounts and bootstrap roles"
```

---

### Task 3: Sesiones y endpoints de autenticación

**Files:**
- Create: `server/auth/session-repository.js`
- Create: `server/auth/auth-service.js`
- Create: `server/auth/auth-routes.js`
- Modify: `server/app.js`
- Create: `tests/auth-api.test.js`

**Interfaces:**
- Produces: `createSessionRepository()` con `create({ tokenHash, userId, expiresAt })`, `findByTokenHash(tokenHash)` y `deleteByTokenHash(tokenHash)`.
- Produces: `createAuthService({ users, sessions, userService, createToken, hashToken, now })` con `register`, `login`, `getSessionUser` y `logout`.
- Produces: `createAuthRouter({ authService, cookieSecure, loginLimiter }) -> Express.Router`.
- Cookie exacta: `publitex_session`; token aleatorio de 32 bytes en hexadecimal; en el repositorio se guarda `sha256(token)` y no el token original.

- [ ] **Step 1: Escribir pruebas API fallidas**

Create `tests/auth-api.test.js` reutilizando `withServer` y un helper que extraiga `set-cookie`. Cubrir:

```js
test('registra un cliente, establece cookie HttpOnly y devuelve perfil público', async () => {
  const response = await fetch(`${baseUrl}/api/auth/register`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ name: 'Ignacio', email: 'ignacio@example.com', password: 'secreto1' }),
  });
  assert.equal(response.status, 201);
  assert.match(response.headers.get('set-cookie'), /publitex_session=.*HttpOnly.*SameSite=Lax/i);
  const body = await response.json();
  assert.deepEqual(body.user, {
    id: 'user-1', name: 'Ignacio', email: 'ignacio@example.com', role: 'cliente',
  });
  assert.doesNotMatch(JSON.stringify(body), /password|hash/i);
});
```

Agregar pruebas para login `200`, credenciales inválidas `401` con `{ error: 'Correo o contraseña incorrectos.' }`, duplicado `409`, validación `400`, sesión activa `200`, ausencia de sesión `200` con `{ authenticated: false }`, logout `204` y cookie expirada.

- [ ] **Step 2: Ejecutar las pruebas para comprobar que fallan**

Run: `node --test tests/auth-api.test.js`

Expected: FAIL porque `/api/auth/register` responde 404.

- [ ] **Step 3: Implementar sesiones y servicio**

La sesión dura exactamente `8 * 60 * 60 * 1000` ms. `getSessionUser(token)` devuelve `null` para token ausente, inválido, expirado o usuario inexistente, y elimina sesiones expiradas. La comparación busca únicamente el hash SHA-256 del token.

- [ ] **Step 4: Implementar rutas, cookies y mapeo de errores**

Las rutas deben usar estas opciones:

```js
const cookieOptions = {
  httpOnly: true,
  sameSite: 'lax',
  secure: cookieSecure,
  maxAge: 8 * 60 * 60 * 1000,
  path: '/',
};
```

Parsear solamente la cookie esperada con una función acotada, sin aceptar el token desde JSON ni headers alternativos. Montar el router antes del 404 de `/api` en `createApp(options)` y permitir inyectar repositorios, reloj y generadores para las pruebas.

- [ ] **Step 5: Ejecutar pruebas y commit**

Run: `node --test tests/auth-api.test.js && npm test`

Expected: todas las pruebas pasan.

```bash
git add server/app.js server/auth tests/auth-api.test.js
git commit -m "feat: add cookie-based authentication API"
```

---

### Task 4: Perfil y autorización por rol

**Files:**
- Create: `server/auth/authorization.js`
- Create: `server/account/account-routes.js`
- Modify: `server/app.js`
- Create: `tests/authorization.test.js`
- Modify: `tests/auth-api.test.js`

**Interfaces:**
- Produces: `requireUser(authService) -> Express middleware` que asigna `request.user`.
- Produces: `requireRole(...roles) -> Express middleware` que consume `request.user`.
- Produces: `createAccountRouter({ authService }) -> Express.Router`.
- Endpoint: `GET /api/account/profile -> { user: PublicUser }`.

- [ ] **Step 1: Escribir pruebas fallidas de permisos**

Probar `requireRole` con request/response falsos para la matriz:

```js
const cases = [
  ['cliente', ['cliente'], true],
  ['trabajador', ['trabajador', 'jefe'], true],
  ['jefe', ['trabajador'], false],
  ['superadmin', ['jefe'], false],
];
```

La autorización debe ser explícita: `superadmin` no hereda automáticamente todos los roles. Probar además que perfil sin cookie responde `401`, con cookie válida responde `200`, y rol no autorizado responde `403` con `{ error: 'No tienes permiso para realizar esta acción.' }`.

- [ ] **Step 2: Ejecutar pruebas para comprobar que fallan**

Run: `node --test tests/authorization.test.js tests/auth-api.test.js`

Expected: FAIL porque los módulos y `/api/account/profile` no existen.

- [ ] **Step 3: Implementar middleware y ruta de perfil**

`requireUser` responde `401` con `{ error: 'Debes iniciar sesión.' }`. `requireRole` responde `403` si falta usuario o su rol no está en la lista exacta. La ruta de perfil encadena `requireUser(authService)` y devuelve únicamente `request.user`.

- [ ] **Step 4: Añadir rutas de prueba protegidas solo en entorno inyectado**

Para probar los cuatro roles sin exponer endpoints de producción, `createApp({ testRoutes })` puede montar un router recibido por tests. Construir usuarios controlados mediante `createPrivilegedUser` y sesiones reales; verificar `200` o `403` para cada rol.

- [ ] **Step 5: Ejecutar pruebas y commit**

Run: `npm test`

Expected: todas las pruebas pasan y ningún endpoint devuelve `passwordHash`.

```bash
git add server/app.js server/auth/authorization.js server/account tests/authorization.test.js tests/auth-api.test.js
git commit -m "feat: enforce account roles on the server"
```

---

### Task 5: Límites de acceso y errores seguros

**Files:**
- Create: `server/http/error-handler.js`
- Create: `server/http/login-rate-limit.js`
- Modify: `server/auth/auth-routes.js`
- Modify: `server/app.js`
- Create: `tests/security-http.test.js`

**Interfaces:**
- Produces: `createLoginRateLimit(options = {}) -> Express middleware`.
- Produces: `notFoundApi(request, response)` y `handleError(error, request, response, next)`.
- Rate limit predeterminado: 5 intentos por IP en 15 minutos para `POST /api/auth/login`; sexto intento responde `429`.

- [ ] **Step 1: Escribir pruebas fallidas de seguridad HTTP**

Probar que seis logins incorrectos desde la misma IP producen estados `[401, 401, 401, 401, 401, 429]`, que el `429` devuelve `{ error: 'Demasiados intentos. Intenta nuevamente más tarde.' }`, que cuerpos JSON mayores de 16 KiB reciben `413`, JSON malformado recibe `400`, y un error inesperado recibe `500` sin stack, cookie, contraseña ni hash.

- [ ] **Step 2: Ejecutar pruebas para comprobar que fallan**

Run: `node --test tests/security-http.test.js`

Expected: FAIL porque todavía no existe limitación ni manejador uniforme.

- [ ] **Step 3: Implementar limitador y errores**

Configurar `express-rate-limit` así:

```js
rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 5,
  standardHeaders: 'draft-7',
  legacyHeaders: false,
  handler: (_request, response) => response.status(429).json({
    error: 'Demasiados intentos. Intenta nuevamente más tarde.',
  }),
});
```

El manejador debe mapear errores de parseo JSON a `400`, exceso de cuerpo a `413` y cualquier otro error a `{ error: 'Ocurrió un problema inesperado.' }` con `500`. En tests se inyecta un logger falso y se verifica que los campos sensibles no se registren.

- [ ] **Step 4: Ejecutar pruebas y commit**

Run: `node --test tests/security-http.test.js && npm test`

Expected: todas las pruebas pasan.

```bash
git add server/http server/auth/auth-routes.js server/app.js tests/security-http.test.js
git commit -m "feat: protect authentication HTTP endpoints"
```

---

### Task 6: Interfaz accesible de acceso y cuenta

**Files:**
- Create: `acceso.html`
- Create: `js/acceso.js`
- Create: `js/sesion-navegacion.js`
- Modify: `js/app.js`
- Modify: `index.html`
- Modify: `css/styles.css`
- Create: `tests/access-page.test.js`
- Create: `tests/session-navigation.test.js`
- Modify: `tests/homepage.test.js`

**Interfaces:**
- Produces: `initAccessPage(documentRoot, api = window.fetch)`.
- Produces: `initSessionNavigation(documentRoot, api = window.fetch)`.
- DOM contract: `[data-auth-view]`, `[data-login-form]`, `[data-register-form]`, `[data-account-view]`, `[data-auth-status]`, `[data-logout]`, `[data-session-link]`.

- [ ] **Step 1: Escribir pruebas HTML fallidas**

Probar que `acceso.html` tiene título, texto introductorio aprobado, formularios con labels visibles, `autocomplete="name"`, `autocomplete="email"`, `autocomplete="current-password"` o `new-password`, estado `role="status" aria-live="polite"`, perfil oculto y botón de cierre. Modificar la prueba de inicio para exigir un enlace `[data-session-link]` con texto inicial `Ingresar` y `href="acceso.html"`.

- [ ] **Step 2: Escribir pruebas de comportamiento fallidas**

Con JSDOM y `api` falso, probar:

```js
test('registro exitoso limpia contraseñas y muestra el perfil', async () => {
  const api = async () => new Response(JSON.stringify({
    user: { id: 'u1', name: 'Ignacio', email: 'ignacio@example.com', role: 'cliente' },
  }), { status: 201, headers: { 'content-type': 'application/json' } });
  initAccessPage(document, api);
  // Completar y enviar el formulario.
  assert.equal(document.querySelector('[name="register-password"]').value, '');
  assert.equal(document.querySelector('[data-account-view]').hidden, false);
  assert.match(document.querySelector('[data-account-view]').textContent, /Ignacio/);
});
```

Agregar casos para error visible y foco en estado, login, sesión existente al cargar, logout, y `initSessionNavigation` cambiando `Ingresar` a `Mi cuenta` solamente cuando `/api/auth/session` devuelve `authenticated: true`.

- [ ] **Step 3: Ejecutar pruebas para comprobar que fallan**

Run: `node --test tests/access-page.test.js tests/session-navigation.test.js tests/homepage.test.js`

Expected: FAIL porque la página y los módulos no existen.

- [ ] **Step 4: Implementar HTML y JavaScript**

Usar exactamente este texto:

```text
¿Ya eres cliente o quieres gestionar tus proyectos?
Inicia sesión o crea una cuenta para consultar tus cotizaciones, seguir tus trabajos y mantener tus datos organizados.
```

Los formularios envían JSON a `/api/auth/login` y `/api/auth/register` con `credentials: 'same-origin'`. Después de cada envío, limpiar todos los campos de contraseña. El perfil muestra nombre, correo y una etiqueta española del rol; nunca inserta HTML recibido desde la API.

- [ ] **Step 5: Integrar navegación y estilos**

Agregar `[data-session-link]` al encabezado sin retirar enlaces existentes. Importar e inicializar `initSessionNavigation` desde `js/app.js`. Crear estilos responsivos reutilizando colores, bordes, focos y anchos actuales; a 320 px no debe existir desplazamiento horizontal.

- [ ] **Step 6: Ejecutar pruebas y commit**

Run: `npm test`

Expected: todas las pruebas pasan.

```bash
git add acceso.html index.html css/styles.css js/acceso.js js/sesion-navegacion.js js/app.js tests/access-page.test.js tests/session-navigation.test.js tests/homepage.test.js
git commit -m "feat: add accessible customer account experience"
```

---

### Task 7: Configuración, documentación y verificación integral

**Files:**
- Create: `.env.example`
- Modify: `.gitignore`
- Modify: `README.md`
- Modify: `server/server.js`
- Modify: `server/app.js`
- Create: `tests/configuration.test.js`

**Interfaces:**
- Produces: `createRuntime(options = {}) -> { app, ready: Promise<void> }` que compone repositorios, servicios, bootstrap y rutas una sola vez.
- Consumes: variables `PORT`, `HOST`, `NODE_ENV` y los seis nombres `PUBLITEX_*` definidos en Task 2.

- [ ] **Step 1: Escribir pruebas fallidas de configuración**

Probar que `createRuntime` no escucha puertos al importarse, espera el bootstrap antes de aceptar tráfico, usa cookie segura solo con `NODE_ENV=production`, rechaza una configuración privilegiada incompleta y no imprime valores de contraseña. Probar que `.gitignore` incluye `.env` y permite `.env.example`.

- [ ] **Step 2: Ejecutar pruebas para comprobar que fallan**

Run: `node --test tests/configuration.test.js`

Expected: FAIL porque `createRuntime` todavía no existe.

- [ ] **Step 3: Implementar composición final y documentación**

`.env.example` debe contener nombres sin secretos reales:

```dotenv
PORT=8081
HOST=0.0.0.0
NODE_ENV=development
PUBLITEX_BOSS_NAME=
PUBLITEX_BOSS_EMAIL=
PUBLITEX_BOSS_PASSWORD=
PUBLITEX_SUPERADMIN_NAME=
PUBLITEX_SUPERADMIN_EMAIL=
PUBLITEX_SUPERADMIN_PASSWORD=
```

El README debe explicar `npm install`, `npm test`, `npm start`, acceso LAN mediante `http://IP_LOCAL:8081`, naturaleza temporal de usuarios/sesiones, creación opcional de cuentas iniciales y prohibición de versionar `.env`.

- [ ] **Step 4: Verificar automáticamente**

Run: `npm test`

Expected: todas las pruebas pasan sin skips ni procesos abiertos.

Run: `git diff --check`

Expected: sin salida.

Run: `git status --short`

Expected: solamente los archivos previstos en esta tarea antes del commit.

- [ ] **Step 5: Prueba manual proporcional al riesgo**

Run: `npm start`

Verificar en navegador de escritorio y a 320 px:

1. `/` sigue navegable y el cotizador conserva su funcionamiento.
2. `Ingresar` abre `/acceso.html`.
3. Un cliente se registra y ve nombre, correo y rol.
4. Al recargar, `Mi cuenta` conserva la sesión.
5. Cerrar sesión restaura `Ingresar`.
6. Reiniciar el proceso elimina los usuarios temporales, tal como documenta el README.

Detener el servidor al terminar.

- [ ] **Step 6: Commit**

```bash
git add .env.example .gitignore README.md server/server.js server/app.js tests/configuration.test.js
git commit -m "docs: complete authentication runtime setup"
```

- [ ] **Step 7: Revisión final del branch**

Run: `git log --oneline main..HEAD`

Expected: siete commits de implementación enfocados.

Run: `git status --short --branch`

Expected: branch limpio, sin archivos sin seguimiento.
