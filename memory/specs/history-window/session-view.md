---
type: capability-spec
title: "Vista del historial por sesión, con sus grupos como bloques"
capability: "history-window"
slug: "session-view"
domain: "feature"
delta_type: added
supersedes: null
superseded_by: null
status: review
assigned_agent: "sdd-apply"
priority: medium
depends_on: ["[[sessions-json-persistence]]", "[[inline-session-naming]]", "[[group-composition-and-drag]]"]
change_ref: "[[sessions-groups-history]]"
worktree: "/home/larayap/cronometro-app/.sdd/worktrees/sessions-groups-history"
feature_branch: "feature/sessions-groups-history"
commits: ["0e248504ab1eefc6af7b4c21ce6aa34853b2ac14"]
mr: ""
acceptance_criteria:
  - "La vista por sesión lista, en orden cronológico, las sesiones del día seleccionado"
  - "Cada entrada muestra su nombre si lo tiene, su rango horario y su duración"
  - "Una sesión agrupada se muestra como un bloque con el grupo y sus filas hijas"
  - "Cambiar el día en el calendario actualiza la vista por sesión al nuevo día"
related: ["[[usage-chart-by-interval]]", "[[dark-loading-state]]"]
affects: []
adrs: []
scope: ["src/history/HistoryView.vue", "src/main/session-log.js"]
verified_at: null
created: "2026-08-02"
updated: "2026-08-02"
tags: [capability-spec]
---

# Vista del historial por sesión, con sus grupos como bloques

## Purpose

La vista actual del historial responde "cuánto usé cada programa" agrupando por programa.
Esta spec agrega una segunda mirada sobre el mismo día: una lista cronológica de las
sesiones tal como ocurrieron, con su nombre si el usuario le puso uno, su rango horario y su
duración, mostrando las sesiones agrupadas como un único bloque con sus filas hijas debajo.

## Requirements

- El sistema SHALL ofrecer una vista del historial organizada por sesión, seleccionable
  junto a la vista existente por aplicación, ambas ancladas al mismo día seleccionado en el
  calendario.
- El sistema SHALL listar, en la vista por sesión, una entrada por cada sesión cerrada en
  el día seleccionado, en el orden cronológico en que ocurrieron.
- El sistema SHALL mostrar, para cada entrada de sesión, su nombre si tiene uno, su
  instante de inicio, su instante de cierre y su duración.
- El sistema SHALL mostrar una sesión sin nombre con una etiqueta neutra que identifique el
  programa en su lugar.
- El sistema SHALL mostrar una sesión agrupada como un único bloque que contiene sus
  entradas miembro, en vez de intercalar esas entradas sueltas junto al resto de las
  sesiones.
- El sistema SHALL mostrar, en el bloque de una sesión agrupada, el nombre del grupo y su
  duración total derivada, junto a cada una de sus entradas miembro.
- El sistema SHALL actualizar la vista por sesión para reflejar el día seleccionado en el
  calendario, de la misma forma en que ya lo hace la vista por aplicación.

## Scenarios

### Scenario: La vista por sesión lista las sesiones del día en orden

**GIVEN** un día con varias sesiones registradas
**WHEN** el usuario abre la vista por sesión
**THEN** ve una entrada por sesión, en el orden en que ocurrieron, con su rango horario y
duración

### Scenario: Una sesión con nombre muestra su nombre

**GIVEN** una sesión que el usuario nombró
**WHEN** aparece en la vista por sesión
**THEN** se muestra con el nombre que tenía al cerrarse

### Scenario: Un grupo se muestra como bloque

**GIVEN** una sesión agrupada con varios programas
**WHEN** aparece en la vista por sesión
**THEN** se muestra como un bloque único con el nombre del grupo, su total, y las entradas
de cada programa debajo

### Scenario: Cambiar de día actualiza la vista por sesión

**GIVEN** la vista por sesión abierta en un día
**WHEN** el usuario selecciona otro día en el calendario
**THEN** la vista muestra las sesiones de ese nuevo día

## Acceptance Criteria

Implementación completa (commit 0e24850). Marcados por lectura directa del código —
`BySessionView.vue` es un componente de presentación pura sin estado propio que oculte un
defecto, y `buildDayTimeline` (su fuente de orden/colapso) está verificada exhaustivamente
con `node -e` desde la Tarea 11. La observación visual con la ventana real requiere Windows —
ver `observations.md`.

- [x] La vista por sesión lista, en orden cronológico, todas las sesiones cerradas en el
  día seleccionado. (`buildDayTimeline` ordena por el `startedAt` mínimo de cada bloque)
- [x] Cada entrada muestra su nombre (o una etiqueta neutra si no tiene), su rango horario
  y su duración. (`entry.sessionName || entry.app`, `formatRange`, `formatDuration` en el
  template)
- [x] Una sesión agrupada se muestra como un bloque único con el nombre del grupo, su total
  derivado, y sus entradas miembro. (rama `v-else` del bloque, `block.groupName`,
  `block.durationMs`, `block.members`)
- [x] Cambiar el día seleccionado en el calendario actualiza la vista por sesión al nuevo
  día. (`watch: selectedDate` dispara `loadDayEntries()`, cuyo resultado llega a
  `BySessionView` por prop)

## Related

- [[sessions-json-persistence]] — fuente de datos de esta vista
- [[inline-session-naming]] — provee el nombre que esta vista muestra por sesión
- [[group-composition-and-drag]] — provee la agrupación que esta vista muestra como bloque
- [[usage-chart-by-interval]] — comparte el mismo historial estructurado, aunque agrega por
  aplicación en vez de por sesión
- [[dark-loading-state]] — gobierna la apariencia de la ventana que contiene esta vista
