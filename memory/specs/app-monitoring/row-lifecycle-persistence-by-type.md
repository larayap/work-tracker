---
type: capability-spec
title: "Ciclo de vida de la fila: la selección guardada persiste solo para tipo automático"
capability: "app-monitoring"
slug: "row-lifecycle-persistence-by-type"
domain: "feature"
delta_type: modified
supersedes: "[[row-lifecycle]]"
superseded_by: null
status: completed
assigned_agent: "sdd-apply"
priority: critical
depends_on: ["[[selection-type-manual-vs-auto]]"]
change_ref: "[[sessions-groups-history]]"
worktree: "/home/larayap/cronometro-app/.sdd/worktrees/sessions-groups-history"
feature_branch: "feature/sessions-groups-history"
commits: ["70565f9c865e1abce5b7aa7932da560f715d5158"]
mr: ""
acceptance_criteria:
  - "Agregar un programa a la selección lo muestra de inmediato como fila en el listado visible"
  - "Un programa de la selección guardada cuyo proceso se abre aparece como fila sin acción manual del usuario"
  - "Presionar el control de detener una fila y cerrar el proceso de ese programa producen exactamente el mismo efecto sobre el listado visible"
  - "Un programa automático que salió del listado visible por cualquiera de esos dos eventos permanece en la selección guardada y reaparece con fila propia la siguiente vez que su proceso se abre"
  - "Un programa manual que salió del listado visible por cualquiera de esos dos eventos deja de estar en la selección guardada"
  - "Perder el foco nunca saca una fila del listado visible por sí solo"
related: ["[[two-state-row-machine]]", "[[saved-selection-only-monitoring]]", "[[installed-apps-data-integrity]]", "[[deselect-from-saved-selection]]", "[[legacy-userdata-one-shot-migration]]"]
affects: ["[[sessions-json-persistence]]", "[[simultaneous-limit]]", "[[empty-state]]", "[[automatic-bw-icons]]"]
adrs: ["[[0001-two-signal-monitoring-engine]]", "[[0002-main-process-owns-monitoring-state]]"]
scope: ["src/main/monitor-engine.js", "src/main/ipc-handlers.js", "src/main/json-store.js"]
verified_at: "2026-08-02"
created: "2026-08-02"
updated: "2026-08-06"
tags: [capability-spec]
---

# Ciclo de vida de la fila: la selección guardada persiste solo para tipo automático

## Purpose

Hasta ahora, todo programa que salía del listado visible —por el control de detener o por el
cierre de su proceso— permanecía en la selección guardada del usuario, sin excepción: esa
permanencia es lo que le permite reaparecer como fila la próxima vez que se abre. Con la
llegada de una segunda modalidad de selección —manual o transitoria, pensada para un uso de
una sola vez— esa permanencia deja de ser incondicional. Esta spec redefine la regla: solo
los programas de modalidad automática siguen la regla de siempre; los de modalidad manual se
dan de baja de la selección guardada en el mismo instante en que su fila sale del listado.
El resto del ciclo de vida de la fila —cuándo aparece, cuándo desaparece, y que perder el
foco nunca la saca— no cambia.

## Requirements

- El sistema SHALL mantener dos conjuntos distintos: la selección guardada de programas
  que el usuario eligió monitorear, y el listado visible de filas mostradas en este momento.
- El sistema SHALL persistir la selección guardada entre sesiones de la aplicación.
- El sistema SHALL agregar una fila al listado visible en el instante en que el usuario
  incorpora un programa a la selección guardada.
- El sistema SHALL agregar una fila al listado visible en el instante en que un programa
  que ya está en la selección guardada, y que no tiene fila visible, pasa de proceso cerrado
  a proceso en ejecución.
- El sistema SHALL asignar a una fila recién agregada el estado corriendo si el programa
  tiene el foco en ese instante, o pausado si no lo tiene.
- El sistema SHALL quitar una fila del listado visible cuando el usuario presiona el control
  de detener esa fila.
- El sistema SHALL quitar una fila del listado visible cuando el proceso de ese programa se
  cierra, con el mismo efecto que si el usuario hubiera presionado el control de detener.
- El sistema SHALL tratar ambos eventos de salida como equivalentes en todos sus efectos
  observables: cierran la sesión en curso, la registran en el historial y quitan la fila del
  listado visible.
- El sistema SHALL NOT quitar una fila del listado visible por el solo hecho de perder el
  foco: perder el foco cambia el estado de la fila, nunca su presencia en el listado.
- El sistema SHALL mantener en la selección guardada, después de cualquiera de los dos
  eventos de salida, únicamente a los programas de modalidad automática, de modo que vuelvan
  a generar una fila la próxima vez que su proceso se abra.
- El sistema SHALL dar de baja de la selección guardada, en el mismo instante en que su fila
  sale del listado visible por cualquiera de los dos eventos de salida, a un programa de
  modalidad manual.
- El sistema SHALL permitir que un programa de modalidad automática esté en la selección
  guardada sin tener fila visible en el listado.

## Scenarios

### Scenario: Agregar un programa crea su fila de inmediato

**GIVEN** el usuario abre el selector para agregar un programa
**WHEN** el usuario confirma agregarlo a su selección
**THEN** aparece de inmediato una fila para ese programa en el listado visible

### Scenario: Un programa automático de la selección guardada abre su proceso

**GIVEN** un programa de modalidad automática está en la selección guardada del usuario pero
no tiene fila visible
**WHEN** el usuario abre ese programa
**THEN** aparece una fila nueva para ese programa en el listado visible, sin que el usuario
tenga que agregarlo de nuevo

### Scenario: Detener una fila automática la saca del listado sin sacar el programa de la selección

**GIVEN** un programa de modalidad automática, monitoreado con fila visible, en cualquiera de
los dos estados
**WHEN** el usuario presiona el control de detener esa fila
**THEN** la fila desaparece del listado visible y el programa permanece en la selección
guardada del usuario

### Scenario: Cerrar el proceso de un programa automático saca la fila exactamente igual que detenerla

**GIVEN** un programa de modalidad automática, monitoreado con fila visible, en cualquiera de
los dos estados
**WHEN** el usuario cierra el proceso de ese programa
**THEN** la fila desaparece del listado visible con el mismo efecto que si el usuario
hubiera presionado el control de detener, y el programa permanece en la selección guardada

### Scenario: Detener una fila manual la saca del listado y también de la selección

**GIVEN** un programa de modalidad manual, monitoreado con fila visible
**WHEN** el usuario presiona el control de detener esa fila
**THEN** la fila desaparece del listado visible y el programa deja de estar en la selección
guardada

### Scenario: Cerrar el proceso de un programa manual lo saca también de la selección

**GIVEN** un programa de modalidad manual, monitoreado con fila visible
**WHEN** el usuario cierra el proceso de ese programa
**THEN** la fila desaparece del listado visible y el programa deja de estar en la selección
guardada, con el mismo efecto que si el usuario hubiera presionado el control de detener

### Scenario: Un programa automático que salió del listado reaparece al reabrirse

**GIVEN** un programa de modalidad automática cuya fila salió del listado visible
previamente —por haberse detenido o por haberse cerrado su proceso— y que sigue en la
selección guardada
**WHEN** el usuario abre ese programa de nuevo
**THEN** aparece una fila nueva para ese programa en el listado visible

### Scenario: Perder el foco no saca la fila del listado

**GIVEN** un programa monitoreado con su fila en estado corriendo, de cualquier modalidad
**WHEN** el usuario cambia el foco a otra ventana
**THEN** la fila sigue visible en el listado, ahora en estado pausado

## Acceptance Criteria

Implementación completa (commit 70565f9). Verificado con `node -e` contra entradas
fabricadas (ver commit y `observations.md`); re-verificado en `sdd-verify` con nuevos
escenarios fabricados sobre el código real (`reduceLifecycle`, `closeRow`, `reduceFocus`). La
equivalencia end-to-end ■/cierre de proceso contra un proceso Windows real (no fabricado)
requiere la app corriendo y queda sin marcar.

- [x] Agregar un programa a la selección lo muestra de inmediato como fila en el listado
  visible. (comportamiento preexistente de `addToSelection`, sin cambios de contrato en este
  cambio; ahora además guarda `type` en la fila inmediata)
- [x] Un programa automático de la selección guardada cuyo proceso se abre aparece como fila
  sin ninguna acción manual adicional del usuario. (verificado: la alta de `reduceLifecycle`
  crea la fila con `type` correcto cuando hay evidencia de vida)
- [ ] Presionar el control de detener una fila y cerrar el proceso de ese programa producen
  exactamente el mismo efecto observable sobre el listado visible, sin importar la modalidad.
- [x] Un programa automático que salió del listado visible por cualquiera de esos dos
  eventos permanece en la selección guardada y reaparece con fila propia la próxima vez que
  su proceso se abre. (verificado: `reduceLifecycle` con fila `auto` y PID muerto deja la
  entrada en `selection`, misma referencia)
- [x] Un programa manual que salió del listado visible por cualquiera de esos dos eventos
  deja de estar en la selección guardada. (verificado en `sdd-verify` con `app.getPath`
  mockeado y `monitorEngine.closeRow` real: una fila manual y una automática se agregan vía
  `addToSelection`, se cierran ambas con `closeRow`, y solo la manual sale de `selection`
  —tanto en el snapshot en memoria como en `monitored-selection.json` persistido—, mientras
  ambas quedan registradas en `sessions.json`)
- [x] Perder el foco, por sí solo, nunca saca una fila del listado visible. (verificado en
  `sdd-verify`: `reduceFocus(null, rows, now)` sobre dos filas devuelve un array de la misma
  longitud, todas transicionadas a `paused` sin que ninguna se remueva — `reduceFocus` nunca
  filtra el array, solo mapea `state`)
- [x] Un programa automático puede estar en la selección guardada sin tener fila visible en
  ningún momento dado. (comportamiento preexistente de `reduceLifecycle`, sin cambios)

## Related

- [[two-state-row-machine]] — define en qué estado entra una fila recién agregada al
  listado visible; esta spec gobierna en cambio si la fila existe o no, y qué pasa con la
  selección guardada al salir
- [[saved-selection-only-monitoring]] — restringe qué programas pueden llegar a generar
  una fila mediante este ciclo de vida
- [[selection-type-manual-vs-auto]] — define la modalidad (automática o manual) que esta
  spec usa para decidir si el programa permanece o se da de baja de la selección guardada
- [[deselect-from-saved-selection]] — acción explícita del usuario que produce el mismo
  efecto de baja de la selección guardada, sin pasar por un evento de salida de fila
- [[sessions-json-persistence]] — la sesión registrada en el historial se abre y se cierra
  en los mismos dos eventos que sacan una fila del listado
- [[simultaneous-limit]] — acota cuántas filas pueden coexistir en el listado visible al
  mismo tiempo
- [[empty-state]] — describe cómo se ve el listado visible cuando la última fila sale por
  cualquiera de los dos eventos de este ciclo de vida
- [[automatic-bw-icons]] — cada fila que entra al listado trae consigo el ícono del programa
- [[legacy-userdata-one-shot-migration]] — el traspaso de `userData` al renombrar el
  producto pone a disposición, bajo la identidad nueva, la `monitored-selection.json` que
  esta spec gobierna
