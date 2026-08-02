---
type: capability-spec
title: "Volumen general y volumen de sonidos de interacción, desde Opciones"
capability: "audio-volume"
slug: "dual-volume-control"
domain: "feature"
delta_type: null
supersedes: null
superseded_by: null
status: review
assigned_agent: "sdd-apply"
priority: medium
depends_on: []
change_ref: "[[app-detection-logos-audio]]"
worktree: "/home/larayap/cronometro-app/.sdd/worktrees/app-detection-logos-audio"
feature_branch: "feature/app-detection-logos-audio"
commits: ["fbe6bbff1a578583bbf4e7fb759c8820fb85bd7b"]
mr: ""
acceptance_criteria:
  - "El usuario accede a una pantalla de Opciones desde la barra de la aplicación"
  - "Bajar el control maestro a cero silencia también la alarma de fin de sesión"
  - "Bajar el control de sonidos de interacción a cero no afecta el volumen de la alarma de fin de sesión"
  - "Los dos niveles de volumen elegidos se mantienen tras cerrar y volver a abrir la aplicación"
related: []
affects: []
adrs: ["[[0006-userdata-json-persistence]]"]
scope: ["src/plugins/sound.js", "src/components/TitleBar.vue"]
verified_at: "2026-08-01"
created: "2026-08-01"
updated: "2026-08-01"
tags: [capability-spec]
---

# Volumen general y volumen de sonidos de interacción, desde Opciones

## Purpose

Hoy la aplicación no ofrece ningún control de volumen: todos los sonidos suenan siempre al
mismo nivel fijo. Esta spec agrega una pantalla de Opciones con dos controles de volumen
independientes, de forma que el usuario pueda bajar los sonidos decorativos de clic sin
perder la alarma de fin de sesión, que necesita seguir escuchándose.

## Requirements

- El sistema SHALL ofrecer una pantalla de Opciones accesible desde la barra de la
  aplicación.
- El sistema SHALL proveer un control de volumen maestro que afecta a todos los sonidos de
  la aplicación, incluida la alarma de fin de sesión.
- El sistema SHALL proveer un segundo control de volumen, independiente del maestro, que
  afecta únicamente a los sonidos de interacción (agregar, ventana emergente, presionar
  botón, eliminar), sin afectar a la alarma de fin de sesión.
- El sistema SHALL calcular el volumen efectivo de cada sonido de interacción en relación
  al control maestro, de modo que bajar el maestro siga bajando también esos sonidos.
- El sistema SHALL mantener la alarma de fin de sesión regida únicamente por el control
  maestro, sin verse afectada por el control de sonidos de interacción.
- El sistema SHALL persistir el valor de ambos controles de volumen entre sesiones de la
  aplicación.

## Scenarios

### Scenario: Bajar el maestro silencia todo, incluida la alarma

**GIVEN** la pantalla de Opciones abierta
**WHEN** el usuario baja el control de volumen maestro a cero
**THEN** ningún sonido de la aplicación se escucha, incluida la alarma de fin de sesión

### Scenario: Bajar los sonidos de interacción conserva la alarma

**GIVEN** la pantalla de Opciones abierta, con el maestro en un nivel audible
**WHEN** el usuario baja a cero el control de sonidos de interacción
**THEN** los sonidos de agregar, ventana emergente, botón y eliminar dejan de escucharse,
mientras que la alarma de fin de sesión se sigue escuchando con normalidad

### Scenario: Los volúmenes se mantienen entre sesiones de la app

**GIVEN** el usuario ajustó ambos controles de volumen a valores distintos del
predeterminado
**WHEN** cierra y vuelve a abrir la aplicación
**THEN** ambos controles conservan los valores que el usuario eligió

### Scenario: Acceso a Opciones desde la barra de la aplicación

**GIVEN** la aplicación abierta en cualquiera de sus vistas
**WHEN** el usuario selecciona el acceso a Opciones en la barra de la aplicación
**THEN** se muestra la pantalla de Opciones con los dos controles de volumen

## Acceptance Criteria

- [x] El usuario accede a una pantalla de Opciones desde la barra de la aplicación.
- [x] Bajar el control maestro a cero silencia también la alarma de fin de sesión.
- [x] Bajar el control de sonidos de interacción a cero no afecta el volumen de la alarma
  de fin de sesión.
- [x] Los dos niveles de volumen elegidos se mantienen tras cerrar y volver a abrir la
  aplicación.

## Related

(sin specs relacionadas en este cambio)
