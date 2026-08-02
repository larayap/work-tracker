---
type: capability-spec
title: "Ícono junto a cada programa en el listado del selector"
capability: "app-installed-selector"
slug: "selector-listing-icons"
domain: "feature"
delta_type: added
supersedes: null
superseded_by: null
status: review
assigned_agent: "sdd-apply"
priority: low
depends_on: ["[[automatic-bw-icons]]", "[[installed-apps-data-integrity]]"]
change_ref: "[[sessions-groups-history]]"
worktree: "/home/larayap/cronometro-app/.sdd/worktrees/sessions-groups-history"
feature_branch: "feature/sessions-groups-history"
commits: ["494868c24ac0a80a98b55db0449c32936297dc52"]
mr: ""
acceptance_criteria:
  - "Cada entrada del listado de instaladas muestra el ícono real del programa junto a su nombre"
  - "Un programa sin ícono útil muestra la imagen de respaldo"
  - "La primera apertura del selector tras instalar o actualizar la app no se congela de forma perceptible"
related: ["[[installed-apps-data-integrity]]", "[[automatic-bw-icons]]"]
affects: []
adrs: ["[[0005-native-icon-extraction-css-grayscale]]"]
scope: ["src/components/AppSelectorModal.vue", "src/main/icon-cache.js"]
verified_at: null
created: "2026-08-02"
updated: "2026-08-02"
tags: [capability-spec]
---

# Ícono junto a cada programa en el listado del selector

## Purpose

El listado de instaladas hoy muestra solo texto, obligando al usuario a leer decenas de
nombres para reconocer un programa entre alrededor de un centenar de entradas. Esta spec
agrega el ícono real de cada programa junto a su nombre en ese listado, reusando la
extracción automática ya disponible para las filas del listado visible, y cuida que mostrar
hasta un centenar de íconos de una sola vez no introduzca una demora perceptible en la
primera apertura del selector.

## Requirements

- El sistema SHALL mostrar, junto al nombre de cada programa en el listado de instaladas,
  el ícono propio de ese programa.
- El sistema SHALL obtener ese ícono mediante la misma extracción automática ya usada para
  las filas del listado visible, sin requerir ninguna imagen cargada manualmente.
- El sistema SHALL mostrar una imagen de respaldo para cualquier programa cuyo ícono no se
  pueda extraer, de forma consistente con cómo ya se maneja ese caso en el listado visible.
- El sistema SHALL mantener el listado de instaladas respondiendo con normalidad en su
  primera apertura después de instalar o actualizar la aplicación, aun cuando la mayoría de
  los íconos todavía no se hayan extraído, sin una demora perceptible.
- El sistema SHOULD evitar repetir la extracción de un ícono ya obtenido en una apertura
  anterior del selector.

## Scenarios

### Scenario: El listado muestra íconos junto a los nombres

**GIVEN** el selector con varias decenas de programas
**WHEN** el usuario lo abre
**THEN** cada entrada muestra el ícono real del programa junto a su nombre

### Scenario: Un programa sin ícono útil muestra el respaldo

**GIVEN** un programa cuyo ejecutable no entrega un ícono útil
**WHEN** aparece en el listado
**THEN** se muestra la imagen de respaldo en su lugar

### Scenario: La primera apertura tras instalar la app no se congela

**GIVEN** una primera apertura del selector sin ningún ícono todavía en caché
**WHEN** el usuario abre el selector
**THEN** el listado se muestra y responde con normalidad mientras los íconos se completan,
sin una demora perceptible

### Scenario: Aperturas siguientes no vuelven a extraer

**GIVEN** un selector abierto antes, con íconos ya obtenidos
**WHEN** el usuario lo abre de nuevo
**THEN** los íconos aparecen sin repetir la extracción

## Acceptance Criteria

Implementación completa (commit 494868c); los cuatro criterios exigen la aplicación real
corriendo en Windows para observarse (ícono renderizado, ausencia de demora perceptible,
ausencia de llamadas IPC repetidas) — no verificables con `node -e` ni con interop sin la
ventana abierta. Ver `observations.md` (entrada `unverifiable-in-env`, etapa 2).

- [ ] Cada entrada del listado de instaladas muestra el ícono real del programa junto a su
  nombre.
- [ ] Un programa sin ícono útil muestra la imagen de respaldo en vez de un espacio vacío o
  roto.
- [ ] La primera apertura del selector tras instalar o actualizar la aplicación no muestra
  ninguna demora perceptible mientras los íconos se completan.
- [ ] Una apertura posterior del selector muestra los íconos ya obtenidos sin volver a
  extraerlos.

## Related

- [[installed-apps-data-integrity]] — provee un listado sin duplicados ni entradas
  corruptas sobre el cual esta spec agrega el ícono
- [[automatic-bw-icons]] — provee el mecanismo de extracción y caché de íconos que esta
  spec reutiliza para el listado del selector
