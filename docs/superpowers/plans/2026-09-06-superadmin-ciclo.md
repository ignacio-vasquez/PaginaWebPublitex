# Superadmin y ciclo de cotización Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox syntax for tracking.

**Goal:** Probar como cliente, jefe y trabajador desde el botón Superadmin y completar el ciclo de una cotización.

**Architecture:** La identidad real conserva superadmin; una simulación persistida por sesión determina la identidad efectiva. Usuarios de demostración por superadmin, sin contraseña utilizable, permiten conservar cotizaciones y asignaciones. Un flujo transaccional sobre las cotizaciones enviadas registra revisión, aceptación, asignación, producción, disponibilidad y entrega.

**Tech Stack:** Node.js, Express, SQLite, HTML/CSS y módulos JavaScript existentes.

**Spec:** docs/superpowers/specs/2026-08-31-persistencia-cotizaciones-panel-fantasma-design.md; alcance aprobado en conversación el 2026-09-06: botón literal Superadmin, selector cliente/jefe/trabajador, regreso al rol real y ciclo normal completo.

## Global Constraints

- No cambiar los roles reales para simular. Validación de permisos en servidor.
- Ningún usuario normal puede activar o terminar simulaciones ajenas.
- No usar cuentas reales de clientes o trabajadores como identidades simuladas.
- Cerrar sesión elimina la simulación; otra sesión del mismo superadmin no cambia de rol.
- Conservar cotizaciones, códigos, sesiones y datos existentes.
- Primera versión: asignación y avance de la cotización completa. No agregar solicitudes de cambios, rechazo/cancelación ni estados independientes por producto en esta entrega.
- Mantener el trabajo en el directorio que sirve la página ya aprobada. No descartar ni integrar mediante Git los cambios anteriores del usuario.

### Task 1: Sesión de simulación y autorización

Files: server/superadmin/simulation-service.js, simulation-routes.js; server/database/migrations/004_simulation.sql; server/auth/authorization.js, auth-routes.js; tests/simulation.test.js.

Interfaces: createSimulationService({database, authService, hashToken?}) returns getContext(token), setRole(token, role|null). Context is {user, realUser, simulation}; user is effective public profile, simulation is null or {role}, realUser is the actual public profile. app's authService exposes getSessionContext by attaching getContext. GET /api/auth/session returns existing authenticated/user plus realUser and simulation only for real superadmin. POST /api/superadmin/role accepts {role:'cliente'|'jefe'|'trabajador'|null}, returns context. GET /api/superadmin returns context. Simulation tables reference sessions and cascade deletion; audit records actual actor and effective role.

- [ ] Write tests denying normal users, forged roles and stale sessions, ensuring per-session persistence and real identity.
- [ ] Run node tests/simulation.test.js; observe missing implementation failure.
- [ ] Implement persistent demo identities and role selection with server-side real-role validation.
- [ ] Run simulation and existing auth tests.

### Task 2: Flujo de cotización y gestión

Files: server/database/migrations/005_quote_workflow.sql; server/quotes/workflow-service.js, workflow-routes.js; quote-repository.js; server/server.js, app.js; tests/workflow.test.js and full-cycle API test.

Interfaces: /api/work/quotes GET returns visible quotes with code/items/status/assignedWorkerId/events; /api/work/workers GET returns allowed workers; /api/work/quotes/:id/transition POST {status, workerId?}. Jefe: submitted→in_review→accepted (requires worker assignment), ready→delivered. Trabajador asignado: accepted→in_production→ready. Server returns 403 for wrong roles, 404 for invisible resources, 409 for invalid transitions, 400 for invalid assignee. Client quote reads include workflow status/events. Audit event contains actorId, effectiveRole, status and createdAt. Data change and event are atomic.

- [ ] Write service tests for valid/invalid transitions, worker ownership, and preservation after restart.
- [ ] Run tests, observe missing implementation failure.
- [ ] Implement additive workflow table, service/routing and client read integration.
- [ ] Run complete API role-switch journey using a temporary SQLite database.

### Task 3: Controles y pantallas

Files: js/superadmin.js, js/gestion.js, gestion.html; js/app.js, sesion-navegacion.js, acceso.js; css/styles.css; tests/superadmin-ui.test.js and gestion-page.test.js.

Interfaces: Superadmin button appears only for realUser.role superadmin, also while simulating. Role picker uses POST /api/superadmin/role and clears temporary quote handoffs on successful role switch; client goes to cotizacion.html, jefe/trabajador to gestion.html, return to acceso.html. Banner shows role and Volver a superadmin. Gestión consumes Task 2 endpoints and shows permitted action buttons and assignment selector. Client tracking lists recorded events.

- [ ] Write DOM tests for role visibility, switching, logout and work actions.
- [ ] Implement interfaces and responsive styling consistent with existing pages.
- [ ] Verify DOM tests and entire npm test suite.

### Task 4: Revisión y activación

- [ ] Review permissions, session isolation, status integrity and frontend navigation.
- [ ] Backup current database with npm run db:backup.
- [ ] Restart local server to apply migrations, verify HTTP and database integrity.
- [ ] Confirm the real superadmin account exists without exposing secrets; if missing, request account identification rather than promoting arbitrary users.
- [ ] Report usable entry point and verification evidence.
