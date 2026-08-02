# Observations SDD

Log de hallazgos operacionales del pipeline SDD.
Categorías permitidas: ver `@global/skills/_shared/obsidian-persistence-convention#observations-md-policy`.
Formato: ## YYYY-MM-DD | <tag> | <change|global> | <summary>

## 2026-08-01 | pre-adr | app-detection-logos-audio | Empaquetado dual (electron-forge + vue-cli-plugin-electron-builder) en package.json — resolver cuál es el flujo activo antes de tocar background.js o el packaging
## 2026-08-01 | pre-adr | app-detection-logos-audio | Sin test runner ni CI configurados en el repo — sdd-verify deberá definir estrategia de verificación para este cambio
## 2026-08-01 | gap | global | _profile.md no existía — primera inicialización SDD del repositorio; creado desde cero en sdd-init

## 2026-08-01 | pre-adr | app-detection-logos-audio | Alcance Windows-first para detección y enumeración de apps instaladas — decisión propuesta en sdd-propose (default), pendiente de confirmación del usuario; candidata a ADR en sdd-design junto con el aislamiento del código dependiente de SO
## 2026-08-01 | pre-adr | app-detection-logos-audio | Semántica del conteo multi-programa: solo acumula el programa con foco (proceso vivo = sesión abierta, foco = quién suma) — define el modelo de datos, candidata a ADR en sdd-design
## 2026-08-01 | pre-adr | app-detection-logos-audio | Contrato IPC `app-active` se versiona para llevar `appName`/`pid` — cambio de contrato entre main y renderer, documentar en design

## 2026-08-01 | env-quirk | app-detection-logos-audio | context7 no cubre `active-win`: la búsqueda devuelve homónimos sin relación (x-win, active_merchant). El contrato de la librería se documenta en tech-context.md a partir del uso real en `src/background.js:156-170` — `owner.name` y `owner.path` confirmados por uso, `owner.processId` no
## 2026-08-01 | env-quirk | app-detection-logos-audio | La doc de context7 para Electron corresponde a la rama `main` y no marca disponibilidad por versión: `nativeImage.createThumbnailFromPath` aparece documentada pero NO existe en Electron 13, la versión fijada en el proyecto. Verificar versión de introducción antes de adoptar cualquier API de Electron en este repo

## 2026-08-01 | debt-candidate | forge.config.js sin plugin de webpack (toolchain no funcional)
**Detectado por**: sdd-explore en `app-detection-logos-audio`
**Ubicación**: `forge.config.js`, scripts `start`/`package`/`make` de `package.json`
**Descripción**: Electron Forge está configurado (`packagerConfig`, `makers`, plugins `auto-unpack-natives`/`fuses`) pero sin `@electron-forge/plugin-webpack` ni equivalente que compile los SFCs de Vue — estos scripts no producen un build funcional del renderer. El flujo real es `vue-cli-plugin-electron-builder` (`electron:build`/`electron:serve`). Riesgo de builds rotos si alguien ejecuta los scripts de Forge esperando el flujo completo.
**Promoción sugerida**: `sdd new remove-unused-forge-toolchain --domain debt`

## 2026-08-01 | debt-candidate | stateManager.js sin referencias detectadas
**Detectado por**: sdd-explore en `app-detection-logos-audio`
**Ubicación**: `src/utils/stateManager.js`
**Descripción**: Módulo que persiste un booleano `mostrarMenu` en `state.txt` junto al propio archivo. No se encontró ningún `require`/`import` de este módulo en el resto de `src/` — candidato a código muerto, o su uso real vive fuera de las rutas exploradas y debería documentarse.
**Promoción sugerida**: `sdd new cleanup-dead-state-manager --domain debt`

## 2026-08-01 | debt-candidate | Modal "seleccionar app abierta" duplicado
**Detectado por**: sdd-explore en `app-detection-logos-audio`
**Ubicación**: `src/components/CronometroAplicacion.vue:152-181`, `src/components/TitleBar.vue:136-172`
**Descripción**: Misma UI de modal (lista de ventanas abiertas, navegación por teclado, selección) implementada de forma casi idéntica en dos componentes, sin un componente compartido. Aumenta el costo de mantenimiento cuando se toquen ambos flujos en este cambio (selector de apps).
**Promoción sugerida**: `sdd new extract-shared-app-picker-modal --domain debt`

## 2026-08-02 | verification-gap | app-detection-logos-audio | sdd-apply completó las 29 tareas; verificación manual en Windows pendiente
**Fase**: sdd-apply
**Contexto**: el entorno de ejecución es WSL2/Linux y la app es Windows-only en su detección (`active-win`, `tasklist`, PowerShell, `app.getFileIcon`, accesos directos del Menú Inicio). No se pudo levantar la app ni correr ningún guion de verificación manual de `design.md`.
**Lo que sí se verificó en este entorno**:
- `npx eslint src --ext .js,.vue` — limpio en todo `src/` tras cada bloque.
- `npx vue-cli-service build` — el renderer (index/history) transpila sin errores tras cada bloque.
- `npx vue-cli-service electron:build --dir` — el bundle del main process (`background.js` + todo `src/main/*`) compila sin errores tras los bloques 2, 4 y 5 (los que tocan `background.js`/`src/main/`).
- Las funciones puras del motor y del filtro de instaladas, con `node -e` directo: `readJson`/`writeJson` (Tarea 1), `msToHHMMSS`/`formatDateYYYYMMDD` (Tarea 2), `isProcessAlive` con PID propio y PID inexistente (Tarea 8), `buildSessionLine` contra la regex de `get-app-logs` (Tarea 10), los 6 escenarios de `reduceLifecycle` y los 3 de `reduceFocus` (Tareas 11-12), `getSnapshot()` en frío (Tarea 15), y `filterInstalledApps` con 5 entradas fabricadas (Tarea 24).
**Lo que queda pendiente de verificación en Windows** (no observable ni ejecutable desde este entorno):
1. Guion manual completo de `design.md` (puntos 1-26): motor con un solo programa, multi-fila y límite, `ResizeObserver`/antibucle, íconos, selector, indicador no interactivo, volumen, historial sin destello.
2. Si `winInfo.owner.processId` (o `.pid`) de `active-win` viene poblado al cambiar de foco entre programas reales — Tarea 8 dejó el campo como refuerzo opcional (D4), pero la confirmación empírica requiere Windows.
3. La consulta PowerShell de `listInstalledCandidates()` (Tarea 25): no se pudo ejecutar ni sintaxear con un intérprete real (no hay `powershell.exe` en WSL2). La sintaxis (bloques `if/else` como expresión dentro de `[PSCustomObject]@{...}`, `Get-ItemProperty` con array de `-Path`) está escrita de buena fe contra PowerShell 5.1 pero no probada.
4. La correlación acceso-directo↔registro en esa misma consulta es best-effort (por `DisplayName` exacto o `InstallLocation` como prefijo) — no hay clave foránea real entre un `.lnk` y una entrada de `Uninstall`; si no matchea, la entrada sigue sujeta solo a los descartes por ruta/nombre del filtro puro (ya verificado).
5. El fallback de `idk.png` en `icon-cache.js` vía `app.getAppPath()` + `nativeImage.createFromPath()`: razonado contra cómo `vue-cli-plugin-electron-builder` empaqueta el proceso main (sin loader de imágenes en `bundleMain`, ver commit `3ab7b95`) y contra el `files` glob por defecto de electron-builder (no excluye `src/`), pero no hay forma de generar un build empaquetado real (`.exe`/NSIS) en este entorno para confirmarlo.
6. Todos los criterios de aceptación de las specs tocadas (`two-state-row-machine`, `row-lifecycle`, `saved-selection-only-monitoring`, `session-log-persistence`, `simultaneous-limit`, `empty-state`, `automatic-bw-icons`, `installed-apps-listing-quality`, `status-indicator-non-interactive`, `dual-volume-control`, `dark-loading-state`) quedan con sus checkboxes de `Acceptance Criteria` sin marcar en las specs — el código los implementa según el diseño, pero "implementado" no es "verificado", y marcar los checkboxes sin haber corrido el escenario real sería una afirmación no honesta.
**Acción sugerida para sdd-verify**: ejecutar el guion manual completo de `design.md` sobre un build de Windows (`npm run electron:serve` o el instalador NSIS), confirmar los 6 puntos de arriba, y recién entonces marcar `status: completed` y los checkboxes de acceptance_criteria en las specs.

## 2026-08-02 | correction | app-detection-logos-audio | fallback de idk.png corregido y verificado empíricamente
**Fase**: sdd-apply (segunda pasada, tras FAIL de sdd-verify)
**Contexto**: el punto 5 de la observación anterior (`2026-08-02 | verification-gap`) daba por buena la ruta `path.join(app.getAppPath(), 'src', 'assets', 'idk.png')` razonando que el `files` glob de electron-builder no excluye `src/`. `sdd-verify` demostró que ese razonamiento era incorrecto: `directories.app` (fijado por `vue-cli-plugin-electron-builder` a `dist_electron/bundled`) nunca contiene `src/` en ningún build empaquetado — el glob de `files` ni siquiera llega a evaluarse sobre el proyecto real, solo sobre la salida de webpack. Confirmado extrayendo un `app.asar` real.
**Corrección aplicada**: `src/assets/idk.png` → `git mv` a `public/img/idk.png`; `icon-cache.js` ahora usa `path.join(__static, 'img', 'idk.png')`, el mismo patrón que `background.js` ya usaba para `icon-work.png`. Re-verificado con el mismo procedimiento que usó `sdd-verify`: `npx vue-cli-service electron:build --dir` + `npx asar extract` sobre el `app.asar` generado — `img/idk.png` aparece en la raíz del asar extraído, junto a `icon-work.png`. Build y `asar extract` corridos y limpiados dentro de esta misma pasada (`dist`/`dist_electron` no quedan en el worktree).
**Decisión sobre el fallback local de `AppRow.vue`** (`fallbackIcon: require('@/assets/idk.png')`, señalado por `sdd-verify` como lo que hoy tapa el defecto en la UI): se **conserva**, no se elimina. Motivo: no es solo un respaldo redundante ante fallo de IPC — también sirve de placeholder instantáneo mientras `ensureIcon()` resuelve el ícono real de forma asíncrona; eliminarlo cambiaría el defecto corregido por una regresión distinta (parpadeo en blanco en cada fila nueva, todo el tiempo, no solo en el caso de falla). El mecanismo primario del respaldo (D9) sigue siendo `icon-cache.js`. Para no duplicar el archivo físico entre `src/assets/` y `public/img/`, el `require` de `AppRow.vue` ahora apunta directamente a `../../public/img/idk.png`: verificado contra el bundle compilado (`dist/js/index.*.js`) que webpack lo sigue procesando igual que antes (inline como `data:image/png;base64,...`, mismo mecanismo que el resto de `src/assets`).
**Segundo defecto corregido**: `monitoredApps.js` (`ensureIcon`) — guard de reentrada cambiado de `this.icons[exePath]` (falsy para `null` legítimo) a `Object.prototype.hasOwnProperty.call(this.icons, exePath)`. Sin cambios de reactividad necesarios: Pinia usa `reactive()` (Proxy), que ya trackea la asignación de claves nuevas.
**Commits**: `dc5d5d2` (icon-cache.js + AppRow.vue + mover idk.png), `cdaf80b` (monitoredApps.js).

## 2026-08-02 | correction | app-detection-logos-audio | C1/C2/S1 de sdd-judgment (iteración 1) corregidos

**Fase**: sdd-apply (tras veredicto FAIL de sdd-judgment, iteración 1 de 2)
**Spec**: `judgment-fixes-iteration-1.md`. Detalle completo con evidencia en `changes/app-detection-logos-audio/judgment-report.md`.

**C1 — arranque duplicado (`background.js`)**. Decisión tomada: eliminar el
`app.on('ready', ...)` duplicado y consolidar todo el arranque en el único
`app.whenReady().then()`, en vez de (solo) agregar un guard de idempotencia a
`registerIpcHandlers`. Justificación: un guard de idempotencia hace que
`ipcMain.handle()` deje de lanzar, pero no evita que `createWindow()` se
ejecute dos veces — seguiría construyéndose una `BrowserWindow` de más en
cada arranque (recurso desperdiciado, y la variable de módulo `mainWindow`
terminaría apuntando a la que gane la carrera, no necesariamente por diseño).
Consolidar los listeners ataca la causa, no el síntoma. No se agregó guard de
idempotencia adicional en `registerIpcHandlers` (YAGNI): con un solo camino
de arranque, no hay caso restante en el que se invoque dos veces.
**Verificación en este entorno (sin Windows)**: lectura del control de flujo
resultante, y confirmación por construcción sobre el bundle real —
`npx vue-cli-service electron:build --dir` + `grep` sobre
`dist_electron/bundled/background.js`: cero ocurrencias de
`app.on('ready'` y exactamente una de `whenReady`. `dist`/`dist_electron`
se eliminaron al cerrar, igual que en la pasada anterior.
**Pendiente de confirmar en el primer arranque real en Windows**: que
"Mostrar ventana" desde el tray abra la ventana con la interfaz cargada (no
en blanco) y que cerrarla la oculte en vez de destruirla — el escenario
completo de `judgment-fixes-iteration-1.md` no es observable sin Electron
corriendo de verdad.

**C2 — fila degradada sin vínculo de PID (`monitor-engine.js`,
`platform-windows.js`, `AppSelectorModal.vue`, `stores/monitoredApps.js`)**.
Se tomó la dirección que respeta D4 al pie de la letra (no el parche
alternativo de normalizar agregando `.exe` en `monitor-engine.js`):
`listOpenWindows()` ahora expone `imageName` como campo propio, distinto de
`appName`, y ese campo viaja por `AppSelectorModal.chooseOpenWindow()` →
`monitoredApps.addApp()` → `add-to-selection` → `addToSelection()`, que arma
el `appId` degradado (`normalizeAppId`) sobre `imageName`, no sobre `name`.
**Verificado con `node -e`** sobre las funciones puras: se reprodujo la
construcción del `appId` degradado, la coincidencia contra un
`tasklist`/`listRunningProcesses()` simulado, la vinculación real del pid vía
`reduceLifecycle`, y el cierre posterior del proceso sacando la fila y
devolviéndola en `closed` (equivalente al botón ■). Se corrió además el
control negativo: reconstruyendo el `appId` con la lógica previa (`appName`
en vez de `imageName`) el match nunca ocurre — confirma que el defecto era
real y que el fix lo resuelve. La confirmación de punta a punta contra un
proceso elevado real de Windows (el único camino que ejercita esta vía)
queda pendiente, como ya declaraba la spec.

**S1 — carrera en la caché de íconos en disco (`icon-cache.js`)**. Se eligió
serializar las escrituras (cola de promesas encadenadas, mismo patrón que
`installed-apps.js` ya usa para su promesa en vuelo) en vez de releer y
fusionar en el momento de escribir: la extracción (`getExecutableIcon`)
sigue siendo concurrente entre llamadas — no se serializa el trabajo caro—,
solo el tramo lectura+merge+escritura del archivo, que ahora es
enteramente síncrono dentro de cada turno de la cola.
**Verificado con `node -e`** contra el `json-store.js` real (mockeando
`electron` y `platform-windows.js#getExecutableIcon` con retrasos
escalonados): 5 `getIcon()` concurrentes sobreviven completas en disco.
Control negativo: la misma prueba contra la secuencia previa
(lectura→await→escritura sin cola) perdió 4 de 5 claves, confirmando la
carrera.

**Commits**: `e7dd8d2` (C1), `cf4b70b` (C2), `a0c5648` (S1).

2026-08-02 | judgment-escalation-resolved | app-detection-logos-audio | sdd-judgment escaló tras 2 iteraciones con F1 (regresión introducida por el fix de S1 en icon-cache.js) y F2 (matchFocusedAppId compara contra Description en vez de nombre de imagen). El orquestador presentó el judgment-report al usuario, que optó por corregir ambos antes de archivar en vez de aceptarlos como deuda. Se despacha sdd-apply con alcance acotado a esos dos fixes; el pipeline sigue a sdd-archive sin una tercera ronda de judgment (iteraciones agotadas, decisión explícita del usuario).

2026-08-02 | judgment-escalation-fixed | app-detection-logos-audio | Corregidos F1 y F2 del judgment-report iteración 2, alcance acotado (sin re-auditar el resto del cambio).

**F1 — `icon-cache.js#persistToDisk` (commit `fa12e68`)**. Se agregó
`.catch(() => {})` al final de la cadena de la cola de escrituras. Con eso,
un fallo de `jsonStore.writeJson` (síncrono, sin try/catch por diseño,
D11/ADR-0006) ya no deja `diskWriteQueue` como promesa rechazada para
siempre: la cola se restablece a resuelta en el próximo turno, y `getIcon`
—que hace `await persistToDisk(...)`— deja de propagar ese fallo al
renderer. Decisión explícita (la que el propio judgment-report sugería como
la coherente): el fallo de la caché en disco ya no es visible para el
llamador, porque es una optimización sobre la caché en memoria, no un
requisito de corrección del ícono.
**Verificado con `node -e`** sobre `icon-cache.js` y `json-store.js` reales,
`fs` real, con una escritura fallida simulada (monkey-patch de
`fs.writeFileSync` para la segunda llamada) y `electron`/`active-win`
stubeados: post-fix, `getIcon()` para una clave nunca vista tras la falla ya
no rechaza y persiste correctamente en disco. Control negativo corrido
contra el propio `icon-cache.js` en `HEAD` (antes del fix, `git show
HEAD:src/main/icon-cache.js`): reproduce el rechazo permanente descrito por
el judgment-report byte a byte (mismo mensaje de error propagado en la
tercera llamada).

**F2 — `monitor-engine.js#matchFocusedAppId` (commit `a74a658`)**. Se extrajo
`degradedAppId(imageName)` como única función que arma el prefijo
`'name:<imagen>'`, compartida por `normalizeAppId` (productor, ya usado por
`addToSelection`) y `matchFocusedAppId` (consumidor). La rama de nombre de
`matchFocusedAppId` ahora deriva el nombre de imagen con `path.basename`
desde `sFocus.exePath` cuando esa ruta está disponible, y solo cae a
`sFocus.name` (la Description del recurso de versión, no un nombre de
imagen) como último recurso. Con esto, filas degradadas emparejan el foco
contra la misma forma de identificador que usa el descubrimiento por
`tasklist`.
**Verificado con `node -e`** sobre `reduceFocus`/`matchFocusedAppId` reales:
una fila degradada (`appId: 'name:clipstudiopaint.exe'`) con una muestra de
foco `{ exePath: 'C:\\...\\CLIPStudioPaint.exe', name: 'Clip Studio Paint' }`
pasa a `running` y acumula 5000ms tras 5s de foco. Nota de entorno: el
`path` nativo de Node en este WSL2 es POSIX y no separa por `\`; se parchea
`path.basename = path.win32.basename` solo en el arnés de verificación para
reproducir fielmente la semántica de Windows en la que corre el main process
en producción (D10/ADR-0004) — no es un cambio de comportamiento del fix.
Control negativo corrido contra `monitor-engine.js` en `HEAD` (antes del
fix): la misma fila y la misma muestra de foco quedan en `paused`/`0ms`,
reproduciendo exactamente el defecto del judgment-report.

**Pendiente de confirmar en Windows** (no ejecutable desde este entorno,
declarado también en el judgment-report):
- El string exacto que `active-win` entrega en `owner.name`/`owner.path`
  para un proceso real con Description, y que `path.win32.basename` sobre
  ese `exePath` real coincide con el nombre de imagen que entrega `tasklist`.
- El comportamiento de `app.quit()` con escrituras encoladas pendientes en
  `diskWriteQueue` (F1 no lo tocó; sigue siendo la misma limitación que ya
  declaraba S1).
- El flujo visual de punta a punta: fila degradada con foco real sobre un
  proceso elevado acumulando tiempo en pantalla, y que una falla real de
  disco (antivirus/OneDrive bloqueando el archivo) no deje la app pidiendo
  íconos en bucle.

Ninguno de los dos fixes tocó lógica fuera de los archivos y funciones que
señalaba el judgment-report; no se aprovechó la iteración para refactorizar
nada adicional (alcance acotado explícito del despacho).
