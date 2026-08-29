# Diseño del sistema web para empresa de publicidad visual

## Propósito

Construir una aplicación web real para una empresa dedicada a letreros luminosos, rotulación vehicular y adhesivos, usándola también como proyecto progresivo de aprendizaje. El desarrollo seguirá la secuencia HTML, CSS, JavaScript, Node.js con Express, Oracle y React.

La primera versión será exclusiva para una empresa. No incluirá gestión multiempresa, pagos, facturación, inventario ni mensajería automática.

## Usuarios y permisos

El sistema tendrá un área pública y un área interna protegida.

- **Visitante:** consulta la información pública, revisa servicios y trabajos realizados, y envía solicitudes de cotización sin crear una cuenta.
- **Trabajador:** inicia sesión y consulta únicamente las órdenes que tiene asignadas. Su acceso a las órdenes es de solo lectura.
- **Administrador o jefe:** gestiona clientes, cotizaciones, trabajadores, servicios y todas las órdenes. Puede crear, editar, asignar y cambiar el estado de una orden.
- **Superadministrador:** cuenta reservada para el propietario técnico del sistema. Gestiona cuentas, recupera accesos y supervisa el sistema completo. No aparece en la gestión cotidiana, pero sus acciones relevantes quedan en la bitácora.

Los permisos se aplicarán en el servidor. Ocultar controles en la interfaz no reemplazará la autorización de Express.

## Arquitectura

La solución tendrá tres áreas:

1. **Sitio público:** inicio, servicios, portafolio, información de la empresa, contacto y solicitud de cotización.
2. **Panel interno:** autenticación y vistas adaptadas a los permisos del administrador y del trabajador.
3. **Servidor y persistencia:** API de Express, reglas del negocio y una base de datos Oracle.

El navegador nunca se conectará directamente a Oracle. Toda lectura o modificación seguirá este flujo:

```text
Navegador -> Node.js/Express -> Oracle
```

Durante el desarrollo, todos los componentes se ejecutarán en el computador local. Una publicación posterior separará el servidor accesible por Internet, la base de datos, el almacenamiento de archivos, el dominio y HTTPS.

## Evolución tecnológica

El mismo producto crecerá en etapas para aislar cada aprendizaje:

1. **HTML:** contenido semántico y estructura del sitio público.
2. **CSS:** identidad visual provisional, diseño adaptable y accesibilidad básica.
3. **JavaScript:** navegación, formularios, validación y datos simulados.
4. **Node.js y Express:** servidor, rutas, autenticación y API.
5. **Oracle:** modelo relacional y persistencia real.
6. **React:** reconstrucción progresiva de la interfaz sobre la misma API.

La identidad provisional permitirá avanzar sin el nombre, logotipo y fotografías definitivos. Esos recursos se reemplazarán más adelante sin modificar la arquitectura.

## Diseño público aprobado

La página de inicio tendrá:

- Encabezado con logotipo, navegación y acción para cotizar.
- Presentación de gran tamaño con fotografía de un trabajo, una frase que explique el servicio y accesos a cotización y portafolio.
- Mensajes breves sobre diseño a medida, fabricación e instalación.
- Servicios principales ilustrados: letreros luminosos, rotulación vehicular y adhesivos.
- Trabajos recientes con fotografías reales cuando estén disponibles.
- Invitación final para comenzar una cotización.

La dirección visual será profesional y comercial, con fotografías como elemento principal. El color y la tipografía finales dependerán de la identidad existente de la empresa.

## Panel interno aprobado

El panel usará una navegación lateral y un área principal de trabajo. El administrador verá métricas resumidas, todas las órdenes y acciones de creación o edición. El trabajador verá una versión reducida con sus propias órdenes y sin controles de modificación.

La lista de órdenes mostrará al menos número, tipo de trabajo, cliente, estado y acceso al detalle. El detalle incluirá ubicación, medidas, configuración, materiales, fechas, archivos, observaciones y trabajadores asignados.

## Modelo de información

Las entidades iniciales serán:

- **Usuarios:** identidad de acceso, correo, hash de contraseña, rol y estado de cuenta.
- **Trabajadores:** información laboral asociada a una cuenta de usuario.
- **Clientes:** persona o empresa, información de contacto y dirección.
- **Servicios:** categorías de productos y trabajos ofrecidos.
- **Cotizaciones:** solicitudes recibidas desde el sitio público y su estado.
- **Órdenes de trabajo:** especificaciones, ubicación, fechas, prioridad y estado de producción.
- **Asignaciones:** relación de muchos a muchos entre órdenes y trabajadores.
- **Archivos:** metadatos de fotografías, diseños o documentos asociados a cotizaciones u órdenes.
- **Bitácora:** actor, acción, fecha y referencia del cambio administrativo.

Relaciones principales:

```text
Cliente 1 --- N Cotizaciones
Cliente 1 --- N Órdenes
Servicio 1 --- N Órdenes
Órdenes N --- N Trabajadores, mediante Asignaciones
Cotización 0..1 --- 0..1 Orden originada
Orden 1 --- N Archivos
Usuario 1 --- N registros de Bitácora
```

## Flujo principal

1. Un visitante envía una solicitud de cotización.
2. El administrador la revisa y contacta al cliente.
3. Si se acepta, el administrador la convierte en una orden.
4. El administrador completa las especificaciones y asigna uno o varios trabajadores.
5. Cada trabajador inicia sesión y consulta únicamente sus órdenes.
6. El administrador actualiza la orden hasta finalizarla.

Estados de cotización:

```text
NUEVA -> EN_REVISION -> APROBADA
                    -> RECHAZADA
```

Estados de orden:

```text
PENDIENTE -> EN_DISENO -> EN_FABRICACION -> LISTA -> INSTALADA
         \-> CANCELADA
```

Las órdenes finalizadas o canceladas se conservan como historial. No se eliminan físicamente desde el uso normal del sistema.

## Seguridad y manejo de errores

- Las contraseñas se almacenarán mediante un algoritmo de hash adecuado, nunca como texto legible.
- La autenticación utilizará sesiones seguras.
- Express verificará identidad, rol y pertenencia de la orden en cada operación protegida.
- El servidor validará todos los datos, aunque el navegador ya los haya validado.
- El acceso a Oracle utilizará consultas parametrizadas.
- Las acciones administrativas relevantes se registrarán en una bitácora.
- Los usuarios recibirán mensajes comprensibles; los detalles técnicos permanecerán en los registros del servidor.
- Los archivos se almacenarán localmente solo durante el desarrollo. Antes del despliegue se elegirá almacenamiento persistente con copias de seguridad.

## Estrategia de pruebas

- **HTML y CSS:** estructura semántica, enlaces, accesibilidad básica y adaptación a diferentes tamaños de pantalla.
- **JavaScript:** validaciones y comportamiento de la interfaz.
- **Express:** rutas, autenticación, autorización y respuestas de error.
- **Oracle:** claves, restricciones, relaciones, transacciones y consultas.
- **Integración:** recorrido completo desde cotización hasta consulta de la orden asignada.
- **React:** componentes, estados de interfaz y consumo de la API.

Los casos de permisos deben demostrar expresamente que un trabajador no puede consultar órdenes ajenas ni modificar ninguna orden, incluso si intenta llamar directamente a la API.

## Criterios de éxito de la primera versión completa

- Un visitante puede conocer los servicios, revisar trabajos y enviar una cotización.
- Un administrador puede iniciar sesión y administrar los datos operativos.
- Una cotización aprobada puede convertirse en una orden.
- El administrador puede asignar uno o varios trabajadores a una orden.
- Un trabajador autenticado ve solamente sus órdenes y no puede editarlas.
- Las reglas se conservan en Oracle y están protegidas por la API.
- La interfaz funciona en computador y teléfono.

