---
type: capability-spec
title: "Deseleccionar una aplicación desde el modal la saca de la selección guardada"
capability: "app-monitoring"
slug: "deselect-from-saved-selection"
domain: "feature"
delta_type: added
supersedes: null
superseded_by: null
status: review
assigned_agent: "sdd-apply"
priority: high
depends_on: ["[[row-lifecycle-persistence-by-type]]"]
change_ref: "[[sessions-groups-history]]"
worktree: "/home/larayap/cronometro-app/.sdd/worktrees/sessions-groups-history"
feature_branch: "feature/sessions-groups-history"
commits: ["70565f9c865e1abce5b7aa7932da560f715d5158"]
mr: ""
acceptance_criteria:
  - "Desmarcar un programa sin fila activa lo saca de la selección guardada y ya no reaparece al abrirse"
  - "Desmarcar un programa con fila activa cierra y registra esa fila con el mismo efecto que detenerla"
  - "El selector distingue de un vistazo qué programas ya están en la selección guardada"
  - "Volver a marcar un programa desmarcado lo reincorpora a la selección guardada con normalidad"
related: ["[[installed-apps-data-integrity]]", "[[selection-type-manual-vs-auto]]", "[[saved-selection-only-monitoring]]"]
affects: ["[[sessions-json-persistence]]"]
adrs: []
scope: ["src/components/AppSelectorModal.vue", "src/main/ipc-handlers.js"]
verified_at: null
created: "2026-08-02"
updated: "2026-08-02"
tags: [capability-spec]
---

# Deseleccionar una aplicación desde el modal la saca de la selección guardada

## Purpose

Hoy, una vez que un programa entra a la selección guardada, no existe una forma directa de
sacarlo: detener su fila solo lo saca del listado visible en ese momento, y si es de
modalidad automática vuelve a aparecer la próxima vez que se abra. Esta spec agrega la
acción inversa a agregar: desde el mismo selector, el usuario puede desmarcar un programa
que ya está en su selección guardada, y ese programa deja de generar filas hasta que se lo
vuelva a agregar.

## Requirements

- El sistema SHALL permitir al usuario, desde el mismo selector que usa para agregar
  programas, desmarcar un programa que está actualmente en su selección guardada.
- El sistema SHALL sacar ese programa de la selección guardada en el momento en que el
  usuario lo desmarca.
- El sistema SHALL NOT generar una fila nueva para ese programa, ni por foco ni por
  apertura de proceso, una vez sacado de la selección guardada, hasta que el usuario lo
  agregue de nuevo.
- El sistema SHALL, cuando el programa desmarcado tiene en ese momento una fila visible,
  cerrar y registrar la sesión de esa fila y quitarla del listado visible, con el mismo
  efecto que el control de detener.
- El sistema SHALL mostrar, dentro del mismo selector, cuáles programas forman parte de la
  selección guardada en este momento, distinguiéndolos de los que todavía no se agregaron.
- El sistema SHOULD permitir volver a agregar un programa previamente desmarcado sin
  ningún paso adicional al de agregar cualquier otro programa.

## Scenarios

### Scenario: Desmarcar un programa sin fila activa lo saca de la selección

**GIVEN** un programa en la selección guardada, sin fila visible en este momento
**WHEN** el usuario lo desmarca desde el selector
**THEN** el programa deja de estar en la selección guardada y no vuelve a generar fila al
abrirse

### Scenario: Desmarcar un programa con fila activa la cierra también

**GIVEN** un programa en la selección guardada con una fila visible, corriendo o pausada
**WHEN** el usuario lo desmarca desde el selector
**THEN** la fila desaparece del listado visible, su sesión queda registrada en el
historial, y el programa deja de estar en la selección guardada

### Scenario: El selector distingue lo ya seleccionado

**GIVEN** el selector abierto con varios programas, algunos ya en la selección guardada
**WHEN** el usuario lo revisa
**THEN** puede distinguir de un vistazo cuáles ya forman parte de su selección

### Scenario: Re-agregar un programa desmarcado

**GIVEN** un programa que el usuario desmarcó previamente
**WHEN** el usuario lo vuelve a marcar desde el selector
**THEN** vuelve a formar parte de la selección guardada con normalidad

## Acceptance Criteria

Implementación completa (commit 70565f9): `choose()` reordena el guard (`isSelected` antes
que `limitReached`) y la clase `disabled` ya no bloquea el click sobre filas seleccionadas en
el límite. El efecto de fondo (`removeApp` → `remove-from-selection` → `removeFromSelection`
+ `closeRow`) es comportamiento preexistente sin cambios (D-6). Los cuatro criterios son
interacción de click sobre la ventana real y quedan sin marcar — requieren Windows con la app
corriendo, ver `observations.md`.

- [ ] Desmarcar un programa sin fila activa lo saca de la selección guardada y no vuelve a
  generar fila hasta que se lo agregue de nuevo.
- [ ] Desmarcar un programa con fila activa cierra y registra esa fila, con el mismo efecto
  que el control de detener, y lo saca de la selección guardada.
- [ ] El selector distingue visualmente qué programas ya están en la selección guardada.
- [ ] Volver a marcar un programa previamente desmarcado lo reincorpora a la selección
  guardada sin pasos adicionales.

## Related

- [[row-lifecycle-persistence-by-type]] — define el ciclo de vida de la fila que esta spec
  invoca cuando el programa desmarcado tiene fila activa
- [[installed-apps-data-integrity]] — gobierna la calidad del listado del mismo selector
  donde vive esta acción
- [[selection-type-manual-vs-auto]] — la modalidad de un programa no cambia el efecto de
  esta acción: desmarcar siempre saca de la selección guardada, sea automática o manual
- [[saved-selection-only-monitoring]] — esta acción es la vía explícita, además de los
  eventos automáticos, para sacar un programa de la selección guardada que esa restricción
  protege
