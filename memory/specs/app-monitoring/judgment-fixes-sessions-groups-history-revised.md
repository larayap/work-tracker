---
type: capability-spec
title: "Cierre definitivo de sesiones al salir, escritura atómica del historial y nombre principal en el listado de instaladas"
capability: "app-monitoring"
slug: "judgment-fixes-sessions-groups-history-revised"
domain: "feature"
delta_type: MODIFY
supersedes: "[[judgment-fixes-sessions-groups-history]]"
superseded_by: null
status: review
assigned_agent: "sdd-apply"
priority: critical
depends_on: ["[[sessions-json-persistence]]", "[[installed-apps-data-integrity]]"]
change_ref: "[[work-groups-history-time-format]]"
worktree: "/home/larayap/cronometro-app/.sdd/worktrees/work-groups-history-time-format"
feature_branch: "feature/work-groups-history-time-format"
commits: []
mr: ""
acceptance_criteria:
  - "Salir de la aplicación cierra las sesiones abiertas de forma definitiva: no reaparece ninguna fila ni se registra una segunda entrada para la misma sesión"
  - "Una interrupción del proceso durante la escritura del historial no deja el historial completo ilegible"
  - "Un programa con varios accesos directos apuntando al mismo ejecutable se muestra en el listado de instaladas con su nombre principal"
related: ["[[sessions-json-persistence]]", "[[usage-aggregation-by-visible-app-name]]", "[[session-view]]", "[[installed-apps-data-integrity]]"]
affects: []
adrs: ["[[0007-structured-sessions-json-with-one-shot-migration]]", "[[0009-typed-selection-with-atomic-manual-removal]]"]
scope: ["src/main/monitor-engine.js", "src/main/session-log.js", "src/main/installed-apps-filter.js"]
verified_at: null
created: "2026-08-05"
updated: "2026-08-05"
tags: [capability-spec, judgment-fix]
---

# Cierre definitivo de sesiones al salir, escritura atómica del historial y nombre principal en el listado de instaladas

## Purpose

Esta spec reemplaza a [[judgment-fixes-sessions-groups-history]], que documentaba cuatro
correcciones surgidas de una revisión adversarial anterior. Tres de ellas —el cierre
definitivo de sesiones al salir de la aplicación, la escritura del historial a prueba de
interrupciones, y el nombre principal mostrado en el listado de aplicaciones instaladas—
siguen vigentes sin ningún cambio y se restablecen aquí tal como estaban. La cuarta —cómo se
agrupan, en el historial migrado, las entradas para que no aparezcan fusionadas por
programa— queda redefinida por un criterio más preciso: la agrupación por nombre visible
normalizado, documentada ahora en [[usage-aggregation-by-visible-app-name]], reemplaza a la
agrupación por identificador degradado que esta spec fijaba originalmente.

## Requirements

- El sistema SHALL dejar el cierre de sesiones al salir de la aplicación en estado
  definitivo: después de ese cierre ninguna fila vuelve a existir ni se registra una segunda
  entrada de historial para una sesión ya cerrada.
- El sistema SHALL preservar el historial ya registrado ante una interrupción del proceso
  durante la escritura: el archivo de historial queda legible con su contenido previo o con
  el contenido nuevo completo, nunca a medio escribir.
- El sistema SHALL mostrar, cuando varios accesos directos apuntan al mismo ejecutable, el
  nombre principal del programa y no el de una variante secundaria de ese acceso directo.

## Scenarios

### Scenario: Salir de la aplicación cierra las sesiones de forma definitiva

**GIVEN** una o más filas abiertas con sus programas todavía en ejecución
**WHEN** el usuario sale de la aplicación
**THEN** cada fila abierta queda registrada en el historial exactamente una vez, y ninguna
fila vuelve a aparecer ni genera una segunda entrada mientras la aplicación termina de
cerrarse

### Scenario: Una interrupción durante la escritura no destruye el historial

**GIVEN** un historial con entradas ya registradas
**WHEN** el proceso se interrumpe mientras la aplicación está escribiendo el historial
**THEN** al volver a abrir la aplicación el historial sigue siendo legible, conservando al
menos las entradas anteriores a esa escritura

### Scenario: Un programa con accesos directos secundarios se muestra con su nombre principal

**GIVEN** un programa instalado que generó varios accesos directos al mismo ejecutable, uno
con su nombre principal y otros con nombres de variantes o herramientas auxiliares
**WHEN** el usuario abre el selector de aplicaciones instaladas
**THEN** el programa aparece una única vez, identificado con su nombre principal

## Acceptance Criteria

Esta spec no introduce código en `work-groups-history-time-format` (ver `## Purpose`): los
tres requisitos vigentes ya fueron implementados y verificados en el cambio
`sessions-groups-history` (mergeado a `main`; commits `ad7ca33`, `cfedccf`, `d5e14de`,
detalle en `judgment-fixes-sessions-groups-history` superseded). Lo único que corresponde
acá es la no-regresión: `git diff --stat -- src/main/monitor-engine.js src/main/session-log.js
src/main/installed-apps-filter.js` contra este cambio devuelve vacío — ninguno de los tres
archivos protegidos fue tocado por `usage-aggregation-by-visible-app-name` ni por ninguna
otra tarea de este cambio.

- [x] Salir de la aplicación cierra las sesiones abiertas de forma definitiva: no reaparece
  ninguna fila ni se registra una segunda entrada para la misma sesión. (implementado y
  verificado en `sessions-groups-history`, commit `ad7ca33`; sin regresión — `monitor-engine.js`
  no aparece en el diff de este cambio)
- [x] Una interrupción del proceso durante la escritura del historial no deja el historial
  completo ilegible. (implementado y verificado en `sessions-groups-history`, commit
  `cfedccf`; sin regresión — `session-log.js` no aparece en el diff de este cambio)
- [x] Un programa con varios accesos directos apuntando al mismo ejecutable se muestra en el
  listado de instaladas con su nombre principal. (implementado y verificado en
  `sessions-groups-history`, commit `d5e14de`; sin regresión — `installed-apps-filter.js` no
  aparece en el diff de este cambio)

## Observations

El requerimiento original de esta spec sobre el historial migrado (F1: "el sistema SHALL
presentar el tiempo por aplicación separando cada programa distinto, incluso cuando las
entradas provienen del historial migrado") queda retirado de aquí, no eliminado: su
comportamiento correcto está definido ahora por
[[usage-aggregation-by-visible-app-name]], con un criterio de agrupación por nombre visible
que reemplaza al de identificador degradado que esta spec fijaba. El detalle histórico de
las cuatro correcciones originales (F1-F4), con su evidencia de verificación, queda en
`{MEMORY_ROOT}/changes/sessions-groups-history/judgment-report.md` (iteración 1) y en el
cuerpo de [[judgment-fixes-sessions-groups-history]], ahora superseded.

## Related

- [[sessions-json-persistence]] — la persistencia del historial que estas correcciones
  endurecen
- [[usage-aggregation-by-visible-app-name]] — define ahora el criterio de agrupación por
  aplicación que esta spec fijaba originalmente como F1
- [[session-view]] — la vista por sesión no está afectada por ninguna de las correcciones
  vigentes en esta spec
- [[installed-apps-data-integrity]] — el listado cuyo nombre principal esta spec preserva
