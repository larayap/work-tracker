---
type: capability-spec
title: "Verificación automática en cada contribución y publicación de release por etiqueta"
capability: "release-automation"
slug: "pr-lint-and-tagged-release-workflow"
domain: "debt"
delta_type: null
supersedes: null
superseded_by: null
status: review
assigned_agent: "sdd-apply"
priority: high
depends_on: ["[[unified-product-identity]]", "[[single-build-and-lint-pipeline]]"]
change_ref: "[[open-source-readiness]]"
worktree: "/home/larayap/cronometro-app/.sdd/worktrees/open-source-readiness"
feature_branch: "feature/open-source-readiness"
commits: ["81e7fbf"]
mr: ""
acceptance_criteria:
  - "Toda contribución de código recibe una verificación automática de estilo, visible antes de revisarla"
  - "Publicar una etiqueta de versión que coincide con la versión declarada produce un instalador disponible en Releases"
  - "Publicar una etiqueta que no coincide con la versión declarada no produce ninguna release"
related: ["[[unified-product-identity]]", "[[single-build-and-lint-pipeline]]"]
affects: []
adrs: ["[[0004-os-dependent-code-single-module]]"]
scope: [".github/workflows/lint.yml", ".github/workflows/release.yml", "package.json"]
verified_at: "2026-08-06"
created: "2026-08-06"
updated: "2026-08-06"
tags: [capability-spec]
---

<!-- sdd-apply (2026-08-06): ninguna de las 3 acceptance criteria se marca todavía.
Las tres exigen la ejecución real de GitHub Actions (nivel 3 de D-13, no
alcanzable en WSL2): lint.yml y release.yml se validaron como YAML y sus
comandos constitutivos se verificaron localmente por separado (npm ci + npm
run lint -- --no-fix con exit 0; la guarda tag<->versión con node -e para los
casos de match y mismatch), pero ningún PR ni tag real disparó los workflows
todavía. Queda para sdd-verify, apoyado en la ejecución real de CI, no en un
build local (state.md §Entorno). -->

# Verificación automática en cada contribución y publicación de release por etiqueta

## Purpose

Cada contribución propuesta recibe una verificación automática de estilo de código antes de
revisarse. Cada nueva versión publicada mediante una etiqueta produce, sin intervención
manual, un instalador descargable en la sección de Releases del repositorio — y esa
publicación solo ocurre cuando la etiqueta coincide con la versión declarada del proyecto.

## Requirements

- El sistema SHALL ejecutar una verificación automática de estilo de código sobre cada
  contribución propuesta, con el resultado visible en la contribución.
- El sistema SHALL producir y publicar un instalador descargable en la sección de Releases
  del repositorio cuando se publica una nueva etiqueta de versión.
- El sistema SHALL NOT publicar una release cuando la etiqueta publicada no coincide con la
  versión declarada del proyecto.
- El sistema SHALL identificar cada release publicada con una convención de etiquetado
  consistente.

## Scenarios

### Scenario: Una contribución recibe verificación automática de estilo

**GIVEN** un colaborador que abre o actualiza una contribución de código
**WHEN** la contribución se sincroniza con el repositorio
**THEN** corre automáticamente una verificación de estilo de código, con el resultado
visible en la contribución antes de revisarla

### Scenario: Publicar una etiqueta de versión válida genera una release

**GIVEN** el mantenedor publica una etiqueta de versión que coincide con la versión
declarada del proyecto
**WHEN** el proceso de publicación termina
**THEN** el instalador queda disponible para descargar en la sección de Releases del
repositorio, identificado con esa versión

### Scenario: Una etiqueta que no coincide con la versión no publica nada

**GIVEN** el mantenedor publica una etiqueta que no coincide con la versión declarada del
proyecto
**WHEN** el proceso de publicación se ejecuta
**THEN** no se genera ninguna release y no queda ningún instalador publicado con esa
etiqueta

## Acceptance Criteria

- [ ] Toda contribución de código recibe una verificación automática de estilo, visible
  antes de revisarla.
- [ ] Publicar una etiqueta de versión que coincide con la versión declarada produce un
  instalador disponible en Releases.
- [ ] Publicar una etiqueta que no coincide con la versión declarada no produce ninguna
  release.

## Related

- [[unified-product-identity]] — la versión declarada aquí es contra la que este flujo
  valida cada etiqueta
- [[single-build-and-lint-pipeline]] — este flujo ejecuta ese camino de build y esa
  configuración de estilo de código en integración continua
