---
type: capability-spec
title: "El indicador de estado ▶/⏸ es informativo, no un control"
capability: "app-row-ui"
slug: "status-indicator-non-interactive"
domain: "feature"
delta_type: null
supersedes: null
superseded_by: null
status: completed
assigned_agent: "sdd-apply"
priority: medium
depends_on: ["[[two-state-row-machine]]"]
change_ref: "[[app-detection-logos-audio]]"
worktree: "/home/larayap/cronometro-app/.sdd/worktrees/app-detection-logos-audio"
feature_branch: "feature/app-detection-logos-audio"
commits: ["0930d53cf6387371c3b88fa28757fb3ecdca0c39"]
mr: "https://github.com/larayap/cronometro-app/pull/2"
acceptance_criteria:
  - "Hacer click sobre el indicador no produce ningún efecto en el estado de la fila"
  - "Pasar el cursor sobre el indicador no muestra ninguna respuesta visual de botón"
  - "El indicador comunica su estado mediante texto accesible descriptivo, no una acción"
related: []
affects: []
adrs: []
scope: ["src/components/CronometroAplicacion.vue"]
verified_at: "2026-08-01"
created: "2026-08-01"
updated: "2026-08-02"
tags: [capability-spec]
---

# El indicador de estado ▶/⏸ es informativo, no un control

## Purpose

El glifo que hoy funciona como botón de play pasa a comunicar únicamente si la fila está
corriendo o pausada, sin ser una acción que el usuario pueda ejecutar. La fila queda con un
único control interactivo real —detener—, y el indicador debe leerse sin ambigüedad como un
dato, no como un botón vecino, para que nadie intente accionarlo por error.

## Requirements

- El sistema SHALL mostrar el indicador con el glifo de play cuando la fila está en estado
  corriendo, y con el glifo de pausa cuando está en estado pausado.
- El sistema SHALL NOT ejecutar ninguna acción sobre el estado de la fila cuando el usuario
  hace click sobre el indicador.
- El sistema SHALL NOT mostrar ninguna respuesta visual de botón (resalte, cambio de
  cursor, ampliación) cuando el usuario pasa el cursor sobre el indicador.
- El sistema SHALL exponer, para tecnologías de asistencia, un texto que describa el
  estado actual de la fila en términos de estado y no de acción disponible.
- El sistema SHALL mantener el control de detener como el único elemento interactivo de la
  fila.

## Scenarios

### Scenario: Click sobre el indicador no hace nada

**GIVEN** una fila en estado corriendo o pausado
**WHEN** el usuario hace click sobre el indicador ▶/⏸
**THEN** el estado de la fila no cambia y no ocurre ninguna acción

### Scenario: El cursor no reacciona sobre el indicador

**GIVEN** una fila visible con su indicador de estado
**WHEN** el usuario pasa el cursor sobre el indicador
**THEN** no aparece ningún resalte, cambio de cursor ni animación de botón

### Scenario: El indicador cambia de glifo según el estado

**GIVEN** una fila que pasa de estado pausado a corriendo
**WHEN** ese cambio de estado ocurre
**THEN** el indicador muestra el glifo de play; si vuelve a pausado, muestra el glifo de
pausa

### Scenario: Texto accesible describe estado, no acción

**GIVEN** una fila en estado pausado
**WHEN** una tecnología de asistencia lee el indicador de esa fila
**THEN** anuncia el estado actual ("en pausa") y no un verbo de acción como "reanudar"

## Acceptance Criteria

- [x] Hacer click sobre el indicador no produce ningún efecto en el estado de la fila.
- [x] Pasar el cursor sobre el indicador no muestra ninguna respuesta visual de botón.
- [x] El indicador refleja correctamente, en todo momento, cuál de los dos estados de la
  fila está activo.
- [x] El texto accesible del indicador describe estado, no una acción disponible.

## Related

- [[two-state-row-machine]] — el indicador refleja directamente el estado que ese modelo
  define para la fila
