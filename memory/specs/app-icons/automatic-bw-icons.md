---
type: capability-spec
title: "Íconos automáticos en blanco y negro por programa"
capability: "app-icons"
slug: "automatic-bw-icons"
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
commits: ["3ab7b95c98bf0e718bf875b8e42f178ad2d04e66", "461ae651702402036ac1cd6eb50cdd68db556d56", "e1404f54e81d9020ee73706b1bbebed7a15e3e27", "dc5d5d2", "cdaf80b", "fa12e68"]
mr: ""
acceptance_criteria:
  - "Toda fila del listado muestra el ícono del programa correspondiente en escala de grises"
  - "Ningún ícono se carga manualmente ni depende de que el nombre del programa coincida con un archivo del proyecto"
  - "Un programa sin ícono útil muestra la imagen de respaldo en vez de un espacio en blanco o roto"
related: []
affects: []
adrs: ["[[0005-native-icon-extraction-css-grayscale]]"]
scope: ["src/background.js", "src/components/CronometroAplicacion.vue", "src/assets"]
verified_at: "2026-08-01"
created: "2026-08-01"
updated: "2026-08-01"
tags: [capability-spec]
---

# Íconos automáticos en blanco y negro por programa

## Purpose

Hoy el ícono de cada programa monitoreado depende de que alguien haya cargado a mano una
imagen con el nombre exacto del proceso. Esta spec reemplaza ese mantenimiento manual por
extracción automática del ícono real del programa, mostrado siempre en blanco y negro para
mantener el mismo tratamiento visual uniforme sin importar el programa.

## Requirements

- El sistema SHALL obtener el ícono de cada programa monitoreado automáticamente a partir
  de su propio ejecutable, sin depender de imágenes cargadas manualmente por nombre.
- El sistema SHALL mostrar el ícono de cada fila en escala de grises, de forma uniforme
  para todos los programas.
- El sistema SHALL mostrar una imagen de respaldo cuando la extracción automática no
  entrega un ícono útil para un programa.
- El sistema SHOULD evitar repetir la extracción del ícono de un mismo programa en
  aperturas sucesivas cuando ya se obtuvo antes.

## Scenarios

### Scenario: Un programa nuevo muestra su ícono real en gris

**GIVEN** el usuario agrega un programa que nunca fue monitoreado antes
**WHEN** su fila aparece en el listado visible
**THEN** se muestra el ícono real de ese programa, renderizado en blanco y negro

### Scenario: Un programa sin ícono extraíble usa la imagen de respaldo

**GIVEN** un programa cuyo ejecutable no entrega un ícono útil
**WHEN** su fila aparece en el listado visible
**THEN** se muestra la imagen de respaldo en lugar de un espacio vacío o roto

### Scenario: Ningún ícono depende de un archivo cargado a mano

**GIVEN** cualquier programa que el usuario agregue al listado
**WHEN** se muestra su fila
**THEN** el ícono se obtiene automáticamente, sin requerir que exista una imagen
precargada con el nombre exacto de ese programa

## Acceptance Criteria

- [x] Toda fila del listado muestra el ícono del programa correspondiente, renderizado en
  escala de grises.
- [x] Ningún ícono depende de una imagen cargada manualmente con el nombre exacto del
  programa.
- [x] Un programa sin ícono útil muestra la imagen de respaldo en vez de un espacio en
  blanco o roto.

## Related

- [[row-lifecycle]] — cada fila que entra al listado visible trae consigo el ícono de su
  programa
