---
type: capability-spec
title: "Correcciones de judgment (iteración 1): arranque único de ventana, vinculación de PID en filas degradadas, escritura serializada de la caché de íconos"
capability: "app-monitoring"
slug: "judgment-fixes-iteration-1"
domain: "feature"
delta_type: added
supersedes: null
superseded_by: null
status: completed
assigned_agent: "sdd-apply"
priority: critical
depends_on: ["[[row-lifecycle]]", "[[session-log-persistence]]", "[[automatic-bw-icons]]"]
change_ref: "[[app-detection-logos-audio]]"
worktree: "/home/larayap/cronometro-app/.sdd/worktrees/app-detection-logos-audio"
feature_branch: "feature/app-detection-logos-audio"
commits: ["e7dd8d298f6db218ceb8ac353e0b07d1c47d1846", "cf4b70b41db12732869431cca2de0ddbe7c1eebb", "a0c564814f0a7df3dfa8eded9d1e6742f1392c51"]
mr: "https://github.com/larayap/cronometro-app/pull/2"
acceptance_criteria:
  - "La aplicación crea exactamente una ventana principal por arranque y los canales IPC se registran una sola vez"
  - "La ventana que la aplicación muestra desde el tray es la que tiene la interfaz cargada, y cerrarla la oculta en vez de destruirla"
  - "Una fila agregada desde la vía de procesos abiertos sin ruta resoluble vincula el PID de su proceso cuando ese proceso está corriendo"
  - "Cerrar el proceso de una fila degradada la saca del listado visible y registra su sesión, igual que presionar el control de detener"
  - "Extraer varios íconos en paralelo no pierde entradas del archivo de caché en disco"
related: ["[[row-lifecycle]]", "[[automatic-bw-icons]]"]
affects: ["[[row-lifecycle]]", "[[session-log-persistence]]", "[[simultaneous-limit]]"]
adrs: ["[[0001-two-signal-monitoring-engine]]", "[[0004-os-dependent-code-single-module]]", "[[0005-native-icon-extraction-css-grayscale]]"]
scope: ["src/background.js", "src/main/platform-windows.js", "src/main/monitor-engine.js", "src/main/icon-cache.js", "src/components/AppSelectorModal.vue"]
verified_at: null
created: "2026-08-02"
updated: "2026-08-02"
tags: [capability-spec, judgment-fix]
---

# Correcciones de judgment (iteración 1)

## Purpose

`sdd-judgment` devolvió veredicto FAIL en la iteración 1 con dos defectos confirmados y uno
adjudicado. Esta spec los recoge como alcance de trabajo para `sdd-apply`. La evidencia
completa —comandos ejecutados, citas de código, orden de ejecución derivado— está en
`changes/app-detection-logos-audio/judgment-report.md`; acá va solo lo que hay que corregir
y con qué criterio se da por corregido.

## Requirements

### C1 — Arranque único de la ventana principal (critical)

`src/background.js` invoca `createWindow()` desde dos listeners del mismo evento `ready`
(`app.whenReady().then()` en la línea 121 y `app.on('ready')` en la línea 260). La
duplicación es preexistente al cambio, pero este cambio movió `registerIpcHandlers(mainWindow)`
adentro de `createWindow()` (línea 84), y `ipcMain.handle()` lanza al registrar un canal ya
registrado. La segunda invocación reasigna `mainWindow` (línea 61) y lanza antes de
`loadURL` (89/95) y antes de `mainWindow.on('close')` (97): la variable de módulo queda
apuntando a una ventana sin contenido y sin handler de cierre, y la ventana funcional queda
huérfana con `show: false`.

- El sistema SHALL crear exactamente una ventana principal por arranque.
- El sistema SHALL registrar cada canal IPC una sola vez por ejecución del proceso main.
- El sistema SHALL dejar la variable que referencia la ventana principal apuntando a la
  ventana que cargó la interfaz y que tiene registrado su handler de cierre.

Dirección preferida (KISS): consolidar los dos listeners de `ready` en un único camino de
arranque. Un guard de idempotencia en `registerIpcHandlers` enmascara el síntoma sin
eliminar la doble ventana.

### C2 — Una fila degradada debe poder vincular su PID (high)

D4 especifica que el `appId` degradado es `name:` más el **nombre de imagen** en minúsculas,
correlacionable contra el nombre de imagen que devuelve `tasklist`. La implementación lo
arma sobre `appName` (`platform-windows.js:89`), que es `$_.Description` o `$_.Name` de
`Get-Process` —una descripción o un nombre de proceso sin extensión—, mientras que
`tasklist /FO CSV /NH` devuelve el nombre de imagen **con** `.exe`. La comparación de
`monitor-engine.js:224-226` no coincide nunca, y el bloque de foco (líneas 203-209) solo
puebla `discovered` indexado por `exePath`. La fila degradada queda con `pid: null`
permanente y `reduceLifecycle` no puede darla de baja por `process-exit`.

- El sistema SHALL exponer, para cada proceso abierto ofrecido al usuario, un nombre de
  imagen apto para correlacionar contra la enumeración de procesos en ejecución, distinto
  del nombre legible que se muestra en la fila.
- El sistema SHALL asignar el PID de su proceso a una fila degradada cuando ese proceso esté
  en ejecución, sin abrir una sesión nueva ni alterar `elapsedMs` / `sessionStartedAt`
  (regla de vinculación de D6, ya implementada en `reduceLifecycle`).
- El sistema SHALL quitar del listado visible una fila degradada cuando su proceso se cierre,
  registrando la sesión, con el mismo efecto que el control de detener (requisito vigente de
  `row-lifecycle`).

Dirección preferida: que `listOpenWindows()` devuelva el nombre de imagen real como campo
propio y que `AppSelectorModal.vue:132` lo propague a `add-to-selection`, para que
`normalizeAppId` construya el `appId` que D4 especifica. Normalizar agregando `.exe` en
`monitor-engine.js` corrige el síntoma pero deja el `appId` desalineado de D4.

### S1 — Escritura serializada de la caché de íconos en disco (low-medium)

`icon-cache.js#getIcon` lee el archivo de caché completo (línea 52), espera la extracción
async (línea 58) y escribe el archivo completo (línea 63). `CronometroAplicacion.vue:74-76`
dispara `ensureIcon` para todas las filas en un `forEach` síncrono, así que con 2+ filas
nuevas en el mismo snapshot hay varias `getIcon()` en vuelo y la última escritura pisa las
claves de las anteriores. No hay síntoma durante la sesión (el `Map` en memoria retiene
todo); el efecto es re-extracción innecesaria en el arranque siguiente.

- El sistema SHALL preservar todas las entradas ya escritas del archivo de caché de íconos
  ante extracciones concurrentes.

Dirección preferida: serializar las escrituras o releer inmediatamente antes de escribir.
`installed-apps.js` ya usa un patrón de promesa en vuelo reutilizable.

## Scenarios

### Scenario: Arranque crea una sola ventana y la muestra desde el tray

**GIVEN** la aplicación se inicia
**WHEN** el usuario elige "Mostrar ventana" desde el tray
**THEN** aparece la ventana con la interfaz cargada, y cerrarla la oculta en vez de
destruirla

### Scenario: Cerrar el proceso de una fila degradada la saca del listado

**GIVEN** una fila agregada desde la vía de procesos abiertos cuya ruta no se pudo resolver,
con su proceso en ejecución
**WHEN** el usuario cierra ese proceso
**THEN** la fila desaparece del listado visible y su sesión queda registrada en el historial,
con el mismo efecto que si hubiera presionado el control de detener

### Scenario: Varios íconos extraídos en el mismo instante sobreviven al reinicio

**GIVEN** una selección guardada con dos o más programas ya en ejecución al arrancar la app,
cuyos íconos aún no están en la caché en disco
**WHEN** el usuario cierra la app y la vuelve a abrir
**THEN** los íconos de todos esos programas aparecen sin volver a extraerse

## Acceptance Criteria

- [ ] La aplicación crea exactamente una ventana principal por arranque y ningún canal IPC
  se registra dos veces.
- [ ] La ventana que se muestra desde el tray es la que tiene la interfaz cargada, y cerrarla
  la oculta.
- [ ] Una fila degradada vincula el PID de su proceso cuando ese proceso está corriendo.
- [ ] Cerrar el proceso de una fila degradada la saca del listado visible y registra su
  sesión.
- [ ] Extraer varios íconos en paralelo no pierde entradas del archivo de caché en disco.

## Notas de verificación

C1 y S1 son verificables en este entorno (WSL2, sin Windows): C1 por lectura del flujo de
arranque y por build, S1 ejercitando `getIcon` concurrente contra el `json-store.js` real.
C2 es verificable parcialmente —la construcción del `appId` degradado y la correlación son
lógica pura ejercitable con `node -e`—; la confirmación de extremo a extremo con un proceso
elevado real queda pendiente de Windows, como el resto del guion manual.

Sin test runner en el proyecto: los reductores, `normalizeAppId` y el filtro son puros y
están escritos para ejercitarse con `node -e` (sección "Lógica pura aislada, lista para un
runner" de `design.md`).

## Related

- [[row-lifecycle]] — C2 rompe su requisito de equivalencia entre detener y cierre de proceso
- [[session-log-persistence]] — cascada de C2: la sesión de una fila degradada no se registra
  al cerrarse el proceso
- [[automatic-bw-icons]] — S1 no rompe su comportamiento observable, solo la eficiencia de la
  caché
