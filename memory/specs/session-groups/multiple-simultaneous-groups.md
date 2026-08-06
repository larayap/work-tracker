---
type: capability-spec
title: "Varios grupos de sesión visibles al mismo tiempo en el listado de trabajo"
capability: "session-groups"
slug: "multiple-simultaneous-groups"
domain: "feature"
delta_type: added
supersedes: null
superseded_by: null
status: review
assigned_agent: "sdd-apply"
priority: medium
depends_on: ["[[group-composition-and-drag]]"]
change_ref: "[[work-groups-history-time-format]]"
worktree: "/home/larayap/cronometro-app/.sdd/worktrees/work-groups-history-time-format"
feature_branch: "feature/work-groups-history-time-format"
commits: ["5c3bcd8f71a8ea4c73c6c2351df84555308b88cb"]
mr: ""
acceptance_criteria:
  - "El usuario puede formar un segundo grupo mientras el primero sigue existiendo, y ambos se muestran al mismo tiempo"
  - "La franja para crear un grupo sigue disponible después de formar uno o más grupos, mientras queden filas sueltas"
  - "Mover una fila entre grupos no altera la composición de los demás grupos"
  - "Con el listado en su límite de filas, el usuario puede repartirlas en más de un grupo a la vez"
related: ["[[group-composition-and-drag]]", "[[simultaneous-limit]]", "[[inline-session-naming]]"]
affects: []
adrs: ["[[0008-sessions-and-groups-as-entry-metadata]]"]
scope: ["src/components/CronometroAplicacion.vue"]
verified_at: null
created: "2026-08-05"
updated: "2026-08-05"
tags: [capability-spec]
---

# Varios grupos de sesión visibles al mismo tiempo en el listado de trabajo

## Purpose

El listado de trabajo permite hoy formar un grupo de sesión arrastrando filas entre sí, pero
solo puede haber un grupo visible a la vez: en cuanto el usuario arma un segundo grupo, deja
de ver el primero como agrupado. Esta spec quita esa restricción de la interfaz —no del
modelo, que ya soporta cualquier cantidad de grupos— para que el usuario pueda mantener
varias actividades agrupadas en paralelo, cada una con su propio nombre y sus propias filas,
sin que armar una nueva le haga perder la anterior.

## Requirements

- El sistema SHALL permitir que dos o más grupos de sesión existan y se muestren al mismo
  tiempo en el listado de trabajo.
- El sistema SHALL mostrar una franja para crear un grupo nuevo mientras exista al menos una
  fila suelta, sin importar cuántos grupos ya estén formados.
- El sistema SHALL convertir esa franja en un grupo nuevo e independiente en cuanto recibe su
  primera fila, dejando disponible una franja adicional debajo para seguir agregando filas o
  formar otro grupo más.
- El sistema SHALL mantener cada grupo con su propio nombre y su propia composición de filas,
  sin que las acciones sobre un grupo alteren a los demás grupos visibles.
- El sistema SHALL permitir mover una fila entre dos grupos existentes, o entre un grupo y el
  listado suelto, afectando únicamente al grupo de origen y al grupo de destino.
- El sistema SHALL dejar de mostrar un grupo en cuanto pierde su última fila, sin afectar a
  los demás grupos.
- El sistema SHALL NOT limitar a uno la cantidad de grupos que pueden existir
  simultáneamente.
- El sistema SHALL NOT modificar el límite de filas simultáneas del listado por el hecho de
  que existan varios grupos.

## Scenarios

### Scenario: Crear un segundo grupo sin perder el primero

**GIVEN** un grupo ya formado con al menos una fila, y filas sueltas restantes
**WHEN** el usuario arrastra una fila suelta a la franja de crear grupo
**THEN** aparece un segundo grupo independiente, y el primer grupo sigue mostrándose sin
cambios

### Scenario: La franja de crear grupo sigue disponible con varios grupos

**GIVEN** dos grupos ya formados y al menos una fila suelta
**WHEN** el usuario mira el listado de trabajo
**THEN** sigue viendo una franja disponible para seguir agregando filas o formar un grupo
adicional

### Scenario: Mover una fila entre grupos no afecta a los demás

**GIVEN** dos grupos formados, cada uno con sus propias filas
**WHEN** el usuario mueve una fila de un grupo al otro
**THEN** el grupo de origen pierde esa fila, el grupo de destino la incorpora, y ningún otro
grupo cambia

### Scenario: Todos los grupos desaparecen cuando se vacían

**GIVEN** varios grupos visibles, cada uno con filas
**WHEN** todas las filas de todos los grupos se detienen o se sacan
**THEN** ningún grupo queda visible en el listado

## Acceptance Criteria

Implementación completa (commit `5c3bcd8`, `CronometroAplicacion.vue`): colección
`dragGroups` por `groupId`, franja permanente de creación, `applyRows()` atómico y guarda de
arrastre de tres reglas. Revisión de diff en iteración 1 confirmó que el código implementa
fielmente `design.md` §D-1.

`sdd-verify` (iteración 2) ejerció la app real con dos filas activas ("Google Chrome" y
"Discord"/"Voice call"): ambas conviven sueltas y visibles simultáneamente, y la franja
"Arrastrá aquí para agrupar" está disponible con filas sueltas presentes — ambos hechos son
independientes del gesto de arrastre y quedan confirmados. El gesto de arrastre en sí (mover
una fila a la franja para formar un grupo) **no se pudo reproducir**: se intentaron tres
técnicas de automatización de mouse distintas sobre la misma fila —(1) `mouse_event` con
movimiento lineal de 15 pasos, (2) la misma API con un nudge inicial de pocos píxeles antes
del movimiento grande, imitando el umbral de arranque de un drag real, y (3) `SendInput` con
coordenadas absolutas y 25 pasos— y en ninguna de las tres la fila cambió de contenedor ni la
ventana cambió de alto (indicador indirecto de que ni siquiera se formó un grupo). Es una
limitación conocida de automatizar `vuedraggable`/SortableJS mediante eventos de mouse
sintéticos a nivel de SO, no evidencia de un defecto: el código ya fue revisado en iteración 1
contra el diseño aprobado sin hallazgos. Los cinco criterios de aceptación — los cuatro que
dependen del gesto de arrastre, más el límite de 4 filas repartidas en grupos — **no
pudieron verificarse** por esta vía y quedan sin marcar. No se infiere que funcionen porque
el diff coincide con el diseño: esa coincidencia ya estaba establecida en iteración 1 y no
sustituye la observación del comportamiento.

- [ ] El usuario puede formar un segundo grupo mientras el primero sigue existiendo, y ambos
  se muestran al mismo tiempo, cada uno con su nombre y sus filas. (NO REPRODUCIBLE: el gesto
  de arrastre que forma el primer grupo no se pudo ejecutar por automatización; ver arriba.
  Parcialmente relacionado — SÍ confirmado: dos filas sueltas coexisten visibles al mismo
  tiempo sin necesidad de agrupar)
- [x] Después de formar uno o más grupos, sigue apareciendo una franja disponible para seguir
  agregando filas o formar un grupo adicional, mientras queden filas sueltas. (visual,
  confirmado con cero grupos formados y dos filas sueltas — la condición del código es
  `dragUngrouped.length >= 1 || isDragging`, no requiere que ya exista un grupo previo; queda
  sin ejercitar el caso "con uno o más grupos ya formados" por la misma limitación de arrastre)
- [ ] Mover una fila entre grupos, o entre un grupo y el listado suelto, no altera la
  composición de los demás grupos. (NO REPRODUCIBLE: requiere arrastre)
- [ ] Con el listado en su límite de 4 filas, el usuario puede repartir esas filas en más de
  un grupo al mismo tiempo. (NO REPRODUCIBLE: requiere arrastre)
- [ ] Vaciar un grupo lo hace desaparecer sin afectar a los demás grupos visibles. (NO
  REPRODUCIBLE: requiere arrastre)

## Observations

El máximo práctico de grupos simultáneos queda acotado por el límite de 4 filas del listado
([[simultaneous-limit]]), no por esta spec: agrupar no crea ni destruye filas. No se agrega
ningún control nuevo del tipo "crear grupo" — el gesto sigue siendo arrastrar una fila a la
franja vacía más próxima, igual que con el primer grupo hoy.

## Related

- [[group-composition-and-drag]] — provee el mecanismo de arrastre y composición que esta
  spec extiende de uno a varios grupos simultáneos
- [[simultaneous-limit]] — acota el máximo práctico de grupos, sin cambios
- [[inline-session-naming]] — provee el nombre editable de la cabecera de cada grupo
