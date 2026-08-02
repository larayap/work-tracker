---
type: capability-spec
title: "Una sesión por aparición de fila, registrada al cerrar el proceso o al detener"
capability: "app-monitoring"
slug: "session-log-persistence"
domain: "feature"
delta_type: null
supersedes: null
superseded_by: null
status: completed
assigned_agent: "sdd-apply"
priority: critical
depends_on: ["[[row-lifecycle]]"]
change_ref: "[[app-detection-logos-audio]]"
worktree: "/home/larayap/cronometro-app/.sdd/worktrees/app-detection-logos-audio"
feature_branch: "feature/app-detection-logos-audio"
commits: ["5bf6ade055a94a85c8185b3db5714e6b0154837c", "8052ec0536337479fbad91a5314581f0b7a06a54", "56a850a513f49fae29b4aeb6d299b966c74e4c50", "e431617485ea2f51a4d7930252128acbd384f00b", "c865b2d2efb0fd58ffab3f91ffe39b17460213f8", "5145ec9ad72f17e812421293af57b08456dd8416", "cf4b70b41db12732869431cca2de0ddbe7c1eebb", "a74a658"]
mr: "https://github.com/larayap/cronometro-app/pull/2"
acceptance_criteria:
  - "El reloj de una fila muestra el tiempo transcurrido desde que esa fila apareció, nunca el acumulado del día"
  - "Cerrar el proceso de un programa monitoreado registra una entrada en el historial con la duración de esa aparición"
  - "Detener una fila registra una entrada en el historial con la duración de esa aparición"
  - "Un programa usado en varios tramos durante el mismo día produce una entrada de historial por tramo"
related: []
affects: []
adrs: ["[[0002-main-process-owns-monitoring-state]]", "[[0006-userdata-json-persistence]]"]
scope: ["src/background.js"]
verified_at: "2026-08-01"
created: "2026-08-01"
updated: "2026-08-02"
tags: [capability-spec]
---

# Una sesión por aparición de fila, registrada al cerrar el proceso o al detener

## Purpose

El reloj de cada fila responde a la pregunta "cuánto llevo en esto ahora", no "cuánto llevo
hoy en total". Esta spec fija esa semántica: cada vez que una fila aparece en el listado se
abre una sesión de conteo que arranca en cero, y esa sesión se cierra y se registra en el
historial exactamente en los dos momentos en que la fila deja de estar activa por completo
—cierre del proceso o gesto de detener—. El total acumulado del día sigue siendo
responsabilidad del historial, que ya suma por día y por programa.

## Requirements

- El sistema SHALL abrir una sesión nueva cada vez que una fila aparece en el listado
  visible, con el reloj de esa fila arrancando en cero.
- El sistema SHALL acumular en la sesión abierta el tiempo durante el cual la fila está en
  estado corriendo, sin acumular mientras está en estado pausado.
- El sistema SHALL cerrar y registrar en el historial la sesión de una fila en el instante
  en que el proceso de ese programa se cierra.
- El sistema SHALL cerrar y registrar en el historial la sesión de una fila en el instante
  en que el usuario presiona el control de detener esa fila.
- El sistema SHALL NOT registrar ninguna entrada en el historial en momentos distintos de
  esos dos: perder el foco, por sí solo, nunca cierra ni registra una sesión.
- El sistema SHALL abrir una sesión independiente y nueva, arrancando en cero, cada vez que
  una fila vuelve a aparecer después de haber sido registrada y cerrada.
- El sistema SHOULD permitir que un mismo programa acumule varias entradas de historial en
  un mismo día cuando se usa en varios tramos separados.

## Scenarios

### Scenario: El reloj muestra la sesión en curso, no el total del día

**GIVEN** una fila que lleva un rato acumulando tiempo en la sesión actual
**WHEN** el usuario mira el reloj de esa fila
**THEN** ve el tiempo transcurrido desde que la fila apareció, no el total acumulado en el
día para ese programa

### Scenario: Cerrar el proceso registra la sesión

**GIVEN** una fila con una sesión abierta y tiempo acumulado
**WHEN** el usuario cierra el proceso de ese programa
**THEN** se registra en el historial una entrada con la duración de esa sesión

### Scenario: Detener la fila registra la sesión

**GIVEN** una fila con una sesión abierta y tiempo acumulado
**WHEN** el usuario presiona el control de detener esa fila
**THEN** se registra en el historial una entrada con la duración de esa sesión

### Scenario: Perder el foco no registra nada

**GIVEN** una fila con una sesión abierta, en estado corriendo
**WHEN** el programa pierde el foco
**THEN** no se registra ninguna entrada en el historial y la sesión sigue abierta

### Scenario: Reaparición abre una sesión nueva

**GIVEN** un programa cuya sesión anterior ya fue registrada en el historial, sea porque el
proceso se cerró o porque el usuario detuvo la fila
**WHEN** ese programa vuelve a aparecer en el listado visible
**THEN** arranca una sesión nueva con el reloj en cero, independiente de la anterior

## Acceptance Criteria

- [x] El reloj de una fila muestra el tiempo transcurrido desde que esa fila apareció,
  nunca el acumulado del día.
- [x] Cerrar el proceso de un programa monitoreado registra en el historial una entrada con
  la duración de esa aparición.
- [x] Detener una fila registra en el historial una entrada con la duración de esa
  aparición.
- [x] Perder el foco, sin cerrar el proceso ni detener la fila, no registra ninguna entrada
  en el historial.
- [x] Un programa usado en varios tramos durante el mismo día produce una entrada de
  historial por tramo.

## Related

- [[row-lifecycle]] — los dos eventos que cierran una sesión (cierre de proceso, detener)
  son los mismos que rigen la salida y reentrada de la fila en el listado visible
