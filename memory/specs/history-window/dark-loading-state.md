---
type: capability-spec
title: "Sin destello blanco al abrir la ventana de historial"
capability: "history-window"
slug: "dark-loading-state"
domain: "feature"
delta_type: null
supersedes: null
superseded_by: null
status: review
assigned_agent: "sdd-apply"
priority: low
depends_on: []
change_ref: "[[app-detection-logos-audio]]"
worktree: "/home/larayap/cronometro-app/.sdd/worktrees/app-detection-logos-audio"
feature_branch: "feature/app-detection-logos-audio"
commits: ["777f4ab6ca299bdffe9aadc0d414958e575df4af"]
mr: ""
acceptance_criteria:
  - "Al abrir la ventana de historial no se observa ningún destello blanco antes del contenido"
  - "El fondo de la ventana de historial es oscuro desde el primer instante en que se muestra"
related: []
affects: []
adrs: []
scope: ["src/background.js", "public/history.html", "src/history/HistoryView.vue"]
verified_at: "2026-08-01"
created: "2026-08-01"
updated: "2026-08-01"
tags: [capability-spec]
---

# Sin destello blanco al abrir la ventana de historial

## Purpose

Al abrir la ventana de historial aparece hoy un destello blanco de aproximadamente un
segundo antes de que se vea el contenido, porque el fondo oscuro llega recién cuando el
contenido termina de cargar. Esta spec corrige eso: la ventana se muestra con fondo oscuro
desde el primer instante, coherente con el tema visual del resto de la aplicación.

## Requirements

- El sistema SHALL mostrar la ventana de historial con fondo oscuro desde el primer
  instante en que se hace visible, sin depender de que el contenido termine de cargar.
- El sistema SHALL NOT mostrar ningún destello de color claro entre la apertura de la
  ventana de historial y la aparición de su contenido.
- El sistema SHALL mantener el fondo oscuro visualmente coherente con el resto de la
  aplicación durante toda la carga de la ventana de historial.

## Scenarios

### Scenario: Abrir el historial no produce destello blanco

**GIVEN** la aplicación principal abierta
**WHEN** el usuario abre la ventana de historial
**THEN** la ventana aparece con fondo oscuro desde el primer instante, sin ningún destello
de color claro antes de que se vea el contenido

### Scenario: El fondo oscuro se mantiene durante toda la carga

**GIVEN** la ventana de historial recién abierta, con el contenido todavía cargando
**WHEN** el usuario observa la ventana mientras carga
**THEN** el fondo se mantiene oscuro en todo momento hasta que el contenido termina de
mostrarse

## Acceptance Criteria

- [x] Al abrir la ventana de historial no se observa ningún destello blanco antes del
  contenido.
- [x] El fondo de la ventana de historial es oscuro desde el primer instante en que se
  muestra, y se mantiene así durante toda la carga.

## Related

(sin specs relacionadas en este cambio)
