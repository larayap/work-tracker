---
type: capability-spec
title: "Identidad unificada del producto bajo el nombre Work Tracker"
capability: "project-identity"
slug: "unified-product-identity"
domain: "debt"
delta_type: null
supersedes: null
superseded_by: null
status: completed
assigned_agent: "sdd-apply"
priority: high
depends_on: []
change_ref: "[[open-source-readiness]]"
worktree: "/home/larayap/cronometro-app/.sdd/worktrees/open-source-readiness"
feature_branch: "feature/open-source-readiness"
commits: ["69e698b"]
mr: "https://github.com/larayap/cronometro-app/pull/5"
acceptance_criteria:
  - "El instalador, el acceso directo instalado y el título de la ventana muestran el mismo nombre de producto"
  - "El dato de autoría del paquete distribuible coincide con el titular declarado en la licencia"
  - "La versión declarada corresponde a una release publicada bajo la convención de etiquetado vigente"
  - "El nombre del repositorio de origen es reconocible a partir del nombre del producto"
  - "Ningún identificador público del producto conserva un marcador de plantilla o un nombre previo"
related: ["[[legacy-userdata-one-shot-migration]]", "[[pr-lint-and-tagged-release-workflow]]"]
affects: ["[[legacy-userdata-one-shot-migration]]", "[[pr-lint-and-tagged-release-workflow]]", "[[community-contribution-documents]]"]
adrs: []
scope: ["package.json", "vue.config.js"]
verified_at: "2026-08-06"
created: "2026-08-06"
updated: "2026-08-06"
tags: [capability-spec]
---

<!-- sdd-apply (2026-08-06): 3 de 5 acceptance criteria verificados a nivel local
(grep/node -e). Los otros 2 dependen del instalador real (compilación en
windows-latest y una release efectivamente publicada) — nivel 2/3 de D-13,
diferido a sdd-verify. -->

# Identidad unificada del producto bajo el nombre Work Tracker

## Purpose

El producto se presenta con un nombre, una versión y una autoría coherentes en todo lugar
donde una persona los ve: el instalador que descarga, el acceso directo que queda en su
equipo, la ventana de la aplicación, el paquete que un desarrollador arma desde el código
fuente y la página de licencia. Esa identidad única es la que un usuario reconoce, la que un
buscador indexa y la que un colaborador cita al abrir un issue o una contribución.

## Requirements

- El sistema SHALL presentarse con un mismo nombre de producto en el instalador, en el
  acceso directo instalado, en la ventana de la aplicación y en el paquete distribuible.
- El sistema SHALL declarar una única identidad de autoría, consistente entre el paquete
  distribuible y el texto de la licencia.
- El sistema SHALL declarar una versión semántica única que identifica cada release
  publicada.
- El sistema SHALL usar una convención de etiquetado de versión consistente para toda
  release futura.
- El sistema SHALL declarar el repositorio de origen del proyecto de forma consistente con
  el nombre público del producto.
- El sistema SHALL NOT conservar en su identidad pública ningún rastro del nombre o
  marcador de plantilla previos.

## Scenarios

### Scenario: El instalador y el acceso directo llevan el nombre del producto

**GIVEN** una persona descarga el instalador publicado
**WHEN** lo ejecuta e instala la aplicación
**THEN** el instalador, el acceso directo creado y la ventana de la aplicación muestran el
mismo nombre de producto

### Scenario: La autoría es consistente entre el paquete y la licencia

**GIVEN** alguien revisa quién mantiene el proyecto
**WHEN** compara el dato de autoría del paquete distribuible con el titular declarado en la
licencia
**THEN** encuentra la misma identidad en ambos lugares

### Scenario: La versión identifica de forma única cada release

**GIVEN** el proyecto publica una nueva versión
**WHEN** alguien la instala
**THEN** la versión que ve declarada en la aplicación corresponde a una única release
publicada, sin ambigüedad con versiones anteriores

### Scenario: El repositorio de origen es reconocible desde el nombre del producto

**GIVEN** un desarrollador quiere obtener el código fuente del proyecto
**WHEN** busca el repositorio a partir del nombre del producto
**THEN** el nombre del repositorio de origen es consistente con ese nombre

## Acceptance Criteria

- [ ] El instalador, el acceso directo instalado y el título de la ventana muestran el
  mismo nombre de producto. (título de ventana verificado; instalador y acceso directo
  requieren compilar en Windows — nivel 2/3)
- [x] El dato de autoría del paquete distribuible coincide con el titular declarado en la
  licencia.
- [ ] La versión declarada corresponde a una release publicada bajo la convención de
  etiquetado vigente. (versión y convención declaradas; la release publicada aún no existe)
- [x] El nombre del repositorio de origen es reconocible a partir del nombre del producto.
- [x] Ningún identificador público del producto conserva un marcador de plantilla o un
  nombre previo.

## Related

- [[legacy-userdata-one-shot-migration]] — el cambio de identidad de paquete es la causa
  que dispara la migración de datos
- [[pr-lint-and-tagged-release-workflow]] — la versión declarada aquí es la que el flujo de
  release valida contra la etiqueta publicada
- [[community-contribution-documents]] — la documentación pública se redacta con este
  nombre y esta versión
