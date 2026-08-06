---
type: capability-spec
title: "Horario de inicio y cierre de una sesión sin segundos"
capability: "history-window"
slug: "session-time-without-seconds"
domain: "feature"
delta_type: added
supersedes: null
superseded_by: null
status: review
assigned_agent: "sdd-apply"
priority: low
depends_on: ["[[session-view]]"]
change_ref: "[[work-groups-history-time-format]]"
worktree: "/home/larayap/cronometro-app/.sdd/worktrees/work-groups-history-time-format"
feature_branch: "feature/work-groups-history-time-format"
commits: ["29fa6b326dd8157d68cfa1e267f60faf12d6c066"]
mr: ""
acceptance_criteria:
  - "El horario de inicio y cierre de cada sesión en la vista por sesión se muestra solo con hora y minuto, sin segundos"
  - "La duración y el nombre de la sesión no cambian su forma de mostrarse"
related: ["[[session-view]]", "[[configurable-time-format-preference]]"]
affects: ["[[configurable-time-format-preference]]"]
adrs: []
scope: ["src/utils/time-format.js", "src/history/BySessionView.vue"]
verified_at: null
created: "2026-08-05"
updated: "2026-08-05"
tags: [capability-spec]
---

# Horario de inicio y cierre de una sesión sin segundos

## Purpose

La vista por sesión del historial muestra el horario de inicio y cierre de cada sesión con
precisión de segundos, un nivel de detalle que no aporta nada útil para reconocer cuándo
ocurrió una sesión. Esta spec reduce esa precisión a hora y minuto, dejando el horario más
fácil de leer de un vistazo.

## Requirements

- El sistema SHALL mostrar el horario de inicio y el horario de cierre de una sesión con
  precisión de hora y minuto, sin mostrar segundos.
- El sistema SHALL NOT cambiar ningún otro dato mostrado junto al horario, como el nombre de
  la sesión o su duración.

## Scenarios

### Scenario: El horario de una sesión se muestra sin segundos

**GIVEN** una sesión cerrada, listada en la vista por sesión
**WHEN** el usuario mira su horario de inicio y cierre
**THEN** ve la hora y el minuto de cada uno, sin segundos

### Scenario: La duración de la sesión no cambia

**GIVEN** una sesión listada con su horario sin segundos
**WHEN** el usuario mira su duración
**THEN** sigue mostrándose exactamente igual que antes

## Acceptance Criteria

Implementación completa (commit `29fa6b3`, `time-format.js` + `BySessionView.vue`).

- [x] El horario de inicio y cierre de cada sesión en la vista por sesión se muestra solo
  con hora y minuto, sin segundos. (`formatTimeHHMM` verificado con `node -e` contra los 8
  casos de la tabla de diseño, incluida la rama 24h por defecto; `BySessionView.vue::formatRange`
  actualizado para usarla en las dos llamadas — revisión de diff. El renderizado real en la
  ventana de historial, Franja B, no se ejecutó)
- [x] La duración y el nombre de la sesión no cambian su forma de mostrarse. (revisión de
  diff: `formatDuration`/`msToHHMMSS` y el rótulo `entry.sessionName || entry.app` no fueron
  tocados por este cambio)

## Related

- [[session-view]] — la vista donde se muestra el horario que esta spec ajusta
- [[configurable-time-format-preference]] — la preferencia de 12/24 horas se aplica sobre
  el mismo punto de formateo que introduce esta spec
