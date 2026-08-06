---
type: capability-spec
title: "Gráfico y lista de uso por aplicación, agrupados por nombre visible normalizado"
capability: "history-window"
slug: "usage-aggregation-by-visible-app-name"
domain: "feature"
delta_type: MODIFY
supersedes: "[[usage-chart-by-interval]]"
superseded_by: null
status: review
assigned_agent: "sdd-apply"
priority: high
depends_on: ["[[sessions-json-persistence]]"]
change_ref: "[[work-groups-history-time-format]]"
worktree: "/home/larayap/cronometro-app/.sdd/worktrees/work-groups-history-time-format"
feature_branch: "feature/work-groups-history-time-format"
commits: ["da81de6bf377facd26ec61dc0ed63b39dc432cbc"]
mr: ""
acceptance_criteria:
  - "El gráfico muestra por defecto el tiempo por aplicación del día seleccionado, coincidiendo con la lista Por app"
  - "El usuario puede cambiar el alcance del gráfico a mes o a un rango de fechas propio"
  - "Dos entradas de la misma aplicación con distinto origen de registro aparecen unidas en una sola barra y una sola fila"
  - "Dos aplicaciones con nombres visibles distintos nunca aparecen fusionadas"
  - "Ninguna aplicación con uso registrado en el intervalo queda fuera del gráfico ni de la lista Por app"
related: ["[[session-view]]", "[[hide-usage-chart-duration-scale]]", "[[bright-chart-bars-on-dark-background]]", "[[judgment-fixes-sessions-groups-history-revised]]"]
affects: []
adrs: ["[[0007-structured-sessions-json-with-one-shot-migration]]", "[[0010-charting-library-confined-to-history-bundle]]"]
scope: ["src/utils/session-aggregate.js", "src/history/UsageChart.vue", "src/history/ByAppView.vue"]
verified_at: null
created: "2026-08-05"
updated: "2026-08-05"
tags: [capability-spec]
---

# Gráfico y lista de uso por aplicación, agrupados por nombre visible normalizado

## Purpose

El historial agrega el tiempo de uso por aplicación en el gráfico y en la lista "Por app",
con alcance de día, mes o rango de fechas. Esta spec mantiene ese comportamiento y corrige el
criterio con el que se decide qué entradas pertenecen a la misma aplicación: pasa a ser el
nombre visible del programa, normalizado, en vez de un identificador interno que no está
presente en todas las entradas del historial. Antes de esta corrección, dos entradas de la
misma aplicación con historial de distinto origen —por ejemplo, una migrada desde el registro
anterior y otra registrada con el formato nuevo— podían aparecer como dos barras y dos filas
separadas con el mismo nombre. Esta spec las une en una sola, sin fusionar nunca dos
aplicaciones que el usuario ve con nombres distintos.

## Requirements

- El sistema SHALL mostrar un gráfico del tiempo acumulado por aplicación, agregado sobre un
  intervalo de fechas seleccionable.
- El sistema SHALL permitir al usuario elegir el alcance del gráfico entre el día
  seleccionado en el calendario, el mes completo que lo contiene, o un rango de fechas propio.
- El sistema SHALL dejar el alcance del gráfico en el día seleccionado por defecto,
  coincidiendo con lo que ya muestran las listas debajo de él.
- El sistema SHALL rotular el gráfico con el intervalo vigente en todo momento.
- El sistema SHALL considerar que dos entradas del historial pertenecen a la misma
  aplicación cuando comparten el mismo nombre visible, sin importar si alguna de ellas
  carece de un identificador interno de programa.
- El sistema SHALL mostrar, tanto en el gráfico como en la lista "Por app", una única barra
  o fila por cada nombre visible de aplicación distinto dentro del intervalo consultado.
- El sistema SHALL NOT fusionar en una misma barra o fila dos aplicaciones cuyo nombre
  visible sea distinto, aunque ambas carezcan de identificador interno de programa.
- El sistema SHALL calcular el total de una aplicación fusionada como la suma de las
  duraciones de todas las entradas que comparten su nombre visible dentro del intervalo.
- El sistema SHALL incluir en el gráfico y en la lista "Por app" toda aplicación con uso
  registrado en el intervalo, sin omitir ninguna por pequeña que sea su participación.
- El sistema SHALL NOT cambiar lo que muestran las dos listas ancladas al día seleccionado
  cuando cambia el alcance del gráfico.
- El sistema SHALL permitir recorrer mediante desplazamiento un intervalo con más
  aplicaciones de las que caben en pantalla, sin ocultar ni comprimir ninguna.

## Scenarios

### Scenario: El gráfico por defecto muestra el día

**GIVEN** el historial recién abierto en un día con uso registrado
**WHEN** el usuario lo mira
**THEN** el gráfico muestra el tiempo por aplicación de ese día, coincidiendo con los
totales de la lista "Por app"

### Scenario: Dos entradas de la misma aplicación con distinto origen se muestran juntas

**GIVEN** dos entradas del historial con el mismo nombre visible de aplicación, una
proveniente del historial migrado y otra registrada de forma reciente, dentro del mismo
intervalo
**WHEN** el usuario mira el gráfico o la lista "Por app"
**THEN** ve una única barra y una única fila para esa aplicación, con la suma de ambos
tiempos

### Scenario: Dos aplicaciones con nombres distintos no se fusionan

**GIVEN** dos entradas del historial con nombres visibles distintos, aunque el usuario las
reconozca informalmente como el mismo programa
**WHEN** el usuario mira el gráfico o la lista "Por app"
**THEN** cada una aparece en su propia barra y su propia fila, sin fusionarse

### Scenario: Cambiar el alcance a mes

**GIVEN** el historial abierto en un día de un mes con varias sesiones
**WHEN** el usuario elige el alcance de mes
**THEN** el gráfico muestra el tiempo acumulado por aplicación de todo ese mes, con el mes
rotulado en la cabecera

### Scenario: Elegir un rango de fechas arbitrario

**GIVEN** el historial abierto
**WHEN** el usuario elige un rango de fechas propio
**THEN** el gráfico muestra el tiempo acumulado por aplicación dentro de ese rango, rotulado
con las fechas elegidas

### Scenario: Las listas ancladas al día no cambian con el alcance del gráfico

**GIVEN** el gráfico mostrando el alcance de mes
**WHEN** el usuario mira las dos listas debajo
**THEN** siguen mostrando el día seleccionado en el calendario, sin cambiar

### Scenario: Un intervalo con muchas aplicaciones se puede recorrer

**GIVEN** un intervalo con más aplicaciones de las que caben en pantalla
**WHEN** el usuario mira el gráfico
**THEN** puede desplazarse para ver todas las aplicaciones, sin que ninguna quede oculta o
agrupada bajo una categoría genérica

## Acceptance Criteria

Implementación completa (commit `da81de6`, `session-aggregate.js::aggregateByApp`). Los dos
criterios de agrupación se verificaron con `node -e` contra las 44 entradas reales de
`sessions.json` de este entorno: control negativo (clave vieja) → 14 filas con 3 rótulos
repetidos; control positivo (clave nueva) → 11 filas sin duplicados, suma de `durationMs`
preservada exacta, y `Chrome`/`Google Chrome` conviven como filas separadas. `UsageChart.vue`
y `ByAppView.vue` mapean 1:1 sobre las filas de `aggregateByApp` (`row.app`, `row.key`,
`row.durationMs`), así que el render hereda la corrección; el renderizado en sí (barra/fila
visible en pantalla) no se ejecutó en iteración 1 (Franja B); completado en iteración 2:
historial real sobre "2 ago 2026" muestra 5 barras/filas sin duplicados ("League of Legends",
"Google Chrome", "Brave", "Firefox", "Access"), coincidiendo con los datos reales de
`sessions.json`. El resto de los criterios (alcance día/mes/rango, desplazamiento) no forma
parte del `scope` tocado por este cambio y queda sin marcar.

- [ ] El gráfico muestra por defecto el tiempo por aplicación del día seleccionado,
  coincidiendo con la lista "Por app".
- [ ] El usuario puede cambiar el alcance del gráfico a mes o a un rango de fechas propio, y
  la cabecera rotula el intervalo vigente.
- [x] Dos entradas de la misma aplicación con distinto origen de registro aparecen unidas en
  una sola barra y una sola fila, con la suma de sus tiempos. (verificado a nivel de
  agregación: control positivo con datos reales, y caso fabricado `'Chrome '`/`'Chrome'` → 1
  fila `'Chrome'` con `durationMs` sumado)
- [x] Dos aplicaciones con nombres visibles distintos nunca aparecen fusionadas, aunque
  ambas carezcan de identificador interno. (`name:chrome` y `name:google chrome` coexisten
  como filas separadas contra los datos reales)
- [ ] Ninguna aplicación con uso registrado en el intervalo queda fuera del gráfico ni de la
  lista "Por app".
- [ ] Las dos listas ancladas al día seleccionado no cambian cuando cambia el alcance del
  gráfico.
- [ ] Un intervalo con más aplicaciones de las que caben en pantalla se puede recorrer
  completo mediante desplazamiento.

## Related

- [[session-view]] — comparte el mismo historial estructurado, aunque agrega por sesión en
  vez de por aplicación
- [[hide-usage-chart-duration-scale]] — modifica el mismo gráfico, sin relación con el
  criterio de agrupación
- [[bright-chart-bars-on-dark-background]] — modifica el mismo gráfico, sin relación con el
  criterio de agrupación
- [[judgment-fixes-sessions-groups-history-revised]] — la corrección F1 de esa spec queda
  reemplazada por el criterio de agrupación que esta spec define
