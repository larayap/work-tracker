---
type: capability-spec
title: "Preferencia configurable de formato de hora, 12 horas o 24 horas"
capability: "app-settings"
slug: "configurable-time-format-preference"
domain: "feature"
delta_type: added
supersedes: null
superseded_by: null
status: review
assigned_agent: "sdd-apply"
priority: medium
depends_on: ["[[session-time-without-seconds]]"]
change_ref: "[[work-groups-history-time-format]]"
worktree: "/home/larayap/cronometro-app/.sdd/worktrees/work-groups-history-time-format"
feature_branch: "feature/work-groups-history-time-format"
commits: ["4c673f98fea3808f2938574530619052bdf1f59d"]
mr: ""
acceptance_criteria:
  - "El panel de configuración ofrece elegir entre formato de 12 horas y 24 horas"
  - "Elegir 12 horas hace que los horarios de reloj mostrados incluyan AM/PM"
  - "Elegir 24 horas hace que los horarios de reloj mostrados no incluyan AM/PM"
  - "La preferencia elegida se mantiene después de cerrar y volver a abrir la aplicación"
related: ["[[session-time-without-seconds]]", "[[session-view]]"]
affects: []
adrs: ["[[0006-userdata-json-persistence]]"]
scope: ["src/main/ipc-handlers.js", "src/stores/settings.js", "src/components/OpcionesPanel.vue", "src/utils/time-format.js", "src/history/BySessionView.vue"]
verified_at: null
created: "2026-08-05"
updated: "2026-08-05"
tags: [capability-spec]
---

# Preferencia configurable de formato de hora, 12 horas o 24 horas

## Purpose

La aplicación no ofrece hoy ninguna forma de elegir cómo se muestran las horas de reloj:
siempre aparecen en un único formato fijo. Esta spec agrega una preferencia en el panel de
configuración para elegir entre el formato de 12 horas (con indicador AM/PM) o el de 24
horas, y hace que esa preferencia se aplique dondequiera que la aplicación muestre un
horario de reloj.

## Requirements

- El sistema SHALL ofrecer, en el panel de configuración, una opción para elegir entre
  formato de hora de 12 horas o de 24 horas.
- El sistema SHALL recordar la preferencia elegida entre reinicios de la aplicación.
- El sistema SHALL aplicar la preferencia elegida a todo horario de reloj que la aplicación
  muestre.
- El sistema SHALL mostrar el indicador AM/PM junto a la hora cuando la preferencia elegida
  es de 12 horas.
- El sistema SHALL NOT mostrar ningún indicador AM/PM cuando la preferencia elegida es de 24
  horas.
- El sistema SHALL dejar establecido un formato por defecto para un usuario que nunca
  cambió la preferencia.

## Scenarios

### Scenario: Elegir formato de 12 horas

**GIVEN** el panel de configuración abierto
**WHEN** el usuario elige el formato de 12 horas
**THEN** todo horario de reloj que la aplicación muestre a partir de ese momento incluye el
indicador AM/PM

### Scenario: Elegir formato de 24 horas

**GIVEN** el panel de configuración abierto
**WHEN** el usuario elige el formato de 24 horas
**THEN** todo horario de reloj que la aplicación muestre a partir de ese momento se ve sin
indicador AM/PM

### Scenario: La preferencia se mantiene entre reinicios

**GIVEN** una preferencia de formato de hora ya elegida
**WHEN** el usuario cierra y vuelve a abrir la aplicación
**THEN** los horarios de reloj se siguen mostrando en el formato elegido

### Scenario: Un usuario que nunca eligió tiene un formato por defecto

**GIVEN** una instalación de la aplicación en la que nunca se cambió la preferencia
**WHEN** se muestra un horario de reloj
**THEN** aparece en el formato establecido por defecto

## Acceptance Criteria

Implementación completa (commit `4c673f9`: `ipc-handlers.js`, `settings.js`,
`OpcionesPanel.vue`, `HistoryView.vue`), incluidos los tres defectos latentes que el diseño
detectó (merge de defaults en `get-settings`, `persist()` único para no perder la preferencia
al mover el volumen, historial sin montar Pinia — ADR-0012). Los cinco criterios describen
comportamiento end-to-end (panel → store → IPC → historial) que requiere la app corriendo;
ninguno se ejecutó en esta fase (Franja B), quedan sin marcar para `sdd-verify`.

- [ ] El panel de configuración ofrece elegir entre formato de 12 horas y 24 horas.
- [ ] Elegir 12 horas hace que los horarios de reloj mostrados incluyan AM/PM.
- [ ] Elegir 24 horas hace que los horarios de reloj mostrados no incluyan AM/PM.
- [ ] La preferencia elegida se mantiene después de cerrar y volver a abrir la aplicación.
- [ ] Sin ninguna preferencia elegida todavía, los horarios de reloj se muestran en el
  formato por defecto.

## Observations

Hoy el único lugar donde se muestra un horario de reloj (no una duración) es el rango
horario de inicio/cierre de la vista por sesión ([[session-time-without-seconds]]): esta
preferencia tiene, por ahora, un solo consumidor real. No se centraliza nada más por YAGNI;
si en el futuro se agregan más vistas de hora de reloj, deberían pasar por el mismo punto de
formateo para que la preferencia se aplique de forma consistente.

## Related

- [[session-time-without-seconds]] — introduce el punto de formateo de hora sobre el que
  esta preferencia aplica su parámetro de formato
- [[session-view]] — la vista donde hoy se observa el efecto de esta preferencia
