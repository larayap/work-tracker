---
type: capability-spec
title: "Límite de 4 programas simultáneos en el listado visible"
capability: "app-monitoring"
slug: "simultaneous-limit"
domain: "feature"
delta_type: null
supersedes: null
superseded_by: null
status: review
assigned_agent: "sdd-apply"
priority: medium
depends_on: ["[[row-lifecycle]]"]
change_ref: "[[app-detection-logos-audio]]"
worktree: "/home/larayap/cronometro-app/.sdd/worktrees/app-detection-logos-audio"
feature_branch: "feature/app-detection-logos-audio"
commits: ["5bf6ade055a94a85c8185b3db5714e6b0154837c", "8052ec0536337479fbad91a5314581f0b7a06a54", "56a850a513f49fae29b4aeb6d299b966c74e4c50", "e431617485ea2f51a4d7930252128acbd384f00b", "c865b2d2efb0fd58ffab3f91ffe39b17460213f8", "5145ec9ad72f17e812421293af57b08456dd8416", "144e28b73af4db08eb9d064980915e0612777b27", "2171b964c8e7d3ac0fd935c4ca71921169ea06e7", "861d26cd5501dc5a7008cb97a2a1f0633a527e7c"]
mr: ""
acceptance_criteria:
  - "El listado visible nunca muestra más de 4 filas al mismo tiempo"
  - "Con 4 filas visibles, agregar un quinto programa no agrega una fila nueva"
  - "Detener una fila cuando el listado está al límite habilita agregar un programa nuevo"
related: []
affects: []
adrs: ["[[0002-main-process-owns-monitoring-state]]"]
scope: ["src/components/CronometroAplicacion.vue", "src/components/Menu.vue"]
verified_at: "2026-08-01"
created: "2026-08-01"
updated: "2026-08-01"
tags: [capability-spec]
---

# Límite de 4 programas simultáneos en el listado visible

## Purpose

El listado visible necesita un tope para mantenerse legible y para no romper el
comportamiento de la ventana que lo contiene. Monitorear más de cuatro programas a la vez
deja de ser cronometraje y pasa a ser supervisión, un caso de uso que esta app no cubre.
Esta spec fija ese tope en cuatro filas simultáneas.

## Requirements

- El sistema SHALL limitar el listado visible a un máximo de 4 filas presentes al mismo
  tiempo.
- El sistema SHALL impedir que se agregue una fila nueva mientras el listado visible ya
  tiene 4 filas, sin importar si la fila nueva vendría de un agregado manual o de la
  apertura de un proceso de la selección guardada.
- El sistema SHALL permitir agregar una fila nueva en cuanto el listado visible baja de 4
  filas, ya sea porque el usuario detuvo alguna o porque un proceso se cerró y salió del
  listado según las reglas de ciclo de vida vigentes.
- El sistema SHOULD comunicar al usuario, en el punto donde se agregan programas, que el
  límite fue alcanzado cuando corresponda.

## Scenarios

### Scenario: El listado alcanza el límite

**GIVEN** un listado visible con 4 filas
**WHEN** el usuario intenta agregar un quinto programa
**THEN** el listado sigue mostrando 4 filas y el quinto programa no se agrega como fila
visible

### Scenario: Liberar espacio permite agregar de nuevo

**GIVEN** un listado visible con 4 filas
**WHEN** el usuario detiene una de esas filas
**THEN** el listado queda con 3 filas y vuelve a aceptar un programa nuevo

### Scenario: Un programa de la selección guardada respeta el límite al abrirse

**GIVEN** un listado visible con 4 filas y un programa de la selección guardada sin fila
propia
**WHEN** el usuario abre ese programa
**THEN** no aparece una fila nueva para él mientras el listado se mantenga en 4

## Acceptance Criteria

- [x] El listado visible nunca muestra más de 4 filas al mismo tiempo.
- [x] Con 4 filas visibles, agregar un programa nuevo —manual o por apertura de proceso— no
  produce una quinta fila.
- [x] Detener una fila cuando el listado está en el límite habilita de inmediato agregar un
  programa nuevo.

## Related

- [[row-lifecycle]] — este límite acota las mismas dos vías de entrada de fila que define
  ese ciclo de vida
