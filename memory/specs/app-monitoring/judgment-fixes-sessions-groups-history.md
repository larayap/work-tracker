---
type: capability-spec
title: "Correcciones de judgment (sessions-groups-history): historial migrado por programa, cierre final al salir, escritura atómica del historial, nombre canónico en el listado"
capability: "app-monitoring"
slug: "judgment-fixes-sessions-groups-history"
domain: "feature"
delta_type: added
supersedes: null
superseded_by: "[[judgment-fixes-sessions-groups-history-revised]]"
status: completed
assigned_agent: "sdd-apply"
priority: critical
depends_on: ["[[sessions-json-persistence]]", "[[usage-chart-by-interval]]", "[[installed-apps-data-integrity]]"]
change_ref: "[[sessions-groups-history]]"
worktree: "/home/larayap/cronometro-app/.sdd/worktrees/sessions-groups-history"
feature_branch: "feature/sessions-groups-history"
commits: ["bb8d3c454bec3fd83f51829e80c6dbabb4a195c9", "ad7ca3390f468e97d8d082ca7cfb7d2c0f9e3a73", "cfedccfa0ae5089447a1dd4850feb5552bd6894c", "d5e14de7c36c7cb5f2701568f1498291372430a1"]
mr: ""
acceptance_criteria:
  - "El historial migrado desde el formato de texto muestra una fila y una barra por cada programa distinto, con su propio tiempo, sin fusionar programas entre sí"
  - "Salir de la aplicación cierra las sesiones abiertas de forma definitiva: no reaparece ninguna fila ni se registra una segunda entrada para la misma sesión"
  - "Una interrupción del proceso durante la escritura del historial no deja el historial completo ilegible"
  - "Un programa con varios accesos directos apuntando al mismo ejecutable se muestra en el listado de instaladas con su nombre principal, no con el de un acceso directo secundario"
related: ["[[sessions-json-persistence]]", "[[usage-chart-by-interval]]", "[[session-view]]", "[[installed-apps-data-integrity]]"]
affects: []
adrs: ["[[0007-structured-sessions-json-with-one-shot-migration]]", "[[0009-typed-selection-with-atomic-manual-removal]]"]
scope: ["src/utils/session-aggregate.js", "src/main/monitor-engine.js", "src/main/session-log.js", "src/main/installed-apps-filter.js"]
verified_at: null
created: "2026-08-02"
updated: "2026-08-05"
tags: [capability-spec, judgment-fix]
---

# Correcciones de judgment (sessions-groups-history)

## Purpose

La revisión adversarial encontró cuatro defectos en el cambio `sessions-groups-history` que
sobrevivieron a `sdd-verify`. El más grave se manifiesta en el camino feliz de todo usuario
que ya venía usando la aplicación: al abrir el historial después de actualizar, los programas
de su historial anterior aparecen fusionados en uno solo. Los otros tres son un cierre de
sesión que no queda firme al salir de la aplicación, un historial que se reescribe entero sin
protección ante una interrupción, y un nombre secundario mostrado en el listado de instaladas
en lugar del nombre principal del programa.

Esta spec describe el comportamiento correcto que debe quedar después de las correcciones.

## Requirements

- El sistema SHALL presentar el tiempo por aplicación —tanto en la lista por aplicación como
  en el gráfico— separando cada programa distinto, incluso cuando las entradas provienen del
  historial migrado y ninguna de ellas registra la ruta del ejecutable.
- El sistema SHALL NOT atribuir a un programa el tiempo registrado por otro programa distinto.
- El sistema SHALL dejar el cierre de sesiones al salir de la aplicación en estado definitivo:
  después de ese cierre ninguna fila vuelve a existir ni se registra una segunda entrada de
  historial para una sesión ya cerrada.
- El sistema SHALL preservar el historial ya registrado ante una interrupción del proceso
  durante la escritura: el archivo de historial queda legible con su contenido previo o con el
  contenido nuevo completo, nunca a medio escribir.
- El sistema SHALL mostrar, cuando varios accesos directos apuntan al mismo ejecutable, el
  nombre principal del programa y no el de una variante secundaria de ese acceso directo.

## Scenarios

### Scenario: El historial migrado muestra cada programa por separado

**GIVEN** un usuario que ya tenía historial en el formato de texto anterior, con dos o más
programas distintos usados el mismo día
**WHEN** actualiza la aplicación y abre el historial en ese día
**THEN** la lista por aplicación y el gráfico muestran una entrada por cada programa, cada una
con el tiempo que le corresponde

### Scenario: El historial migrado no fusiona programas en el gráfico de mes o rango

**GIVEN** el mismo historial migrado
**WHEN** el usuario cambia el alcance del gráfico a un mes o a un rango que abarca varios días
**THEN** el gráfico muestra una barra por cada programa distinto del intervalo, sin sumar el
tiempo de unos bajo el nombre de otro

### Scenario: Salir de la aplicación cierra las sesiones de forma definitiva

**GIVEN** una o más filas abiertas con sus programas todavía en ejecución
**WHEN** el usuario sale de la aplicación
**THEN** cada fila abierta queda registrada en el historial exactamente una vez, y ninguna fila
vuelve a aparecer ni genera una segunda entrada mientras la aplicación termina de cerrarse

### Scenario: Una interrupción durante la escritura no destruye el historial

**GIVEN** un historial con entradas ya registradas
**WHEN** el proceso se interrumpe mientras la aplicación está escribiendo el historial
**THEN** al volver a abrir la aplicación el historial sigue siendo legible, conservando al
menos las entradas anteriores a esa escritura

### Scenario: Un programa con accesos directos secundarios se muestra con su nombre principal

**GIVEN** un programa instalado que generó varios accesos directos al mismo ejecutable, uno con
su nombre principal y otros con nombres de variantes o herramientas auxiliares
**WHEN** el usuario abre el selector de aplicaciones instaladas
**THEN** el programa aparece una única vez, identificado con su nombre principal

## Acceptance Criteria

- [x] El historial migrado muestra una fila y una barra por cada programa distinto, con su
  propio tiempo, sin fusionar programas entre sí. (F1, commit `bb8d3c4`) Verificado con
  `aggregateByApp` real contra las 32 entradas migradas reales del `usage-log.txt` de
  producción de este entorno: control negativo pre-fix reproduce exactamente la pérdida del
  judgment-report (6/9 días fusionan programas); post-fix los 9 días separan cada programa con
  su duración exacta, sin colisión de `key`.
- [x] Salir de la aplicación cierra las sesiones abiertas de forma definitiva: no reaparece
  ninguna fila ni se registra una segunda entrada para la misma sesión. (F2, commit `ad7ca33`)
  Verificado contra `monitor-engine.js` real, con timer real (sin control manual de ticks):
  control negativo reproduce la secuencia completa del judgment-report (tick suspendido en el
  await del foco + `before-quit` + tick posterior con proceso muerto → 2 escrituras); post-fix,
  `stopEngine()` dentro de `closeAllRows` deja el conteo en 1 escritura incluso esperando 1.5s
  reales más allá del próximo intervalo.
- [x] Una interrupción del proceso durante la escritura del historial no deja el historial
  completo ilegible. (F3, commit `cfedccf`) Verificado simulando en disco el estado que deja
  una interrupción real: escritura directa truncada corrompe el archivo destino completo
  (control); la misma interrupción simulada durante la escritura del `.tmp` de
  `writeJsonAtomic` deja el destino intacto byte a byte con el contenido previo.
- [x] Un programa con varios accesos directos apuntando al mismo ejecutable se muestra en el
  listado de instaladas con su nombre principal. (F4, commit `d5e14de`) Verificado con el
  script PowerShell real de `buildInstalledAppsScript` contra la máquina Windows de este
  entorno vía interop (188 accesos directos crudos → 82 mostrados, mismo conteo que el
  judgment-report): pre-fix VLC y MySQL muestran el nombre de un acceso directo secundario;
  post-fix ambos muestran su nombre principal.

## Notas de implementación

Detalle técnico de cada defecto, con la evidencia que lo sustenta, en
`{MEMORY_ROOT}/changes/sessions-groups-history/judgment-report.md` (iteración 1).

- **F1** (`src/utils/session-aggregate.js`, `aggregateByApp`): la clave de agrupación es
  `entry.appId`, que vale `null` en las 32 entradas migradas. Corresponde una clave que
  degrade al nombre del programa cuando no hay `appId`. Ojo con `ByAppView.vue:10`, que usa
  `:key="row.appId"` en el `v-for` — con la clave degradada esa key también deja de ser única
  si se mantiene como está.
- **F2** (`src/main/monitor-engine.js`, `closeAllRows`): el timer sigue vivo y `selection`
  intacta tras el cierre, así que un tick posterior —incluido el que quedó suspendido en el
  `await` de la muestra de foco— recrea la fila desde la selección. Detener el motor como parte
  del cierre al salir cierra el camino entero.
- **F3** (`src/main/session-log.js`): la escritura del historial usa `writeJson`
  (`fs.writeFileSync` directo). El patrón atómico tmp+rename ya existe en el repo, en
  `migrateLegacyLogAt` (ADR-0007). Aplicarlo al historial sin cambiar el comportamiento de
  `writeJson` para los otros consumidores.
- **F4** (`src/main/installed-apps-filter.js`, `filterInstalledApps`): la deduplicación conserva
  la primera aparición según el orden de enumeración del sistema de archivos. Necesita un
  criterio explícito de qué nombre sobrevive a la colisión.

## Related

- [[sessions-json-persistence]] — la persistencia del historial que F2 y F3 endurecen
- [[usage-chart-by-interval]] — el gráfico cuyo Requirement de completitud rompe F1
- [[session-view]] — la vista por sesión NO está afectada por F1 (agrega por entrada, no por `appId`)
- [[installed-apps-data-integrity]] — el listado cuyo Requirement de nombre legible rompe F4

> **Superseded (2026-08-05)** por [[judgment-fixes-sessions-groups-history-revised]]: F2, F3
> y F4 siguen vigentes sin cambios. F1 queda retirado de esta spec — el criterio correcto de
> agrupación por aplicación pasa a estar definido en
> [[usage-aggregation-by-visible-app-name]] (agrupación por nombre visible normalizado, no
> por `appId` degradado).
