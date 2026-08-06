---
type: capability-spec
title: "Título de sesión en tipografía legible dentro de la fila de aplicación"
capability: "app-row-ui"
slug: "readable-session-title-typography"
domain: "feature"
delta_type: added
supersedes: null
superseded_by: null
status: completed
assigned_agent: "sdd-apply"
priority: low
depends_on: ["[[inline-session-naming]]"]
change_ref: "[[work-groups-history-time-format]]"
worktree: "/home/larayap/cronometro-app/.sdd/worktrees/work-groups-history-time-format"
feature_branch: "feature/work-groups-history-time-format"
commits: ["6cad42c74a39fc94e63416d767a6aa59696c85a8"]
mr: "https://github.com/larayap/cronometro-app/pull/4"
acceptance_criteria:
  - "El nombre de la aplicación, cuando la sesión no tiene título propio, se muestra en tipografía legible del sistema"
  - "El título de una sesión con nombre propio se muestra en la misma tipografía legible"
  - "El campo de edición del título usa la misma tipografía legible mientras se edita"
  - "El título de la ventana y el temporizador Pomodoro conservan la tipografía decorativa, sin cambios"
related: ["[[inline-session-naming]]", "[[status-indicator-non-interactive]]"]
affects: []
adrs: []
scope: ["src/components/AppRow.vue"]
verified_at: null
created: "2026-08-05"
updated: "2026-08-06"
tags: [capability-spec]
---

# Título de sesión en tipografía legible dentro de la fila de aplicación

## Purpose

El título de una sesión —o el nombre de la aplicación cuando no tiene título— se muestra hoy
con la misma tipografía decorativa que el resto de la ventana de trabajo, dificultando su
lectura. Esta spec cambia únicamente ese texto a una tipografía legible del sistema, dejando
el resto de la ventana (título de la ventana, temporizador Pomodoro) con su apariencia
decorativa actual, por decisión explícita del usuario.

## Requirements

- El sistema SHALL mostrar el título de la sesión, o el nombre de la aplicación cuando la
  sesión no tiene título, en una tipografía legible del sistema.
- El sistema SHALL mostrar el campo de edición de ese mismo título con la misma tipografía
  legible mientras el usuario lo está editando.
- El sistema SHALL NOT modificar la tipografía de ningún otro texto de la ventana de
  trabajo, incluido el título de la ventana y el temporizador.

## Scenarios

### Scenario: El nombre de la aplicación se lee con tipografía normal

**GIVEN** una fila cuya sesión no tiene título propio
**WHEN** el usuario mira el nombre de la aplicación en esa fila
**THEN** lo ve en una tipografía legible, distinta de la decorativa del resto de la ventana

### Scenario: El título de sesión se lee con tipografía normal

**GIVEN** una fila cuya sesión tiene un título puesto por el usuario
**WHEN** el usuario mira ese título
**THEN** lo ve en la misma tipografía legible

### Scenario: El resto de la ventana conserva su tipografía

**GIVEN** la ventana de trabajo abierta
**WHEN** el usuario mira el título de la ventana o el temporizador
**THEN** siguen mostrándose con la tipografía decorativa de siempre

### Scenario: Editar el título mantiene la tipografía legible

**GIVEN** el usuario editando el título de una sesión
**WHEN** escribe el nombre nuevo
**THEN** el campo de edición muestra el texto en la misma tipografía legible

## Acceptance Criteria

Implementación completa (commit `6cad42c`, `AppRow.vue`): `font-family: sans-serif` en
`.app-name` y `.app-name-input` (en esta última, después de `font: inherit`, cuyo shorthand
resetea `font-family`). Revisión de diff confirma que `App.vue` y `CronometroPomodoro.vue`
no fueron tocados. Verificación visual (Franja B) completada por `sdd-verify` (iteración 2,
app real en Windows): con dos filas activas (`Discord` sin título propio, y renombrada a
`Voice call`), ambos textos se ven en sans-serif claramente distinto de la tipografía
decorativa del título "Work" y de los dígitos del cronómetro `00:00:00`, capturado en la
misma pantalla. El campo de edición se abrió (click sobre el nombre) y usa la misma regla
CSS (`font-family: sans-serif` explícito, no heredado) — confirmado por código, la captura
del campo abierto no llegó a mostrar texto tipeado antes del `Enter`. El widget Pomodoro en
sí no se abrió en esta sesión (solo se abrió "W"); su código no forma parte del diff de este
cambio (confirmado en iteración 1), así que no hay razón para esperar que su tipografía haya
cambiado.

- [x] El nombre de la aplicación, cuando la sesión no tiene título propio, se muestra en
  tipografía legible del sistema. (visual: fila "Discord" antes de renombrar, sans-serif)
- [x] El título de una sesión con nombre propio se muestra en la misma tipografía legible.
  (visual: fila renombrada a "Voice call", sans-serif)
- [x] El campo de edición del título usa la misma tipografía legible mientras se edita.
  (campo de edición abierto y usado para escribir el nombre nuevo; regla CSS aplicable
  confirmada por código — `font-family: sans-serif` tras `font: inherit`)
- [x] El título de la ventana y el temporizador Pomodoro conservan la tipografía decorativa,
  sin cambios. (visual: título "Work" y dígitos `00:00:00` en la misma fuente decorativa de
  siempre, en la misma captura donde los nombres de fila ya se ven en sans-serif; el widget
  Pomodoro no se abrió, pero su archivo no aparece en el diff)

## Related

- [[inline-session-naming]] — provee el mecanismo de nombre de sesión cuyo texto esta spec
  hace legible
- [[status-indicator-non-interactive]] — otra pieza presentacional de la misma fila,
  independiente de esta spec
