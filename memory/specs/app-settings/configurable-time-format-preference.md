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
comportamiento end-to-end (panel → store → IPC → historial), verificado end-to-end por
`sdd-verify` (iteración 2, app real en Windows, sesiones reales del 2026-08-02):

1. `settings.json` inicial (antes de tocar nada) carecía por completo de la clave
   `timeFormat` — la app igual mostró "24 horas" en el panel, confirmando el merge de
   defaults (defecto latente 1).
2. Se cambió el selector a "12 horas"; `settings.json` pasó a `"timeFormat": "12h"` de
   inmediato. Se abrió el historial en "2 ago 2026" → "Por sesión": los rangos horarios se
   vieron como `11:37 AM–11:38 AM` (con AM/PM, sin segundos).
3. Con la preferencia en 12h, se movió el slider "Volumen general" (`masterVolume` pasó a
   `0.52` en el archivo real) y se releyó `settings.json`: `"timeFormat": "12h"` seguía
   presente, sin ser pisado por el guardado del volumen (defecto latente 2, `persist()`
   unificado).
4. Se volvió a "24 horas" en el panel; se cerró y reabrió la ventana de historial (nueva
   instancia, sin recargar toda la app) sobre el mismo día: los mismos rangos se vieron sin
   AM/PM (`11:37–11:38`).
5. Prueba más fuerte que "cerrar y reabrir la ventana": se puso la preferencia en 12h de
   nuevo, se mataron **todos** los procesos `electron`/`node` (cierre real del proceso, no
   solo ocultar a la bandeja) y se relanzó `npm run electron:serve` desde cero. Al abrir
   Opciones en la instancia nueva, el selector mostró "12 horas" y el volumen general seguía
   en ~0.52 — la preferencia sobrevivió un reinicio real del proceso, leída de
   `settings.json` en disco, no de un estado en memoria.

Al cerrar la verificación se restauró `settings.json` a su contenido original
(`{"masterVolume": 1, "interactionVolume": 1}`, sin `timeFormat`) para no dejar alterada la
configuración real del usuario.

- [x] El panel de configuración ofrece elegir entre formato de 12 horas y 24 horas. (`<select>`
  con ambas opciones, confirmado visualmente)
- [x] Elegir 12 horas hace que los horarios de reloj mostrados incluyan AM/PM. (`11:37 AM–11:38
  AM` en la vista Por sesión tras el cambio)
- [x] Elegir 24 horas hace que los horarios de reloj mostrados no incluyan AM/PM. (`11:37–11:38`
  en la misma vista tras volver a 24h)
- [x] La preferencia elegida se mantiene después de cerrar y volver a abrir la aplicación.
  (confirmado con un reinicio real del proceso Electron, no solo de la ventana — ver punto 5)
- [x] Sin ninguna preferencia elegida todavía, los horarios de reloj se muestran en el formato
  por defecto. (`settings.json` sin la clave `timeFormat` → panel mostró "24 horas", punto 1)

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
