---
type: capability-spec
title: "Gráfico de uso por aplicación, con alcance de día, mes o rango"
capability: "history-window"
slug: "usage-chart-by-interval"
domain: "feature"
delta_type: added
supersedes: null
superseded_by: null
status: completed
assigned_agent: "sdd-apply"
priority: medium
depends_on: ["[[sessions-json-persistence]]"]
change_ref: "[[sessions-groups-history]]"
worktree: "/home/larayap/cronometro-app/.sdd/worktrees/sessions-groups-history"
feature_branch: "feature/sessions-groups-history"
commits: ["0e248504ab1eefc6af7b4c21ce6aa34853b2ac14", "ad57224236cf80d5d5e8db1fd0f260950394c567", "bb8d3c454bec3fd83f51829e80c6dbabb4a195c9"]
mr: ""
acceptance_criteria:
  - "El gráfico muestra por defecto el tiempo por aplicación del día seleccionado"
  - "El usuario puede cambiar el alcance del gráfico a mes o a un rango de fechas propio"
  - "La cabecera del gráfico rotula siempre el intervalo vigente"
  - "Las dos listas debajo del gráfico no cambian cuando cambia el alcance del gráfico"
  - "Ninguna aplicación con uso registrado en el intervalo queda fuera del gráfico"
related: ["[[session-view]]"]
affects: []
adrs: []
scope: ["src/history/HistoryView.vue", "src/main/session-log.js", "package.json"]
verified_at: "2026-08-02"
created: "2026-08-02"
updated: "2026-08-02"
tags: [capability-spec]
---

# Gráfico de uso por aplicación, con alcance de día, mes o rango

## Purpose

El historial hoy solo muestra listas de texto. Esta spec agrega un gráfico que responde de
un vistazo "en qué gasté el tiempo" para el intervalo que el usuario elija: el día
seleccionado en el calendario, el mes completo que contiene ese día, o un rango de fechas
arbitrario. Es un único gráfico y un único agregador: el día es apenas el caso más chico del
mismo intervalo, así que el mes y el rango salen del mismo mecanismo sin duplicar nada. Las
dos listas del historial siguen ancladas al día del calendario sin importar el alcance que
el usuario elija para el gráfico.

## Requirements

- El sistema SHALL mostrar un gráfico del tiempo acumulado por aplicación, agregado sobre
  un intervalo de fechas seleccionable.
- El sistema SHALL permitir al usuario elegir el alcance del gráfico entre tres opciones:
  el día seleccionado en el calendario, el mes completo que contiene ese día, o un rango de
  fechas arbitrario elegido por el usuario.
- El sistema SHALL dejar el alcance del gráfico en el día seleccionado por defecto,
  coincidiendo con lo que ya muestran las listas debajo de él.
- El sistema SHALL incluir en el gráfico toda aplicación con uso registrado dentro del
  intervalo elegido, sin omitir ninguna por pequeña que sea su participación.
- El sistema SHALL crecer el área visible del gráfico según la cantidad de aplicaciones del
  intervalo, manteniendo cada barra alcanzable mediante desplazamiento en vez de
  comprimirlas u ocultarlas.
- El sistema SHALL rotular el gráfico con el intervalo vigente en cada momento —por
  ejemplo, el día puntual, el mes puntual, o el rango de fechas elegido—, de modo que el
  usuario siempre pueda identificar a qué período corresponde.
- El sistema SHALL NOT cambiar lo que muestran las dos listas debajo del gráfico cuando
  cambia el alcance del gráfico: esas listas permanecen ancladas al día seleccionado en el
  calendario sin importar el alcance vigente del gráfico.
- El sistema SHALL reflejar en el gráfico los mismos totales que muestra la lista por
  aplicación cuando el alcance del gráfico está fijado en el día.

## Scenarios

### Scenario: El gráfico por defecto muestra el día

**GIVEN** el historial recién abierto en un día con uso registrado
**WHEN** el usuario lo mira
**THEN** el gráfico muestra el tiempo por aplicación de ese día, coincidiendo con los
totales de la lista por aplicación

### Scenario: Cambiar el alcance a mes

**GIVEN** el historial abierto en un día de un mes con varias sesiones
**WHEN** el usuario elige el alcance de mes
**THEN** el gráfico muestra el tiempo acumulado por aplicación de todo ese mes, con el mes
rotulado en la cabecera

### Scenario: Elegir un rango de fechas arbitrario

**GIVEN** el historial abierto
**WHEN** el usuario elige un rango de fechas propio
**THEN** el gráfico muestra el tiempo acumulado por aplicación dentro de ese rango,
rotulado con las fechas elegidas

### Scenario: Las listas no cambian con el alcance del gráfico

**GIVEN** el gráfico mostrando el alcance de mes
**WHEN** el usuario mira las dos listas debajo
**THEN** siguen mostrando el día seleccionado en el calendario, sin cambiar

### Scenario: Un intervalo con muchas aplicaciones se puede recorrer

**GIVEN** un intervalo con más aplicaciones de las que caben en pantalla
**WHEN** el usuario mira el gráfico
**THEN** puede desplazarse para ver todas las aplicaciones, sin que ninguna quede oculta o
agrupada bajo una categoría genérica

## Acceptance Criteria

Implementación completa (commits 0e24850, ad57224, bb8d3c4 — el último corrige F1 de
`judgment-fixes-sessions-groups-history`). Marcados por lectura directa + verificación de la
lógica pura con `node -e`; la observación visual con la app real (renderizado del gráfico,
`v-date-picker`, scroll) requiere Windows — ver `observations.md`.

- [x] El gráfico muestra por defecto el tiempo por aplicación del día seleccionado,
  coincidiendo con la lista por aplicación. (`chartScope: 'day'` por defecto; en ese alcance
  `chartInterval` y el intervalo de `dayEntries` son el mismo `{from, to}`)
- [x] El usuario puede cambiar el alcance del gráfico a mes o a un rango de fechas propio.
  (`scope-tabs` + `<v-date-picker v-model.range>`; `chartInterval` deriva los tres casos
  según D-12, verificado con `node -e` contra los ejemplos exactos de `design.md`)
- [x] La cabecera del gráfico siempre rotula el intervalo vigente. (`chartLabel` cubre los
  tres alcances, verificado)
- [x] Las dos listas debajo del gráfico permanecen ancladas al día del calendario sin
  importar el alcance elegido para el gráfico. (`dayEntries` depende solo de `selectedDate`;
  ningún camino de código lo hace depender de `chartScope`)
- [x] Ninguna aplicación con uso registrado en el intervalo queda fuera del gráfico ni
  agrupada bajo una categoría genérica. **Re-verificado tras corrección** (2026-08-02,
  `[[judgment-fixes-sessions-groups-history]]`#F1): `sdd-judgment` (iteración 1) encontró que
  esta afirmación, aunque correcta sobre "sin lógica de top-N", era insuficiente — la pérdida
  real no venía de un top-N sino de que `aggregateByApp` agrupaba por `entry.appId`, y las 32
  entradas migradas desde `usage-log.txt` llevan `appId: null`, así que colapsaban en una sola
  fila (6 de 9 días reales del `usage-log.txt` de producción de este entorno perdían
  programas). Corregido con una clave de agrupación que degrada al nombre del programa cuando
  no hay `appId`. Re-verificado con `aggregateByApp` real contra las 32 entradas migradas
  reales: los 9 días muestran sus programas separados, con la suma de duración exacta por
  programa (sin pérdida ni doble conteo), y sin colisión de `key` entre filas degradadas.

  Se falsificó por control negativo previo (el mismo script contra el código sin corregir
  reproduce exactamente la pérdida que el judgment-report documentó) y se confirmó el fix por
  control positivo (el mismo script contra el código corregido).
- [ ] Un intervalo con más aplicaciones de las que caben en pantalla se puede recorrer
  completo mediante desplazamiento.

## Related

- [[sessions-json-persistence]] — fuente de datos que este gráfico agrega por intervalo
- [[session-view]] — comparte el mismo historial estructurado, aunque muestra sesiones
  individuales en vez de totales por aplicación
