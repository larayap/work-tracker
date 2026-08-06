---
type: change-state
change_name: "work-groups-history-time-format"
domain: "feature"
status: active
fast_path: "full"
current_phase: sdd-verify
phases_completed: [sdd-init, sdd-explore, sdd-propose, sdd-spec, sdd-design, sdd-tasks, sdd-apply]
spec_refs: ["[[multiple-simultaneous-groups]]", "[[hide-usage-chart-duration-scale]]", "[[usage-aggregation-by-visible-app-name]]", "[[judgment-fixes-sessions-groups-history-revised]]", "[[readable-session-title-typography]]", "[[session-time-without-seconds]]", "[[configurable-time-format-preference]]", "[[bright-chart-bars-on-dark-background]]"]
jira_key: "POM-1"
post_init_fields_done: true
post_propose_subtask_done: true
subtask_proposal_key: "POM-2"
repo: "/home/larayap/cronometro-app"
worktree: "/home/larayap/cronometro-app/.sdd/worktrees/work-groups-history-time-format"
feature_branch: "feature/work-groups-history-time-format"
integration_target: "main"
mr: ""
mr_status: pending
mr_error: ""
created: "2026-08-05"
updated: "2026-08-05"
tags: [change]
---

## Intent

Origen: Jira [[POM-1]] (Historia, reporter Luis Araya, estado "Stand by"). El ticket
pide 7 cambios sobre el work y el historial:

1. **Grupos múltiples**: permitir crear varios grupos de sesión en el work, no solo uno.
2. **Historial — ocultar horas bajo los gráficos**: el historial no debe mostrar las horas
   debajo de los gráficos existentes hoy.
3. **Historial — agrupar por aplicación**: en día, mes o rango, juntar todas las instancias
   de una misma aplicación (ej. todos los "Chrome") en una sola barra del gráfico.
4. **Tipografía legible**: la fuente de texto de las aplicaciones debe ser la fuente normal
   del sistema, no la decorativa actual — debe poder leerse bien.
5. **Horas de sesión sin segundos**: las horas de las sesiones deben mostrarse solo con
   hora y minuto.
6. **Preferencia de formato de hora**: agregar en la configuración una opción para elegir
   AM/PM o 24 horas, y que esa preferencia funcione (se aplique) en la app.
7. **Gráficos más blancos**: los gráficos del historial deben verse con una paleta más
   blanca/clara que la actual.

No se encontraron criterios de aceptación explícitos en la descripción ni en comentarios
del ticket. Ver `input.md` en este mismo directorio para el texto íntegro.

## Path Inference
- Inferred: full (rule 5)
- Signals: S1=N, S2=N, S3=N
- Override: none
