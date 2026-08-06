---
type: capability-spec
title: "Nombrar una sesión en curso, sin interrumpir el flujo de agregar"
capability: "session-naming"
slug: "inline-session-naming"
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
commits: ["7b81610843141a092a1549d7dd1c214f7df27ee1"]
mr: ""
acceptance_criteria:
  - "Agregar un programa nunca pide un nombre de sesión"
  - "El usuario puede ponerle nombre a una sesión abierta haciendo click en su etiqueta"
  - "Enter confirma el nombre y Esc cancela sin cambios"
  - "El nombre queda congelado en el historial en el valor que tenía al cerrarse la sesión"
  - "Una sesión sin nombre se comporta exactamente igual que hoy"
related: ["[[group-composition-and-drag]]"]
affects: ["[[group-composition-and-drag]]", "[[session-view]]", "[[readable-session-title-typography]]"]
adrs: []
scope: ["src/components/AppRow.vue", "src/stores/monitoredApps.js", "src/main/session-log.js"]
verified_at: "2026-08-02"
created: "2026-08-02"
updated: "2026-08-05"
tags: [capability-spec]
---

# Nombrar una sesión en curso, sin interrumpir el flujo de agregar

## Purpose

Agregar un programa hoy es un gesto de dos clicks, y esta spec no le suma ninguno: nunca
interrumpe ese flujo con un pedido de nombre. El nombre se pone después, sobre una sesión
que ya está en marcha —una fila individual o un grupo— con un gesto liviano sobre su
etiqueta. El nombre queda editable mientras la sesión sigue abierta, y se congela en el
historial en cuanto la sesión se cierra.

## Requirements

- El sistema SHALL NOT pedir al usuario un nombre de sesión en el momento en que agrega un
  programa a su selección.
- El sistema SHALL permitir al usuario poner o cambiar el nombre de una sesión
  interactuando con la etiqueta de su fila o de su grupo, mientras la sesión está abierta.
- El sistema SHALL mostrar un campo de texto en el propio lugar de la etiqueta, con el
  nombre actual precargado si ya tiene uno, cuando el usuario inicia la edición del nombre.
- El sistema SHALL confirmar el nombre nuevo cuando el usuario presiona Enter, aplicándolo
  de inmediato a la sesión abierta.
- El sistema SHALL cancelar la edición sin ningún cambio cuando el usuario presiona Esc.
- El sistema SHALL permitir cambiar el nombre de una sesión tantas veces como el usuario
  quiera mientras esa sesión siga abierta.
- El sistema SHALL congelar el nombre de la sesión en el valor que tenía en el instante en
  que la sesión se cierra, de modo que la entrada del historial quede con ese nombre sin
  cambios posteriores.
- El sistema SHALL tratar una sesión a la que nunca se le puso nombre como una sesión sin
  nombre, con el mismo comportamiento que tiene hoy.

## Scenarios

### Scenario: Agregar un programa no pide nombre

**GIVEN** el usuario agregando un programa a su selección
**WHEN** confirma agregarlo
**THEN** el programa se agrega sin que se le pida ningún nombre

### Scenario: Poner nombre a una sesión en curso

**GIVEN** una fila con una sesión abierta, sin nombre
**WHEN** el usuario hace click en su etiqueta, escribe un nombre y confirma
**THEN** la sesión queda con ese nombre mientras siga abierta

### Scenario: Cancelar la edición del nombre

**GIVEN** una fila cuya edición de nombre está en curso
**WHEN** el usuario cancela
**THEN** el nombre vuelve a ser el que tenía antes de empezar a editar

### Scenario: El nombre se congela al cerrar la sesión

**GIVEN** una sesión con nombre, abierta
**WHEN** esa sesión se cierra, por cualquiera de sus eventos de cierre
**THEN** el historial registra la entrada con el nombre que tenía en ese momento, y ese
nombre ya no cambia

### Scenario: Una sesión sin nombre se comporta como hoy

**GIVEN** una sesión que el usuario nunca nombró
**WHEN** se cierra y se registra
**THEN** queda en el historial sin nombre, igual que el comportamiento actual

## Acceptance Criteria

Implementación completa (commit 7b81610). Los criterios de interacción click/teclado sobre
el DOM real requieren la app corriendo en Windows — ver `observations.md`. `sdd-verify`
verificó a nivel de motor (sin DOM) la multiplicidad de renombres y el congelamiento al
cerrar, que son el comportamiento que esa interacción termina invocando.

- [x] Agregar un programa nunca muestra ningún pedido de nombre de sesión. (`addApp`/`choose`
  no tienen ningún paso de nombre; `sessionName` nace `null` en toda fila creada)
- [ ] El usuario puede poner nombre a una sesión abierta haciendo click en su etiqueta,
  escribiendo el nombre y confirmando con Enter. (el gesto de click/teclado sobre
  `AppRow.vue` requiere DOM real; `monitoredApps.renameSession` que ese gesto invoca está
  verificado, ver criterio siguiente)
- [ ] Cancelar con Esc deja el nombre exactamente como estaba antes de editar. (estructural
  por lectura: `cancelEdit` solo pone `editing = false`, sin llamar `renameSession` — el
  gesto de teclado en sí requiere DOM real)
- [x] El nombre de una sesión se puede cambiar cuantas veces se quiera mientras esté
  abierta. (verificado en `sdd-verify`: tres llamadas sucesivas a
  `monitorEngine.renameSession(appId, …)` sobre la misma fila abierta dejan el último valor
  ("Nombre final") reflejado en el snapshot en memoria)
- [x] El historial registra el nombre que la sesión tenía en el instante de cerrarse, sin
  cambios posteriores. (verificado en `sdd-verify`: tras `closeRow`, `sessions.json` queda
  con el último nombre asignado; una llamada a `renameSession` posterior al cierre —la fila
  ya no existe en `rows`— es un no-op comprobado que no altera la entrada ya escrita)
- [x] Una sesión sin nombre se comporta de forma idéntica al comportamiento anterior a esta
  funcionalidad. (`displayName` es `row.sessionName || row.name`, idéntico a `{{ row.name }}`
  cuando `sessionName` es `null`)

## Related

- [[group-composition-and-drag]] — usa este mismo mecanismo de nombre inline para la
  cabecera de un grupo
- [[sessions-json-persistence]] — persiste el nombre que esta spec define en cada entrada
  del historial
- [[session-view]] — muestra el nombre de la sesión en la vista por sesión del historial
- [[readable-session-title-typography]] — cambia la tipografía del texto que este mecanismo
  produce, sin afectar su comportamiento
