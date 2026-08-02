---
type: change-state
change_name: "sessions-groups-history"
domain: "feature"
status: active
fast_path: "full"
current_phase: sdd-archive
judgment_iteration: 2
phases_completed: [sdd-init, sdd-explore, sdd-propose, sdd-spec, sdd-design, sdd-tasks, sdd-apply, sdd-verify, sdd-judgment, sdd-apply, sdd-judgment]
spec_refs: ["[[row-lifecycle-persistence-by-type]]", "[[sessions-json-persistence]]", "[[installed-apps-data-integrity]]", "[[deselect-from-saved-selection]]", "[[selection-type-manual-vs-auto]]", "[[inline-session-naming]]", "[[group-composition-and-drag]]", "[[selector-listing-icons]]", "[[session-view]]", "[[usage-chart-by-interval]]", "[[judgment-fixes-sessions-groups-history]]"]
worktree: "/home/larayap/cronometro-app/.sdd/worktrees/sessions-groups-history"
feature_branch: "feature/sessions-groups-history"
integration_target: "main"
mr: ""
mr_status: pending
mr_error: ""
created: "2026-08-02"
updated: "2026-08-02"
adrs: ["[[0007-structured-sessions-json-with-one-shot-migration]]", "[[0008-sessions-and-groups-as-entry-metadata]]", "[[0009-typed-selection-with-atomic-manual-removal]]", "[[0010-charting-library-confined-to-history-bundle]]"]
tags: [change]
---

## Intent

Extender el widget "Aplicación" y el historial de cronometro-app, sobre lo entregado en `app-detection-logos-audio`:

1. **Deseleccionar aplicaciones** — el modal del selector permite desmarcar una aplicación de la selección guardada; hoy una vez seleccionada no se puede quitar.
2. **Dos tipos de selección** — *manual/transitoria*: monitorea solo hasta que el programa se cierre, sin reaparecer al reabrirse; *automática/persistente*: el comportamiento actual, la fila reaparece cada vez que el programa se abre.
3. **Sesiones con nombre** — al iniciar la detección de una aplicación se puede poner nombre a la sesión, y ese nombre queda registrado en el historial.
4. **Grupos de sesión** — varias aplicaciones pueden pertenecer a la misma sesión: el usuario arrastra aplicaciones al grupo (no necesariamente todas). El historial guarda el desglose por grupo.
5. **Historial con dos vistas** — por aplicación/día y por sesión.
6. **Gráfico de uso** — el historial muestra un gráfico del uso de aplicaciones según el registro.
7. **Fix de encoding del puente PowerShell** — PowerShell 5.1 emite en codepage OEM (CP-850) y Node decodifica como UTF-8, corrompiendo nombres y exePaths con tildes/eñes (`Cronómetro App.exe` → `Cron�metro App.exe`); el exePath corrupto no existe en disco, así que `getFileIcon` falla y el ícono sale de respaldo. Confirmado empíricamente vía interop WSL→Windows (hexdump: `ó` = `0xa2` sin fix, `c3 b3` con `[Console]::OutputEncoding = UTF8`). Afecta las ~3 invocaciones PowerShell de `src/main/platform-windows.js`. Incluye invalidar la caché corrupta `installed-apps-cache.json`.
8. **Fugas del filtro de instaladas** — `7-Zip Help → .chm` y `Git Release Notes → .html` pasan el filtro de `src/main/installed-apps-filter.js` que debía exigir ejecutables.
9. **Ícono en el listado del selector** — cada app del listado de instaladas muestra un ícono chico junto al nombre (hoy el modal no muestra íconos; considerar el costo con ~106 entradas).

## Path Inference

- Inferred: spec-first (rule 2 → override del usuario a full)
- Signals: S1=Y (falso positivo: "UTF-8" matcheó como identificador canónico), S2=Y (paths del fix de encoding), S3=N
- Override: user=`--path full`

## Entorno

El interop WSL→Windows está disponible en este entorno: `powershell.exe`, `cmd.exe` y `tasklist.exe` son invocables desde bash (viven en `/mnt/c/WINDOWS/...`). El userData de la app instalada es legible en `/mnt/c/Users/Luis Araya/AppData/Roaming/cronometro-apps/` (`monitored-selection.json`, `app-icons-cache.json`, `installed-apps-cache.json`, `settings.json`, `usage-log.txt`). Esto significa que las consultas PowerShell se pueden probar reales y los artefactos de la app inspeccionar directo — el cambio anterior asumió incorrectamente que no se podía. Ojo: PowerShell 5.1 emite en OEM; para leer salida con no-ASCII fijar `[Console]::OutputEncoding = [System.Text.Encoding]::UTF8`.

**Verificado en sdd-init (2026-08-02)**: `which powershell.exe cmd.exe tasklist.exe` resuelve los tres binarios bajo `/mnt/c/WINDOWS/...` y el directorio de userData es legible con `ls`. El directorio real contiene además `pomodoro-sessions.json` (no listado arriba) — archivo adicional a considerar en `sdd-explore` si el diseño de sesiones/grupos de este cambio interactúa con el modo Pomodoro.
