---
type: capability-spec
title: "Un único camino de build y una única configuración de estilo de código"
capability: "build-toolchain"
slug: "single-build-and-lint-pipeline"
domain: "debt"
delta_type: null
supersedes: null
superseded_by: null
status: completed
assigned_agent: "sdd-apply"
priority: medium
depends_on: []
change_ref: "[[open-source-readiness]]"
worktree: "/home/larayap/cronometro-app/.sdd/worktrees/open-source-readiness"
feature_branch: "feature/open-source-readiness"
commits: ["319d1f3"]
mr: "https://github.com/larayap/cronometro-app/pull/5"
acceptance_criteria:
  - "Existe un único sistema de build capaz de producir el instalador, sin un segundo sistema inactivo declarado en el proyecto"
  - "La verificación de estilo de código aplica el mismo conjunto de reglas en cualquier entorno donde se ejecute"
  - "Toda dependencia de terceros declarada tiene al menos un uso real en el código"
  - "Todo recurso gráfico versionado tiene al menos una referencia real desde el código"
  - "El área de trabajo temporal de las herramientas internas del equipo no queda rastreada por el control de versiones"
related: ["[[unified-product-identity]]", "[[pr-lint-and-tagged-release-workflow]]", "[[community-contribution-documents]]"]
affects: ["[[pr-lint-and-tagged-release-workflow]]"]
adrs: ["[[0004-os-dependent-code-single-module]]"]
scope: ["package.json", "forge.config.js", ".eslintrc.js", "src/assets/", ".gitignore"]
verified_at: "2026-08-06"
created: "2026-08-06"
updated: "2026-08-06"
tags: [capability-spec]
---

<!-- sdd-apply (2026-08-06): 3 de 5 acceptance criteria verificados. Los otros 2
("toda dependencia declarada tiene uso real" / "todo recurso gráfico versionado
tiene referencia real") se auditaron solo para los items que Task 3.3/3.5
identificaron explícitamente (2 dependencias, 6 PNG); no se hizo una auditoría
exhaustiva de las ~35 dependencias ni de todos los recursos gráficos del
repositorio (p. ej. public/*.png, public/*.ico), que excede el scope declarado
de esas tareas. Quedan sin marcar a propósito. -->

# Un único camino de build y una única configuración de estilo de código

## Purpose

Un colaborador que clona el proyecto encuentra un único camino para compilar la aplicación
distribuible y un único conjunto de reglas de estilo de código, sin sistemas ni
configuraciones alternativas que compitan entre sí o que produzcan resultados distintos
según cuál se use. El proyecto solo declara las dependencias y los recursos que su código
efectivamente usa.

## Requirements

- El sistema SHALL exponer un único sistema de build capaz de producir el instalador
  distribuible de la aplicación.
- El sistema SHALL NOT declarar un segundo sistema de build inactivo que pueda confundir a
  un colaborador sobre cuál es el camino real.
- El sistema SHALL aplicar un único conjunto de reglas de estilo de código, de forma que
  ejecutarlo en cualquier entorno produzca el mismo resultado.
- El sistema SHALL NOT declarar dependencias de terceros que el código no usa.
- El sistema SHALL NOT conservar recursos gráficos sin ninguna referencia desde el código.
- El sistema SHALL NOT versionar el área de trabajo temporal que las herramientas internas
  del equipo generan durante el desarrollo.

## Scenarios

### Scenario: Un colaborador busca cómo compilar el instalador

**GIVEN** un colaborador que clona el repositorio por primera vez
**WHEN** busca cómo generar el instalador de la aplicación
**THEN** encuentra un único sistema de build documentado, sin alternativas que compitan
entre sí

### Scenario: El estilo de código es el mismo en cualquier entorno

**GIVEN** un desarrollador que ejecuta la verificación de estilo de código en su equipo
**WHEN** esa misma verificación corre en integración continua
**THEN** ambas ejecuciones aplican exactamente las mismas reglas y llegan al mismo resultado

### Scenario: Las dependencias declaradas reflejan lo que el código usa

**GIVEN** alguien revisa la lista de dependencias de terceros del proyecto
**WHEN** la compara contra el código que las usa
**THEN** cada dependencia declarada tiene al menos un uso real en el código

### Scenario: Los recursos gráficos versionados están todos en uso

**GIVEN** alguien revisa los recursos gráficos versionados en el proyecto
**WHEN** los compara contra las referencias del código
**THEN** cada recurso gráfico versionado tiene al menos una referencia real

### Scenario: El área de trabajo temporal no viaja con el repositorio

**GIVEN** un colaborador que clona el repositorio
**WHEN** revisa lo que el control de versiones rastrea
**THEN** no encuentra el área de trabajo temporal que las herramientas internas del equipo
generan durante el desarrollo

## Acceptance Criteria

- [x] Existe un único sistema de build capaz de producir el instalador, sin un segundo
  sistema inactivo declarado en el proyecto.
- [x] La verificación de estilo de código aplica el mismo conjunto de reglas en cualquier
  entorno donde se ejecute.
- [ ] Toda dependencia de terceros declarada tiene al menos un uso real en el código.
  (verificado solo para @shopify/draggable y electron-squirrel-startup, las dos que Task
  3.3 identificó sin referencias; sin auditoría exhaustiva del resto)
- [ ] Todo recurso gráfico versionado tiene al menos una referencia real desde el código.
  (verificado solo para src/assets/*.png; sin auditoría de otros recursos gráficos del
  repositorio)
- [x] El área de trabajo temporal de las herramientas internas del equipo no queda
  rastreada por el control de versiones.

## Related

- [[unified-product-identity]] — el sistema de build único es el que produce el instalador
  con la identidad unificada
- [[pr-lint-and-tagged-release-workflow]] — el flujo de integración continua ejecuta este
  camino de build y esta configuración de estilo de código
- [[community-contribution-documents]] — el documento de contribución describe este camino
  de build como el único válido
