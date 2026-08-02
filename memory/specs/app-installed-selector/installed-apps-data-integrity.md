---
type: capability-spec
title: "Integridad de datos del listado de instaladas: solo ejecutables reales, sin duplicados, con nombres correctos"
capability: "app-installed-selector"
slug: "installed-apps-data-integrity"
domain: "feature"
delta_type: modified
supersedes: "[[installed-apps-listing-quality]]"
superseded_by: null
status: review
assigned_agent: "sdd-apply"
priority: high
depends_on: []
change_ref: "[[sessions-groups-history]]"
worktree: "/home/larayap/cronometro-app/.sdd/worktrees/sessions-groups-history"
feature_branch: "feature/sessions-groups-history"
commits: ["0ac96e3b5b71dea749db71a442a94e4d2a012c93"]
mr: ""
acceptance_criteria:
  - "Con Discord y Clip Studio instalados, ambos aparecen en el listado de instaladas"
  - "Ninguna entrada del listado corresponde a un runtime, actualizador, redistribuible o servicio de fondo, ni a un archivo que no sea un ejecutable real"
  - "Ningún programa aparece más de una vez en el listado"
  - "Ningún nombre del listado muestra caracteres corruptos en lugar de tildes o eñes"
  - "El usuario puede filtrar el listado por texto"
  - "El usuario puede elegir un programa desde el listado de procesos abiertos como vía alternativa"
related: ["[[saved-selection-only-monitoring]]", "[[row-lifecycle-persistence-by-type]]"]
affects: ["[[selector-listing-icons]]", "[[deselect-from-saved-selection]]"]
adrs: ["[[0003-start-menu-installed-apps-enumeration]]", "[[0004-os-dependent-code-single-module]]"]
scope: ["src/main/installed-apps.js", "src/main/installed-apps-filter.js", "src/main/platform-windows.js"]
verified_at: null
created: "2026-08-02"
updated: "2026-08-02"
tags: [capability-spec]
---

<!-- sdd-apply (2026-08-02): implementación completa vía commit 0ac96e3. Único AC no
verificable en este entorno: Clip Studio Paint no está instalado en la máquina real. -->

# Integridad de datos del listado de instaladas: solo ejecutables reales, sin duplicados, con nombres correctos

## Purpose

El listado de instaladas ya excluye la maquinaria interna del sistema, pero tres defectos de
calidad de datos siguen colándose: entradas que no son programas ejecutables (un archivo de
ayuda, unas notas de versión), el mismo programa listado más de una vez, y nombres con
tildes o eñes que aparecen corruptos porque el puente con Windows los decodifica mal. Esta
spec cierra esas tres fugas y además hace que la caché en disco del listado se reconstruya
sola cuando cambia de forma, en vez de quedar servida vieja o corrupta hasta que alguien la
borre a mano.

## Requirements

- El sistema SHALL mostrar en el listado de instaladas únicamente aplicaciones que un
  usuario reconoce como programas de escritorio que abre intencionalmente.
- El sistema SHALL NOT mostrar en el listado entradas correspondientes a runtimes,
  actualizadores, instaladores, componentes redistribuibles o servicios de fondo.
- El sistema SHALL descartar del listado cualquier entrada cuyo destino no sea un archivo
  ejecutable real existente en el equipo, incluyendo documentos, páginas de ayuda o notas de
  versión que hoy pasan el filtro por error.
- El sistema SHALL descartar del listado las herramientas del sistema operativo, aunque
  tengan un acceso directo visible en el menú de programas del sistema.
- El sistema SHALL mostrar el nombre legible de cada programa tal como el propio programa
  lo presenta al usuario, no un identificador técnico interno.
- El sistema SHALL mostrar cada programa instalado una única vez en el listado, incluso
  cuando el sistema expone más de un acceso directo apuntando al mismo programa.
- El sistema SHALL mostrar el nombre de cada programa con sus caracteres correctos,
  incluidas tildes y eñes, sin símbolos corruptos.
- El sistema SHALL permitir al usuario filtrar el listado escribiendo texto.
- El sistema SHALL ofrecer, como vía alternativa dentro del mismo selector, la posibilidad
  de elegir un programa desde el listado de procesos actualmente abiertos.
- El sistema SHALL detectar cuando la caché en disco del listado de instaladas fue generada
  por una versión anterior e incompatible del sistema, y reconstruirla automáticamente antes
  de mostrar resultados, en vez de servir datos desactualizados o corruptos.
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

### Scenario: Una entrada de ayuda o documentación no aparece en el listado

**GIVEN** un programa que instaló también un archivo de ayuda o unas notas de versión que no
son un programa ejecutable
**WHEN** el usuario abre el selector de aplicaciones instaladas
**THEN** ese archivo no aparece entre las entradas del listado

### Scenario: Un programa con instalación duplicada aparece una sola vez

**GIVEN** un programa cuya instalación generó más de un acceso directo apuntando al mismo
ejecutable
**WHEN** el usuario abre el selector de aplicaciones instaladas
**THEN** el programa aparece una única vez en el listado

### Scenario: Un programa con tilde o eñe en el nombre se muestra correctamente

**GIVEN** un programa cuyo nombre incluye tildes o la letra eñe
**WHEN** el usuario abre el selector de aplicaciones instaladas
**THEN** el nombre se muestra con sus caracteres correctos, sin símbolos corruptos

### Scenario: El usuario filtra el listado por texto

**GIVEN** el selector de aplicaciones instaladas abierto con varias decenas de entradas
**WHEN** el usuario escribe parte del nombre de un programa
**THEN** el listado se acota a las entradas que coinciden con ese texto

### Scenario: El usuario elige desde procesos abiertos como alternativa

**GIVEN** un programa portable que no dejó acceso directo reconocible en el sistema
**WHEN** el usuario lo abre y consulta el listado de procesos abiertos dentro del mismo
selector
**THEN** puede elegirlo desde ahí y agregarlo a su selección guardada

### Scenario: La caché desactualizada se reconstruye sola

**GIVEN** una caché en disco del listado de instaladas generada por una versión anterior del
sistema
**WHEN** el usuario abre el selector de aplicaciones instaladas
**THEN** el sistema descarta esa caché y reconstruye el listado antes de mostrarlo, sin
intervención del usuario

## Acceptance Criteria

- [ ] Con Discord y Clip Studio instalados, ambos aparecen en el listado de aplicaciones
  instaladas. Sin marcar: el entorno real solo tiene Discord instalado ("Discord" aparece en
  el listado filtrado real, ver commit 0ac96e3); Clip Studio Paint no está instalado en este
  equipo y no se pudo verificar.
- [x] Una revisión completa del listado no encuentra ninguna entrada de categoría runtime,
  redistribuible, actualizador, servicio de fondo, ni ningún destino que no sea un
  ejecutable real.
- [x] Ningún programa instalado aparece más de una vez en el listado.
- [x] Ningún nombre del listado muestra un carácter corrupto en lugar de una tilde o una
  eñe.
- [x] El usuario puede acotar el listado escribiendo texto de búsqueda. (comportamiento
  preexistente, verificado por lectura de `AppSelectorModal.vue`, sin cambios de este
  cambio)
- [x] El usuario puede elegir un programa desde el listado de procesos abiertos como vía
  alternativa dentro del mismo selector. (comportamiento preexistente, verificado por
  lectura, sin cambios de este cambio)
- [x] Una caché en disco generada por una versión anterior se reconstruye automáticamente
  antes de mostrar el listado.

## Related

- [[saved-selection-only-monitoring]] — los programas elegidos desde este selector pasan a
  formar parte de la selección guardada que esa restricción protege
- [[row-lifecycle-persistence-by-type]] — elegir un programa desde este selector es una de
  las vías que dispara la entrada de una fila al listado visible
- [[selector-listing-icons]] — se apoya en un listado ya libre de duplicados y de entradas
  corruptas para mostrar el ícono correcto junto a cada nombre
- [[deselect-from-saved-selection]] — usa este mismo selector como punto de entrada para
  sacar un programa de la selección guardada
