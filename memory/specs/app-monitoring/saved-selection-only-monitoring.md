---
type: capability-spec
title: "Solo se monitorea la selección guardada del usuario"
capability: "app-monitoring"
slug: "saved-selection-only-monitoring"
domain: "feature"
delta_type: null
supersedes: null
superseded_by: null
status: review
assigned_agent: "sdd-apply"
priority: critical
depends_on: []
change_ref: "[[app-detection-logos-audio]]"
worktree: "/home/larayap/cronometro-app/.sdd/worktrees/app-detection-logos-audio"
feature_branch: "feature/app-detection-logos-audio"
commits: ["5bf6ade055a94a85c8185b3db5714e6b0154837c", "8052ec0536337479fbad91a5314581f0b7a06a54", "56a850a513f49fae29b4aeb6d299b966c74e4c50", "e431617485ea2f51a4d7930252128acbd384f00b", "c865b2d2efb0fd58ffab3f91ffe39b17460213f8", "5145ec9ad72f17e812421293af57b08456dd8416"]
mr: ""
acceptance_criteria:
  - "Poner el foco en un programa fuera de la selección guardada no crea una fila nueva"
  - "Poner el foco en un programa fuera de la selección guardada no genera ninguna línea en el historial"
  - "Abrir el proceso de un programa fuera de la selección guardada no produce ningún efecto observable en el listado"
related: ["[[installed-apps-listing-quality]]"]
affects: ["[[row-lifecycle]]"]
adrs: ["[[0001-two-signal-monitoring-engine]]"]
scope: ["src/background.js"]
verified_at: "2026-08-01"
created: "2026-08-01"
updated: "2026-08-01"
tags: [capability-spec]
---

# Solo se monitorea la selección guardada del usuario

## Purpose

La app no debe convertirse en un rastreador general de actividad: solo tiene que prestar
atención a los programas que el usuario decidió explícitamente monitorear. Esta restricción
es transversal a todo el motor de detección y evita que cualquier programa que gane el foco
o abra su proceso, sin haber sido elegido por el usuario, produzca efectos en el listado, en
el conteo o en el historial.

## Requirements

- El sistema SHALL limitar toda detección de foco y de apertura o cierre de proceso
  exclusivamente a los programas presentes en la selección guardada del usuario.
- El sistema SHALL NOT crear una fila en el listado visible para un programa que no está en
  la selección guardada, sin importar si ese programa tiene el foco o su proceso está en
  ejecución.
- El sistema SHALL NOT registrar ninguna sesión ni línea en el historial para un programa
  que no está en la selección guardada.
- El sistema SHALL ignorar por completo los cambios de foco y de estado de proceso de
  cualquier programa ajeno a la selección guardada, sin dejar rastro observable de esa
  actividad.

## Scenarios

### Scenario: El foco pasa a un programa no monitoreado

**GIVEN** un programa que el usuario nunca agregó a su selección
**WHEN** ese programa gana el foco
**THEN** no aparece ninguna fila nueva en el listado visible ni se registra ninguna
actividad

### Scenario: Se abre el proceso de un programa no monitoreado

**GIVEN** un programa que no está en la selección guardada del usuario
**WHEN** el usuario abre ese programa
**THEN** el listado visible no cambia y no se genera ninguna línea en el historial

### Scenario: Los programas monitoreados siguen funcionando con normalidad

**GIVEN** un programa que sí está en la selección guardada
**WHEN** ese programa gana el foco o abre su proceso
**THEN** el listado visible y el historial reaccionan según las reglas de ciclo de vida y
estado de la fila

## Acceptance Criteria

- [x] Poner el foco en un programa fuera de la selección guardada no crea una fila nueva en
  el listado visible.
- [x] Poner el foco en un programa fuera de la selección guardada no genera ninguna línea en
  el historial.
- [x] Abrir el proceso de un programa fuera de la selección guardada no produce ningún
  efecto observable en el listado ni en el conteo.
- [x] Los programas presentes en la selección guardada siguen comportándose según el resto
  de las reglas del motor de monitoreo, sin verse afectados por esta restricción.

## Related

- [[row-lifecycle]] — esta restricción acota qué programas pueden llegar a generar una fila
  mediante ese ciclo de vida
- [[installed-apps-listing-quality]] — es una de las vías por las que un programa entra a la
  selección guardada que esta restricción protege
