---
type: capability-spec
title: "Ciclo de vida de la fila: entrada por agregado o apertura, salida por detener o por cierre de proceso"
capability: "app-monitoring"
slug: "row-lifecycle"
domain: "feature"
delta_type: added
supersedes: null
superseded_by: "[[row-lifecycle-persistence-by-type]]"
status: completed
assigned_agent: "sdd-apply"
priority: critical
depends_on: ["[[two-state-row-machine]]", "[[saved-selection-only-monitoring]]"]
change_ref: "[[app-detection-logos-audio]]"
worktree: "/home/larayap/cronometro-app/.sdd/worktrees/app-detection-logos-audio"
feature_branch: "feature/app-detection-logos-audio"
commits: ["5bf6ade055a94a85c8185b3db5714e6b0154837c", "8052ec0536337479fbad91a5314581f0b7a06a54", "56a850a513f49fae29b4aeb6d299b966c74e4c50", "e431617485ea2f51a4d7930252128acbd384f00b", "c865b2d2efb0fd58ffab3f91ffe39b17460213f8", "5145ec9ad72f17e812421293af57b08456dd8416", "d6b1e5959ebad10d76f26703de8737830bffe9de", "0930d53cf6387371c3b88fa28757fb3ecdca0c39", "144e28b73af4db08eb9d064980915e0612777b27", "5910a25d20fe79fa34812ec26903810d4b5152da", "cf4b70b41db12732869431cca2de0ddbe7c1eebb"]
mr: "https://github.com/larayap/cronometro-app/pull/2"
acceptance_criteria:
  - "Agregar un programa a la selección lo muestra de inmediato como fila en el listado visible"
  - "Un programa de la selección guardada cuyo proceso se abre aparece como fila sin acción manual del usuario"
  - "Presionar el control de detener una fila y cerrar el proceso de ese programa producen exactamente el mismo efecto sobre el listado visible"
  - "Un programa que salió del listado visible por cualquiera de esos dos eventos permanece en la selección guardada y reaparece con fila propia la siguiente vez que su proceso se abre"
  - "Perder el foco nunca saca una fila del listado visible por sí solo"
related: ["[[installed-apps-listing-quality]]"]
affects: ["[[session-log-persistence]]", "[[simultaneous-limit]]", "[[empty-state]]", "[[automatic-bw-icons]]"]
adrs: ["[[0001-two-signal-monitoring-engine]]", "[[0002-main-process-owns-monitoring-state]]"]
scope: ["src/background.js", "src/components/CronometroAplicacion.vue"]
verified_at: "2026-08-01"
created: "2026-08-01"
updated: "2026-08-02"
tags: [capability-spec]
---

# Ciclo de vida de la fila: entrada por agregado o apertura, salida por detener o por cierre de proceso

## Purpose

El listado de programas que el usuario ve en pantalla (listado visible) y el conjunto de
programas que el usuario eligió monitorear (selección guardada) son dos cosas distintas que
hoy la app no separa. Esta spec define cuándo una fila aparece en el listado visible y
cuándo desaparece.

La fila sale del listado visible por dos eventos con **efecto idéntico**: el usuario presiona
el control de detener esa fila, o el proceso de ese programa se cierra. Ninguno de los dos
saca al programa de la selección guardada, así que el gesto de cortar el seguimiento de un
programa —a mano o simplemente cerrándolo— nunca obliga al usuario a volver a elegirlo la
próxima vez que lo abra.

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
  foco: perder el foco cambia el estado de la fila (según el modelo de dos estados), nunca
  su presencia en el listado.
- El sistema SHALL mantener el programa en la selección guardada después de cualquiera de
  los dos eventos de salida, de modo que vuelva a generar una fila la próxima vez que su
  proceso se abra.
- El sistema SHALL permitir que un programa esté en la selección guardada sin tener fila
  visible en el listado.

## Scenarios

### Scenario: Agregar un programa crea su fila de inmediato

**GIVEN** el usuario abre el selector para agregar un programa
**WHEN** el usuario confirma agregarlo a su selección
**THEN** aparece de inmediato una fila para ese programa en el listado visible

### Scenario: Un programa de la selección guardada abre su proceso

**GIVEN** un programa está en la selección guardada del usuario pero no tiene fila visible
**WHEN** el usuario abre ese programa
**THEN** aparece una fila nueva para ese programa en el listado visible, sin que el usuario
tenga que agregarlo de nuevo

### Scenario: Detener una fila la saca del listado sin sacar el programa de la selección

**GIVEN** un programa monitoreado con fila visible, en cualquiera de los dos estados
**WHEN** el usuario presiona el control de detener esa fila
**THEN** la fila desaparece del listado visible y el programa permanece en la selección
guardada del usuario

### Scenario: Cerrar el proceso saca la fila exactamente igual que detenerla

**GIVEN** un programa monitoreado con fila visible, en cualquiera de los dos estados
**WHEN** el usuario cierra el proceso de ese programa
**THEN** la fila desaparece del listado visible con el mismo efecto que si el usuario
hubiera presionado el control de detener, y el programa permanece en la selección guardada

### Scenario: Un programa que salió del listado reaparece al reabrirse

**GIVEN** un programa cuya fila salió del listado visible previamente —por haberse detenido
o por haberse cerrado su proceso— y que sigue en la selección guardada
**WHEN** el usuario abre ese programa de nuevo
**THEN** aparece una fila nueva para ese programa en el listado visible

### Scenario: Perder el foco no saca la fila del listado

**GIVEN** un programa monitoreado con su fila en estado corriendo
**WHEN** el usuario cambia el foco a otra ventana
**THEN** la fila sigue visible en el listado, ahora en estado pausado

## Acceptance Criteria

- [x] Agregar un programa a la selección lo muestra de inmediato como fila en el listado
  visible.
- [x] Un programa de la selección guardada cuyo proceso se abre aparece como fila sin
  ninguna acción manual adicional del usuario.
- [x] Presionar el control de detener una fila y cerrar el proceso de ese programa producen
  exactamente el mismo efecto observable: la fila desaparece del listado visible.
- [x] Un programa que salió del listado visible por cualquiera de esos dos eventos permanece
  en la selección guardada y reaparece con fila propia la próxima vez que su proceso se abre.
- [x] Perder el foco, por sí solo, nunca saca una fila del listado visible.
- [x] Un programa puede estar en la selección guardada sin tener fila visible en ningún
  momento dado.

## Related

- [[two-state-row-machine]] — define en qué estado entra una fila recién agregada al
  listado visible, y gobierna su estado mientras existe; esta spec gobierna en cambio si la
  fila existe o no
- [[saved-selection-only-monitoring]] — restringe qué programas pueden llegar a generar
  una fila mediante este ciclo de vida
- [[session-log-persistence]] — la sesión registrada en el historial se abre y se cierra en
  los mismos dos eventos que sacan una fila del listado: detener y cierre de proceso
- [[simultaneous-limit]] — acota cuántas filas pueden coexistir en el listado visible al
  mismo tiempo
- [[empty-state]] — describe cómo se ve el listado visible cuando la última fila sale por
  cualquiera de los dos eventos de este ciclo de vida
- [[automatic-bw-icons]] — cada fila que entra al listado trae consigo el ícono del programa
- [[installed-apps-listing-quality]] — es una de las dos vías por las que el usuario agrega
  un programa a la selección guardada
