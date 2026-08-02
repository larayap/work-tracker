---
type: capability-spec
title: "Estado vacío del listado: 00:00:00 y el agregar"
capability: "app-monitoring"
slug: "empty-state"
domain: "feature"
delta_type: added
supersedes: null
superseded_by: null
status: review
assigned_agent: "sdd-apply"
priority: medium
depends_on: ["[[row-lifecycle]]"]
change_ref: "[[app-detection-logos-audio]]"
worktree: "/home/larayap/cronometro-app/.sdd/worktrees/app-detection-logos-audio"
feature_branch: "feature/app-detection-logos-audio"
commits: ["d6b1e5959ebad10d76f26703de8737830bffe9de", "0930d53cf6387371c3b88fa28757fb3ecdca0c39", "144e28b73af4db08eb9d064980915e0612777b27", "5910a25d20fe79fa34812ec26903810d4b5152da"]
mr: ""
acceptance_criteria:
  - "Al detener la última fila visible, el widget muestra 00:00:00 y el control de agregar, sin filas"
  - "Al cerrarse el proceso de la última fila visible, el widget queda en el mismo estado vacío que al detenerla"
  - "El estado vacío no muestra ningún mensaje ni ilustración adicional"
  - "Agregar un programa desde el estado vacío vuelve a mostrar una fila con normalidad"
related: []
affects: []
adrs: []
scope: ["src/components/CronometroAplicacion.vue"]
verified_at: "2026-08-01"
created: "2026-08-01"
updated: "2026-08-01"
tags: [capability-spec]
---

# Estado vacío del listado: 00:00:00 y el agregar

## Purpose

Cuando la última fila sale del listado visible —porque el usuario la detiene o porque se
cierra su proceso, los dos eventos tienen el mismo efecto sobre la existencia de la fila—,
el widget necesita un estado de reposo claro en vez de quedar en blanco o mostrar un mensaje
que no aporta. Este estado vacío es exactamente el mismo reposo que la aplicación ya
muestra hoy al arrancar sin ningún programa monitoreado.

## Requirements

- El sistema SHALL mostrar el widget en su estado de reposo —reloj en `00:00:00` y el
  control de agregar disponible— cuando el listado visible no tiene ninguna fila, sin
  importar si la última fila salió porque el usuario la detuvo o porque se cerró su proceso.
- El sistema SHALL NOT mostrar ningún mensaje ni ilustración adicional en el estado vacío.
- El sistema SHALL volver a mostrar el listado con normalidad en cuanto el usuario agrega
  un programa desde el estado vacío.

## Scenarios

### Scenario: Detener la última fila deja el widget en reposo

**GIVEN** un listado visible con una única fila
**WHEN** el usuario detiene esa fila
**THEN** el widget queda mostrando `00:00:00` y el control de agregar, sin ninguna fila
visible

### Scenario: Cerrar el proceso de la última fila también deja el widget en reposo

**GIVEN** un listado visible con una única fila
**WHEN** el usuario cierra el proceso de ese programa
**THEN** el widget queda en el mismo estado de reposo que si el usuario hubiera detenido la
fila: `00:00:00` y el control de agregar, sin ninguna fila visible

### Scenario: Agregar un programa desde el estado vacío

**GIVEN** el widget en su estado de reposo, sin filas
**WHEN** el usuario agrega un programa
**THEN** aparece una fila para ese programa y el widget deja el estado vacío

## Acceptance Criteria

- [x] Al detener la última fila visible, el widget muestra `00:00:00` y el control de
  agregar, sin filas.
- [x] Al cerrarse el proceso de la última fila visible, el widget queda en el mismo estado
  vacío que al detenerla.
- [x] El estado vacío no muestra ningún mensaje ni ilustración adicional distinta del
  reposo actual de la aplicación.
- [x] Agregar un programa desde el estado vacío vuelve a mostrar una fila con normalidad.

## Related

- [[row-lifecycle]] — el estado vacío es la consecuencia directa de que la última fila
  salga del listado visible según ese ciclo de vida
