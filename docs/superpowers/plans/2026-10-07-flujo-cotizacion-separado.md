# Flujo de cotización separado Implementation Plan

**Goal:** Separar la creación y edición de una cotización del historial del cliente.

**Architecture:** El historial solo lista y abre cotizaciones. Una página de borrador recibe su id en la URL; el selector recibe ese mismo id y vuelve al borrador tras agregar el ítem.

**Spec:** `docs/superpowers/specs/2026-10-07-flujo-cotizacion-separado-design.md`

## Tasks

1. Simplificar el historial para que cree y abra borradores en una página dedicada.
2. Crear la página/controlador de borrador con edición, productos y envío.
3. Vincular el selector de servicios a un borrador mediante `quoteId`.
4. Cubrir el recorrido completo y ejecutar `npm test`.
