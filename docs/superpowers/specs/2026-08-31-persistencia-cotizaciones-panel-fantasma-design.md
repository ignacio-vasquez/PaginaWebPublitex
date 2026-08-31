# Persistencia de cotizaciones y panel fantasma

## Objetivo

Convertir la aplicación local de Publitexweb en una demostración funcional y persistente del ciclo completo de una cotización. Los usuarios, las sesiones, las cotizaciones y su seguimiento sobrevivirán a reinicios del servidor mediante SQLite.

La entrega incluirá un panel reservado para el `superadmin`, denominado panel fantasma, desde el cual el propietario podrá simular los roles de cliente, jefe y trabajador sin perder su identidad ni su acceso maestro. El resultado debe ser suficientemente estable y cercano al producto deseado para mostrárselo al jefe de la empresa y registrar decisiones de mejora, cambio o eliminación antes de publicar el sistema.

## Alcance

Esta etapa incluye:

- persistencia local de usuarios, sesiones y cotizaciones;
- cotizaciones con uno o varios productos;
- estados generales y estados por producto;
- observaciones visibles para el cliente y notas exclusivas del equipo;
- solicitudes de cambio separadas de la información original;
- asignación de productos o trabajos a trabajadores;
- historial de eventos y auditoría administrativa;
- simulación controlada de roles desde una ruta oculta;
- respaldo local de la base de datos;
- datos opcionales de demostración.

Quedan fuera de esta etapa:

- publicación en internet;
- almacenamiento de archivos adjuntos;
- correo electrónico y notificaciones externas;
- pagos, facturación o cálculo definitivo de precios;
- suplantación de cuentas reales específicas;
- funcionamiento con múltiples servidores simultáneos.

Los adjuntos podrán figurar conceptualmente en las solicitudes de cambio, pero no se cargarán ni persistirán hasta una etapa posterior.

## Tecnología y arquitectura

La aplicación utilizará SQLite en el mismo computador que ejecuta el servidor. No requiere un servicio contratado ni tiene costos de licencia o alojamiento. La base se almacenará en un archivo local excluido de Git.

La estructura actual de rutas, servicios y repositorios se conservará. Los repositorios SQLite reemplazarán a los repositorios en memoria detrás de interfaces explícitas, de modo que una migración futura a PostgreSQL, Oracle u otro motor no obligue a reescribir las reglas de negocio ni las rutas HTTP.

Al iniciar, el servidor:

1. abrirá la base configurada;
2. activará claves foráneas y una configuración de escritura segura para uso local;
3. ejecutará migraciones versionadas pendientes;
4. creará, sin duplicar, las cuentas iniciales configuradas;
5. quedará listo para atender solicitudes únicamente después de completar esos pasos.

Las operaciones que afecten varias entidades se ejecutarán en transacciones. Por ejemplo, cambiar un estado y registrar su evento deberán confirmarse juntos o revertirse juntos.

## Modelo de datos

El modelo persistente tendrá, como mínimo, las siguientes áreas conceptuales:

- `users`: identidad, nombre, correo normalizado único, hash de contraseña, rol real, estado y fechas de creación/actualización;
- `sessions`: hash de token, usuario, creación, vencimiento y revocación;
- `quotes`: propietario, estado general, prioridad, fechas estimadas y metadatos;
- `quote_items`: productos solicitados, descripción, especificaciones, cantidad, estado y orden;
- `quote_assignments`: producto o trabajo asignado, trabajador y fechas;
- `quote_notes`: observaciones, autor, rol actuante y visibilidad pública o interna;
- `change_requests`: producto afectado, descripción, estado, respuesta y fechas;
- `quote_events`: historial inmutable de los cambios relevantes;
- `role_simulations`: inicio y finalización de cada simulación del superadmin;
- `admin_audit`: acciones administrativas relevantes y su contexto.

Las migraciones se guardarán en el repositorio. El archivo de base de datos, sus archivos auxiliares y los respaldos quedarán ignorados por Git.

## Roles y permisos

### Cliente

El cliente podrá:

- crear cotizaciones con uno o varios productos;
- guardar, editar y eliminar borradores propios;
- enviar una cotización;
- consultar estados, fechas, observaciones públicas e historial propio;
- solicitar cambios sobre productos de una cotización enviada;
- responder cuando el equipo pida una aclaración;
- cancelar cuando las reglas del estado lo permitan.

No podrá consultar información de otros clientes ni notas internas.

### Trabajador

El trabajador podrá:

- consultar los trabajos o productos que tenga asignados;
- actualizar avances dentro de las transiciones permitidas;
- agregar observaciones públicas o internas, diferenciadas explícitamente;
- responder o aportar información a solicitudes de cambio relacionadas con su trabajo.

No podrá tomar decisiones reservadas al jefe ni consultar trabajos no asignados salvo que una regla futura lo autorice.

### Jefe

El jefe podrá:

- revisar todas las cotizaciones enviadas;
- solicitar aclaraciones, aceptar o rechazar solicitudes;
- definir prioridad y fechas estimadas;
- asignar trabajos o productos a trabajadores;
- aceptar, rechazar o pedir aclaraciones sobre cambios solicitados;
- actualizar estados administrativos;
- agregar observaciones públicas o internas.

### Superadmin

El `superadmin` conservará acceso administrativo completo y podrá entrar al panel fantasma. Su identidad real nunca se sustituirá por el rol simulado.

## Panel fantasma y simulación

El panel fantasma se servirá desde una ruta reservada que no aparecerá en la navegación pública ni en los menús normales. La URL por sí sola no concederá acceso: el servidor exigirá una sesión cuya identidad real tenga el rol `superadmin`.

Desde el panel se podrá activar una simulación de cliente, trabajador o jefe. La simulación se guardará en el servidor y estará asociada a la sesión real. Para el resto de las reglas de la aplicación, el rol efectivo será el simulado, con una excepción indispensable: el superadmin siempre conservará la capacidad de terminar la simulación y volver al panel maestro.

Mientras exista una simulación, todas las páginas privadas mostrarán una barra fija y diferenciada con el rol efectivo y la acción **Volver a superadmin**. Cerrar sesión terminará la simulación.

La simulación de cliente utilizará una identidad de demostración persistente vinculada al entorno de prueba. La simulación de trabajador utilizará un trabajador de demostración persistente. No se accederá como una cuenta real específica en esta etapa.

El inicio, finalización y las acciones importantes realizadas durante una simulación registrarán:

- identidad real del superadmin;
- rol efectivo simulado;
- entidad afectada;
- tipo de acción;
- fecha y contexto no sensible.

## Flujo de cotizaciones y productos

El recorrido normal de una cotización será:

`borrador → enviada → en revisión → aceptada → en producción → lista → entregada`

También existirán los estados laterales `requiere cambios`, `rechazada` y `cancelada`. Las transiciones válidas se definirán en el servidor y no dependerán de los controles visibles en el navegador.

Una cotización tendrá un estado general y uno o más productos con estados propios. Los productos podrán avanzar por separado. El estado general se recalculará cuando corresponda mediante reglas explícitas; no se deducirá con comparaciones informales en la interfaz.

El recorrido de demostración principal será:

1. el superadmin simula un cliente y crea una cotización con productos;
2. envía la cotización;
3. cambia a jefe, la revisa, acepta y asigna;
4. cambia a trabajador y registra avances;
5. cambia a cliente y solicita un cambio;
6. cambia a jefe, responde y decide sobre el cambio;
7. cambia a trabajador y completa la producción;
8. cambia a jefe o al rol autorizado y marca la entrega;
9. cambia a cliente y consulta el resultado y el historial.

## Solicitudes de cambio

Una cotización enviada no podrá modificarse silenciosamente. El cliente deberá usar la acción separada **Solicitar un cambio**.

Cada solicitud almacenará:

- producto afectado;
- descripción del cambio;
- autor y fecha;
- estado `pendiente`, `requiere aclaración`, `aceptado`, `rechazado` o `aplicado`;
- respuesta y responsable de la decisión;
- referencia a los eventos que produjo.

Las solicitudes nuevas se mostrarán con una indicación visual clara y una línea de tiempo propia. Al aceptar y aplicar un cambio se conservará la especificación previa en el historial; no se sobrescribirá sin trazabilidad.

El cliente podrá solicitar cambios desde el envío hasta antes de la entrega. Si el producto ya está en producción, la interfaz advertirá que el cambio puede modificar fechas o costos. Esa advertencia no reemplazará la decisión del jefe.

Los archivos adjuntos se posponen. La interfaz no prometerá que se almacenan archivos en esta entrega.

## Observaciones e historial

Cada observación deberá declarar una de dos visibilidades:

- `public`: visible para el cliente y el equipo;
- `internal`: visible solamente para trabajador, jefe y superadmin cuando su rol efectivo lo permita.

El historial conservará eventos importantes, no textos editables que puedan ocultar decisiones anteriores. Incluirá creación, envío, decisiones, asignaciones, estados, solicitudes de cambio, respuestas y entrega.

## Interfaz

La experiencia privada se dividirá en:

- **Mis cotizaciones**, para clientes;
- **Bandeja de solicitudes**, para el jefe;
- **Trabajos asignados**, para trabajadores;
- **Panel fantasma**, para el superadmin.

El cliente tendrá un formulario por productos y una vista de detalle con estado, observaciones, historial y solicitudes de cambio. El jefe tendrá filtros por estado y prioridad, decisiones, asignaciones y respuestas. El trabajador tendrá una vista enfocada en productos asignados y avances.

Las acciones destructivas o difíciles de revertir, como rechazar, cancelar o marcar como entregado, pedirán confirmación. Los errores mantendrán los datos válidos introducidos y se anunciarán de forma accesible.

La implementación reutilizará el lenguaje visual y los patrones accesibles existentes. Esta etapa no incluye un rediseño general.

## API y reglas de negocio

La API se ampliará bajo `/api` con recursos para cotizaciones, productos, notas, cambios, asignaciones y simulación. Los nombres exactos de las rutas se fijarán en el plan de implementación, manteniendo estas reglas:

- toda lectura y escritura privada requiere una sesión válida;
- los permisos se evalúan con la identidad real y el rol efectivo;
- únicamente un superadmin real puede iniciar o terminar una simulación;
- terminar la simulación permanece disponible incluso bajo un rol efectivo restringido;
- los clientes solo acceden a sus propios datos;
- las notas internas nunca se incluyen en respuestas destinadas a clientes;
- las transiciones de estado inválidas se rechazan;
- las respuestas no exponen hashes, tokens ni detalles internos.

Los errores de validación usarán `400`, la ausencia de sesión `401`, los permisos insuficientes `403`, los recursos inexistentes `404` y los conflictos de estado o concurrencia `409`. Los fallos inesperados usarán `500` con un mensaje público genérico y registro técnico seguro.

## Respaldo y recuperación local

El proyecto incluirá un comando documentado para crear una copia coherente de SQLite en una carpeta local ignorada por Git. El nombre incluirá fecha y hora. En esta etapa, restaurar será una operación manual documentada y realizada con el servidor detenido.

Los datos de demostración serán opcionales, idempotentes y reconocibles como ficticios. No se mezclarán secretos ni información real de clientes en el repositorio.

## Pruebas

Las pruebas automatizadas cubrirán:

- ejecución repetible y ordenada de migraciones;
- persistencia después de cerrar y volver a abrir la base;
- unicidad de correo y relaciones entre entidades;
- persistencia, vencimiento y revocación de sesiones;
- permisos de cada rol;
- acceso exclusivo al panel fantasma;
- inicio, uso y finalización segura de simulaciones;
- retorno garantizado a `superadmin`;
- cotizaciones con varios productos;
- transiciones válidas e inválidas;
- asignaciones y prioridades;
- separación estricta de notas públicas e internas;
- creación, aclaración, aceptación, rechazo y aplicación de cambios;
- transacciones y conflictos;
- recorrido integral de demostración desde cliente hasta entrega;
- funcionamiento previo de la web pública y la autenticación.

Las pruebas de base de datos usarán archivos temporales aislados y eliminables, sin tocar la base local de desarrollo.

## Criterios de término

La etapa estará completa cuando:

- usuarios, sesiones, cotizaciones y seguimiento sobrevivan a un reinicio;
- el superadmin pueda recorrer de forma segura todo el flujo usando simulaciones;
- cada rol vea únicamente las acciones y los datos que le corresponden;
- una solicitud de cambio nueva sea claramente distinguible y conserve el historial;
- el recorrido integral funcione desde la interfaz;
- exista un respaldo local documentado;
- las pruebas automatizadas relevantes pasen;
- la aplicación pueda demostrarse localmente al jefe de la empresa con datos ficticios y sin preparación técnica compleja.

La retroalimentación obtenida durante esa demostración se registrará como decisiones separadas para una etapa posterior; no se anticiparán cambios sin observar primero el uso real del prototipo.
