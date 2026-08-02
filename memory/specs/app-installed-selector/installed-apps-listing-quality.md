---
type: capability-spec
title: "Calidad del listado de aplicaciones instaladas: solo apps de usuario reales"
capability: "app-installed-selector"
slug: "installed-apps-listing-quality"
domain: "feature"
delta_type: null
supersedes: null
superseded_by: "[[installed-apps-data-integrity]]"
status: completed
assigned_agent: "sdd-apply"
priority: critical
depends_on: []
change_ref: "[[app-detection-logos-audio]]"
worktree: "/home/larayap/cronometro-app/.sdd/worktrees/app-detection-logos-audio"
feature_branch: "feature/app-detection-logos-audio"
commits: ["070e6ad32b77a0664891a22e0f84f77eee6c66ae", "2beeebc7a22af0392b7b229b06332e2f08ac2800", "9e66aa08880b7174c2170aac13d651d1e3deaf6b", "b27f747952bc5bc88787ae900a77d29487c6595d", "2171b964c8e7d3ac0fd935c4ca71921169ea06e7", "861d26cd5501dc5a7008cb97a2a1f0633a527e7c"]
mr: "https://github.com/larayap/cronometro-app/pull/2"
acceptance_criteria:
  - "Con Discord y Clip Studio instalados, ambos aparecen en el listado de instaladas"
  - "Ninguna entrada del listado corresponde a un runtime, actualizador, redistribuible o servicio de fondo"
  - "El usuario puede filtrar el listado por texto"
  - "El usuario puede elegir un programa desde el listado de procesos abiertos como vía alternativa"
related: ["[[saved-selection-only-monitoring]]", "[[row-lifecycle]]"]
affects: []
adrs: ["[[0003-start-menu-installed-apps-enumeration]]", "[[0004-os-dependent-code-single-module]]"]
scope: ["src/background.js", "src/components/CronometroAplicacion.vue"]
verified_at: "2026-08-01"
created: "2026-08-01"
updated: "2026-08-02"
tags: [capability-spec]
---

# Calidad del listado de aplicaciones instaladas: solo apps de usuario reales

## Purpose

El selector de aplicaciones instaladas solo cumple su propósito si separa con claridad las
aplicaciones que un usuario reconoce y elige abrir de la maquinaria interna del sistema
—runtimes, actualizadores, redistribuibles, servicios de fondo—. Un listado que mezcle
ambas cosas obliga al usuario a bucear entre ruido para encontrar lo que busca, y esta spec
lo trata como criterio de aceptación, no como una mejora deseable.

## Requirements

- El sistema SHALL mostrar en el listado de instaladas únicamente aplicaciones que un
  usuario reconoce como programas de escritorio que abre intencionalmente.
- El sistema SHALL NOT mostrar en el listado entradas correspondientes a runtimes,
  actualizadores, instaladores, componentes redistribuibles o servicios de fondo.
- El sistema SHALL descartar del listado cualquier entrada cuyo ejecutable no pueda
  resolverse a un archivo existente en el equipo.
- El sistema SHALL descartar del listado las herramientas del sistema operativo, aunque
  tengan un acceso directo visible en el menú de programas del sistema.
- El sistema SHALL mostrar el nombre legible de cada programa tal como el propio programa
  lo presenta al usuario, no un identificador técnico interno.
- El sistema SHALL permitir al usuario filtrar el listado escribiendo texto.
- El sistema SHALL ofrecer, como vía alternativa dentro del mismo selector, la posibilidad
  de elegir un programa desde el listado de procesos actualmente abiertos.
- El sistema SHOULD priorizar dejar fuera una aplicación de usuario legítima antes que
  incluir una entrada de sistema, cuando la clasificación sea ambigua.

## Scenarios

### Scenario: Discord y Clip Studio aparecen en el listado

**GIVEN** un equipo con Discord y Clip Studio Paint instalados
**WHEN** el usuario abre el selector de aplicaciones instaladas
**THEN** ambos programas aparecen en el listado con su nombre legible

### Scenario: Un actualizador no aparece en el listado

**GIVEN** un equipo con un actualizador de software instalado junto a aplicaciones de
usuario
**WHEN** el usuario abre el selector de aplicaciones instaladas
**THEN** el actualizador no figura entre las entradas del listado

### Scenario: Un componente redistribuible del sistema no aparece

**GIVEN** un equipo con componentes redistribuibles instalados como parte de otros
programas
**WHEN** el usuario abre el selector de aplicaciones instaladas
**THEN** esos componentes no figuran entre las entradas del listado

### Scenario: El usuario filtra el listado por texto

**GIVEN** el selector de aplicaciones instaladas abierto con varias decenas de entradas
**WHEN** el usuario escribe parte del nombre de un programa
**THEN** el listado se acota a las entradas que coinciden con ese texto

### Scenario: El usuario elige desde procesos abiertos como alternativa

**GIVEN** un programa portable que no dejó acceso directo reconocible en el sistema
**WHEN** el usuario lo abre y consulta el listado de procesos abiertos dentro del mismo
selector
**THEN** puede elegirlo desde ahí y agregarlo a su selección guardada

## Acceptance Criteria

- [ ] Con Discord y Clip Studio instalados, ambos aparecen en el listado de aplicaciones
  instaladas.
- [ ] Una revisión completa del listado no encuentra ninguna entrada de categoría runtime,
  redistribuible, actualizador o servicio de fondo.
- [x] El usuario puede acotar el listado escribiendo texto de búsqueda.
- [ ] El usuario puede elegir un programa desde el listado de procesos abiertos como vía
  alternativa dentro del mismo selector.

## Related

- [[saved-selection-only-monitoring]] — los programas elegidos desde este selector pasan a
  formar parte de la selección guardada que esa restricción protege
- [[row-lifecycle]] — elegir un programa desde este selector es una de las vías que dispara
  la entrada de una fila al listado visible
