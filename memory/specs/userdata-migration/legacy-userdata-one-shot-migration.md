---
type: capability-spec
title: "Traspaso único de los datos guardados bajo la identidad anterior del producto"
capability: "userdata-migration"
slug: "legacy-userdata-one-shot-migration"
domain: "debt"
delta_type: null
supersedes: null
superseded_by: null
status: completed
assigned_agent: "sdd-apply"
priority: critical
depends_on: ["[[unified-product-identity]]"]
change_ref: "[[open-source-readiness]]"
worktree: "/home/larayap/cronometro-app/.sdd/worktrees/open-source-readiness"
feature_branch: "feature/open-source-readiness"
commits: ["8bb03a7"]
mr: "https://github.com/larayap/cronometro-app/pull/5"
acceptance_criteria:
  - "Un arranque sin instalación anterior no traspasa ningún dato y la aplicación arranca vacía"
  - "Un arranque con datos de una instalación anterior deja disponibles el historial, las preferencias y la selección guardada, con contenido idéntico al original"
  - "Un segundo arranque no altera ni duplica los datos ya traspasados"
  - "Los datos guardados bajo la identidad anterior permanecen sin modificar después del traspaso"
  - "Cuando existen datos distintos bajo ambas identidades, prevalecen los de la identidad nueva sin fusión ni sobrescritura"
  - "Una interrupción a mitad del traspaso no deja datos corruptos ni parciales, y el siguiente arranque completa lo pendiente"
related: ["[[unified-product-identity]]", "[[sessions-json-persistence]]", "[[row-lifecycle-persistence-by-type]]", "[[configurable-time-format-preference]]"]
affects: ["[[sessions-json-persistence]]", "[[row-lifecycle-persistence-by-type]]", "[[configurable-time-format-preference]]"]
adrs: ["[[0006-userdata-json-persistence]]", "[[0007-structured-sessions-json-with-one-shot-migration]]"]
scope: ["src/background.js", "src/main/json-store.js", "src/main/session-log.js"]
verified_at: "2026-08-06"
created: "2026-08-06"
updated: "2026-08-06"
tags: [capability-spec]
---

<!-- sdd-apply (2026-08-06): los 6 escenarios se verificaron con un arnés `node -e`
temporal (ya descartado) sobre directorios reales, ejercitando
migrateUserDataAt() sin Electron — nivel 1 de D-13, lógica pura determinista.
La integración real contra %APPDATA% (nivel 2, máquina Windows) queda para
sdd-verify. -->

# Traspaso único de los datos guardados bajo la identidad anterior del producto

## Purpose

Quien ya usaba la aplicación bajo su identidad anterior conserva su historial de uso, sus
preferencias, su selección guardada de programas y sus cachés al actualizar a la nueva
identidad de producto. La aplicación reconoce esos datos previos en su primer arranque bajo
el nombre nuevo y los pone a disposición sin que la persona tenga que hacer nada, sin perder
ni duplicar información, y sin alterar en ningún momento los datos originales.

## Requirements

- El sistema SHALL poner a disposición, en el primer arranque bajo la identidad nueva del
  producto, cada dato del usuario que existiera bajo la identidad anterior — historial de
  uso, preferencias, selección guardada de programas, sesiones de pomodoro y cachés.
- El sistema SHALL realizar este traspaso de datos como una operación que corre una sola
  vez, sin requerir ninguna acción del usuario.
- El sistema SHALL evaluar la necesidad de traspasar cada dato de forma independiente: la
  ausencia de un dato puntual en la ubicación nueva es lo que decide si ese dato se
  traspasa, nunca la sola existencia previa de la ubicación nueva.
- El sistema SHALL NOT sobrescribir ningún dato que ya exista en la ubicación nueva, incluso
  si el dato correspondiente de la ubicación anterior es distinto.
- El sistema SHALL NOT modificar ni eliminar ningún dato de la ubicación anterior en ningún
  momento del traspaso.
- El sistema SHALL dejar cada dato traspasado completo y utilizable, o sin traspasar, nunca
  a medio escribir: una interrupción durante el traspaso no deja un dato corrupto o parcial
  en la ubicación nueva.
- El sistema SHALL completar en un arranque posterior cualquier dato que haya quedado
  pendiente de traspasar por una interrupción anterior.
- El sistema SHALL arrancar sin historial, preferencias ni selección guardada cuando no
  existe ningún dato previo que traspasar.

## Scenarios

### Scenario: Arranque limpio, sin instalación anterior

**GIVEN** una persona instala la aplicación por primera vez, sin haber usado nunca su
identidad anterior
**WHEN** la abre por primera vez
**THEN** la aplicación arranca sin historial, sin preferencias y sin selección guardada, sin
que se traspase ningún dato

### Scenario: Arranque con datos de una instalación anterior

**GIVEN** una persona que ya usaba la aplicación bajo su identidad anterior, con historial,
preferencias y selección guardada
**WHEN** abre por primera vez la aplicación bajo su identidad nueva
**THEN** encuentra su historial, sus preferencias y su selección guardada disponibles tal
como los dejó, sin ninguna acción de su parte

### Scenario: Segundo arranque no repite el traspaso

**GIVEN** una persona cuyos datos ya se traspasaron en un arranque anterior
**WHEN** vuelve a abrir la aplicación
**THEN** sus datos permanecen exactamente como quedaron tras el primer traspaso, sin
alteración ni duplicación

### Scenario: Los datos de la identidad anterior permanecen intactos

**GIVEN** una persona cuyos datos ya se traspasaron a la identidad nueva
**WHEN** revisa los datos guardados bajo la identidad anterior
**THEN** los encuentra sin cambios, disponibles como respaldo

### Scenario: Datos distintos en ambas identidades

**GIVEN** una persona con datos guardados tanto bajo la identidad anterior como bajo la
identidad nueva, con contenido distinto entre ambos
**WHEN** abre la aplicación bajo la identidad nueva
**THEN** conserva los datos de la identidad nueva sin alteración, sin que se mezclen ni se
sobrescriban con los de la identidad anterior

### Scenario: El traspaso se interrumpe a mitad de camino

**GIVEN** un traspaso de datos que se interrumpe antes de completarse
**WHEN** la persona vuelve a abrir la aplicación
**THEN** el traspaso se retoma y completa lo que faltaba, sin dejar ningún dato a medio
escribir ni duplicar lo que ya se había traspasado

## Acceptance Criteria

- [x] Un arranque sin instalación anterior no traspasa ningún dato y la aplicación arranca
  vacía.
- [x] Un arranque con datos de una instalación anterior deja disponibles el historial, las
  preferencias y la selección guardada, con contenido idéntico al original.
- [x] Un segundo arranque no altera ni duplica los datos ya traspasados.
- [x] Los datos guardados bajo la identidad anterior permanecen sin modificar después del
  traspaso.
- [x] Cuando existen datos distintos bajo ambas identidades, prevalecen los de la identidad
  nueva sin fusión ni sobrescritura.
- [x] Una interrupción a mitad del traspaso no deja datos corruptos ni parciales, y el
  siguiente arranque completa lo pendiente.

## Related

- [[unified-product-identity]] — el cambio de identidad de paquete es la causa que dispara
  este traspaso
- [[sessions-json-persistence]] — el historial estructurado es uno de los datos que este
  traspaso pone a disposición bajo la identidad nueva
- [[row-lifecycle-persistence-by-type]] — la selección guardada de programas es uno de los
  datos que este traspaso pone a disposición
- [[configurable-time-format-preference]] — las preferencias del usuario son uno de los
  datos que este traspaso pone a disposición
