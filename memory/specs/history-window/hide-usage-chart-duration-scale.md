---
type: capability-spec
title: "El gráfico de uso no muestra la escala de duración al pie de las barras"
capability: "history-window"
slug: "hide-usage-chart-duration-scale"
domain: "feature"
delta_type: added
supersedes: null
superseded_by: null
status: review
assigned_agent: "sdd-apply"
priority: low
depends_on: []
change_ref: "[[work-groups-history-time-format]]"
worktree: "/home/larayap/cronometro-app/.sdd/worktrees/work-groups-history-time-format"
feature_branch: "feature/work-groups-history-time-format"
commits: ["94b86b97a2a19dd79d30b60288e2537764a51ee5"]
mr: ""
acceptance_criteria:
  - "Debajo de las barras del gráfico no aparece ninguna escala de números de duración"
  - "Pasar el cursor sobre una barra sigue mostrando su tiempo exacto"
  - "Las listas 'Por app' y 'Por sesión' siguen mostrando sus columnas de tiempo sin cambios"
related: ["[[usage-aggregation-by-visible-app-name]]"]
affects: []
adrs: ["[[0010-charting-library-confined-to-history-bundle]]"]
scope: ["src/history/UsageChart.vue"]
verified_at: null
created: "2026-08-05"
updated: "2026-08-05"
tags: [capability-spec]
---

# El gráfico de uso no muestra la escala de duración al pie de las barras

## Purpose

El gráfico de tiempo por aplicación muestra hoy, debajo de las barras, una regla de números
con la duración exacta en cada marca. Esa regla compite visualmente con las barras y repite
una información que ya está disponible al pasar el mouse sobre cada una. Esta spec la
retira, dejando el gráfico más limpio sin perder el dato exacto: sigue disponible en el
tooltip de cada barra.

## Requirements

- El sistema SHALL NOT mostrar una escala de valores de duración al pie del gráfico de
  tiempo por aplicación.
- El sistema SHALL seguir mostrando el nombre de cada aplicación junto a su barra
  correspondiente.
- El sistema SHALL mostrar la duración exacta de una barra cuando el usuario pasa el cursor
  sobre ella.
- El sistema SHALL NOT cambiar lo que muestran las listas ubicadas debajo del gráfico.

## Scenarios

### Scenario: El gráfico no muestra una regla de horas al pie

**GIVEN** el historial abierto con el gráfico de tiempo por aplicación visible
**WHEN** el usuario mira debajo de las barras
**THEN** no ve ninguna escala de números indicando duración

### Scenario: El valor exacto sigue disponible al pasar el mouse

**GIVEN** el gráfico de tiempo por aplicación visible
**WHEN** el usuario pasa el cursor sobre una barra
**THEN** aparece el tiempo exacto de esa aplicación

### Scenario: Las listas de abajo no cambian

**GIVEN** el gráfico sin la escala de duración
**WHEN** el usuario mira las listas "Por app" y "Por sesión" debajo del gráfico
**THEN** siguen mostrando sus tiempos exactos como antes

## Acceptance Criteria

Implementación completa (commit `94b86b9`, `UsageChart.vue`): `scales.x` pasa a `{ display:
false }`. Revisión de diff confirma que `tooltip.callbacks.label` y `scales.y` no se tocaron.
Verificación visual (Franja B) completada por `sdd-verify` (iteración 2, historial real
sobre "2 ago 2026"): el gráfico "Por app" muestra las barras de League of Legends, Google
Chrome, Brave, Firefox y Access sin ninguna regla de números debajo. Se posicionó el cursor
sobre la barra de League of Legends (sin hacer click, solo moviendo el puntero) y apareció el
tooltip nativo de Chart.js con `League of Legends` / `00:04:34` — el valor exacto coincide
con el que muestra la lista "Por app" de abajo para la misma app. Esa misma lista y la de
"Por sesión" siguen mostrando columnas `Tiempo`/`App` con valores exactos sin cambios.

- [x] Al abrir el historial, debajo de las barras del gráfico no aparece ninguna escala de
  números de duración. (visual, "2 ago 2026", 5 apps)
- [x] Pasar el cursor sobre una barra sigue mostrando su tiempo exacto. (tooltip `League of
  Legends 00:04:34` al posicionar el cursor, sin click)
- [x] Las listas "Por app" y "Por sesión" siguen mostrando sus columnas de tiempo sin
  cambios. (visual, mismos valores exactos que el tooltip)

## Related

- [[usage-aggregation-by-visible-app-name]] — comparte el mismo gráfico; esta spec solo
  cambia la escala visible, no el agregado que representa
