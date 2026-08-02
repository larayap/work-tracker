---
type: capability-spec
title: "Selección permanente o de una sola vez, elegida al agregar"
capability: "app-monitoring"
slug: "selection-type-manual-vs-auto"
domain: "feature"
delta_type: added
supersedes: null
superseded_by: null
status: review
assigned_agent: "sdd-apply"
priority: high
depends_on: []
change_ref: "[[sessions-groups-history]]"
worktree: "/home/larayap/cronometro-app/.sdd/worktrees/sessions-groups-history"
feature_branch: "feature/sessions-groups-history"
commits: ["70565f9c865e1abce5b7aa7932da560f715d5158"]
mr: ""
acceptance_criteria:
  - "Agregar un programa sin cambiar el modo lo deja en la selección guardada como permanente, igual que hoy"
  - "Agregar un programa en modo de una sola vez lo marca como manual en su selección"
  - "Una fila de un programa manual se distingue visualmente de una fila automática"
  - "Reiniciar el cronómetro con el programa manual todavía abierto hace reaparecer su fila con normalidad"
  - "Reiniciar el cronómetro con el programa manual ya cerrado no deja rastro de él en la selección guardada"
related: ["[[deselect-from-saved-selection]]", "[[installed-apps-data-integrity]]"]
affects: ["[[row-lifecycle-persistence-by-type]]"]
adrs: []
scope: ["src/components/AppSelectorModal.vue", "src/main/monitor-engine.js", "src/main/json-store.js"]
verified_at: null
created: "2026-08-02"
updated: "2026-08-02"
tags: [capability-spec]
---

# Selección permanente o de una sola vez, elegida al agregar

## Purpose

Hoy toda selección es permanente: un programa agregado siempre vuelve a aparecer cada vez
que se abre, para siempre. Esta spec agrega una segunda modalidad, transitoria, pensada para
cuando el usuario solo quiere cronometrar un uso puntual sin dejarlo enganchado de forma
indefinida. El usuario elige la modalidad antes de agregar el programa, con un valor por
defecto que preserva el comportamiento de hoy sin que nadie tenga que cambiar nada.

## Requirements

- El sistema SHALL ofrecer, dentro del selector, una única elección de "cómo agregar" el
  próximo programa: como permanente (automático) o como de una sola vez (manual), antes de
  que el usuario elija el programa.
- El sistema SHALL dejar esa elección en permanente/automático por defecto, de modo que el
  comportamiento existente no cambie a menos que el usuario elija activamente la modalidad
  de una sola vez.
- El sistema SHALL aplicar la modalidad elegida al próximo programa que el usuario agregue.
- El sistema SHALL marcar, en la selección guardada, cada programa con la modalidad que
  tenía en el momento en que se agregó.
- El sistema SHALL distinguir, en el listado visible, una fila de un programa de modalidad
  manual de una fila de modalidad automática, mediante un marcador visual discreto.
- El sistema SHALL mantener la entrada de un programa manual en la selección guardada
  cuando el cronómetro se reinicia mientras su programa monitoreado sigue en ejecución, de
  modo que su fila reaparezca tal como estaba.
- El sistema SHALL descartar la entrada de un programa manual de la selección guardada,
  sin generar fila, cuando el cronómetro arranca y su programa monitoreado ya no está en
  ejecución.
- El sistema SHALL NOT aplicar esa reconciliación al arrancar a los programas de modalidad
  automática: permanecen en la selección guardada al arrancar sin importar si su programa
  está o no en ejecución.

## Scenarios

### Scenario: Agregar en modo permanente es el comportamiento de hoy

**GIVEN** el selector abierto sin cambiar la modalidad
**WHEN** el usuario agrega un programa
**THEN** queda en la selección guardada como permanente, igual que antes de esta
funcionalidad

### Scenario: Agregar en modo de una sola vez

**GIVEN** el usuario cambia la modalidad a "solo esta vez"
**WHEN** agrega un programa
**THEN** ese programa queda marcado como manual en su selección guardada

### Scenario: La fila de una sola vez se distingue en el listado

**GIVEN** un programa agregado como de una sola vez, con fila visible
**WHEN** el usuario mira el listado
**THEN** puede distinguir esa fila de las permanentes por un marcador discreto

### Scenario: Reiniciar el cronómetro con el programa manual todavía abierto

**GIVEN** un programa manual cuyo proceso sigue abierto
**WHEN** el usuario cierra y vuelve a abrir el cronómetro
**THEN** la fila de ese programa reaparece con normalidad

### Scenario: Reiniciar el cronómetro con el programa manual ya cerrado

**GIVEN** un programa manual cuyo proceso se cerró mientras el cronómetro estaba cerrado
**WHEN** el usuario vuelve a abrir el cronómetro
**THEN** ese programa ya no está en su selección guardada y no aparece fila para él

## Acceptance Criteria

Implementación completa (commit 70565f9).

- [x] Agregar un programa sin cambiar la modalidad lo deja en la selección guardada como
  permanente, igual que el comportamiento de hoy. (`addAsType` por defecto `'auto'`, único
  camino de código)
- [x] Agregar un programa en modalidad "solo esta vez" lo marca como manual en su selección
  guardada. (`addAsType: 'manual'` → `addApp({ type })` → IPC → `addToSelection` sin entrada
  previa usa `type`, único camino de código)
- [ ] Una fila de modalidad manual se distingue visualmente de una fila automática en el
  listado. (marcador implementado, Tarea 10; "se distingue de un vistazo" requiere juicio
  visual con la app corriendo en Windows)
- [x] Reiniciar el cronómetro con el programa manual todavía en ejecución hace reaparecer
  su fila sin acción del usuario. (verificado: la reconciliación de `loadSelection`,
  ejercitada con la misma lógica contra `monitored-selection.json` real + una entrada manual
  fabricada viva según `tasklist.exe` real, la conserva)
- [x] Reiniciar el cronómetro con el programa manual ya cerrado deja la selección guardada
  sin esa entrada y sin fila para él. (mismo ejercicio: una entrada manual fabricada sin
  proceso vivo real se descarta)

## Related

- [[deselect-from-saved-selection]] — acción independiente de esta modalidad: desmarcar
  saca de la selección guardada sin importar si el programa es automático o manual
- [[installed-apps-data-integrity]] — comparte el mismo selector donde vive el control de
  modalidad
- [[row-lifecycle-persistence-by-type]] — consume la modalidad que esta spec define para
  decidir si un programa permanece o se da de baja de la selección guardada al salir su fila
