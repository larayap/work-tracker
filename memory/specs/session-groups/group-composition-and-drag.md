---
type: capability-spec
title: "Agrupar varias aplicaciones en una sesión con nombre, sin fusionar sus relojes"
capability: "session-groups"
slug: "group-composition-and-drag"
domain: "feature"
delta_type: added
supersedes: null
superseded_by: null
status: completed
assigned_agent: "sdd-apply"
priority: medium
depends_on: ["[[sessions-json-persistence]]", "[[inline-session-naming]]"]
change_ref: "[[sessions-groups-history]]"
worktree: "/home/larayap/cronometro-app/.sdd/worktrees/sessions-groups-history"
feature_branch: "feature/sessions-groups-history"
commits: ["c072b10e78d451fbff943d25873bfba355e45cb0"]
mr: ""
acceptance_criteria:
  - "Arrastrar una fila a la franja de agrupar la incorpora a un grupo nuevo con nombre editable"
  - "Cada fila de un grupo conserva su propio reloj y su propia entrada de historial"
  - "El total de un grupo mostrado en cualquier vista es la suma de las duraciones de sus filas en el período consultado"
  - "Sacar una fila de un grupo la devuelve al listado suelto"
  - "Un grupo sin filas deja de existir como tal"
related: ["[[simultaneous-limit]]", "[[inline-session-naming]]"]
affects: ["[[session-view]]", "[[multiple-simultaneous-groups]]"]
adrs: []
scope: ["src/components/CronometroAplicacion.vue", "src/components/AppRow.vue", "src/stores/monitoredApps.js", "src/main/session-log.js"]
verified_at: "2026-08-02"
created: "2026-08-02"
updated: "2026-08-05"
tags: [capability-spec]
---

# Agrupar varias aplicaciones en una sesión con nombre, sin fusionar sus relojes

## Purpose

El usuario a veces trabaja con más de un programa a la vez como parte de la misma
actividad —un editor y un visor de referencia, por ejemplo—. Esta spec permite agrupar
filas del listado visible arrastrándolas entre sí, sin que eso fusione sus relojes ni sus
registros: cada programa conserva su propio tiempo y su propia entrada en el historial, y
comparte con el resto del grupo únicamente una etiqueta común. Un grupo es una sesión con
nombre que contiene varias filas, viva mientras existan sus filas, no una carpeta reutilizable
entre días.

## Requirements

- El sistema SHALL permitir al usuario arrastrar una fila del listado suelto hacia un
  contenedor de grupo para incorporarla a ese grupo.
- El sistema SHALL permitir al usuario arrastrar una fila fuera de un contenedor de grupo
  para sacarla de ese grupo y devolverla al listado suelto.
- El sistema SHALL mostrar un contenedor de grupo liviano que aparece cuando hay al menos
  dos filas sueltas, invitando al usuario a arrastrar filas hacia él.
- El sistema SHALL convertir el contenedor de grupo en una cabecera con nombre editable en
  cuanto recibe su primera fila.
- El sistema SHALL mantener el reloj de cada fila contando su propio tiempo acumulado,
  sin que la pertenencia a un grupo lo afecte.
- El sistema SHALL mantener independiente la entrada de historial de cada fila de un
  grupo, identificada con la etiqueta del grupo, sin fusionar sus duraciones en una sola
  entrada combinada.
- El sistema SHALL calcular el total de un grupo, en cualquier vista donde se muestre, como
  la suma de las duraciones de sus entradas para el período consultado, sin persistir ese
  total en ningún lado.
- El sistema SHALL mantener viva la identidad de un grupo únicamente mientras tenga al
  menos una fila miembro; un grupo sin ninguna fila deja de existir como tal.
- El sistema SHALL NOT modificar el límite existente de filas simultáneas en el listado
  visible por el hecho de agrupar.
- El sistema SHALL NOT permitir anidar un grupo dentro de otro grupo.
- El sistema SHALL NOT reutilizar la identidad de un grupo entre distintos días, ni después
  de vaciarse por completo: un grupo queda acotado a la sesión que nombra, no es una
  carpeta reutilizable.

## Scenarios

### Scenario: Arrastrar una fila a la franja de agrupar

**GIVEN** dos o más filas sueltas en el listado visible
**WHEN** el usuario arrastra una de ellas sobre la franja de agrupar
**THEN** esa fila pasa a formar parte de un grupo nuevo, y la franja se convierte en una
cabecera con nombre editable

### Scenario: Arrastrar una segunda fila al mismo grupo

**GIVEN** un grupo ya existente con una fila
**WHEN** el usuario arrastra otra fila suelta sobre ese grupo
**THEN** esa fila se suma al grupo, conservando su propio reloj

### Scenario: Sacar una fila del grupo

**GIVEN** un grupo con dos o más filas
**WHEN** el usuario arrastra una de esas filas fuera del contenedor del grupo
**THEN** esa fila vuelve al listado suelto y deja de pertenecer al grupo

### Scenario: El grupo no fusiona los relojes

**GIVEN** dos filas del mismo grupo corriendo en paralelo
**WHEN** el usuario mira cada fila
**THEN** cada una muestra su propio tiempo acumulado, independiente de la otra

### Scenario: El total del grupo es la suma de sus filas

**GIVEN** un grupo con dos programas que corrieron en paralelo con tiempos distintos
**WHEN** se consulta el total del grupo para ese período
**THEN** el total mostrado es la suma de las duraciones de ambos programas

### Scenario: Un grupo sin filas deja de existir

**GIVEN** un grupo cuya última fila fue sacada o cerrada
**WHEN** eso ocurre
**THEN** el grupo deja de mostrarse como tal

## Acceptance Criteria

Implementación completa dentro del `scope` de esta spec (commit c072b10). El drag & drop en
sí requiere mouse real sobre un DOM renderizado y no es verificable en este entorno — ver
`observations.md`.

- [ ] Arrastrar una fila a la franja de agrupar la incorpora a un grupo nuevo con cabecera
  de nombre editable.
- [x] Cada fila de un grupo conserva su propio reloj, sin verse afectado por la pertenencia
  al grupo. (`setRowGroup` solo toca `groupId`/`groupName`; ningún camino de agrupación toca
  `elapsedMs`, `pid` ni `state`)
- [x] Cada fila de un grupo conserva su propia entrada de historial, identificada con la
  etiqueta del grupo, sin fusionarse con las demás. (`appendSessions` construye una entrada
  independiente por fila, cada una con su propio `groupId`/`groupName`; no existe ningún paso
  de agregación al escribir)
- [x] El total de un grupo mostrado en cualquier vista es la suma de las duraciones de sus
  filas en el período consultado. (`BySessionView.vue`, etapa 6a, muestra `block.durationMs`
  de `buildDayTimeline` — la suma de sus miembros, nunca reloj de pared — verificado
  exhaustivamente desde la Tarea 11)
- [x] Sacar una fila de un grupo la devuelve al listado suelto. (verificado en `sdd-verify`
  a nivel de motor: `monitorEngine.setRowGroup(appId, null)` sobre una fila de un grupo de 2
  limpia su `groupId`/`groupName` sin afectar a la fila hermana, que conserva ambos. El gesto
  de arrastre en sí —`vuedraggable` traduciendo el `@change` a esta misma llamada— requiere
  mouse real y queda sin marcar)
- [x] Un grupo sin ninguna fila miembro deja de mostrarse como grupo. (estructural: la
  existencia del grupo se deriva de `dragGrouped.length > 0`, no hay entidad persistida que
  limpiar — ADR-0008)
- [x] El límite de filas simultáneas en el listado visible no cambia por agrupar. (el límite
  de 4 vive en `reduceLifecycle`/`addToSelection`, sin tocar en este cambio; agrupar no crea
  ni destruye filas, solo les asigna `groupId`)

## Related

- [[inline-session-naming]] — provee el mecanismo de nombre inline usado en la cabecera del
  grupo
- [[sessions-json-persistence]] — persiste la identificación del grupo en cada entrada del
  historial de sus filas miembro
- [[simultaneous-limit]] — el límite de filas simultáneas sigue vigente sin cambios para
  las filas agrupadas
- [[session-view]] — muestra los grupos como bloque en la vista por sesión del historial
- [[multiple-simultaneous-groups]] — extiende este mecanismo de uno a varios grupos
  simultáneos
