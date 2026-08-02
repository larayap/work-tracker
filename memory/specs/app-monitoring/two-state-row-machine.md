---
type: capability-spec
title: "Máquina de dos estados por fila: corriendo y pausado"
capability: "app-monitoring"
slug: "two-state-row-machine"
domain: "feature"
delta_type: added
supersedes: null
superseded_by: null
status: review
assigned_agent: "sdd-apply"
priority: critical
depends_on: []
change_ref: "[[app-detection-logos-audio]]"
worktree: "/home/larayap/cronometro-app/.sdd/worktrees/app-detection-logos-audio"
feature_branch: "feature/app-detection-logos-audio"
commits: ["5bf6ade055a94a85c8185b3db5714e6b0154837c", "8052ec0536337479fbad91a5314581f0b7a06a54", "56a850a513f49fae29b4aeb6d299b966c74e4c50", "e431617485ea2f51a4d7930252128acbd384f00b", "c865b2d2efb0fd58ffab3f91ffe39b17460213f8", "5145ec9ad72f17e812421293af57b08456dd8416", "d6b1e5959ebad10d76f26703de8737830bffe9de", "0930d53cf6387371c3b88fa28757fb3ecdca0c39", "144e28b73af4db08eb9d064980915e0612777b27", "5910a25d20fe79fa34812ec26903810d4b5152da", "a74a658"]
mr: ""
acceptance_criteria:
  - "Con dos o más filas visibles, en todo momento hay como máximo una fila en estado corriendo"
  - "Cambiar el foco entre programas monitoreados mueve el estado corriendo de una fila a otra sin intervención manual"
  - "Perder el foco deja la fila en pausado, con su reloj detenido y el tiempo acumulado conservado"
  - "Ninguna fila visible queda en un estado distinto de corriendo o pausado"
related: ["[[row-lifecycle]]"]
affects: ["[[row-lifecycle]]", "[[status-indicator-non-interactive]]"]
adrs: ["[[0001-two-signal-monitoring-engine]]", "[[0002-main-process-owns-monitoring-state]]"]
scope: ["src/background.js", "src/components/CronometroAplicacion.vue"]
verified_at: "2026-08-01"
created: "2026-08-01"
updated: "2026-08-01"
tags: [capability-spec]
---

# Máquina de dos estados por fila: corriendo y pausado

## Purpose

Cada fila del listado de programas monitoreados necesita un modelo de estado simple y sin
ambigüedad para que el usuario sepa, con solo mirarla, si el tiempo se está contando o no.
Hoy dos mecanismos de pausa distintos —uno manual y uno automático por foco— compiten sobre
la misma variable y producen inconsistencias. Esta spec fija el modelo correcto: mientras una
fila está presente en el listado visible, su estado depende de una única señal observable, el
foco, sin estados intermedios ni flags adicionales que sincronizar.

Esta spec gobierna únicamente el estado de una fila que ya existe. Si esa fila aparece o
desaparece del listado visible es una cuestión de existencia, no de estado, y la resuelve
[[row-lifecycle]].

## Requirements

- El sistema SHALL representar el estado de cada fila del listado visible con exactamente
  dos valores posibles: corriendo o pausado.
- El sistema SHALL considerar una fila en estado corriendo únicamente en los instantes en
  que el programa correspondiente tiene el foco.
- El sistema SHALL considerar una fila en estado pausado en cualquier instante en que el
  programa correspondiente no tiene el foco, sin otra condición adicional.
- El sistema SHALL avanzar el reloj de una fila solo mientras esa fila está en estado
  corriendo.
- El sistema SHALL mantener detenido el reloj de una fila en estado pausado, conservando el
  tiempo acumulado hasta ese momento.
- El sistema SHALL transicionar una fila de corriendo a pausado en el instante en que el
  programa pierde el foco.
- El sistema SHALL transicionar una fila de pausado a corriendo en el instante en que el
  programa gana el foco.
- El sistema SHALL NOT introducir un tercer estado para una fila presente en el listado
  visible.
- El sistema SHALL garantizar que, entre todas las filas visibles en un mismo instante, como
  máximo una esté en estado corriendo.

## Scenarios

### Scenario: El programa gana el foco y su fila pasa a corriendo

**GIVEN** un programa monitoreado con su fila visible en estado pausado
**WHEN** el usuario cambia el foco a ese programa
**THEN** la fila pasa a estado corriendo y su reloj comienza a avanzar

### Scenario: El programa pierde el foco y su fila pasa a pausado

**GIVEN** un programa monitoreado con su fila en estado corriendo
**WHEN** el usuario cambia el foco a otra ventana
**THEN** la fila pasa a estado pausado y su reloj deja de avanzar sin perder el tiempo
acumulado

### Scenario: Solo una fila corriendo a la vez

**GIVEN** varios programas monitoreados con fila visible al mismo tiempo
**WHEN** el usuario tiene el foco en uno de ellos
**THEN** esa fila queda en estado corriendo y todas las demás quedan en estado pausado

## Acceptance Criteria

- [x] Con dos o más filas visibles, en todo momento hay como máximo una fila en estado
  corriendo.
- [x] Cambiar el foco entre programas monitoreados mueve el estado corriendo de una fila a
  otra sin intervención manual del usuario.
- [x] Perder el foco deja la fila en pausado, con el reloj detenido y el tiempo acumulado
  conservado.
- [x] Ninguna fila visible queda, en ningún momento, en un estado distinto de corriendo o
  pausado.

## Related

- [[row-lifecycle]] — decide cuándo una fila entra o sale del listado visible (incluida la
  salida cuando el proceso se cierra); este modelo de estado solo aplica mientras la fila
  existe, y le asigna su estado de entrada
- [[status-indicator-non-interactive]] — el indicador visual de la fila refleja directamente
  cuál de los dos estados está activo
