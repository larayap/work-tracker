---
type: capability-spec
title: "Documentos de licencia, presentación y contribución para una comunidad externa"
capability: "open-source-docs"
slug: "community-contribution-documents"
domain: "debt"
delta_type: null
supersedes: null
superseded_by: null
status: completed
assigned_agent: "sdd-apply"
priority: critical
depends_on: []
change_ref: "[[open-source-readiness]]"
worktree: "/home/larayap/cronometro-app/.sdd/worktrees/open-source-readiness"
feature_branch: "feature/open-source-readiness"
commits: ["a692240"]
mr: "https://github.com/larayap/cronometro-app/pull/5"
acceptance_criteria:
  - "Existe un documento de licencia con el texto completo, el titular vigente y el año"
  - "El documento de presentación describe qué hace la aplicación, para quién, el sistema operativo requerido, la instalación desde binario publicado y la compilación desde el código"
  - "El documento de contribución explica el entorno de desarrollo, la convención de mensajes de cambio, la convención de ramas y qué es el directorio de conocimiento del proyecto"
  - "Existe un código de conducta"
  - "Existe una plantilla guiada para reportar un fallo y otra para proponer una función"
  - "Existe una plantilla guiada para describir una contribución de código"
related: ["[[unified-product-identity]]", "[[single-build-and-lint-pipeline]]"]
affects: []
adrs: []
scope: ["README.md", "LICENSE", "CONTRIBUTING.md", "CODE_OF_CONDUCT.md", ".github/ISSUE_TEMPLATE/", ".github/PULL_REQUEST_TEMPLATE.md"]
verified_at: "2026-08-06"
created: "2026-08-06"
updated: "2026-08-06"
tags: [capability-spec]
---

# Documentos de licencia, presentación y contribución para una comunidad externa

## Purpose

Quien llega al repositorio por primera vez —para usarlo, para evaluarlo o para
contribuir— encuentra en la raíz del proyecto los documentos que responden qué es, bajo qué
términos puede usarlo y redistribuirlo, cómo participa, y qué conducta se espera de la
comunidad. Reportar un problema o proponer un cambio sigue una plantilla que guía qué
información aportar.

## Requirements

- El sistema SHALL declarar los términos bajo los cuales cualquier persona puede usar,
  modificar y redistribuir el código, con el titular y el año vigentes.
- El sistema SHALL describir, en un documento de presentación, qué hace la aplicación, para
  quién es, en qué sistema operativo corre, cómo instalarla desde un binario publicado y
  cómo compilarla desde el código fuente.
- El sistema SHALL documentar, para quien quiera contribuir, cómo levantar el entorno de
  desarrollo, la convención de mensajes de cambio y la convención de ramas.
- El sistema SHALL aclarar, en la documentación de contribución, qué es el directorio de
  conocimiento del proyecto para que no se confunda con código de la aplicación.
- El sistema SHALL declarar un código de conducta que establece qué comportamiento se
  espera de quienes participan en el proyecto.
- El sistema SHALL ofrecer una plantilla guiada para reportar un fallo y otra para proponer
  una función nueva.
- El sistema SHALL ofrecer una plantilla guiada para describir un cambio propuesto al abrir
  una contribución.

## Scenarios

### Scenario: Alguien evalúa si puede usar el proyecto

**GIVEN** una persona que descubre el repositorio por primera vez
**WHEN** busca bajo qué condiciones puede usar y redistribuir el código
**THEN** encuentra un documento de licencia con el texto completo, el titular y el año

### Scenario: Alguien busca entender qué hace la aplicación

**GIVEN** una persona que no conoce el proyecto
**WHEN** abre la página principal del repositorio
**THEN** encuentra una descripción de qué hace la aplicación, a quién está dirigida, en qué
sistema operativo corre, y cómo obtenerla — instalando el binario publicado o compilando el
código

### Scenario: Alguien quiere contribuir código

**GIVEN** una persona que quiere aportar un cambio al proyecto
**WHEN** busca cómo empezar
**THEN** encuentra instrucciones para levantar el entorno de desarrollo, la convención de
mensajes de cambio a seguir y la convención de nombres de rama, junto con una explicación de
qué es el directorio de conocimiento del proyecto

### Scenario: Alguien reporta un fallo

**GIVEN** una persona que encuentra un comportamiento inesperado
**WHEN** abre un nuevo reporte
**THEN** un formulario guiado le pide la información necesaria para describir y reproducir
el fallo

### Scenario: Alguien propone una función nueva

**GIVEN** una persona con una idea de mejora
**WHEN** abre una nueva solicitud
**THEN** un formulario guiado le pide describir la función propuesta y el problema que
resuelve

### Scenario: Alguien abre una contribución de código

**GIVEN** una persona que envía un cambio al proyecto
**WHEN** abre la contribución
**THEN** una plantilla guía qué describir sobre el cambio antes de que se revise

## Acceptance Criteria

- [x] Existe un documento de licencia con el texto completo, el titular vigente y el año.
- [x] El documento de presentación describe qué hace la aplicación, para quién, el sistema
  operativo requerido, la instalación desde binario publicado y la compilación desde el
  código.
- [x] El documento de contribución explica el entorno de desarrollo, la convención de
  mensajes de cambio, la convención de ramas y qué es el directorio de conocimiento del
  proyecto.
- [x] Existe un código de conducta.
- [x] Existe una plantilla guiada para reportar un fallo y otra para proponer una función.
- [x] Existe una plantilla guiada para describir una contribución de código.

## Related

- [[unified-product-identity]] — el nombre de producto que el documento de presentación
  describe
- [[single-build-and-lint-pipeline]] — el camino de build que el documento de contribución
  describe
