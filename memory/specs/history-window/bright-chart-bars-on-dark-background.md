---
type: capability-spec
title: "Barras del gráfico de uso más claras sobre el fondo oscuro"
capability: "history-window"
slug: "bright-chart-bars-on-dark-background"
domain: "feature"
delta_type: added
supersedes: null
superseded_by: null
status: review
assigned_agent: "sdd-apply"
priority: low
depends_on: []
change_ref: "[[work-groups-history-time-format]]"
worktree: "/home/larayap/cronometro-app/.sdd/worktrees/work-groups-history-time-format"
feature_branch: "feature/work-groups-history-time-format"
commits: ["94b86b97a2a19dd79d30b60288e2537764a51ee5"]
mr: ""
acceptance_criteria:
  - "Las barras del gráfico se muestran en un tono claro, bien contrastado sobre el fondo oscuro"
  - "El fondo de la ventana de historial y el resto de su paleta no cambian"
  - "Las etiquetas y números del gráfico se leen con claridad sobre el nuevo color de las barras"
related: ["[[usage-aggregation-by-visible-app-name]]", "[[dark-loading-state]]"]
affects: []
adrs: ["[[0010-charting-library-confined-to-history-bundle]]"]
scope: ["src/history/UsageChart.vue"]
verified_at: null
created: "2026-08-05"
updated: "2026-08-05"
tags: [capability-spec]
---

# Barras del gráfico de uso más claras sobre el fondo oscuro

## Purpose

Las barras del gráfico de tiempo por aplicación se muestran hoy en un gris medio, con poco
contraste sobre el fondo oscuro de la ventana de historial. Esta spec sube el brillo de las
barras a un gris claro bien contrastado, sin tocar el fondo oscuro de la ventana.

## Requirements

- El sistema SHALL mostrar las barras del gráfico de tiempo por aplicación en un tono
  claro, bien contrastado sobre el fondo oscuro de la ventana.
- El sistema SHALL NOT modificar el color de fondo de la ventana de historial.
- El sistema SHALL mantener legibles las etiquetas y los números del gráfico sobre el nuevo
  color de las barras.

## Scenarios

### Scenario: Las barras se ven claras sobre el fondo oscuro

**GIVEN** el historial abierto con el gráfico de tiempo por aplicación visible
**WHEN** el usuario mira las barras
**THEN** las ve en un tono claro, bien contrastado contra el fondo oscuro de la ventana

### Scenario: El fondo de la ventana no cambia

**GIVEN** el gráfico con sus barras en el tono nuevo
**WHEN** el usuario mira el resto de la ventana de historial
**THEN** el fondo sigue oscuro, sin ningún destello ni cambio de color

## Acceptance Criteria

Implementación completa (commit `94b86b9`, `UsageChart.vue`): `backgroundColor` pasa de
`'#6f6f6f'` a `'#d9d9d9'` (~12:1 de contraste contra `#1b1b1b`, calculado en `design.md`, no
medido con herramienta). Revisión de diff confirma que `ChartJS.defaults` y el fondo de la
ventana no se tocaron. Verificación visual (Franja B) completada por `sdd-verify` (iteración
2): capturado el historial real en "2 ago 2026", las cinco barras ("League of Legends",
"Google Chrome", "Brave", "Firefox", "Access") se ven en gris claro, con contraste evidente
contra el fondo casi negro de la ventana. El fondo se mantuvo oscuro en todas las capturas de
esta sesión (calendario, gráfico y listas), incluida la primera captura tras revelar la
ventana desde la bandeja — sin destello claro observado (single-frame, no descarta un
parpadeo por debajo del intervalo de captura). Las etiquetas de cada app y sus valores en las
listas de abajo se leen con claridad sobre el nuevo color. Contraste no remedido con
herramienta dedicada (sigue como estimación de `design.md`).

- [x] Las barras del gráfico se muestran en un tono claro, bien contrastado sobre el fondo
  oscuro. (visual, "2 ago 2026")
- [x] El fondo de la ventana de historial y el resto de su paleta no cambian. (fondo oscuro en
  todas las capturas de la sesión)
- [x] Las etiquetas y números del gráfico se leen con claridad sobre el nuevo color de las
  barras. (visual)

## Related

- [[usage-aggregation-by-visible-app-name]] — modifica el mismo gráfico, sin relación con el
  color de las barras
- [[dark-loading-state]] — gobierna el fondo oscuro de la ventana que esta spec no toca
